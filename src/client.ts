import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

async function main() {
  console.log("Connecting to Bible MCP server...");
  const transport = new StdioClientTransport({
    command: "tsx",
    args: ["src/server.ts"],
  });

  const client = new Client(
    {
      name: "bible-mcp-chat-client",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  try {
    await client.connect(transport);
    console.log("Connected successfully!");

    const rl = readline.createInterface({ input, output });

    while (true) {
      const reference = await rl.question(
        'Enter Bible reference (e.g., John 3:16) or type "exit" to quit: '
      );

      if (reference.toLowerCase() === "exit" || reference.toLowerCase() === "quit") {
        break;
      }

      try {
        const result = await client.callTool({
          name: "getEnglishText",
          arguments: {
            reference: reference,
          },
        });

        // Assuming the result structure based on previous interactions
        if (result && result.content && Array.isArray(result.content) && result.content[0]?.type === 'text') {
            console.log(`\n${result.content[0].text}\n`);
        } else {
            console.log("\nReceived unexpected result format:", JSON.stringify(result, null, 2), "\n");
        }

      } catch (error: any) {
        console.error("\nError calling tool:", error.message || error, "\n");
      }
    }

    rl.close();

  } catch (error) {
    console.error("Failed to connect to server:", error);
  } finally {
    console.log("Disconnecting...");
    await transport.close();
    console.log("Disconnected.");
  }
}

main().catch(console.error);