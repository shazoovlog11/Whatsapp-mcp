export function profileTools(client) {
    return [
        {
            name: "whatsapp_update_profile_name",
            description: "Update your WhatsApp profile name",
            inputSchema: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "New display name",
                    },
                },
                required: ["name"],
            },
            handler: async (args) => {
                await client.updateProfileName(args.name);
                return {
                    success: true,
                    newName: args.name,
                };
            },
        },
        {
            name: "whatsapp_update_profile_status",
            description: "Update your WhatsApp status/about text",
            inputSchema: {
                type: "object",
                properties: {
                    status: {
                        type: "string",
                        description: "New status/about text",
                    },
                },
                required: ["status"],
            },
            handler: async (args) => {
                await client.updateProfileStatus(args.status);
                return {
                    success: true,
                    newStatus: args.status,
                };
            },
        },
        {
            name: "whatsapp_update_profile_picture",
            description: "Update your WhatsApp profile picture",
            inputSchema: {
                type: "object",
                properties: {
                    image_url: {
                        type: "string",
                        description: "URL of the new profile picture",
                    },
                },
                required: ["image_url"],
            },
            handler: async (args) => {
                await client.updateProfilePicture(args.image_url);
                return {
                    success: true,
                    imageUrl: args.image_url,
                };
            },
        },
        {
            name: "whatsapp_get_my_info",
            description: "Get your own WhatsApp account information",
            inputSchema: {
                type: "object",
                properties: {},
            },
            handler: async () => {
                const jid = client.getMyJid();
                const number = client.getMyNumber();
                const status = client.getConnectionStatus();
                const profilePic = await client.getProfilePicture(jid).catch(() => null);
                const myStatus = await client.getStatus(jid).catch(() => null);
                return {
                    jid,
                    number,
                    connectionStatus: status,
                    profilePicture: profilePic,
                    status: myStatus,
                    isConnected: client.isWhatsAppConnected(),
                };
            },
        },
    ];
}
