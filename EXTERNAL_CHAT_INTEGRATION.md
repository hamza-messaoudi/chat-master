# External Chat Integration Guide

This documentation provides specifications on how to implement an external chat service that interfaces directly with customers and connects to our customer support agent system via APIs.

## Table of Contents

1. [Introduction](#introduction)
2. [Integration Options](#integration-options)
3. [Authentication & Security](#authentication--security)
4. [JavaScript Widget Integration](#javascript-widget-integration)
5. [API Reference](#api-reference)
6. [WebSocket Real-time Communication](#websocket-real-time-communication)
7. [Message Format & Data Models](#message-format--data-models)
8. [Advanced Features](#advanced-features)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Introduction

Our customer support platform provides a robust API that allows external services to connect with our agent platform. This integration allows your customers to communicate with support agents through your own interfaces while leveraging our advanced customer support capabilities.

Key features available through our integration:
- Real-time messaging between customers and agents
- Message status tracking (read/unread)
- Typing indicators
- Conversation management
- Automated LLM responses
- Customer data sync (including personalization via Flashback profiles)

## Integration Options

There are two primary ways to integrate with our platform:

1. **JavaScript Widget (Recommended)**: A pre-built chat widget that can be embedded into your website with minimal configuration.
2. **Direct API Integration**: For custom implementations or mobile applications, use our RESTful APIs and WebSocket connections.

## Authentication & Security

All API requests require authentication using an API key. Each partner is assigned a unique API key that should be included in the Authorization header of all requests.

### Partner Registration

Before you can integrate with our platform, you need to register as a partner and obtain an API key.

```
POST /api/partner/register
```

Request body:
```json
{
  "name": "Your Company Name",
  "domain": "yourdomain.com"
}
```

Response:
```json
{
  "message": "Partner successfully registered",
  "partnerId": "partner-12345678",
  "apiKey": "your-api-key",
  "name": "Your Company Name",
  "domain": "yourdomain.com"
}
```

**IMPORTANT: Store this API key securely. It will be needed for all subsequent API requests.**

### Authorization

Include your API key in the Authorization header of all requests:

```
Authorization: Bearer your-api-key
```

## JavaScript Widget Integration

The easiest way to integrate with our platform is to use our JavaScript widget.

### Basic Installation

Add the following script to your website's HTML:

```html
<script src="https://your-domain.com/widget/chat-widget.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    ChatWidget.init({
      apiKey: 'your-api-key',
      customerId: 'unique-customer-id'  // Optional - will generate one if not provided
    });
  });
</script>
```

### Widget Customization

The widget can be customized with additional configuration options:

```javascript
ChatWidget.init({
  apiKey: 'your-api-key',
  customerId: 'unique-customer-id',
  baseUrl: 'https://your-custom-url.com', // Optional - defaults to window.location.origin
  theme: {
    primaryColor: '#3a7bd5',
    headerText: 'Customer Support',
    welcomeMessage: 'Hello! How can we help you today?'
  }
});
```

## API Reference

### Conversations

#### Create a new conversation

```
POST /api/partner/conversations
```

Request body:
```json
{
  "customerId": "customer-12345"
}
```

Response:
```json
{
  "id": 1,
  "customerId": "customer-12345",
  "status": "waiting",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

#### Get conversations for a customer

```
GET /api/partner/conversations/:customerId
```

Response:
```json
[
  {
    "id": 1,
    "customerId": "customer-12345",
    "agentId": 2,
    "status": "active",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### Messages

#### Send a message

```
POST /api/partner/messages
```

Request body:
```json
{
  "conversationId": 1,
  "senderId": "customer-12345",
  "content": "Hello, I need help with my order",
  "isFromAgent": false,
  "metadata": {
    "commandType": "order_lookup",
    "value": "ORD-12345"
  }
}
```

Response:
```json
{
  "id": 1,
  "conversationId": 1,
  "senderId": "customer-12345",
  "content": "Hello, I need help with my order",
  "isFromAgent": false,
  "timestamp": "2023-01-01T00:00:00.000Z",
  "readStatus": false,
  "metadata": {
    "commandType": "order_lookup",
    "value": "ORD-12345"
  }
}
```

> Note: The `metadata` field is optional and can be used to include additional structured data with messages.

#### Get messages for a conversation

```
GET /api/partner/messages/:conversationId
```

Response:
```json
[
  {
    "id": 1,
    "conversationId": 1,
    "senderId": "customer-12345",
    "content": "Hello, I need help with my order",
    "isFromAgent": false,
    "timestamp": "2023-01-01T00:00:00.000Z",
    "readStatus": true
  },
  {
    "id": 2,
    "conversationId": 1,
    "senderId": "agent-2",
    "content": "Hi there! How can I help you with your order?",
    "isFromAgent": true,
    "timestamp": "2023-01-01T00:00:05.000Z",
    "readStatus": false
  }
]
```

### Customer Data

#### Update customer data

To enhance the customer experience, you can update customer data including their date of birth for Flashback personality insights:

```
PATCH /api/customers/:customerId
```

Request body:
```json
{
  "email": "customer@example.com",
  "name": "John Doe",
  "birthdate": "1990-01-15"
}
```

Response:
```json
{
  "id": "customer-12345",
  "email": "customer@example.com",
  "name": "John Doe",
  "birthdate": "1990-01-15",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

## WebSocket Real-time Communication

For real-time updates, connect to our WebSocket endpoint:

```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//your-domain.com/ws?clientId=customer-12345`);

// Listen for messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
  
  // Handle different message types
  if (data.type === 'message') {
    // Handle new message from agent
    displayMessage(data.payload);
  } else if (data.type === 'typing') {
    // Handle typing indicator
    showTypingIndicator(data.payload.isTyping);
  } else if (data.type === 'status') {
    // Handle status update (agent assigned, etc.)
    updateConversationStatus(data.payload);
  }
};

// Send message via WebSocket
ws.send(JSON.stringify({
  type: 'message',
  payload: {
    conversationId: 1,
    content: 'Hello, I need help',
    senderId: 'customer-12345',
    isFromAgent: false
  }
}));

// Send typing indicator
ws.send(JSON.stringify({
  type: 'typing',
  payload: {
    conversationId: 1,
    isTyping: true,
    isAgent: false
  }
}));
```

### WebSocket Message Types

| Type        | Description                                 | Payload                                                   |
|-------------|---------------------------------------------|-----------------------------------------------------------|
| `message`   | A new message in the conversation           | Message object (see Message Format section)               |
| `typing`    | Typing indicator status                     | `{ conversationId, isTyping, [isAgent] }`                 |
| `status`    | Conversation status change                  | `{ conversationId, status, agentId }`                     |
| `read`      | Message read receipt                        | `{ conversationId, messageId }`                           |
| `flashback` | Customer personality insights are available | Flashback profile object                                 |

## Message Format & Data Models

### Message Object

```typescript
{
  id: number;              // Unique message ID
  conversationId: number;  // The conversation this message belongs to
  senderId: string;        // ID of sender (customer-id or agent-id)
  content: string;         // Message text content
  isFromAgent: boolean;    // True if sent by an agent, false if from customer
  timestamp: string;       // ISO timestamp of when message was sent
  readStatus: boolean;     // Whether the message has been read
  metadata?: {             // Optional metadata for special message types
    commandType?: string;  // Type of command embedded in message
    value?: any;           // Additional data associated with command
  }
}
```

### Conversation Object

```typescript
{
  id: number;              // Unique conversation ID
  customerId: string;      // Customer ID for this conversation
  agentId?: number;        // Agent ID if assigned, null if unassigned
  status: string;          // Status: 'waiting', 'active', 'closed'
  createdAt: string;       // ISO timestamp of when conversation was created
  updatedAt: string;       // ISO timestamp of when conversation was last updated
}
```

### Flashback Profile Object

```typescript
{
  flashBack: {
    firstEventDate: {
      month: string;       // Month when first significant event occurred
      year: number;        // Year when first significant event occurred
    },
    firstEventTrait: string; // Personality trait associated with first event
    secondEventDate: {
      month: string;       // Month when second significant event occurred
      year: number;        // Year when second significant event occurred
    },
    secondEventTrait: string; // Personality trait associated with second event
  }
}
```

## Advanced Features

### Typing Indicators

Typing indicators allow real-time feedback when a user is typing a message.

To send a typing indicator:
```javascript
ws.send(JSON.stringify({
  type: 'typing',
  payload: {
    conversationId: 1,
    isTyping: true,
    isAgent: false
  }
}));
```

To clear a typing indicator, send the same message with `isTyping: false`.

### Message Metadata

The metadata field allows you to include structured data with messages for special functionality:

```javascript
// Example: Send a message with order lookup metadata
const message = {
  conversationId: 1,
  senderId: "customer-12345",
  content: "I need help finding my order #ORD-12345",
  isFromAgent: false,
  metadata: {
    commandType: "order_lookup",
    value: "ORD-12345"
  }
};
```

This can be used to trigger specific actions in either the agent interface or your custom integration.

### Flashback Customer Profiling

If a customer's birthdate is provided, our system will generate a Flashback profile with personality insights that can help agents provide more personalized support.

To receive Flashback profiles, listen for WebSocket messages with type `flashback`:

```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'flashback') {
    displayFlashbackProfile(data.payload);
  }
};
```

## Best Practices

1. **Error Handling**: Always implement proper error handling for both API requests and WebSocket connections.

2. **Reconnection Logic**: Implement automatic reconnection for WebSocket connections with exponential backoff.

3. **Message Queueing**: If WebSocket connection is lost, queue messages and send them when connection is restored.

4. **Security**: Never expose your API key in client-side code. Use a server-side proxy if implementing a custom solution.

5. **User Identification**: Use consistent customer IDs across sessions to maintain conversation history.

6. **Polling Fallback**: Implement REST API polling as a fallback if WebSocket connections are not possible.

7. **Mobile Considerations**: For mobile apps, handle application background/foreground transitions appropriately.

## Troubleshooting

### Common Issues

1. **401 Unauthorized Errors**
   - Check that your API key is correct and included in the Authorization header.
   - Ensure the format is exactly: `Authorization: Bearer your-api-key`

2. **WebSocket Connection Failures**
   - Verify the WebSocket URL is correct, including the protocol (ws:// or wss://)
   - Ensure the clientId parameter is included in the URL

3. **Missing Messages**
   - If WebSocket disconnects, messages may be missed. Implement periodic polling as a fallback.
   - After reconnection, fetch recent messages to sync the conversation.

### Support

For additional support, please contact our partner support team at partners@example.com.