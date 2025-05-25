import { BigNumber, ethers } from "ethers"; // please use ethers v5 to ensure compatibility
import { FeeCollector__factory } from "lifi-contract-types";
import { BlockTag } from "@ethersproject/abstract-provider";
import { config } from "./config";
import { FeeCollectedEventData } from "./types/events";

/**
 * For a given block range all `FeesCollected` events are loaded from the Polygon FeeCollector
 * @param fromBlock
 * @param toBlock
 */
export const loadFeeCollectorEvents = async (
	fromBlock: BlockTag,
	toBlock: BlockTag
): Promise<FeeCollectedEventData[]> => {
	const feeCollector = new ethers.Contract(
		config.contractAddress,
		FeeCollector__factory.createInterface(),
		new ethers.providers.JsonRpcProvider(config.polygonRpcUrl)
	);
	const filter = feeCollector.filters.FeesCollected();
	const events = await feeCollector.queryFilter(filter, fromBlock, toBlock);

	// Cast events to our custom type
	return events.map((event) => {
		const parsedEvent = feeCollector.interface.parseLog(event);
		return {
			...event,
			args: {
				token: parsedEvent.args[0],
				integrator: parsedEvent.args[1],
				integratorFee: parsedEvent.args[2].toString(),
				lifiFee: parsedEvent.args[3].toString(),
			},
		} as FeeCollectedEventData;
	});
};

/**
 * Takes a list of raw events and parses them into BigNumber values for display
 * @param events
 */
export const parseFeeCollectorEvents = (
	events: FeeCollectedEventData[]
): FeeCollectedEventData[] => {
	return events.map((event) => ({
		...event,
		args: {
			...event.args,
			integratorFee: BigNumber.from(event.args.integratorFee).toString(),
			lifiFee: BigNumber.from(event.args.lifiFee).toString(),
		},
	}));
};
