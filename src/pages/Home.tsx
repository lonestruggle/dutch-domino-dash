import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Users, Gamepad2 } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Gamepad2 className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold">Domino Game</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Kies je spelmodus en begin met spelen!
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
  );
}