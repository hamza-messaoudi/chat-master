import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-neutral-light p-4">
      <div className="w-full max-w-3xl mx-auto text-center mb-8">
        <h1 className="text-4xl font-bold text-primary mb-4">Support Chat Platform</h1>
        <p className="text-lg text-neutral-dark">
          A real-time communication platform for customer support
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">Customer Portal</CardTitle>
            <CardDescription>
              Get help from our support agents in real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center p-4">
              <span className="material-icons text-6xl text-primary">chat</span>
            </div>
            <p className="text-center text-neutral-dark">
              Start a new conversation with our support team to get assistance with your issues.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button 
              onClick={() => setLocation("/customer")}
              className="bg-primary hover:bg-primary/90 w-full"
            >
              Start Chat
            </Button>
          </CardFooter>
        </Card>
        
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">Agent Dashboard</CardTitle>
            <CardDescription>
              Manage and respond to customer inquiries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center p-4">
              <span className="material-icons text-6xl text-primary">support_agent</span>
            </div>
            <p className="text-center text-neutral-dark">
              Access the agent dashboard to handle customer conversations and provide support.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button 
              onClick={() => setLocation("/agent")}
              className="bg-primary hover:bg-primary/90 w-full"
            >
              Agent Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
