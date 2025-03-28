import { storage } from "./storage";
import { Request, Response } from "express";
import { Message, Conversation } from "@shared/schema";
import OpenAI from "openai";
import { WebSocket } from "ws";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a response using the OpenAI API
 * This function connects to the OpenAI API and generates a response
 * based on the conversation context and system prompt
 */
export async function generateLlmResponse(
  conversation: Conversation,
  messages: Message[],
  systemPrompt?: string | null,
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
      content: systemPrompt ? 
        systemPrompt :
        `You are a helpful customer support agent. 
        The customer ID is ${conversation.customerId}. 
        The conversation status is ${conversation.status}.
        
        Respond based on the conversation history and be professional and helpful.`,
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
    const { conversationId, promptId, customPrompt, autoSend } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    // Get conversation and messages
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await storage.getMessagesByConversationId(conversationId);

    // Handle system prompt
    let systemPrompt: string | undefined;
    
    // If a prompt ID is provided, get the stored system prompt
    if (promptId) {
      const prompt = await storage.getLlmPrompt(promptId);
      if (prompt) {
        systemPrompt = prompt.systemPrompt || undefined;
      }
    }
    
    // If custom prompt is provided, use as system prompt instead
    if (customPrompt) {
      systemPrompt = customPrompt;
    }

    // Generate the response using the conversation and system prompt
    const generatedResponse = await generateLlmResponse(
      conversation,
      messages,
      systemPrompt,
    );

    // If autoSend is true, send the message directly to the conversation
    if (autoSend === true) {
      // Import the WebSocket clients map
      const { clients } = require('./routes');
      
      // If there's an agent assigned, get their automationDelay setting
      let automationDelay = 3000; // Default delay is 3 seconds (3000ms)
      if (conversation.agentId) {
        try {
          const agent = await storage.getUser(conversation.agentId);
          // Convert milliseconds to seconds (UI shows seconds, DB stores milliseconds)
          if (agent && typeof agent.automationDelay === 'number') {
            automationDelay = agent.automationDelay;
          }
        } catch (error) {
          console.warn('Error getting agent automation delay, using default:', error);
        }
      }
      
      // Send a typing indicator first to show "agent is typing..."
      const customerWs = clients.get(conversation.customerId);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(JSON.stringify({
          type: 'typing',
          payload: { 
            conversationId: conversation.id, 
            isTyping: true,
            isAgent: true
          }
        }));
      }
      
      // Use the agent's automationDelay setting to determine when to send the actual message
      setTimeout(async () => {
        // Create a new message from the agent
        const newMessage = await storage.createMessage({
          conversationId,
          senderId: `agent-${conversation.agentId || 1}`, // Use conversation's agent ID or default to 1
          isFromAgent: true,
          content: generatedResponse
        });
        
        // Stop typing indicator
        if (customerWs && customerWs.readyState === WebSocket.OPEN) {
          customerWs.send(JSON.stringify({
            type: 'typing',
            payload: { 
              conversationId: conversation.id, 
              isTyping: false,
              isAgent: true
            }
          }));
          
          // Send the actual message
          customerWs.send(JSON.stringify({
            type: 'message',
            payload: newMessage
          }));
        }
        
        // Broadcast to the agent if assigned
        if (conversation.agentId) {
          const agentWs = clients.get(`agent-${conversation.agentId}`);
          if (agentWs && agentWs.readyState === WebSocket.OPEN) {
            agentWs.send(JSON.stringify({
              type: 'message',
              payload: newMessage
            }));
          }
        }
        
        console.log(`Auto-response for conversation ${conversationId} sent after ${automationDelay}ms delay`);
      }, automationDelay);
      
      // Return immediate acknowledgement that the message will be sent
      return res.status(200).json({ 
        status: 'scheduled',
        delay: automationDelay,
        response: generatedResponse
      });
    }
    
    // Otherwise just return the generated response to be added to input field
    res.status(200).json({ response: generatedResponse });
  } catch (error) {
    console.error("Error generating LLM response:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
}
