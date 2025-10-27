import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import {
  VehicleFinanceApplication,
  CarDealerDataset,
  ApplicationOutcome,
} from './types';
import path from 'path';

// Create an MCP server
const server = new McpServer({
  name: 'Demo',
  version: '1.0.0',
});

// Path to the JSON data file - using process.cwd() for compatibility
const DATA_FILE_PATH = path.join(
  process.cwd(),
  'data',
  'car-financing-data.json'
);

// Add an addition tool
server.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: 'text', text: String(a + b) }],
}));

/**
 * Reads the car financing data from the JSON file.
 */
async function readCarFinancingData(): Promise<CarDealerDataset> {
  try {
    const data = await fs.readFile(DATA_FILE_PATH, 'utf-8');
    return JSON.parse(data) as CarDealerDataset;
  } catch (error) {
    console.error('Error reading car financing data:', error);
    throw new Error('Failed to read car financing data');
  }
}

/* Writes the car financing data to the JSON file.
 */
async function writeCarFinancingData(data: CarDealerDataset): Promise<void> {
  try {
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing car financing data:', error);
    throw new Error('Failed to write car financing data');
  }
}

/**
 * Validates a vehicle finance application.
 * Performs comprehensive input validation for security.
 */
function validateApplication(
  application: any
): application is VehicleFinanceApplication {
  // Check required fields
  if (
    !application.applicationId ||
    typeof application.applicationId !== 'string'
  ) {
    throw new Error('Invalid or missing applicationId');
  }

  if (
    !application.submissionDate ||
    typeof application.submissionDate !== 'string'
  ) {
    throw new Error('Invalid or missing submissionDate');
  }

  // Validate date format (ISO 8601)
  if (!/^\d{4}-\d{2}-\d{2}/.test(application.submissionDate)) {
    throw new Error('submissionDate must be in ISO 8601 format (YYYY-MM-DD)');
  }

  // Validate outcome
  if (
    !application.outcome ||
    !Object.values(ApplicationOutcome).includes(application.outcome)
  ) {
    throw new Error('Invalid or missing outcome');
  }

  // Validate customer profile
  if (!application.customer || typeof application.customer !== 'object') {
    throw new Error('Invalid or missing customer profile');
  }

  const { customer } = application;
  if (
    typeof customer.creditScore !== 'number' ||
    customer.creditScore < 300 ||
    customer.creditScore > 850
  ) {
    throw new Error('Invalid creditScore (must be between 300 and 850)');
  }

  if (
    typeof customer.annualIncomeZar !== 'number' ||
    customer.annualIncomeZar < 0
  ) {
    throw new Error('Invalid annualIncomeZar (must be non-negative)');
  }

  if (
    typeof customer.downPaymentZar !== 'number' ||
    customer.downPaymentZar < 0
  ) {
    throw new Error('Invalid downPaymentZar (must be non-negative)');
  }

  if (
    typeof customer.tradeInValueZar !== 'number' ||
    customer.tradeInValueZar < 0
  ) {
    throw new Error('Invalid tradeInValueZar (must be non-negative)');
  }

  if (
    typeof customer.debtToIncomeRatio !== 'number' ||
    customer.debtToIncomeRatio < 0 ||
    customer.debtToIncomeRatio > 1
  ) {
    throw new Error('Invalid debtToIncomeRatio (must be between 0 and 1)');
  }

  if (
    typeof customer.applicantLocation !== 'string' ||
    !customer.applicantLocation.trim()
  ) {
    throw new Error('Invalid or missing applicantLocation');
  }

  // Validate vehicle data
  if (!application.vehicle || typeof application.vehicle !== 'object') {
    throw new Error('Invalid or missing vehicle data');
  }

  const { vehicle } = application;
  if (typeof vehicle.make !== 'string' || !vehicle.make.trim()) {
    throw new Error('Invalid or missing vehicle make');
  }

  if (typeof vehicle.model !== 'string' || !vehicle.model.trim()) {
    throw new Error('Invalid or missing vehicle model');
  }

  if (
    typeof vehicle.year !== 'number' ||
    vehicle.year < 1900 ||
    vehicle.year > new Date().getFullYear() + 2
  ) {
    throw new Error('Invalid vehicle year');
  }

  if (typeof vehicle.msrpZar !== 'number' || vehicle.msrpZar < 0) {
    throw new Error('Invalid msrpZar (must be non-negative)');
  }

  if (typeof vehicle.salePriceZar !== 'number' || vehicle.salePriceZar < 0) {
    throw new Error('Invalid salePriceZar (must be non-negative)');
  }

  if (typeof vehicle.mileage !== 'number' || vehicle.mileage < 0) {
    throw new Error('Invalid mileage (must be non-negative)');
  }

  if (vehicle.condition !== 'New' && vehicle.condition !== 'Used') {
    throw new Error('Invalid vehicle condition (must be "New" or "Used")');
  }

  // Validate financing data
  if (!application.financing || typeof application.financing !== 'object') {
    throw new Error('Invalid or missing financing data');
  }

  const { financing } = application;
  if (
    typeof financing.loanAmountRequestedZar !== 'number' ||
    financing.loanAmountRequestedZar < 0
  ) {
    throw new Error('Invalid loanAmountRequestedZar (must be non-negative)');
  }

  if (
    typeof financing.termLengthMonths !== 'number' ||
    financing.termLengthMonths < 1
  ) {
    throw new Error('Invalid termLengthMonths (must be positive)');
  }

  if (
    typeof financing.annualPercentageRate !== 'number' ||
    financing.annualPercentageRate < 0 ||
    financing.annualPercentageRate > 1
  ) {
    throw new Error('Invalid annualPercentageRate (must be between 0 and 1)');
  }

  if (typeof financing.lenderId !== 'string' || !financing.lenderId.trim()) {
    throw new Error('Invalid or missing lenderId');
  }

  // Validate rejection details if outcome is REJECTED
  if (application.outcome === ApplicationOutcome.REJECTED) {
    if (
      !application.rejectionDetails ||
      typeof application.rejectionDetails !== 'object'
    ) {
      throw new Error('rejectionDetails required when outcome is REJECTED');
    }

    if (
      typeof application.rejectionDetails.reason !== 'string' ||
      !application.rejectionDetails.reason.trim()
    ) {
      throw new Error('Invalid or missing rejection reason');
    }
  }

  return true;
}

server.tool(
  'get_car_financing_data',
  {
    applicationId: z.string().optional(),
    outcome: z.string().optional(),
  },
  async ({ applicationId, outcome }) => {
    console.log('🔧 Tool called: get_car_financing_data', {
      applicationId,
      outcome,
      timestamp: new Date().toISOString(),
    });

    try {
      const data = await readCarFinancingData();
      let filteredData = data;

      // Apply filters if provided
      if (applicationId) {
        filteredData = filteredData.filter(
          (app) => app.applicationId === applicationId
        );
      }

      if (outcome) {
        filteredData = filteredData.filter((app) => app.outcome === outcome);
      }

      console.log(
        `✅ Tool success: get_car_financing_data - Returned ${filteredData.length} results`
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                count: filteredData.length,
                data: filteredData,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error('❌ Tool error: get_car_financing_data', error);
      throw error;
    }
  }
);

server.tool(
  'add_car_financing_data',
  {
    application: z.any(),
  },
  async ({ application }) => {
    console.log('🔧 Tool called: add_car_financing_data', {
      applicationId: application?.applicationId,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!application) {
        throw new Error('Application data is required');
      }

      // Validate the application data
      validateApplication(application);

      const data = await readCarFinancingData();
      const applicationId = application.applicationId;

      // Check for duplicate applicationId
      if (data.some((app) => app.applicationId === applicationId)) {
        throw new Error(`Application with ID ${applicationId} already exists`);
      }

      // Add the new application - validation ensures this is safe
      data.push(application as VehicleFinanceApplication);
      await writeCarFinancingData(data);

      console.log(
        `✅ Tool success: add_car_financing_data - Added application ${applicationId}`
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Application added successfully',
                applicationId,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error('❌ Tool error: add_car_financing_data', error);
      throw error;
    }
  }
);

// Add a dynamic greeting resource
server.resource(
  'greeting',
  new ResourceTemplate('greeting://{name}', { list: undefined }),
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Hello, ${name}!`,
      },
    ],
  })
);

// Set up Express and StreamableHTTP transport
const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';

// POST /mcp - Handle all MCP requests via StreamableHTTP
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    console.log('POST /mcp - Received request', {
      method: req.body?.method,
      id: req.body?.id,
      timestamp: new Date().toISOString(),
    });

    // Create a new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    console.log('✅ Request handled successfully');
  } catch (error) {
    console.error('Error handling POST request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

app.get('/health', (_: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, HOST, async () => {
  console.log('='.repeat(60));
  console.log('🚀 Car Financing MCP Server Starting Up');
  console.log('='.repeat(60));

  // Environment Information
  console.log('\n📋 Environment:');
  console.log(`  Node Version: ${process.version}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Process ID: ${process.pid}`);
  console.log(`  Platform: ${process.platform}`);
  console.log(`  Started: ${new Date().toISOString()}`);

  // Server Configuration
  console.log('\n🌐 Server Configuration:');
  console.log(`  Host: ${HOST}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Base URL: http://${HOST}:${PORT}`);
  console.log('\n📡 Available Endpoints:');
  console.log(`  POST /mcp       - StreamableHTTP transport endpoint`);
  console.log(`  GET  /health    - Health check`);

  // Data Storage
  console.log('\n💾 Data Storage:');
  console.log(`  Data File: ${DATA_FILE_PATH}`);
  try {
    await fs.access(DATA_FILE_PATH);
    const stats = await fs.stat(DATA_FILE_PATH);
    const data = await readCarFinancingData();
    console.log(
      `  ✅ Data file accessible (${stats.size} bytes, ${data.length} applications)`
    );
  } catch (error) {
    console.log(
      `  ⚠️  Data file not accessible: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }

  // MCP Capabilities
  console.log('\n🔧 MCP Tools Registered:');
  console.log('  - add (basic math operation)');
  console.log('  - get_car_financing_data (query applications)');
  console.log('  - add_car_financing_data (submit new applications)');

  console.log('\n📚 MCP Resources:');
  console.log('  - greeting://{name} (dynamic greeting resource)');

  console.log('\n🔌 Transport:');
  console.log('  Type: StreamableHTTP (stateless, per-request transport)');
  console.log(
    '  Session Management: Not required (each request is independent)'
  );

  console.log('\n' + '='.repeat(60));
  console.log('✅ Server is ready to accept connections');
  console.log('='.repeat(60) + '\n');
});
