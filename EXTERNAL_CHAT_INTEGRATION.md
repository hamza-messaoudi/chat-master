# External Chat Integration Guide

This document provides instructions for integrating our customer support chat widget into your website.

## 1. Using the Widget Script

The simplest way to add chat functionality to your website is to include our widget script:

```html
<!-- Add this to your HTML before the closing </body> tag -->
<script src="https://your-domain.replit.app/chat-widget.js"></script>

<script>
  // Initialize the chat widget with your API key
  document.addEventListener('DOMContentLoaded', function() {
    ChatWidget.init({
      apiKey: 'your-api-key',
      // Optional: Override default colors
      theme: {
        primary: '#3a7bd5',    // Primary color
        secondary: '#00d2ff',  // Secondary color for gradients
        textLight: '#ffffff',  // Text color on dark backgrounds
        textDark: '#333333'    // Text color on light backgrounds
      }
    });
  });
</script>
```

### Configuration Options

The `ChatWidget.init()` method accepts the following options:

| Option | Type | Description |
|--------|------|-------------|
| apiKey | String | **Required.** Your API key for authentication |
| baseUrl | String | Optional. Override the API endpoint URL |
| customerId | String | Optional. Custom ID for the current customer |
| theme | Object | Optional. Custom color theme for the widget |

## 2. Using the Embeddable Component

For React applications, you can use our React component directly:

```jsx
import { EmbeddableChat } from '@your-domain/chat-component';

function YourComponent() {
  return (
    <div>
      <h1>Your Website</h1>
      
      {/* Add the chat component */}
      <EmbeddableChat 
        apiKey="your-api-key"
        fullPage={false}  // Set to true for full-page mode
      />
    </div>
  );
}
```

## 3. Using the API Directly

For more control, you can use our JavaScript API client:

```javascript
import { ExternalChatClient } from '@your-domain/chat-api';

// Create a new client
const chatClient = new ExternalChatClient({
  apiKey: 'your-api-key',
  onMessageReceived: (message) => {
    console.log('New message:', message);
    // Update your UI
  },
  onTypingChanged: (data) => {
    console.log('Typing status:', data);
    // Show/hide typing indicator
  },
  onConnectionChanged: (isConnected) => {
    console.log('Connection status:', isConnected);
    // Update connection status UI
  }
});

// Initialize the client
await chatClient.initialize();

// Send a message
await chatClient.sendMessage('Hello, I need help with my order');

// Send typing indicator
chatClient.sendTypingIndicator(true);
```

## Special Commands

The chat system supports special commands that can be sent as messages:

| Command | Example | Description |
|---------|---------|-------------|
| $dob | $dob 1990-01-15 | Sets the customer's birthdate and triggers the flashback profile |
| $order | $order ABC123 | Associates the message with a specific order number |
| $help | $help | Shows available commands |

## API Reference

### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/partner/conversations` | POST | Create a new conversation |
| `/api/partner/conversations/:customerId` | GET | Get customer conversations |
| `/api/partner/messages` | POST | Send a message |
| `/api/partner/messages/:conversationId` | GET | Get conversation messages |
| `/api/customers/:id` | PATCH | Update customer data |
| `/api/customers/:id/flashback` | GET | Get customer flashback profile |
| `/api/conversations/:id/status` | PATCH | Update conversation status |

### WebSocket API

Connect to `/ws?clientId={customerId}` to receive real-time updates.

#### Message Types

| Type | Description |
|------|-------------|
| message | New message in conversation |
| typing | Agent is typing indicator |
| flashback | Flashback profile generated |

## Getting Your API Key

Contact our partner team at partners@yourdomain.com to request an API key for your domain.