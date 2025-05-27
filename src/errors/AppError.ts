/**
 * AppError.ts
 *
 * Custom error classes for application-level, validation, database, blockchain, and configuration errors.
 * Used for consistent error handling and propagation throughout the app.
 */

/**
 * Base error class for application-specific errors.
 * Provides consistent error handling and classification throughout the application.
 *
 * @property {string} message - Error message
 * @property {boolean} isOperational - Whether the error is operational (expected) or programmer error
 */
export class AppError extends Error {
	constructor(public message: string, public isOperational = true) {
		super(message);
		Object.setPrototypeOf(this, AppError.prototype);
	}
}

/**
 * Represents errors that occur during blockchain interactions.
 * Used for RPC errors, network issues, and contract interaction failures.
 *
 * @extends {AppError}
 */
export class BlockchainError extends AppError {
	constructor(message: string) {
		super(message);
		Object.setPrototypeOf(this, BlockchainError.prototype);
	}
}

/**
 * Represents errors that occur during database operations.
 * Used for connection issues, query failures, and data validation errors.
 *
 * @extends {AppError}
 */
export class DatabaseError extends AppError {
	constructor(message: string) {
		super(message);
		Object.setPrototypeOf(this, DatabaseError.prototype);
	}
}

/**
 * Represents errors that occur during data validation.
 * Used for schema validation failures and invalid input data.
 *
 * @extends {AppError}
 */
export class ValidationError extends AppError {
	constructor(message: string) {
		super(message);
		Object.setPrototypeOf(this, ValidationError.prototype);
	}
}

/**
 * Represents errors that occur when a requested resource is not found.
 * Used for missing database records and invalid identifiers.
 *
 * @extends {AppError}
 */
export class NotFoundError extends AppError {
	constructor(message: string) {
		super(message);
		Object.setPrototypeOf(this, NotFoundError.prototype);
	}
}

/**
 * Represents errors that occur during configuration loading or validation.
 * Used for missing environment variables and invalid configuration values.
 *
 * @extends {AppError}
 */
export class ConfigurationError extends AppError {
	constructor(message: string) {
		super(message);
		Object.setPrototypeOf(this, ConfigurationError.prototype);
	}
}

/**
 * Represents errors that occur during API operations.
 * Includes HTTP status codes and error codes for client communication.
 *
 * @extends {AppError}
 * @property {number} statusCode - HTTP status code
 * @property {string} code - Error code for client reference
 */
export class ApiError extends AppError {
	constructor(
		public statusCode: number,
		message: string,
		public code?: string
	) {
		super(message);
		Object.setPrototypeOf(this, ApiError.prototype);
	}
}
