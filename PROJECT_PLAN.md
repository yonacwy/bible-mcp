# Bible MCP Project Plan

## Project Overview
This project aims to create an MCP (Model Context Protocol) server that provides Bible texts to LLMs, leveraging the `@modelcontextprotocol/sdk` for standardized interactions.

## Understanding MCP Server Implementation
Based on the MCP SDK documentation, the server implementation will:
- Use the `McpServer` class from `@modelcontextprotocol/sdk/server/mcp.js`
- Connect via transports like `StdioServerTransport` (not requiring a traditional HTTP server)
- Define resources and tools for Bible text access
- Allow LLMs to interact with the Biblical data in a standardized way

## Database Design

### Database Schema

1. **bible_references**
   - `id` (PRIMARY KEY)
   - `book` (TEXT) - Book name 
   - `book_number` (INTEGER) - Standard book numbering (e.g., Genesis=1, Matthew=40)
   - `chapter` (INTEGER)
   - `verse` (INTEGER)
   - `testament` (TEXT) - 'OT' or 'NT'

2. **bsb_text** (Berean Standard Bible - English)
   - `id` (PRIMARY KEY)
   - `reference_id` (FOREIGN KEY -> bible_references.id)
   - `text` (TEXT)

3. **greek_text** (SBLGNT)
   - `id` (PRIMARY KEY) 
   - `reference_id` (FOREIGN KEY -> bible_references.id)
   - `text` (TEXT)
   - Additional linguistic fields as needed

4. **hebrew_text**
   - `id` (PRIMARY KEY)
   - `reference_id` (FOREIGN KEY -> bible_references.id)
   - `text` (TEXT)
   - Additional linguistic fields as needed

## Implementation Phases

### Phase 1: Database Setup
1. Create data import scripts to process TSV files
2. Design and implement SQLite database schema
3. Create indexes for efficient querying

### Phase 2: Core MCP Server Implementation
1. Implement basic MCP server using the SDK
2. Create database access layer
3. Implement verse reference parsing utilities
4. Create core tools:
   - `getEnglishText` - Retrieve BSB verse by reference
   - `getSourceText` - Retrieve original language text

### Phase 3: Advanced Features
1. Implement passage retrieval (multiple verses)
2. Add text search capabilities
3. Create translation comparison tool
4. Add linguistic analysis features (if time permits)

## MCP Tool Definitions

### 1. `getEnglishText`
- **Input**: verse reference (e.g., "John 3:16")
- **Output**: English text from BSB translation
- **Example**:
  ```json
  {
    "reference": "John 3:16",
    "text": "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life."
  }
  ```

### 2. `getSourceText`
- **Input**: verse reference and language ("hebrew" or "greek")
- **Output**: Original language text with transliteration
- **Example**:
  ```json
  {
    "reference": "John 3:16",
    "language": "greek",
    "text": "Οὕτως γὰρ ἠγάπησεν ὁ Θεὸς τὸν κόσμον...",
    "transliteration": "Houtōs gar ēgapēsen ho Theos ton kosmon..."
  }
  ```

### 3. `getPassage`
- **Input**: passage reference (e.g., "John 3:16-21")
- **Output**: Full passage text with verse numbers
- **Example**:
  ```json
  {
    "reference": "John 3:16-18",
    "translation": "BSB",
    "verses": [
      {"number": 16, "text": "For God so loved..."},
      {"number": 17, "text": "For God did not..."},
      {"number": 18, "text": "Whoever believes..."}
    ]
  }
  ```

## Testing and Usage
- Use the MCP Inspector tool for testing (as mentioned in documentation)
- Connect directly to Claude as a tool without requiring an HTTP server
- Tests will be run using the standard MCP interaction patterns