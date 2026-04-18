export function groupTools(client) {
    return [
        {
            name: "whatsapp_create_group",
            description: "Create a new WhatsApp group",
            inputSchema: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Name of the group",
                    },
                    participants: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of phone numbers or JIDs to add to the group",
                    },
                },
                required: ["name", "participants"],
            },
            handler: async (args) => {
                const result = await client.createGroup(args.name, args.participants);
                return {
                    success: true,
                    groupId: result.id,
                    name: args.name,
                    participants: args.participants,
                };
            },
        },
        {
            name: "whatsapp_get_group_info",
            description: "Get information about a WhatsApp group",
            inputSchema: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "Group JID (e.g., '123456789@g.us')",
                    },
                },
                required: ["group_id"],
            },
            handler: async (args) => {
                const info = await client.getGroupMetadata(args.group_id);
                return info;
            },
        },
        {
            name: "whatsapp_add_group_participants",
            description: "Add participants to a WhatsApp group",
            inputSchema: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "Group JID",
                    },
                    participants: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of phone numbers or JIDs to add",
                    },
                },
                required: ["group_id", "participants"],
            },
            handler: async (args) => {
                const result = await client.addGroupParticipants(args.group_id, args.participants);
                return {
                    success: true,
                    groupId: args.group_id,
                    added: args.participants,
                    result,
                };
            },
        },
        {
            name: "whatsapp_remove_group_participants",
            description: "Remove participants from a WhatsApp group",
            inputSchema: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "Group JID",
                    },
                    participants: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of phone numbers or JIDs to remove",
                    },
                },
                required: ["group_id", "participants"],
            },
            handler: async (args) => {
                const result = await client.removeGroupParticipants(args.group_id, args.participants);
                return {
                    success: true,
                    groupId: args.group_id,
                    removed: args.participants,
                    result,
                };
            },
        },
        {
            name: "whatsapp_promote_group_admin",
            description: "Promote participants to admin in a WhatsApp group",
            inputSchema: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "Group JID",
                    },
                    participants: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of phone numbers or JIDs to promote",
                    },
                },
                required: ["group_id", "participants"],
            },
            handler: async (args) => {
                const result = await client.promoteGroupParticipants(args.group_id, args.participants);
                return {
                    success: true,
                    groupId: args.group_id,
                    promoted: args.participants,
                    result,
                };
            },
        },
        {
            name: "whatsapp_demote_group_admin",
            description: "Demote admins to regular participants in a WhatsApp group",
            inputSchema: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "Group JID",
                    },
                    participants: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of phone numbers or JIDs to demote",
                    },
                },
                required: ["group_id", "participants"],
            },
            handler: async (args) => {
                const result = await client.demoteGroupParticipants(args.group_id, args.participants);
                return {
                    success: true,
                    groupId: args.group_id,
                    demoted: args.participants,
                    result,
                };
            },
        },
        {
            name: "whatsapp_update_group_name",
            description: "Update the name/subject of a WhatsApp group",
            inputSchema: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "Group JID",
                    },
                    name: {
                        type: "string",
                        description: "New name for the group",
                    },
                },
                required: ["group_id", "name"],
            },
            handler: async (args) => {
                await client.updateGroupSubject(args.group_id, args.name);
                return {
                    success: true,
                    groupId: args.group_id,
                    newName: args.name,
                };
            },
        },
        {
            name: "whatsapp_update_group_description",
            description: "Update the description of a WhatsApp group",
            inputSchema: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "Group JID",
                    },
                    description: {
                        type: "string",
                        description: "New description for the group",
                    },
                },
                required: ["group_id", "description"],
            },
            handler: async (args) => {
                await client.updateGroupDescription(args.group_id, args.description);
                return {
                    success: true,
                    groupId: args.group_id,
                    description: args.description,
                };
            },
        },
        {
            name: "whatsapp_get_group_invite_link",
            description: "Get the invite link for a WhatsApp group",
            inputSchema: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "Group JID",
                    },
                },
                required: ["group_id"],
            },
            handler: async (args) => {
                const code = await client.getInviteCode(args.group_id);
                return {
                    success: true,
                    groupId: args.group_id,
                    inviteCode: code,
                    inviteLink: `https://chat.whatsapp.com/${code}`,
                };
            },
        },
        {
            name: "whatsapp_join_group",
            description: "Join a WhatsApp group using an invite code or link",
            inputSchema: {
                type: "object",
                properties: {
                    invite_code: {
                        type: "string",
                        description: "Invite code or full invite link (https://chat.whatsapp.com/CODE)",
                    },
                },
                required: ["invite_code"],
            },
            handler: async (args) => {
                // BUG 8 FIX: use URL parsing to correctly strip path AND any query parameters
                // e.g. "https://chat.whatsapp.com/AbCd123?utm_source=share" → "AbCd123"
                let code = args.invite_code.trim();
                if (code.includes("chat.whatsapp.com/")) {
                    try {
                        const url = new URL(code.startsWith("http") ? code : `https://${code}`);
                        // pathname is "/AbCd123" — slice off the leading slash
                        code = url.pathname.slice(1);
                    }
                    catch {
                        // Fallback: plain split if URL parsing fails
                        code = code.split("chat.whatsapp.com/")[1].split("?")[0];
                    }
                }
                const result = await client.joinGroupByInvite(code);
                return {
                    success: true,
                    groupId: result,
                    inviteCode: code,
                };
            },
        },
        {
            name: "whatsapp_leave_group",
            description: "Leave a WhatsApp group",
            inputSchema: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "Group JID",
                    },
                },
                required: ["group_id"],
            },
            handler: async (args) => {
                await client.leaveGroup(args.group_id);
                return {
                    success: true,
                    leftGroup: args.group_id,
                };
            },
        },
        {
            name: "whatsapp_get_joined_groups",
            description: "Get all WhatsApp groups you are a member of",
            inputSchema: {
                type: "object",
                properties: {},
            },
            handler: async () => {
                const groups = await client.getJoinedGroups();
                return {
                    groups: groups.map((g) => ({
                        id: g.id,
                        name: g.name || g.subject,
                        unreadCount: g.unreadCount || 0,
                    })),
                    total: groups.length,
                };
            },
        },
    ];
}
