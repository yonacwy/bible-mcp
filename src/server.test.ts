import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Bible MCP Server Tests", () => {
  let client: Client;
  let serverProcess: any;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Start the server as a child process
    const serverPath = path.resolve(__dirname, "server.ts");

    // Use the command and args format instead of direct stdio pipes
    transport = new StdioClientTransport({
      command: "node",
      args: ["--loader", "ts-node/esm", serverPath],
    });

    // Create and connect the client
    client = new Client(
      {
        name: "bible-mcp-test-client",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    // Properly close the transport, which will terminate the child process
    if (transport) {
      await transport.close();
    }
  });

  describe("Tool: getEnglishText", () => {
    it("should return valid Bible text for John 3:16", async () => {
      const result = await client.callTool({
        name: "getEnglishText",
        arguments: {
          reference: "John 3:16",
        },
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const text = result.content[0].text;
      expect(text).toEqual(
        "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.",
      );
    });

    it("should return error for invalid reference", async () => {
      const result = await client.callTool({
        name: "getEnglishText",
        arguments: {
          reference: "Invalid 99:99",
        },
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Invalid Bible reference");
    });

    it("should accept abbreviated book names", async () => {
      const result = await client.callTool({
        name: "getEnglishText",
        arguments: {
          reference: "Gen 1:1",
        },
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("In the beginning");
    });
  });

  describe("Tool: searchText", () => {
    it("should handle text search requests", async () => {
      const result = await client.callTool({
        name: "searchText",
        arguments: {
          query: "wisdom",
        },
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Implementation pending");
    });
  });

  describe("Tool Documentation", () => {
    it("should list all available tools with their documentation", async () => {
      // Get the list of all tools from the server
      const toolList = await client.listTools();

      // Log the full tool list for inspection
      // console.log("Available Tools:", JSON.stringify(toolList, null, 2));

      // Verify we have the expected tools
      expect(toolList).toBeDefined();
      expect(toolList.tools.length).toBeGreaterThan(0);

      // Find the getEnglishText tool
      const getEnglishTextTool = toolList.tools.find(
        (tool) => tool.name === "getEnglishText",
      );
      expect(getEnglishTextTool).toBeDefined();

      // Verify description is now present (we've fixed the tool registration)
      expect(getEnglishTextTool?.description).toBe(
        "Get English Bible text for a given verse reference",
      );

      // Check the parameter definition
      const referenceParam =
        getEnglishTextTool?.inputSchema.properties?.reference;
      expect(referenceParam).toBeDefined();
      expect(referenceParam?.type).toBe("string");
      expect(referenceParam?.description).toContain("Bible verse reference");

      // Find the searchText tool
      const searchTextTool = toolList.tools.find(
        (tool) => tool.name === "searchText",
      );
      expect(searchTextTool).toBeDefined();
      expect(searchTextTool?.description).toBe("Search for text in the Bible");

      // Check searchText parameters
      const queryParam = searchTextTool?.inputSchema.properties?.query;
      expect(queryParam).toBeDefined();
      expect(queryParam?.description).toContain("Text to search for");

      // Check the optional version parameter
      const versionParam = searchTextTool?.inputSchema.properties?.version;
      expect(versionParam).toBeDefined();
      expect(versionParam?.type).toBe("string");
      expect(versionParam?.description).toContain("Bible version");
    });
  });
});
