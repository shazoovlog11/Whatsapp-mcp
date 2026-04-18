import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as fs from "fs";

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../../.env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export const config = {
  serverName: process.env.MCP_SERVER_NAME || "whatsapp-mcp",
  serverVersion: process.env.MCP_SERVER_VERSION || "1.0.0",
  authDir: process.env.AUTH_DIR || "./auth_info_baileys",
  logLevel: process.env.LOG_LEVEL || "info",
  logPretty: process.env.LOG_PRETTY !== "false",
  maxMessagesFetch: parseInt(process.env.MAX_MESSAGES_FETCH || "50"),
  messageTimeout: parseInt(process.env.MESSAGE_TIMEOUT || "30000"),
  qrTimeout: parseInt(process.env.QR_TIMEOUT || "60000"),
  rateLimitMessages: parseInt(process.env.RATE_LIMIT_MESSAGES || "10"),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || "1000"),
  // HTTP transport (for Gemini CLI, Codex CLI, custom bots/agents)
  httpEnabled: process.env.HTTP_ENABLED !== "false",
  httpPort: parseInt(process.env.HTTP_PORT || "3000"),
  httpHost: process.env.HTTP_HOST || "0.0.0.0",
  // API key for HTTP transport authentication (optional)
  httpApiKey: process.env.HTTP_API_KEY || "",
};