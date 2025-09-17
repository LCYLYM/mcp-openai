#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
    McpError,
    ErrorCode,
    TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Initialize OpenAI client configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL; // Support for custom base URLs (mirrors, etc.)
const OPENAI_TIMEOUT = process.env.OPENAI_TIMEOUT ? parseInt(process.env.OPENAI_TIMEOUT) : 60000;

if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
}

// Initialize OpenAI client with enhanced configuration
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    baseURL: OPENAI_BASE_URL, // Allow custom base URL for mirror services
    timeout: OPENAI_TIMEOUT,  // Configurable timeout
});

// Define supported models - expanded list
const SUPPORTED_MODELS = [
    "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo",
    "o1-preview", "o1-mini", "gpt-4-turbo-preview", "gpt-4-0125-preview",
    "gpt-4-1106-preview", "gpt-3.5-turbo-0125"
] as const;
const DEFAULT_MODEL = "gpt-4o" as const;
type SupportedModel = typeof SUPPORTED_MODELS[number];

// Define available tools with comprehensive OpenAI API support
const TOOLS: Tool[] = [
    {
        name: "openai_chat",
        description: `Advanced OpenAI chat completion with full API support including streaming, function calling, and comprehensive parameters. Supports models: ${SUPPORTED_MODELS.join(", ")}.`,
        inputSchema: {
            type: "object",
            properties: {
                messages: {
                    type: "array",
                    description: "Array of messages in OpenAI format",
                    items: {
                        type: "object",
                        properties: {
                            role: {
                                type: "string",
                                enum: ["system", "user", "assistant", "tool", "function"],
                                description: "Role of the message sender"
                            },
                            content: {
                                type: ["string", "null"],
                                description: "Content of the message (can be null for tool calls)"
                            },
                            name: {
                                type: "string",
                                description: "Name of the function (for function calls)"
                            },
                            tool_calls: {
                                type: "array",
                                description: "Tool calls made by the assistant",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        type: { type: "string", enum: ["function"] },
                                        function: {
                                            type: "object",
                                            properties: {
                                                name: { type: "string" },
                                                arguments: { type: "string" }
                                            }
                                        }
                                    }
                                }
                            },
                            tool_call_id: {
                                type: "string",
                                description: "Tool call ID (for tool responses)"
                            }
                        },
                        required: ["role"]
                    }
                },
                model: {
                    type: "string",
                    enum: SUPPORTED_MODELS,
                    description: `Model to use for completion`,
                    default: DEFAULT_MODEL
                },
                temperature: {
                    type: "number",
                    minimum: 0,
                    maximum: 2,
                    description: "Sampling temperature (0-2)"
                },
                max_tokens: {
                    type: "integer",
                    minimum: 1,
                    description: "Maximum number of tokens to generate"
                },
                top_p: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Nucleus sampling parameter"
                },
                frequency_penalty: {
                    type: "number",
                    minimum: -2,
                    maximum: 2,
                    description: "Frequency penalty (-2 to 2)"
                },
                presence_penalty: {
                    type: "number",
                    minimum: -2,
                    maximum: 2,
                    description: "Presence penalty (-2 to 2)"
                },
                stop: {
                    type: ["string", "array"],
                    description: "Stop sequences (string or array of strings)"
                },
                stream: {
                    type: "boolean",
                    description: "Enable streaming response",
                    default: false
                },
                tools: {
                    type: "array",
                    description: "Available tools/functions for the model to call",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["function"] },
                            function: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    description: { type: "string" },
                                    parameters: { type: "object" }
                                }
                            }
                        }
                    }
                },
                tool_choice: {
                    type: ["string", "object"],
                    description: "Tool choice strategy"
                },
                response_format: {
                    type: "object",
                    description: "Response format specification",
                    properties: {
                        type: { type: "string", enum: ["text", "json_object"] }
                    }
                },
                seed: {
                    type: "integer",
                    description: "Random seed for reproducible outputs"
                },
                user: {
                    type: "string",
                    description: "User identifier for tracking"
                }
            },
            required: ["messages"]
        }
    },
    {
        name: "openai_batch_chat",
        description: `Execute multiple OpenAI chat requests concurrently for improved performance. All requests are processed in parallel.`,
        inputSchema: {
            type: "object",
            properties: {
                requests: {
                    type: "array",
                    description: "Array of chat requests to process concurrently",
                    items: {
                        type: "object",
                        properties: {
                            id: {
                                type: "string",
                                description: "Unique identifier for this request"
                            },
                            messages: {
                                type: "array",
                                description: "Array of messages for this request"
                            },
                            model: {
                                type: "string",
                                enum: SUPPORTED_MODELS,
                                description: "Model to use for this request"
                            },
                            temperature: { type: "number", minimum: 0, maximum: 2 },
                            max_tokens: { type: "integer", minimum: 1 },
                            top_p: { type: "number", minimum: 0, maximum: 1 }
                        },
                        required: ["id", "messages"]
                    }
                },
                max_concurrent: {
                    type: "integer",
                    minimum: 1,
                    maximum: 10,
                    description: "Maximum number of concurrent requests (1-10)",
                    default: 3
                }
            },
            required: ["requests"]
        }
    }
];

// Initialize MCP server
const server = new Server(
    {
        name: "mcp-openai",
        version: "0.1.1",
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

// Register handler for tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
}));

// Type definitions for enhanced functionality
interface OpenAIChatArguments {
    messages: Array<{
        role: "system" | "user" | "assistant" | "tool" | "function";
        content?: string | null;
        name?: string;
        tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
        }>;
        tool_call_id?: string;
    }>;
    model?: SupportedModel;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string | string[];
    stream?: boolean;
    tools?: Array<{
        type: "function";
        function: {
            name: string;
            description: string;
            parameters: object;
        };
    }>;
    tool_choice?: string | object;
    response_format?: { type: "text" | "json_object" };
    seed?: number;
    user?: string;
}

// Register handler for tool execution with comprehensive OpenAI API support
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<{
    content: TextContent[];
    isError?: boolean;
}> => {
    switch (request.params.name) {
        case "openai_chat": {
            try {
                const args = request.params.arguments as unknown as OpenAIChatArguments;

                // Validate model
                const model = args.model || DEFAULT_MODEL;
                if (!SUPPORTED_MODELS.includes(model)) {
                    throw new Error(`Unsupported model: ${model}. Must be one of: ${SUPPORTED_MODELS.join(", ")}`);
                }

                // Prepare OpenAI request parameters
                const openaiParams: any = {
                    messages: args.messages,
                    model: model,
                };

                // Add optional parameters if provided
                if (args.temperature !== undefined) openaiParams.temperature = args.temperature;
                if (args.max_tokens !== undefined) openaiParams.max_tokens = args.max_tokens;
                if (args.top_p !== undefined) openaiParams.top_p = args.top_p;
                if (args.frequency_penalty !== undefined) openaiParams.frequency_penalty = args.frequency_penalty;
                if (args.presence_penalty !== undefined) openaiParams.presence_penalty = args.presence_penalty;
                if (args.stop !== undefined) openaiParams.stop = args.stop;
                if (args.tools !== undefined) openaiParams.tools = args.tools;
                if (args.tool_choice !== undefined) openaiParams.tool_choice = args.tool_choice;
                if (args.response_format !== undefined) openaiParams.response_format = args.response_format;
                if (args.seed !== undefined) openaiParams.seed = args.seed;
                if (args.user !== undefined) openaiParams.user = args.user;

                // Handle streaming vs non-streaming requests
                if (args.stream) {
                    // For streaming, we'll collect all chunks and return the complete response
                    // This maintains compatibility with MCP while supporting streaming internally
                    const stream = await openai.chat.completions.create({
                        ...openaiParams,
                        stream: true,
                    }) as any; // Type assertion for streaming response

                    let content = "";
                    let toolCalls: any[] = [];
                    let finishReason = "";

                    for await (const chunk of stream) {
                        const delta = chunk.choices?.[0]?.delta;
                        if (delta?.content) {
                            content += delta.content;
                        }
                        if (delta?.tool_calls) {
                            // Handle tool calls in streaming mode
                            for (const toolCallDelta of delta.tool_calls) {
                                if (!toolCalls[toolCallDelta.index!]) {
                                    toolCalls[toolCallDelta.index!] = {
                                        id: toolCallDelta.id,
                                        type: "function",
                                        function: { name: "", arguments: "" }
                                    };
                                }
                                if (toolCallDelta.function?.name) {
                                    toolCalls[toolCallDelta.index!].function.name += toolCallDelta.function.name;
                                }
                                if (toolCallDelta.function?.arguments) {
                                    toolCalls[toolCallDelta.index!].function.arguments += toolCallDelta.function.arguments;
                                }
                            }
                        }
                        if (chunk.choices?.[0]?.finish_reason) {
                            finishReason = chunk.choices[0].finish_reason;
                        }
                    }

                    // Format response with tool calls if present
                    if (toolCalls.length > 0) {
                        const responseData = {
                            content: content || null,
                            tool_calls: toolCalls,
                            finish_reason: finishReason
                        };
                        return {
                            content: [{
                                type: "text",
                                text: `Assistant response (streaming):\n${JSON.stringify(responseData, null, 2)}`
                            }]
                        };
                    } else {
                        return {
                            content: [{
                                type: "text",
                                text: content || "No response received"
                            }]
                        };
                    }
                } else {
                    // Non-streaming request
                    const completion = await openai.chat.completions.create(openaiParams);
                    const choice = completion.choices[0];
                    
                    if (!choice) {
                        throw new Error("No response received from OpenAI");
                    }

                    // Handle different response types
                    if (choice.message.tool_calls) {
                        // Response includes tool calls
                        const responseData = {
                            content: choice.message.content,
                            tool_calls: choice.message.tool_calls,
                            finish_reason: choice.finish_reason,
                            usage: completion.usage
                        };
                        return {
                            content: [{
                                type: "text",
                                text: `Assistant response with tool calls:\n${JSON.stringify(responseData, null, 2)}`
                            }]
                        };
                    } else {
                        // Regular text response
                        return {
                            content: [{
                                type: "text",
                                text: choice.message.content || "No response received"
                            }]
                        };
                    }
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `OpenAI API error: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
        case "openai_batch_chat": {
            try {
                const args = request.params.arguments as {
                    requests: Array<{
                        id: string;
                        messages: any[];
                        model?: SupportedModel;
                        temperature?: number;
                        max_tokens?: number;
                        top_p?: number;
                    }>;
                    max_concurrent?: number;
                };

                const maxConcurrent = args.max_concurrent || 3;
                const requests = args.requests;

                if (!requests || requests.length === 0) {
                    throw new Error("No requests provided");
                }

                // Process requests in batches with concurrency limit
                const results = [];
                for (let i = 0; i < requests.length; i += maxConcurrent) {
                    const batch = requests.slice(i, i + maxConcurrent);
                    const batchPromises = batch.map(async (req) => {
                        try {
                            const model = req.model || DEFAULT_MODEL;
                            if (!SUPPORTED_MODELS.includes(model)) {
                                throw new Error(`Unsupported model: ${model}`);
                            }

                            const openaiParams: any = {
                                messages: req.messages,
                                model: model,
                            };

                            if (req.temperature !== undefined) openaiParams.temperature = req.temperature;
                            if (req.max_tokens !== undefined) openaiParams.max_tokens = req.max_tokens;
                            if (req.top_p !== undefined) openaiParams.top_p = req.top_p;

                            const completion = await openai.chat.completions.create(openaiParams);
                            const choice = completion.choices[0];

                            return {
                                id: req.id,
                                success: true,
                                response: {
                                    content: choice?.message?.content || "No response received",
                                    tool_calls: choice?.message?.tool_calls || null,
                                    finish_reason: choice?.finish_reason,
                                    usage: completion.usage
                                }
                            };
                        } catch (error) {
                            return {
                                id: req.id,
                                success: false,
                                error: error instanceof Error ? error.message : String(error)
                            };
                        }
                    });

                    const batchResults = await Promise.all(batchPromises);
                    results.push(...batchResults);
                }

                return {
                    content: [{
                        type: "text",
                        text: `Batch processing complete:\n${JSON.stringify(results, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `Batch processing error: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
        default:
            throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown tool: ${request.params.name}`
            );
    }
});

// Initialize MCP server connection using stdio transport
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});