# WhatsApp MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that gives any AI assistant full control over WhatsApp — send messages, manage groups, handle contacts, post stories, and more.

Built with [Baileys](https://github.com/WhiskeySockets/Baileys) (no browser, no Puppeteer required).

---

## Features

- **50 tools** covering messaging, groups, contacts, profile, and status
- **Works with every major AI client** — Claude, Gemini, Codex, custom bots
- **Three transports** running simultaneously: stdio · SSE · StreamableHTTP
- **QR-code authentication** — scan once, session persists across restarts
- **Rate limiting** and exponential-backoff reconnection built in
- **HTTP health endpoint** with per-client connection guide at `GET /`

---

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/Zaibipk/whatsapp-mcp.git
cd whatsapp-mcp

# 2. Install dependencies
npm install

# 3. Configure (optional — defaults work out of the box)
cp .env.example .env

# 4. Build
npm run build

# 5. Run
npm start
```

On first run a QR code is printed in the terminal. Open WhatsApp → **Settings → Linked Devices → Link a Device** and scan it. The session is saved to `auth_info_baileys/` and reused on every subsequent start.

---

## Connecting your AI client

The server exposes **three transports at once**. Pick the one that matches your client.

### Claude Desktop / Claude Code

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/absolute/path/to/whatsapp-mcp/dist/index.js"],
      "env": {
        "AUTH_DIR": "/absolute/path/to/whatsapp-mcp/auth_info_baileys",
        "LOG_LEVEL": "warn",
        "LOG_PRETTY": "false"
      }
    }
  }
}
```

### Claude CLI

```bash
claude mcp add whatsapp node /absolute/path/to/whatsapp-mcp/dist/index.js
```

### Gemini CLI

```json
{
  "mcpServers": {
    "whatsapp": { "url": "http://localhost:3000/sse" }
  }
}
```

### Codex CLI (OpenAI)

```json
{
  "mcpServers": {
    "whatsapp": {
      "url": "http://localhost:3000/mcp",
      "transport": "http"
    }
  }
}
```

### Custom bot / agent (HTTP)

```bash
# List all tools
curl http://localhost:3000/tools

# Call a tool  (Accept header is required for StreamableHTTP)
curl -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "whatsapp_get_connection_status",
      "arguments": {}
    }
  }'
```

> **Note:** StreamableHTTP responses are returned as SSE events:
> `event: message\ndata: {"result": ...}\n\n`

See `mcp.json` in the repo root for copy-paste config blocks for each client type.

---

## HTTP endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check + per-client connection guide |
| `GET` | `/tools` | Quick tool list (no session required) |
| `GET` | `/sse` | SSE transport — Gemini CLI / legacy clients |
| `POST` | `/messages?sessionId=<id>` | SSE message delivery |
| `POST /GET /DELETE` | `/mcp` | StreamableHTTP — Codex CLI / custom bots |
| `OPTIONS` | `*` | CORS preflight for browser-based agents |

---

## Available tools

### Messaging (16)

| Tool | Description |
|------|-------------|
| `whatsapp_send_message` | Send a text message |
| `whatsapp_send_image` | Send an image with optional caption |
| `whatsapp_send_video` | Send a video with optional caption |
| `whatsapp_send_audio` | Send an audio file or voice note |
| `whatsapp_send_document` | Send a file / document |
| `whatsapp_send_location` | Share GPS coordinates |
| `whatsapp_send_contact` | Share a contact card |
| `whatsapp_send_reaction` | React to a message with an emoji |
| `whatsapp_reply_message` | Quote-reply to a specific message |
| `whatsapp_send_buttons` | Send a message with interactive buttons |
| `whatsapp_send_list` | Send a list-menu message |
| `whatsapp_delete_message` | Delete a message (for you or everyone) |
| `whatsapp_mark_as_read` | Mark messages as read |
| `whatsapp_send_typing` | Show/hide typing indicator |
| `whatsapp_get_messages` | Retrieve recent messages from a chat |
| `whatsapp_get_chats` | List all chats |

### Groups (10)

| Tool | Description |
|------|-------------|
| `whatsapp_create_group` | Create a new group |
| `whatsapp_get_group_info` | Get group metadata |
| `whatsapp_add_group_participants` | Add members |
| `whatsapp_remove_group_participants` | Remove members |
| `whatsapp_promote_group_admin` | Make a member an admin |
| `whatsapp_demote_group_admin` | Remove admin rights |
| `whatsapp_update_group_name` | Change the group name |
| `whatsapp_update_group_description` | Update the group description |
| `whatsapp_get_group_invite_link` | Get the invite link |
| `whatsapp_join_group` | Join via invite code or link |
| `whatsapp_leave_group` | Leave a group |
| `whatsapp_get_joined_groups` | List all joined groups |

### Contacts (7)

| Tool | Description |
|------|-------------|
| `whatsapp_get_contacts` | List all contacts |
| `whatsapp_get_contact_info` | Get contact details |
| `whatsapp_get_profile_picture` | Get profile photo URL |
| `whatsapp_get_status` | Get about / status text |
| `whatsapp_check_number` | Check if a number is on WhatsApp |
| `whatsapp_block_contact` | Block a contact |
| `whatsapp_unblock_contact` | Unblock a contact |

### Profile (4)

| Tool | Description |
|------|-------------|
| `whatsapp_get_my_info` | Get your own account info |
| `whatsapp_update_profile_name` | Change your display name |
| `whatsapp_update_profile_status` | Update your about text |
| `whatsapp_update_profile_picture` | Change your profile photo |

### Status / Stories (2)

| Tool | Description |
|------|-------------|
| `whatsapp_post_text_status` | Post a text story |
| `whatsapp_post_image_status` | Post an image story |

### Chat management (5)

| Tool | Description |
|------|-------------|
| `whatsapp_archive_chat` | Archive or unarchive a chat |
| `whatsapp_mute_chat` | Mute a chat |
| `whatsapp_unmute_chat` | Unmute a chat |
| `whatsapp_pin_chat` | Pin or unpin a chat |
| `whatsapp_clear_chat` | Clear chat history locally |

### Utility (6)

| Tool | Description |
|------|-------------|
| `whatsapp_get_connection_status` | Check connection state + QR code |
| `whatsapp_get_qr_code` | Get the QR code as a data-URL image |
| `whatsapp_logout` | Log out (requires re-scan) |
| `whatsapp_normalize_jid` | Convert phone number to WhatsApp JID |
| `whatsapp_get_message_history` | Get in-memory message history |

---

## MCP resources

| URI | Description |
|-----|-------------|
| `whatsapp://status` | Current connection status |
| `whatsapp://chats` | All chats |
| `whatsapp://contacts` | All contacts |
| `whatsapp://groups` | All groups |
| `whatsapp://chat/{jid}` | Messages for a specific chat |

---

## MCP prompts

| Name | Description |
|------|-------------|
| `whatsapp_assistant` | General-purpose WhatsApp assistant |
| `whatsapp_broadcast` | Send a message to multiple contacts |
| `whatsapp_group_manager` | Group management workflows |
| `whatsapp_message_analyzer` | Analyze conversations |
| `whatsapp_auto_responder` | Set up auto-response rules |

---

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTP_PORT` | `3000` | HTTP transport port |
| `HTTP_HOST` | `0.0.0.0` | HTTP bind address |
| `HTTP_ENABLED` | `true` | Enable HTTP transport (SSE + StreamableHTTP) |
| `HTTP_API_KEY` | *(blank)* | Optional API key for HTTP endpoints |
| `LOG_LEVEL` | `info` | `trace` · `debug` · `info` · `warn` · `error` |
| `LOG_PRETTY` | `true` | `false` for JSON logs (production / log aggregators) |
| `AUTH_DIR` | `./auth_info_baileys` | WhatsApp session storage path |
| `RATE_LIMIT_MESSAGES` | `10` | Max tool calls per window |
| `RATE_LIMIT_WINDOW` | `1000` | Window size in ms |

---

## Phone number format

Pass phone numbers with the country code, no `+` or spaces:

```
US:          14155552671
UK:          447911123456
Indonesia:   628123456789
```

The server automatically converts them to WhatsApp JID format (`number@s.whatsapp.net`).

---

## Project structure

```
src/
├── index.ts              # Entry point — starts stdio + HTTP transports
├── transport/
│   └── http.ts           # HTTP server (SSE + StreamableHTTP + health)
├── whatsapp/
│   └── client.ts         # WhatsApp socket, auth, all API calls
├── tools/
│   ├── handler.ts        # Tool dispatcher + rate limiter
│   ├── messaging.ts      # Messaging tools
│   ├── groups.ts         # Group tools
│   ├── contacts.ts       # Contact tools
│   ├── profile.ts        # Profile tools
│   ├── status.ts         # Status/story tools
│   └── utility.ts        # Utility tools
├── resources/
│   └── handler.ts        # MCP resource listings
├── prompts/
│   └── handler.ts        # MCP prompt definitions
└── utils/
    ├── config.ts          # Env-var config
    ├── helpers.ts         # Phone formatter, rate limiter
    └── logger.ts          # Pino logger
```

---

## Important notes

- **Never commit `auth_info_baileys/`** — it contains your WhatsApp session credentials. It is already in `.gitignore`.
- Rate limiting is enforced to reduce the risk of WhatsApp bans.
- Only use this server for legitimate personal or business use in accordance with WhatsApp's Terms of Service.
- The server must remain running to receive incoming messages.

---

## License

MIT
