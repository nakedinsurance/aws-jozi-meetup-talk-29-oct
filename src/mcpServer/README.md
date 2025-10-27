# Car Financing MCP Server

An MCP (Model Context Protocol) server for managing car financing application data. This server provides tools to store and retrieve vehicle finance applications with comprehensive validation and security measures.

## Features

- **Two MCP Tools:**

  - `get_car_financing_data`: Retrieve financing applications with optional filtering
  - `add_car_financing_data`: Add new financing applications with validation

- **Transport:** SSE (Server-Sent Events) for real-time communication
- **Storage:** JSON file-based persistence
- **Security:** Comprehensive input validation and error handling

## Architecture

```
┌─────────────┐         SSE          ┌──────────────────┐
│   Client    │ ◄──────────────────► │   MCP Server     │
│  (AI Agent) │                      │   (Express)      │
└─────────────┘                      └──────────────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │   JSON Storage  │
                                     │   (File System) │
                                     └─────────────────┘
```

## Installation

1. Install dependencies:

```bash
yarn install
```

2. Start the server:

```bash
yarn start:mcp
```

The server will start on port 3001 (or the PORT environment variable if set).

## Endpoints

- **SSE Endpoint:** `GET http://localhost:3001/sse`

  - Main MCP communication endpoint
  - Establishes SSE connection for bidirectional communication

- **Health Check:** `GET http://localhost:3001/health`
  - Returns server health status

## Tool Schemas

### get_car_financing_data

Retrieves car financing applications with optional filtering.

**Input:**

```typescript
{
  applicationId?: string;  // Filter by specific application ID
  outcome?: 'SUCCESS' | 'REJECTED';  // Filter by outcome
}
```

**Output:**

```typescript
{
  success: boolean;
  count: number;
  data: VehicleFinanceApplication[];
}
```

### add_car_financing_data

Adds a new car financing application with comprehensive validation.

**Input:** Full `VehicleFinanceApplication` object (see types.ts)

**Output:**

```typescript
{
  success: boolean;
  message: string;
  applicationId: string;
}
```

## Data Schema

The server manages `VehicleFinanceApplication` records with the following structure:

- **Customer Profile**: Credit score, income, down payment, trade-in value, debt-to-income ratio, location
- **Vehicle Data**: Make, model, year, pricing, mileage, condition
- **Financing Data**: Loan amount, term length, APR, lender ID
- **Outcome**: SUCCESS or REJECTED with optional rejection details

See `types.ts` for complete schema definitions.

## Security Considerations

### Input Validation

- All numeric fields validated for reasonable ranges (e.g., credit score 300-850)
- Date format validation (ISO 8601)
- String fields validated for non-empty values
- Enum fields validated against allowed values
- Duplicate application ID detection

### File System Security

- Path sanitization to prevent directory traversal
- Controlled file access with proper error handling
- Data directory created with appropriate permissions

### Error Handling

- Errors caught and returned without exposing sensitive internals
- Structured error responses for client consumption
- Comprehensive logging for operational monitoring

## Operational Considerations

### Monitoring

- Health check endpoint for uptime monitoring
- Console logging for connection events and errors
- Structured error messages for debugging

### Data Management

- JSON file storage for simplicity and portability
- Automatic directory and file creation on startup
- Pretty-printed JSON for human readability

### Scaling Considerations

Current implementation uses file-based storage, suitable for:

- Development and testing
- Small to medium datasets
- Single-instance deployments

For production at scale, consider:

- Database backend (PostgreSQL, DynamoDB)
- Proper transaction handling
- Concurrent access management
- Backup and recovery strategies

## Development

### Running in Development Mode

```bash
yarn start:mcp
```

This uses `tsx watch` for automatic reload on code changes.

### Building for Production

```bash
yarn build
```

Then run:

```bash
node dist/mcpServer/main.js
```

## Docker Deployment

### Building the Docker Image

```bash
# Build the Docker image (ARM64 architecture)
yarn docker:build:mcp

# Or use Docker directly
docker build --platform linux/arm64 -f src/mcpServer/Dockerfile -t mcp-server:latest .
```

### Running the Docker Container

```bash
# Run using yarn script
yarn docker:run:mcp

# Or use Docker directly
docker run --platform linux/arm64 -p 3001:3001 mcp-server:latest
```

### Custom Port Mapping

If you need to run on a different host port:

```bash
docker run --platform linux/arm64 -p 8080:3001 mcp-server:latest
```

The server will still run on port 3001 inside the container, but will be accessible on port 8080 on your host machine.

### Docker with Custom Data Directory

To use a custom data file or persist data outside the container:

```bash
docker run --platform linux/arm64 \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  mcp-server:latest
```

### Docker Compose (Optional)

Create a `docker-compose.yml` file in the project root:

```yaml
version: '3.8'
services:
  mcp-server:
    build:
      context: .
      dockerfile: src/mcpServer/Dockerfile
      platform: linux/arm64
    ports:
      - '3001:3001'
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Then run:

```bash
docker-compose up -d
```

## Environment Variables

- `PORT`: Server port (default: 3001)

## Testing the Server

### Using MCP Inspector (Recommended for Development)

The MCP Inspector is a visual debugging tool perfect for interactive testing:

```bash
# Terminal 1: Start the MCP server
yarn start:mcp

# Terminal 2: Start MCP Inspector
yarn inspect:mcp
```

Then in the Inspector web UI:

1. Select "SSE" transport
2. Enter server URL: `http://localhost:3001/sse`
3. Click "Connect"
4. Test tools interactively with custom payloads

See `MCP_INSPECTOR_GUIDE.md` for detailed usage instructions and test scenarios.

### Using the Test Script (Recommended for CI/CD)

A comprehensive automated test script is provided:

```bash
# Terminal 1: Start the MCP server
yarn start:mcp

# Terminal 2: Run the test suite
yarn test:mcp
```

The test script will:

- Connect to the MCP server via SSE
- List all available tools
- Add successful and rejected applications
- Filter data by outcome and application ID
- Test error handling (duplicate IDs, invalid data)
- Display results for each test

See `TEST_GUIDE.md` for detailed testing documentation.

### Using with Claude Desktop

You can also test using the Claude Desktop app with the appropriate configuration:

```json
{
  "mcpServers": {
    "car-financing": {
      "url": "http://localhost:3001/sse"
    }
  }
}
```

### Manual Testing with curl

Test the health endpoint:

```bash
curl http://localhost:3001/health
```

## License

MIT
