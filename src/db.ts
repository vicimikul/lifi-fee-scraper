import mongoose from "mongoose";

/**
 * Connects to MongoDB
 * @param uri
 */
export async function connectDB(uri: string): Promise<void> {
	try {
		await mongoose.connect(uri);
		console.log("MongoDB connected successfully!");
	} catch (error) {
		console.error("MongoDB connection error:", error);
		process.exit(1); // Exit process with failure
	}
}

/**
 * Disconnects from MongoDB
 */
export async function disconnectDB(): Promise<void> {
	try {
		await mongoose.disconnect();
		console.log("MongoDB disconnected.");
	} catch (error) {
		console.error("Error disconnecting from MongoDB:", error);
	}
}
