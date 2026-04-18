import { logger } from "../utils/logger.js";
import { messagingTools } from "./messaging.js";
import { groupTools } from "./groups.js";
import { contactTools } from "./contacts.js";
import { profileTools } from "./profile.js";
import { statusTools } from "./status.js";
import { utilityTools } from "./utility.js";
import { createRateLimiter } from "../utils/helpers.js";
import { config } from "../utils/config.js";
export class ToolHandler {
    client;
    toolMap;
    // BUG 3 FIX: cache definitions once at construction — not re-computed per request
    cachedDefinitions;
    // BUG 10 FIX: actually instantiate and apply the rate limiter
    rateLimiter = createRateLimiter(config.rateLimitMessages, config.rateLimitWindow);
    constructor(client) {
        this.client = client;
        this.toolMap = new Map();
        this.cachedDefinitions = [];
        this.registerTools();
    }
    registerTools() {
        const allTools = [
            ...messagingTools(this.client),
            ...groupTools(this.client),
            ...contactTools(this.client),
            ...profileTools(this.client),
            ...statusTools(this.client),
            ...utilityTools(this.client),
        ];
        for (const tool of allTools) {
            this.toolMap.set(tool.name, tool.handler);
        }
        // BUG 3 FIX: build the definitions cache once here, reuse in getToolDefinitions()
        this.cachedDefinitions = allTools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        }));
        logger.info(`✅ Registered ${this.toolMap.size} WhatsApp tools`);
    }
    getToolDefinitions() {
        // BUG 3 FIX: return the cached array — no re-instantiation on every ListTools call
        return this.cachedDefinitions;
    }
    async handleTool(name, args) {
        // BUG 10 FIX: enforce the configured rate limit before dispatching any tool
        if (!this.rateLimiter.checkLimit()) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Rate limit exceeded: maximum ${config.rateLimitMessages} requests per ${config.rateLimitWindow}ms. Please slow down.`,
                    },
                ],
                isError: true,
            };
        }
        const handler = this.toolMap.get(name);
        if (!handler) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Unknown tool: ${name}. Available tools: ${Array.from(this.toolMap.keys()).join(", ")}`,
                    },
                ],
                isError: true,
            };
        }
        try {
            const result = await handler(args);
            return {
                content: [
                    {
                        type: "text",
                        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error({ err: error }, `Tool ${name} error`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error in ${name}: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    }
}
