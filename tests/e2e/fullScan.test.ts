import mongoose from "mongoose";
import { ScannerService } from "../../src/services/scannerService";
import { FeeCollectedEventModel } from "../../src/models/FeeCollectedEvent";
import { LastScannedBlockModel } from "../../src/models/LastScannedBlock";
import { config } from "../../src/utils/config";
import { ChainIds } from "../../src/types/chains";

// Test database configuration
const TEST_DB_NAME = "fullscan_test";
const TEST_MONGO_URI = config.testMongoUri.replace("/test", `/${TEST_DB_NAME}`);

// Increase timeout for end-to-end tests
jest.setTimeout(10000);

/**
 * End-to-end tests for the full scanner flow
 * Tests the complete process of scanning blocks and storing events
 */
describe("E2E: Full Scanner Flow", () => {
	let scannerService: ScannerService;
	const TEST_CHAIN_ID = ChainIds.POLYGON;
	const POLYGON_START_BLOCK = 61500000;

	// Setup test environment
	beforeAll(async () => {
		// Connect to test database
		await mongoose.connect(TEST_MONGO_URI, {
			serverSelectionTimeoutMS: 5000,
		});
		// Clean up any existing data
		await FeeCollectedEventModel.deleteMany({});
		await LastScannedBlockModel.deleteMany({});
		// Initialize scanner service
		scannerService = ScannerService.getInstance();
	});

	// Cleanup after all tests
	afterAll(async () => {
		// Clean up test data
		await FeeCollectedEventModel.deleteMany({});
		await LastScannedBlockModel.deleteMany({});
		await mongoose.disconnect();
	});

	// Reset test state before each test
	beforeEach(async () => {
		await FeeCollectedEventModel.deleteMany({});
		await LastScannedBlockModel.deleteMany({});
	});

	/**
	 * Test end-to-end block scanning and event storage
	 * Verifies:
	 * - Events are successfully stored in the database
	 * - Last scanned block is properly updated
	 * - Complete flow works with real blockchain data
	 */
	it("should scan blocks and store events end-to-end", async () => {
		// Calculate block range to scan
		const startBlock = Number(config.chains[TEST_CHAIN_ID].startBlock);
		const endBlock = startBlock + 1000;

		// Execute block scanning
		await scannerService.scanBlocks(TEST_CHAIN_ID, startBlock, endBlock);

		// Verify events were stored
		const events = await FeeCollectedEventModel.find({});
		expect(events.length).toBeGreaterThan(0);

		// Verify last scanned block was updated
		const lastBlock = await LastScannedBlockModel.findOne({});
		expect(lastBlock).not.toBeNull();
		expect(lastBlock!.blockNumber).toBeGreaterThanOrEqual(0);
	});
});
