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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_field_values: {
        Row: {
          asset_id: string
          field_id: string
          id: string
          value: string | null
        }
        Insert: {
          asset_id: string
          field_id: string
          id?: string
          value?: string | null
        }
        Update: {
          asset_id?: string
          field_id?: string
          id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          category: string
          created_at: string
          field_type: string
          id: string
          name: string
          options: string[] | null
        }
        Insert: {
          category?: string
          created_at?: string
          field_type?: string
          id?: string
          name: string
          options?: string[] | null
        }
        Update: {
          category?: string
          created_at?: string
          field_type?: string
          id?: string
          name?: string
          options?: string[] | null
        }
        Relationships: []
      }
      integrity_duplicate_ignores: {
        Row: {
          created_at: string
          created_by: string | null
          duplicate_type: string
          id: string
          key_a: string
          key_b: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duplicate_type: string
          id?: string
          key_a: string
          key_b: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duplicate_type?: string
          id?: string
          key_a?: string
          key_b?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          asset_code: string
          asset_type: string | null
          cargo: string | null
          category: string
          collaborator: string | null
          comments: string | null
          condition: string
          contrato: string | null
          cost_center: string | null
          cost_center_eng: string | null
          cost_center_man: string | null
          created_at: string
          data_aquisicao: string | null
          data_bloqueio: string | null
          delivered_at: string | null
          email_address: string | null
          gestor: string | null
          id: string
          imei1: string | null
          imei2: string | null
          licenca: string | null
          marca: string | null
          model: string | null
          notes: string | null
          numero: string | null
          operadora: string | null
          reserved_by_ticket_id: string | null
          sector: string | null
          service_tag: string | null
          service_tag_2: string | null
          status: string
          updated_at: string
          valor_mensal: number | null
          valor_pago: number | null
        }
        Insert: {
          asset_code: string
          asset_type?: string | null
          cargo?: string | null
          category?: string
          collaborator?: string | null
          comments?: string | null
          condition?: string
          contrato?: string | null
          cost_center?: string | null
          cost_center_eng?: string | null
          cost_center_man?: string | null
          created_at?: string
          data_aquisicao?: string | null
          data_bloqueio?: string | null
          delivered_at?: string | null
          email_address?: string | null
          gestor?: string | null
          id?: string
          imei1?: string | null
          imei2?: string | null
          licenca?: string | null
          marca?: string | null
          model?: string | null
          notes?: string | null
          numero?: string | null
          operadora?: string | null
          reserved_by_ticket_id?: string | null
          sector?: string | null
          service_tag?: string | null
          service_tag_2?: string | null
          status?: string
          updated_at?: string
          valor_mensal?: number | null
          valor_pago?: number | null
        }
        Update: {
          asset_code?: string
          asset_type?: string | null
          cargo?: string | null
          category?: string
          collaborator?: string | null
          comments?: string | null
          condition?: string
          contrato?: string | null
          cost_center?: string | null
          cost_center_eng?: string | null
          cost_center_man?: string | null
          created_at?: string
          data_aquisicao?: string | null
          data_bloqueio?: string | null
          delivered_at?: string | null
          email_address?: string | null
          gestor?: string | null
          id?: string
          imei1?: string | null
          imei2?: string | null
          licenca?: string | null
          marca?: string | null
          model?: string | null
          notes?: string | null
          numero?: string | null
          operadora?: string | null
          reserved_by_ticket_id?: string | null
          sector?: string | null
          service_tag?: string | null
          service_tag_2?: string | null
          status?: string
          updated_at?: string
          valor_mensal?: number | null
          valor_pago?: number | null
        }
        Relationships: []
      }
      marketing_stages: {
        Row: {
          created_at: string
          id: string
          meta_status: string
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string
          id?: string
          meta_status?: string
          name: string
          order_index?: number
        }
        Update: {
          created_at?: string
          id?: string
          meta_status?: string
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      marketing_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      marketing_task_comments: {
        Row: {
          author_id: string
          author_name: string
          avatar_url: string | null
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          author_name?: string
          avatar_url?: string | null
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          avatar_url?: string | null
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "marketing_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_task_history: {
        Row: {
          action: string
          author_name: string
          created_at: string
          details: string
          id: string
          task_id: string
        }
        Insert: {
          action: string
          author_name?: string
          created_at?: string
          details?: string
          id?: string
          task_id: string
        }
        Update: {
          action?: string
          author_name?: string
          created_at?: string
          details?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "marketing_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_task_tags: {
        Row: {
          id: string
          tag_id: string
          task_id: string
        }
        Insert: {
          id?: string
          tag_id: string
          task_id: string
        }
        Update: {
          id?: string
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "marketing_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "marketing_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_tasks: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          checklist: Json | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_recurring: boolean
          next_recurrence_date: string | null
          order_index: number
          priority: string
          progress: string
          recurrence_rule: string | null
          requester_id: string | null
          requester_name: string
          stage_id: string | null
          start_date: string | null
          time_estimate_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_name?: string | null
          checklist?: Json | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          next_recurrence_date?: string | null
          order_index?: number
          priority?: string
          progress?: string
          recurrence_rule?: string | null
          requester_id?: string | null
          requester_name?: string
          stage_id?: string | null
          start_date?: string | null
          time_estimate_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          assignee_name?: string | null
          checklist?: Json | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          next_recurrence_date?: string | null
          order_index?: number
          priority?: string
          progress?: string
          recurrence_rule?: string | null
          requester_id?: string | null
          requester_name?: string
          stage_id?: string | null
          start_date?: string | null
          time_estimate_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "marketing_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      password_vault: {
        Row: {
          account_name: string
          created_at: string
          id: string
          notes: string | null
          password_value: string
          updated_at: string
          username: string
        }
        Insert: {
          account_name: string
          created_at?: string
          id?: string
          notes?: string | null
          password_value?: string
          updated_at?: string
          username?: string
        }
        Update: {
          account_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          password_value?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      sla_settings: {
        Row: {
          business_end: string
          business_hours_only: boolean
          business_start: string
          id: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          business_end?: string
          business_hours_only?: boolean
          business_start?: string
          id?: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          business_end?: string
          business_hours_only?: boolean
          business_start?: string
          id?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: []
      }
      status_config: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          id: string
          is_final: boolean
          nome: string
          ordem: number
          status_type: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id: string
          is_final?: boolean
          nome: string
          ordem?: number
          status_type?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          is_final?: boolean
          nome?: string
          ordem?: number
          status_type?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          author: string
          avatar_url: string | null
          content: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author: string
          avatar_url?: string | null
          content: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author?: string
          avatar_url?: string | null
          content?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_history: {
        Row: {
          action: string
          author: string
          created_at: string
          details: string
          id: string
          ticket_id: string
        }
        Insert: {
          action: string
          author?: string
          created_at?: string
          details: string
          id?: string
          ticket_id: string
        }
        Update: {
          action?: string
          author?: string
          created_at?: string
          details?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asset_id: string | null
          assignee: string | null
          bucket_name: string | null
          category: string
          checklist: Json | null
          completed_at: string | null
          created_at: string
          department: string | null
          description: string
          email: string
          external_notes: string | null
          id: string
          order_index: number | null
          parent_ticket_id: string | null
          priority: string
          progress: string
          requester: string
          sla_deadline: string
          sla_expired: boolean
          sla_hours: number
          status_id: string
          ticket_number: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assignee?: string | null
          bucket_name?: string | null
          category: string
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string
          department?: string | null
          description: string
          email: string
          external_notes?: string | null
          id?: string
          order_index?: number | null
          parent_ticket_id?: string | null
          priority?: string
          progress?: string
          requester: string
          sla_deadline: string
          sla_expired?: boolean
          sla_hours?: number
          status_id?: string
          ticket_number: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assignee?: string | null
          bucket_name?: string | null
          category?: string
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string
          department?: string | null
          description?: string
          email?: string
          external_notes?: string | null
          id?: string
          order_index?: number | null
          parent_ticket_id?: string | null
          priority?: string
          progress?: string
          requester?: string
          sla_deadline?: string
          sla_expired?: boolean
          sla_hours?: number
          status_id?: string
          ticket_number?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_parent_ticket_id_fkey"
            columns: ["parent_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_logs: {
        Row: {
          created_at: string
          duration_seconds: number | null
          end_time: string | null
          id: string
          marketing_task_id: string | null
          start_time: string
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          marketing_task_id?: string | null
          start_time?: string
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          marketing_task_id?: string | null
          start_time?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_logs_marketing_task_id_fkey"
            columns: ["marketing_task_id"]
            isOneToOne: false
            referencedRelation: "marketing_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_ti_admin_user_ids: { Args: never; Returns: string[] }
      get_user_emails: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "ti" | "marketing" | "colaborador"
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
      app_role: ["admin", "ti", "marketing", "colaborador"],
    },
  },
} as const
