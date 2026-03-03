import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import Index from "./pages/Index";
import Lobbies from "./pages/Lobbies";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import NotFound from "./pages/NotFound";
import DominoTileDemo from "./components/DominoTileDemo";
import { GameVisualControls } from "@/components/GameVisualControls";
import Scoreboard from "./pages/Scoreboard";
import { GameVisualSettingsProvider } from "@/hooks/useGameVisualSettings";

console.log('App.tsx: Creating QueryClient...');
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
console.log('App.tsx: QueryClient created successfully');

// Hide visual controls on certain routes
const ConditionalControls: React.FC = () => {
  const location = useLocation();
  const hideOn = ['/scoreboard'];
  const shouldHide = hideOn.some((p) => location.pathname.startsWith(p));
  if (shouldHide) return null;
  return <GameVisualControls />;
};

const App = () => {
  console.log('App component rendering...');
  
  try {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <GameVisualSettingsProvider>
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
                <Route path="/scoreboard" element={<Scoreboard />} />
                <Route path="/demo" element={<DominoTileDemo />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <ConditionalControls />
            </BrowserRouter>
          </GameVisualSettingsProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
  } catch (error) {
    console.error('Error in App component:', error);
    return <div>Something went wrong. Please refresh the page.</div>;
  }
};

export default App;