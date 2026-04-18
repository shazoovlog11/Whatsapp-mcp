import axios from "axios";
export function formatPhoneNumber(phone) {
    // BUG 7 FIX: strip the leading '+' BEFORE removing non-digits, otherwise
    // /\D/g already removes '+' and the startsWith("+") branch was always false.
    const withoutPlus = phone.startsWith("+") ? phone.slice(1) : phone;
    return withoutPlus.replace(/\D/g, "");
}
export function isValidPhoneNumber(phone) {
    const cleaned = formatPhoneNumber(phone);
    return cleaned.length >= 7 && cleaned.length <= 15;
}
export function isGroupJid(jid) {
    return jid.endsWith("@g.us");
}
export function isContactJid(jid) {
    return jid.endsWith("@s.whatsapp.net");
}
export function extractPhoneFromJid(jid) {
    return jid.replace("@s.whatsapp.net", "").replace("@g.us", "").replace(":0", "");
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function downloadFromUrl(url) {
    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: {
            "User-Agent": "WhatsApp MCP Client",
        },
    });
    return Buffer.from(response.data);
}
export function formatBytes(bytes) {
    if (bytes === 0)
        return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
export function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}
export function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength) + "...";
}
export function parseCSV(csv) {
    return csv
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
export function generateId() {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}
export function createRateLimiter(maxRequests, windowMs) {
    const requests = [];
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
