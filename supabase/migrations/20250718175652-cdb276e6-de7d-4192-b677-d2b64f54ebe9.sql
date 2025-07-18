-- Reset the new lobby game state to correct structure
UPDATE games 
SET game_state = '{"dominoes": {}, "board": {}, "playerHand": [], "boneyard": [], "openEnds": [], "forbiddens": {}, "nextDominoId": 0, "spinnerId": null, "isGameOver": false, "selectedHandIndex": null}',
    updated_at = now()
WHERE lobby_id = 'f3125d4d-7d9c-42ac-9d29-3919b64cae28';