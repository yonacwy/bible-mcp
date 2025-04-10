import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getEnglishText, searchText } from "./db/database.js";
import { parseReference } from "./utils/referenceUtils.js";
import { z } from "zod";

// Create an MCP server with capabilities
const server = new McpServer(
  {
    name: "Bible MCP",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {
        getEnglishText: {
          description: "Get English Bible text for a given verse reference",
          inputSchema: {
            reference: {
              type: "string",
              description:
                "Bible verse reference (e.g., 'John 3:16', 'Gen 1:1', 'Rom 8:28')",
            },
          },
        },
        searchText: {
          description: "Search for text in the Bible",
          inputSchema: {
            query: {
              type: "string",
              description: "Text to search for in the Bible",
            },
            version: {
              type: "string",
              description: "Bible version (default: BSB)",
              optional: true,
            },
            limit: {
              type: "number",
              description: "Maximum number of results per page",
              optional: true,
            },
            offset: {
              type: "number",
              description: "Offset for pagination",
              optional: true,
            },
          },
        },
      },
      prompts: {},
    },
  },
);

// Tool for getting English text from a Bible verse reference
server.tool(
  "getEnglishText",
  "Get English Bible text for a given verse reference",
  {
    reference: z
      .string()
      .describe(
        "Bible verse reference (e.g., 'John 3:16', 'Gen 1:1', 'Rom 8:28')",
      ),
  },
  async ({ reference }) => {
    const parsedReference = parseReference(reference);

    if (!parsedReference) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid Bible reference: "${reference}". Please use a format like "John 3:16" or "Genesis 1:1".`,
          },
        ],
        examples: [
          {
            name: "Get John 3:16",
            arguments: {
              reference: "John 3:16",
            },
          },
          {
            name: "Using abbreviations",
            arguments: {
              reference: "Gen 1:1",
            },
          },
        ],
      };
    }

    const text = getEnglishText(parsedReference);

    if (!text) {
      return {
        content: [
          {
            type: "text",
            text: `No text found for reference: "${reference}".`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: text,
        },
      ],
      examples: [
        {
          name: "Get John 3:16",
          arguments: {
            reference: "John 3:16",
          },
        },
        {
          name: "Using abbreviations",
          arguments: {
            reference: "Gen 1:1",
          },
        },
      ],
    };
  },
);

// Tool for searching Bible text
server.tool(
  "searchText",
  "Search for text in the Bible",
  {
    query: z.string().describe("Text to search for in the Bible"),
    version: z.string().optional().describe("Bible version (default: BSB)"),
    limit: z.number().optional().describe("Maximum number of results per page"),
    offset: z.number().optional().describe("Offset for pagination"),
  },
  async ({ query, version = "BSB", limit = 100, offset = 0 }) => {
    console.log(`[server.ts] Received search request: query="${query}", version="${version}", limit=${limit}, offset=${offset}`);
    const results = await searchText(query, undefined, undefined, limit, offset);
    console.log(`[server.ts] Returning ${results.length} results for offset ${offset}`);

    return {
      content: results.map(result => ({
        type: "text",
        text: result.text,
        reference: result.reference,
      })),
      examples: [
        {
          name: "Search for 'wisdom'",
          arguments: {
            query: "wisdom",
          },
        },
        {
          name: "Search with specific version",
          arguments: {
            query: "love",
            version: "BSB",
          },
        },
      ],
    };
  },
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
try {
  await server.connect(transport);
  console.log("MCP server connected successfully!");
} catch (error) {
  console.error("MCP server connection error:", error);
}