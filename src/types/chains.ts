import { z } from "zod";

/**
 * Supported chain IDs
 */
export enum ChainIds {
	ETHEREUM = 1,
	POLYGON = 137,
	BASE = 8453,
	BSC = 56,
	OPTIMISM = 10,
	GNOSIS = 100,
}

/**
 * Public configuration for a single chain
 */
export interface ChainConfig {
	chainId: number;
	contractAddress: string;
	startBlock?: number;
}

/**
 * Zod schema for validating chain configuration
 */
export const ChainConfigSchema = z.object({
	chainId: z.number(),
	contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
	startBlock: z.number().optional(),
});

/**
 * Public chain configurations
 */
export const chainConfigs: Record<ChainIds, ChainConfig> = {
	[ChainIds.ETHEREUM]: {
		chainId: ChainIds.ETHEREUM,
		contractAddress: "0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9",
		startBlock: 0,
	},
	[ChainIds.POLYGON]: {
		chainId: ChainIds.POLYGON,
		contractAddress: "0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9",
		startBlock: 0,
	},
	[ChainIds.BASE]: {
		chainId: ChainIds.BASE,
		contractAddress: "0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9",
		startBlock: 0,
	},
	[ChainIds.BSC]: {
		chainId: ChainIds.BSC,
		contractAddress: "0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9",
		startBlock: 0,
	},
	[ChainIds.OPTIMISM]: {
		chainId: ChainIds.OPTIMISM,
		contractAddress: "0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9",
		startBlock: 0,
	},
	[ChainIds.GNOSIS]: {
		chainId: ChainIds.GNOSIS,
		contractAddress: "0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9",
		startBlock: 0,
	},
};
