import {
	LastScannedBlockModel,
	LastScannedBlock,
} from "../../../src/models/LastScannedBlock";
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

describe("LastScannedBlock Model", () => {
	let mongoServer: MongoMemoryServer;

	beforeAll(async () => {
		// Create an in-memory MongoDB instance
		mongoServer = await MongoMemoryServer.create();
		const mongoUri = mongoServer.getUri();
		await mongoose.connect(mongoUri);

		// Ensure indexes are created
		await LastScannedBlockModel.createIndexes();
	});

	afterAll(async () => {
		// Clean up and disconnect
		await mongoose.disconnect();
		await mongoServer.stop();
	});

	beforeEach(async () => {
		// Clear the collection before each test
		await LastScannedBlockModel.deleteMany({});
	});

	it("should create a valid LastScannedBlock", async () => {
		const blockData = {
			chainId: 1,
			blockNumber: 12345678,
		};

		const block = await LastScannedBlockModel.create(blockData);

		expect(block).toBeDefined();
		expect(block.chainId).toBe(blockData.chainId);
		expect(block.blockNumber).toBe(blockData.blockNumber);
		expect(block.createdAt).toBeInstanceOf(Date);
		expect(block.updatedAt).toBeInstanceOf(Date);
	});

	it("should fail when required fields are missing", async () => {
		const blockData = {
			// Missing chainId
			blockNumber: 12345678,
		};

		await expect(LastScannedBlockModel.create(blockData)).rejects.toThrow();
	});

	it("should enforce unique constraint on chainId", async () => {
		const blockData = {
			chainId: 1,
			blockNumber: 12345678,
		};

		// Create first block
		await LastScannedBlockModel.create(blockData);

		// Try to create second block with same chainId
		await expect(
			LastScannedBlockModel.create({
				...blockData,
				blockNumber: 87654321, // Different block number
			})
		).rejects.toThrow(/duplicate key error/);
	});

	it("should allow different chainIds", async () => {
		const blockData1 = {
			chainId: 1,
			blockNumber: 12345678,
		};

		const blockData2 = {
			chainId: 2,
			blockNumber: 87654321,
		};

		// Create first block
		await LastScannedBlockModel.create(blockData1);

		// Create second block with different chainId
		const block2 = await LastScannedBlockModel.create(blockData2);

		expect(block2).toBeDefined();
		expect(block2.chainId).toBe(blockData2.chainId);
		expect(block2.blockNumber).toBe(blockData2.blockNumber);
	});

	it("should create indexes for specified fields", async () => {
		const indexes = await LastScannedBlockModel.collection.indexes();

		// Check for unique index on chainId
		const chainIdIndex = indexes.find(
			(index) => index.key.chainId === 1 && index.unique === true
		);
		expect(chainIdIndex).toBeDefined();
	});

	it("should update timestamps on document modification", async () => {
		const blockData = {
			chainId: 1,
			blockNumber: 12345678,
		};

		const block = await LastScannedBlockModel.create(blockData);
		const originalUpdatedAt = block.updatedAt;

		// Wait a bit to ensure timestamp difference
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Update the block
		block.blockNumber = 87654321;
		await block.save();

		expect(block.updatedAt.getTime()).toBeGreaterThan(
			originalUpdatedAt.getTime()
		);
	});

	it("should handle negative block numbers", async () => {
		const blockData = {
			chainId: 1,
			blockNumber: -1,
		};

		// Should allow negative block numbers as they might be valid in some cases
		const block = await LastScannedBlockModel.create(blockData);
		expect(block.blockNumber).toBe(-1);
	});
});
