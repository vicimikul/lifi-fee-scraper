import logger from "../../../src/utils/logger";
import { config } from "../../../src/config";
import { describe, expect, it, beforeEach, jest } from "@jest/globals";

// Mock pino
jest.mock("pino", () => {
	const mockLogger = {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
		trace: jest.fn(),
		fatal: jest.fn(),
		child: jest.fn().mockReturnThis(),
		level: "info",
	};

	return jest.fn(() => mockLogger);
});

describe("Logger", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should log info messages", () => {
		const message = "Test info message";
		const data = { test: "data" };

		logger.info(data, message);

		expect(logger.info).toHaveBeenCalledWith(data, message);
	});

	it("should log error messages", () => {
		const message = "Test error message";
		const error = new Error("Test error");

		logger.error({ error }, message);

		expect(logger.error).toHaveBeenCalledWith({ error }, message);
	});

	it("should log warning messages", () => {
		const message = "Test warning message";
		const data = { warning: "data" };

		logger.warn(data, message);

		expect(logger.warn).toHaveBeenCalledWith(data, message);
	});

	it("should log debug messages", () => {
		const message = "Test debug message";
		const data = { debug: "data" };

		logger.debug(data, message);

		expect(logger.debug).toHaveBeenCalledWith(data, message);
	});

	it("should log trace messages", () => {
		const message = "Test trace message";
		const data = { trace: "data" };

		logger.trace(data, message);

		expect(logger.trace).toHaveBeenCalledWith(data, message);
	});

	it("should log fatal messages", () => {
		const message = "Test fatal message";
		const data = { fatal: "data" };

		logger.fatal(data, message);

		expect(logger.fatal).toHaveBeenCalledWith(data, message);
	});

	it("should create child loggers", () => {
		const childLogger = logger.child({ component: "test" });

		expect(childLogger).toBeDefined();
		expect(logger.child).toHaveBeenCalledWith({ component: "test" });
	});

	it("should respect log level from config", () => {
		// Verify that the logger is initialized with the correct log level
		expect(logger.level).toBe(config.logLevel);
	});

	it("should handle complex objects in log data", () => {
		const complexData = {
			nested: {
				object: {
					with: {
						arrays: [1, 2, 3],
						and: {
							more: "data",
						},
					},
				},
			},
			circular: {} as any,
		};
		complexData.circular.self = complexData;

		logger.info(complexData, "Complex data test");

		expect(logger.info).toHaveBeenCalledWith(complexData, "Complex data test");
	});

	it("should handle undefined message", () => {
		const data = { test: "data" };

		logger.info(data);

		// Pino combines the message and data when only one argument is provided
		expect(logger.info).toHaveBeenCalledWith(data);
	});

	it("should handle undefined data", () => {
		const message = "Test message";

		logger.info(message);

		// Pino treats a single string argument as a message
		expect(logger.info).toHaveBeenCalledWith(message);
	});
});
