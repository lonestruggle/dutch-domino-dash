export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      analytics: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_attempts: {
        Row: {
          attempt_type: string
          created_at: string | null
          email: string | null
          id: string
          ip_address: unknown
          success: boolean | null
        }
        Insert: {
          attempt_type: string
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address: unknown
          success?: boolean | null
        }
        Update: {
          attempt_type?: string
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address?: unknown
          success?: boolean | null
        }
        Relationships: []
      }
      games: {
        Row: {
          background_choice: string | null
          created_at: string
          current_player_turn: number
          game_state: Json
          id: string
          lobby_id: string
          status: string
          updated_at: string
          winner_position: number | null
        }
        Insert: {
          background_choice?: string | null
          created_at?: string
          current_player_turn?: number
          game_state: Json
          id?: string
          lobby_id: string
          status?: string
          updated_at?: string
          winner_position?: number | null
        }
        Update: {
          background_choice?: string | null
          created_at?: string
          current_player_turn?: number
          game_state?: Json
          id?: string
          lobby_id?: string
          status?: string
          updated_at?: string
          winner_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          code: string
          created_at: string
          expires_at: string
          id: string
          invited_by: string | null
          invited_email: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          invited_email: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string
          status?: string
        }
        Relationships: []
      }
      lobbies: {
        Row: {
          created_at: string
          created_by: string
          created_by_username: string | null
          id: string
          max_players: number
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          created_by_username?: string | null
          id?: string
          max_players?: number
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_username?: string | null
          id?: string
          max_players?: number
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lobby_players: {
        Row: {
          bot_name: string | null
          id: string
          is_bot: boolean | null
          joined_at: string
          lobby_id: string
          player_position: number
          user_id: string | null
          username: string | null
        }
        Insert: {
          bot_name?: string | null
          id?: string
          is_bot?: boolean | null
          joined_at?: string
          lobby_id: string
          player_position: number
          user_id?: string | null
          username?: string | null
        }
        Update: {
          bot_name?: string | null
          id?: string
          is_bot?: boolean | null
          joined_at?: string
          lobby_id?: string
          player_position?: number
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lobby_players_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          action: string
          created_at: string | null
          duration: unknown | null
          expires_at: string | null
          id: string
          moderator_id: string
          reason: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          duration?: unknown | null
          expires_at?: string | null
          id?: string
          moderator_id: string
          reason?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          duration?: unknown | null
          expires_at?: string | null
          id?: string
          moderator_id?: string
          reason?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          games_played: number | null
          games_won: number | null
          id: string
          invitation_code: string | null
          invited_by: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          games_played?: number | null
          games_won?: number | null
          id?: string
          invitation_code?: string | null
          invited_by?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          games_played?: number | null
          games_won?: number | null
          id?: string
          invitation_code?: string | null
          invited_by?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          banned_by: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_permanent: boolean | null
          reason: string
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_permanent?: boolean | null
          reason: string
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_permanent?: boolean | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_invitations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      validate_game_move: {
        Args: { _game_id: string; _player_position: number; _move_data: Json }
        Returns: boolean
      }
      validate_invitation_code: {
        Args: { _code: string; _email?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
