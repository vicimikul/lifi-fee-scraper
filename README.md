# LiFi Fee Scraper

A tool for scraping, storing and serving events from LiFi's fee collector smart contracts across multiple EVM networks.

## Features

- Collect Fee Collected events from the LiFi smart contracts using ethers
- Store events in MongoDB database
- Store latest block for each chain in a separate collection
- REST API endpoint to retrieve events related to a particular integrator
- Unit, integration and e2e tests
- Structured logging with Pino
- Schema validation with Zod

## Getting Started

### Prerequisites

- Node.js 22
- MongoDB
- npm

### Installation & Start

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Run the application:

```bash
npm start
```

## Development

### Project Structure

```
src/
├── app.ts
│
├── controllers/
│   └── eventsController.ts
│
├── errors/
│   └── AppError.ts
│
├── middleware/
│   └── requestLogger.ts
│
├── models/
│   ├── FeeCollectedEvent.ts
│   └── LastScannedBlock.ts
│
├── services/
│   ├── blockchainService.ts
│   ├── eventService.ts
│   └── scannerService.ts
│
├── types/
│   ├── events.ts
│   └── schemas.ts
│
├── utils/
│   ├── config.ts
│   ├── db.ts
│   ├── logger.ts
```

### Tech Stack

- Typescript
- Node.js
- Express
- MongoDB + Typegoose/Mongoose
- Zod (validation)
- Pino (logging)
- ethers v5
- jest & superterst

## Testing

### Overview

The project uses Jest as the testing framework. Tests are organized into three categories:

- Unit Tests: Testing individual components in isolation
- Integration Tests: Testing component interactions
- E2E Tests: Testing complete workflows

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests only
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

### Test Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── eventService.test.ts
│   │   ├── blockchainService.test.ts
│   │   └── scannerService.test.ts
│   ├── models/
│   │   └── FeeCollectedEvent.test.ts
│   └── utils/
│       └── logger.test.ts
├── integration/
│   └── scanner.test.ts
└── e2e/
    └── fullScan.test.ts
```

### Unit Tests

Unit tests focus on testing individual components in isolation. Here's what we test:

#### EventService

- `storeEvents`

  - Successfully stores events
  - Handles duplicate events correctly
  - Handles empty event arrays
  - Handles database connection errors
  - Handles transaction failures
  - Verifies event data integrity

- `updateLastScannedBlock`

  - Successfully updates block number
  - Handles invalid block numbers
  - Handles database errors
  - Verifies block number persistence

- `getLastScannedBlock`
  - Returns correct block number
  - Returns start block when no block is scanned
  - Handles database errors

#### BlockchainService

- `getLatestBlock`

  - Returns correct block number
  - Handles RPC connection errors
  - Handles network timeouts

- `loadFeeCollectorEvents`

  - Successfully loads events
  - Handles empty block ranges
  - Handles invalid block ranges
  - Handles RPC errors
  - Verifies event parsing

- `parseFeeCollectorEvents`
  - Correctly parses event data
  - Handles malformed events
  - Verifies fee calculations

#### ScannerService

- `scanBlockRange`

  - Successfully scans block range
  - Handles empty ranges
  - Handles blockchain errors
  - Verifies event collection

- `scanBlocks`
  - Successfully scans multiple chunks
  - Handles chunk processing errors
  - Maintains scanning progress
  - Verifies event storage
  - Handles reconnection scenarios

### Mocking Strategy

- Blockchain interactions are mocked using ethers.js test utilities
- Database operations are mocked using in-memory MongoDB
- External services are mocked using Jest mock functions
- Configuration is mocked for different test scenarios

## License

Victor-Cristian Florea's personal work - All rights reserved
