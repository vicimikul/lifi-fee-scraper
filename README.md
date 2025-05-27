# LiFi Fee Scraper

A tool for scraping, storing and serving events from LiFi's fee collector smart contracts across multiple EVM networks. It supports one or multiple networks at the same time, being able to index them synchronously. 

## Features

- Collect Fee Collected events from the LiFi smart contracts using ethers
- Store events in MongoDB database
- Store latest block for each chain in a separate collection
- REST API endpoint to retrieve events related to a particular integrator
- Unit, integration and e2e tests
- Structured logging with Pino
- Schema validation with Zod
- Run as Docker container

## Getting Started

### Prerequisites

- Node.js 22
- MongoDB
- npm
- Docker

### Installation & Start

Once you have the dependencies above installed, create a .env file with a structure similar to the .env.example file. Key variables you will need: 
- Production MongDB URI 
- Testing MongoDB URI with the database being called ***/test*** (since the integrations tests will replace "/test" with their particular naming and create new dbs, please use a db /test)
- RPC URLs for the chains you want to work with 
- Starting blocks for the chains you want to index (I already provided the ones for ETH and Polygon)
- ENABLED_CHAINS - this is the key variable, as it sets the desired chains to index. You need to use chainIds separated by a comma, as shown in the example file

Everything else can be copied from the example file. Once you have these variables setup, proceed to instalation and then you can run the application using the commands below: 


#### Install dependencies:

```bash
npm install
```

#### Run the application:

```bash
npm start
```

#### Run using Docker:

```bash
docker-compose up --build
```

#### REST API Endpoint:

Called using Postman or another service locally:

```bash
http://localhost:3000/events/integrator/{chainId}/{integrator_address}
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
- Docker

### Next Steps

If I were to continue the project, here are some key areas of focus:

- WebSocket Providers to index blockchain events real-time
- Implement data batch processing and potentially Redis caching for highly used documents
- Add pagination, filtering and sorting for the REST API endpoint
- Setup CI/CD pipeline for a better development experience
- User Experience: 
  - Minimal Frontend to show data through the API
  - CLI tool to interact with the database through the API

## Testing

### Overview

The project uses Jest as the testing framework, and Supertest for API testing. Tests are organized into three categories:

- Unit Tests: Testing individual components in isolation
- Integration Tests: Testing component interactions
- E2E Tests: Testing complete workflows

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test unit

# Run integration tests only
npm run test integration

# Run E2E tests only
npm run test e2e

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
│   │   |── FeeCollectedEvent.test.ts
│   │   |── LastScannedBlock.test.ts
│   └── utils/
│       └── logger.test.ts
├── integration/
│   └── scanner.test.ts
└── e2e/
    └── fullScan.test.ts
```

### Unit Tests

Unit tests focus on testing individual components in isolation.
Utilises an in-memory mongodb

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

### Integration Tests

Integration tests focus on testing flows depending on multiple modules.
Utilises a testing database inside MongoDB to ensure validity of operations.

#### Scanner Integration

- `scanBlocks`
  - Successfully scans blocks and stores events
  - Handles empty block ranges
  - Handles blockchain errors gracefully
  - Handles database errors gracefully
  - Scans blocks in chunks correctly

#### API Endpoint Integration

- `GET /events/integrator/:integrator`
  - Returns events for a valid integrator
  - Returns 400 for invalid integrator address
  - Properly filters events by integrator
  - Returns correct metadata and response structure

### E2E Tests

This test runs the application for a given block interval.
Utilises a testing database inside MongoDB to ensure validity of operations.

#### Full Scanner Flow

- `scan blocks and store events end-to-end`
  - Successfully scans a block range (1000 blocks)
  - Verifies events are stored in the database
  - Confirms last scanned block is updated
  - Validates data persistence across operations

### Mocking Strategy

- Blockchain interactions are mocked using ethers.js test utilities
- Database operations are mocked using in-memory MongoDB
- External services are mocked using Jest mock functions
- Configuration is mocked for different test scenarios

## License

Victor-Cristian Florea's personal work - All rights reserved
