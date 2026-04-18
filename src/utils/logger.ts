import pino from "pino";
import { config } from "./config.js";

const transport =
  config.logPretty
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
          messageFormat: "{msg}",
        },
      }
    : undefined;

export const logger = pino(
  {
    level: config.logLevel,
    name: "whatsapp-mcp",
  },
  transport ? pino.transport(transport) : undefined
);

// Silence baileys internal logs unless in debug mode
export const silentLogger = pino({
  level: "silent",
});

export const baileysLogger =
  config.logLevel === "debug"
    ? logger.child({ module: "baileys" })
    : silentLogger;