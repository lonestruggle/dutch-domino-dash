import { DominoGame } from '@/components/DominoGame';

const Index = () => {
  // Simple mock hook for testing
  const mockGameHook = {
    syncState: {
      isLoading: false,
      isHost: true,
      playerPosition: 0,
      allPlayers: [{ username: 'Player 1', position: 0 }]
    },
    loadGameState: () => console.log('Mock loadGameState called')
  };

  return <DominoGame gameHook={mockGameHook} />;
};

export default Index;