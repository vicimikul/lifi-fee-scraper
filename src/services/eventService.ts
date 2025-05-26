import { FeeCollectedEventModel } from "../models/FeeCollectedEvent";
import { LastScannedBlockModel } from "../models/LastScannedBlock";
import { FeeCollectedEventData, FeeCollectedEventDTO } from "../types/events";
import { config } from "../config";
import mongoose from "mongoose";
import logger from "../utils/logger";

/**
 * Service responsible for handling event-related database operations
 * including storing events and managing the last scanned block
 */
export class EventService {
	/**
	 * Stores fee collection events in MongoDB
	 * @param events - Array of FeeCollectedEventData to be stored
	 * @throws {Error} If there's an error during the database operation
	 */
	async storeEvents(events: FeeCollectedEventData[]): Promise<void> {
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
			// Check for existing events first
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
			for (const doc of documents) {
				if (
					typeof doc.integratorFee !== "string" ||
					isNaN(Number(doc.integratorFee))
				) {
					throw new Error("Invalid integrator fee format");
				}
				if (typeof doc.lifiFee !== "string" || isNaN(Number(doc.lifiFee))) {
					throw new Error("Invalid lifi fee format");
				}
			}

			// Try to use transactions if available
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
					// If transaction fails, try without transaction
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
					throw error;
				}
			}

			logger.info(
				{ count: documents.length },
				`Successfully stored ${documents.length} events in MongoDB`
			);
		} catch (error: any) {
			logger.error({ error }, "Error storing events in MongoDB");
			throw error;
		}
	}

	/**
	 * Updates the last scanned block number in the database
	 * @param blockNumber - The block number to be stored as the last scanned block
	 * @throws {Error} If there's an error updating the last scanned block or if block number is invalid
	 */
	async updateLastScannedBlock(blockNumber: number): Promise<void> {
		if (blockNumber < 0) {
			throw new Error("Invalid block number");
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
			throw error;
		}
	}

	/**
	 * Retrieves the last scanned block number from the database
	 * @returns {Promise<number>} The last scanned block number, or the start block if no block has been scanned
	 * @throws {Error} If there's an error retrieving the last scanned block
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
			throw error;
		}
	}
}
