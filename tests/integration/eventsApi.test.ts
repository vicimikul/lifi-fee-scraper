import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import eventsRouter from "../../src/controllers/eventsController";
import { FeeCollectedEventModel } from "../../src/models/FeeCollectedEvent";

const validAddress = "0x" + "a".repeat(40); // 42 chars
const anotherAddress = "0x" + "b".repeat(40); // 42 chars
const validTxHash = "0x" + "c".repeat(64); // 66 chars

describe("GET /events/integrator/:integrator", () => {
	let mongoServer: MongoMemoryServer;
	let app: express.Express;

	beforeAll(async () => {
		mongoServer = await MongoMemoryServer.create();
		await mongoose.connect(mongoServer.getUri(), {
			serverSelectionTimeoutMS: 5000,
		});
		app = express();
		app.use(express.json());
		app.use("/events", eventsRouter);
	});

	afterAll(async () => {
		await mongoose.disconnect();
		await mongoServer.stop();
	});

	beforeEach(async () => {
		await FeeCollectedEventModel.deleteMany({});
	});

	it("should return events for a valid integrator", async () => {
		// Insert test data
		await FeeCollectedEventModel.create({
			chainId: 1,
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
			chainId: 1,
			contractAddress: validAddress,
			token: validAddress,
			integrator: anotherAddress,
			integratorFee: "2000000000000000000",
			lifiFee: "1000000000000000000",
			blockNumber: 124,
			transactionHash: validTxHash,
			logIndex: 1,
		});

		const res = await request(app).get(`/events/integrator/${validAddress}`);
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

	it("should return 400 for invalid integrator address", async () => {
		const res = await request(app).get(`/events/integrator/invalidaddress`);
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(res.body.error).toMatch(/Invalid integrator address/);
	});

	it("should return empty array if no events for integrator", async () => {
		const res = await request(app).get(`/events/integrator/${anotherAddress}`);
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
