import { BlockchainService } from "../../../src/services/blockchainService";
import { ethers, providers } from "ethers";
import { FeeCollector__factory } from "lifi-contract-types";
import { FeeCollectedEventData } from "../../../src/types/events";
import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { BlockchainError, ValidationError } from "../../../src/errors/AppError";

// Mock ethers
jest.mock("ethers", () => {
	const actualEthers = jest.requireActual("ethers");
	return {
		...(actualEthers as any),
		BigNumber: {
			from: jest.fn((value: any) => ({
				toString: () => value.toString(),
			})),
		},
		providers: {
			JsonRpcProvider: jest.fn(),
		},
	};
});

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
	__esModule: true,
	default: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));

// Mock config
jest.mock("../../../src/utils/config", () => ({
	config: {
		chains: {
			137: {
				// Polygon chain ID
				rpcUrl: "https://polygon-rpc.com",
			},
		},
		contractAddress: "0x123",
	},
}));

describe("BlockchainService", () => {
	let blockchainService: BlockchainService;
	let mockProvider: jest.Mocked<providers.JsonRpcProvider>;
	let mockContract: jest.Mocked<ethers.Contract>;
	let mockInterface: jest.Mocked<ethers.utils.Interface>;
	const TEST_CHAIN_ID = 137; // Polygon chain ID

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Mock provider
		mockProvider = {
			getBlockNumber: jest.fn(),
			getNetwork: jest.fn(),
			getBlock: jest.fn(),
			getTransaction: jest.fn(),
			getTransactionReceipt: jest.fn(),
			getLogs: jest.fn(),
			getBalance: jest.fn(),
			getCode: jest.fn(),
			getStorageAt: jest.fn(),
			getGasPrice: jest.fn(),
			estimateGas: jest.fn(),
			call: jest.fn(),
			sendTransaction: jest.fn(),
			getResolver: jest.fn(),
			lookupAddress: jest.fn(),
			resolveName: jest.fn(),
			getAvatar: jest.fn(),
			waitForTransaction: jest.fn(),
			getFeeData: jest.fn(),
			broadcastTransaction: jest.fn(),
			provider: {} as any,
			signer: {} as any,
			connect: jest.fn(),
			attach: jest.fn(),
			detach: jest.fn(),
			_isProvider: true,
			_isSigner: false,
		} as unknown as jest.Mocked<providers.JsonRpcProvider>;

		// Mock interface
		mockInterface = {
			parseLog: jest.fn(),
		} as unknown as jest.Mocked<ethers.utils.Interface>;

		// Mock contract
		mockContract = {
			filters: {
				FeesCollected: jest.fn().mockReturnValue({}),
			},
			queryFilter: jest.fn(),
			interface: mockInterface,
		} as unknown as jest.Mocked<ethers.Contract>;

		// Setup mocks
		jest
			.spyOn(ethers.providers, "JsonRpcProvider")
			.mockImplementation(() => mockProvider);
		jest
			.spyOn(FeeCollector__factory, "connect")
			.mockImplementation(() => mockContract as any);

		// Create service instance
		blockchainService = BlockchainService.getInstance();
	});

	describe("getLatestBlock", () => {
		it("should return correct block number", async () => {
			const expectedBlock = 12345;
			mockProvider.getBlockNumber.mockResolvedValue(expectedBlock);

			const result = await blockchainService.getLatestBlock(TEST_CHAIN_ID);
			expect(result).toBe(expectedBlock);
			expect(mockProvider.getBlockNumber).toHaveBeenCalledTimes(1);
		});

		it("should handle RPC connection errors", async () => {
			// Reset all mocks to ensure clean state
			jest.clearAllMocks();

			// Create a new mock provider with getBlockNumber that rejects
			const mockRejectingProvider = {
				...mockProvider,
				// @ts-ignore
				getBlockNumber: jest.fn().mockRejectedValue(new Error("rpc error")),
			};

			// Update the provider mock implementation
			jest
				.spyOn(ethers.providers, "JsonRpcProvider")
				.mockImplementation(() => mockRejectingProvider as any);

			// Create a new service instance to use the new provider
			const service = BlockchainService.getInstance();
			(service as any).providers = new Map();
			(service as any).providers.set(TEST_CHAIN_ID, mockRejectingProvider);

			// The error should be converted to a BlockchainError
			await expect(service.getLatestBlock(TEST_CHAIN_ID)).rejects.toThrow(
				"RPC error"
			);

			// Verify the mock was called
			expect(mockRejectingProvider.getBlockNumber).toHaveBeenCalledTimes(1);
		});
	});

	describe("loadFeeCollectorEvents", () => {
		const validAddress = "0x" + "a".repeat(40);
		const validTxHash = "0x" + "b".repeat(64);
		const mockEvent: FeeCollectedEventData = {
			args: {
				token: validAddress,
				integrator: validAddress,
				integratorFee: "1000000000000000000",
				lifiFee: "500000000000000000",
			},
			blockNumber: 1000,
			transactionHash: validTxHash,
			logIndex: 0,
			address: validAddress,
			topics: [],
			data: "0x",
			blockHash: validTxHash,
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
			mockContract.queryFilter.mockResolvedValue([
				mockEvent as unknown as ethers.Event,
			]);
			mockInterface.parseLog.mockReturnValue({
				args: [
					mockEvent.args.token,
					mockEvent.args.integrator,
					mockEvent.args.integratorFee,
					mockEvent.args.lifiFee,
				],
				eventFragment: {} as ethers.utils.EventFragment,
				name: "FeesCollected",
				signature: "0x",
				topic: "0x",
			});
		});

		it("should successfully load events", async () => {
			const events = await blockchainService.loadFeeCollectorEvents(
				TEST_CHAIN_ID,
				1000,
				2000
			);

			expect(events).toHaveLength(1);
			expect(events[0].args).toEqual(mockEvent.args);
			expect(mockContract.queryFilter).toHaveBeenCalledWith(
				expect.any(Object),
				1000,
				2000
			);
		});

		it("should handle invalid block ranges", async () => {
			await expect(
				blockchainService.loadFeeCollectorEvents(TEST_CHAIN_ID, 2000, 1000)
			).rejects.toThrow(ValidationError);
		});

		it("should handle RPC errors", async () => {
			mockContract.queryFilter.mockRejectedValue(new Error("RPC error"));

			await expect(
				blockchainService.loadFeeCollectorEvents(TEST_CHAIN_ID, 1000, 2000)
			).rejects.toThrow(BlockchainError);
		});
	});

	describe("parseFeeCollectorEvents", () => {
		const validAddress = "0x" + "a".repeat(40);
		const validTxHash = "0x" + "b".repeat(64);
		const mockEvents: FeeCollectedEventData[] = [
			{
				args: {
					token: validAddress,
					integrator: validAddress,
					integratorFee: "1000000000000000000",
					lifiFee: "500000000000000000",
				},
				blockNumber: 1000,
				transactionHash: validTxHash,
				logIndex: 0,
				address: validAddress,
				topics: [],
				data: "0x",
				blockHash: validTxHash,
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
			expect(parsedEvents[0].args).toEqual(mockEvents[0].args);
		});

		it("should handle malformed events", () => {
			const malformedEvents: FeeCollectedEventData[] = [
				{
					...mockEvents[0],
					args: {
						...mockEvents[0].args,
						integratorFee: "invalid",
						lifiFee: "invalid",
					},
				},
			];

			expect(() =>
				blockchainService.parseFeeCollectorEvents(malformedEvents)
			).toThrow(BlockchainError);
		});
	});
});
