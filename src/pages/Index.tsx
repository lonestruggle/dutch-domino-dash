import { DominoGame } from '@/components/DominoGame';
import { useDominoGame } from '@/hooks/useDominoGame';

const Index = () => {
  const gameHook = useDominoGame();
  
  // Mock sync state for single player
  const mockSyncState = {
    isLoading: false,
    isHost: true,
    playerPosition: 0,
    allPlayers: [{ username: 'Player 1', position: 0 }]
  };

  return <DominoGame gameHook={{ ...gameHook, syncState: mockSyncState }} />;
};

export default Index;