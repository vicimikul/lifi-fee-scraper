import { z } from "zod";

// Schema for the event args
export const FeeCollectedArgsSchema = z.object({
	token: z.string().length(42, "Invalid token address"),
	integrator: z.string().length(42, "Invalid integrator address"),
	integratorFee: z.string().refine((val) => !isNaN(Number(val)), {
		message: "integratorFee must be a number string",
	}),
	lifiFee: z.string().refine((val) => !isNaN(Number(val)), {
		message: "lifiFee must be a number string",
	}),
});

// Schema for the full event
export const FeeCollectedEventSchema = z
	.object({
		args: FeeCollectedArgsSchema,
		blockNumber: z.number().int().nonnegative(),
		transactionHash: z.string().length(66, "Invalid transaction hash"),
		logIndex: z.number().int().nonnegative(),
	})
	.passthrough();

export const FeeCollectedEventDTOSchema = z.object({
	chainId: z.number().int().nonnegative(),
	contractAddress: z.string().length(42, "Invalid contract address"),
	token: z.string().length(42, "Invalid token address"),
	integrator: z.string().length(42, "Invalid integrator address"),
	integratorFee: z.string().refine((val) => !isNaN(Number(val)), {
		message: "integratorFee must be a number string",
	}),
	lifiFee: z.string().refine((val) => !isNaN(Number(val)), {
		message: "lifiFee must be a number string",
	}),
	blockNumber: z.number().int().nonnegative(),
	transactionHash: z.string().length(66, "Invalid transaction hash"),
	logIndex: z.number().int().nonnegative(),
});

// Zod schema for validating the integrator address
export const IntegratorParamSchema = z.object({
	integrator: z
		.string()
		.length(42, "Invalid integrator address")
		.regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
});

export type FeeCollectedEventParsed = z.infer<typeof FeeCollectedEventSchema>;
