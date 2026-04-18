import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { WhatsAppClient } from "./whatsapp/client.js";
import { ToolHandler } from "./tools/handler.js";
import { ResourceHandler } from "./resources/handler.js";
import { PromptHandler } from "./prompts/handler.js";
import { logger } from "./utils/logger.js";
import { config } from "./utils/config.js";
import { startHttpServer } from "./transport/http.js";
async function main() {
    logger.info("🚀 Starting WhatsApp MCP Server...");
    // ── Shared state ───────────────────────────────────────────────────────
    const whatsappClient = new WhatsAppClient();
    const toolHandler = new ToolHandler(whatsappClient);
    const resourceHandler = new ResourceHandler(whatsappClient);
    const promptHandler = new PromptHandler();
    // ── Server factory ─────────────────────────────────────────────────────
    // Called once per transport connection; each connection gets its own MCP
    // Server instance, but they all share the same WhatsApp client + handlers.
    const createServer = () => {
        const server = new Server({ name: config.serverName, version: config.serverVersion }, { capabilities: { tools: {}, resources: {}, prompts: {} } });
        server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: toolHandler.getToolDefinitions(),
        }));
        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            logger.info({ args }, `🔧 Tool called: ${name}`);
            try {
                return await toolHandler.handleTool(name, args || {});
            }
            catch (error) {
                logger.error({ err: error }, `Tool error for ${name}`);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
        server.setRequestHandler(ListResourcesRequestSchema, async () => ({
            resources: await resourceHandler.listResources(),
        }));
        server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const { uri } = request.params;
            return resourceHandler.readResource(uri);
        });
        server.setRequestHandler(ListPromptsRequestSchema, async () => ({
            prompts: promptHandler.getPrompts(),
        }));
        server.setRequestHandler(GetPromptRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            return promptHandler.getPrompt(name, args || {});
        });
        return server;
    };
    // ── BUG 11 FIX: start transports BEFORE initializing WhatsApp ─────────
    // Clients can connect immediately and call whatsapp_get_qr_code /
    // whatsapp_get_connection_status while WhatsApp is still authenticating.
    // Stdio transport — Claude Desktop / Claude Code / Claude CLI
    const stdioTransport = new StdioServerTransport();
    await createServer().connect(stdioTransport);
    logger.info("✅ stdio transport ready (Claude Desktop / Claude Code / Claude CLI)");
    // HTTP transports — Gemini CLI (SSE) · Codex CLI (StreamableHTTP) · custom agents
    const toolCount = toolHandler.getToolDefinitions().length;
    if (config.httpEnabled) {
        await startHttpServer(createServer, toolCount);
    }
    logger.info(`✅ WhatsApp MCP Server is running! (${toolCount} tools registered)`);
    logger.info("🔗 Waiting for LLM connections...");
    // ── WhatsApp connection ────────────────────────────────────────────────
    logger.info("📱 Initializing WhatsApp connection...");
    await whatsappClient.initialize();
    // ── Graceful shutdown ──────────────────────────────────────────────────
    const shutdown = async () => {
        logger.info("🛑 Shutting down WhatsApp MCP Server...");
        await whatsappClient.disconnect();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
main().catch((error) => {
    logger.error({ err: error }, "Fatal error");
    process.exit(1);
});
