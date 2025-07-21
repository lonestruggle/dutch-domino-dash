import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Play, Users, Gamepad2, UserCircle, Crown, LogOut, LogIn } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut, isAuthenticated } = useAuth();
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    trackPageView('home');
  }, [trackPageView]);

  const handleSignOut = async () => {
    console.log('Signing out...');
    const { error } = await signOut();
    if (error) {
      console.error('Sign out error:', error);
      // Even if signOut fails, we still want to clear local state and redirect
      // This handles cases where session is already expired/invalid
    }
    // Always navigate to home after sign out attempt (success or failure)
    console.log('Sign out completed, redirecting to home');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-8 w-8 text-primary" />
              <span className="font-bold text-xl">Wegi Domino</span>
            </div>
            
            <div className="flex items-center gap-4">
              {isAuthenticated && user ? (
                <>
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Welkom, {user.email}</span>
                  </div>
                  <Button variant="outline" onClick={() => navigate('/profile')}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    Profiel
                  </Button>
                  <Button variant="outline" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Uitloggen
                  </Button>
                </>
              ) : (
                <Button onClick={() => navigate('/auth')}>
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
              <Gamepad2 className="h-12 w-12 text-primary" />
              <h1 className="text-4xl font-bold">Domino Game</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              {isAuthenticated ? 
                'Kies je spelmodus en begin met spelen!' : 
                'Log in om je voortgang bij te houden en te spelen met anderen!'
              }
            </p>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Single Player</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Speel tegen de computer en oefen je vaardigheden
              </p>
              <Button 
                onClick={() => navigate('/single-player')} 
                className="w-full"
                size="lg"
              >
                Start Single Player
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Multiplayer</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Speel met vrienden online (maximaal 4 spelers)
              </p>
              <Button 
                onClick={() => navigate('/lobbies')} 
                className="w-full"
                size="lg"
                variant="outline"
              >
                Join Multiplayer
              </Button>
            </CardContent>
          </Card>
        </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Maak lobby's aan, join bestaande games en speel real-time met anderen
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}