import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, proto, downloadMediaMessage, getContentType, } from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import qrcode from "qrcode-terminal";
import qrcodeImage from "qrcode";
import { logger } from "../utils/logger.js";
import { config } from "../utils/config.js";
import { EventEmitter } from "events";
import * as fs from "fs";
function makeSimpleStore() {
    const chats = new Map();
    const contacts = {};
    const messages = new Map();
    function upsertMessage(msg) {
        const jid = msg.key?.remoteJid;
        if (!jid)
            return;
        if (!messages.has(jid))
            messages.set(jid, new Map());
        const chatMsgs = messages.get(jid);
        chatMsgs.set(msg.key?.id ?? `${Date.now()}`, msg);
        // keep per-chat message count bounded
        if (chatMsgs.size > 200) {
            const firstKey = chatMsgs.keys().next().value;
            if (firstKey)
                chatMsgs.delete(firstKey);
        }
    }
    return {
        chats,
        contacts,
        messages,
        loadMessage(jid, id) {
            return messages.get(jid)?.get(id);
        },
        loadMessages(jid, limit) {
            const chatMsgs = messages.get(jid);
            if (!chatMsgs)
                return [];
            const all = Array.from(chatMsgs.values());
            return all.slice(-limit);
        },
        bind(ev) {
            ev.on("chats.upsert", (newChats) => {
                for (const c of newChats)
                    chats.set(c.id, c);
            });
            ev.on("chats.update", (updates) => {
                for (const u of updates) {
                    if (u.id && chats.has(u.id)) {
                        Object.assign(chats.get(u.id), u);
                    }
                }
            });
            ev.on("contacts.upsert", (newContacts) => {
                for (const c of newContacts) {
                    contacts[c.id] = { ...contacts[c.id], ...c };
                }
            });
            ev.on("contacts.update", (updates) => {
                for (const u of updates) {
                    if (u.id)
                        contacts[u.id] = { ...contacts[u.id], ...u };
                }
            });
            ev.on("messages.upsert", ({ messages: msgs }) => {
                for (const m of msgs)
                    upsertMessage(m);
            });
        },
    };
}
const MAX_HISTORY_CHATS = 500;
const MSG_RETRY_TTL_SECONDS = 300;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 3000;
export class WhatsAppClient extends EventEmitter {
    socket = null;
    store;
    msgRetryCounterCache;
    isConnected = false;
    isReady = false;
    qrCode = null;
    connectionStatus = "disconnected";
    messageHistory = new Map();
    reconnectAttempts = 0;
    constructor() {
        super();
        // BUG 9 FIX: use a proper TTL so retry counters are cleaned up automatically
        this.msgRetryCounterCache = new NodeCache({
            stdTTL: MSG_RETRY_TTL_SECONDS,
            useClones: false,
        });
        // Create simple in-memory store (makeInMemoryStore was removed in newer Baileys)
        this.store = makeSimpleStore();
    }
    async initialize() {
        try {
            await this.connect();
        }
        catch (error) {
            logger.error({ err: error }, "Failed to initialize WhatsApp client");
            throw error;
        }
    }
    async connect() {
        const { version, isLatest } = await fetchLatestBaileysVersion();
        logger.info(`Using WA v${version.join(".")}, isLatest: ${isLatest}`);
        // Ensure auth directory exists
        if (!fs.existsSync(config.authDir)) {
            fs.mkdirSync(config.authDir, { recursive: true });
        }
        const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
        this.socket = makeWASocket({
            version,
            logger: logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: state.keys,
            },
            msgRetryCounterCache: this.msgRetryCounterCache,
            generateHighQualityLinkPreview: true,
            getMessage: async (key) => {
                // store.loadMessage is synchronous in our SimpleStore
                const msg = this.store.loadMessage(key.remoteJid, key.id);
                return msg?.message || proto.Message.fromObject({});
            },
        });
        // Bind store to socket events
        this.store.bind(this.socket.ev);
        // Handle connection updates
        this.socket.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                this.qrCode = qr;
                this.connectionStatus = "qr_ready";
                logger.info("📱 QR Code generated - scan with WhatsApp");
                // Display QR in terminal
                qrcode.generate(qr, { small: true });
                this.emit("qr", qr);
            }
            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                logger.info({ err: lastDisconnect?.error }, `Connection closed. Reconnecting: ${shouldReconnect}`);
                this.isConnected = false;
                this.isReady = false;
                this.connectionStatus = "disconnected";
                this.emit("disconnected");
                if (shouldReconnect) {
                    // BUG 5 FIX: exponential backoff with a max retry limit
                    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                        logger.error(`❌ Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
                        this.connectionStatus = "failed";
                        this.emit("max_reconnect_exceeded");
                        return;
                    }
                    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts);
                    this.reconnectAttempts++;
                    logger.info(`🔄 Reconnecting to WhatsApp (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`);
                    setTimeout(() => this.connect(), delay);
                }
                else {
                    logger.info("🚪 Logged out from WhatsApp");
                    this.connectionStatus = "logged_out";
                    this.reconnectAttempts = 0;
                    // Clear auth files
                    if (fs.existsSync(config.authDir)) {
                        fs.rmSync(config.authDir, { recursive: true, force: true });
                    }
                }
            }
            if (connection === "open") {
                this.isConnected = true;
                this.isReady = true;
                this.qrCode = null;
                this.connectionStatus = "connected";
                this.reconnectAttempts = 0;
                logger.info("✅ WhatsApp connected successfully!");
                this.emit("ready");
            }
        });
        // Handle credentials update
        this.socket.ev.on("creds.update", saveCreds);
        // Handle messages
        this.socket.ev.on("messages.upsert", async ({ messages, type }) => {
            if (type === "notify") {
                for (const message of messages) {
                    const msgInfo = this.parseMessage(message);
                    if (msgInfo) {
                        // Store in history
                        const chatId = msgInfo.from;
                        if (!this.messageHistory.has(chatId)) {
                            // BUG 6 FIX: cap total number of tracked chats to avoid unbounded growth
                            if (this.messageHistory.size >= MAX_HISTORY_CHATS) {
                                const oldestKey = this.messageHistory.keys().next().value;
                                if (oldestKey)
                                    this.messageHistory.delete(oldestKey);
                            }
                            this.messageHistory.set(chatId, []);
                        }
                        const history = this.messageHistory.get(chatId);
                        history.push(msgInfo);
                        // Keep last 100 messages per chat
                        if (history.length > 100) {
                            history.shift();
                        }
                        this.emit("message", msgInfo);
                        logger.debug({ msg: msgInfo }, "📩 New message received");
                    }
                }
            }
        });
        // Handle message updates (read receipts, etc.)
        this.socket.ev.on("messages.update", (updates) => {
            this.emit("message_update", updates);
        });
        // Handle presence updates
        this.socket.ev.on("presence.update", (update) => {
            this.emit("presence_update", update);
        });
        // Handle group updates
        this.socket.ev.on("groups.update", (updates) => {
            this.emit("groups_update", updates);
        });
        // Handle contacts update
        this.socket.ev.on("contacts.update", (updates) => {
            this.emit("contacts_update", updates);
        });
    }
    parseMessage(message) {
        try {
            if (!message.key || !message.message)
                return null;
            const msgType = getContentType(message.message);
            if (!msgType)
                return null;
            const isGroup = message.key.remoteJid?.endsWith("@g.us") || false;
            const from = message.key.remoteJid || "";
            const sender = isGroup
                ? message.key.participant || message.participant || ""
                : from;
            let body = "";
            let hasMedia = false;
            let mediaType;
            let caption;
            switch (msgType) {
                case "conversation":
                    body = message.message.conversation || "";
                    break;
                case "extendedTextMessage":
                    body = message.message.extendedTextMessage?.text || "";
                    break;
                case "imageMessage":
                    body = "[Image]";
                    hasMedia = true;
                    mediaType = "image";
                    // null → undefined to match the string | undefined field type
                    caption = message.message.imageMessage?.caption ?? undefined;
                    if (caption)
                        body = `[Image] ${caption}`;
                    break;
                case "videoMessage":
                    body = "[Video]";
                    hasMedia = true;
                    mediaType = "video";
                    caption = message.message.videoMessage?.caption ?? undefined;
                    if (caption)
                        body = `[Video] ${caption}`;
                    break;
                case "audioMessage":
                    body = "[Audio]";
                    hasMedia = true;
                    mediaType = "audio";
                    break;
                case "documentMessage":
                    body = `[Document] ${message.message.documentMessage?.fileName || ""}`;
                    hasMedia = true;
                    mediaType = "document";
                    break;
                case "stickerMessage":
                    body = "[Sticker]";
                    hasMedia = true;
                    mediaType = "sticker";
                    break;
                case "locationMessage":
                    const loc = message.message.locationMessage;
                    body = `[Location] Lat: ${loc?.degreesLatitude}, Lng: ${loc?.degreesLongitude}`;
                    break;
                case "contactMessage":
                    body = `[Contact] ${message.message.contactMessage?.displayName}`;
                    break;
                case "buttonsResponseMessage":
                    body =
                        message.message.buttonsResponseMessage?.selectedDisplayText || "";
                    break;
                case "listResponseMessage":
                    body =
                        message.message.listResponseMessage?.title ||
                            message.message.listResponseMessage?.singleSelectReply
                                ?.selectedRowId ||
                            "";
                    break;
                default:
                    body = `[${msgType}]`;
            }
            return {
                id: message.key.id || "",
                from,
                to: message.key.fromMe
                    ? from
                    : this.socket?.user?.id || "",
                body,
                type: msgType,
                timestamp: message.messageTimestamp || Date.now() / 1000,
                isGroup,
                sender: sender || undefined,
                hasMedia,
                mediaType,
                caption,
            };
        }
        catch (error) {
            logger.error({ err: error }, "Error parsing message");
            return null;
        }
    }
    // ===== MESSAGE SENDING =====
    async sendTextMessage(jid, text, options) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`📤 Sending text message to ${normalizedJid}`);
        return await this.socket.sendMessage(normalizedJid, { text }, options);
    }
    async sendImageMessage(jid, imageUrl, caption) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`📤 Sending image to ${normalizedJid}`);
        const content = {
            image: { url: imageUrl },
            caption: caption || "",
        };
        return await this.socket.sendMessage(normalizedJid, content);
    }
    async sendVideoMessage(jid, videoUrl, caption) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`📤 Sending video to ${normalizedJid}`);
        const content = {
            video: { url: videoUrl },
            caption: caption || "",
        };
        return await this.socket.sendMessage(normalizedJid, content);
    }
    async sendAudioMessage(jid, audioUrl, isPTT = false) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`📤 Sending audio to ${normalizedJid}`);
        const content = {
            audio: { url: audioUrl },
            ptt: isPTT,
            mimetype: "audio/mp4",
        };
        return await this.socket.sendMessage(normalizedJid, content);
    }
    async sendDocumentMessage(jid, documentUrl, filename, mimetype = "application/pdf") {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`📤 Sending document to ${normalizedJid}`);
        const content = {
            document: { url: documentUrl },
            fileName: filename,
            mimetype,
        };
        return await this.socket.sendMessage(normalizedJid, content);
    }
    async sendLocationMessage(jid, latitude, longitude, name, address) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`📤 Sending location to ${normalizedJid}`);
        const content = {
            location: {
                degreesLatitude: latitude,
                degreesLongitude: longitude,
                name: name || "",
                address: address || "",
            },
        };
        return await this.socket.sendMessage(normalizedJid, content);
    }
    async sendContactMessage(jid, contactName, contactNumber) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`📤 Sending contact to ${normalizedJid}`);
        const vcard = `BEGIN:VCARD\n` +
            `VERSION:3.0\n` +
            `FN:${contactName}\n` +
            `TEL;type=CELL;type=VOICE;waid=${contactNumber}:+${contactNumber}\n` +
            `END:VCARD`;
        const content = {
            contacts: {
                displayName: contactName,
                contacts: [{ vcard }],
            },
        };
        return await this.socket.sendMessage(normalizedJid, content);
    }
    async sendReactionMessage(jid, messageId, emoji) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`📤 Sending reaction to message ${messageId}`);
        return await this.socket.sendMessage(normalizedJid, {
            react: {
                text: emoji,
                key: {
                    remoteJid: normalizedJid,
                    id: messageId,
                },
            },
        });
    }
    async sendQuotedMessage(jid, text, quotedMessageId) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        // Get the quoted message from store
        const quotedMsg = await this.store.loadMessage(normalizedJid, quotedMessageId);
        if (!quotedMsg) {
            throw new Error(`Message ${quotedMessageId} not found`);
        }
        return await this.socket.sendMessage(normalizedJid, { text }, { quoted: quotedMsg });
    }
    async sendButtonMessage(jid, text, footer, buttons) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`📤 Sending button message to ${normalizedJid}`);
        const buttonContent = buttons.map((btn) => ({
            buttonId: btn.id,
            buttonText: { displayText: btn.text },
            type: 1,
        }));
        // Buttons and list messages use legacy WhatsApp APIs not typed in AnyMessageContent
        const content = {
            buttons: buttonContent,
            text,
            footer,
            headerType: 1,
        };
        return await this.socket.sendMessage(normalizedJid, content);
    }
    async sendListMessage(jid, text, footer, title, buttonText, sections) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`📤 Sending list message to ${normalizedJid}`);
        const content = {
            text,
            footer,
            title,
            buttonText,
            sections,
        };
        return await this.socket.sendMessage(normalizedJid, content);
    }
    // ===== MESSAGE MANAGEMENT =====
    async deleteMessage(jid, messageId, forEveryone = true) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        logger.info(`🗑️ Deleting message ${messageId} from ${normalizedJid}`);
        if (forEveryone) {
            await this.socket.sendMessage(normalizedJid, {
                delete: {
                    remoteJid: normalizedJid,
                    id: messageId,
                    fromMe: true,
                },
            });
        }
        else {
            // BUG 2 FIX: "delete for me" — uses the deleteForMe ChatModification
            await this.socket.chatModify({
                deleteForMe: {
                    deleteMedia: false,
                    key: { remoteJid: normalizedJid, id: messageId, fromMe: true },
                    timestamp: Math.floor(Date.now() / 1000),
                },
            }, normalizedJid);
        }
    }
    async markAsRead(jid, messageIds) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        await this.socket.readMessages(messageIds.map((id) => ({
            remoteJid: normalizedJid,
            id,
            fromMe: false,
        })));
    }
    async sendTyping(jid, isTyping = true) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        await this.socket.sendPresenceUpdate(isTyping ? "composing" : "paused", normalizedJid);
    }
    // ===== CHAT MANAGEMENT =====
    async getChats() {
        this.ensureConnected();
        return Array.from(this.store.chats.values());
    }
    async getChatMessages(jid, limit = 50) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        // Return from local history first
        const localHistory = this.messageHistory.get(normalizedJid) || [];
        if (localHistory.length > 0) {
            return localHistory.slice(-limit);
        }
        // Try to get from store (synchronous in SimpleStore)
        const messages = this.store.loadMessages(normalizedJid, limit);
        return messages
            .map((m) => this.parseMessage(m))
            .filter((m) => m !== null);
    }
    async archiveChat(jid, archive = true) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        // ChatModification requires lastMessages for archive
        await this.socket.chatModify({ archive, lastMessages: [] }, normalizedJid);
    }
    async muteChat(jid, duration = 8 * 60 * 60 * 1000) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        await this.socket.chatModify({ mute: Date.now() + duration }, normalizedJid);
    }
    async unmuteChat(jid) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        await this.socket.chatModify({ mute: null }, normalizedJid);
    }
    async pinChat(jid, pin = true) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        await this.socket.chatModify({ pin }, normalizedJid);
    }
    async clearChat(jid) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        // clear requires a boolean + lastMessages in ChatModification
        await this.socket.chatModify({ clear: true, lastMessages: [] }, normalizedJid);
    }
    // ===== GROUP MANAGEMENT =====
    async createGroup(name, participants) {
        this.ensureConnected();
        logger.info(`👥 Creating group: ${name}`);
        const normalizedParticipants = participants.map((p) => this.normalizeJid(p));
        return await this.socket.groupCreate(name, normalizedParticipants);
    }
    async getGroupMetadata(jid) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        const metadata = await this.socket.groupMetadata(normalizedJid);
        return {
            id: metadata.id,
            name: metadata.subject,
            description: metadata.desc,
            participants: metadata.participants.map((p) => ({
                id: p.id,
                isAdmin: p.admin === "admin" || p.admin === "superadmin",
                isSuperAdmin: p.admin === "superadmin",
            })),
            // creation can be undefined in newer Baileys — default to 0
            creation: metadata.creation ?? 0,
            owner: metadata.owner,
        };
    }
    async addGroupParticipants(jid, participants) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        const normalizedParticipants = participants.map((p) => this.normalizeJid(p));
        return await this.socket.groupParticipantsUpdate(normalizedJid, normalizedParticipants, "add");
    }
    async removeGroupParticipants(jid, participants) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        const normalizedParticipants = participants.map((p) => this.normalizeJid(p));
        return await this.socket.groupParticipantsUpdate(normalizedJid, normalizedParticipants, "remove");
    }
    async promoteGroupParticipants(jid, participants) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        const normalizedParticipants = participants.map((p) => this.normalizeJid(p));
        return await this.socket.groupParticipantsUpdate(normalizedJid, normalizedParticipants, "promote");
    }
    async demoteGroupParticipants(jid, participants) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        const normalizedParticipants = participants.map((p) => this.normalizeJid(p));
        return await this.socket.groupParticipantsUpdate(normalizedJid, normalizedParticipants, "demote");
    }
    async updateGroupSubject(jid, subject) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        await this.socket.groupUpdateSubject(normalizedJid, subject);
    }
    async updateGroupDescription(jid, description) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        await this.socket.groupUpdateDescription(normalizedJid, description);
    }
    async leaveGroup(jid) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        await this.socket.groupLeave(normalizedJid);
    }
    async getInviteCode(jid) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        // groupInviteCode returns string | undefined in newer Baileys
        const code = await this.socket.groupInviteCode(normalizedJid);
        return code || "";
    }
    async joinGroupByInvite(code) {
        this.ensureConnected();
        return await this.socket.groupAcceptInvite(code);
    }
    async getJoinedGroups() {
        this.ensureConnected();
        const groups = [];
        for (const chat of this.store.chats.values()) {
            if (chat.id?.endsWith("@g.us")) {
                groups.push(chat);
            }
        }
        return groups;
    }
    // ===== CONTACT MANAGEMENT =====
    async getContacts() {
        this.ensureConnected();
        const contacts = this.store.contacts;
        const result = [];
        for (const [id, contact] of Object.entries(contacts)) {
            result.push({
                id,
                name: contact.name || contact.notify || id,
                pushName: contact.notify,
                number: id.replace("@s.whatsapp.net", "").replace("@g.us", ""),
                isGroup: id.endsWith("@g.us"),
            });
        }
        return result;
    }
    async getContactInfo(jid) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        const contact = this.store.contacts[normalizedJid];
        if (!contact)
            return null;
        return {
            id: normalizedJid,
            name: contact.name || contact.notify || normalizedJid,
            pushName: contact.notify,
            number: normalizedJid
                .replace("@s.whatsapp.net", "")
                .replace("@g.us", ""),
            isGroup: normalizedJid.endsWith("@g.us"),
        };
    }
    async blockContact(jid) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        await this.socket.updateBlockStatus(normalizedJid, "block");
    }
    async unblockContact(jid) {
        this.ensureConnected();
        const normalizedJid = this.normalizeJid(jid);
        await this.socket.updateBlockStatus(normalizedJid, "unblock");
    }
    async getProfilePicture(jid) {
        this.ensureConnected();
        try {
            const normalizedJid = this.normalizeJid(jid);
            const url = await this.socket.profilePictureUrl(normalizedJid, "image");
            return url || null;
        }
        catch {
            return null;
        }
    }
    async getStatus(jid) {
        this.ensureConnected();
        try {
            const normalizedJid = this.normalizeJid(jid);
            // fetchStatus returns USyncQueryResultList[] | undefined in newer Baileys
            const results = await this.socket.fetchStatus(normalizedJid);
            if (!results?.length)
                return null;
            // Each USyncQueryResultList may contain a status action
            const statusEntry = results[0]?.list?.[0]?.statusAction?.status
                || results[0]?.statusAction?.status;
            return statusEntry || null;
        }
        catch {
            return null;
        }
    }
    async checkNumberExists(phone) {
        this.ensureConnected();
        try {
            // onWhatsApp returns { jid, exists }[] | undefined in newer Baileys
            const results = await this.socket.onWhatsApp(phone);
            return results?.[0]?.exists || false;
        }
        catch {
            return false;
        }
    }
    // ===== PROFILE MANAGEMENT =====
    async updateProfileName(name) {
        this.ensureConnected();
        await this.socket.updateProfileName(name);
    }
    async updateProfileStatus(status) {
        this.ensureConnected();
        await this.socket.updateProfileStatus(status);
    }
    async updateProfilePicture(imageUrl) {
        this.ensureConnected();
        const response = await fetch(imageUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        await this.socket.updateProfilePicture(this.socket.user.id, buffer);
    }
    // ===== STATUS/STORY =====
    async sendTextStatus(text, backgroundColor = "#075E54") {
        this.ensureConnected();
        // backgroundArgb and font are status-specific fields not in AnyMessageContent type
        const content = {
            text,
            backgroundArgb: parseInt(backgroundColor.replace("#", ""), 16),
            font: 2,
        };
        await this.socket.sendMessage("status@broadcast", content);
    }
    async sendImageStatus(imageUrl, caption) {
        this.ensureConnected();
        await this.socket.sendMessage("status@broadcast", {
            image: { url: imageUrl },
            caption: caption || "",
        });
    }
    // ===== UTILITY =====
    async getQRCode() {
        return this.qrCode;
    }
    async getQRCodeImage() {
        if (!this.qrCode)
            return null;
        try {
            const qrImage = await qrcodeImage.toDataURL(this.qrCode);
            return qrImage;
        }
        catch {
            return null;
        }
    }
    getConnectionStatus() {
        return this.connectionStatus;
    }
    getMyJid() {
        return this.socket?.user?.id || "";
    }
    getMyNumber() {
        const jid = this.getMyJid();
        return jid.replace("@s.whatsapp.net", "").replace(":0", "");
    }
    getMessageHistory() {
        return this.messageHistory;
    }
    async downloadMedia(message) {
        this.ensureConnected();
        return await downloadMediaMessage(message, "buffer", {}, {
            logger: logger,
            reuploadRequest: this.socket.updateMediaMessage,
        });
    }
    async logout() {
        this.ensureConnected();
        await this.socket.logout();
    }
    async disconnect() {
        if (this.socket) {
            this.socket.end(undefined);
            this.isConnected = false;
            this.isReady = false;
            this.connectionStatus = "disconnected";
        }
    }
    normalizeJid(jid) {
        // BUG 1 FIX: the "@g.us" group check below the first return was unreachable
        // because any JID already containing "@" (including groups) is returned immediately.
        // Now we correctly handle both cases before stripping characters.
        if (jid.endsWith("@g.us") || jid.endsWith("@s.whatsapp.net"))
            return jid;
        if (jid.includes("@"))
            return jid;
        // Plain phone number — strip non-numeric chars (and leading +)
        const cleaned = jid.replace(/[^\d+]/g, "");
        const number = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
        return `${number}@s.whatsapp.net`;
    }
    ensureConnected() {
        if (!this.isConnected || !this.socket) {
            if (this.connectionStatus === "qr_ready") {
                throw new Error("WhatsApp is waiting for QR code scan. Please scan the QR code first.");
            }
            throw new Error(`WhatsApp is not connected. Status: ${this.connectionStatus}`);
        }
    }
    isWhatsAppConnected() {
        return this.isConnected;
    }
    isWhatsAppReady() {
        return this.isReady;
    }
}
