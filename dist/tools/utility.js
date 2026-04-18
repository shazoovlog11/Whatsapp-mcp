export function utilityTools(client) {
    return [
        {
            name: "whatsapp_get_connection_status",
            description: "Get the current WhatsApp connection status and QR code if needed",
            inputSchema: {
                type: "object",
                properties: {},
            },
            handler: async () => {
                const status = client.getConnectionStatus();
                const isConnected = client.isWhatsAppConnected();
                let qrCode = null;
                let qrCodeImage = null;
                if (status === "qr_ready") {
                    qrCode = await client.getQRCode();
                    qrCodeImage = await client.getQRCodeImage();
                }
                return {
                    status,
                    isConnected,
                    myJid: isConnected ? client.getMyJid() : null,
                    myNumber: isConnected ? client.getMyNumber() : null,
                    qrCode: qrCode,
                    qrCodeDataUrl: qrCodeImage,
                    message: isConnected
                        ? "WhatsApp is connected and ready"
                        : status === "qr_ready"
                            ? "Please scan the QR code to connect WhatsApp"
                            : status === "logged_out"
                                ? "WhatsApp has been logged out"
                                : "WhatsApp is connecting...",
                };
            },
        },
        {
            name: "whatsapp_get_qr_code",
            description: "Get the QR code for WhatsApp Web pairing (as data URL image)",
            inputSchema: {
                type: "object",
                properties: {},
            },
            handler: async () => {
                const status = client.getConnectionStatus();
                if (status === "connected") {
                    return {
                        status: "connected",
                        message: "WhatsApp is already connected. No QR code needed.",
                    };
                }
                const qrCode = await client.getQRCode();
                const qrCodeImage = await client.getQRCodeImage();
                if (!qrCode) {
                    return {
                        status,
                        message: "QR code not available yet. WhatsApp may still be connecting.",
                        qrCode: null,
                        qrCodeDataUrl: null,
                    };
                }
                return {
                    status: "qr_ready",
                    message: "Scan this QR code with WhatsApp on your phone",
                    qrCode,
                    qrCodeDataUrl: qrCodeImage,
                    instructions: [
                        "1. Open WhatsApp on your phone",
                        "2. Go to Settings > Linked Devices",
                        "3. Tap 'Link a Device'",
                        "4. Scan the QR code above",
                    ],
                };
            },
        },
        {
            name: "whatsapp_logout",
            description: "Logout from WhatsApp (will require re-scanning QR code)",
            inputSchema: {
                type: "object",
                properties: {
                    confirm: {
                        type: "boolean",
                        description: "Confirm that you want to logout",
                    },
                },
                required: ["confirm"],
            },
            handler: async (args) => {
                if (!args.confirm) {
                    return {
                        success: false,
                        message: "Logout cancelled. Set confirm=true to proceed.",
                    };
                }
                await client.logout();
                return {
                    success: true,
                    message: "Logged out from WhatsApp successfully",
                };
            },
        },
        {
            name: "whatsapp_archive_chat",
            description: "Archive or unarchive a WhatsApp chat",
            inputSchema: {
                type: "object",
                properties: {
                    jid: {
                        type: "string",
                        description: "Phone number or JID of the chat",
                    },
                    archive: {
                        type: "boolean",
                        description: "True to archive, false to unarchive",
                        default: true,
                    },
                },
                required: ["jid"],
            },
            handler: async (args) => {
                await client.archiveChat(args.jid, args.archive !== false);
                return {
                    success: true,
                    jid: args.jid,
                    archived: args.archive !== false,
                };
            },
        },
        {
            name: "whatsapp_mute_chat",
            description: "Mute a WhatsApp chat for a specified duration",
            inputSchema: {
                type: "object",
                properties: {
                    jid: {
                        type: "string",
                        description: "Phone number or JID of the chat",
                    },
                    duration_hours: {
                        type: "number",
                        description: "Duration to mute in hours (default: 8 hours)",
                        default: 8,
                    },
                },
                required: ["jid"],
            },
            handler: async (args) => {
                const durationMs = (args.duration_hours || 8) * 60 * 60 * 1000;
                await client.muteChat(args.jid, durationMs);
                return {
                    success: true,
                    jid: args.jid,
                    mutedFor: `${args.duration_hours || 8} hours`,
                };
            },
        },
        {
            name: "whatsapp_unmute_chat",
            description: "Unmute a WhatsApp chat",
            inputSchema: {
                type: "object",
                properties: {
                    jid: {
                        type: "string",
                        description: "Phone number or JID of the chat",
                    },
                },
                required: ["jid"],
            },
            handler: async (args) => {
                await client.unmuteChat(args.jid);
                return {
                    success: true,
                    jid: args.jid,
                    muted: false,
                };
            },
        },
        {
            name: "whatsapp_pin_chat",
            description: "Pin or unpin a WhatsApp chat",
            inputSchema: {
                type: "object",
                properties: {
                    jid: {
                        type: "string",
                        description: "Phone number or JID of the chat",
                    },
                    pin: {
                        type: "boolean",
                        description: "True to pin, false to unpin",
                        default: true,
                    },
                },
                required: ["jid"],
            },
            handler: async (args) => {
                await client.pinChat(args.jid, args.pin !== false);
                return {
                    success: true,
                    jid: args.jid,
                    pinned: args.pin !== false,
                };
            },
        },
        {
            name: "whatsapp_normalize_jid",
            description: "Convert a phone number to WhatsApp JID format for use in other tools",
            inputSchema: {
                type: "object",
                properties: {
                    phone: {
                        type: "string",
                        description: "Phone number (with country code, e.g., '14155552671')",
                    },
                    is_group: {
                        type: "boolean",
                        description: "Whether this is a group ID",
                        default: false,
                    },
                },
                required: ["phone"],
            },
            handler: async (args) => {
                const jid = args.is_group
                    ? `${args.phone}@g.us`
                    : client.normalizeJid(args.phone);
                return {
                    phone: args.phone,
                    jid,
                    type: args.is_group ? "group" : "contact",
                };
            },
        },
        {
            name: "whatsapp_get_message_history",
            description: "Get the in-memory message history for all chats",
            inputSchema: {
                type: "object",
                properties: {
                    jid: {
                        type: "string",
                        description: "Optional: filter by specific chat JID",
                    },
                },
            },
            handler: async (args) => {
                const history = client.getMessageHistory();
                if (args.jid) {
                    const normalizedJid = client.normalizeJid(args.jid);
                    const chatHistory = history.get(normalizedJid) || [];
                    return {
                        jid: normalizedJid,
                        messages: chatHistory,
                        count: chatHistory.length,
                    };
                }
                const result = {};
                for (const [jid, messages] of history.entries()) {
                    result[jid] = {
                        count: messages.length,
                        lastMessage: messages[messages.length - 1],
                    };
                }
                return {
                    chats: result,
                    totalChats: history.size,
                };
            },
        },
    ];
}
