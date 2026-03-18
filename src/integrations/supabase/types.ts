export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
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
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
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
      background_user_permissions: {
        Row: {
          background_id: string
          can_use: boolean
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          background_id: string
          can_use?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          background_id?: string
          can_use?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_user_permissions_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "custom_backgrounds"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_backgrounds: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          is_active: boolean
          name: string
          permission_level: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          name: string
          permission_level?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          permission_level?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      game_player_stats: {
        Row: {
          created_at: string
          game_id: string
          hard_slams_used: number
          id: string
          pips_remaining: number
          player_position: number
          points_scored: number
          turns_played: number
          user_id: string
          username: string | null
          won: boolean
          won_by_changa: boolean
        }
        Insert: {
          created_at?: string
          game_id: string
          hard_slams_used?: number
          id?: string
          pips_remaining?: number
          player_position: number
          points_scored?: number
          turns_played?: number
          user_id: string
          username?: string | null
          won?: boolean
          won_by_changa?: boolean
        }
        Update: {
          created_at?: string
          game_id?: string
          hard_slams_used?: number
          id?: string
          pips_remaining?: number
          player_position?: number
          points_scored?: number
          turns_played?: number
          user_id?: string
          username?: string | null
          won?: boolean
          won_by_changa?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "game_player_stats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["game_id"]
          },
        ]
      }
      game_results: {
        Row: {
          game_id: string
          id: string
          is_blocked_game: boolean
          lobby_id: string
          played_at: string
          season_id: string | null
          winner_user_id: string | null
        }
        Insert: {
          game_id: string
          id?: string
          is_blocked_game?: boolean
          lobby_id: string
          played_at?: string
          season_id?: string | null
          winner_user_id?: string | null
        }
        Update: {
          game_id?: string
          id?: string
          is_blocked_game?: boolean
          lobby_id?: string
          played_at?: string
          season_id?: string | null
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
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
          table_background_url: string | null
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
          table_background_url?: string | null
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
          table_background_url?: string | null
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
          hard_slam_enabled: boolean | null
          hard_slam_uses_per_player: number | null
          id: string
          max_players: number
          name: string
          player_count: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          created_by_username?: string | null
          hard_slam_enabled?: boolean | null
          hard_slam_uses_per_player?: number | null
          id?: string
          max_players?: number
          name: string
          player_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_username?: string | null
          hard_slam_enabled?: boolean | null
          hard_slam_uses_per_player?: number | null
          id?: string
          max_players?: number
          name?: string
          player_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lobby_players: {
        Row: {
          bot_name: string | null
          hard_slam_uses_remaining: number | null
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
          hard_slam_uses_remaining?: number | null
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
          hard_slam_uses_remaining?: number | null
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
          duration: string | null
          expires_at: string | null
          id: string
          moderator_id: string
          reason: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          duration?: string | null
          expires_at?: string | null
          id?: string
          moderator_id: string
          reason?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          duration?: string | null
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
      seasons: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      table_background_settings: {
        Row: {
          background_url: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          background_url: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          background_url?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
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
      user_favorite_backgrounds: {
        Row: {
          background_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          background_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          background_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_favorite_table_backgrounds: {
        Row: {
          background_url: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          background_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          background_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_chat: boolean
          can_create_lobby: boolean
          can_hard_slam: boolean
          can_invite: boolean
          can_use_custom_backgrounds: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_chat?: boolean
          can_create_lobby?: boolean
          can_hard_slam?: boolean
          can_invite?: boolean
          can_use_custom_backgrounds?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_chat?: boolean
          can_create_lobby?: boolean
          can_hard_slam?: boolean
          can_invite?: boolean
          can_use_custom_backgrounds?: boolean
          created_at?: string
          id?: string
          updated_at?: string
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
      leaderboard_current_season: {
        Row: {
          changa_wins: number | null
          games_played: number | null
          hard_slams: number | null
          total_points: number | null
          turns: number | null
          user_id: string | null
          username: string | null
          wins: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_moderate: { Args: { _user_id: string }; Returns: boolean }
      cleanup_expired_invitations: { Args: never; Returns: number }
      cleanup_expired_lobbies: { Args: never; Returns: number }
      get_active_season_id: { Args: never; Returns: string }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      get_users_without_display_name: {
        Args: never
        Returns: {
          user_id: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_moderator: { Args: { _user_id: string }; Returns: boolean }
      recalc_lobby_player_count: {
        Args: { _lobby_id: string }
        Returns: undefined
      }
      recalculate_profile_game_stats: {
        Args: { _user_id: string }
        Returns: undefined
      }
      record_game_outcome: {
        Args: {
          _game_id: string
          _is_blocked: boolean
          _lobby_id: string
          _players: Json
          _winner_user_id: string
        }
        Returns: boolean
      }
      reset_season_stats: { Args: { _season_id: string }; Returns: number }
      start_new_season: { Args: { _name: string }; Returns: string }
      user_in_lobby: { Args: { _lobby_id: string }; Returns: boolean }
      validate_game_move: {
        Args: { _game_id: string; _move_data: Json; _player_position: number }
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
