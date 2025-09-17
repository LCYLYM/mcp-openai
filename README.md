# MCP OpenAI Server

A Model Context Protocol (MCP) server that lets you seamlessly use OpenAI's models right from Claude.

# MCP OpenAI Server

A comprehensive Model Context Protocol (MCP) server that provides full access to OpenAI's API capabilities, including chat completions, embeddings, moderations, and more.

## Features

- **Complete OpenAI API Support**: Full chat completions with all parameters
- **Streaming Support**: Real-time streaming responses (collected and returned as complete text due to MCP limitations)
- **Function Calling**: Complete support for OpenAI's function/tool calling
- **Multiple Models**: Support for all major OpenAI models including:
  - GPT-4o and GPT-4o Mini
  - GPT-4 Turbo and GPT-4
  - GPT-3.5 Turbo
  - o1-preview and o1-mini
  - GPT-4 Vision Preview
- **Advanced Parameters**: Temperature, max_tokens, top_p, frequency_penalty, presence_penalty, stop sequences, and more
- **Response Formats**: Support for JSON mode and structured outputs
- **Embeddings**: Create embeddings with text-embedding-3-small, text-embedding-3-large, and ada-002
- **Content Moderation**: Check content against OpenAI's usage policies
- **Model Management**: List and inspect available models
- **Flexible Configuration**: Support for custom base URLs, organizations, and projects
- **Concurrent Operations**: Background processing support for multiple simultaneous requests
- **Comprehensive Error Handling**: Detailed error reporting and recovery

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
        "OPENAI_API_KEY": "your-api-key-here",
        "OPENAI_BASE_URL": "https://api.openai.com/v1",
        "OPENAI_ORGANIZATION": "your-org-id-here",
        "OPENAI_PROJECT": "your-project-id-here"
      }
    }
  }
}
```

### Environment Variables

- `OPENAI_API_KEY` (required): Your OpenAI API key
- `OPENAI_BASE_URL` (optional): Custom base URL for API calls (useful for proxies/mirrors)
- `OPENAI_ORGANIZATION` (optional): Your OpenAI organization ID
- `OPENAI_PROJECT` (optional): Your OpenAI project ID

## Usage

The server provides several tools for interacting with OpenAI's API:

### 1. Chat Completions (`openai_chat`)

Complete chat conversations with support for all OpenAI parameters:

```plaintext
Can you use GPT-4o to analyze this code with temperature 0.7 and max 500 tokens?
```

**Parameters:**
- `messages`: Array of conversation messages (required)
- `model`: Model to use (default: gpt-4o)
- `temperature`: Sampling temperature (0-2)
- `max_tokens`: Maximum tokens to generate
- `top_p`: Nucleus sampling parameter (0-1)
- `frequency_penalty`: Frequency penalty (-2 to 2)
- `presence_penalty`: Presence penalty (-2 to 2)
- `stop`: Stop sequences (string or array)
- `stream`: Enable streaming (true/false)
- `tools`: Available functions for the model to call
- `tool_choice`: Tool selection strategy
- `response_format`: Output format (text or json_object)
- `seed`: Random seed for deterministic outputs
- `logit_bias`: Token probability adjustments
- `user`: End-user identifier

### 2. Embeddings (`openai_embeddings`)

Create embeddings for text:

```plaintext
Generate embeddings for this text using text-embedding-3-large
```

**Parameters:**
- `input`: Text to embed (string or array)
- `model`: Embedding model (text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002)
- `encoding_format`: Output format (float or base64)
- `dimensions`: Number of dimensions (for text-embedding-3 models)
- `user`: End-user identifier

### 3. Content Moderation (`openai_moderations`)

Check content for policy violations:

```plaintext
Check if this content violates OpenAI's policies
```

**Parameters:**
- `input`: Content to moderate (string or array)
- `model`: Moderation model (text-moderation-latest, text-moderation-stable)

### 4. Model Information (`openai_models`)

List available models or get model details:

```plaintext
Show me all available OpenAI models
```

**Parameters:**
- `model_id`: Specific model to get details for (optional)

## Function Calling Example

You can use the chat completion tool with function calling:

```json
{
  "messages": [{"role": "user", "content": "What's the weather like?"}],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get current weather",
      "parameters": {
        "type": "object",
        "properties": {
          "location": {"type": "string"}
        }
      }
    }
  }],
  "tool_choice": "auto"
}
```

## Streaming Support

Enable streaming for real-time responses:

```json
{
  "messages": [{"role": "user", "content": "Write a story"}],
  "stream": true,
  "model": "gpt-4o"
}
```

Note: Due to MCP protocol limitations, streaming responses are collected and returned as complete text, but the server does process them in streaming mode internally.

## Mirror/Proxy Support

To use alternative API endpoints or proxies, set the `OPENAI_BASE_URL` environment variable:

```json
{
  "mcpServers": {
    "mcp-openai": {
      "command": "npx",
      "args": ["-y", "@mzxrai/mcp-openai@latest"],
      "env": {
        "OPENAI_API_KEY": "your-api-key",
        "OPENAI_BASE_URL": "https://your-proxy.com/v1"
      }
    }
  }
}
```

## Concurrent Operations

The server supports multiple simultaneous requests and handles them concurrently in the background. Each tool call is processed independently, allowing for efficient parallel operations.

## Error Handling

The server provides detailed error messages for:
- Invalid API keys
- Network connectivity issues
- Rate limiting
- Invalid parameters
- Model availability
- Content policy violations

## Problems

If you encounter issues, check Claude Desktop's MCP logs:

```bash
tail -n 20 -f ~/Library/Logs/Claude/mcp*.log
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch for changes
npm run watch

# Run in development mode
npm run dev
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