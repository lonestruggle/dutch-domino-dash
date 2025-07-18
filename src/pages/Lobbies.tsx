import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useLobbies } from '@/hooks/useLobbies';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Play, LogIn } from 'lucide-react';

export default function Lobbies() {
  const navigate = useNavigate();
  const { user, isAuthenticated, signInAnonymously } = useAuth();
  const { lobbies, loading, createLobby, joinLobby } = useLobbies();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [lobbyName, setLobbyName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [creating, setCreating] = useState(false);

  const handleSignIn = async () => {
    const { error } = await signInAnonymously();
    if (error) {
      toast({
        title: "Error",
        description: "Could not sign in",
        variant: "destructive"
      });
    }
  };

  const handleCreateLobby = async () => {
    if (!lobbyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a lobby name",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    const { data, error } = await createLobby(lobbyName.trim(), maxPlayers);
    
    if (error) {
      toast({
        title: "Error",
        description: "Could not create lobby",
        variant: "destructive"
      });
    } else if (data) {
      setShowCreateDialog(false);
      setLobbyName('');
      navigate(`/lobby/${data.id}`);
    }
    
    setCreating(false);
  };

  const handleJoinLobby = async (lobbyId: string) => {
    const { error } = await joinLobby(lobbyId);
    
    if (error) {
      toast({
        title: "Error",
        description: typeof error === 'string' ? error : error.message || "Could not join lobby",
        variant: "destructive"
      });
    } else {
      navigate(`/lobby/${lobbyId}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Welcome to Multiplayer</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Sign in to create or join multiplayer lobbies
            </p>
            <div className="space-y-2">
              <Button onClick={handleSignIn} className="w-full">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In to Play Multiplayer
              </Button>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Multiplayer Lobbies</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to Home
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Lobby
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Lobby</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="lobbyName">Lobby Name</Label>
                    <Input
                      id="lobbyName"
                      value={lobbyName}
                      onChange={(e) => setLobbyName(e.target.value)}
                      placeholder="Enter lobby name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxPlayers">Max Players</Label>
                    <Input
                      id="maxPlayers"
                      type="number"
                      min="1"
                      max="4"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 4)}
                    />
                  </div>
                  <Button 
                    onClick={handleCreateLobby} 
                    disabled={creating}
                    className="w-full"
                  >
                    {creating ? 'Creating...' : 'Create Lobby'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading lobbies...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lobbies.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground">No lobbies available</p>
                <p className="text-sm text-muted-foreground mt-1">Create a new lobby to get started!</p>
              </div>
            ) : (
              lobbies.map((lobby) => (
                <Card key={lobby.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{lobby.name}</span>
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-4 w-4" />
                        {lobby.player_count}/{lobby.max_players}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Status: {lobby.status}
                      </div>
                      <Button
                        onClick={() => handleJoinLobby(lobby.id)}
                        disabled={lobby.player_count >= lobby.max_players}
                        size="sm"
                      >
                        {lobby.player_count >= lobby.max_players ? 'Full' : 'Join'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}