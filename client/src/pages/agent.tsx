import { useState, useEffect } from "react";
import AgentDashboard from "@/components/agent/AgentDashboard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// In a real app, there would be proper authentication
// For this demo, we'll create a simple login form and use a hardcoded agent
export default function AgentPage() {
  const [agentId, setAgentId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Check if agent is already logged in
  useEffect(() => {
    const storedAgentId = sessionStorage.getItem("agentId");
    if (storedAgentId) {
      setAgentId(parseInt(storedAgentId));
    }
  }, []);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "Error",
        description: "Username and password are required",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // In a real app, this would make an API call to authenticate
      // For this demo, we'll just check the hardcoded credentials
      if (username === "agent" && password === "password") {
        // Use the default agent ID
        const agentId = 1;
        sessionStorage.setItem("agentId", agentId.toString());
        setAgentId(agentId);
        
        toast({
          title: "Login Successful",
          description: "Welcome to the Support Chat Dashboard",
        });
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid username or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: "An error occurred during login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogout = () => {
    sessionStorage.removeItem("agentId");
    setAgentId(null);
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
  };
  
  if (!agentId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-light">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-center mb-6">
            <span className="material-icons text-primary mr-2 text-3xl">support_agent</span>
            <h1 className="text-2xl font-bold text-neutral-dark">Agent Login</h1>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-2 border border-neutral-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter your username"
                required
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border border-neutral-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter your password"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-primary text-white py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>
          
          <div className="mt-4 text-center text-sm text-neutral-dark">
            <p>For demo: Username: agent, Password: password</p>
          </div>
        </div>
      </div>
    );
  }
  
  return <AgentDashboard agentId={agentId} onLogout={handleLogout} />;
}
