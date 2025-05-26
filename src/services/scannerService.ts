import { config } from "../config";
import { FeeCollectedEventData } from "../types/events";
import { BlockchainService } from "./blockchainService";
import { EventService } from "./eventService";
import logger from "../utils/logger";
import { ethers } from "ethers";

export class ScannerService {
	private blockchainService: BlockchainService;
	private eventService: EventService;

	constructor() {
		this.blockchainService = new BlockchainService();
		this.eventService = new EventService();
	}

	async scanBlockRange(
		fromBlock: number,
		toBlock: number
	): Promise<FeeCollectedEventData[]> {
		const events = await this.blockchainService.loadFeeCollectorEvents(
			fromBlock,
			toBlock
		);
		logger.info(
			{ fromBlock, toBlock, eventCount: events.length },
			`Found ${events.length} events in blocks ${fromBlock} to ${toBlock}`
		);
		return events;
	}

	async scanBlocks(_fromBlock?: number, _toBlock?: number): Promise<void> {
		try {
			// Get the latest block number
			const latestBlock = await this.blockchainService.getLatestBlock();

			// Get the last scanned block
			const fromBlock = _fromBlock
				? _fromBlock
				: await this.eventService.getLastScannedBlock();
			const toBlock = _toBlock ? _toBlock : latestBlock;

			logger.info(
				{ fromBlock, toBlock, blockRange: toBlock - fromBlock },
				`Scanning blocks from ${fromBlock} to ${toBlock}`
			);

			// Scan in chunks
			let allEvents: FeeCollectedEventData[] = [];
			for (
				let currentBlock = fromBlock;
				currentBlock < toBlock;
				currentBlock += config.chunkSize
			) {
				const chunkEndBlock = Math.min(
					currentBlock + config.chunkSize - 1,
					toBlock
				);
				logger.info(
					{ currentBlock, chunkEndBlock },
					`Scanning chunk: ${currentBlock} to ${chunkEndBlock}`
				);

				try {
					const chunkEvents = await this.scanBlockRange(
						currentBlock,
						chunkEndBlock
					);
					allEvents = allEvents.concat(chunkEvents);

					// Store events in MongoDB
					await this.eventService.storeEvents(chunkEvents);

					// Update last scanned block
					await this.eventService.updateLastScannedBlock(chunkEndBlock);
				} catch (error) {
					logger.error(
						{ error, currentBlock, chunkEndBlock },
						`Error scanning chunk ${currentBlock} to ${chunkEndBlock}`
					);
					// Continue with next chunk even if this one fails
					continue;
				}
			}

			logger.info(
				{ totalEvents: allEvents.length },
				`Total events found: ${allEvents.length}`
			);

			// Parse and log events
			const parsedEvents =
				this.blockchainService.parseFeeCollectorEvents(allEvents);
			parsedEvents.forEach((event: FeeCollectedEventData, index: number) => {
				logger.info(
					{
						eventNumber: index + 1,
						token: event.args.token,
						integrator: event.args.integrator,
						integratorFee: ethers.utils.formatEther(event.args.integratorFee),
						lifiFee: ethers.utils.formatEther(event.args.lifiFee),
					},
					`Event #${index + 1}`
				);
			});
		} catch (error) {
			logger.error({ error }, "Error in scanning process");
			throw error;
		}
	}
}
