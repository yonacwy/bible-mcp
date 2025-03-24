# CLAUDE.md - Guidelines for Bible MCP

## Project Overview

Bible MCP is an MCP server providing scripture text to LLMs via the Model Context Protocol.

## Project Plan

1. Create SQLite database with Bible text tables

   - Import TSV data files into structured tables
   - Combine OT/NT BSB into unified Bible table with references
   - Create tables for original languages with linked references

2. Implement MCP server with Bible tools

   - `getEnglishText` - Get English verse text by reference
   - `getSourceText` - Get original language text (Hebrew/Greek)
   - `getPassage` - Get multiple consecutive verses
   - `searchText` - Search for text across the Bible

3. Support common verse reference formats
   - Standard formats: "John 3:16", "Genesis 1:1-3"
   - Abbreviations: "Rom 8:28", "Gen 1:1"

## Development Commands

```
# Install dependencies
npm install

# Import data and create SQLite DB
node scripts/create-db.js

# Run MCP server with stdio transport
node src/server.js

# Test with MCP Inspector
npx @modelcontextprotocol/inspector
```

## Code Style Guidelines

- Use ES Modules syntax (import/export)
- TypeScript preferred for new files
- Follow existing patterns from MCP SDK examples
- Use async/await for asynchronous operations
- Error handling: catch and handle errors appropriately
- All verse (aka BCV) refernce handling lives in `src/utils/referenceUtils.ts`
- All book name abbreviations and number => name mapping should use `src/BibleLookup.json`

## Project Structure

- `/data` - Contains Bible text data in TSV format
- `/doc` - Documentation files
- `/src` - Source code
  - `/db` - Database setup and queries
  - `/server` - MCP server implementation
  - `/utils` - Utility functions (reference parsing, etc.)
- `/scripts` - Database creation and utility scripts

## MCP Implementation

- Use `StdioServerTransport` for direct LLM integration
- Implement tools with zod schema validation
- Define resources for Bible content access
- No HTTP server required - MCP works via direct transport
