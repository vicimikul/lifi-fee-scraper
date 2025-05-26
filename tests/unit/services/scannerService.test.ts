import { ScannerService } from "../../../src/services/scannerService";
import { BlockchainService } from "../../../src/services/blockchainService";
import { EventService } from "../../../src/services/eventService";
import { FeeCollectedEventData } from "../../../src/types/events";
import { config } from "../../../src/utils/config";
import { providers } from "ethers";
import { describe, expect, it, beforeEach, jest } from "@jest/globals";

// Mock the services
jest.mock("../../../src/services/blockchainService");
jest.mock("../../../src/services/eventService");

describe("ScannerService", () => {
	let scannerService: ScannerService;
	let mockBlockchainService: jest.Mocked<BlockchainService>;
	let mockEventService: jest.Mocked<EventService>;

	const mockEvent: FeeCollectedEventData = {
		args: {
			token: "0x123...",
			integrator: "0x456...",
			integratorFee: "1000000000000000000", // 1 ETH
			lifiFee: "500000000000000000", // 0.5 ETH
		},
		blockNumber: 1000,
		transactionHash: "0x789...",
		logIndex: 0,
		address: "0x123...",
		topics: [],
		data: "0x",
		blockHash: "0xabc...",
		transactionIndex: 0,
		removed: false,
		removeListener: () => {},
		getBlock: () => Promise.resolve({} as providers.Block),
		getTransaction: () => Promise.resolve({} as providers.TransactionResponse),
		getTransactionReceipt: () =>
			Promise.resolve({} as providers.TransactionReceipt),
	};

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Create mock instances
		mockBlockchainService = {
			getLatestBlock: jest.fn(),
			loadFeeCollectorEvents: jest.fn(),
			parseFeeCollectorEvents: jest.fn(),
		} as unknown as jest.Mocked<BlockchainService>;

		mockEventService = {
			getLastScannedBlock: jest.fn(),
			storeEvents: jest.fn(),
			updateLastScannedBlock: jest.fn(),
		} as unknown as jest.Mocked<EventService>;

		// Mock the constructor of BlockchainService and EventService
		(BlockchainService as jest.Mock).mockImplementation(
			() => mockBlockchainService
		);
		(EventService as jest.Mock).mockImplementation(() => mockEventService);

		// Create service instance
		scannerService = new ScannerService();
	});

	describe("scanBlockRange", () => {
		it("should successfully scan a block range", async () => {
			const fromBlock = 1000;
			const toBlock = 2000;
			const mockEvents = [mockEvent];

			mockBlockchainService.loadFeeCollectorEvents.mockResolvedValue(
				mockEvents
			);

			const events = await scannerService.scanBlockRange(fromBlock, toBlock);

			expect(events).toEqual(mockEvents);
			expect(mockBlockchainService.loadFeeCollectorEvents).toHaveBeenCalledWith(
				fromBlock,
				toBlock
			);
		});

		it("should handle empty block ranges", async () => {
			const fromBlock = 1000;
			const toBlock = 1000;

			mockBlockchainService.loadFeeCollectorEvents.mockResolvedValue([]);

			const events = await scannerService.scanBlockRange(fromBlock, toBlock);

			expect(events).toHaveLength(0);
			expect(mockBlockchainService.loadFeeCollectorEvents).toHaveBeenCalledWith(
				fromBlock,
				toBlock
			);
		});

		it("should handle blockchain service errors", async () => {
			const fromBlock = 1000;
			const toBlock = 2000;

			mockBlockchainService.loadFeeCollectorEvents.mockRejectedValue(
				new Error("Blockchain error")
			);

			await expect(
				scannerService.scanBlockRange(fromBlock, toBlock)
			).rejects.toThrow("Blockchain error");
		});
	});

	describe("scanBlocks", () => {
		it("should successfully scan blocks in chunks", async () => {
			const lastScannedBlock = 1000;
			const latestBlock = 2000;
			const mockEvents = [mockEvent];

			mockBlockchainService.getLatestBlock.mockResolvedValue(latestBlock);
			mockEventService.getLastScannedBlock.mockResolvedValue(lastScannedBlock);
			mockBlockchainService.loadFeeCollectorEvents.mockResolvedValue(
				mockEvents
			);
			mockBlockchainService.parseFeeCollectorEvents.mockReturnValue(mockEvents);

			await scannerService.scanBlocks();

			// Verify the scan was performed in chunks
			expect(
				mockBlockchainService.loadFeeCollectorEvents
			).toHaveBeenCalledTimes(
				Math.ceil((latestBlock - lastScannedBlock) / config.chunkSize)
			);

			// Verify events were stored
			expect(mockEventService.storeEvents).toHaveBeenCalledWith(mockEvents);

			// Verify last scanned block was updated
			expect(mockEventService.updateLastScannedBlock).toHaveBeenCalledWith(
				expect.any(Number)
			);
		});

		it("should handle no new blocks to scan", async () => {
			const lastScannedBlock = 2000;
			const latestBlock = 2000;

			mockBlockchainService.getLatestBlock.mockResolvedValue(latestBlock);
			mockEventService.getLastScannedBlock.mockResolvedValue(lastScannedBlock);
			// Mock parseFeeCollectorEvents to return empty array instead of undefined
			mockBlockchainService.parseFeeCollectorEvents.mockReturnValue([]);

			await scannerService.scanBlocks();

			expect(
				mockBlockchainService.loadFeeCollectorEvents
			).not.toHaveBeenCalled();
			expect(mockEventService.storeEvents).not.toHaveBeenCalled();
			expect(mockEventService.updateLastScannedBlock).not.toHaveBeenCalled();
		});

		it("should continue scanning after chunk errors", async () => {
			const lastScannedBlock = 1000;
			const latestBlock = 2000;
			const mockEvents = [mockEvent];

			mockBlockchainService.getLatestBlock.mockResolvedValue(latestBlock);
			mockEventService.getLastScannedBlock.mockResolvedValue(lastScannedBlock);

			// First chunk fails, second succeeds
			mockBlockchainService.loadFeeCollectorEvents
				.mockRejectedValueOnce(new Error("Chunk error"))
				.mockResolvedValueOnce(mockEvents);
			// Mock parseFeeCollectorEvents to return the events
			mockBlockchainService.parseFeeCollectorEvents.mockReturnValue(mockEvents);

			await scannerService.scanBlocks();

			// Verify we continued scanning despite the error
			expect(
				mockBlockchainService.loadFeeCollectorEvents
			).toHaveBeenCalledTimes(2);
			expect(mockEventService.storeEvents).toHaveBeenCalledWith(mockEvents);
		});

		it("should handle blockchain service errors", async () => {
			mockBlockchainService.getLatestBlock.mockRejectedValue(
				new Error("Blockchain error")
			);

			await expect(scannerService.scanBlocks()).rejects.toThrow(
				"Blockchain error"
			);
		});

		it("should handle event service errors", async () => {
			const lastScannedBlock = 1000;
			const latestBlock = 2000;

			mockBlockchainService.getLatestBlock.mockResolvedValue(latestBlock);
			mockEventService.getLastScannedBlock.mockRejectedValue(
				new Error("Event service error")
			);

			await expect(scannerService.scanBlocks()).rejects.toThrow(
				"Event service error"
			);
		});
	});
});
