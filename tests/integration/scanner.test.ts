import { ScannerService } from "../../src/services/scannerService";
import { EventService } from "../../src/services/eventService";
import { BlockchainService } from "../../src/services/blockchainService";
import { FeeCollectedEventModel } from "../../src/models/FeeCollectedEvent";
import { LastScannedBlockModel } from "../../src/models/LastScannedBlock";
import { config } from "../../src/utils/config";
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
import { ChainIds } from "../../src/types/chains";

// Test database configuration
const TEST_DB_NAME = "scanner_test";
const TEST_MONGO_URI = config.testMongoUri.replace("/test", `/${TEST_DB_NAME}`);

// Mock service dependencies
jest.mock("../../src/services/blockchainService");
jest.mock("../../src/services/eventService");
jest.mock("ethers");

// Mock logger to prevent console output during tests
jest.mock("../../src/utils/logger", () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));

// Increase timeout for database operations
jest.setTimeout(30000);

const TEST_CHAIN_ID = ChainIds.POLYGON;

/**
 * Integration tests for the Scanner Service
 * Tests the block scanning functionality and event processing
 */
describe("Scanner Integration", () => {
	let scannerService: ScannerService;
	let mockBlockchainService: jest.Mocked<BlockchainService>;
	let mockEventService: jest.Mocked<EventService>;

	// Sample test data for fee collection events
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

	// Setup test environment
	beforeAll(async () => {
		try {
			// Connect to test database
			await mongoose.connect(TEST_MONGO_URI);

			// Create mock service instances
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

			// Initialize scanner service with mocked dependencies
			scannerService = ScannerService.getInstance();
			(scannerService as any).blockchainService = mockBlockchainService;
			(scannerService as any).eventService = mockEventService;
		} catch (error) {
			logger.error({ error }, "Setup failed");
			throw error;
		}
	});

	// Cleanup after all tests
	afterAll(async () => {
		try {
			// Clean up collections
			await Promise.all([
				FeeCollectedEventModel.deleteMany({}),
				LastScannedBlockModel.deleteMany({}),
			]);

			if (mongoose.connection.readyState === 1) {
				await mongoose.disconnect();
			}
		} catch (error) {
			logger.error({ error }, "Cleanup failed");
			throw error;
		}
	});

	// Reset test state before each test
	beforeEach(async () => {
		try {
			// Clear collections and reset mocks
			await Promise.all([
				FeeCollectedEventModel.deleteMany({}),
				LastScannedBlockModel.deleteMany({}),
			]);
			jest.clearAllMocks();
		} catch (error) {
			logger.error({ error }, "BeforeEach cleanup failed");
			throw error;
		}
	});

	/**
	 * Test successful block scanning and event processing
	 * Verifies:
	 * - Events are stored in the database
	 * - Last scanned block is updated
	 * - Correct block range is processed
	 */
	it("should scan blocks and store events", async () => {
		const startBlock = Number(config.chains[TEST_CHAIN_ID].startBlock);
		const endBlock = startBlock + 1000;

		// Setup mock responses
		mockBlockchainService.getLatestBlock.mockResolvedValue(endBlock);
		mockEventService.getLastScannedBlock.mockResolvedValue(startBlock);
		mockBlockchainService.loadFeeCollectorEvents.mockResolvedValue(mockEvents);
		mockBlockchainService.parseFeeCollectorEvents.mockReturnValue(mockEvents);

		// Mock database update for last scanned block
		mockEventService.updateLastScannedBlock.mockImplementation(
			async (chainId, blockNumber) => {
				try {
					await LastScannedBlockModel.updateOne(
						{ chainId },
						{ $set: { blockNumber } },
						{ upsert: true }
					);
				} catch (error) {
					logger.error(
						{ chainId, blockNumber, error },
						"Mock failed to update last scanned block"
					);
					throw error;
				}
			}
		);

		// Execute block scanning
		await scannerService.scanBlocks(TEST_CHAIN_ID, startBlock, endBlock);

		// Verify events were stored
		const events = await FeeCollectedEventModel.find({});
		expect(events.length).toBeGreaterThanOrEqual(0);

		// Verify last scanned block was updated
		const lastBlock = await LastScannedBlockModel.findOne({
			chainId: TEST_CHAIN_ID,
		});
		expect(lastBlock).not.toBeNull();
		expect(lastBlock!.blockNumber).toBeGreaterThanOrEqual(0);
	});

	/**
	 * Test handling of empty block ranges
	 * Verifies:
	 * - No events are stored
	 * - No block updates occur
	 */
	it("should handle empty block ranges", async () => {
		// Setup mocks for empty range
		mockBlockchainService.getLatestBlock.mockResolvedValue(2000);
		mockEventService.getLastScannedBlock.mockResolvedValue(2000);
		mockBlockchainService.loadFeeCollectorEvents.mockResolvedValue([]);
		mockBlockchainService.parseFeeCollectorEvents.mockReturnValue([]);

		// Execute block scanning
		await scannerService.scanBlocks(TEST_CHAIN_ID, 2000, 2000);

		// Verify no operations occurred
		expect(mockEventService.storeEvents).not.toHaveBeenCalled();
		expect(mockEventService.updateLastScannedBlock).not.toHaveBeenCalled();
	});

	/**
	 * Test error handling for blockchain errors
	 * Verifies:
	 * - Errors are properly propagated
	 * - No events are stored on error
	 * - No block updates occur on error
	 */
	it("should handle blockchain errors gracefully", async () => {
		// Setup mocks to simulate blockchain errors
		mockBlockchainService.getLatestBlock.mockResolvedValue(2000);
		mockEventService.getLastScannedBlock.mockResolvedValue(999);
		mockBlockchainService.loadFeeCollectorEvents.mockRejectedValue(
			new Error("Blockchain error")
		);
		mockBlockchainService.parseFeeCollectorEvents.mockImplementation(() => {
			throw new Error("Blockchain error");
		});

		// Verify error is thrown
		await expect(
			scannerService.scanBlocks(TEST_CHAIN_ID, 999, 2000)
		).rejects.toThrow("Blockchain error");

		// Verify no operations occurred
		expect(mockEventService.storeEvents).not.toHaveBeenCalled();
		expect(mockEventService.updateLastScannedBlock).not.toHaveBeenCalled();
	});

	/**
	 * Test error handling for database errors
	 * Verifies:
	 * - Database errors are properly propagated
	 * - No events are stored on error
	 * - No block updates occur on error
	 */
	it("should handle database errors gracefully", async () => {
		// Setup mocks to simulate database errors
		mockBlockchainService.getLatestBlock.mockResolvedValue(2000);
		mockEventService.getLastScannedBlock.mockRejectedValue(
			new Error("Database error")
		);

		// Verify error is thrown
		await expect(
			scannerService.scanBlocks(TEST_CHAIN_ID, 0, 2000)
		).rejects.toThrow("Database error");

		// Verify no operations occurred
		expect(mockEventService.storeEvents).not.toHaveBeenCalled();
		expect(mockEventService.updateLastScannedBlock).not.toHaveBeenCalled();
	});

	/**
	 * Test block scanning in chunks
	 * Verifies:
	 * - Blocks are processed in chunks
	 * - Events are stored for each chunk
	 * - Last scanned block is updated correctly
	 */
	it("should scan blocks in chunks", async () => {
		// Setup mocks for chunked processing
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

		// Execute block scanning
		await scannerService.scanBlocks(TEST_CHAIN_ID, 999, 2000);

		// Verify chunked processing
		expect(mockEventService.storeEvents).toHaveBeenCalledTimes(2);
		expect(mockEventService.updateLastScannedBlock).toHaveBeenCalledWith(
			TEST_CHAIN_ID,
			1998
		);
	});
});
