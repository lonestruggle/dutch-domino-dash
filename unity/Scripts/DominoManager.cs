using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System.Runtime.InteropServices;
using Newtonsoft.Json;

public class DominoManager : MonoBehaviour
{
    [Header("Prefabs")]
    public GameObject dominoPrefab;
    public GameObject placementTargetPrefab;
    
    [Header("Board Settings")]
    public float cellSize = 2f;
    public Transform boardParent;
    public Transform handParent;
    
    private Dictionary<string, GameObject> boardDominoes = new Dictionary<string, GameObject>();
    private List<GameObject> handDominoes = new List<GameObject>();
    private List<GameObject> placementTargets = new List<GameObject>();
    
    [DllImport("__Internal")]
    private static extern void OnDominoClick(int index);
    
    [DllImport("__Internal")]
    private static extern void OnPlacementClick(float x, float y);
    
    [System.Serializable]
    public class DominoData
    {
        public int value1;
        public int value2;
    }
    
    [System.Serializable]
    public class DominoState
    {
        public string id;
        public DominoData data;
        public float x;
        public float y;
        public string orientation;
        public bool flipped;
        public bool isSpinner;
        public float rotation;
    }
    
    [System.Serializable]
    public class PlacementTarget
    {
        public float x;
        public float y;
        public string orientation;
    }
    
    // Called from JavaScript
    public void UpdateBoardDominoes(string jsonData)
    {
        try
        {
            DominoState[] dominoes = JsonConvert.DeserializeObject<DominoState[]>(jsonData);
            UpdateBoardDominoesInternal(dominoes);
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error parsing domino data: " + e.Message);
        }
    }
    
    public void UpdatePlayerHand(string jsonData)
    {
        try
        {
            DominoData[] handData = JsonConvert.DeserializeObject<DominoData[]>(jsonData);
            UpdatePlayerHandInternal(handData);
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error parsing hand data: " + e.Message);
        }
    }
    
    public void TriggerChangaAnimation()
    {
        StartCoroutine(ChangaAnimationSequence());
    }
    
    public void ShowPlacementTargets(string jsonData)
    {
        try
        {
            PlacementTarget[] targets = JsonConvert.DeserializeObject<PlacementTarget[]>(jsonData);
            ShowPlacementTargetsInternal(targets);
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error parsing placement targets: " + e.Message);
        }
    }
    
    public void HidePlacementTargets()
    {
        foreach (GameObject target in placementTargets)
        {
            if (target != null)
                Destroy(target);
        }
        placementTargets.Clear();
    }
    
    private void UpdateBoardDominoesInternal(DominoState[] dominoes)
    {
        // Remove dominoes that no longer exist
        List<string> toRemove = new List<string>();
        foreach (var kvp in boardDominoes)
        {
            bool found = false;
            foreach (var domino in dominoes)
            {
                if (domino.id == kvp.Key)
                {
                    found = true;
                    break;
                }
            }
            if (!found)
                toRemove.Add(kvp.Key);
        }
        
        foreach (string id in toRemove)
        {
            if (boardDominoes[id] != null)
                Destroy(boardDominoes[id]);
            boardDominoes.Remove(id);
        }
        
        // Add or update existing dominoes
        foreach (DominoState domino in dominoes)
        {
            if (boardDominoes.ContainsKey(domino.id))
            {
                UpdateDominoPosition(boardDominoes[domino.id], domino);
            }
            else
            {
                GameObject newDomino = CreateBoardDomino(domino);
                boardDominoes[domino.id] = newDomino;
            }
        }
    }
    
    private void UpdatePlayerHandInternal(DominoData[] handData)
    {
        // Clear existing hand
        foreach (GameObject domino in handDominoes)
        {
            if (domino != null)
                Destroy(domino);
        }
        handDominoes.Clear();
        
        // Create new hand dominoes
        for (int i = 0; i < handData.Length; i++)
        {
            GameObject handDomino = CreateHandDomino(handData[i], i);
            handDominoes.Add(handDomino);
        }
    }
    
    private GameObject CreateBoardDomino(DominoState state)
    {
        GameObject domino = Instantiate(dominoPrefab, boardParent);
        
        // Set position on board grid
        Vector3 position = new Vector3(state.x * cellSize, 0, state.y * cellSize);
        domino.transform.position = position;
        
        // Set rotation
        if (state.orientation == "vertical")
            domino.transform.rotation = Quaternion.Euler(0, 90, 0);
        else
            domino.transform.rotation = Quaternion.Euler(0, 0, 0);
        
        // Apply small random rotation for natural look
        domino.transform.rotation *= Quaternion.Euler(0, state.rotation, 0);
        
        // Setup domino component
        DominoTile tileComponent = domino.GetComponent<DominoTile>();
        if (tileComponent != null)
        {
            tileComponent.value1 = state.flipped ? state.data.value2 : state.data.value1;
            tileComponent.value2 = state.flipped ? state.data.value1 : state.data.value2;
            tileComponent.SetupVisual();
        }
        
        return domino;
    }
    
    private GameObject CreateHandDomino(DominoData data, int index)
    {
        GameObject domino = Instantiate(dominoPrefab, handParent);
        
        // Arrange in hand layout
        float spacing = 2.5f;
        float startX = -(handDominoes.Count * spacing) / 2f;
        Vector3 position = new Vector3(startX + index * spacing, 0, -8);
        domino.transform.position = position;
        
        // Setup click handler
        DominoClickHandler clickHandler = domino.GetComponent<DominoClickHandler>();
        if (clickHandler == null)
            clickHandler = domino.AddComponent<DominoClickHandler>();
        clickHandler.index = index;
        
        // Setup domino component
        DominoTile tileComponent = domino.GetComponent<DominoTile>();
        if (tileComponent != null)
        {
            tileComponent.value1 = data.value1;
            tileComponent.value2 = data.value2;
            tileComponent.SetupVisual();
        }
        
        return domino;
    }
    
    private void UpdateDominoPosition(GameObject domino, DominoState state)
    {
        Vector3 targetPosition = new Vector3(state.x * cellSize, 0, state.y * cellSize);
        
        // Smooth movement to new position
        StartCoroutine(MoveDomino(domino, targetPosition, 0.3f));
    }
    
    private IEnumerator MoveDomino(GameObject domino, Vector3 targetPosition, float duration)
    {
        Vector3 startPosition = domino.transform.position;
        float elapsed = 0f;
        
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;
            t = Mathf.SmoothStep(0f, 1f, t);
            
            domino.transform.position = Vector3.Lerp(startPosition, targetPosition, t);
            yield return null;
        }
        
        domino.transform.position = targetPosition;
    }
    
    private void ShowPlacementTargetsInternal(PlacementTarget[] targets)
    {
        HidePlacementTargets();
        
        foreach (PlacementTarget target in targets)
        {
            GameObject targetObj = Instantiate(placementTargetPrefab, boardParent);
            Vector3 position = new Vector3(target.x * cellSize, 0.1f, target.y * cellSize);
            targetObj.transform.position = position;
            
            // Setup click handler
            PlacementClickHandler clickHandler = targetObj.GetComponent<PlacementClickHandler>();
            if (clickHandler == null)
                clickHandler = targetObj.AddComponent<PlacementClickHandler>();
            clickHandler.x = target.x;
            clickHandler.y = target.y;
            
            placementTargets.Add(targetObj);
        }
    }
    
    private IEnumerator ChangaAnimationSequence()
    {
        // Shake all dominoes
        foreach (var kvp in boardDominoes)
        {
            DominoTile tile = kvp.Value.GetComponent<DominoTile>();
            if (tile != null)
                tile.StartChangaShake();
        }
        
        // Wait for shake to complete
        yield return new WaitForSeconds(2f);
        
        // Add celebration effects here
        Debug.Log("CHANGA! Animation complete");
    }
}

// Helper classes for click handling
public class DominoClickHandler : MonoBehaviour
{
    public int index;
    
    void OnMouseDown()
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        OnDominoClick(index);
        #endif
    }
}

public class PlacementClickHandler : MonoBehaviour
{
    public float x, y;
    
    void OnMouseDown()
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        OnPlacementClick(x, y);
        #endif
    }
}