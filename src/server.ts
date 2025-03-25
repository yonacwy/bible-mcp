import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getEnglishText } from "./db/database.js";
import { parseReference } from "./utils/referenceUtils.js";
import { z } from "zod";

// Create an MCP server with capabilities
const server = new McpServer({
  name: "Bible MCP",
  version: "1.0.0",
}, {
  capabilities: {
    resources: {},
    tools: {
      getEnglishText: {
        description: "Get English Bible text for a given verse reference",
        inputSchema: {
          reference: {
            type: "string",
            description: "Bible verse reference (e.g., 'John 3:16', 'Gen 1:1', 'Rom 8:28')"
          }
        }
      },
      searchText: {
        description: "Search for text in the Bible",
        inputSchema: {
          query: {
            type: "string",
            description: "Text to search for in the Bible"
          },
          version: {
            type: "string",
            description: "Bible version (default: BSB)",
            optional: true
          }
        }
      }
    }
  }
});

// Add a dynamic getEnglishText resource
server.resource(
  "getEnglishText",
  new ResourceTemplate(
    "bible://{language}/{bookName}/{chapterNum}/{verseNum}",
    { list: undefined },
  ),
  async (uri: any, { language, bookName, chapterNum, verseNum }) => {
    const parsedBookName = bookName[0] ?? bookName;
    const parsedChapterNum = parseInt(chapterNum[0] ?? chapterNum);
    const parsedVerseNum = parseInt(verseNum[0] ?? verseNum);
    
    const reference = parseReference(`${parsedBookName} ${parsedChapterNum}:${parsedVerseNum}`);
    
    if (!reference) {
      return {
        contents: [
          {
            uri: uri.href,
            text: "Invalid reference",
          },
        ],
      };
    }
    
    const text = getEnglishText(reference);
    
    return {
      contents: [
        {
          uri: uri.href,
          text: text || `No text found for ${parsedBookName} ${parsedChapterNum}:${parsedVerseNum}`,
        },
      ],
    };
  },
);

// Tool for getting English text from a Bible verse reference
server.tool("getEnglishText", 
  { 
    reference: z.string().describe("Bible verse reference (e.g., 'John 3:16', 'Gen 1:1', 'Rom 8:28')")
  }, 
  async ({ reference }) => {
    const parsedReference = parseReference(reference);
    
    if (!parsedReference) {
      return {
        content: [
          { 
            type: "text", 
            text: `Invalid Bible reference: "${reference}". Please use a format like "John 3:16" or "Genesis 1:1".` 
          }
        ],
      };
    }
    
    const text = getEnglishText(parsedReference);
    
    if (!text) {
      return {
        content: [
          { 
            type: "text", 
            text: `No text found for reference: "${reference}".` 
          }
        ],
      };
    }
    
    return {
      content: [
        { 
          type: "text", 
          text: text
        }
      ],
    };
  }
);

// Example tool for searching Bible text
server.tool("searchText", 
  { 
    query: z.string().describe("Text to search for in the Bible"),
    version: z.string().optional().describe("Bible version (default: BSB)")
  }, 
  async ({ query, version = "BSB" }) => {
    // Placeholder - implement actual search functionality
    return {
      content: [
        { 
          type: "text", 
          text: `Search results for "${query}" in ${version}: [Implementation pending]` 
        }
      ],
    };
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
