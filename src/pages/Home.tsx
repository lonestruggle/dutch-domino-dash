import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { Play, Users, UserCircle, LogOut, LogIn } from 'lucide-react';
import { DominoIcon } from '@/components/DominoIcon';

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut, isAuthenticated } = useAuth();
  const { trackPageView } = useAnalytics();
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    trackPageView('home');
  }, [trackPageView]);

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
      setUsername(data.username);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
    navigate('/');
  };

  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: `url('/lovable-uploads/c7e39ae4-84d3-4fb2-a05f-4ea95a7010d7.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark overlay for better readability */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      
      {/* All content with relative positioning */}
      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-white/20 bg-black/20 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DominoIcon className="h-8 w-8 text-white" size={32} />
                <span className="font-bold text-xl text-white">Wegi Domino</span>
              </div>
              
              <div className="flex items-center gap-4">
                {isAuthenticated && user ? (
                  <>
                     <div className="flex items-center gap-2 text-white">
                       <UserCircle className="h-5 w-5" />
                       <span className="text-sm font-medium">Welkom, {username || user.email}</span>
                     </div>
                    <Button variant="outline" onClick={() => navigate('/profile')} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                      <UserCircle className="mr-2 h-4 w-4" />
                      Profiel
                    </Button>
                    <Button variant="outline" onClick={handleSignOut} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                      <LogOut className="mr-2 h-4 w-4" />
                      Uitloggen
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => navigate('/auth')} className="bg-primary hover:bg-primary/80 text-white">
                    <LogIn className="mr-2 h-4 w-4" />
                    Inloggen
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <DominoIcon className="h-12 w-12 text-white" size={48} />
                <h1 className="text-4xl font-bold text-white drop-shadow-2xl">Domino Game</h1>
              </div>
              <p className="text-lg text-white/90 drop-shadow-lg">
                {isAuthenticated ? 
                  'Kies je spelmodus en begin met spelen!' : 
                  'Log in om je voortgang bij te houden en te spelen met anderen!'
                }
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105 bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 p-3 bg-white/20 rounded-full w-fit">
                    <Play className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl text-white">Single Player</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-white/80">
                    Speel tegen de computer en oefen je vaardigheden
                  </p>
                  <Button 
                    onClick={() => navigate('/single-player')} 
                    className="w-full bg-gray-500 hover:bg-gray-500 text-white cursor-not-allowed"
                    size="lg"
                    disabled
                  >
                    Tijdelijk Buiten Gebruik
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105 bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 p-3 bg-white/20 rounded-full w-fit">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl text-white">Multiplayer</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-white/80">
                    Speel met vrienden online (maximaal 4 spelers)
                  </p>
                  <Button 
                    onClick={() => navigate('/lobbies')} 
                    className="w-full bg-primary hover:bg-primary/80 text-white"
                    size="lg"
                  >
                    Join Multiplayer
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-white/60">
                Maak lobby's aan, join bestaande games en speel real-time met anderen
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}