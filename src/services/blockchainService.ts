import { ethers } from "ethers";
import { FeeCollector__factory } from "lifi-contract-types";
import { config } from "../utils/config";
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
	private provider: ethers.providers.JsonRpcProvider;
	private feeCollector: ethers.Contract;

	/**
	 * Initializes the blockchain provider and contract instance.
	 */
	constructor() {
		this.provider = new ethers.providers.JsonRpcProvider(config.polygonRpcUrl);
		this.feeCollector = new ethers.Contract(
			config.contractAddress,
			FeeCollector__factory.createInterface(),
			this.provider
		);
	}

	/**
	 * Fetch the latest block number from the blockchain.
	 * @returns {Promise<number>} The latest block number.
	 * @throws {BlockchainError} If the RPC call fails or times out.
	 */
	async getLatestBlock(): Promise<number> {
		try {
			return await this.provider.getBlockNumber();
		} catch (error: any) {
			logger.error({ error }, "Error getting latest block");
			if (
				error &&
				error.message &&
				error.message.toLowerCase().includes("timeout")
			) {
				throw new BlockchainError("timeout");
			}
			throw new BlockchainError("RPC connection failed");
		}
	}

	/**
	 * Load all FeeCollected events from the blockchain in a given block range.
	 * @param fromBlock - Start block number (inclusive)
	 * @param toBlock - End block number (inclusive)
	 * @returns {Promise<FeeCollectedEventData[]>} Array of parsed event data
	 * @throws {ValidationError} If the block range is invalid
	 * @throws {BlockchainError} If the RPC call fails
	 */
	async loadFeeCollectorEvents(
		fromBlock: number,
		toBlock: number
	): Promise<FeeCollectedEventData[]> {
		if (fromBlock > toBlock) {
			throw new ValidationError(
				"Invalid block range: fromBlock cannot be greater than toBlock"
			);
		}

		try {
			// Create the event filter for the FeeCollector contract
			const filter = this.feeCollector.filters.FeesCollected();

			logger.debug({ fromBlock, toBlock }, "Querying blockchain for events");
			const events = await this.feeCollector.queryFilter(
				filter,
				fromBlock,
				toBlock
			);

			// Parse each event log into a FeeCollectedEventData object
			const parsedEvents = events.map((event) => {
				const parsedEvent = this.feeCollector.interface.parseLog(event);
				const eventObj = {
					...event,
					args: {
						token: parsedEvent.args[0],
						integrator: parsedEvent.args[1],
						integratorFee: parsedEvent.args[2].toString(),
						lifiFee: parsedEvent.args[3].toString(),
					},
				};
				// Zod validation
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
				{ eventCount: parsedEvents.length },
				"Successfully parsed events"
			);
			return parsedEvents;
		} catch (error: any) {
			logger.error({ error }, "Error loading fee collector events");
			if (
				error &&
				error.message &&
				error.message.toLowerCase().includes("rpc error")
			) {
				throw new BlockchainError("RPC error");
			}
			throw new BlockchainError("RPC error");
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
