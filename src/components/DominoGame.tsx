import { GameBoard } from '@/components/GameBoard';
import { PlayerHand } from '@/components/PlayerHand';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, PartyPopper, Star } from 'lucide-react';

interface DominoGameProps {
  gameHook: any;
}

export const DominoGame = ({ gameHook }: DominoGameProps) => {
  const {
    gameState,
    findLegalMoves,
    executeMove,
    selectHandDomino,
    drawFromBoneyard,
    startNewGame,
    hasDifferentNeighbor,
    syncState
  } = gameHook;

  if (syncState?.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Loading game...</p>
        </div>
      </div>
    );
  }

  const isMyTurn = gameState?.currentPlayer === syncState?.playerPosition;
  const currentPlayerName = syncState?.allPlayers?.find(p => p.position === gameState?.currentPlayer)?.username || 'Unknown';
  
  // Calculate legal moves for selected domino
  const selectedDomino = gameState?.selectedHandIndex !== null ? gameState?.playerHand[gameState.selectedHandIndex] : null;
  const legalMoves = selectedDomino ? findLegalMoves(selectedDomino) : [];

  // Add index to legal moves for executeMove
  const legalMovesWithIndex = legalMoves.map(move => ({
    ...move,
    index: gameState?.selectedHandIndex
  }));

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Game Status */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold">Domino Game</h2>
              <Badge variant={isMyTurn ? "default" : "secondary"}>
                {isMyTurn ? "Your Turn" : `${currentPlayerName}'s Turn`}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                Boneyard: {gameState?.boneyard?.length || 0} tiles
              </span>
            </div>
          </div>
        </Card>

        {/* Players List */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Players</h3>
          <div className="flex flex-wrap gap-2">
            {syncState?.allPlayers?.map((player: any) => (
              <Badge 
                key={player.position} 
                variant={player.position === gameState?.currentPlayer ? "default" : "outline"}
                className="flex items-center space-x-2"
              >
                <span>{player.username}</span>
                <span className="text-xs opacity-75">
                  ({gameState?.playerHands?.[player.position]?.length || 0} tiles)
                </span>
              </Badge>
            ))}
          </div>
        </Card>

        {/* Game Board */}
        <GameBoard 
          gameState={gameState}
          legalMoves={legalMovesWithIndex}
          onMoveExecute={executeMove}
          onCenterView={() => {}}
          hasDifferentNeighbor={hasDifferentNeighbor}
        />

        {/* Player Hand */}
        <PlayerHand
          hand={gameState?.playerHand || []}
          selectedIndex={gameState?.selectedHandIndex}
          onDominoSelect={selectHandDomino}
        />

        {/* Game Actions */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <Button 
                onClick={startNewGame}
                variant="default"
              >
                Start New Game
              </Button>
              <Button 
                onClick={drawFromBoneyard}
                disabled={!gameState?.boneyard?.length}
                variant="outline"
              >
                Draw from Boneyard ({gameState?.boneyard?.length || 0})
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {gameState?.isGameOver ? (
                <span className="font-semibold text-green-600">Game Over!</span>
              ) : (
                <span>Game in progress...</span>
              )}
            </div>
          </div>
        </Card>

        {/* Game Over Dialog */}
        <Dialog open={gameState?.isGameOver || false}>
          <DialogContent className="sm:max-w-md text-center bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300">
            <DialogHeader>
              <DialogTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2 text-yellow-700 mb-4">
                <Trophy className="w-8 h-8 text-yellow-500 animate-bounce" />
                Gefeliciteerd!
                <Trophy className="w-8 h-8 text-yellow-500 animate-bounce" />
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Celebration Icons */}
              <div className="flex justify-center space-x-4">
                <PartyPopper className="w-12 h-12 text-purple-500 animate-pulse" />
                <Star className="w-12 h-12 text-yellow-500 animate-spin" />
                <PartyPopper className="w-12 h-12 text-purple-500 animate-pulse" />
              </div>
              
              {/* Winner Message */}
              <div className="bg-white/70 rounded-lg p-4 border border-yellow-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  🎉 Je hebt gewonnen! 🎉
                </h3>
                <p className="text-gray-600">
                  Je hebt alle dominostenen succesvol gespeeld!
                </p>
              </div>
              
              {/* Decorative elements */}
              <div className="flex justify-center space-x-8 text-2xl">
                <span className="animate-bounce delay-100">🎊</span>
                <span className="animate-bounce delay-200">🏆</span>
                <span className="animate-bounce delay-300">🎊</span>
              </div>
              
              {/* Action Button */}
              <Button 
                onClick={startNewGame}
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold py-3 text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                🎮 Nieuw Spel Starten
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};