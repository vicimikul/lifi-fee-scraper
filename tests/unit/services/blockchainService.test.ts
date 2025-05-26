import { BlockchainService } from "../../../src/services/blockchainService";
import { FeeCollector__factory } from "lifi-contract-types";
import { ethers, providers } from "ethers";
import { FeeCollectedEventData } from "../../../src/types/events";
import { describe, expect, it, beforeEach, jest } from "@jest/globals";

// Mock ethers
jest.mock("ethers");
jest.mock("lifi-contract-types");

describe("BlockchainService", () => {
	let blockchainService: BlockchainService;
	let mockProvider: jest.Mocked<providers.JsonRpcProvider>;
	let mockContract: jest.Mocked<ethers.Contract>;
	let mockInterface: jest.Mocked<ethers.utils.Interface>;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Mock ethers.BigNumber to handle valid/invalid inputs
		(ethers as any).BigNumber = {
			from: jest.fn((value: any) => {
				// Check if the value is 'invalid' or not a number-like string
				if (value === "invalid" || isNaN(Number(value))) {
					throw new Error("invalid BigNumber value"); // Throw an error!
				}
				// If valid, return the object with toString
				return {
					toString: jest.fn().mockReturnValue(value.toString()),
				};
			}),
		};

		// Mock provider
		mockProvider = {
			getBlockNumber: jest.fn(),
		} as unknown as jest.Mocked<providers.JsonRpcProvider>;

		// Mock interface
		mockInterface = {
			parseLog: jest.fn(),
			functions: {
				"batchWithdrawIntegratorFees(address[])": jest.fn(),
				"batchWithdrawLifiFees(address[])": jest.fn(),
				"cancelOwnershipTransfer()": jest.fn(),
				"collectNativeFees(uint256,uint256,address)": jest.fn(),
				"collectTokenFees(address,uint256,uint256,address)": jest.fn(),
				"confirmOwnershipTransfer()": jest.fn(),
				"getLifiTokenBalance(address)": jest.fn(),
				"getTokenBalance(address,address)": jest.fn(),
				"owner()": jest.fn(),
				"pendingOwner()": jest.fn(),
				"transferOwnership(address)": jest.fn(),
				"withdrawIntegratorFees(address)": jest.fn(),
				"withdrawLifiFees(address)": jest.fn(),
			},
			getFunction: jest.fn(),
			encodeFunctionData: jest.fn(),
			decodeFunctionResult: jest.fn(),
			format: jest.fn(),
			parseTransaction: jest.fn(),
			parseError: jest.fn(),
			encodeDeploy: jest.fn(),
			decodeDeploy: jest.fn(),
			encodeFilterTopics: jest.fn(),
			decodeFilterTopics: jest.fn(),
			encodeEventTopic: jest.fn(),
			decodeEventTopic: jest.fn(),
			encodeEventTopics: jest.fn(),
			decodeEventTopics: jest.fn(),
			encodeEventLog: jest.fn(),
			decodeEventLog: jest.fn(),
		} as unknown as jest.Mocked<ethers.utils.Interface>;

		// Mock contract
		mockContract = {
			filters: {
				FeesCollected: jest.fn(),
			},
			queryFilter: jest.fn(),
			interface: mockInterface,
		} as unknown as jest.Mocked<ethers.Contract>;

		// Setup mocks
		jest
			.spyOn(ethers.providers, "JsonRpcProvider")
			.mockImplementation(() => mockProvider);
		jest
			.spyOn(FeeCollector__factory, "createInterface")
			.mockReturnValue(mockInterface as any);
		jest.spyOn(ethers, "Contract").mockImplementation(() => mockContract);

		// Create service instance
		blockchainService = new BlockchainService();
	});

	describe("getLatestBlock", () => {
		it("should return correct block number", async () => {
			const expectedBlock = 12345;
			mockProvider.getBlockNumber.mockResolvedValue(expectedBlock);

			const result = await blockchainService.getLatestBlock();
			expect(result).toBe(expectedBlock);
			expect(mockProvider.getBlockNumber).toHaveBeenCalledTimes(1);
		});

		it("should handle RPC connection errors", async () => {
			mockProvider.getBlockNumber.mockRejectedValue(
				new Error("RPC connection failed")
			);

			await expect(blockchainService.getLatestBlock()).rejects.toThrow(
				"RPC connection failed"
			);
			expect(mockProvider.getBlockNumber).toHaveBeenCalledTimes(1);
		});

		it("should handle network timeouts", async () => {
			mockProvider.getBlockNumber.mockRejectedValue(new Error("timeout"));

			await expect(blockchainService.getLatestBlock()).rejects.toThrow(
				"timeout"
			);
			expect(mockProvider.getBlockNumber).toHaveBeenCalledTimes(1);
		});
	});

	describe("loadFeeCollectorEvents", () => {
		const mockEvent: FeeCollectedEventData = {
			args: {
				token: "0x123...",
				integrator: "0x456...",
				integratorFee: "1000000000000000000", // 1 ETH
				lifiFee: "500000000000000000", // 0.5 ETH
			},
			blockNumber: 1000,
			transactionHash: "0x789...",
			logIndex: 0,
			address: "0x123...",
			topics: [],
			data: "0x",
			blockHash: "0xabc...",
			transactionIndex: 0,
			removed: false,
			removeListener: () => {},
			getBlock: () => Promise.resolve({} as providers.Block),
			getTransaction: () =>
				Promise.resolve({} as providers.TransactionResponse),
			getTransactionReceipt: () =>
				Promise.resolve({} as providers.TransactionReceipt),
		};

		beforeEach(() => {
			// Setup default mock responses
			mockContract.filters.FeesCollected.mockReturnValue({});
			mockContract.queryFilter.mockResolvedValue([
				mockEvent as unknown as ethers.Event,
			]);

			// Create an array-like object for args
			const integratorFee = ethers.BigNumber.from(mockEvent.args.integratorFee);
			const lifiFee = ethers.BigNumber.from(mockEvent.args.lifiFee);

			const args = [
				mockEvent.args.token,
				mockEvent.args.integrator,
				integratorFee,
				lifiFee,
			];

			// Make it array-like
			Object.setPrototypeOf(args, Array.prototype);

			mockInterface.parseLog.mockReturnValue({
				args,
				eventFragment: {} as ethers.utils.EventFragment,
				name: "FeesCollected",
				signature: "0x",
				topic: "0x",
			});
		});

		it("should successfully load events", async () => {
			const fromBlock = 1000;
			const toBlock = 2000;

			const events = await blockchainService.loadFeeCollectorEvents(
				fromBlock,
				toBlock
			);

			expect(events).toHaveLength(1);
			expect(events[0].args.token).toBe(mockEvent.args.token);
			expect(events[0].args.integrator).toBe(mockEvent.args.integrator);
			expect(events[0].args.integratorFee).toBe(mockEvent.args.integratorFee);
			expect(events[0].args.lifiFee).toBe(mockEvent.args.lifiFee);
			expect(mockContract.queryFilter).toHaveBeenCalledWith(
				expect.any(Object),
				fromBlock,
				toBlock
			);
		});

		it("should handle empty block ranges", async () => {
			const fromBlock = 1000;
			const toBlock = 1000; // Same as fromBlock

			mockContract.queryFilter.mockResolvedValue([]);

			const events = await blockchainService.loadFeeCollectorEvents(
				fromBlock,
				toBlock
			);

			expect(events).toHaveLength(0);
			expect(mockContract.queryFilter).toHaveBeenCalledWith(
				expect.any(Object),
				fromBlock,
				toBlock
			);
		});

		it("should handle invalid block ranges", async () => {
			const fromBlock = 2000;
			const toBlock = 1000; // Invalid: toBlock < fromBlock

			await expect(
				blockchainService.loadFeeCollectorEvents(fromBlock, toBlock)
			).rejects.toThrow();
		});

		it("should handle RPC errors", async () => {
			const fromBlock = 1000;
			const toBlock = 2000;

			mockContract.queryFilter.mockRejectedValue(new Error("RPC error"));

			await expect(
				blockchainService.loadFeeCollectorEvents(fromBlock, toBlock)
			).rejects.toThrow("RPC error");
		});

		it("should verify event parsing", async () => {
			const fromBlock = 1000;
			const toBlock = 2000;

			const events = await blockchainService.loadFeeCollectorEvents(
				fromBlock,
				toBlock
			);

			expect(mockInterface.parseLog).toHaveBeenCalled();
			expect(events[0].args).toEqual({
				token: mockEvent.args.token,
				integrator: mockEvent.args.integrator,
				integratorFee: mockEvent.args.integratorFee,
				lifiFee: mockEvent.args.lifiFee,
			});
		});
	});

	describe("parseFeeCollectorEvents", () => {
		const mockEvents: FeeCollectedEventData[] = [
			{
				args: {
					token: "0x123...",
					integrator: "0x456...",
					integratorFee: "1000000000000000000", // 1 ETH
					lifiFee: "500000000000000000", // 0.5 ETH
				},
				blockNumber: 1000,
				transactionHash: "0x789...",
				logIndex: 0,
				address: "0x123...",
				topics: [],
				data: "0x",
				blockHash: "0xabc...",
				transactionIndex: 0,
				removed: false,
				removeListener: () => {},
				getBlock: () => Promise.resolve({} as providers.Block),
				getTransaction: () =>
					Promise.resolve({} as providers.TransactionResponse),
				getTransactionReceipt: () =>
					Promise.resolve({} as providers.TransactionReceipt),
			},
		];

		it("should correctly parse event data", () => {
			const parsedEvents =
				blockchainService.parseFeeCollectorEvents(mockEvents);

			expect(parsedEvents).toHaveLength(1);
			expect(parsedEvents[0].args.token).toBe(mockEvents[0].args.token);
			expect(parsedEvents[0].args.integrator).toBe(
				mockEvents[0].args.integrator
			);
			expect(parsedEvents[0].args.integratorFee).toBe(
				mockEvents[0].args.integratorFee
			);
			expect(parsedEvents[0].args.lifiFee).toBe(mockEvents[0].args.lifiFee);
		});

		it("should handle malformed events", () => {
			const malformedEvents: FeeCollectedEventData[] = [
				{
					args: {
						token: "0x123...",
						integrator: "0x456...",
						integratorFee: "invalid",
						lifiFee: "invalid",
					},
					blockNumber: 1000,
					transactionHash: "0x789...",
					logIndex: 0,
					address: "0x123...",
					topics: [],
					data: "0x",
					blockHash: "0xabc...",
					transactionIndex: 0,
					removed: false,
					removeListener: () => {},
					getBlock: () => Promise.resolve({} as providers.Block),
					getTransaction: () =>
						Promise.resolve({} as providers.TransactionResponse),
					getTransactionReceipt: () =>
						Promise.resolve({} as providers.TransactionReceipt),
				},
			];

			expect(() =>
				blockchainService.parseFeeCollectorEvents(malformedEvents)
			).toThrow();
		});

		it("should verify fee calculations", () => {
			const eventsWithDifferentFees: FeeCollectedEventData[] = [
				{
					args: {
						token: "0x123...",
						integrator: "0x456...",
						integratorFee: "2000000000000000000", // 2 ETH
						lifiFee: "1000000000000000000", // 1 ETH
					},
					blockNumber: 1000,
					transactionHash: "0x789...",
					logIndex: 0,
					address: "0x123...",
					topics: [],
					data: "0x",
					blockHash: "0xabc...",
					transactionIndex: 0,
					removed: false,
					removeListener: () => {},
					getBlock: () => Promise.resolve({} as providers.Block),
					getTransaction: () =>
						Promise.resolve({} as providers.TransactionResponse),
					getTransactionReceipt: () =>
						Promise.resolve({} as providers.TransactionReceipt),
				},
			];

			const parsedEvents = blockchainService.parseFeeCollectorEvents(
				eventsWithDifferentFees
			);

			expect(parsedEvents[0].args.integratorFee).toBe("2000000000000000000");
			expect(parsedEvents[0].args.lifiFee).toBe("1000000000000000000");
		});
	});
});
