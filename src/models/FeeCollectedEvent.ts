import {
	prop,
	getModelForClass,
	modelOptions,
	Severity,
	index,
} from "@typegoose/typegoose";

/**
 * Model for the FeeCollectedEvent
 */
@modelOptions({
	schemaOptions: {
		timestamps: true, // Adds createdAt and updatedAt fields
		collection: "feeCollectedEvents", // Name the MongoDB collection
	},
	options: {
		allowMixed: Severity.ALLOW, // Allow mixed types for certain fields if needed, or define specific types.
	},
})
@index({ transactionHash: 1, logIndex: 1 }, { unique: true })
export class FeeCollectedEvent {
	@prop({ required: true, index: true })
	public chainId!: number; // ChainId of the given network

	@prop({ required: true })
	public contractAddress!: string; // Address of the FeeCollector contract

	@prop({ required: true, index: true })
	public token!: string; // the address of the token that was collected

	@prop({ required: true, index: true })
	public integrator!: string; // the integrator that triggered the fee collection

	// Store as string to prevent precision issues
	@prop({ required: true, type: String })
	public integratorFee!: string; // the share collected for the integrator

	// Store as string
	@prop({ required: true, type: String })
	public lifiFee!: string; // the share collected for lifi

	@prop({ required: true, index: true })
	public blockNumber!: number; // The block number where the event occurred

	@prop({ required: true })
	public transactionHash!: string; // Hash of the transaction that emitted the event

	@prop({ required: true })
	public logIndex!: number; // The index of the log within the transaction

	// Timestamp fields added by Mongoose
	public createdAt!: Date;
	public updatedAt!: Date;
}

export const FeeCollectedEventModel = getModelForClass(FeeCollectedEvent);
