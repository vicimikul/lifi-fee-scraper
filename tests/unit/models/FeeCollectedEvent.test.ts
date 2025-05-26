import {
	FeeCollectedEventModel,
	FeeCollectedEvent,
} from "../../../src/models/FeeCollectedEvent";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
	describe,
	expect,
	it,
	beforeAll,
	afterAll,
	beforeEach,
} from "@jest/globals";

describe("FeeCollectedEvent Model", () => {
	let mongoServer: MongoMemoryServer;

	beforeAll(async () => {
		// Create an in-memory MongoDB instance
		mongoServer = await MongoMemoryServer.create();
		const mongoUri = mongoServer.getUri();
		await mongoose.connect(mongoUri);

		// Ensure indexes are created
		await FeeCollectedEventModel.createIndexes();
	});

	afterAll(async () => {
		// Clean up and disconnect
		await mongoose.disconnect();
		await mongoServer.stop();
	});

	beforeEach(async () => {
		// Clear the collection before each test
		await FeeCollectedEventModel.deleteMany({});
	});

	it("should create a valid FeeCollectedEvent", async () => {
		const eventData = {
			chainId: 1,
			contractAddress: "0x1234567890123456789012345678901234567890",
			token: "0xabcdef1234567890abcdef1234567890abcdef12",
			integrator: "0x9876543210987654321098765432109876543210",
			integratorFee: "1000000000000000000",
			lifiFee: "500000000000000000",
			blockNumber: 12345678,
			transactionHash:
				"0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			logIndex: 0,
		};

		const event = await FeeCollectedEventModel.create(eventData);

		expect(event).toBeDefined();
		expect(event.chainId).toBe(eventData.chainId);
		expect(event.contractAddress).toBe(eventData.contractAddress);
		expect(event.token).toBe(eventData.token);
		expect(event.integrator).toBe(eventData.integrator);
		expect(event.integratorFee).toBe(eventData.integratorFee);
		expect(event.lifiFee).toBe(eventData.lifiFee);
		expect(event.blockNumber).toBe(eventData.blockNumber);
		expect(event.transactionHash).toBe(eventData.transactionHash);
		expect(event.logIndex).toBe(eventData.logIndex);
		expect(event.createdAt).toBeInstanceOf(Date);
		expect(event.updatedAt).toBeInstanceOf(Date);
	});

	it("should fail when required fields are missing", async () => {
		const eventData = {
			chainId: 1,
			// Missing contractAddress
			token: "0xabcdef1234567890abcdef1234567890abcdef12",
			integrator: "0x9876543210987654321098765432109876543210",
			integratorFee: "1000000000000000000",
			lifiFee: "500000000000000000",
			blockNumber: 12345678,
			transactionHash:
				"0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			logIndex: 0,
		};

		await expect(FeeCollectedEventModel.create(eventData)).rejects.toThrow();
	});

	it("should enforce unique constraint on transactionHash and logIndex", async () => {
		const eventData = {
			chainId: 1,
			contractAddress: "0x1234567890123456789012345678901234567890",
			token: "0xabcdef1234567890abcdef1234567890abcdef12",
			integrator: "0x9876543210987654321098765432109876543210",
			integratorFee: "1000000000000000000",
			lifiFee: "500000000000000000",
			blockNumber: 12345678,
			transactionHash:
				"0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			logIndex: 0,
		};

		// Create first event
		await FeeCollectedEventModel.create(eventData);

		// Try to create second event with same transactionHash and logIndex
		await expect(
			FeeCollectedEventModel.create({
				...eventData,
				// Change other fields to ensure only transactionHash and logIndex are checked
				chainId: 2,
				blockNumber: 12345679,
			})
		).rejects.toThrow(/duplicate key error/);
	});

	it("should store fees as strings to prevent precision issues", async () => {
		const eventData = {
			chainId: 1,
			contractAddress: "0x1234567890123456789012345678901234567890",
			token: "0xabcdef1234567890abcdef1234567890abcdef12",
			integrator: "0x9876543210987654321098765432109876543210",
			integratorFee: "1000000000000000000",
			lifiFee: "500000000000000000",
			blockNumber: 12345678,
			transactionHash:
				"0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			logIndex: 0,
		};

		const event = await FeeCollectedEventModel.create(eventData);

		expect(typeof event.integratorFee).toBe("string");
		expect(typeof event.lifiFee).toBe("string");
		expect(event.integratorFee).toBe("1000000000000000000");
		expect(event.lifiFee).toBe("500000000000000000");
	});

	it("should create indexes for specified fields", async () => {
		// Force index creation
		await FeeCollectedEventModel.createIndexes();

		const indexes = await FeeCollectedEventModel.collection.indexes();

		// Check for compound index on transactionHash and logIndex
		const compoundIndex = indexes.find(
			(index) =>
				index.key.transactionHash === 1 &&
				index.key.logIndex === 1 &&
				index.unique === true
		);
		expect(compoundIndex).toBeDefined();

		// Check for single field indexes
		const singleFieldIndexes = [
			"chainId",
			"token",
			"integrator",
			"blockNumber",
		];
		singleFieldIndexes.forEach((field) => {
			const index = indexes.find((idx) => idx.key[field] === 1);
			expect(index).toBeDefined();
		});
	});

	it("should update timestamps on document modification", async () => {
		const eventData = {
			chainId: 1,
			contractAddress: "0x1234567890123456789012345678901234567890",
			token: "0xabcdef1234567890abcdef1234567890abcdef12",
			integrator: "0x9876543210987654321098765432109876543210",
			integratorFee: "1000000000000000000",
			lifiFee: "500000000000000000",
			blockNumber: 12345678,
			transactionHash:
				"0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			logIndex: 0,
		};

		const event = await FeeCollectedEventModel.create(eventData);
		const originalUpdatedAt = event.updatedAt;

		// Wait a bit to ensure timestamp difference
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Update the event
		event.blockNumber = 12345679;
		await event.save();

		expect(event.updatedAt.getTime()).toBeGreaterThan(
			originalUpdatedAt.getTime()
		);
	});
});
