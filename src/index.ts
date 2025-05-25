import { ethers } from "ethers";
import {
	loadFeeCollectorEvents,
	parseFeeCollectorEvents,
} from "./eventScanner";
import { config } from "./config";
import { FeeCollectedEventModel } from "./models/FeeCollectedEvent";
import { LastScannedBlockModel } from "./models/LastScannedBlock";
import mongoose from "mongoose";
import { FeeCollectedEventData, FeeCollectedEventDTO } from "./types/events";

async function scanBlockRange(fromBlock: number, toBlock: number) {
	const events = await loadFeeCollectorEvents(fromBlock, toBlock);
	console.log(
		`Found ${events.length} events in blocks ${fromBlock} to ${toBlock}`
	);
	return events;
}

async function storeEvents(events: FeeCollectedEventData[]) {
	// Convert events to MongoDB documents
	const documents: FeeCollectedEventDTO[] = events.map((event) => ({
		chainId: config.chainId,
		contractAddress: config.contractAddress,
		token: event.args.token,
		integrator: event.args.integrator,
		integratorFee: event.args.integratorFee,
		lifiFee: event.args.lifiFee,
		blockNumber: event.blockNumber,
		transactionHash: event.transactionHash,
		logIndex: event.logIndex,
	}));

	// Insert events into MongoDB
	if (documents.length > 0) {
		try {
			await FeeCollectedEventModel.insertMany(documents, { ordered: false });
			console.log(`Successfully stored ${documents.length} events in MongoDB`);
		} catch (error: any) {
			// If error is due to duplicate events, we can ignore it
			if (error.code === 11000) {
				console.log("Some events were already stored, skipping duplicates");
			} else {
				throw error;
			}
		}
	}
}

async function updateLastScannedBlock(blockNumber: number) {
	await LastScannedBlockModel.findOneAndUpdate(
		{ chainId: config.chainId },
		{ blockNumber },
		{ upsert: true }
	);
	console.log(`Updated last scanned block to ${blockNumber}`);
}

async function main() {
	try {
		// Connect to MongoDB
		await mongoose.connect(config.mongoUri);
		console.log("Connected to MongoDB");

		// Get the latest block number
		const provider = new ethers.providers.JsonRpcProvider(config.polygonRpcUrl);
		const latestBlock = await provider.getBlockNumber();

		// Get the last scanned block from MongoDB
		const lastScannedBlock = await LastScannedBlockModel.findOne({
			chainId: config.chainId,
		});
		const fromBlock = lastScannedBlock
			? lastScannedBlock.blockNumber + 1
			: Number(config.startBlock);
		const toBlock = latestBlock;

		console.log(`Scanning blocks from ${fromBlock} to ${toBlock}`);

		// Scan in chunks
		let allEvents: FeeCollectedEventData[] = [];
		for (
			let currentBlock = fromBlock;
			currentBlock < toBlock;
			currentBlock += config.chunkSize
		) {
			const chunkEndBlock = Math.min(
				currentBlock + config.chunkSize - 1,
				toBlock
			);
			console.log(`Scanning chunk: ${currentBlock} to ${chunkEndBlock}`);

			try {
				const chunkEvents = await scanBlockRange(currentBlock, chunkEndBlock);
				allEvents = allEvents.concat(chunkEvents);

				// Store events in MongoDB
				await storeEvents(chunkEvents);

				// Update last scanned block
				await updateLastScannedBlock(chunkEndBlock);
			} catch (error) {
				console.error(
					`Error scanning chunk ${currentBlock} to ${chunkEndBlock}:`,
					error
				);
				// Continue with next chunk even if this one fails
				continue;
			}
		}

		console.log(`\nTotal events found: ${allEvents.length}`);

		// Parse and log events
		const parsedEvents = parseFeeCollectorEvents(allEvents);
		parsedEvents.forEach((event: FeeCollectedEventData, index: number) => {
			console.log(`\nEvent #${index + 1}:`);
			console.log("Token:", event.args.token);
			console.log("Integrator:", event.args.integrator);
			console.log(
				"Integrator Fee:",
				ethers.utils.formatEther(event.args.integratorFee),
				"ETH"
			);
			console.log(
				"LiFi Fee:",
				ethers.utils.formatEther(event.args.lifiFee),
				"ETH"
			);
		});

		// Close MongoDB connection
		await mongoose.connection.close();
		console.log("Disconnected from MongoDB");
	} catch (error) {
		console.error("Error in main process:", error);
		// Ensure MongoDB connection is closed even if there's an error
		await mongoose.connection.close();
	}
}

// Run the main function
main();
