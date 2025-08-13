using UnityEngine;

[CreateAssetMenu(fileName = "DominoSettings", menuName = "Domino/Settings")]
public class DominoSettings : ScriptableObject
{
    [Header("Visual Materials")]
    public Material dominoMaterial;
    public Material pipMaterial;
    public Material dividerMaterial;
    public Material selectedMaterial;
    
    [Header("Dimensions")]
    [Range(1f, 4f)]
    public float width = 2f;
    [Range(0.5f, 2f)]
    public float height = 1f;
    [Range(0.1f, 0.5f)]
    public float thickness = 0.2f;
    [Range(0.02f, 0.15f)]
    public float pipSize = 0.08f;
    [Range(0.01f, 0.1f)]
    public float pipHeight = 0.02f;
    
    [Header("Animation Settings")]
    [Range(0.01f, 0.5f)]
    public float shakeIntensity = 0.1f;
    [Range(0.5f, 3f)]
    public float shakeDuration = 1.5f;
    
    [Header("Colors")]
    public Color dominoColor = Color.white;
    public Color pipColor = Color.black;
    public Color dividerColor = Color.black;
    public Color selectedGlow = Color.yellow;
}