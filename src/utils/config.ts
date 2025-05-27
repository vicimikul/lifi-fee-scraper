import dotenv from "dotenv";
import { ChainIds, chainConfigs } from "../types/chains";

dotenv.config();

/**
 * Parse comma-separated chain IDs from environment variable
 */
function parseEnabledChains(): ChainIds[] {
	const enabledChains = process.env.ENABLED_CHAINS;
	if (!enabledChains) {
		return [ChainIds.POLYGON]; // Default to Polygon if not specified
	}

	// Split by comma and parse each chain ID
	const chainIds = enabledChains.split(",").map((id) => {
		const chainId = parseInt(id.trim(), 10);
		if (isNaN(chainId) || !Object.values(ChainIds).includes(chainId)) {
			throw new Error(`Invalid chain ID in ENABLED_CHAINS: ${id}`);
		}
		return chainId as ChainIds;
	});

	if (chainIds.length === 0) {
		return [ChainIds.POLYGON]; // Default to Polygon if empty
	}

	return chainIds;
}

/**
 * Application configuration.
 * All values can be overridden using environment variables.
 *
 * @property {string} mongoUri - MongoDB connection string for production
 * @property {string} testMongoUri - MongoDB connection string for testing
 * @property {number} port - HTTP server port
 * @property {string} logLevel - Logging level (debug|info|warn|error)
 * @property {number} chunkSize - Number of blocks to scan in each chunk
 * @property {Object} rpcUrls - RPC endpoints for each supported chain
 * @property {Object} chains - Chain-specific configuration
 * @property {number[]} enabledChains - List of chain IDs to scan
 */
export const config = {
	mongoUri:
		process.env.MONGO_URI || "mongodb://localhost:27017/lifi-fee-scraper",
	port: process.env.PORT || 3000,
	logLevel: process.env.LOG_LEVEL || "info",
	chunkSize: parseInt(process.env.CHUNK_SIZE || "1000", 10),
	testMongoUri: process.env.TEST_MONGO_URI || "mongodb://localhost:27017/test",

	// Enabled chains from environment variable
	enabledChains: parseEnabledChains(),

	// RPC URLs from environment variables
	rpcUrls: {
		[ChainIds.ETHEREUM]:
			process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
		[ChainIds.POLYGON]:
			process.env.POLYGON_RPC_URL || "https://polygon.llamarpc.com",
		[ChainIds.BASE]: process.env.BASE_RPC_URL || "https://base.llamarpc.com",
		[ChainIds.BSC]: process.env.BSC_RPC_URL || "https://bsc.llamarpc.com",
		[ChainIds.OPTIMISM]:
			process.env.OPTIMISM_RPC_URL || "https://optimism.llamarpc.com",
		[ChainIds.GNOSIS]:
			process.env.GNOSIS_RPC_URL || "https://gnosis.llamarpc.com",
	},

	// Chain-specific configuration
	chains: {
		[ChainIds.ETHEREUM]: {
			rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
			startBlock: parseInt(process.env.ETHEREUM_START_BLOCK || "22500000", 10),
		},
		[ChainIds.POLYGON]: {
			rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon.llamarpc.com",
			startBlock: parseInt(process.env.POLYGON_START_BLOCK || "61500000", 10),
		},
		[ChainIds.BSC]: {
			rpcUrl: process.env.BSC_RPC_URL || "https://bsc.llamarpc.com",
			startBlock: parseInt(process.env.START_BLOCK || "0", 10),
		},
		[ChainIds.OPTIMISM]: {
			rpcUrl: process.env.OPTIMISM_RPC_URL || "https://optimism.llamarpc.com",
			startBlock: parseInt(process.env.START_BLOCK || "0", 10),
		},
		[ChainIds.BASE]: {
			rpcUrl: process.env.BASE_RPC_URL || "https://base.llamarpc.com",
			startBlock: parseInt(process.env.START_BLOCK || "0", 10),
		},
		[ChainIds.GNOSIS]: {
			rpcUrl: process.env.GNOSIS_RPC_URL || "https://gnosis.llamarpc.com",
			startBlock: parseInt(process.env.START_BLOCK || "0", 10),
		},
	},

	contractAddress:
		process.env.CONTRACT_ADDRESS ||
		"0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9",
} as const;

/**
 * Get full configuration for a specific chain including RPC URL
 * @param chainId - The chain ID to get configuration for
 * @returns Full chain configuration or undefined if not found
 */
export function getChainConfig(chainId: number) {
	const chainConfig = config.chains[chainId as ChainIds];
	if (!chainConfig) return undefined;

	const rpcUrl = config.rpcUrls[chainId as ChainIds];
	if (!rpcUrl) {
		throw new Error(`No RPC URL configured for chain ${chainId}`);
	}

	return {
		...chainConfig,
		rpcUrl,
	};
}

/**
 * Validate that all required chain configurations are present
 * @throws Error if no chains are configured
 */
export function validateChainConfigs(): void {
	const enabledChains = Object.values(ChainIds).filter(
		(chainId) => typeof chainId === "number" && config.rpcUrls[chainId]
	);

	if (enabledChains.length === 0) {
		throw new Error(
			"No chain configurations found. Please configure at least one RPC URL in the environment variables."
		);
	}
}
