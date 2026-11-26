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
      api_admin_limits: {
        Row: {
          daily_weighted_limit: number
          id: boolean
          max_api_keys: number
          monthly_weighted_limit: number
          requests_per_minute: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          daily_weighted_limit: number
          id?: boolean
          max_api_keys: number
          monthly_weighted_limit: number
          requests_per_minute: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          daily_weighted_limit?: number
          id?: boolean
          max_api_keys?: number
          monthly_weighted_limit?: number
          requests_per_minute?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_plan_limits: {
        Row: {
          daily_weighted_limit: number
          max_api_keys: number
          monthly_weighted_limit: number
          plan: string
          requests_per_minute: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          daily_weighted_limit: number
          max_api_keys: number
          monthly_weighted_limit: number
          plan: string
          requests_per_minute: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          daily_weighted_limit?: number
          max_api_keys?: number
          monthly_weighted_limit?: number
          plan?: string
          requests_per_minute?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_service_dependencies: {
        Row: {
          created_at: string
          created_by: string | null
          dependency_type: string
          depends_on_service_id: string
          description: string
          id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dependency_type?: string
          depends_on_service_id: string
          description?: string
          id?: string
          service_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dependency_type?: string
          depends_on_service_id?: string
          description?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_service_dependencies_depends_on_service_id_fkey"
            columns: ["depends_on_service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_service_dependencies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      api_service_versions: {
        Row: {
          change_note: string
          created_at: string
          created_by: string | null
          id: string
          service_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_note?: string
          created_at?: string
          created_by?: string | null
          id?: string
          service_id: string
          snapshot: Json
          version: number
        }
        Update: {
          change_note?: string
          created_at?: string
          created_by?: string | null
          id?: string
          service_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_service_versions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      api_services: {
        Row: {
          archived_at: string | null
          category: string
          created_at: string
          current_version: number
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
          weight: number
        }
        Insert: {
          archived_at?: string | null
          category?: string
          created_at?: string
          current_version?: number
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
          weight?: number
        }
        Update: {
          archived_at?: string | null
          category?: string
          created_at?: string
          current_version?: number
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
          weight?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: []
      }
      incident_updates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          incident_id: string
          message: string
          status: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id: string
          message: string
          status?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string
          message?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          affected_services: string[]
          created_by: string | null
          description: string
          id: string
          resolved_at: string | null
          severity: string
          started_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_services?: string[]
          created_by?: string | null
          description?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_services?: string[]
          created_by?: string | null
          description?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_windows: {
        Row: {
          enabled: boolean
          ends_at: string | null
          id: string
          message: string
          service_id: string | null
          starts_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          ends_at?: string | null
          id?: string
          message?: string
          service_id?: string | null
          starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          ends_at?: string | null
          id?: string
          message?: string
          service_id?: string | null
          starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_windows_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: { accepted_at: string | null; created_at: string; declined_at: string | null; email: string; expires_at: string; id: string; invited_by: string; organization_id: string; organization_name: string; project_id: string | null; recipient_user_id: string; revoked_at: string | null; role: string }
        Insert: { accepted_at?: string | null; created_at?: string; declined_at?: string | null; email: string; expires_at?: string; id?: string; invited_by: string; organization_id: string; organization_name: string; project_id?: string | null; recipient_user_id: string; revoked_at?: string | null; role: string }
        Update: { accepted_at?: string | null; created_at?: string; declined_at?: string | null; email?: string; expires_at?: string; id?: string; invited_by?: string; organization_id?: string; organization_name?: string; project_id?: string | null; recipient_user_id?: string; revoked_at?: string | null; role?: string }
        Relationships: []
      }
      organization_members: {
        Row: { created_at: string; invited_by: string | null; organization_id: string; role: string; user_id: string }
        Insert: { created_at?: string; invited_by?: string | null; organization_id: string; role: string; user_id: string }
        Update: { created_at?: string; invited_by?: string | null; organization_id?: string; role?: string; user_id?: string }
        Relationships: []
      }
      organizations: {
        Row: { created_at: string; id: string; kind: string; name: string; owner_id: string; updated_at: string }
        Insert: { created_at?: string; id?: string; kind: string; name: string; owner_id: string; updated_at?: string }
        Update: { created_at?: string; id?: string; kind?: string; name?: string; owner_id?: string; updated_at?: string }
        Relationships: []
      }
      project_members: {
        Row: { created_at: string; project_id: string; role: string; user_id: string }
        Insert: { created_at?: string; project_id: string; role: string; user_id: string }
        Update: { created_at?: string; project_id?: string; role?: string; user_id?: string }
        Relationships: []
      }
      project_service_limits: {
        Row: { project_id: string; requests_per_minute: number; service_slug: string; updated_at: string; updated_by: string | null }
        Insert: { project_id: string; requests_per_minute: number; service_slug: string; updated_at?: string; updated_by?: string | null }
        Update: { project_id?: string; requests_per_minute?: number; service_slug?: string; updated_at?: string; updated_by?: string | null }
        Relationships: []
      }
      projects: {
        Row: { created_at: string; created_by: string; description: string; id: string; name: string; organization_id: string; slug: string; updated_at: string }
        Insert: { created_at?: string; created_by: string; description?: string; id?: string; name: string; organization_id: string; slug: string; updated_at?: string }
        Update: { created_at?: string; created_by?: string; description?: string; id?: string; name?: string; organization_id?: string; slug?: string; updated_at?: string }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          plan: string
          plan_expires_at: string | null
          plan_grace_until: string | null
          plan_source: string
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          plan?: string
          plan_expires_at?: string | null
          plan_grace_until?: string | null
          plan_source?: string
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          plan?: string
          plan_expires_at?: string | null
          plan_grace_until?: string | null
          plan_source?: string
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string
          details: string
          id: string
          page_path: string
          rating: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details: string
          id?: string
          page_path?: string
          rating: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          page_path?: string
          rating?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bmg_create_organization: { Args: { p_kind: string; p_name: string }; Returns: string }
      bmg_create_project: { Args: { p_description?: string; p_name: string; p_organization_id: string }; Returns: string }
      bmg_invite_organization_member: { Args: { p_email: string; p_organization_id: string; p_project_id?: string | null; p_role: string }; Returns: string }
      bmg_list_organization_members: { Args: { p_organization_id: string }; Returns: { created_at: string; display_name: string | null; email: string | null; role: string; user_id: string }[] }
      bmg_respond_to_organization_invitation: { Args: { p_accept: boolean; p_invitation_id: string }; Returns: boolean }
      bmg_admin_record_export: {
        Args: { p_dataset: string; p_format: string; p_rows: number }
        Returns: Json
      }
      bmg_admin_set_service_archived: {
        Args: { p_archived: boolean; p_service_id: string }
        Returns: Json
      }
      bmg_admin_create_service_dependency: {
        Args: { p_dependency_type: string; p_description: string; p_depends_on_service_id: string; p_service_id: string }
        Returns: Json
      }
      bmg_admin_delete_service_dependency: {
        Args: { p_id: string }
        Returns: Json
      }
      bmg_admin_toggle_maintenance: {
        Args: { p_enabled: boolean; p_id: string }
        Returns: Json
      }
      bmg_admin_broadcast_notification: {
        Args: { p_body: string; p_title: string; p_type: string; p_user_id: string | null }
        Returns: Json
      }
      bmg_admin_create_api_service: {
        Args: {
          p_category: string; p_description: string; p_docs_markdown: string; p_endpoint_path: string
          p_http_method: string; p_name: string; p_slug: string; p_source_type: string; p_status: string; p_weight: number
        }
        Returns: Json
      }
      bmg_admin_update_api_service: {
        Args: {
          p_category: string; p_description: string; p_docs_markdown: string; p_endpoint_path: string
          p_http_method: string; p_name: string; p_service_id: string; p_slug: string; p_source_type: string; p_status: string; p_weight: number
        }
        Returns: Json
      }
      bmg_admin_update_limits: {
        Args: { p_daily_weighted_limit: number; p_max_api_keys: number; p_monthly_weighted_limit: number; p_requests_per_minute: number }
        Returns: Json
      }
      bmg_admin_update_plan_limits: {
        Args: { p_daily_weighted_limit: number; p_max_api_keys: number; p_monthly_weighted_limit: number; p_plan: string; p_requests_per_minute: number }
        Returns: Json
      }
      bmg_admin_add_incident_update: {
        Args: { p_incident_id: string; p_message: string }
        Returns: Json
      }
      bmg_admin_change_incident_status: {
        Args: { p_incident_id: string; p_message: string; p_status: string }
        Returns: Json
      }
      bmg_admin_create_incident: {
        Args: { p_affected_services: string[]; p_description: string; p_severity: string; p_status: string; p_title: string }
        Returns: Json
      }
      bmg_admin_configure_maintenance: {
        Args: {
          p_enabled: boolean
          p_ends_at: string | null
          p_message: string
          p_service_id: string | null
          p_starts_at: string | null
        }
        Returns: Json
      }
      bmg_admin_delete_api_key: { Args: { p_id: string }; Returns: boolean }
      bmg_admin_get_audit_logs: {
        Args: {
          p_action?: string
          p_actor_id?: string
          p_entity_type?: string
          p_hours?: number
          p_page?: number
          p_page_size?: number
          p_query?: string
        }
        Returns: Json
      }
      bmg_admin_get_request_logs: {
        Args: {
          p_hours?: number
          p_page?: number
          p_page_size?: number
          p_result?: string
          p_service?: string
          p_status_code?: number
          p_user_id?: string
        }
        Returns: Json
      }
      bmg_admin_get_service_versions: {
        Args: { p_service_id: string }
        Returns: Json
      }
      bmg_admin_list_api_keys: {
        Args: { p_status?: string; p_user_id?: string }
        Returns: Json
      }
      bmg_admin_revoke_api_key: { Args: { p_id: string }; Returns: boolean }
      bmg_admin_rollback_api_service: {
        Args: { p_service_id: string; p_version: number }
        Returns: number
      }
      bmg_admin_update_api_key: {
        Args: {
          p_expires_at: string
          p_id: string
          p_label: string
          p_scopes: string[]
        }
        Returns: boolean
      }
      bmg_admin_update_profile: {
        Args: {
          p_account_status: string
          p_plan: string
          p_plan_expires_at: string
          p_role: string
          p_user_id: string
        }
        Returns: boolean
      }
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
        Args: { p_expires_at?: string; p_key: string; p_label: string; p_project_id?: string | null }
        Returns: {
          created_at: string
          id: string
          key_prefix: string
          label: string
        }[]
      }
      bmg_delete_api_key: { Args: { p_id: string }; Returns: boolean }
      bmg_get_admin_analytics: {
        Args: {
          p_category?: string
          p_days?: number
          p_service?: string
          p_status_code?: number
          p_user_id?: string
        }
        Returns: Json
      }
      bmg_get_api_analytics: { Args: { p_days?: number }; Returns: Json }
      bmg_get_api_request_logs: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_service?: string
          p_status?: string
        }
        Returns: Json
      }
      bmg_get_public_status: { Args: never; Returns: Json }
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
        Args: { p_expires_at?: string; p_id: string; p_label: string }
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
