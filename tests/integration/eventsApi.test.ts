import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { config } from "../../src/utils/config";
import eventsRouter from "../../src/controllers/eventsController";
import { FeeCollectedEventModel } from "../../src/models/FeeCollectedEvent";

// Test database configuration
const TEST_DB_NAME = "eventsapi_test";
const TEST_MONGO_URI = config.testMongoUri.replace("/test", `/${TEST_DB_NAME}`);

// Test data constants
const validAddress = "0x" + "a".repeat(40); // 42 chars
const anotherAddress = "0x" + "b".repeat(40); // 42 chars
const validTxHash = "0x" + "c".repeat(64); // 66 chars

/**
 * Integration tests for the Events API endpoints
 * Tests the /events/integrator/:chainId/:integrator endpoint
 */
describe("GET /events/integrator/:integrator", () => {
	let app: express.Express;

	// Setup test environment
	beforeAll(async () => {
		// Connect to test database
		await mongoose.connect(TEST_MONGO_URI, {
			serverSelectionTimeoutMS: 5000,
		});
		// Initialize Express app with events router
		app = express();
		app.use(express.json());
		app.use("/events", eventsRouter);
	});

	// Cleanup after all tests
	afterAll(async () => {
		await mongoose.disconnect();
	});

	// Reset database state before each test
	beforeEach(async () => {
		await FeeCollectedEventModel.deleteMany({});
	});

	/**
	 * Test successful retrieval of events for a valid integrator address
	 * Verifies:
	 * - Correct HTTP status code
	 * - Response structure
	 * - Event filtering by integrator
	 * - Metadata presence
	 */
	it("should return events for a valid integrator", async () => {
		// Create test events in the database
		await FeeCollectedEventModel.create({
			chainId: 137,
			contractAddress: validAddress,
			token: validAddress,
			integrator: validAddress,
			integratorFee: "1000000000000000000",
			lifiFee: "500000000000000000",
			blockNumber: 123,
			transactionHash: validTxHash,
			logIndex: 0,
		});
		await FeeCollectedEventModel.create({
			chainId: 137,
			contractAddress: validAddress,
			token: validAddress,
			integrator: anotherAddress,
			integratorFee: "2000000000000000000",
			lifiFee: "1000000000000000000",
			blockNumber: 124,
			transactionHash: validTxHash,
			logIndex: 1,
		});

		// Make request to the API
		const res = await request(app).get(
			`/events/integrator/137/${validAddress}`
		);

		// Verify response structure and content
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toBeDefined();
		expect(res.body.data.events).toBeDefined();
		expect(Array.isArray(res.body.data.events)).toBe(true);
		expect(res.body.data.events.length).toBe(1);
		expect(res.body.data.events[0].integrator).toBe(validAddress);
		expect(res.body.meta).toBeDefined();
		expect(res.body.meta.count).toBe(1);
		expect(res.body.meta.timestamp).toBeDefined();
	});

	/**
	 * Test error handling for invalid integrator address
	 * Verifies:
	 * - Correct error status code
	 * - Error message format
	 */
	it("should return 400 for invalid integrator address", async () => {
		const res = await request(app).get(`/events/integrator/137/invalidaddress`);
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(res.body.error).toMatch(/Invalid integrator address/);
	});

	/**
	 * Test handling of non-existent integrator
	 * Verifies:
	 * - Successful response with empty results
	 * - Correct metadata for empty result set
	 */
	it("should return empty array if no events for integrator", async () => {
		const res = await request(app).get(
			`/events/integrator/137/${anotherAddress}`
		);
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toBeDefined();
		expect(res.body.data.events).toBeDefined();
		expect(Array.isArray(res.body.data.events)).toBe(true);
		expect(res.body.data.events.length).toBe(0);
		expect(res.body.meta).toBeDefined();
		expect(res.body.meta.count).toBe(0);
		expect(res.body.meta.timestamp).toBeDefined();
	});
});
