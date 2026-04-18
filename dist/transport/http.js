/**
 * HTTP Transport Layer
 *
 * Exposes the WhatsApp MCP server over HTTP so that any AI CLI or custom
 * agent can connect — not just stdio-based clients.
 *
 * Endpoints
 * ─────────
 * GET  /           → health check + per-client connection guide (JSON)
 * GET  /tools      → quick tool list (JSON, no MCP session needed)
 * GET  /sse        → SSE transport handshake  (Gemini CLI · legacy)
 * POST /messages   → SSE message delivery     (pairs with GET /sse)
 * POST /mcp        → StreamableHTTP request   (Codex CLI · custom bots)
 * GET  /mcp        → StreamableHTTP SSE stream (server-push / resumption)
 * DELETE /mcp      → StreamableHTTP session teardown
 * OPTIONS *        → CORS pre-flight (browser agents)
 *
 * IMPORTANT: StreamableHTTP in stateless mode requires a NEW transport+server
 * instance per request (enforced by the SDK).  SSE transport creates one
 * long-lived instance per connected client.
 */
import { createServer } from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "../utils/logger.js";
import { config } from "../utils/config.js";
// ── CORS / auth helpers ───────────────────────────────────────────────────────
function applyCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id, x-api-key");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
}
function isAuthorized(req) {
    if (!config.httpApiKey)
        return true;
    const header = req.headers["x-api-key"];
    if (header === config.httpApiKey)
        return true;
    const url = new URL(req.url ?? "/", "http://localhost");
    return url.searchParams.get("api_key") === config.httpApiKey;
}
// ── Connection guide ──────────────────────────────────────────────────────────
function buildGuide(host, toolCount) {
    const base = `http://${host}`;
    return {
        server: config.serverName,
        version: config.serverVersion,
        status: "running",
        tools: toolCount,
        auth: config.httpApiKey
            ? "Required — set x-api-key header or ?api_key= query param"
            : "None",
        transports: {
            stdio: {
                description: "Claude Desktop · Claude Code · Claude CLI · any stdio MCP client",
                howTo: "Point your client at the compiled binary or tsx entrypoint",
                claudeDesktopConfig: {
                    mcpServers: {
                        whatsapp: {
                            command: "node",
                            args: ["dist/index.js"],
                            cwd: "<path-to-whatsapp-mcp>",
                        },
                    },
                },
                claudeCodeConfig: {
                    note: "Run: claude mcp add whatsapp node dist/index.js",
                },
            },
            sse: {
                description: "Gemini CLI · legacy SSE-based MCP clients · older custom agents",
                connect: `GET ${base}/sse`,
                send: `POST ${base}/messages?sessionId=<session-id>`,
                geminiCliConfig: {
                    mcpServers: {
                        whatsapp: { url: `${base}/sse` },
                    },
                },
                customAgentNote: [
                    "1. GET /sse  — opens SSE stream; read 'endpoint' event to get sessionId",
                    "2. POST /messages?sessionId=<id>  — send JSON-RPC messages",
                    "3. Read SSE stream for responses",
                ],
            },
            streamableHttp: {
                description: "Codex CLI · modern MCP clients · custom bots · custom agents",
                endpoint: `${base}/mcp`,
                methods: ["POST", "GET", "DELETE"],
                codexCliConfig: {
                    mcpServers: {
                        whatsapp: { url: `${base}/mcp`, transport: "http" },
                    },
                },
                customBotCurlExample: [
                    `# 1. Initialize`,
                    `curl -X POST ${base}/mcp \\`,
                    `  -H 'Content-Type: application/json' \\`,
                    `  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-bot","version":"1"}}}'`,
                    ``,
                    `# 2. List tools`,
                    `curl -X POST ${base}/mcp \\`,
                    `  -H 'Content-Type: application/json' \\`,
                    `  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'`,
                    ``,
                    `# 3. Call a tool`,
                    `curl -X POST ${base}/mcp \\`,
                    `  -H 'Content-Type: application/json' \\`,
                    `  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"whatsapp_get_connection_status","arguments":{}}}'`,
                ].join("\n"),
                openAiCompatibleNote: "Use as an MCP tool provider in OpenAI Agents SDK or any MCP-compatible framework",
            },
        },
    };
}
// ── Quick tool list (static — doesn't require a live MCP session) ─────────────
const TOOL_QUICK_LIST = [
    // messaging
    "whatsapp_send_message", "whatsapp_send_image", "whatsapp_send_video",
    "whatsapp_send_audio", "whatsapp_send_document", "whatsapp_send_location",
    "whatsapp_send_contact_card", "whatsapp_send_reaction", "whatsapp_send_poll",
    "whatsapp_send_sticker", "whatsapp_reply_to_message",
    "whatsapp_send_button_message", "whatsapp_send_list_message",
    "whatsapp_forward_message", "whatsapp_delete_message",
    "whatsapp_mark_as_read", "whatsapp_send_typing",
    // chat management
    "whatsapp_get_chats", "whatsapp_get_chat_messages",
    "whatsapp_archive_chat", "whatsapp_mute_chat",
    "whatsapp_pin_chat", "whatsapp_clear_chat",
    // groups
    "whatsapp_create_group", "whatsapp_get_group_info",
    "whatsapp_add_group_participants", "whatsapp_remove_group_participants",
    "whatsapp_promote_group_participant", "whatsapp_demote_group_participant",
    "whatsapp_update_group_subject", "whatsapp_update_group_description",
    "whatsapp_leave_group", "whatsapp_get_invite_code",
    "whatsapp_join_group_by_invite", "whatsapp_get_joined_groups",
    // contacts
    "whatsapp_get_contacts", "whatsapp_get_contact_info",
    "whatsapp_block_contact", "whatsapp_unblock_contact",
    "whatsapp_get_profile_picture", "whatsapp_get_status",
    "whatsapp_check_number_exists",
    // profile
    "whatsapp_update_profile_name", "whatsapp_update_profile_status",
    "whatsapp_update_profile_picture",
    // status / stories
    "whatsapp_send_text_status", "whatsapp_send_image_status",
    // utility
    "whatsapp_get_connection_status", "whatsapp_get_qr_code", "whatsapp_logout",
];
// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Start the HTTP server with SSE + StreamableHTTP MCP transports.
 *
 * @param factory    Creates a fresh, fully-configured MCP Server on demand.
 * @param toolCount  Number of registered tools (shown in health guide).
 */
export async function startHttpServer(factory, toolCount) {
    // ── SSE session registry (one per connected SSE client) ───────────────────
    const sseSessions = new Map();
    // ── HTTP server ───────────────────────────────────────────────────────────
    const httpServer = createServer(async (req, res) => {
        applyCors(res);
        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }
        const url = new URL(req.url ?? "/", "http://localhost");
        const path = url.pathname;
        // API-key guard (skip OPTIONS, health, and tools list)
        if (path !== "/" &&
            path !== "/health" &&
            path !== "/tools" &&
            !isAuthorized(req)) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized — invalid or missing x-api-key" }));
            return;
        }
        try {
            // ── GET / or /health — connection guide ───────────────────────────
            if ((path === "/" || path === "/health") && req.method === "GET") {
                const host = req.headers.host ?? `localhost:${config.httpPort}`;
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(buildGuide(host, toolCount), null, 2));
                return;
            }
            // ── GET /tools — quick static tool list ───────────────────────────
            if (path === "/tools" && req.method === "GET") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    count: TOOL_QUICK_LIST.length,
                    note: "POST /mcp with tools/list method to get full schemas",
                    tools: TOOL_QUICK_LIST,
                }, null, 2));
                return;
            }
            // ── GET /sse — SSE transport handshake ────────────────────────────
            // Used by: Gemini CLI, legacy SSE-based MCP clients
            if (path === "/sse" && req.method === "GET") {
                const sseTransport = new SSEServerTransport("/messages", res);
                sseSessions.set(sseTransport.sessionId, sseTransport);
                sseTransport.onclose = () => {
                    sseSessions.delete(sseTransport.sessionId);
                    logger.info({ sessionId: sseTransport.sessionId }, "📡 SSE client disconnected");
                };
                const sseServer = factory();
                await sseServer.connect(sseTransport);
                logger.info({ sessionId: sseTransport.sessionId }, "📡 SSE client connected");
                return; // response stays open (SSE stream)
            }
            // ── POST /messages — SSE message delivery ─────────────────────────
            if (path === "/messages" && req.method === "POST") {
                const sessionId = url.searchParams.get("sessionId");
                const transport = sessionId ? sseSessions.get(sessionId) : undefined;
                if (!transport) {
                    res.writeHead(404, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        error: `SSE session '${sessionId ?? "unknown"}' not found. Open GET /sse first.`,
                    }));
                    return;
                }
                await transport.handlePostMessage(req, res);
                return;
            }
            // ── /mcp — StreamableHTTP transport ───────────────────────────────
            // Used by: Codex CLI, modern MCP clients, custom bots/agents
            //
            // CRITICAL: The SDK enforces that a stateless StreamableHTTPServerTransport
            // cannot be reused across requests. We must create a fresh transport+server
            // for every single request.
            if (path === "/mcp") {
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: undefined, // stateless — no session management
                });
                const mcpServer = factory();
                await mcpServer.connect(transport);
                // handleRequest reads the body internally; we must NOT pre-read it.
                await transport.handleRequest(req, res);
                return;
            }
            // ── 404 ───────────────────────────────────────────────────────────
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Unknown endpoint: ${path}` }));
        }
        catch (err) {
            logger.error({ err }, "HTTP transport error");
            if (!res.headersSent) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Internal server error" }));
            }
        }
    });
    // Increase keep-alive and connection headroom for SSE long-polling
    httpServer.keepAliveTimeout = 120_000;
    httpServer.headersTimeout = 125_000;
    await new Promise((resolve, reject) => {
        httpServer.on("error", reject);
        httpServer.listen(config.httpPort, config.httpHost, resolve);
    });
    const displayHost = config.httpHost === "0.0.0.0" ? "localhost" : config.httpHost;
    const base = `http://${displayHost}:${config.httpPort}`;
    logger.info(`🌐 HTTP MCP server ready at ${base}`);
    logger.info(`   ├─ Health / guide       : GET  ${base}/`);
    logger.info(`   ├─ Quick tool list      : GET  ${base}/tools`);
    logger.info(`   ├─ SSE (Gemini CLI)     : GET  ${base}/sse`);
    logger.info(`   └─ StreamableHTTP       : POST ${base}/mcp`);
    if (config.httpApiKey) {
        logger.info(`   🔑 API key authentication enabled`);
    }
}
