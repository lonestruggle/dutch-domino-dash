import React, { useMemo, useState, useEffect } from 'react';
import { GameBoard } from './GameBoard';
import { PlayerHand } from './PlayerHand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDominoGame } from '@/hooks/useDominoGame';
import { toast } from 'sonner';
import { RefreshCw, Plus, Crown } from 'lucide-react';

interface DominoGameProps {
  gameHook?: any; // Custom game hook for multiplayer
}

export const DominoGame: React.FC<DominoGameProps> = ({ gameHook }) => {
  const defaultGame = useDominoGame();
  const game = gameHook || defaultGame;
  
  const {
    gameState,
    findLegalMoves,
    executeMove,
    selectDomino,
    drawFromBoneyard,
    startNewGame,
    hasDifferentNeighbor,
    syncState,
    isGameInitialized,
  } = game;

  // All hooks must be called before any early returns
  const [gameStatus, setGameStatus] = useState<string>('');

  // Show waiting screen if multiplayer game is not initialized
  if (gameHook && !isGameInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md p-6 text-center">
          <h2 className="text-xl font-bold mb-4">Wachten op spel...</h2>
          <p className="text-muted-foreground mb-4">
            {syncState?.isHost 
              ? "Je bent de host. Klik op 'Nieuw Spel' om te beginnen." 
              : "Wacht tot de host het spel start."}
          </p>
          {syncState?.isHost && (
            <Button onClick={startNewGame} className="flex items-center gap-2 mx-auto">
              <RefreshCw className="w-4 h-4" />
              Start Spel
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const legalMoves = useMemo(() => {
    if (gameState.selectedHandIndex === null) return [];
    const selectedDomino = gameState.playerHand[gameState.selectedHandIndex];
    if (!selectedDomino) return [];
    
    return findLegalMoves(selectedDomino).map(move => ({
      ...move,
      index: gameState.selectedHandIndex,
    }));
  }, [gameState.selectedHandIndex, gameState.playerHand, findLegalMoves, gameState.board]);

  const hasLegalMoves = useMemo(() => {
    return gameState.playerHand.some(domino => findLegalMoves(domino).length > 0);
  }, [gameState.playerHand, findLegalMoves]);

  const centerViewOnBoard = () => {
    // This will be handled by the GameBoard component
  };

  const handleMoveExecute = (move: any) => {
    executeMove(move);
    toast.success('Steen geplaatst!');
    setTimeout(centerViewOnBoard, 50);
  };

  const handleDrawDomino = () => {
    if (gameState.boneyard.length === 0) {
      toast.error('Boneyard is leeg!');
      return;
    }
    drawFromBoneyard();
    toast.info('Steen getrokken uit boneyard');
  };

  const handleNewGame = () => {
    startNewGame();
    toast.success('Nieuw spel gestart!');
  };

  // Update game status
  useEffect(() => {
    if (gameState.playerHand.length === 0) {
      setGameStatus('🎉 Gefeliciteerd, je hebt gewonnen! 🎉');
      toast.success('Je hebt gewonnen!');
    } else if (!hasLegalMoves && gameState.boneyard.length === 0) {
      setGameStatus('Spel geblokkeerd! Je kunt niet meer zetten.');
      toast.error('Spel geblokkeerd!');
    } else if (!hasLegalMoves) {
      setGameStatus('Geen zetten mogelijk. Trek een steen.');
    } else {
      setGameStatus('Jouw beurt. Selecteer een steen.');
    }
  }, [gameState.playerHand.length, hasLegalMoves, gameState.boneyard.length]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <Card className="m-4 p-4 bg-ui-bg border-ui-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-ui-text">Nederlandse Domino</h1>
          </div>
          <div className="flex items-center gap-4">
            {syncState && (
              <div className="text-sm text-ui-muted">
                Spelers: <span className="font-semibold">{syncState.allPlayers.length}</span>
                {syncState.isHost && <span className="ml-2 text-primary">(Host)</span>}
              </div>
            )}
            <div className="text-sm text-ui-muted">
              Boneyard: <span className="font-semibold">{gameState.boneyard.length}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Game Board */}
      <div className="flex-1 mx-4">
        <GameBoard
          gameState={gameState}
          legalMoves={legalMoves}
          onMoveExecute={handleMoveExecute}
          onCenterView={centerViewOnBoard}
          hasDifferentNeighbor={hasDifferentNeighbor}
        />
      </div>

      {/* Player Hand and Controls */}
      <div className="mx-4 mb-4 space-y-4">
        <PlayerHand
          hand={gameState.playerHand}
          selectedIndex={gameState.selectedHandIndex}
          onDominoSelect={selectDomino}
        />

        {/* Game Status and Controls */}
        <Card className="game-ui p-4">
          <div className="text-center space-y-4">
            <div className="text-lg font-medium text-ui-text min-h-[28px]">
              {gameStatus}
            </div>
            
            <div className="flex justify-center gap-4">
              <Button
                variant="secondary"
                onClick={handleDrawDomino}
                disabled={gameState.boneyard.length === 0 || gameState.isGameOver}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Trek een steen
              </Button>
              
              <Button
                onClick={handleNewGame}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Nieuw Spel
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};