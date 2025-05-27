import { Event } from "ethers";

/**
 * events.ts
 *
 * TypeScript interfaces for representing LiFi FeeCollected event data
 * and the DTO used for MongoDB storage.
 */

/**
 * TypeScript interfaces for representing LiFi FeeCollected event data.
 * Defines the structure of raw blockchain events and their database representation.
 */

/**
 * Represents a raw FeeCollected event from the blockchain.
 * Extends ethers.Event with typed arguments for fee collection data.
 *
 * @property {string} args.token - The token address that fees were collected in
 * @property {string} args.integrator - The integrator address that triggered the fee collection
 * @property {string} args.integratorFee - The fee amount for the integrator (in wei)
 * @property {string} args.lifiFee - The fee amount for LiFi (in wei)
 * @property {number} blockNumber - The block number where the event occurred
 * @property {string} transactionHash - The hash of the transaction that emitted the event
 * @property {number} logIndex - The index of the log within the transaction
 */
export interface FeeCollectedEventData extends Omit<Event, "args"> {
	args: {
		token: string;
		integrator: string;
		integratorFee: string; // BigNumber as string
		lifiFee: string; // BigNumber as string
	};
}

/**
 * Data Transfer Object for storing FeeCollected events in MongoDB.
 * Includes additional metadata and formatted fields for database storage.
 *
 * @property {number} chainId - The ID of the blockchain network
 * @property {string} contractAddress - The address of the FeeCollector contract
 * @property {string} token - The token address that fees were collected in
 * @property {string} integrator - The integrator address that triggered the fee collection
 * @property {string} integratorFee - The fee amount for the integrator (in wei)
 * @property {string} lifiFee - The fee amount for LiFi (in wei)
 * @property {number} blockNumber - The block number where the event occurred
 * @property {string} transactionHash - The hash of the transaction that emitted the event
 * @property {number} logIndex - The index of the log within the transaction
 */
export interface FeeCollectedEventDTO {
	chainId: number;
	contractAddress: string;
	token: string;
	integrator: string;
	integratorFee: string;
	lifiFee: string;
	blockNumber: number;
	transactionHash: string;
	logIndex: number;
}

export interface FeeCollectedEvent extends FeeCollectedEventDTO {
	createdAt: Date;
	updatedAt: Date;
}
