import { WhatsAppClient } from "../whatsapp/client.js";
import { logger } from "../utils/logger.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

export function messagingTools(client: WhatsAppClient): ToolDefinition[] {
  return [
    {
      name: "whatsapp_send_message",
      description:
        "Send a text message to a WhatsApp contact or group. Use phone number (with country code) or JID format.",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description:
              "Phone number with country code (e.g., '1234567890') or WhatsApp JID (e.g., '1234567890@s.whatsapp.net') or group ID",
          },
          message: {
            type: "string",
            description: "The text message to send",
          },
        },
        required: ["to", "message"],
      },
      handler: async (args: { to: string; message: string }) => {
        const result = await client.sendTextMessage(args.to, args.message);
        return {
          success: true,
          messageId: result?.key?.id,
          to: args.to,
          message: args.message,
          timestamp: new Date().toISOString(),
        };
      },
    },

    {
      name: "whatsapp_send_image",
      description: "Send an image to a WhatsApp contact or group",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the recipient",
          },
          image_url: {
            type: "string",
            description: "URL of the image to send",
          },
          caption: {
            type: "string",
            description: "Optional caption for the image",
          },
        },
        required: ["to", "image_url"],
      },
      handler: async (args: {
        to: string;
        image_url: string;
        caption?: string;
      }) => {
        const result = await client.sendImageMessage(
          args.to,
          args.image_url,
          args.caption
        );
        return {
          success: true,
          messageId: result?.key?.id,
          to: args.to,
          imageUrl: args.image_url,
          caption: args.caption,
        };
      },
    },

    {
      name: "whatsapp_send_video",
      description: "Send a video to a WhatsApp contact or group",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the recipient",
          },
          video_url: {
            type: "string",
            description: "URL of the video to send",
          },
          caption: {
            type: "string",
            description: "Optional caption for the video",
          },
        },
        required: ["to", "video_url"],
      },
      handler: async (args: {
        to: string;
        video_url: string;
        caption?: string;
      }) => {
        const result = await client.sendVideoMessage(
          args.to,
          args.video_url,
          args.caption
        );
        return {
          success: true,
          messageId: result?.key?.id,
          to: args.to,
          videoUrl: args.video_url,
        };
      },
    },

    {
      name: "whatsapp_send_audio",
      description:
        "Send an audio file or voice note to a WhatsApp contact or group",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the recipient",
          },
          audio_url: {
            type: "string",
            description: "URL of the audio file to send",
          },
          is_voice_note: {
            type: "boolean",
            description: "Whether to send as a voice note (PTT)",
            default: false,
          },
        },
        required: ["to", "audio_url"],
      },
      handler: async (args: {
        to: string;
        audio_url: string;
        is_voice_note?: boolean;
      }) => {
        const result = await client.sendAudioMessage(
          args.to,
          args.audio_url,
          args.is_voice_note || false
        );
        return {
          success: true,
          messageId: result?.key?.id,
          to: args.to,
        };
      },
    },

    {
      name: "whatsapp_send_document",
      description: "Send a document/file to a WhatsApp contact or group",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the recipient",
          },
          document_url: {
            type: "string",
            description: "URL of the document to send",
          },
          filename: {
            type: "string",
            description: "Name of the file",
          },
          mimetype: {
            type: "string",
            description: "MIME type of the document",
            default: "application/pdf",
          },
        },
        required: ["to", "document_url", "filename"],
      },
      handler: async (args: {
        to: string;
        document_url: string;
        filename: string;
        mimetype?: string;
      }) => {
        const result = await client.sendDocumentMessage(
          args.to,
          args.document_url,
          args.filename,
          args.mimetype
        );
        return {
          success: true,
          messageId: result?.key?.id,
          to: args.to,
          filename: args.filename,
        };
      },
    },

    {
      name: "whatsapp_send_location",
      description: "Send a location to a WhatsApp contact or group",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the recipient",
          },
          latitude: {
            type: "number",
            description: "Latitude coordinate",
          },
          longitude: {
            type: "number",
            description: "Longitude coordinate",
          },
          name: {
            type: "string",
            description: "Optional name of the location",
          },
          address: {
            type: "string",
            description: "Optional address of the location",
          },
        },
        required: ["to", "latitude", "longitude"],
      },
      handler: async (args: {
        to: string;
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
      }) => {
        const result = await client.sendLocationMessage(
          args.to,
          args.latitude,
          args.longitude,
          args.name,
          args.address
        );
        return {
          success: true,
          messageId: result?.key?.id,
          to: args.to,
          coordinates: { lat: args.latitude, lng: args.longitude },
        };
      },
    },

    {
      name: "whatsapp_send_contact",
      description: "Send a contact card to a WhatsApp user",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the recipient",
          },
          contact_name: {
            type: "string",
            description: "Name of the contact to send",
          },
          contact_number: {
            type: "string",
            description:
              "Phone number of the contact to send (without + or spaces)",
          },
        },
        required: ["to", "contact_name", "contact_number"],
      },
      handler: async (args: {
        to: string;
        contact_name: string;
        contact_number: string;
      }) => {
        const result = await client.sendContactMessage(
          args.to,
          args.contact_name,
          args.contact_number
        );
        return {
          success: true,
          messageId: result?.key?.id,
          to: args.to,
          contactName: args.contact_name,
        };
      },
    },

    {
      name: "whatsapp_send_reaction",
      description: "React to a message with an emoji",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the chat",
          },
          message_id: {
            type: "string",
            description: "ID of the message to react to",
          },
          emoji: {
            type: "string",
            description: "Emoji reaction (e.g., '❤️', '👍', '😂')",
          },
        },
        required: ["to", "message_id", "emoji"],
      },
      handler: async (args: {
        to: string;
        message_id: string;
        emoji: string;
      }) => {
        await client.sendReactionMessage(args.to, args.message_id, args.emoji);
        return {
          success: true,
          to: args.to,
          messageId: args.message_id,
          emoji: args.emoji,
        };
      },
    },

    {
      name: "whatsapp_reply_message",
      description: "Reply to a specific message",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the chat",
          },
          message_id: {
            type: "string",
            description: "ID of the message to reply to",
          },
          reply_text: {
            type: "string",
            description: "The reply text",
          },
        },
        required: ["to", "message_id", "reply_text"],
      },
      handler: async (args: {
        to: string;
        message_id: string;
        reply_text: string;
      }) => {
        const result = await client.sendQuotedMessage(
          args.to,
          args.reply_text,
          args.message_id
        );
        return {
          success: true,
          messageId: result?.key?.id,
          replyTo: args.message_id,
        };
      },
    },

    {
      name: "whatsapp_delete_message",
      description: "Delete a sent message",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the chat",
          },
          message_id: {
            type: "string",
            description: "ID of the message to delete",
          },
          for_everyone: {
            type: "boolean",
            description: "Whether to delete for everyone or just yourself",
            default: true,
          },
        },
        required: ["to", "message_id"],
      },
      handler: async (args: {
        to: string;
        message_id: string;
        for_everyone?: boolean;
      }) => {
        await client.deleteMessage(
          args.to,
          args.message_id,
          args.for_everyone !== false
        );
        return {
          success: true,
          deletedMessageId: args.message_id,
        };
      },
    },

    {
      name: "whatsapp_mark_as_read",
      description: "Mark messages as read",
      inputSchema: {
        type: "object",
        properties: {
          jid: {
            type: "string",
            description: "Phone number or JID of the chat",
          },
          message_ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of message IDs to mark as read",
          },
        },
        required: ["jid", "message_ids"],
      },
      handler: async (args: { jid: string; message_ids: string[] }) => {
        await client.markAsRead(args.jid, args.message_ids);
        return {
          success: true,
          markedCount: args.message_ids.length,
        };
      },
    },

    {
      name: "whatsapp_send_typing",
      description: "Send typing indicator to a chat",
      inputSchema: {
        type: "object",
        properties: {
          jid: {
            type: "string",
            description: "Phone number or JID of the chat",
          },
          is_typing: {
            type: "boolean",
            description: "True to start typing, false to stop",
            default: true,
          },
        },
        required: ["jid"],
      },
      handler: async (args: { jid: string; is_typing?: boolean }) => {
        await client.sendTyping(args.jid, args.is_typing !== false);
        return {
          success: true,
          isTyping: args.is_typing !== false,
        };
      },
    },

    {
      name: "whatsapp_send_buttons",
      description: "Send a message with interactive buttons",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the recipient",
          },
          text: {
            type: "string",
            description: "The message body text",
          },
          footer: {
            type: "string",
            description: "Footer text",
          },
          buttons: {
            type: "array",
            description: "Array of buttons",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Button ID" },
                text: { type: "string", description: "Button label text" },
              },
              required: ["id", "text"],
            },
          },
        },
        required: ["to", "text", "buttons"],
      },
      handler: async (args: {
        to: string;
        text: string;
        footer?: string;
        buttons: Array<{ id: string; text: string }>;
      }) => {
        const result = await client.sendButtonMessage(
          args.to,
          args.text,
          args.footer || "",
          args.buttons
        );
        return {
          success: true,
          messageId: result?.key?.id,
        };
      },
    },

    {
      name: "whatsapp_send_list",
      description: "Send a message with a list menu",
      inputSchema: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Phone number or JID of the recipient",
          },
          text: {
            type: "string",
            description: "The message body text",
          },
          footer: {
            type: "string",
            description: "Footer text",
          },
          title: {
            type: "string",
            description: "Title of the list",
          },
          button_text: {
            type: "string",
            description: "Text for the button that opens the list",
          },
          sections: {
            type: "array",
            description: "Array of sections with rows",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                rows: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["id", "title"],
                  },
                },
              },
              required: ["title", "rows"],
            },
          },
        },
        required: ["to", "text", "button_text", "sections"],
      },
      handler: async (args: {
        to: string;
        text: string;
        footer?: string;
        title?: string;
        button_text: string;
        sections: Array<{
          title: string;
          rows: Array<{ id: string; title: string; description?: string }>;
        }>;
      }) => {
        const result = await client.sendListMessage(
          args.to,
          args.text,
          args.footer || "",
          args.title || "",
          args.button_text,
          args.sections
        );
        return {
          success: true,
          messageId: result?.key?.id,
        };
      },
    },

    {
      name: "whatsapp_get_messages",
      description:
        "Get recent messages from a chat",
      inputSchema: {
        type: "object",
        properties: {
          jid: {
            type: "string",
            description: "Phone number or JID of the chat",
          },
          limit: {
            type: "number",
            description: "Number of messages to retrieve (default: 20, max: 100)",
            default: 20,
          },
        },
        required: ["jid"],
      },
      handler: async (args: { jid: string; limit?: number }) => {
        const messages = await client.getChatMessages(
          args.jid,
          Math.min(args.limit || 20, 100)
        );
        return {
          chat: args.jid,
          messages: messages.map((msg) => ({
            id: msg.id,
            from: msg.from,
            sender: msg.sender,
            body: msg.body,
            type: msg.type,
            timestamp: new Date(msg.timestamp * 1000).toISOString(),
            isGroup: msg.isGroup,
            hasMedia: msg.hasMedia,
            mediaType: msg.mediaType,
          })),
          count: messages.length,
        };
      },
    },

    {
      name: "whatsapp_get_chats",
      description: "Get list of all WhatsApp chats",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of chats to return",
            default: 50,
          },
        },
      },
      handler: async (args: { limit?: number }) => {
        const chats = await client.getChats();
        const limitedChats = chats.slice(0, args.limit || 50);
        return {
          chats: limitedChats.map((chat) => ({
            id: chat.id,
            name: chat.name,
            isGroup: chat.id?.endsWith("@g.us"),
            unreadCount: chat.unreadCount || 0,
            conversationTimestamp: chat.conversationTimestamp,
          })),
          total: chats.length,
        };
      },
    },
  ];
}