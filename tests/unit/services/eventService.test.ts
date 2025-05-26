import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { EventService } from "../../../src/services/eventService";
import { FeeCollectedEventModel } from "../../../src/models/FeeCollectedEvent";
import { LastScannedBlockModel } from "../../../src/models/LastScannedBlock";
import { FeeCollectedEventData } from "../../../src/types/events";
import { config } from "../../../src/config";
import { providers } from "ethers";
import {
	describe,
	expect,
	it,
	beforeAll,
	beforeEach,
	afterAll,
} from "@jest/globals";

describe("EventService", () => {
	let mongoServer: MongoMemoryServer;
	let eventService: EventService;

	// Sample test data with string values for fees
	const mockEvent: FeeCollectedEventData = {
		args: {
			token: "0x123...",
			integrator: "0x456...",
			integratorFee: "1000000000000000000", // 1 ETH as string
			lifiFee: "500000000000000000", // 0.5 ETH as string
		},
		blockNumber: 1000,
		transactionHash: "0x789...",
		logIndex: 0,
		// Required Event properties
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
		} catch (error) {
			console.error("Failed to setup test environment:", error);
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

			await Promise.all([
				FeeCollectedEventModel.deleteMany({}),
				LastScannedBlockModel.deleteMany({}),
			]);
			eventService = new EventService();
		} catch (error) {
			console.error("Failed to setup test:", error);
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
			console.error("Failed to cleanup test environment:", error);
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
			await eventService.storeEvents(events);

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
			await eventService.storeEvents(events);
			await eventService.storeEvents(events); // Try to store the same events again

			const storedEvents = await FeeCollectedEventModel.find({});
			expect(storedEvents).toHaveLength(1); // Only one event should be stored
		});

		/**
		 * Test handling of empty event arrays
		 * Verifies that the function handles empty input gracefully
		 */
		it("should handle empty event arrays", async () => {
			await eventService.storeEvents([]);
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

			await expect(eventService.storeEvents(events)).rejects.toThrow();
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

			await expect(eventService.storeEvents([invalidEvent])).rejects.toThrow();

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

			await eventService.storeEvents(events);

			const storedEvent = await FeeCollectedEventModel.findOne({});

			expect(storedEvent).toBeDefined();
			if (storedEvent) {
				expect(storedEvent.chainId).toBe(config.chainId);
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
			await eventService.updateLastScannedBlock(blockNumber);

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
				eventService.updateLastScannedBlock(invalidBlockNumber)
			).rejects.toThrow("Invalid block number");
		});

		/**
		 * Test block number persistence
		 * Verifies that block numbers persist across updates
		 */
		it("should persist block number across updates", async () => {
			const blockNumber1 = 1000;
			const blockNumber2 = 2000;

			await eventService.updateLastScannedBlock(blockNumber1);
			await eventService.updateLastScannedBlock(blockNumber2);

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
			await eventService.updateLastScannedBlock(blockNumber);

			const lastBlock = await eventService.getLastScannedBlock();
			expect(lastBlock).toBe(blockNumber);
		});

		/**
		 * Test handling of no scanned blocks
		 * Verifies that start block is returned when no blocks are scanned
		 */
		it("should return start block when no block is scanned", async () => {
			const lastBlock = await eventService.getLastScannedBlock();
			expect(lastBlock).toBe(Number(config.startBlock));
		});

		/**
		 * Test database error handling
		 * Verifies that database errors are properly handled
		 */
		it("should handle database errors", async () => {
			await mongoose.disconnect();
			await expect(eventService.getLastScannedBlock()).rejects.toThrow();
		});
	});
});
