import { GameBoard } from '@/components/GameBoard';
import { PlayerHand } from '@/components/PlayerHand';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DominoGameProps {
  gameHook: any;
}

export const DominoGame = ({ gameHook }: DominoGameProps) => {
  const {
    gameState,
    findLegalMoves,
    executeMove,
    selectDomino,
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

  // Temporary debug logs
  console.log('Game state check:', {
    selectedHandIndex: gameState?.selectedHandIndex,
    openEndsCount: gameState?.openEnds?.length,
    legalMovesCount: legalMoves.length,
    selectedDomino
  });

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
          onDominoSelect={selectDomino}
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
      </div>
    </div>
  );
};