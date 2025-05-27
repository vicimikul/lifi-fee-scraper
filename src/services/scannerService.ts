import { config } from "../utils/config";
import { FeeCollectedEventData } from "../types/events";
import { BlockchainService } from "./blockchainService";
import { EventService } from "./eventService";
import logger from "../utils/logger";
import { ethers } from "ethers";
import { BlockchainError, DatabaseError } from "../errors/AppError";
import { FeeCollectedEventModel } from "../models/FeeCollectedEvent";
import { ChainIds } from "../types/chains";

/**
 * ScannerService
 *
 * Orchestrates the scanning of blockchain blocks for LiFi fee events,
 * chunking the scan, storing results, and updating progress in the database.
 */
export class ScannerService {
	private static instance: ScannerService;
	private blockchainService: BlockchainService;
	private eventService: EventService;
	private chunkSize: number;
	private isScanning: boolean = false;

	private constructor() {
		this.blockchainService = BlockchainService.getInstance();
		this.eventService = EventService.getInstance();
		this.chunkSize = config.chunkSize;
	}

	public static getInstance(): ScannerService {
		if (!ScannerService.instance) {
			ScannerService.instance = new ScannerService();
		}
		return ScannerService.instance;
	}

	/**
	 * Scan a specific block range for fee events.
	 * @param chainId - The chain ID to scan
	 * @param fromBlock - Start block number (inclusive)
	 * @param toBlock - End block number (inclusive)
	 * @returns Array of found events
	 */
	async scanBlockRange(
		chainId: number,
		fromBlock: number,
		toBlock: number
	): Promise<FeeCollectedEventData[]> {
		try {
			const events = await this.blockchainService.loadFeeCollectorEvents(
				chainId,
				fromBlock,
				toBlock
			);
			logger.info(
				{ chainId, fromBlock, toBlock, eventCount: events.length },
				`Found ${events.length} events in blocks ${fromBlock} to ${toBlock}`
			);
			return events;
		} catch (error) {
			logger.error({ chainId, error }, "Error scanning block range");
			// Only convert specific blockchain-related errors to BlockchainError
			if (error instanceof Error) {
				const msg = error.message.toLowerCase();
				if (msg.includes("rpc error") || 
					msg.includes("network error") || 
					msg.includes("timeout")) {
					throw new BlockchainError(error.message);
				}
			}
			// For other errors, just rethrow them as is
			throw error;
		}
	}

	/**
	 * Scan blocks for fee events, chunking the scan to avoid provider limits.
	 * @param chainId - The chain ID to scan
	 * @param _fromBlock - Optional start block (overrides DB value)
	 * @param _toBlock - Optional end block (overrides latest block)
	 */
	async scanBlocks(
		chainId: number,
		_fromBlock?: number,
		_toBlock?: number
	): Promise<void> {
		try {
			// Get the latest block number from the blockchain
			const latestBlock = await this.blockchainService.getLatestBlock(chainId);

			// Get the last scanned block from the DB, or use override
			const fromBlock = _fromBlock
				? _fromBlock
				: await this.eventService.getLastScannedBlock(chainId);
			const toBlock = _toBlock ? _toBlock : latestBlock;

			logger.info(
				{ chainId, fromBlock, toBlock, blockRange: toBlock - fromBlock },
				`Scanning blocks from ${fromBlock} to ${toBlock}`
			);

			// Scan in chunks to avoid provider limitations
			let allEvents: FeeCollectedEventData[] = [];
			for (
				let currentBlock = fromBlock;
				currentBlock < toBlock;
				currentBlock += this.chunkSize
			) {
				const chunkEndBlock = Math.min(
					currentBlock + this.chunkSize - 1,
					toBlock
				);
				logger.info(
					{ chainId, currentBlock, chunkEndBlock },
					`Scanning chunk: ${currentBlock} to ${chunkEndBlock}`
				);

				try {
					const chunkEvents = await this.scanBlockRange(
						chainId,
						currentBlock,
						chunkEndBlock
					);
					allEvents = allEvents.concat(chunkEvents);

					await this.eventService.storeEvents(chunkEvents, chainId);

					// Upsert last scanned block after each chunk
					await this.eventService.updateLastScannedBlock(
						chainId,
						chunkEndBlock
					);
					logger.info(
						{ chainId, chunkEndBlock },
						"Updated last scanned block after chunk"
					);
				} catch (error) {
					logger.error(
						{ chainId, error, currentBlock, chunkEndBlock },
						`Error scanning chunk ${currentBlock} to ${chunkEndBlock}`
					);
					if (
						error instanceof BlockchainError ||
						error instanceof DatabaseError
					) {
						throw error;
					}
					continue;
				}
			}

			logger.info(
				{ chainId, totalEvents: allEvents.length },
				`Total events found: ${allEvents.length}`
			);

			const parsedEvents =
				this.blockchainService.parseFeeCollectorEvents(allEvents);
			parsedEvents.forEach((event: FeeCollectedEventData, index: number) => {
				logger.info(
					{
						chainId,
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
			logger.error({ chainId, error }, "Error in scanning process");
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

	/**
	 * Scan all configured chains for events
	 */
	public async scanAllChains(): Promise<void> {
		try {
			logger.info(
				{ chains: config.enabledChains },
				"Starting scan for all chains"
			);

			// Scan all chains concurrently
			await Promise.all(
				config.enabledChains.map(async (chainId) => {
					try {
						await this.scanChain(chainId);
					} catch (error) {
						logger.error({ error, chainId }, "Error scanning chain");
						// Don't throw, just log the error
					}
				})
			);
		} catch (error) {
			logger.error({ error }, "Error scanning chains");
			throw error;
		}
	}

	/**
	 * Scan a specific chain for events
	 * @param chainId - The chain ID to scan
	 * @param fromBlock - Starting block number
	 * @param toBlock - Ending block number
	 */
	private async scanChain(chainId: ChainIds): Promise<void> {
		try {
			logger.info({ chainId }, "Starting chain scan");

			// Get the last scanned block from the database
			const fromBlock = await this.eventService.getLastScannedBlock(chainId);
			logger.info({ chainId, fromBlock }, "Retrieved last scanned block");

			// Get the latest block from the blockchain
			const latestBlock = await this.getLatestBlock(chainId);
			logger.info(
				{
					chainId,
					latestBlock,
					fromBlock,
					blockRange: latestBlock - fromBlock,
				},
				"Retrieved latest block from chain"
			);

			if (fromBlock >= latestBlock) {
				logger.info(
					{ chainId, fromBlock, latestBlock },
					"Chain is up to date, skipping scan"
				);
				return;
			}

			// Scan blocks in chunks
			await this.scanBlocks(chainId, fromBlock, latestBlock);
		} catch (error) {
			logger.error({ error, chainId }, "Error scanning chain");
			throw error;
		}
	}

	async getLatestBlock(chainId: ChainIds): Promise<number> {
		try {
			const provider = this.blockchainService.getProvider(chainId);
			const blockNumber = await provider.getBlockNumber();
			logger.debug({ chainId, blockNumber }, "Retrieved latest block number");
			return blockNumber;
		} catch (error) {
			logger.error({ error, chainId }, "Error getting latest block");
			throw error;
		}
	}
}
