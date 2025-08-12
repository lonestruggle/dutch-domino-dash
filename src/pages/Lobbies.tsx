import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useLobbies } from '@/hooks/useLobbies';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, LogIn, Trash2 } from 'lucide-react';

export default function Lobbies() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { lobbies, loading, createLobby, joinLobby, deleteLobby } = useLobbies();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [displayUsername, setDisplayUsername] = useState('');
  const [lobbyName, setLobbyName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUsername();
    }
  }, [user]);

  const fetchUsername = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setDisplayUsername(data.username);
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
            <CardTitle className="text-center">Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You need to log in to access multiplayer lobbies
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              Go to Login
            </Button>
            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen p-4">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/lovable-uploads/07b47c70-696f-408c-9981-c04375940eea.png')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 -z-10 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Multiplayer Lobbies</h1>
            <p className="text-white/80">Welcome, {displayUsername || user?.email}!</p>
          </div>
          <div className="flex w-full sm:w-auto gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => navigate('/')} className="w-full sm:w-auto border-white/30 bg-white/10 text-white hover:bg-white/20">
              Back to Home
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto bg-primary hover:bg-primary/80 text-white">
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
            <p className="mt-2 text-white/80">Loading lobbies...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lobbies.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-white/80">No lobbies available</p>
                <p className="text-sm text-white/70 mt-1">Create a new lobby to get started!</p>
              </div>
            ) : (
              lobbies.map((lobby) => (
                <Card key={lobby.id} className="hover:shadow-lg transition-all duration-200 hover:scale-105 bg-white/10 backdrop-blur-md border-white/20 text-white">
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-white/80">
                        Status: {lobby.status}
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
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
                          className="w-full sm:w-auto bg-primary hover:bg-primary/80 text-white"
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