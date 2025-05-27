import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { EventService } from "../../../src/services/eventService";
import { FeeCollectedEventModel } from "../../../src/models/FeeCollectedEvent";
import { LastScannedBlockModel } from "../../../src/models/LastScannedBlock";
import { FeeCollectedEventData } from "../../../src/types/events";
import { config } from "../../../src/utils/config";
import { providers } from "ethers";
import { ChainIds } from "../../../src/types/chains";
import {
	describe,
	expect,
	it,
	beforeAll,
	beforeEach,
	afterAll,
	jest,
} from "@jest/globals";
import logger from "../../../src/utils/logger";

// Mock the logger
jest.mock("../../../src/utils/logger", () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));

describe("EventService", () => {
	let mongoServer: MongoMemoryServer;
	let eventService: EventService;

	const validAddress = "0x" + "a".repeat(40); // 42 chars
	const validTxHash = "0x" + "b".repeat(64); // 66 chars
	const TEST_CHAIN_ID = ChainIds.POLYGON;

	// Sample test data with string values for fees
	const mockEvent: FeeCollectedEventData = {
		args: {
			token: validAddress,
			integrator: validAddress,
			integratorFee: "1000000000000000000",
			lifiFee: "500000000000000000",
		},
		blockNumber: 1000,
		transactionHash: validTxHash,
		logIndex: 0,
		// Required Event properties
		address: config.contractAddress,
		topics: [],
		data: "0x",
		blockHash: validTxHash,
		transactionIndex: 0,
		removed: false,
		removeListener: () => {},
		getBlock: () => Promise.resolve({} as providers.Block),
		getTransaction: () => Promise.resolve({} as providers.TransactionResponse),
		getTransactionReceipt: () =>
			Promise.resolve({} as providers.TransactionReceipt),
	};

	/**
	 * Setup test environment before each test
	 * Creates an in-memory MongoDB instance and initializes the EventService
	 */
	beforeAll(async () => {
		try {
			// Create an in-memory MongoDB instance
			mongoServer = await MongoMemoryServer.create();
			const mongoUri = mongoServer.getUri();

			// Connect with basic options
			await mongoose.connect(mongoUri, {
				serverSelectionTimeoutMS: 5000,
			});

			// Wait for the connection to be ready
			await mongoose.connection.asPromise();

			// Drop all collections if they exist
			if (mongoose.connection.db) {
				const collections = await mongoose.connection.db.collections();
				for (const collection of collections) {
					await collection.drop().catch(() => {});
				}
			}

			// Drop all indexes before creating them
			await Promise.all([
				FeeCollectedEventModel.collection.dropIndexes().catch(() => {}),
				LastScannedBlockModel.collection.dropIndexes().catch(() => {}),
			]);

			// Ensure indexes are created
			await Promise.all([
				FeeCollectedEventModel.createIndexes(),
				LastScannedBlockModel.createIndexes(),
			]);
		} catch (error) {
			logger.error({ error }, "Failed to setup test environment");
			throw error;
		}
	}, 30000);

	/**
	 * Clean up after each test
	 * Drops all collections and resets the EventService
	 */
	beforeEach(async () => {
		try {
			// Ensure we're connected before each test
			if (mongoose.connection.readyState !== 1) {
				await mongoose.connect(mongoServer.getUri(), {
					serverSelectionTimeoutMS: 5000,
				});
			}

			// Drop all collections
			if (mongoose.connection.db) {
				const collections = await mongoose.connection.db.collections();
				for (const collection of collections) {
					await collection.drop().catch(() => {});
				}
			}

			// Drop all indexes
			await Promise.all([
				FeeCollectedEventModel.collection.dropIndexes().catch(() => {}),
				LastScannedBlockModel.collection.dropIndexes().catch(() => {}),
			]);

			// Recreate indexes
			await Promise.all([
				FeeCollectedEventModel.createIndexes(),
				LastScannedBlockModel.createIndexes(),
			]);

			eventService = EventService.getInstance();
		} catch (error) {
			logger.error({ error }, "Failed to setup test");
			throw error;
		}
	});

	/**
	 * Clean up after all tests
	 * Disconnects from MongoDB and stops the in-memory server
	 */
	afterAll(async () => {
		try {
			if (mongoose.connection.readyState === 1) {
				await mongoose.disconnect();
			}
			if (mongoServer) {
				await mongoServer.stop();
			}
		} catch (error) {
			logger.error({ error }, "Failed to cleanup test environment");
			throw error;
		}
	});

	describe("storeEvents", () => {
		/**
		 * Test successful event storage
		 * Verifies that events are correctly stored in the database
		 */
		it("should successfully store events", async () => {
			const events = [mockEvent];
			await eventService.storeEvents(events, TEST_CHAIN_ID);

			const storedEvents = await FeeCollectedEventModel.find({});
			expect(storedEvents).toHaveLength(1);
			expect(storedEvents[0].transactionHash).toBe(mockEvent.transactionHash);
			expect(storedEvents[0].logIndex).toBe(mockEvent.logIndex);
		});

		/**
		 * Test handling of duplicate events
		 * Verifies that duplicate events are detected and handled correctly
		 */
		it("should handle duplicate events correctly", async () => {
			const events = [mockEvent];
			await eventService.storeEvents(events, TEST_CHAIN_ID);
			await eventService.storeEvents(events, TEST_CHAIN_ID); // Try to store the same events again

			const storedEvents = await FeeCollectedEventModel.find({});
			expect(storedEvents).toHaveLength(1); // Only one event should be stored
		});

		/**
		 * Test handling of empty event arrays
		 * Verifies that the function handles empty input gracefully
		 */
		it("should handle empty event arrays", async () => {
			await eventService.storeEvents([], TEST_CHAIN_ID);
			const storedEvents = await FeeCollectedEventModel.find({});
			expect(storedEvents).toHaveLength(0);
		});

		/**
		 * Test database connection errors
		 * Verifies that database errors are properly handled
		 */
		it("should handle database connection errors", async () => {
			await mongoose.disconnect();
			const events = [mockEvent];

			await expect(
				eventService.storeEvents(events, TEST_CHAIN_ID)
			).rejects.toThrow();
		}, 15000); // Increased timeout for this test

		/**
		 * Test transaction failures
		 * Verifies that transaction rollbacks work correctly
		 */
		it("should handle transaction failures", async () => {
			// Mock a transaction failure by inserting invalid data
			const invalidEvent = {
				...mockEvent,
				args: {
					...mockEvent.args,
					integratorFee: "invalid", // This should cause a transaction failure
				},
			};

			await expect(
				eventService.storeEvents([invalidEvent], TEST_CHAIN_ID)
			).rejects.toThrow();

			// Verify no events were stored
			const storedEvents = await FeeCollectedEventModel.find({});
			expect(storedEvents).toHaveLength(0);
		});

		/**
		 * Test event data integrity
		 * Verifies that all event fields are stored correctly
		 */
		it("should maintain event data integrity", async () => {
			const events = [mockEvent];

			await eventService.storeEvents(events, TEST_CHAIN_ID);

			const storedEvent = await FeeCollectedEventModel.findOne({});

			expect(storedEvent).toBeDefined();
			if (storedEvent) {
				expect(storedEvent.chainId).toBe(TEST_CHAIN_ID);
				expect(storedEvent.contractAddress).toBe(config.contractAddress);
				expect(storedEvent.token).toBe(mockEvent.args.token);
				expect(storedEvent.integrator).toBe(mockEvent.args.integrator);
				expect(storedEvent.integratorFee).toBe(
					mockEvent.args.integratorFee.toString()
				);
				expect(storedEvent.lifiFee).toBe(mockEvent.args.lifiFee.toString());
				expect(storedEvent.blockNumber).toBe(mockEvent.blockNumber);
				expect(storedEvent.transactionHash).toBe(mockEvent.transactionHash);
				expect(storedEvent.logIndex).toBe(mockEvent.logIndex);
			}
		});
	});

	describe("updateLastScannedBlock", () => {
		/**
		 * Test successful block number update
		 * Verifies that the last scanned block is correctly updated
		 */
		it("should successfully update block number", async () => {
			const blockNumber = 1000;
			await eventService.updateLastScannedBlock(TEST_CHAIN_ID, blockNumber);

			const lastBlock = await LastScannedBlockModel.findOne({});
			expect(lastBlock?.blockNumber).toBe(blockNumber);
		});

		/**
		 * Test handling of invalid block numbers
		 * Verifies that invalid block numbers are rejected
		 */
		it("should handle invalid block numbers", async () => {
			const invalidBlockNumber = -1;
			await expect(
				eventService.updateLastScannedBlock(TEST_CHAIN_ID, invalidBlockNumber)
			).rejects.toThrow();
		});

		/**
		 * Test block number persistence
		 * Verifies that block numbers persist across updates
		 */
		it("should persist block number across updates", async () => {
			const blockNumber1 = 1000;
			const blockNumber2 = 2000;

			await eventService.updateLastScannedBlock(TEST_CHAIN_ID, blockNumber1);
			await eventService.updateLastScannedBlock(TEST_CHAIN_ID, blockNumber2);

			const lastBlock = await LastScannedBlockModel.findOne({});
			expect(lastBlock?.blockNumber).toBe(blockNumber2);
		});
	});

	describe("getLastScannedBlock", () => {
		/**
		 * Test retrieval of last scanned block
		 * Verifies that the correct block number is returned
		 */
		it("should return correct block number", async () => {
			const blockNumber = 1000;
			await eventService.updateLastScannedBlock(TEST_CHAIN_ID, blockNumber);

			const lastBlock = await eventService.getLastScannedBlock(TEST_CHAIN_ID);
			expect(lastBlock).toBe(blockNumber);
		});

		/**
		 * Test handling of no scanned blocks
		 * Verifies that start block is returned when no blocks are scanned
		 */
		it("should return start block when no block is scanned", async () => {
			const lastBlock = await eventService.getLastScannedBlock(TEST_CHAIN_ID);
			expect(lastBlock).toBe(config.chains[TEST_CHAIN_ID].startBlock);
		});

		/**
		 * Test database error handling
		 * Verifies that database errors are properly handled
		 */
		it("should handle database errors", async () => {
			await mongoose.disconnect();
			await expect(
				eventService.getLastScannedBlock(TEST_CHAIN_ID)
			).rejects.toThrow();
		});
	});
});
