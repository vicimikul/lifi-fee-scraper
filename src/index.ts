import { config } from "./utils/config";
import { ScannerService } from "./services/scannerService";
import logger from "./utils/logger";
import { connectDB, disconnectDB } from "./utils/db";

/**
 * Main entry point for the LiFi Fee Scraper application.
 * Connects to MongoDB, runs the scanner, and ensures proper cleanup.
 */
async function main() {
	try {
		// Connect to MongoDB using the URI from config
		await connectDB(config.mongoUri);

		// Initialize and run the scanner service to process blockchain events
		const scannerService = new ScannerService();
		await scannerService.scanBlocks();

		// Close MongoDB connection after scanning is complete
		await disconnectDB();
	} catch (error) {
		logger.error({ error }, "Error in main process");
		// Ensure MongoDB connection is closed even if there's an error
		await disconnectDB();
	}
}

// Run the main function
main();
