import { WhatsAppClient } from "../whatsapp/client.js";
import { ToolDefinition } from "./messaging.js";

export function contactTools(client: WhatsAppClient): ToolDefinition[] {
  return [
    {
      name: "whatsapp_get_contacts",
      description: "Get all WhatsApp contacts",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of contacts to return",
            default: 100,
          },
          include_groups: {
            type: "boolean",
            description: "Whether to include groups in the results",
            default: false,
          },
        },
      },
      handler: async (args: { limit?: number; include_groups?: boolean }) => {
        const contacts = await client.getContacts();
        const filtered = args.include_groups
          ? contacts
          : contacts.filter((c) => !c.isGroup);
        const limited = filtered.slice(0, args.limit || 100);
        return {
          contacts: limited,
          total: filtered.length,
        };
      },
    },

    {
      name: "whatsapp_get_contact_info",
      description: "Get information about a specific WhatsApp contact",
      inputSchema: {
        type: "object",
        properties: {
          jid: {
            type: "string",
            description: "Phone number or JID of the contact",
          },
        },
        required: ["jid"],
      },
      handler: async (args: { jid: string }) => {
        const contact = await client.getContactInfo(args.jid);
        if (!contact) {
          return { found: false, jid: args.jid };
        }
        return { found: true, ...contact };
      },
    },

    {
      name: "whatsapp_get_profile_picture",
      description: "Get the profile picture URL of a contact or group",
      inputSchema: {
        type: "object",
        properties: {
          jid: {
            type: "string",
            description: "Phone number or JID",
          },
        },
        required: ["jid"],
      },
      handler: async (args: { jid: string }) => {
        const url = await client.getProfilePicture(args.jid);
        return {
          jid: args.jid,
          profilePictureUrl: url,
          hasProfilePicture: !!url,
        };
      },
    },

    {
      name: "whatsapp_get_status",
      description: "Get the status/about text of a WhatsApp contact",
      inputSchema: {
        type: "object",
        properties: {
          jid: {
            type: "string",
            description: "Phone number or JID of the contact",
          },
        },
        required: ["jid"],
      },
      handler: async (args: { jid: string }) => {
        const status = await client.getStatus(args.jid);
        return {
          jid: args.jid,
          status,
          hasStatus: !!status,
        };
      },
    },

    {
      name: "whatsapp_check_number",
      description: "Check if a phone number is registered on WhatsApp",
      inputSchema: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description:
              "Phone number to check (with country code, no + or spaces)",
          },
        },
        required: ["phone"],
      },
      handler: async (args: { phone: string }) => {
        const exists = await client.checkNumberExists(args.phone);
        return {
          phone: args.phone,
          isOnWhatsApp: exists,
          jid: exists ? `${args.phone}@s.whatsapp.net` : null,
        };
      },
    },

    {
      name: "whatsapp_block_contact",
      description: "Block a WhatsApp contact",
      inputSchema: {
        type: "object",
        properties: {
          jid: {
            type: "string",
            description: "Phone number or JID of the contact to block",
          },
        },
        required: ["jid"],
      },
      handler: async (args: { jid: string }) => {
        await client.blockContact(args.jid);
        return {
          success: true,
          blocked: args.jid,
        };
      },
    },

    {
      name: "whatsapp_unblock_contact",
      description: "Unblock a WhatsApp contact",
      inputSchema: {
        type: "object",
        properties: {
          jid: {
            type: "string",
            description: "Phone number or JID of the contact to unblock",
          },
        },
        required: ["jid"],
      },
      handler: async (args: { jid: string }) => {
        await client.unblockContact(args.jid);
        return {
          success: true,
          unblocked: args.jid,
        };
      },
    },
  ];
}