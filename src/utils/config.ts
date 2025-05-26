import dotenv from "dotenv";

dotenv.config();

/**
 * Configuration object for the application
 * @property {string} mongoUri - The MongoDB URI
 * @property {string} polygonRpcUrl - The Polygon RPC URL
 * @property {string} contractAddress - The contract address of the FeeCollector
 * @property {number} port - The port number for the server
 * @property {string} logLevel - The log level for the application
 * @property {number} startBlock - The starting block number for the scan
 * @property {number} chunkSize - The size of the chunk for the scan
 * @property {number} chainId - The chain ID for the scan
 */
export const config = {
	mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/prod",
	polygonRpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
	contractAddress:
		process.env.CONTRACT_ADDRESS ||
		"0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9",
	port: parseInt(process.env.PORT || "3000", 10),
	logLevel: process.env.LOG_LEVEL || "info",
	startBlock: process.env.START_BLOCK || 0,
	chunkSize: parseInt(process.env.CHUNK_SIZE || "500"),
	chainId: parseInt(process.env.CHAIN_ID || "137"),
	testMongoUri: process.env.TEST_MONGO_URI || "mongodb://localhost:27017/test",
};
