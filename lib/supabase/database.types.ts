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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_services: {
        Row: {
          category: string
          created_at: string
          description: string
          docs_markdown: string
          endpoint_path: string
          healthcheck_config: Json
          http_method: string
          id: string
          last_health_check_at: string | null
          last_health_status: string | null
          name: string
          owner_id: string | null
          slug: string
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          docs_markdown?: string
          endpoint_path: string
          healthcheck_config?: Json
          http_method?: string
          id?: string
          last_health_check_at?: string | null
          last_health_status?: string | null
          name: string
          owner_id?: string | null
          slug: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          docs_markdown?: string
          endpoint_path?: string
          healthcheck_config?: Json
          http_method?: string
          id?: string
          last_health_check_at?: string | null
          last_health_status?: string | null
          name?: string
          owner_id?: string | null
          slug?: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_submissions: {
        Row: {
          category: string
          created_at: string
          description: string
          documentation: string
          endpoint_url: string
          healthcheck_config: Json
          http_method: string
          id: string
          name: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewer_id: string | null
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          documentation?: string
          endpoint_url: string
          healthcheck_config?: Json
          http_method?: string
          id?: string
          name: string
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          documentation?: string
          endpoint_url?: string
          healthcheck_config?: Json
          http_method?: string
          id?: string
          name?: string
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bmg_authorize_api_request: {
        Args: { p_key: string; p_method: string; p_service_slug: string }
        Returns: Json
      }
      bmg_authorize_demo_request: {
        Args: {
          p_client_hash: string
          p_method: string
          p_server_secret: string
          p_service_slug: string
        }
        Returns: Json
      }
      bmg_complete_api_request: {
        Args: {
          p_latency_ms: number
          p_server_secret: string
          p_status_code: number
          p_usage_id: number
        }
        Returns: Json
      }
      bmg_create_api_key: {
        Args: { p_expires_at?: string | null; p_key: string; p_label: string }
        Returns: {
          created_at: string
          id: string
          key_prefix: string
          label: string
        }[]
      }
      bmg_get_api_analytics: { Args: { p_days?: number }; Returns: Json },
      bmg_get_api_request_logs: { Args: { p_page?: number; p_page_size?: number; p_service?: string | null; p_status?: string }; Returns: Json }
      bmg_list_api_keys: {
        Args: never
        Returns: {
          created_at: string
          expires_at: string
          id: string
          key_prefix: string
          label: string
          last_used_at: string
          revoked_at: string
        }[]
      }
      bmg_revoke_api_key: { Args: { p_id: string }; Returns: boolean }
      bmg_update_api_key: {
        Args: { p_expires_at?: string | null; p_id: string; p_label: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
