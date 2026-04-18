import { Prompt, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export class PromptHandler {
  getPrompts(): Prompt[] {
    return [
      {
        name: "whatsapp_assistant",
        description:
          "A helpful WhatsApp assistant that can send messages, manage groups, and more",
        arguments: [
          {
            name: "task",
            description: "What you want the assistant to do with WhatsApp",
            required: true,
          },
        ],
      },
      {
        name: "whatsapp_broadcast",
        description: "Send a broadcast message to multiple contacts",
        arguments: [
          {
            name: "message",
            description: "The message to broadcast",
            required: true,
          },
          {
            name: "contacts",
            description: "Comma-separated list of phone numbers",
            required: true,
          },
        ],
      },
      {
        name: "whatsapp_group_manager",
        description: "Manage WhatsApp groups",
        arguments: [
          {
            name: "action",
            description:
              "Action to perform (create, info, add_members, etc.)",
            required: true,
          },
        ],
      },
      {
        name: "whatsapp_message_analyzer",
        description: "Analyze messages from a WhatsApp chat",
        arguments: [
          {
            name: "chat_id",
            description: "The chat ID or phone number to analyze",
            required: true,
          },
          {
            name: "focus",
            description: "What aspect to focus on in the analysis",
            required: false,
          },
        ],
      },
      {
        name: "whatsapp_auto_responder",
        description:
          "Set up automated responses for WhatsApp messages",
        arguments: [
          {
            name: "trigger",
            description: "What triggers the auto response",
            required: true,
          },
          {
            name: "response",
            description: "The automatic response message",
            required: true,
          },
        ],
      },
    ];
  }

  getPrompt(
    name: string,
    args: Record<string, string>
  ): GetPromptResult {
    switch (name) {
      case "whatsapp_assistant":
        return {
          description: "WhatsApp Assistant",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `You are a WhatsApp assistant with full access to WhatsApp functionality through the available tools. 

Your capabilities include:
📨 **Messaging**: Send text, images, videos, audio, documents, locations, contacts
👥 **Groups**: Create groups, add/remove members, manage admins, get invite links
👤 **Contacts**: View contacts, check numbers, block/unblock, get profile pictures
📊 **Chat Management**: Archive, mute, pin chats, mark as read
📱 **Profile**: Update name, status, profile picture
📸 **Status**: Post text and image stories

Current task: ${args.task}

Please use the available WhatsApp tools to complete this task. Always confirm before performing destructive actions like deleting messages or leaving groups.`,
              },
            },
          ],
        };

      case "whatsapp_broadcast":
        return {
          description: "WhatsApp Broadcast Message",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Send the following message to multiple WhatsApp contacts:

Message: "${args.message}"

Contacts: ${args.contacts}

Please:
1. Parse the contacts list (comma-separated phone numbers)
2. Check each number exists on WhatsApp using whatsapp_check_number
3. Send the message to each valid contact using whatsapp_send_message
4. Report which messages were sent successfully and which failed`,
              },
            },
          ],
        };

      case "whatsapp_group_manager":
        return {
          description: "WhatsApp Group Manager",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `You are managing WhatsApp groups. Action requested: ${args.action}

Available group tools:
- whatsapp_create_group: Create new groups
- whatsapp_get_group_info: Get group details and member list
- whatsapp_add_group_participants: Add members
- whatsapp_remove_group_participants: Remove members  
- whatsapp_promote_group_admin: Make members admin
- whatsapp_demote_group_admin: Remove admin privileges
- whatsapp_update_group_name: Change group name
- whatsapp_update_group_description: Update description
- whatsapp_get_group_invite_link: Get invite link
- whatsapp_join_group: Join a group
- whatsapp_leave_group: Leave a group
- whatsapp_get_joined_groups: List all groups

Please perform the requested action with appropriate confirmation for destructive operations.`,
              },
            },
          ],
        };

      case "whatsapp_message_analyzer":
        return {
          description: "WhatsApp Message Analyzer",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Analyze the WhatsApp messages from chat: ${args.chat_id}

${args.focus ? `Focus area: ${args.focus}` : "Provide a comprehensive analysis"}

Steps:
1. Use whatsapp_get_messages to retrieve recent messages from the chat
2. Analyze the conversation for:
   - Key topics discussed
   - Message frequency and patterns
   - Sentiment analysis
   - Important information or action items
   ${args.focus ? `3. Pay special attention to: ${args.focus}` : ""}

Provide a structured summary of your findings.`,
              },
            },
          ],
        };

      case "whatsapp_auto_responder":
        return {
          description: "WhatsApp Auto Responder Setup",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Set up an auto-response for WhatsApp:

Trigger condition: ${args.trigger}
Auto response: "${args.response}"

To implement this:
1. Monitor incoming messages using the message history
2. When a message matches the trigger condition, automatically send the response
3. Use whatsapp_send_message to send the automated response
4. Keep track of which chats have received the auto-response to avoid duplicates

Note: This will monitor messages from the current session.`,
              },
            },
          ],
        };

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }
}