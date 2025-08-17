using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class DominoTile : MonoBehaviour
{
    [Header("Domino Values")]
    public int value1 = 1;
    public int value2 = 2;
    
    [Header("Visual Settings")]
    public Material dominoMaterial;
    public Material pipMaterial;
    public Material dividerMaterial;
    
    [Header("Dimensions")]
    public float width = 2f;
    public float height = 1f;
    public float thickness = 0.2f;
    public float pipSize = 0.08f;
    public float pipHeight = 0.02f;
    
    [Header("Shake Animation")]
    public float shakeIntensity = 0.1f;
    public float shakeDuration = 1.5f;
    public AnimationCurve shakeCurve = AnimationCurve.EaseInOut(0, 1, 1, 0);
    public AnimationCurve rotationCurve = AnimationCurve.EaseInOut(0, 1, 1, 0);
    
    private Vector3 originalPosition;
    private Quaternion originalRotation;
    private bool isShaking = false;
    private List<GameObject> pips = new List<GameObject>();
    
    public bool isDouble => value1 == value2;
    
    void Start()
    {
        originalPosition = transform.position;
        originalRotation = transform.rotation;
        SetupVisual();
    }
    
    public void SetupVisual()
    {
        // Clear existing visuals
        foreach (Transform child in transform)
        {
            if (Application.isPlaying)
                Destroy(child.gameObject);
            else
                DestroyImmediate(child.gameObject);
        }
        pips.Clear();
        
        CreateDominoBody();
        CreateDivider();
        CreatePips();
    }
    
    void CreateDominoBody()
    {
        GameObject body = GameObject.CreatePrimitive(PrimitiveType.Cube);
        body.name = "DominoBody";
        body.transform.SetParent(transform);
        body.transform.localPosition = Vector3.zero;
        body.transform.localScale = new Vector3(width, thickness, height);
        
        // Apply material
        Renderer renderer = body.GetComponent<Renderer>();
        if (dominoMaterial != null)
            renderer.material = dominoMaterial;
        else
            renderer.material.color = Color.white;
        
        // Remove collider if we don't need physics
        Collider collider = body.GetComponent<Collider>();
        if (collider != null)
            collider.isTrigger = true;
    }
    
    void CreateDivider()
    {
        GameObject divider = GameObject.CreatePrimitive(PrimitiveType.Cube);
        divider.name = "Divider";
        divider.transform.SetParent(transform);
        divider.transform.localPosition = Vector3.zero;
        divider.transform.localScale = new Vector3(0.02f, thickness + 0.01f, height);
        
        Renderer renderer = divider.GetComponent<Renderer>();
        if (dividerMaterial != null)
            renderer.material = dividerMaterial;
        else
            renderer.material.color = Color.black;
        
        // Remove collider
        DestroyImmediate(divider.GetComponent<Collider>());
    }
    
    void CreatePips()
    {
        // Left side (value1)
        CreatePipPattern(value1, new Vector3(-width * 0.25f, thickness * 0.6f, 0), "Left");
        
        // Right side (value2) 
        CreatePipPattern(value2, new Vector3(width * 0.25f, thickness * 0.6f, 0), "Right");
    }
    
    void CreatePipPattern(int count, Vector3 centerPos, string side)
    {
        if (count == 0) return;
        
        Vector3[] positions = GetPipPositions(count);
        float pipSpacing = height * 0.25f; // Scale with domino size
        
        for (int i = 0; i < positions.Length; i++)
        {
            GameObject pip = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pip.name = $"Pip_{side}_{i}";
            pip.transform.SetParent(transform);
            
            // Position and scale
            Vector3 worldPos = centerPos + Vector3.Scale(positions[i], new Vector3(pipSpacing, 0, pipSpacing));
            pip.transform.localPosition = worldPos;
            pip.transform.localScale = new Vector3(pipSize, pipHeight, pipSize);
            
            // Material
            Renderer renderer = pip.GetComponent<Renderer>();
            if (pipMaterial != null)
                renderer.material = pipMaterial;
            else
                renderer.material.color = Color.black;
            
            // Remove collider
            DestroyImmediate(pip.GetComponent<Collider>());
            
            pips.Add(pip);
        }
    }
    
    Vector3[] GetPipPositions(int count)
    {
        switch (count)
        {
            case 1:
                return new Vector3[] { Vector3.zero };
                
            case 2:
                return new Vector3[] { 
                    new Vector3(-0.5f, 0, -0.5f), 
                    new Vector3(0.5f, 0, 0.5f) 
                };
                
            case 3:
                return new Vector3[] { 
                    new Vector3(-0.5f, 0, -0.5f), 
                    Vector3.zero, 
                    new Vector3(0.5f, 0, 0.5f) 
                };
                
            case 4:
                return new Vector3[] { 
                    new Vector3(-0.5f, 0, -0.5f), 
                    new Vector3(0.5f, 0, -0.5f),
                    new Vector3(-0.5f, 0, 0.5f), 
                    new Vector3(0.5f, 0, 0.5f) 
                };
                
            case 5:
                return new Vector3[] { 
                    new Vector3(-0.5f, 0, -0.5f), 
                    new Vector3(0.5f, 0, -0.5f),
                    Vector3.zero,
                    new Vector3(-0.5f, 0, 0.5f), 
                    new Vector3(0.5f, 0, 0.5f) 
                };
                
            case 6:
                return new Vector3[] { 
                    new Vector3(-0.5f, 0, -0.8f), 
                    new Vector3(0.5f, 0, -0.8f),
                    new Vector3(-0.5f, 0, 0f),
                    new Vector3(0.5f, 0, 0f),
                    new Vector3(-0.5f, 0, 0.8f), 
                    new Vector3(0.5f, 0, 0.8f) 
                };
                
            default:
                return new Vector3[0];
        }
    }
    
    public void StartChangaShake()
    {
        if (!isShaking)
            StartCoroutine(ChangaShakeAnimation());
    }
    
    public void StartSubtleShake()
    {
        if (!isShaking)
            StartCoroutine(SubtleShakeAnimation());
    }
    
    IEnumerator ChangaShakeAnimation()
    {
        isShaking = true;
        float elapsed = 0f;
        
        // Store original transforms
        Vector3 startPos = transform.position;
        Quaternion startRot = transform.rotation;
        
        while (elapsed < shakeDuration)
        {
            elapsed += Time.deltaTime;
            float normalizedTime = elapsed / shakeDuration;
            
            // Intensity curves
            float shakeAmount = shakeCurve.Evaluate(normalizedTime) * shakeIntensity;
            float rotAmount = rotationCurve.Evaluate(normalizedTime) * 15f; // degrees
            
            // Random offsets
            Vector3 randomOffset = new Vector3(
                Random.Range(-shakeAmount, shakeAmount),
                Random.Range(-shakeAmount * 0.5f, shakeAmount * 0.5f), // Less Y movement
                Random.Range(-shakeAmount, shakeAmount)
            );
            
            Vector3 randomRotation = new Vector3(
                Random.Range(-rotAmount, rotAmount),
                Random.Range(-rotAmount, rotAmount),
                Random.Range(-rotAmount, rotAmount)
            );
            
            // Apply transforms
            transform.position = startPos + randomOffset;
            transform.rotation = startRot * Quaternion.Euler(randomRotation);
            
            yield return null;
        }
        
        // Return to original position smoothly
        yield return StartCoroutine(ReturnToOriginalTransform(startPos, startRot, 0.3f));
        
        isShaking = false;
    }
    
    IEnumerator SubtleShakeAnimation()
    {
        isShaking = true;
        float elapsed = 0f;
        float duration = 0.5f;
        
        Vector3 startPos = transform.position;
        Quaternion startRot = transform.rotation;
        
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float normalizedTime = elapsed / duration;
            
            float shakeAmount = Mathf.Sin(normalizedTime * Mathf.PI) * shakeIntensity * 0.3f;
            
            Vector3 randomOffset = new Vector3(
                Random.Range(-shakeAmount, shakeAmount),
                0,
                Random.Range(-shakeAmount, shakeAmount)
            );
            
            transform.position = startPos + randomOffset;
            
            yield return null;
        }
        
        yield return StartCoroutine(ReturnToOriginalTransform(startPos, startRot, 0.2f));
        
        isShaking = false;
    }
    
    IEnumerator ReturnToOriginalTransform(Vector3 targetPos, Quaternion targetRot, float duration)
    {
        Vector3 startPos = transform.position;
        Quaternion startRot = transform.rotation;
        float elapsed = 0f;
        
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;
            t = Mathf.SmoothStep(0f, 1f, t); // Smooth interpolation
            
            transform.position = Vector3.Lerp(startPos, targetPos, t);
            transform.rotation = Quaternion.Lerp(startRot, targetRot, t);
            
            yield return null;
        }
        
        transform.position = targetPos;
        transform.rotation = targetRot;
    }
    
    // Method for testing in editor
    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Space))
        {
            StartChangaShake();
        }
        
        if (Input.GetKeyDown(KeyCode.S))
        {
            StartSubtleShake();
        }
    }
    
    void OnMouseDown()
    {
        // Quick feedback shake when clicked
        if (!isShaking)
            StartSubtleShake();
    }
    
    // Method to animate placement
    public void AnimatePlacement(Vector3 targetPosition, Quaternion targetRotation)
    {
        StartCoroutine(PlacementAnimation(targetPosition, targetRotation));
    }
    
    IEnumerator PlacementAnimation(Vector3 targetPos, Quaternion targetRot)
    {
        Vector3 startPos = transform.position;
        Quaternion startRot = transform.rotation;
        
        // Arc animation
        Vector3 midPoint = Vector3.Lerp(startPos, targetPos, 0.5f) + Vector3.up * 2f;
        
        float duration = 0.8f;
        float elapsed = 0f;
        
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;
            t = Mathf.SmoothStep(0f, 1f, t);
            
            // Quadratic bezier curve for arc
            Vector3 currentPos = Vector3.Lerp(
                Vector3.Lerp(startPos, midPoint, t),
                Vector3.Lerp(midPoint, targetPos, t),
                t
            );
            
            transform.position = currentPos;
            transform.rotation = Quaternion.Lerp(startRot, targetRot, t);
            
            yield return null;
        }
        
        transform.position = targetPos;
        transform.rotation = targetRot;
        
        // Small bounce effect
        yield return StartCoroutine(BounceEffect());
    }
    
    IEnumerator BounceEffect()
    {
        Vector3 originalScale = transform.localScale;
        float duration = 0.2f;
        float elapsed = 0f;
        
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;
            
            float scaleMultiplier = 1f + Mathf.Sin(t * Mathf.PI) * 0.1f;
            transform.localScale = originalScale * scaleMultiplier;
            
            yield return null;
        }
        
        transform.localScale = originalScale;
    }
}