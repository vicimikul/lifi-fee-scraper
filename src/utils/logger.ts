import pino from "pino";
import { config } from "../config";

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
