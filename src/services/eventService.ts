import { FeeCollectedEvent, FeeCollectedEventModel } from "../models/FeeCollectedEvent";
import { LastScannedBlockModel } from "../models/LastScannedBlock";
import { FeeCollectedEventData, FeeCollectedEventDTO } from "../types/events";
import { config } from "../utils/config";
import mongoose from "mongoose";
import logger from "../utils/logger";
import { DatabaseError, ValidationError } from "../errors/AppError";
import {
	FeeCollectedEventSchema,
	FeeCollectedEventDTOSchema,
} from "../types/schemas";
import { ZodError } from "zod";

/**
 * EventService
 *
 * Service responsible for handling event-related database operations
 * including storing events and managing the last scanned block.
 */
export class EventService {
	/**
	 * Stores fee collection events in MongoDB.
	 * Converts event data, checks for duplicates, validates, and inserts.
	 * Uses transactions if available, falls back if not supported.
	 * @param events - Array of FeeCollectedEventData to be stored
	 * @throws {DatabaseError} If there's an error during the database operation
	 * @throws {ValidationError} If event data is invalid
	 */
	async storeEvents(events: FeeCollectedEventData[]): Promise<void> {
		// Convert raw event data to DTOs for MongoDB
		const documents: FeeCollectedEventDTO[] = events.map((event) => {
			const doc = {
				chainId: config.chainId,
				contractAddress: config.contractAddress,
				token: event.args.token,
				integrator: event.args.integrator,
				integratorFee: event.args.integratorFee.toString(),
				lifiFee: event.args.lifiFee.toString(),
				blockNumber: event.blockNumber,
				transactionHash: event.transactionHash,
				logIndex: event.logIndex,
			};
			logger.debug(
				{
					originalIntegratorFee: event.args.integratorFee,
					originalIntegratorFeeType: typeof event.args.integratorFee,
					convertedIntegratorFee: doc.integratorFee,
					convertedIntegratorFeeType: typeof doc.integratorFee,
					originalLifiFee: event.args.lifiFee,
					originalLifiFeeType: typeof event.args.lifiFee,
					convertedLifiFee: doc.lifiFee,
					convertedLifiFeeType: typeof doc.lifiFee,
				},
				"Converting event data for storage"
			);
			return doc;
		});

		if (documents.length === 0) return;

		try {
			// Check for existing events to avoid duplicates (compound index)
			const existingEvents = await FeeCollectedEventModel.find({
				$or: documents.map((doc) => ({
					$and: [
						{ transactionHash: doc.transactionHash },
						{ logIndex: doc.logIndex },
					],
				})),
			});

			if (existingEvents.length > 0) {
				logger.warn(
					{
						existingEvents: existingEvents.map((e) => ({
							transactionHash: e.transactionHash,
							logIndex: e.logIndex,
							blockNumber: e.blockNumber,
							integratorFee: e.integratorFee,
							lifiFee: e.lifiFee,
						})),
					},
					"Found existing events before insert"
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
			for (const doc of documents) {
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
					const result = await FeeCollectedEventModel.insertMany(documents, {
						ordered: false,
						session,
					});
					logger.debug(
						{
							insertedDocs: result.map((doc) => ({
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
						const result = await FeeCollectedEventModel.insertMany(documents, {
							ordered: false,
						});
						logger.debug(
							{
								insertedDocs: result.map((doc) => ({
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
				// Handle duplicate key errors (unique index)
				if (error.code === 11000) {
					logger.warn(
						{
							errorCode: error.code,
							errorMessage: error.message,
							duplicateKeys: error.writeErrors?.map((err: any) => ({
								transactionHash: err.err.op.transactionHash,
								logIndex: err.err.op.logIndex,
								blockNumber: err.err.op.blockNumber,
							})),
							totalAttempted: documents.length,
							duplicateCount: error.writeErrors?.length || 0,
						},
						"Duplicate events detected during transaction"
					);
					return; // Return early for duplicate events
				} else {
					logger.error({ error }, "Error storing events in MongoDB");
					throw new DatabaseError("Failed to store events in database");
				}
			}

			logger.info(
				{ count: documents.length },
				`Successfully stored ${documents.length} events in MongoDB`
			);
		} catch (error) {
			logger.error({ error }, "Error storing events in MongoDB");
			if (error instanceof ValidationError) {
				throw error;
			}
			throw new DatabaseError("Failed to store events in database");
		}
	}

	/**
	 * Updates the last scanned block number in the database.
	 * @param blockNumber - The block number to be stored as the last scanned block
	 * @throws {ValidationError} If block number is invalid
	 * @throws {DatabaseError} If there's an error updating the last scanned block
	 */
	async updateLastScannedBlock(blockNumber: number): Promise<void> {
		if (blockNumber < 0) {
			throw new ValidationError("Invalid block number");
		}

		try {
			await LastScannedBlockModel.findOneAndUpdate(
				{ chainId: config.chainId },
				{ blockNumber },
				{ upsert: true }
			);
			logger.info(
				{ blockNumber },
				`Updated last scanned block to ${blockNumber}`
			);
		} catch (error) {
			logger.error({ error }, "Error updating last scanned block");
			throw new DatabaseError("Failed to update last scanned block");
		}
	}

	/**
	 * Retrieves the last scanned block number from the database.
	 * Returns the configured start block if no record is found.
	 * @returns {Promise<number>} The last scanned block number, or the start block if no block has been scanned
	 * @throws {DatabaseError} If there's an error retrieving the last scanned block
	 */
	async getLastScannedBlock(): Promise<number> {
		try {
			const lastScannedBlock = await LastScannedBlockModel.findOne({
				chainId: config.chainId,
			});
			return lastScannedBlock
				? lastScannedBlock.blockNumber
				: Number(config.startBlock);
		} catch (error) {
			logger.error({ error }, "Error getting last scanned block");
			throw new DatabaseError("Failed to get last scanned block");
		}
	}

	async getEventsByIntegrator(
		integrator: string
	): Promise<FeeCollectedEvent[]> {
		const events: FeeCollectedEvent[] = await FeeCollectedEventModel.find({
			integrator,
		}).lean();
		return events;
	}
}
