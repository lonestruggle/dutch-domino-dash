import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { useLobbies } from '@/hooks/useLobbies';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, LogIn, Trash2 } from 'lucide-react';

export default function Lobbies() {
  const navigate = useNavigate();
  const { user, isAuthenticated, signInWithUsername } = useSimpleAuth();
  const { lobbies, loading, createLobby, joinLobby, deleteLobby } = useLobbies();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [lobbyName, setLobbyName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [creating, setCreating] = useState(false);

  const handleSignIn = async () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    const { error } = await signInWithUsername(username);
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      });
    } else {
      setShowUsernameDialog(false);
      setUsername('');
    }
  };

  const handleCreateLobby = async () => {
    if (!user) return;
    
    if (!lobbyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a lobby name",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    const { data, error } = await createLobby(lobbyName.trim(), user, maxPlayers);
    
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
    if (!user) return;
    
    const { error } = await joinLobby(lobbyId, user);
    
    if (error) {
      toast({
        title: "Error",
        description: typeof error === 'string' ? error : error.message || "Could not join lobby",
        variant: "destructive"
      });
    } else {
      // Use window.location to force navigation
      window.location.href = `/lobby/${lobbyId}`;
    }
  };

  const handleDeleteLobby = async (lobbyId: string) => {
    if (!user) return;
    
    const { error } = await deleteLobby(lobbyId, user);
    
    if (error) {
      toast({
        title: "Error",
        description: typeof error === 'string' ? error : error.message || "Could not delete lobby",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Lobby deleted successfully"
      });
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
              Enter your username to join multiplayer lobbies
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  onKeyPress={(e) => e.key === 'Enter' && handleSignIn()}
                />
              </div>
              <Button onClick={handleSignIn} className="w-full">
                <LogIn className="h-4 w-4 mr-2" />
                Join Multiplayer
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
          <div>
            <h1 className="text-3xl font-bold">Multiplayer Lobbies</h1>
            <p className="text-muted-foreground">Welcome, {user?.username}!</p>
          </div>
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
                      <div className="flex gap-2">
                        {user?.id === lobby.created_by && (
                          <Button
                            onClick={() => handleDeleteLobby(lobby.id)}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          onClick={() => handleJoinLobby(lobby.id)}
                          disabled={lobby.player_count >= lobby.max_players}
                          size="sm"
                        >
                          {lobby.player_count >= lobby.max_players ? 'Full' : 'Join'}
                        </Button>
                      </div>
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