import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getEnglishText } from "./db/database.js";
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
        // Adding examples to the response for better client understanding
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
      // Adding examples to successful responses as well
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

// Example tool for searching Bible text
// server.tool(
//   "searchText",
//   "Search for text in the Bible", // Add description as second parameter
//   {
//     query: z.string().describe("Text to search for in the Bible"),
//     version: z.string().optional().describe("Bible version (default: BSB)"),
//   },
//   async ({ query, version = "BSB" }) => {
//     // Placeholder - implement actual search functionality
//     return {
//       content: [
//         {
//           type: "text",
//           text: `Search results for "${query}" in ${version}: [Implementation pending]`,
//         },
//       ],
//       // Adding examples to the response metadata
//       examples: [
//         {
//           name: "Search for 'wisdom'",
//           arguments: {
//             query: "wisdom",
//           },
//         },
//         {
//           name: "Search with specific version",
//           arguments: {
//             query: "love",
//             version: "BSB",
//           },
//         },
//       ],
//     };
//   },
// );

// Resources and prompts are automatically handled by the McpServer
// Based on what we registered using server.resource() and server.prompt()

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
