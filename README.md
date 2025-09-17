# MCP OpenAI Server

A comprehensive Model Context Protocol (MCP) server that provides full OpenAI API integration including streaming, function calling, and advanced parameters support.

## Features

- **Complete OpenAI API support** with all conversation and function calling capabilities
- **Streaming responses** for real-time interaction
- **Function/Tool calling** with comprehensive tool management
- **Concurrent request processing** for improved performance
- **Custom base URL support** for mirror services and alternative endpoints
- **Comprehensive parameter support** including temperature, max_tokens, top_p, penalties, etc.
- **Multiple model support** including:
  - gpt-4o, gpt-4o-mini
  - gpt-4-turbo, gpt-4, gpt-3.5-turbo
  - o1-preview, o1-mini
  - All recent OpenAI model variants

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18 (includes `npm` and `npx`)
- [Claude Desktop app](https://claude.ai/download)
- [OpenAI API key](https://platform.openai.com/api-keys)

## Installation

First, make sure you've got the [Claude Desktop app](https://claude.ai/download) installed and you've requested an [OpenAI API key](https://platform.openai.com/api-keys).

Add this entry to your `claude_desktop_config.json` (on Mac, you'll find it at `~/Library/Application\ Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcp-openai": {
      "command": "npx",
      "args": ["-y", "@mzxrai/mcp-openai@latest"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here (get one from https://platform.openai.com/api-keys)"
      }
    }
  }
}
```

This config lets Claude Desktop fire up the OpenAI MCP server whenever you need it.

## Usage

The enhanced MCP OpenAI server provides comprehensive OpenAI API access with advanced features:

### Basic Usage

```plaintext
Can you ask o1 what it thinks about this problem?
```

```plaintext
Use gpt-4o with streaming enabled to analyze this data
```

### Advanced Features

**Streaming Responses:**
```plaintext
Use streaming mode with gpt-4o to process this large text
```

**Function Calling:**
```plaintext
Call the weather function using gpt-4o with these tools: [weather tool definition]
```

**Custom Parameters:**
```plaintext
Use gpt-4o with temperature 0.7, max_tokens 1000, and top_p 0.9
```

**Concurrent Processing:**
```plaintext
Process these 5 requests concurrently using the batch tool
```

### Available Tools

1. **`openai_chat`** - Advanced chat completion with full OpenAI API support
   - **Messages**: Full OpenAI message format including tool calls
   - **Models**: All supported OpenAI models
   - **Parameters**: temperature, max_tokens, top_p, frequency_penalty, presence_penalty, stop, stream, tools, tool_choice, response_format, seed, user
   - **Features**: Streaming, function calling, JSON mode

2. **`openai_batch_chat`** - Concurrent request processing
   - **Requests**: Array of chat requests to process simultaneously
   - **Concurrency**: Configurable concurrent request limit (1-10)
   - **Performance**: Significant speedup for multiple requests

### Supported Models

- **GPT-4 Family**: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-4-turbo-preview, gpt-4-0125-preview, gpt-4-1106-preview
- **GPT-3.5**: gpt-3.5-turbo, gpt-3.5-turbo-0125  
- **O1 Family**: o1-preview, o1-mini

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `OPENAI_BASE_URL`: Custom base URL for mirror services (optional)
- `OPENAI_TIMEOUT`: Request timeout in milliseconds (optional, default: 60000)

## Problems

This is alpha software, so may have bugs. If you have an issue, check Claude Desktop's MCP logs:

```bash
tail -n 20 -f ~/Library/Logs/Claude/mcp*.log
```

## Development

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Watch for changes
pnpm watch

# Run in development mode
pnpm dev
```

## Requirements

- Node.js >= 18
- OpenAI API key

## Verified Platforms

- [x] macOS
- [ ] Linux

## License

MIT

## Author

[mzxrai](https://github.com/mzxrai) 