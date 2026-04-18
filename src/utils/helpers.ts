import axios from "axios";

export function formatPhoneNumber(phone: string): string {
  // BUG 7 FIX: strip the leading '+' BEFORE removing non-digits, otherwise
  // /\D/g already removes '+' and the startsWith("+") branch was always false.
  const withoutPlus = phone.startsWith("+") ? phone.slice(1) : phone;
  return withoutPlus.replace(/\D/g, "");
}

export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = formatPhoneNumber(phone);
  return cleaned.length >= 7 && cleaned.length <= 15;
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}

export function isContactJid(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net");
}

export function extractPhoneFromJid(jid: string): string {
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", "").replace(":0", "");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function downloadFromUrl(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: {
      "User-Agent": "WhatsApp MCP Client",
    },
  });
  return Buffer.from(response.data);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function parseCSV(csv: string): string[] {
  return csv
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

export interface RateLimiter {
  checkLimit: () => boolean;
}

export function createRateLimiter(
  maxRequests: number,
  windowMs: number
): RateLimiter {
  const requests: number[] = [];

  return {
    checkLimit: () => {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove old requests
      while (requests.length > 0 && requests[0] < windowStart) {
        requests.shift();
      }

      if (requests.length >= maxRequests) {
        return false;
      }

      requests.push(now);
      return true;
    },
  };
}