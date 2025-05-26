import pino from "pino";
import { config } from "./config";

/**
 * logger.ts
 *
 * Pino-based logger instance for structured and pretty logging throughout the app.
 * Log level and formatting are controlled by config.
 */

const logger = pino({
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
			translateTime: "SYS:standard",
			ignore: "pid,hostname",
		},
	},
	level: config.logLevel,
});

export default logger;
