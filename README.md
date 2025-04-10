# Bible MCP

An MCP server that provides scripture text to LLMs via the _Model Context Protocol_.

## Overview

Bible MCP is a tool that allows Large Language Models (LLMs) to access and query scripture text in multiple languages. It uses the Model Context Protocol (MCP) to standardize how the LLM interacts with biblical texts.

## Features

- Query Bible verses by reference (book, chapter, verse)
- Access original language texts (Hebrew, Greek) and English translations
- Retrieve multiple verses or entire passages
- Compare translations side by side

## Data Sources

- Greek New Testament (SBLGNT)
- Hebrew Old Testament
- Berean Standard Bible (English translation)

## Development

See [CLAUDE.md](./CLAUDE.md) for development guidelines and commands.

## Build

- `npm run build`
- `docker build -t bible-mcp .`
- `docker run -i bible-mcp`


# Bible MCP Client/Server Testing

## Overview

Run from different consoles server then client from same project folder.

Server
- `npm install express ws @types/express @types/ws`
- `npm run dev`

Client
- `npm run dev:web`