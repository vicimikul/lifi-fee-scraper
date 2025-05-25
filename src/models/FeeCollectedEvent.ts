import {
	prop,
	getModelForClass,
	modelOptions,
	Severity,
} from "@typegoose/typegoose";
import { BigNumber } from "ethers";

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
export class FeeCollectedEvent {
	@prop({ required: true, index: true })
	public chainId!: number; // ChainId of the given network

	@prop({ required: true })
	public contractAddress!: string; // Address of the FeeCollector contract

	@prop({ required: true, index: true })
	public token!: string; // the address of the token that was collected

	@prop({ required: true, index: true })
	public integrator!: string; // the integrator that triggered the fee collection

	// Store BigNumber as string to prevent precision issues
	@prop({
		required: true,
		type: String, // Store as string
		get: (val: string) => BigNumber.from(val), // Convert back to BigNumber on retrieval
		set: (val: BigNumber) => val.toString(), // Convert to string on save
	})
	public integratorFee!: BigNumber; // the share collected for the integrator

	// Store BigNumber as string
	@prop({
		required: true,
		type: String,
		get: (val: string) => BigNumber.from(val),
		set: (val: BigNumber) => val.toString(),
	})
	public lifiFee!: BigNumber; // the share collected for lifi

	@prop({ required: true, index: true })
	public blockNumber!: number; // The block number where the event occurred

	@prop({ required: true, unique: true }) // transactionHash + logIndex should be unique
	public transactionHash!: string; // Hash of the transaction that emitted the event

	@prop({ required: true, unique: true }) // transactionHash + logIndex should be unique
	public logIndex!: number; // The index of the log within the transaction
}

export const FeeCollectedEventModel = getModelForClass(FeeCollectedEvent);
