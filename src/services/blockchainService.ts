import { ethers } from "ethers";
import { FeeCollector__factory } from "lifi-contract-types";
import { config } from "../config";
import { FeeCollectedEventData } from "../types/events";
import logger from "../utils/logger";
import { BlockchainError, ValidationError } from "../errors/AppError";

export class BlockchainService {
	private provider: ethers.providers.JsonRpcProvider;
	private feeCollector: ethers.Contract;

	constructor() {
		this.provider = new ethers.providers.JsonRpcProvider(config.polygonRpcUrl);
		this.feeCollector = new ethers.Contract(
			config.contractAddress,
			FeeCollector__factory.createInterface(),
			this.provider
		);
	}

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
			const filter = this.feeCollector.filters.FeesCollected();

			logger.debug({ fromBlock, toBlock }, "Querying blockchain for events");
			const events = await this.feeCollector.queryFilter(
				filter,
				fromBlock,
				toBlock
			);

			const parsedEvents = events.map((event) => {
				const parsedEvent = this.feeCollector.interface.parseLog(event);
				return {
					...event,
					args: {
						token: parsedEvent.args[0],
						integrator: parsedEvent.args[1],
						integratorFee: parsedEvent.args[2].toString(),
						lifiFee: parsedEvent.args[3].toString(),
					},
				} as FeeCollectedEventData;
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
