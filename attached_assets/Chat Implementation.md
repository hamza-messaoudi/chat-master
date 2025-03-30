# Floating Chat Component Integration

This document outlines the implementation plan for a floating chat component in the Next.js Supabase SaaS Starter Kit (Lite). The chat component will interface with an external chat service via RESTful APIs and WebSocket connections, allowing real-time messaging between customers and support agents.

## 1. Introduction

The chat component is designed to provide a seamless communication channel for end users, enabling them to send and receive messages in real time. This integration leverages our external chat service, which supports:

*   Real-time messaging
*   Message status tracking (read/unread)
*   Typing indicators
*   Conversation management
*   Automated LLM responses
*   Customer data synchronization (including Flashback profiles)

## 2. Goals and Objectives

*   **Enhance User Engagement:** Provide immediate support and improve customer interaction.
*   **Real-time Communication:** Utilize WebSocket connections for instantaneous message exchanges.
*   **Robust Integration:** Secure API key based authentication and direct API integration for sending and retrieving conversations and messages.
*   **User Flexibility:** Support for both authenticated and unauthenticated users maintaining conversation continuity.
*   **UI/UX Excellence:** Create a floating chat widget that is non-intrusive yet readily accessible, using Tailwind CSS and Shadcn UI for a polished interface.

## 3. Integration Overview

### 3.1 Authentication & Security

*   **API Key Authentication:** All communication with the external service requires an API key. Ensure that this key is stored securely and is never exposed on the client side.
*   **Partner Registration:** Obtain the API key via the `/api/partner/register` endpoint which registers the partner and returns credentials.

### 3.2 API Endpoints and Data Models

The external chat service provides the following endpoints:

*   **Conversations:**

    *   `POST /api/partner/conversations` to create a new conversation.
    *   `GET /api/partner/conversations/:customerId` to retrieve conversations.

*   **Messages:**

    *   `POST /api/partner/messages` to send a message with required fields like `conversationId`, `senderId`, `content`, and `isFromAgent`.
    *   `GET /api/partner/messages/:conversationId` to fetch messages for a particular conversation.

*   **Customer Data Update:**

    *   `PATCH /api/customers/:customerId` to update user details (email, name, birthdate) for enhanced interaction and Flashback profiling.

### 3.3 WebSocket for Real-time Communication

*   **Connection Setup:** Establish a WebSocket connection using:

``const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'; const ws = new WebSocket(`${protocol}//your-domain.com/ws?clientId=customer-12345`);``

*   **Message Types:** The WebSocket supports different message types such as:

    *   `message`: For new messages
    *   `typing`: To indicate when a user is typing
    *   `status`: For conversation status changes
    *   `read`: For message read receipts
    *   `flashback`: For Flashback profile updates

*   **Anonymous Support:** Generate a temporary client ID for unauthenticated users to persist conversation data until they authenticate.

*   **Sending and Receiving Data:** Implement handlers to process incoming messages and send outgoing messages, including typing indicators and conversation updates.

## 4. Implementation Steps

### 4.1 Build the Floating Chat UI

*   **Design:** Utilize Tailwind CSS and Shadcn UI to create a floating chat widget. The widget should be minimized by default and expand when clicked.
*   **User Interaction:** Ensure the chat box supports basic functionalities such as message input, display of conversation history, and responsive design adjustments for mobile and desktop views.

### 4.2 API Proxy Setup

*   **Next.js API Routes:** Create API routes to securely proxy requests to the external chat service endpoints, ensuring that the API key is not exposed on the client side.
*   **Endpoints to Implement:** Routes for sending messages, fetching conversations, and updating customer data.

### 4.3 Integrate WebSocket Communication

*   **Establish Connection:** Write the client-side code to initialize a WebSocket connection on component mount.

*   **Event Handlers:** Implement handlers for:

    *   Processing incoming messages and updating the UI
    *   Handling typing indicators to show feedback in real-time
    *   Managing reconnection logic on unexpected disconnects

*   **Merge Conversations:** Develop logic to merge pre-authentication conversation data with post-authentication sessions using persistent IDs.

### 4.4 Error Handling and Fallbacks

*   **Error Management:** Ensure robust error handling for both API requests and WebSocket events. Implement retries and user notifications in case of connectivity issues.
*   **Message Queueing:** If the WebSocket connection is lost, queue user messages and send them once connectivity is restored. Consider REST API polling as a fallback mechanism.

## 5. Best Practices and Considerations

*   **Security:** Never expose sensitive API keys; use environment variables and server-side proxies to manage authentication.
*   **Performance:** Optimize the chat component to minimize unnecessary re-renders and ensure the UI remains responsive even when multiple messages are sent or received.
*   **Testing:** Implement unit and integration tests using Playwright to simulate chat interactions. Test scenarios should cover successful message exchanges, WebSocket disconnections, and error states.
*   **UX Enhancements:** Use animations for opening/closing the chat and visual cues (like typing indicators) to enhance the user experience.

## 6. Conclusion

The floating chat component will be a powerful addition to the Next.js Supabase SaaS Starter Kit, enabling real-time customer support and engagement. By supporting unauthenticated users with persistent conversation continuity and securely integrating with the external chat service, your application can offer a seamless, responsive chat experience that maintains high standards of security and performance.

This document serves as a guide for developers to implement and integrate the floating chat component. Future iterations may include additional features such as advanced analytics and deeper integration with other parts of the platform.
