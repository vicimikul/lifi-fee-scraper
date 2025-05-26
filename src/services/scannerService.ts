import { config } from "../utils/config";
import { FeeCollectedEventData } from "../types/events";
import { BlockchainService } from "./blockchainService";
import { EventService } from "./eventService";
import logger from "../utils/logger";
import { ethers } from "ethers";
import { BlockchainError, DatabaseError } from "../errors/AppError";

/**
 * ScannerService
 *
 * Orchestrates the scanning of blockchain blocks for LiFi fee events,
 * chunking the scan, storing results, and updating progress in the database.
 */
export class ScannerService {
	private blockchainService: BlockchainService;
	private eventService: EventService;

	/**
	 * Initializes the scanner with blockchain and event services.
	 */
	constructor() {
		this.blockchainService = new BlockchainService();
		this.eventService = new EventService();
	}

	/**
	 * Scan a specific block range for fee events.
	 * @param fromBlock - Start block number (inclusive)
	 * @param toBlock - End block number (inclusive)
	 * @returns {Promise<FeeCollectedEventData[]>} Array of found events
	 * @throws {BlockchainError} If the scan fails
	 */
	async scanBlockRange(
		fromBlock: number,
		toBlock: number
	): Promise<FeeCollectedEventData[]> {
		try {
			const events = await this.blockchainService.loadFeeCollectorEvents(
				fromBlock,
				toBlock
			);
			logger.info(
				{ fromBlock, toBlock, eventCount: events.length },
				`Found ${events.length} events in blocks ${fromBlock} to ${toBlock}`
			);
			return events;
		} catch (error) {
			logger.error({ error }, "Error scanning block range");
			throw new BlockchainError("Blockchain error");
		}
	}

	/**
	 * Scan blocks for fee events, chunking the scan to avoid provider limits.
	 * Stores results and updates last scanned block in the database.
	 * @param _fromBlock - Optional start block (overrides DB value)
	 * @param _toBlock - Optional end block (overrides latest block)
	 * @throws {BlockchainError|DatabaseError} If scanning or DB operations fail
	 */
	async scanBlocks(_fromBlock?: number, _toBlock?: number): Promise<void> {
		try {
			// Get the latest block number from the blockchain
			const latestBlock = await this.blockchainService.getLatestBlock();

			// Get the last scanned block from the DB, or use override
			const fromBlock = _fromBlock
				? _fromBlock
				: await this.eventService.getLastScannedBlock();
			const toBlock = _toBlock ? _toBlock : latestBlock;

			logger.info(
				{ fromBlock, toBlock, blockRange: toBlock - fromBlock },
				`Scanning blocks from ${fromBlock} to ${toBlock}`
			);

			// Scan in chunks to avoid provider limitations (e.g., 500 blocks per call)
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
					// Scan the current chunk for events
					const chunkEvents = await this.scanBlockRange(
						currentBlock,
						chunkEndBlock
					);
					allEvents = allEvents.concat(chunkEvents);

					// Store events in MongoDB
					await this.eventService.storeEvents(chunkEvents);

					// Update last scanned block in DB
					await this.eventService.updateLastScannedBlock(chunkEndBlock);
				} catch (error) {
					logger.error(
						{ error, currentBlock, chunkEndBlock },
						`Error scanning chunk ${currentBlock} to ${chunkEndBlock}`
					);
					if (
						error instanceof BlockchainError ||
						error instanceof DatabaseError
					) {
						// Propagate known errors to be handled by the outer catch
						throw error;
					}
					// Continue with next chunk for other errors
					continue;
				}
			}

			logger.info(
				{ totalEvents: allEvents.length },
				`Total events found: ${allEvents.length}`
			);

			// Parse and log each event for display
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
		} catch (error: any) {
			logger.error({ error }, "Error in scanning process");
			if (error instanceof BlockchainError) {
				throw error;
			}
			if (error instanceof DatabaseError) {
				throw error;
			}
			if (error && error.message) {
				const msg = error.message.toLowerCase();
				if (msg.includes("blockchain error")) {
					throw new BlockchainError("Blockchain error");
				}
				if (msg.includes("database error")) {
					throw new DatabaseError("Database error");
				}
				if (msg.includes("event service error")) {
					throw new BlockchainError("Event service error");
				}
			}
			throw new BlockchainError("Failed to complete scanning process");
		}
	}
}
