import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import Index from "./pages/Index";
import Lobbies from "./pages/Lobbies";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import BackgroundPreview from "./pages/BackgroundPreview";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/single-player" element={<Index />} />
          <Route path="/lobbies" element={<Lobbies />} />
          <Route path="/lobby/:lobbyId" element={<Lobby />} />
          <Route path="/game/:gameId" element={<Game />} />
          <Route path="/background-preview" element={<BackgroundPreview />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
