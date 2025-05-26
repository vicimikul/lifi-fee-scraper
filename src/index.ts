import { config } from "./config";
import { ScannerService } from "./services/scannerService";
import logger from "./utils/logger";
import { connectDB, disconnectDB } from "./db";

async function main() {
	try {
		// Connect to MongoDB
		await connectDB(config.mongoUri);

		// Initialize and run the scanner
		const scannerService = new ScannerService();
		await scannerService.scanBlocks();

		// Close MongoDB connection
		await disconnectDB();
	} catch (error) {
		logger.error({ error }, "Error in main process");
		// Ensure MongoDB connection is closed even if there's an error
		await disconnectDB();
	}
}

// Run the main function
main();
