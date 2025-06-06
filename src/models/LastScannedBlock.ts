import { prop, getModelForClass, modelOptions } from "@typegoose/typegoose";

/**
 * LastScannedBlock.ts
 *
 * Mongoose model for tracking the last scanned block for each chain.
 * Used to resume scanning from the correct block after restarts.
 */

/**
 * Model for the last scanned block
 */
@modelOptions({
	schemaOptions: {
		timestamps: true, // Tracks when the last scanned block was updated
		collection: "lastScannedBlocks", // Explicitly name the MongoDB collection
	},
})
export class LastScannedBlock {
	@prop({ required: true, unique: true }) // Unique per chainId
	public chainId!: number;

	@prop({ required: true }) // The last block number successfully scanned for this chain
	public blockNumber!: number;

	// Timestamp fields added by Mongoose
	public createdAt!: Date;
	public updatedAt!: Date;
}

export const LastScannedBlockModel = getModelForClass(LastScannedBlock);
