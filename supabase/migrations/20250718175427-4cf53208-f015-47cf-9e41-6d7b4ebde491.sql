-- Reset game state to proper empty state for existing games
UPDATE games 
SET game_state = '{"dominoes": {}, "board": {}, "playerHand": [], "boneyard": [], "openEnds": [], "forbiddens": {}, "nextDominoId": 0, "spinnerId": null, "isGameOver": false, "selectedHandIndex": null}',
    updated_at = now()
WHERE lobby_id = '6033c589-d0d2-4b79-8a13-0672da6ead95';