import { ethers } from "ethers";
import { config } from "../utils/config";
import { ChainIds } from "../types/chains";
import { FeeCollector__factory } from "lifi-contract-types";
import { FeeCollectedEventData } from "../types/events";
import logger from "../utils/logger";
import { BlockchainError, ValidationError } from "../errors/AppError";
import { FeeCollectedEventSchema } from "../types/schemas";
import { ZodError } from "zod";

/**
 * BlockchainService
 *
 * Service for interacting with the blockchain to fetch and parse LiFi fee events.
 * Handles provider setup, event querying, and event parsing.
 */
export class BlockchainService {
	private static instance: BlockchainService;
	private providers: Map<ChainIds, ethers.providers.JsonRpcProvider>;

	private constructor() {
		this.providers = new Map();
	}

	public static getInstance(): BlockchainService {
		if (!BlockchainService.instance) {
			BlockchainService.instance = new BlockchainService();
		}
		return BlockchainService.instance;
	}

	public getProvider(chainId: ChainIds): ethers.providers.JsonRpcProvider {
		if (!this.providers.has(chainId)) {
			const rpcUrl = config.chains[chainId].rpcUrl;
			if (!rpcUrl) {
				throw new Error(`No RPC URL configured for chain ${chainId}`);
			}
			this.providers.set(chainId, new ethers.providers.JsonRpcProvider(rpcUrl));
		}
		return this.providers.get(chainId)!;
	}

	/**
	 * Get contract instance for a specific chain
	 * @param chainId - The chain ID to get the contract for
	 * @returns Contract instance
	 */
	public getContract(chainId: ChainIds) {
		const provider = this.getProvider(chainId);
		const chainConfig = config.chains[chainId];
		if (!chainConfig) {
			throw new Error(`No configuration found for chain ${chainId}`);
		}
		return FeeCollector__factory.connect(config.contractAddress, provider);
	}

	/**
	 * Get the latest block number for a specific chain
	 * @param chainId - The chain ID to get the latest block for
	 * @returns Latest block number
	 */
	public async getLatestBlock(chainId: ChainIds): Promise<number> {
		try {
			const provider = this.getProvider(chainId);
			return await provider.getBlockNumber();
		} catch (error: any) {
			logger.error({ chainId, error }, "Error getting latest block");
			if (error?.message?.toLowerCase().includes("rpc error")) {
				throw new BlockchainError("RPC error");
			}
			if (error?.message?.toLowerCase().includes("network error")) {
				throw new BlockchainError("Network error");
			}
			if (error?.message?.toLowerCase().includes("timeout")) {
				throw new BlockchainError("Request timeout");
			}
			throw new BlockchainError("Failed to get latest block");
		}
	}

	/**
	 * Load all FeeCollected events from the blockchain in a given block range.
	 * @param chainId - The chain ID to get events for
	 * @param fromBlock - Start block number (inclusive)
	 * @param toBlock - End block number (inclusive)
	 * @returns Array of parsed event data
	 */
	async loadFeeCollectorEvents(
		chainId: ChainIds,
		fromBlock: number,
		toBlock: number
	): Promise<FeeCollectedEventData[]> {
		if (fromBlock > toBlock) {
			throw new ValidationError(
				"Invalid block range: fromBlock cannot be greater than toBlock"
			);
		}

		try {
			const contract = this.getContract(chainId);
			const filter = contract.filters.FeesCollected();

			logger.debug(
				{ chainId, fromBlock, toBlock },
				"Querying blockchain for events"
			);
			const events = await contract.queryFilter(filter, fromBlock, toBlock);

			const parsedEvents = events.map((event) => {
				const parsedEvent = contract.interface.parseLog(event);
				const eventObj = {
					...event,
					args: {
						token: parsedEvent.args[0],
						integrator: parsedEvent.args[1],
						integratorFee: parsedEvent.args[2].toString(),
						lifiFee: parsedEvent.args[3].toString(),
					},
				};
				try {
					FeeCollectedEventSchema.parse(eventObj);
				} catch (err) {
					const errors = err instanceof ZodError ? err.errors : err;
					throw new BlockchainError(
						"Invalid event data: " + JSON.stringify(errors)
					);
				}
				return eventObj as FeeCollectedEventData;
			});

			logger.debug(
				{ chainId, eventCount: parsedEvents.length },
				"Successfully parsed events"
			);
			return parsedEvents;
		} catch (error: any) {
			logger.error({ chainId, error }, "Error loading fee collector events");
			if (error?.message?.toLowerCase().includes("rpc error")) {
				throw new BlockchainError("RPC error");
			}
			if (error?.message?.toLowerCase().includes("network error")) {
				throw new BlockchainError("Network error");
			}
			if (error?.message?.toLowerCase().includes("timeout")) {
				throw new BlockchainError("Request timeout");
			}
			throw error;
		}
	}

	/**
	 * Ensures all event fee values are stringified for display/logging.
	 * @param events - Array of FeeCollectedEventData
	 * @returns {FeeCollectedEventData[]} Array with stringified fee values
	 * @throws {BlockchainError} If parsing fails
	 */
	parseFeeCollectorEvents(
		events: FeeCollectedEventData[]
	): FeeCollectedEventData[] {
		try {
			logger.debug({ eventCount: events.length }, "Parsing events for display");
			return events.map((event) => ({
				...event,
				args: {
					...event.args,
					integratorFee: ethers.BigNumber.from(
						event.args.integratorFee
					).toString(),
					lifiFee: ethers.BigNumber.from(event.args.lifiFee).toString(),
				},
			}));
		} catch (error) {
			logger.error({ error }, "Error parsing fee collector events");
			throw new BlockchainError("Failed to parse fee collector events");
		}
	}
}
