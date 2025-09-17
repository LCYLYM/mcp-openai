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
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const OPENAI_ORGANIZATION = process.env.OPENAI_ORGANIZATION;
const OPENAI_PROJECT = process.env.OPENAI_PROJECT;

if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
}

// Initialize OpenAI client with configurable options
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    baseURL: OPENAI_BASE_URL,
    organization: OPENAI_ORGANIZATION,
    project: OPENAI_PROJECT,
    timeout: 60000, // 60 second timeout
    maxRetries: 3
});

// Define supported models
const SUPPORTED_MODELS = [
    "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo",
    "o1-preview", "o1-mini", "gpt-4-turbo-preview", "gpt-4-vision-preview"
] as const;
const DEFAULT_MODEL = "gpt-4o" as const;
type SupportedModel = typeof SUPPORTED_MODELS[number];

// Define available tools
const TOOLS: Tool[] = [
    {
        name: "openai_chat",
        description: `Complete OpenAI chat completions with support for all parameters. Supports models: ${SUPPORTED_MODELS.join(", ")}. Includes streaming, function calling, and all OpenAI API features.`,
        inputSchema: {
            type: "object",
            properties: {
                messages: {
                    type: "array",
                    description: "Array of messages to send to the API",
                    items: {
                        type: "object",
                        properties: {
                            role: {
                                type: "string",
                                enum: ["system", "user", "assistant", "tool"],
                                description: "Role of the message sender"
                            },
                            content: {
                                type: "string",
                                description: "Content of the message"
                            },
                            name: {
                                type: "string",
                                description: "Name of the function or tool (for function/tool messages)"
                            },
                            tool_call_id: {
                                type: "string",
                                description: "Tool call ID (for tool messages)"
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
                            }
                        },
                        required: ["role", "content"]
                    }
                },
                model: {
                    type: "string",
                    enum: SUPPORTED_MODELS,
                    description: `Model to use for completion (${SUPPORTED_MODELS.join(", ")})`,
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
                    description: "Frequency penalty"
                },
                presence_penalty: {
                    type: "number",
                    minimum: -2,
                    maximum: 2,
                    description: "Presence penalty"
                },
                stop: {
                    oneOf: [
                        { type: "string" },
                        { type: "array", items: { type: "string" }, maxItems: 4 }
                    ],
                    description: "Stop sequences"
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
                                },
                                required: ["name"]
                            }
                        },
                        required: ["type", "function"]
                    }
                },
                tool_choice: {
                    oneOf: [
                        { type: "string", enum: ["none", "auto"] },
                        {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["function"] },
                                function: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string" }
                                    },
                                    required: ["name"]
                                }
                            }
                        }
                    ],
                    description: "Tool choice strategy"
                },
                response_format: {
                    type: "object",
                    properties: {
                        type: { 
                            type: "string", 
                            enum: ["text", "json_object"] 
                        }
                    },
                    description: "Response format specification"
                },
                seed: {
                    type: "integer",
                    description: "Random seed for deterministic outputs"
                },
                logit_bias: {
                    type: "object",
                    description: "Logit bias adjustments"
                },
                user: {
                    type: "string",
                    description: "Unique identifier for the end-user"
                }
            },
            required: ["messages"]
        }
    },
    {
        name: "openai_models",
        description: "List available OpenAI models or get details about a specific model",
        inputSchema: {
            type: "object",
            properties: {
                model_id: {
                    type: "string",
                    description: "Specific model ID to get details for (optional)"
                }
            }
        }
    },
    {
        name: "openai_embeddings",
        description: "Create embeddings using OpenAI's embedding models",
        inputSchema: {
            type: "object",
            properties: {
                input: {
                    oneOf: [
                        { type: "string" },
                        { type: "array", items: { type: "string" } }
                    ],
                    description: "Text to embed"
                },
                model: {
                    type: "string",
                    enum: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
                    default: "text-embedding-3-small",
                    description: "Embedding model to use"
                },
                encoding_format: {
                    type: "string",
                    enum: ["float", "base64"],
                    default: "float",
                    description: "Encoding format for embeddings"
                },
                dimensions: {
                    type: "integer",
                    description: "Number of dimensions for the embedding (text-embedding-3 models only)"
                },
                user: {
                    type: "string",
                    description: "Unique identifier for the end-user"
                }
            },
            required: ["input"]
        }
    },
    {
        name: "openai_moderations",
        description: "Check content against OpenAI's usage policies",
        inputSchema: {
            type: "object",
            properties: {
                input: {
                    oneOf: [
                        { type: "string" },
                        { type: "array", items: { type: "string" } }
                    ],
                    description: "Content to moderate"
                },
                model: {
                    type: "string",
                    enum: ["text-moderation-latest", "text-moderation-stable"],
                    default: "text-moderation-latest",
                    description: "Moderation model to use"
                }
            },
            required: ["input"]
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

// Register handler for tool execution
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<{
    content: TextContent[];
    isError?: boolean;
}> => {
    switch (request.params.name) {
        case "openai_chat": {
            try {
                // Parse request arguments with full OpenAI API support
                const args = request.params.arguments as {
                    messages: Array<any>;
                    model?: SupportedModel;
                    temperature?: number;
                    max_tokens?: number;
                    top_p?: number;
                    frequency_penalty?: number;
                    presence_penalty?: number;
                    stop?: string | string[];
                    stream?: boolean;
                    tools?: Array<any>;
                    tool_choice?: string | object;
                    response_format?: { type: "text" | "json_object" };
                    seed?: number;
                    logit_bias?: Record<string, number>;
                    user?: string;
                };

                // Use default model if not specified
                const model = args.model || DEFAULT_MODEL;

                // Validate model
                if (!SUPPORTED_MODELS.includes(model as SupportedModel)) {
                    throw new Error(`Unsupported model: ${model}. Must be one of: ${SUPPORTED_MODELS.join(", ")}`);
                }

                // Validate and convert messages to OpenAI's expected format
                const messages: ChatCompletionMessageParam[] = args.messages.map(msg => {
                    const baseMessage: any = {
                        role: msg.role,
                        content: msg.content
                    };

                    // Add optional fields if present
                    if (msg.name) baseMessage.name = msg.name;
                    if (msg.tool_call_id) baseMessage.tool_call_id = msg.tool_call_id;
                    if (msg.tool_calls) baseMessage.tool_calls = msg.tool_calls;

                    return baseMessage;
                });

                // Build request parameters
                const requestParams: any = {
                    messages,
                    model,
                };

                // Add optional parameters if specified
                if (args.temperature !== undefined) requestParams.temperature = args.temperature;
                if (args.max_tokens !== undefined) requestParams.max_tokens = args.max_tokens;
                if (args.top_p !== undefined) requestParams.top_p = args.top_p;
                if (args.frequency_penalty !== undefined) requestParams.frequency_penalty = args.frequency_penalty;
                if (args.presence_penalty !== undefined) requestParams.presence_penalty = args.presence_penalty;
                if (args.stop !== undefined) requestParams.stop = args.stop;
                if (args.tools !== undefined) requestParams.tools = args.tools;
                if (args.tool_choice !== undefined) requestParams.tool_choice = args.tool_choice;
                if (args.response_format !== undefined) requestParams.response_format = args.response_format;
                if (args.seed !== undefined) requestParams.seed = args.seed;
                if (args.logit_bias !== undefined) requestParams.logit_bias = args.logit_bias;
                if (args.user !== undefined) requestParams.user = args.user;

                // Handle streaming vs non-streaming responses
                if (args.stream) {
                    // For streaming, we'll collect the stream and return the complete response
                    // This is necessary because MCP doesn't support streaming responses yet
                    const stream: any = await openai.chat.completions.create({
                        ...requestParams,
                        stream: true
                    });

                    let fullContent = "";
                    let toolCalls: any[] = [];
                    let finishReason = "";
                    let usage: any = null;

                    try {
                        for await (const chunk of stream) {
                            const delta = chunk.choices[0]?.delta;
                            
                            if (delta?.content) {
                                fullContent += delta.content;
                            }
                            
                            if (delta?.tool_calls) {
                                // Handle tool calls in streaming mode
                                for (const toolCall of delta.tool_calls) {
                                    if (!toolCalls[toolCall.index]) {
                                        toolCalls[toolCall.index] = {
                                            id: toolCall.id,
                                            type: toolCall.type,
                                            function: { name: "", arguments: "" }
                                        };
                                    }
                                    
                                    if (toolCall.function?.name) {
                                        toolCalls[toolCall.index].function.name += toolCall.function.name;
                                    }
                                    if (toolCall.function?.arguments) {
                                        toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                                    }
                                }
                            }

                            if (chunk.choices[0]?.finish_reason) {
                                finishReason = chunk.choices[0].finish_reason;
                            }

                            if (chunk.usage) {
                                usage = chunk.usage;
                            }
                        }
                    } catch (streamError) {
                        throw new Error(`Streaming error: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
                    }

                    // Format response
                    let responseText = fullContent || "No content received";
                    
                    if (toolCalls.length > 0) {
                        responseText += "\n\nTool calls:\n" + JSON.stringify(toolCalls, null, 2);
                    }

                    if (usage) {
                        responseText += `\n\nUsage: ${usage.total_tokens} tokens (${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion)`;
                    }

                    responseText += `\nFinish reason: ${finishReason}`;

                    return {
                        content: [{
                            type: "text",
                            text: responseText
                        }]
                    };
                } else {
                    // Non-streaming response
                    const completion = await openai.chat.completions.create(requestParams);

                    const choice = completion.choices[0];
                    if (!choice) {
                        throw new Error("No response choices received from OpenAI");
                    }

                    let responseText = choice.message?.content || "No content received";
                    
                    // Include tool calls if present
                    if (choice.message?.tool_calls) {
                        responseText += "\n\nTool calls:\n" + JSON.stringify(choice.message.tool_calls, null, 2);
                    }

                    // Include usage information
                    if (completion.usage) {
                        responseText += `\n\nUsage: ${completion.usage.total_tokens} tokens (${completion.usage.prompt_tokens} prompt + ${completion.usage.completion_tokens} completion)`;
                    }

                    responseText += `\nFinish reason: ${choice.finish_reason}`;

                    return {
                        content: [{
                            type: "text",
                            text: responseText
                        }]
                    };
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

        case "openai_models": {
            try {
                const args = request.params.arguments as {
                    model_id?: string;
                };

                if (args.model_id) {
                    // Get specific model details
                    const model = await openai.models.retrieve(args.model_id);
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify(model, null, 2)
                        }]
                    };
                } else {
                    // List all available models
                    const models = await openai.models.list();
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify(models.data, null, 2)
                        }]
                    };
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `OpenAI Models API error: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }

        case "openai_embeddings": {
            try {
                const args = request.params.arguments as {
                    input: string | string[];
                    model?: string;
                    encoding_format?: "float" | "base64";
                    dimensions?: number;
                    user?: string;
                };

                const requestParams: any = {
                    input: args.input,
                    model: args.model || "text-embedding-3-small"
                };

                if (args.encoding_format) requestParams.encoding_format = args.encoding_format;
                if (args.dimensions) requestParams.dimensions = args.dimensions;
                if (args.user) requestParams.user = args.user;

                const embeddings = await openai.embeddings.create(requestParams);

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(embeddings, null, 2)
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `OpenAI Embeddings API error: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }

        case "openai_moderations": {
            try {
                const args = request.params.arguments as {
                    input: string | string[];
                    model?: string;
                };

                const requestParams: any = {
                    input: args.input,
                    model: args.model || "text-moderation-latest"
                };

                const moderation = await openai.moderations.create(requestParams);

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(moderation, null, 2)
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `OpenAI Moderations API error: ${errorMessage}`
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