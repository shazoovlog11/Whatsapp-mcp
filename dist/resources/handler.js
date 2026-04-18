import { logger } from "../utils/logger.js";
export class ResourceHandler {
    client;
    constructor(client) {
        this.client = client;
    }
    async listResources() {
        const resources = [
            {
                uri: "whatsapp://status",
                name: "WhatsApp Connection Status",
                description: "Current WhatsApp connection status and account info",
                mimeType: "application/json",
            },
            {
                uri: "whatsapp://chats",
                name: "WhatsApp Chats",
                description: "List of all WhatsApp chats",
                mimeType: "application/json",
            },
            {
                uri: "whatsapp://contacts",
                name: "WhatsApp Contacts",
                description: "List of all WhatsApp contacts",
                mimeType: "application/json",
            },
            {
                uri: "whatsapp://groups",
                name: "WhatsApp Groups",
                description: "List of all joined WhatsApp groups",
                mimeType: "application/json",
            },
        ];
        // Add chat-specific resources if connected
        if (this.client.isWhatsAppConnected()) {
            try {
                const chats = await this.client.getChats();
                for (const chat of chats.slice(0, 20)) {
                    resources.push({
                        uri: `whatsapp://chat/${encodeURIComponent(chat.id)}`,
                        name: `Chat: ${chat.name || chat.id}`,
                        description: `Messages from chat ${chat.name || chat.id}`,
                        mimeType: "application/json",
                    });
                }
            }
            catch (error) {
                logger.debug({ err: error }, "Could not load chats for resources");
            }
        }
        return resources;
    }
    async readResource(uri) {
        const url = new URL(uri);
        const host = url.hostname;
        const path = url.pathname;
        if (host === "status") {
            return this.getStatusResource(uri);
        }
        else if (host === "chats") {
            return this.getChatsResource(uri);
        }
        else if (host === "contacts") {
            return this.getContactsResource(uri);
        }
        else if (host === "groups") {
            return this.getGroupsResource(uri);
        }
        else if (host === "chat") {
            const chatId = decodeURIComponent(path.slice(1));
            return this.getChatResource(uri, chatId);
        }
        throw new Error(`Unknown resource URI: ${uri}`);
    }
    async getStatusResource(uri) {
        const status = this.client.getConnectionStatus();
        const isConnected = this.client.isWhatsAppConnected();
        let qrCode = null;
        if (status === "qr_ready") {
            qrCode = await this.client.getQRCode();
        }
        const data = {
            status,
            isConnected,
            myJid: isConnected ? this.client.getMyJid() : null,
            myNumber: isConnected ? this.client.getMyNumber() : null,
            qrCode,
            timestamp: new Date().toISOString(),
        };
        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }
    async getChatsResource(uri) {
        let chats = [];
        if (this.client.isWhatsAppConnected()) {
            chats = await this.client.getChats();
        }
        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify({
                        chats: chats.map((c) => ({
                            id: c.id,
                            name: c.name,
                            isGroup: c.id?.endsWith("@g.us"),
                            unreadCount: c.unreadCount || 0,
                            timestamp: c.conversationTimestamp,
                        })),
                        total: chats.length,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                },
            ],
        };
    }
    async getContactsResource(uri) {
        let contacts = [];
        if (this.client.isWhatsAppConnected()) {
            contacts = await this.client.getContacts();
        }
        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify({
                        contacts: contacts.filter((c) => !c.isGroup),
                        total: contacts.filter((c) => !c.isGroup).length,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                },
            ],
        };
    }
    async getGroupsResource(uri) {
        let groups = [];
        if (this.client.isWhatsAppConnected()) {
            groups = await this.client.getJoinedGroups();
        }
        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify({
                        groups: groups.map((g) => ({
                            id: g.id,
                            name: g.name || g.subject,
                            unreadCount: g.unreadCount || 0,
                        })),
                        total: groups.length,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                },
            ],
        };
    }
    async getChatResource(uri, chatId) {
        let messages = [];
        if (this.client.isWhatsAppConnected()) {
            messages = await this.client.getChatMessages(chatId, 50);
        }
        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify({
                        chatId,
                        messages: messages.map((m) => ({
                            id: m.id,
                            from: m.from,
                            sender: m.sender,
                            body: m.body,
                            type: m.type,
                            timestamp: new Date(m.timestamp * 1000).toISOString(),
                            hasMedia: m.hasMedia,
                        })),
                        count: messages.length,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                },
            ],
        };
    }
}
