/**
 * AppError.ts
 *
 * Custom error classes for application-level, validation, database, blockchain, and configuration errors.
 * Used for consistent error handling and propagation throughout the app.
 */
export class AppError extends Error {
	constructor(public message: string, public isOperational = true) {
		super(message);
		Object.setPrototypeOf(this, AppError.prototype);
	}
}

export class ValidationError extends AppError {
	constructor(message: string) {
		super(message);
	}
}

export class NotFoundError extends AppError {
	constructor(message: string) {
		super(message);
	}
}

export class DatabaseError extends AppError {
	constructor(message: string) {
		super(message);
	}
}

export class BlockchainError extends AppError {
	constructor(message: string) {
		super(message);
	}
}

export class ConfigurationError extends AppError {
	constructor(message: string) {
		super(message);
	}
}
