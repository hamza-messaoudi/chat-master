import { storage } from "./storage";
import { Request, Response } from "express";
import { Message, Conversation } from "@shared/schema";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a response using the OpenAI API
 * This function connects to the OpenAI API and generates a response
 * based on the conversation context and prompt
 */
export async function generateLlmResponse(
  prompt: string,
  conversation: Conversation,
  messages: Message[],
  promptTemplate?: string,
): Promise<string> {
  try {
    // Format the conversation history for context
    const recentMessages = messages.slice(-10).map(
      (msg) =>
        ({
          role: msg.isFromAgent ? "assistant" : "user",
          content: msg.content,
        }) as OpenAI.ChatCompletionMessageParam,
    );

    // Create a system message with instructions and context
    const systemMessage: OpenAI.ChatCompletionSystemMessageParam = {
      role: "system",
      content: `You are a helpful customer support agent. 
      The customer ID is ${conversation.customerId}. 
      The conversation status is ${conversation.status}.
      
      ${promptTemplate ? `Use the following template for your response: ${promptTemplate}` : ""}
      
      ${prompt}`,
    };

    // Combine all messages for the API request
    const apiMessages: OpenAI.ChatCompletionMessageParam[] = [
      systemMessage,
      ...recentMessages,
    ];

    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 500,
    });

    // Return the generated response
    return (
      response.choices[0]?.message?.content ||
      "Je rencontre actuellement des difficultés techniques. Veuillez réessayer sous peu."
    );
  } catch (error) {
    console.error("Error calling OpenAI API:", error);

    // Return a fallback response if the API call fails
    return "Je rencontre actuellement des difficultés techniques. Veuillez réessayer sous peu.";
  }
}

/**
 * Middleware to handle LLM requests
 */
export async function handleLlmRequest(req: Request, res: Response) {
  try {
    const { conversationId, promptId, customPrompt } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    // Get conversation and messages
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await storage.getMessagesByConversationId(conversationId);

    let promptText = "Please provide a helpful response.";
    let promptTemplate;

    // If a prompt ID is provided, get the prompt from storage
    if (promptId) {
      const prompt = await storage.getLlmPrompt(promptId);
      if (prompt) {
        promptText = prompt.prompt;
        promptTemplate = prompt.title;
      }
    }

    // If a custom prompt is provided, use that instead
    if (customPrompt) {
      promptText = customPrompt;
    }

    // Generate the response
    const response = await generateLlmResponse(
      promptText,
      conversation,
      messages,
      promptTemplate,
    );

    res.status(200).json({ response });
  } catch (error) {
    console.error("Error generating LLM response:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
}
