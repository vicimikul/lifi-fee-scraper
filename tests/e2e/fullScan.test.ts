import mongoose from "mongoose";
import { ScannerService } from "../../src/services/scannerService";
import { FeeCollectedEventModel } from "../../src/models/FeeCollectedEvent";
import { LastScannedBlockModel } from "../../src/models/LastScannedBlock";
import { config } from "../../src/config";

jest.setTimeout(10000);

describe("E2E: Full Scanner Flow", () => {
	let scannerService: ScannerService;

	beforeAll(async () => {
		await mongoose.connect(config.testMongoUri);
		await FeeCollectedEventModel.deleteMany({});
		await LastScannedBlockModel.deleteMany({});
		scannerService = new ScannerService();
	});

	afterAll(async () => {
		await FeeCollectedEventModel.deleteMany({});
		await LastScannedBlockModel.deleteMany({});
		await mongoose.disconnect();
	});

	beforeEach(async () => {
		await FeeCollectedEventModel.deleteMany({});
		await LastScannedBlockModel.deleteMany({});
	});

	it("should scan blocks and store events end-to-end", async () => {
		// Run the scanner (this will use config.startBlock and config.chunkSize)
		const startBlock = Number(config.startBlock);
		// Scan 1000 blocks
		const endBlock = startBlock + 1000;
		await scannerService.scanBlocks(startBlock, endBlock);

		// Check that events were stored in the DB
		const events = await FeeCollectedEventModel.find({});
		expect(events.length).toBeGreaterThan(0);

		// Check that last scanned block was updated
		const lastBlock = await LastScannedBlockModel.findOne({});
		expect(lastBlock).not.toBeNull();
		expect(lastBlock!.blockNumber).toBeGreaterThanOrEqual(0);
	});
});
