import {
	FeeCollectedEvent,
	FeeCollectedEventModel,
} from "../models/FeeCollectedEvent";
import { FeeCollectedEventData, FeeCollectedEventDTO } from "../types/events";
import logger from "../utils/logger";
import { DatabaseError, ValidationError } from "../errors/AppError";
import { config } from "../utils/config";
import mongoose from "mongoose";
import {
	FeeCollectedEventSchema,
	FeeCollectedEventDTOSchema,
} from "../types/schemas";
import { ZodError } from "zod";
import { ChainIds } from "../types/chains";
import { LastScannedBlockModel } from "../models/LastScannedBlock";

/**
 * Service responsible for handling event-related database operations.
 * Manages the storage and retrieval of fee events and tracking of scanned blocks.
 * Implements data validation, deduplication, and error handling for database operations.
 */
export class EventService {
	private static instance: EventService;

	private constructor() {}

	public static getInstance(): EventService {
		if (!EventService.instance) {
			EventService.instance = new EventService();
		}
		return EventService.instance;
	}

	/**
	 * Retrieves the last scanned block number for a specific chain.
	 * Falls back to the configured start block if no record exists.
	 *
	 * @param chainId - The chain ID to get the last scanned block for
	 * @returns The last scanned block number
	 * @throws {DatabaseError} When database operations fail
	 */
	async getLastScannedBlock(chainId: number): Promise<number> {
		try {
			const lastBlock = await LastScannedBlockModel.findOne({ chainId });
			if (!lastBlock) {
				const chainConfig = config.chains[chainId as ChainIds];
				logger.info(
					{ chainId },
					`No last scanned block found, using config startBlock: ${
						chainConfig?.startBlock || 0
					}`
				);
				return chainConfig?.startBlock || 0;
			}
			logger.info(
				{ chainId, blockNumber: lastBlock.blockNumber },
				"Read last scanned block from DB"
			);
			return lastBlock.blockNumber;
		} catch (error) {
			logger.error({ chainId, error }, "Error getting last scanned block");
			throw new DatabaseError("Failed to get last scanned block");
		}
	}

	/**
	 * Updates the last scanned block number for a specific chain.
	 * Uses upsert to create or update the record.
	 *
	 * @param chainId - The chain ID to update
	 * @param blockNumber - The new last scanned block number
	 * @throws {DatabaseError} When database operations fail
	 */
	async updateLastScannedBlock(
		chainId: number,
		blockNumber: number
	): Promise<void> {
		if (blockNumber < 0) {
			throw new ValidationError("Block number cannot be negative");
		}

		try {
			await LastScannedBlockModel.updateOne(
				{ chainId },
				{ $set: { blockNumber } },
				{ upsert: true }
			);
			logger.info(
				{ chainId, blockNumber },
				"Upserted last scanned block in DB"
			);
		} catch (error) {
			logger.error(
				{ chainId, blockNumber, error },
				"Error upserting last scanned block"
			);
			throw new DatabaseError("Failed to update last scanned block");
		}
	}

	/**
	 * Stores fee events in the database with deduplication.
	 * Validates event data before storage and handles duplicate events.
	 * Uses transactions when available for atomic operations.
	 *
	 * @param events - Array of events to store
	 * @param chainId - The chain ID these events belong to
	 * @throws {ValidationError} When event data is invalid
	 * @throws {DatabaseError} When database operations fail
	 */
	async storeEvents(
		events: FeeCollectedEventData[],
		chainId: number
	): Promise<void> {
		if (events.length === 0) return;

		// Convert raw event data to DTOs for MongoDB
		const documents: FeeCollectedEventDTO[] = events.map((event) => ({
			chainId,
			contractAddress: event.address,
			token: event.args.token,
			integrator: event.args.integrator,
			integratorFee: event.args.integratorFee.toString(),
			lifiFee: event.args.lifiFee.toString(),
			blockNumber: event.blockNumber,
			transactionHash: event.transactionHash,
			logIndex: event.logIndex,
		}));

		try {
			// Check for existing events to avoid duplicates
			const existingEvents = await FeeCollectedEventModel.find({
				$or: documents.map((doc) => ({
					chainId,
					transactionHash: doc.transactionHash,
					logIndex: doc.logIndex,
				})),
			});

			// Build a Set of unique keys for existing events
			const existingKeys = new Set(
				existingEvents.map(
					(e) => `${e.chainId}_${e.transactionHash}_${e.logIndex}`
				)
			);

			// Filter out duplicates from the insert list
			const newDocuments = documents.filter(
				(doc) =>
					!existingKeys.has(
						`${doc.chainId}_${doc.transactionHash}_${doc.logIndex}`
					)
			);

			if (existingEvents.length > 0) {
				logger.warn(
					{
						chainId,
						duplicateEvents: existingEvents.map((e) => ({
							transactionHash: e.transactionHash,
							logIndex: e.logIndex,
							blockNumber: e.blockNumber,
							integratorFee: e.integratorFee,
							lifiFee: e.lifiFee,
						})),
						totalAttempted: documents.length,
						duplicateCount: existingEvents.length,
					},
					"Duplicate events detected, will only insert non-duplicates"
				);
			}

			if (newDocuments.length === 0) {
				logger.info(
					{ chainId },
					"No new events to insert after duplicate filtering"
				);
				return;
			}

			// Validate event data before insertion
			for (const event of events) {
				try {
					FeeCollectedEventSchema.parse(event);
				} catch (err) {
					const errors = err instanceof ZodError ? err.errors : err;
					throw new ValidationError(
						"Invalid event data: " + JSON.stringify(errors)
					);
				}
			}

			// Validate DTOs before insertion
			for (const doc of newDocuments) {
				try {
					FeeCollectedEventDTOSchema.parse(doc);
				} catch (err) {
					const errors = err instanceof ZodError ? err.errors : err;
					throw new ValidationError(
						"Invalid DTO data: " + JSON.stringify(errors)
					);
				}
			}

			// Try to use transactions if available (MongoDB replica set)
			try {
				const session = await mongoose.startSession();
				try {
					const result = await FeeCollectedEventModel.insertMany(newDocuments, {
						ordered: false,
						session,
					});
					logger.debug(
						{
							insertedDocs: result.map((doc: FeeCollectedEvent) => ({
								integratorFee: doc.integratorFee,
								integratorFeeType: typeof doc.integratorFee,
								lifiFee: doc.lifiFee,
								lifiFeeType: typeof doc.lifiFee,
							})),
						},
						"Successfully inserted documents"
					);
				} catch (error: any) {
					// If transaction fails due to non-replica set, try without transaction
					if (error.message?.includes("Transaction numbers are only allowed")) {
						const result = await FeeCollectedEventModel.insertMany(
							newDocuments,
							{
								ordered: false,
							}
						);
						logger.debug(
							{
								insertedDocs: result.map((doc: FeeCollectedEvent) => ({
									integratorFee: doc.integratorFee,
									integratorFeeType: typeof doc.integratorFee,
									lifiFee: doc.lifiFee,
									lifiFeeType: typeof doc.lifiFee,
								})),
							},
							"Successfully inserted documents without transaction"
						);
					} else {
						throw error;
					}
				} finally {
					await session.endSession();
				}
			} catch (error: any) {
				logger.error({ chainId, error }, "Error storing events in MongoDB");
				throw new DatabaseError("Failed to store events in database");
			}

			logger.info(
				{ chainId, count: newDocuments.length },
				`Successfully stored ${newDocuments.length} events in MongoDB`
			);
		} catch (error) {
			logger.error({ chainId, error }, "Error storing events in MongoDB");
			if (error instanceof ValidationError) {
				throw error;
			}
			throw new DatabaseError("Failed to store events in database");
		}
	}

	/**
	 * Retrieves all events for a specific chain.
	 * Results are sorted by block number in ascending order.
	 *
	 * @param chainId - The chain ID to get events for
	 * @returns Array of events
	 * @throws {DatabaseError} When database operations fail
	 */
	async getEvents(chainId: number): Promise<FeeCollectedEvent[]> {
		try {
			const events = await FeeCollectedEventModel.find({ chainId })
				.sort({ blockNumber: 1 })
				.lean();
			return events;
		} catch (error) {
			logger.error({ chainId, error }, "Error getting events");
			throw new DatabaseError("Failed to get events");
		}
	}

	/**
	 * Get events by integrator for a specific chain
	 * @param chainId - The chain ID to get events for
	 * @param integrator - The integrator address
	 * @returns Array of events
	 */
	async getEventsByIntegrator(
		chainId: number,
		integrator: string
	): Promise<FeeCollectedEvent[]> {
		try {
			const events = await FeeCollectedEventModel.find({
				chainId,
				integrator,
			}).lean();
			return events;
		} catch (error) {
			logger.error(
				{ chainId, integrator, error },
				"Error getting events by integrator"
			);
			throw new DatabaseError("Failed to get events by integrator");
		}
	}
}
