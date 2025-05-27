import express, {
	Request,
	Response,
	NextFunction,
	ErrorRequestHandler,
} from "express";
import { config } from "./utils/config";
import logger from "./utils/logger";
import { connectDB, disconnectDB } from "./utils/db";
import eventsRouter from "./controllers/eventsController";
import { ScannerService } from "./services/scannerService";
import { ZodError } from "zod";
import { requestLogger } from "./middleware/requestLogger";

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Request logging middleware
app.use(requestLogger);

// Mount the events router at /events
app.use("/events", eventsRouter);

// Basic health check endpoint
app.get("/health", (req: Request, res: Response) => {
	res.json({ status: "ok" });
});

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
	logger.error({ error: err }, "Unhandled error");
	if (err instanceof ZodError) {
		res.status(400).json({
			error: err.errors.map((e) => e.message).join("; "),
		});
		return;
	}
	res.status(500).json({ error: err.message || "Internal Server Error" });
};

app.use(errorHandler);

const startScanner = async () => {
	try {
		// Initialize and run the scanner service to process blockchain events
		const scannerService = ScannerService.getInstance();
		await scannerService.scanAllChains();
		logger.info("Scanner finished running");
	} catch (error) {
		logger.error({ error }, "Error in scanner process");
	}
};

const startServer = async () => {
	try {
		// Connect to MongoDB using the URI from config
		await connectDB(config.mongoUri);

		// Start the scanner in the background
		startScanner();

		// Start the Express server
		app.listen(config.port, () => {
			logger.info(`Server listening on port ${config.port}`);
		});
	} catch (error) {
		logger.error({ error }, "Failed to start server");
		process.exit(1);
	}
};

process.on("SIGINT", async () => {
	logger.info("Received SIGINT. Shutting down gracefully...");
	await disconnectDB();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	logger.info("Received SIGTERM. Shutting down gracefully...");
	await disconnectDB();
	process.exit(0);
});

startServer();
