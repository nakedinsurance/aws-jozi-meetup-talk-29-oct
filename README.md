# Car Sales Agent - Meetup Talk Demo

An AI-powered conversational agent for car sales using OpenAI's Agent framework. This agent uses a multi-agent architecture with an orchestrator and synthesizer to handle customer inquiries intelligently.

This repository contains two main components:

1. **Car Sales Agent**: An AI agent that helps customers with car sales inquiries
2. **MCP Server**: A Model Context Protocol server for managing car financing application data

## Architecture

### Car Sales Agent

The agent system consists of three main components:

- **Orchestrator Agent**: Analyzes user requests and determines appropriate actions
- **Synthesizer Agent**: Generates natural, conversational responses based on orchestrator output
- **Finance Agent**: Specialized agent that connects to the MCP server for car financing operations

### MCP Server

The MCP server provides:

- **Tools**: `get_car_financing_data` and `add_car_financing_data`
- **Transport**: SSE (Server-Sent Events) for real-time communication
- **Storage**: JSON file-based persistence with comprehensive validation

## Prerequisites

- Node.js 22.x or higher (for local development)
- Docker (for containerized deployment)
- OpenAI API key

## Environment Variables

Create a `.env` file in the project root with the following:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

## Local Development

### Installation

```bash
# Install dependencies
yarn install
```

### Testing the Finance Agent

The Finance Agent can be tested independently:

```bash
# First, start the MCP server
yarn start:mcp

# In another terminal, run the finance agent examples
yarn test:finance-agent
```

For detailed Finance Agent documentation, see [src/carSalesAgent/agents/financeAgent/README.md](src/carSalesAgent/agents/financeAgent/README.md).

### Running the Car Sales Agent

```bash
# Start the agent in development mode (with hot reload)
yarn start:agent
```

The server will start on `http://localhost:8080`

### Running the MCP Server

```bash
# Start the MCP server in development mode (with hot reload)
yarn start:mcp
```

The server will start on `http://localhost:3001`

For detailed MCP server documentation, see [src/mcpServer/README.md](src/mcpServer/README.md).

### Building for Production

```bash
# Compile TypeScript to JavaScript
yarn build

# Run the compiled version
yarn start:prod
```

## Docker Deployment

### Car Sales Agent

#### Building the Docker Image

```bash
# Build the Docker image (ARM64 architecture)
yarn docker:build

# Or use Docker directly
docker build --platform linux/arm64 -f src/carSalesAgent/Dockerfile -t car-sales-agent:latest .
```

#### Running the Docker Container

```bash
# Run using yarn script (requires .env file)
yarn docker:run

# Or use Docker directly
docker run --platform linux/arm64 -p 8080:8080 \
  -e OPENAI_API_KEY=your_openai_api_key_here \
  car-sales-agent:latest
```

#### Docker with Environment File

```bash
docker run --platform linux/arm64 -p 8080:8080 --env-file .env car-sales-agent:latest
```

### MCP Server

#### Building the Docker Image

```bash
# Build the MCP server Docker image (ARM64 architecture)
yarn docker:build:mcp

# Or use Docker directly
docker build --platform linux/arm64 -f src/mcpServer/Dockerfile -t mcp-server:latest .
```

#### Running the Docker Container

```bash
# Run using yarn script
yarn docker:run:mcp

# Or use Docker directly
docker run --platform linux/arm64 -p 3001:3001 mcp-server:latest
```

#### Docker with Custom Data Volume

To persist data outside the container:

```bash
docker run --platform linux/arm64 \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  mcp-server:latest
```

### Docker Compose (Optional)

Create a `docker-compose.yml` file to run both services:

```yaml
version: '3.8'
services:
  car-sales-agent:
    build:
      context: .
      dockerfile: src/carSalesAgent/Dockerfile
      platform: linux/arm64
    ports:
      - '8080:8080'
    env_file:
      - .env
    restart: unless-stopped

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

## API Endpoints

### POST /prompt

Submit a message to the agent.

**Request Body:**

```json
{
  "message": "I'm looking for a family car",
  "ticketNumber": "TICKET-12345"
}
```

**Response:** Server-Sent Events (SSE) stream with:

- `connected`: Initial connection confirmation
- `step`: Orchestration steps (optional)
- `result`: Final agent response
- `done`: Completion signal
- `error`: Error messages

### GET /history

Retrieve conversation history for a specific ticket.

**Query Parameters:**

- `ticketNumber` (required): The ticket identifier

**Response:**

```json
{
  "ticketNumber": "TICKET-12345",
  "history": [
    {
      "role": "user",
      "content": "I'm looking for a family car",
      "timestamp": "2025-10-10T10:00:00.000Z",
      "ticketNumber": "TICKET-12345"
    }
  ],
  "count": 1
}
```

### DELETE /history

Clear conversation history.

**Query Parameters:**

- `ticketNumber` (optional): Clear specific ticket history. If omitted, clears all history.

**Response:**

```json
{
  "message": "Conversation history cleared for ticket TICKET-12345"
}
```

### GET /

Health check endpoint.

**Response:** `"Hello World!"`

## Project Structure

```
agent-core-meetup-talk/
├── src/
│   ├── carSalesAgent/
│   │   ├── agents/
│   │   │   ├── index.ts                   # Agent exports
│   │   │   ├── orchestrator/              # Orchestrator agent
│   │   │   ├── synthesizer/               # Synthesizer agent
│   │   │   └── financeAgent/              # Finance agent (MCP client)
│   │   │       ├── index.ts               # Finance agent implementation
│   │   │       ├── mcpClient.ts           # MCP client wrapper
│   │   │       ├── example.ts             # Usage examples
│   │   │       └── README.md              # Finance agent documentation
│   │   ├── prompts/
│   │   │   ├── index.ts                   # Prompt exports
│   │   │   ├── orchestratorContext.ts     # Orchestrator instructions
│   │   │   ├── synthesizerContext.ts      # Synthesizer instructions
│   │   │   └── financeAgentContext.ts     # Finance agent instructions
│   │   ├── main.ts                        # Express server & main logic
│   │   ├── utils.ts                       # Utility functions
│   │   └── Dockerfile                     # Docker configuration for agent
│   └── mcpServer/
│       ├── main.ts                        # MCP server implementation
│       ├── types.ts                       # TypeScript type definitions
│       ├── test-client.ts                 # Test client for MCP server
│       ├── Dockerfile                     # Docker configuration for MCP server
│       └── README.md                      # MCP server documentation
├── data/
│   ├── car-financing-data.json            # Car financing application data
│   └── example-car-financing-data.json    # Example data structure
├── package.json                           # Dependencies & scripts
└── tsconfig.json                          # TypeScript configuration
```

## Development Notes

- The agent maintains conversation history per ticket number in memory
- History is limited to the last 50 messages per ticket to prevent memory issues
- For production, consider using a persistent database for conversation storage
- The server uses Server-Sent Events (SSE) for streaming responses

## Security Considerations

⚠️ **Important Security Notes:**

- Never commit your `.env` file with actual API keys
- In production, use proper secret management (AWS Secrets Manager, Kubernetes Secrets, etc.)
- The current in-memory history storage is not suitable for production multi-instance deployments
- Consider implementing proper authentication and rate limiting for production use

## Operational Considerations

- **Logging**: Currently logs to console. For production, integrate structured logging (Winston, Pino)
- **Monitoring**: Add health checks and metrics endpoints (Prometheus, CloudWatch)
- **Scaling**: In-memory conversation history prevents horizontal scaling. Use Redis or a database
- **Error Handling**: Current error handling is basic. Implement comprehensive error tracking (Sentry, etc.)

## Troubleshooting

### Port Already in Use

#### Car Sales Agent (Port 8080)

If port 8080 is already in use, modify the port in `src/carSalesAgent/main.ts` or use Docker port mapping:

```bash
docker run --platform linux/arm64 -p 8081:8080 --env-file .env car-sales-agent:latest
```

#### MCP Server (Port 3001)

If port 3001 is already in use, set the `PORT` environment variable or use Docker port mapping:

```bash
# Using environment variable
docker run --platform linux/arm64 -p 3001:3002 -e PORT=3002 mcp-server:latest

# Or map to a different host port
docker run --platform linux/arm64 -p 3002:3001 mcp-server:latest
```

### Docker Build Issues on Non-ARM Machines

If building on x86_64 machines, you may need QEMU:

```bash
# For Car Sales Agent
docker buildx create --use
docker buildx build --platform linux/arm64 -f src/carSalesAgent/Dockerfile -t car-sales-agent:latest .

# For MCP Server
docker buildx build --platform linux/arm64 -f src/mcpServer/Dockerfile -t mcp-server:latest .
```

## Notes

```



    {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "tools/call",
      "params": {
          "name": "get_time_of_day",
          "arguments": {
              "timezone": "Europe/London",
              "format":"iso"
          }
      }
  }

  {"method":"tools/call","params":{"name":"get_car_financing_data","arguments":{},"_meta":{"progressToken":2}},"jsonrpc":"2.0","id":2}


```

## License

MIT
