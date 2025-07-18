import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DominoGameProps {
  gameHook: any;
}

export const DominoGame = ({ gameHook }: DominoGameProps) => {
  const [testMessage, setTestMessage] = useState('');
  
  const sendTestMessage = () => {
    const message = `Test message from ${gameHook.syncState?.playerPosition || 0} at ${new Date().toLocaleTimeString()}`;
    setTestMessage(message);
    // Here we would normally sync this message
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Multiplayer Test</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Connection Status:</h3>
              <p>Loading: {gameHook.syncState?.isLoading ? 'Yes' : 'No'}</p>
              <p>Player Position: {gameHook.syncState?.playerPosition || 'Unknown'}</p>
              <p>Is Host: {gameHook.syncState?.isHost ? 'Yes' : 'No'}</p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Players:</h3>
              {gameHook.syncState?.allPlayers?.map((player: any, index: number) => (
                <p key={index}>Player {player.position}: {player.username}</p>
              ))}
            </div>
            
            <div className="space-y-2">
              <Button onClick={sendTestMessage}>
                Send Test Message
              </Button>
              {testMessage && (
                <div className="p-2 bg-muted rounded">
                  {testMessage}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};