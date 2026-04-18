export function statusTools(client) {
    return [
        {
            name: "whatsapp_post_text_status",
            description: "Post a text status/story on WhatsApp",
            inputSchema: {
                type: "object",
                properties: {
                    text: {
                        type: "string",
                        description: "Text content of the status",
                    },
                    background_color: {
                        type: "string",
                        description: "Background color in hex format (e.g., '#075E54')",
                        default: "#075E54",
                    },
                },
                required: ["text"],
            },
            handler: async (args) => {
                await client.sendTextStatus(args.text, args.background_color || "#075E54");
                return {
                    success: true,
                    text: args.text,
                    backgroundColor: args.background_color || "#075E54",
                };
            },
        },
        {
            name: "whatsapp_post_image_status",
            description: "Post an image status/story on WhatsApp",
            inputSchema: {
                type: "object",
                properties: {
                    image_url: {
                        type: "string",
                        description: "URL of the image for the status",
                    },
                    caption: {
                        type: "string",
                        description: "Optional caption for the image status",
                    },
                },
                required: ["image_url"],
            },
            handler: async (args) => {
                await client.sendImageStatus(args.image_url, args.caption);
                return {
                    success: true,
                    imageUrl: args.image_url,
                    caption: args.caption,
                };
            },
        },
    ];
}
