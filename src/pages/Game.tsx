import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Play, Crown } from 'lucide-react';
import { useMultiplayerDominoGame } from '@/hooks/useMultiplayerDominoGame';

export default function Game() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useSimpleAuth();
  const { toast } = useToast();
  const { gameState, loading, initializeGame, makeMove, startNewGame, currentPlayer } = useMultiplayerDominoGame();

  if (!isAuthenticated || authLoading) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Game Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              The game you're looking for doesn't exist or hasn't started yet.
            </p>
            <Button onClick={() => navigate('/lobbies')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Lobbies
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If game hasn't started yet, show initialization
  if (!gameState.gameStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Initialize Game</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              The game needs to be initialized. Click the button below to start.
            </p>
            <Button onClick={() => initializeGame(gameState.players)}>
              <Play className="h-4 w-4 mr-2" />
              Initialize Game
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentTurnPlayer = gameState.players[gameState.currentPlayerTurn];
  const isMyTurn = currentPlayer && currentTurnPlayer.id === currentPlayer.id;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/lobbies')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lobbies
          </Button>
          <Button onClick={startNewGame}>
            <Play className="h-4 w-4 mr-2" />
            New Game
          </Button>
        </div>

        {/* Game Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              {gameState.winner !== null ? (
                <div className="space-y-2">
                  <Crown className="h-8 w-8 text-yellow-500 mx-auto" />
                  <h2 className="text-2xl font-bold">
                    {gameState.players[gameState.winner].username} Wins!
                  </h2>
                </div>
              ) : (
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">
                    Current Turn: {currentTurnPlayer.username}
                  </h2>
                  {isMyTurn && (
                    <p className="text-primary font-medium">It's your turn!</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Players */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gameState.players.map((player) => (
            <Card key={player.id} className={player.id === currentPlayer?.id ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{player.username}</span>
                  <span className="text-sm">{player.hand.length} tiles</span>
                </CardTitle>
              </CardHeader>
              {player.id === currentPlayer?.id && (
                <CardContent>
                  <div className="grid grid-cols-4 gap-2">
                    {player.hand.map((tile) => (
                      <div
                        key={tile.id}
                        className="bg-white border-2 border-gray-300 rounded p-2 text-center cursor-pointer hover:border-primary"
                        onClick={() => {
                          if (isMyTurn && gameState.board.length === 0) {
                            // First move - can place anywhere
                            makeMove({ tile, position: 'end' });
                          } else if (isMyTurn) {
                            // Check if tile can be played
                            const leftEnd = gameState.board[0];
                            const rightEnd = gameState.board[gameState.board.length - 1];
                            
                            if (tile.leftDots === leftEnd.leftDots || tile.rightDots === leftEnd.leftDots) {
                              makeMove({ tile, position: 'start', flipped: tile.rightDots === leftEnd.leftDots });
                            } else if (tile.leftDots === rightEnd.rightDots || tile.rightDots === rightEnd.rightDots) {
                              makeMove({ tile, position: 'end', flipped: tile.leftDots === rightEnd.rightDots });
                            } else {
                              toast({
                                title: "Invalid Move",
                                description: "This tile cannot be played",
                                variant: "destructive"
                              });
                            }
                          }
                        }}
                      >
                        <div className="text-xs">{tile.leftDots} | {tile.rightDots}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Board */}
        <Card>
          <CardHeader>
            <CardTitle>Game Board</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1 justify-center">
              {gameState.board.map((tile, index) => (
                <div
                  key={`${tile.id}-${index}`}
                  className="bg-white border-2 border-gray-300 rounded p-2 text-center"
                >
                  <div className="text-sm">{tile.leftDots} | {tile.rightDots}</div>
                </div>
              ))}
              {gameState.board.length === 0 && (
                <p className="text-muted-foreground">No tiles placed yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}