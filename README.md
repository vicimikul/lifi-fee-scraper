# LiFi Fee Scraper

A tool for scraping and analyzing fees from LiFi protocol.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the project:

```bash
npm run build
```

3. Run the application:

```bash
npm start
```

## Development

This project is built with TypeScript and uses Node.js. 

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

### Test Data

Test data is stored in `tests/fixtures/` and includes:

- Sample blockchain events
- Database state snapshots
- Configuration variations
- Error scenarios

## License

Private repository - All rights reserved
