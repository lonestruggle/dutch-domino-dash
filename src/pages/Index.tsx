import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Bot, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DominoGame } from '@/components/DominoGame';
import { useDominoGame } from '@/hooks/useDominoGame';
import { useBotAI } from '@/hooks/useBotAI';
import type { DominoData, LegalMove, ShakeAnimationProfile } from '@/types/domino';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';

// Dezelfde bots als in multiplayer: Dave en Betty zijn makkelijk, Raja is moeilijk.
const BOT_NAMES = ['Dave', 'Betty', 'Raja'];

const shuffleArray = <T,>(array: T[]): void => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

const getBotDifficulty = (botName: string): 'easy' | 'medium' | 'hard' => {
  if (botName.includes('Dave') || botName.includes('Betty')) return 'easy';
  if (botName.includes('Raja') || botName.includes('Sam')) return 'hard';
  return 'medium';
};

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [started, setStarted] = useState(false);
  const [botCount, setBotCount] = useState(2);
  const totalPlayers = botCount + 1;
  const gameHook = useDominoGame(0, totalPlayers);
  const { gameState } = gameHook;
  const { calculateBestMove } = useBotAI();
  const handledTurnRef = useRef<string | null>(null);

  const allPlayers = useMemo(
    () => [
      { position: 0, username: t('singlePlayerSetup.you'), is_bot: false },
      ...BOT_NAMES.slice(0, botCount).map((name, index) => ({
        position: index + 1,
        username: name,
        is_bot: true,
        bot_name: name,
      })),
    ],
    [botCount, t]
  );

  const startNewGame = useCallback(() => {
    const fullSet: DominoData[] = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) fullSet.push({ value1: i, value2: j });
    }
    shuffleArray(fullSet);

    const hands: DominoData[][] = [];
    for (let p = 0; p < totalPlayers; p++) hands.push(fullSet.slice(p * 7, (p + 1) * 7));
    const boneyard = fullSet.slice(totalPlayers * 7);

    gameHook.setGameState(prev => ({
      ...prev,
      dominoes: {},
      board: {},
      openEnds: [],
      forbiddens: {},
      boneyard,
      playerHands: hands,
      playerHand: [...hands[0]],
      nextDominoId: 0,
      spinnerId: null,
      isGameOver: false,
      selectedHandIndex: null,
      currentPlayer: 0,
      consecutivePasses: 0,
      gameEndReason: undefined,
      winner_position: undefined,
      hardSlamNextMove: false,
      isHardSlamming: false,
    }));
    handledTurnRef.current = null;
    setStarted(true);
  }, [gameHook, totalPlayers]);

  // Hard slam offline: dezelfde animatie-flags zetten als in het online spel (Game.tsx).
  const { settings: visualSettings } = useGameVisualSettings();
  const hardSlamResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (hardSlamResetRef.current) clearTimeout(hardSlamResetRef.current); }, []);

  const executeMoveWithHardSlam = useCallback((move: any) => {
    if (move?.localHardSlamActive) {
      const hardSlamDominoId = `d${gameHook.gameState.nextDominoId}`;
      const hardSlamAnimationProfile: ShakeAnimationProfile = {
        eventId: `${hardSlamDominoId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        seed: Math.floor(Math.random() * 0x7fffffff),
        startedAtMs: Date.now(),
        intensity: visualSettings.shakeIntensity,
        duration: visualSettings.shakeDuration,
        rotationAmplitudeX: visualSettings.rotationAmplitudeX,
        rotationAmplitudeY: visualSettings.rotationAmplitudeY,
        rotationAmplitudeZ: visualSettings.rotationAmplitudeZ,
        rotationSpeed: visualSettings.rotationSpeed,
      };
      gameHook.setGameState((s) => ({
        ...s,
        hardSlamNextMove: true,
        isHardSlamming: true,
        hardSlamDominoId,
        triggerHardSlamAnimation: true,
        hardSlamAnimationProfile,
        hardSlamActorUserId: null,
      }));
      gameHook.executeMove(move);
      if (hardSlamResetRef.current) clearTimeout(hardSlamResetRef.current);
      hardSlamResetRef.current = setTimeout(() => {
        gameHook.setGameState((s) => ({ ...s, triggerHardSlamAnimation: false, isHardSlamming: false }));
      }, 2000);
      return;
    }
    gameHook.executeMove(move);
  }, [gameHook, visualSettings]);

  const gameHookWithStart = useMemo(
    () => ({
      ...gameHook,
      executeMove: executeMoveWithHardSlam,
      startNewGame,
      syncState: {
        isLoading: false,
        isHost: true,
        playerPosition: 0,
        allPlayers,
        currentPlayer: gameState?.currentPlayer ?? 0,
      },
    }),
    [gameHook, executeMoveWithHardSlam, startNewGame, allPlayers, gameState?.currentPlayer]
  );

  // Lokale bot-loop: laat de bot aan de beurt zetten doen (zelfde AI als in multiplayer).
  useEffect(() => {
    if (!started || !gameState || gameState.isGameOver) return;
    const currentPlayer = gameState.currentPlayer ?? 0;
    if (currentPlayer === 0) {
      handledTurnRef.current = null;
      return;
    }
    if (handledTurnRef.current === String(currentPlayer)) return;

    const botName = BOT_NAMES[currentPlayer - 1] || `Bot ${currentPlayer}`;
    const timer = setTimeout(() => {
      if (handledTurnRef.current === String(currentPlayer)) return;
      handledTurnRef.current = String(currentPlayer);
      try {
        const hand: DominoData[] = gameState.playerHands?.[currentPlayer] || [];
        if (hand.length === 0) return;

        const allLegalMoves: LegalMove[] = [];
        hand.forEach((domino, index) => {
          gameHook.findLegalMoves(domino).forEach((move) => allLegalMoves.push({ ...move, index }));
        });

        const boneyardSize = gameState.boneyard?.length || 0;
        if (allLegalMoves.length === 0 && boneyardSize === 0) {
          gameHook.passMove(currentPlayer);
          return;
        }

        // Bordcontext voor de bot-AI (zelfde berekening als in de multiplayer bot-manager).
        const boardValueTileCounts = Array.from({ length: 7 }, () => 0);
        Object.values(gameState.dominoes || {}).forEach((domino: any) => {
          const v1 = Math.max(0, Math.min(6, domino.data.value1));
          const v2 = Math.max(0, Math.min(6, domino.data.value2));
          if (v1 === v2) boardValueTileCounts[v1] += 1;
          else {
            boardValueTileCounts[v1] += 1;
            boardValueTileCounts[v2] += 1;
          }
        });
        const currentOpenValues = Array.from(new Set((gameState.openEnds || []).map((end) => end.value)));

        const selectedMove = calculateBestMove(
          hand,
          allLegalMoves,
          { difficulty: getBotDifficulty(botName), thinkingTime: 0 },
          { currentOpenValues, boardValueTileCounts, blockAggression: 65 }
        );

        if (selectedMove) {
          gameHook.executeMove({ ...selectedMove, actorPosition: currentPlayer });
        } else if (boneyardSize > 0) {
          gameHook.drawFromBoneyard(currentPlayer);
        } else {
          gameHook.passMove(currentPlayer);
        }
      } catch (error) {
        console.error('Bot zet mislukt:', error);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [started, gameState, gameHook, calculateBestMove]);

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 p-3 bg-primary/10 rounded-full w-fit">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">{t('singlePlayerSetup.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground text-sm">{t('singlePlayerSetup.subtitle')}</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map((count) => (
                <Button
                  key={count}
                  variant={botCount === count ? 'default' : 'outline'}
                  onClick={() => setBotCount(count)}
                >
                  {count} {t('singlePlayerSetup.bots')}
                </Button>
              ))}
            </div>
            <Button size="lg" className="w-full" onClick={startNewGame}>
              <Play className="mr-2 h-4 w-4" />
              {t('singlePlayerSetup.start')}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('singlePlayerSetup.back')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DominoGame gameHook={gameHookWithStart} />;
};

export default Index;
