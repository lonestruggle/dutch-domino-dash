-- Update all games with old structure to new structure
UPDATE games 
SET game_state = '{"dominoes": {}, "board": {}, "playerHand": [], "boneyard": [], "openEnds": [], "forbiddens": {}, "nextDominoId": 0, "spinnerId": null, "isGameOver": false, "selectedHandIndex": null}',
    updated_at = now()
WHERE game_state::text LIKE '%dominoSet%' 
   OR game_state::text LIKE '%gameStarted%' 
   OR game_state::text LIKE '%players%';