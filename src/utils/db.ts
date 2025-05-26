import mongoose from "mongoose";
import logger from "./logger";

/**
 * db.ts
 *
 * Utility functions for connecting and disconnecting from MongoDB.
 * Handles logging and process exit on connection failure.
 */

/**
 * Connects to MongoDB using the provided URI.
 * Logs success or exits process on failure.
 * @param uri - MongoDB connection string
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
 * Disconnects from MongoDB and logs the result.
 */
export async function disconnectDB(): Promise<void> {
	try {
		await mongoose.disconnect();
		logger.info("MongoDB disconnected.");
	} catch (error) {
		logger.error("Error disconnecting from MongoDB:", error);
	}
}
