import { ScannerService } from "../../src/services/scannerService";
import { EventService } from "../../src/services/eventService";
import { BlockchainService } from "../../src/services/blockchainService";
import { FeeCollectedEventModel } from "../../src/models/FeeCollectedEvent";
import { LastScannedBlockModel } from "../../src/models/LastScannedBlock";
import { config } from "../../src/config";
import { FeeCollectedEventData } from "../../src/types/events";
import mongoose from "mongoose";
import { providers } from "ethers";
import {
	describe,
	expect,
	it,
	beforeAll,
	afterAll,
	beforeEach,
	jest,
} from "@jest/globals";
import logger from "../../src/utils/logger";

// Mock the services
jest.mock("../../src/services/blockchainService");
jest.mock("../../src/services/eventService");
jest.mock("ethers");

// Mock the logger
jest.mock("../../src/utils/logger", () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));

// Increase timeout for database operations
jest.setTimeout(30000);

describe("Scanner Integration", () => {
	let scannerService: ScannerService;
	let mockBlockchainService: jest.Mocked<BlockchainService>;
	let mockEventService: jest.Mocked<EventService>;

	// Sample test data
	const mockEvents = [
		{
			args: {
				token: "0x1234567890123456789012345678901234567890",
				integrator: "0x9876543210987654321098765432109876543210",
				integratorFee: "1000000000000000000", // 1 ETH
				lifiFee: "500000000000000000", // 0.5 ETH
			},
			blockNumber: 1000,
			transactionHash:
				"0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			logIndex: 0,
			address: config.contractAddress,
			topics: [],
			data: "0x",
			blockHash: "0xabc...",
			transactionIndex: 0,
			removed: false,
			removeListener: () => {},
			getBlock: () => Promise.resolve({} as providers.Block),
			getTransaction: () =>
				Promise.resolve({} as providers.TransactionResponse),
			getTransactionReceipt: () =>
				Promise.resolve({} as providers.TransactionReceipt),
		},
	] as FeeCollectedEventData[];

	beforeAll(async () => {
		try {
			// Connect to test database
			await mongoose.connect(config.testMongoUri);

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

			// Initialize service
			scannerService = new ScannerService();
		} catch (error) {
			logger.error({ error }, "Setup failed");
			throw error;
		}
	});

	afterAll(async () => {
		try {
			if (mongoose.connection.readyState === 1) {
				// Clean up collections instead of dropping the database
				await Promise.all([
					FeeCollectedEventModel.deleteMany({}),
					LastScannedBlockModel.deleteMany({}),
				]);
				await mongoose.disconnect();
			}
		} catch (error) {
			logger.error({ error }, "Cleanup failed");
			throw error;
		}
	});

	beforeEach(async () => {
		try {
			// Clear collections before each test
			if (mongoose.connection.readyState === 1) {
				await Promise.all([
					FeeCollectedEventModel.deleteMany({}),
					LastScannedBlockModel.deleteMany({}),
				]);
			}
			// Reset all mocks
			jest.clearAllMocks();
		} catch (error) {
			logger.error({ error }, "BeforeEach cleanup failed");
			throw error;
		}
	});

	it("should scan blocks and store events", async () => {
		// Setup mocks
		mockBlockchainService.getLatestBlock.mockResolvedValue(2000);
		mockEventService.getLastScannedBlock.mockResolvedValue(999);
		mockBlockchainService.loadFeeCollectorEvents.mockResolvedValue(mockEvents);
		mockBlockchainService.parseFeeCollectorEvents.mockReturnValue(mockEvents);

		// Run the scanner
		await scannerService.scanBlocks();

		// Verify events were stored
		expect(mockEventService.storeEvents).toHaveBeenCalledWith(mockEvents);
		expect(mockEventService.updateLastScannedBlock).toHaveBeenCalledWith(2000);
	});

	it("should handle empty block ranges", async () => {
		// Setup mocks
		mockBlockchainService.getLatestBlock.mockResolvedValue(2000);
		mockEventService.getLastScannedBlock.mockResolvedValue(2000);
		mockBlockchainService.loadFeeCollectorEvents.mockResolvedValue([]);
		mockBlockchainService.parseFeeCollectorEvents.mockReturnValue([]);

		// Run the scanner
		await scannerService.scanBlocks();

		// Verify no events were stored
		expect(mockEventService.storeEvents).not.toHaveBeenCalled();
		expect(mockEventService.updateLastScannedBlock).not.toHaveBeenCalled();
	});

	it("should handle blockchain errors gracefully", async () => {
		// Setup mocks
		mockBlockchainService.getLatestBlock.mockResolvedValue(2000);
		mockEventService.getLastScannedBlock.mockResolvedValue(999);
		// Mock the error to be thrown in scanBlockRange
		mockBlockchainService.loadFeeCollectorEvents.mockRejectedValue(
			new Error("Blockchain error")
		);
		// Mock parseFeeCollectorEvents to throw as well
		mockBlockchainService.parseFeeCollectorEvents.mockImplementation(() => {
			throw new Error("Blockchain error");
		});

		// Run the scanner and expect it to throw
		await expect(scannerService.scanBlocks()).rejects.toThrow(
			"Blockchain error"
		);

		// Verify no events were stored
		expect(mockEventService.storeEvents).not.toHaveBeenCalled();
		expect(mockEventService.updateLastScannedBlock).not.toHaveBeenCalled();
	});

	it("should handle database errors gracefully", async () => {
		// Setup mocks
		mockBlockchainService.getLatestBlock.mockResolvedValue(2000);
		mockEventService.getLastScannedBlock.mockRejectedValue(
			new Error("Database error")
		);

		// Run the scanner and expect it to throw
		await expect(scannerService.scanBlocks()).rejects.toThrow("Database error");

		// Verify no events were stored
		expect(mockEventService.storeEvents).not.toHaveBeenCalled();
		expect(mockEventService.updateLastScannedBlock).not.toHaveBeenCalled();
	});

	it("should scan blocks in chunks", async () => {
		// Setup mocks
		mockBlockchainService.getLatestBlock.mockResolvedValue(2000);
		mockEventService.getLastScannedBlock.mockResolvedValue(999);

		// Mock multiple chunks of events
		mockBlockchainService.loadFeeCollectorEvents
			.mockResolvedValueOnce([mockEvents[0]]) // First chunk
			.mockResolvedValueOnce([mockEvents[0]]); // Second chunk
		mockBlockchainService.parseFeeCollectorEvents.mockReturnValue([
			mockEvents[0],
			mockEvents[0],
		]);

		// Run the scanner
		await scannerService.scanBlocks();

		// Verify events were stored
		expect(mockEventService.storeEvents).toHaveBeenCalledTimes(2);
		// Verify last scanned block was updated with the last chunk's end block
		expect(mockEventService.updateLastScannedBlock).toHaveBeenCalledWith(1998);
	});
});
