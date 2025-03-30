import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { NotificationProvider } from "./contexts/NotificationContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CustomerPage from "@/pages/customer";
import AgentPage from "@/pages/agent";
import PartnerDocs from "@/pages/partner-docs";
import EmbeddableChatPage from "@/pages/embedChatComponent";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/customer" component={CustomerPage} />
      <Route path="/customer/:conversationId" component={CustomerPage} />
      <Route path="/agent" component={AgentPage} />
      <Route path="/partner-docs" component={PartnerDocs} />
      <Route path="/chat-embed" component={EmbeddableChatPage} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <Router />
        <Toaster />
      </NotificationProvider>
    </QueryClientProvider>
  );
}

export default App;
