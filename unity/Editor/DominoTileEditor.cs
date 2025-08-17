using UnityEngine;
using UnityEditor;

[CustomEditor(typeof(DominoTile))]
public class DominoTileEditor : Editor
{
    public override void OnInspectorGUI()
    {
        DominoTile domino = (DominoTile)target;
        
        DrawDefaultInspector();
        
        GUILayout.Space(10);
        
        if (GUILayout.Button("Regenerate Visual"))
        {
            domino.SetupVisual();
        }
        
        GUILayout.Space(5);
        
        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Test Changa Shake"))
        {
            if (Application.isPlaying)
                domino.StartChangaShake();
            else
                Debug.Log("Shake animation only works in Play mode");
        }
        
        if (GUILayout.Button("Test Subtle Shake"))
        {
            if (Application.isPlaying)
                domino.StartSubtleShake();
            else
                Debug.Log("Shake animation only works in Play mode");
        }
        GUILayout.EndHorizontal();
        
        GUILayout.Space(10);
        
        // Quick value setters
        GUILayout.Label("Quick Setup:", EditorStyles.boldLabel);
        GUILayout.BeginHorizontal();
        
        if (GUILayout.Button("0|0"))
        {
            domino.value1 = 0;
            domino.value2 = 0;
            domino.SetupVisual();
        }
        if (GUILayout.Button("1|1"))
        {
            domino.value1 = 1;
            domino.value2 = 1;
            domino.SetupVisual();
        }
        if (GUILayout.Button("2|3"))
        {
            domino.value1 = 2;
            domino.value2 = 3;
            domino.SetupVisual();
        }
        if (GUILayout.Button("6|6"))
        {
            domino.value1 = 6;
            domino.value2 = 6;
            domino.SetupVisual();
        }
        
        GUILayout.EndHorizontal();
        
        // Show info
        GUILayout.Space(10);
        EditorGUILayout.HelpBox(
            $"Domino: {domino.value1}|{domino.value2}\n" +
            $"Is Double: {domino.isDouble}\n" +
            $"Press Space in Play mode for Changa shake\n" +
            $"Press S in Play mode for Subtle shake", 
            MessageType.Info
        );
    }
}