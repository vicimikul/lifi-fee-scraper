import { Event } from "ethers";

/**
 * events.ts
 *
 * TypeScript interfaces for representing LiFi FeeCollected event data
 * and the DTO used for MongoDB storage.
 */

/**
 * Interface for raw event data from the blockchain
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
 * Interface for the data we want to store in MongoDB
 */
export interface FeeCollectedEventDTO {
	chainId: number;
	contractAddress: string;
	token: string;
	integrator: string;
	integratorFee: string; // BigNumber as string
	lifiFee: string; // BigNumber as string
	blockNumber: number;
	transactionHash: string;
	logIndex: number;
}
