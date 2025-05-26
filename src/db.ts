import mongoose from "mongoose";
import logger from "./utils/logger";

/**
 * Connects to MongoDB
 * @param uri
 */
export async function connectDB(uri: string): Promise<void> {
	try {
		await mongoose.connect(uri);
		logger.info("MongoDB connected successfully!");
	} catch (error) {
		logger.error("MongoDB connection error:", error);
		process.exit(1); // Exit process with failure
	}
}

/**
 * Disconnects from MongoDB
 */
export async function disconnectDB(): Promise<void> {
	try {
		await mongoose.disconnect();
		logger.info("MongoDB disconnected.");
	} catch (error) {
		logger.error("Error disconnecting from MongoDB:", error);
	}
}
