import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function PartnerDocs() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-transparent bg-clip-text">
          Partner Integration Documentation
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Integrate our customer support chat system into your website or application
        </p>

        <Tabs defaultValue="widget" className="mb-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="widget">JavaScript Widget</TabsTrigger>
            <TabsTrigger value="api">API Integration</TabsTrigger>
          </TabsList>
          <TabsContent value="widget" className="p-4 border rounded-md mt-2">
            <h2 className="text-2xl font-bold mb-4">JavaScript Widget Integration</h2>
            <p className="mb-4">
              The easiest way to integrate our customer support chat system is by using our JavaScript widget.
              Simply add the following code to your website:
            </p>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Installation</CardTitle>
                <CardDescription>Add this code to your HTML page</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                  {`<!-- Customer Support Chat Widget -->
<script src="https://your-domain.com/chat-widget.min.js"></script>
<script>
  // Initialize the chat widget with your API key
  window.addEventListener('DOMContentLoaded', function() {
    ChatWidget.init({
      apiKey: 'YOUR_API_KEY',
      // Optional: Specify a custom URL if your API is hosted elsewhere
      // baseUrl: 'https://api.your-domain.com',
      // Optional: Provide a customer ID if you want to link chats to your customer records
      // customerId: 'customer-123456'
    });
  });
</script>`}
                </pre>
              </CardContent>
            </Card>

            <h3 className="text-xl font-bold mb-2">Customization Options</h3>
            <p className="mb-4">
              You can customize the widget by providing additional options when initializing:
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <h4 className="font-bold">apiKey</h4>
                <p className="text-sm text-muted-foreground">Your unique API key (required)</p>
              </div>
              <div>
                <h4 className="font-bold">baseUrl</h4>
                <p className="text-sm text-muted-foreground">
                  Custom API URL if your API is hosted elsewhere (optional)
                </p>
              </div>
              <div>
                <h4 className="font-bold">customerId</h4>
                <p className="text-sm text-muted-foreground">
                  Custom identifier for your customer to maintain chat history across sessions (optional)
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-md mb-6 border border-yellow-200">
              <h4 className="font-bold text-yellow-800">Note</h4>
              <p className="text-sm text-yellow-800">
                The chat widget automatically handles WebSocket connections, conversation creation, 
                and message synchronization. You don't need to manage these aspects yourself.
              </p>
            </div>

            <Button className="mt-4">
              <a href="/widget-demo" target="_blank" rel="noopener noreferrer">
                View Demo
              </a>
            </Button>
          </TabsContent>

          <TabsContent value="api" className="p-4 border rounded-md mt-2">
            <h2 className="text-2xl font-bold mb-4">API Integration</h2>
            <p className="mb-4">
              For more advanced integration, you can use our REST API endpoints directly.
              All API requests require authentication with your API key.
            </p>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
                <CardDescription>Include your API key in the header of all requests</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                  {`// Example with fetch API
fetch('/api/partner/conversations', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  // Other options...
})`}
                </pre>
              </CardContent>
            </Card>

            <h3 className="text-xl font-bold mb-4">Available Endpoints</h3>
            
            <div className="space-y-6 mb-6">
              <div>
                <h4 className="font-bold text-lg">Create a conversation</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  POST /api/partner/conversations
                </p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                  {`// Request body
{
  "customerId": "customer-123456" // Required
}

// Response
{
  "id": 1,
  "customerId": "customer-123456",
  "status": "waiting",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}`}
                </pre>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-bold text-lg">Get conversations for a customer</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  GET /api/partner/conversations/:customerId
                </p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                  {`// Response
[
  {
    "id": 1,
    "customerId": "customer-123456",
    "agentId": 2,
    "status": "active",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
]`}
                </pre>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-bold text-lg">Send a message</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  POST /api/partner/messages
                </p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                  {`// Request body
{
  "conversationId": 1,        // Required
  "senderId": "customer-123", // Required
  "content": "Hello, I need help with my order", // Required
  "isFromAgent": false        // Optional, defaults to false
}

// Response
{
  "id": 1,
  "conversationId": 1,
  "senderId": "customer-123",
  "content": "Hello, I need help with my order",
  "isFromAgent": false,
  "timestamp": "2023-01-01T00:00:00.000Z",
  "readStatus": false
}`}
                </pre>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-bold text-lg">Get messages for a conversation</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  GET /api/partner/messages/:conversationId
                </p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                  {`// Response
[
  {
    "id": 1,
    "conversationId": 1,
    "senderId": "customer-123",
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
]`}
                </pre>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-md mb-6 border border-blue-200">
              <h4 className="font-bold text-blue-800">WebSocket Integration</h4>
              <p className="text-sm text-blue-800 mb-2">
                To receive real-time updates, connect to our WebSocket endpoint:
              </p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                {`// Connect to WebSocket
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(\`\${protocol}//your-domain.com/ws?clientId=customer-123\`);

// Listen for messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
  // Handle different message types
  if (data.type === 'message') {
    // Handle new message
  } else if (data.type === 'status') {
    // Handle status update
  } else if (data.type === 'typing') {
    // Handle typing indicator
  }
};`}
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        <div className="bg-gray-50 p-6 rounded-lg border">
          <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
          <ol className="list-decimal pl-6 space-y-2 mb-4">
            <li>Register as a partner to receive your API key</li>
            <li>Integrate either the JavaScript widget or use our API endpoints</li>
            <li>Test the integration in your development environment</li>
            <li>Deploy to production and monitor customer interactions</li>
          </ol>
          <p className="mb-4">
            For any questions or support, please contact our partner support team at{" "}
            <a href="mailto:partners@example.com" className="text-blue-600 hover:underline">
              partners@example.com
            </a>
          </p>
          <Button className="mr-2">Register as Partner</Button>
          <Button variant="outline">Contact Support</Button>
        </div>
      </div>
    </div>
  );
}