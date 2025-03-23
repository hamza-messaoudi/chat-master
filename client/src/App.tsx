import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CustomerPage from "@/pages/customer";
import AgentPage from "@/pages/agent";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/customer" component={CustomerPage} />
      <Route path="/customer/:conversationId" component={CustomerPage} />
      <Route path="/agent" component={AgentPage} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
