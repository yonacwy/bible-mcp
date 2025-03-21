# CLAUDE.md - Guidelines for Bible MCP

## Project Overview
Bible MCP is an MCP server providing scripture text to LLMs via the Model Context Protocol.

## Development Commands
```
# Install dependencies
npm install

# Start development server
node index.js
```

## Code Style Guidelines
- Use ES Modules syntax (import/export)
- TypeScript preferred for new files
- Follow existing patterns from MCP SDK examples
- Use async/await for asynchronous operations
- Error handling: catch and handle errors appropriately

## Project Structure
- `/data` - Contains Bible text data in TSV format
- `/doc` - Documentation files

## Tech Stack
- Node.js
- @modelcontextprotocol/sdk - Core MCP functionality
- better-sqlite3 - Database integration