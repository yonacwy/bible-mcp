import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3000; // Port for the web UI
const BIBLE_SERVER_COMMAND = 'tsx';
const BIBLE_SERVER_ARGS = [path.resolve(__dirname, 'server.ts')]; // Use absolute path

let mcpClient: Client | null = null;
let mcpTransport: StdioClientTransport | null = null;

// Serve static files for the web client
app.use(express.static(path.join(__dirname, 'web-client')));

// --- MCP Client Setup ---
async function connectMcpClient() {
  console.log('Attempting to connect to Bible MCP server...');
  mcpTransport = new StdioClientTransport({
    command: BIBLE_SERVER_COMMAND,
    args: BIBLE_SERVER_ARGS,
  });

  mcpClient = new Client(
    { name: 'bible-web-proxy', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } }
  );

  try {
    await mcpClient.connect(mcpTransport);
    console.log('Successfully connected to Bible MCP server.');

    if (mcpTransport) {
      mcpTransport.onclose = () => {
        console.error('Bible MCP server disconnected.');
        mcpClient = null;
        mcpTransport = null;
      };
    }
  } catch (error) {
    console.error('Failed to connect to Bible MCP server:', error);
    mcpClient = null;
    mcpTransport = null;
  }
}

// --- WebSocket Server Setup ---
wss.on('connection', (ws) => {
  console.log('Web client connected');

  ws.on('message', async (message) => {
    console.log('Received from web client:', message.toString());
    if (!mcpClient) {
      ws.send(JSON.stringify({ type: 'error', message: 'Not connected to Bible MCP server.' }));
      return;
    }

    try {
      const request = JSON.parse(message.toString());
      if (request.type === 'callTool') {
        let result;
        if (request.toolName === 'getEnglishText') {
          result = await mcpClient.callTool({
            name: 'getEnglishText',
            arguments: { reference: request.reference },
          });
          ws.send(JSON.stringify({ type: 'toolResult', toolName: 'getEnglishText', result }));
        } else if (request.toolName === 'searchText') {
          result = await mcpClient.callTool({
            name: 'searchText',
            arguments: {
              query: request.query,
              ...(request.version && { version: request.version }),
              ...(request.limit !== undefined && { limit: request.limit }), // Pass limit if provided
              ...(request.offset !== undefined && { offset: request.offset }), // Pass offset if provided
            },
          });
          ws.send(JSON.stringify({ type: 'toolResult', toolName: 'searchText', result }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: `Unsupported tool: ${request.toolName}` }));
        }
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid request type.' }));
      }
    } catch (error: any) {
      console.error('Error processing request or calling tool:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message || 'Failed to process request.' }));
    }
  });

  ws.on('close', () => {
    console.log('Web client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  if (!mcpClient) {
    ws.send(JSON.stringify({ type: 'status', connected: false, message: 'Connecting to Bible server...' }));
    if (!mcpTransport) connectMcpClient();
  } else {
    ws.send(JSON.stringify({ type: 'status', connected: true }));
  }
});

// --- Start Server ---
server.listen(PORT, async () => {
  console.log(`Web UI server running on http://localhost:${PORT}`);
  await connectMcpClient(); // Initial connection attempt
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (mcpTransport) {
    await mcpTransport.close();
  }
  wss.close();
  server.close();
  process.exit(0);
});