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
      attendance: {
        Row: {
          date: string
          id: string
          notes: string | null
          overtime_seconds: number
          status: Database["public"]["Enums"]["attendance_status"]
          total_work_seconds: number
          undertime_seconds: number
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          notes?: string | null
          overtime_seconds?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          total_work_seconds?: number
          undertime_seconds?: number
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          notes?: string | null
          overtime_seconds?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          total_work_seconds?: number
          undertime_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_corrections: {
        Row: {
          date: string
          id: string
          original_in: string | null
          original_out: string | null
          reason: string
          requested_in: string
          requested_out: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["correction_status"]
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          original_in?: string | null
          original_out?: string | null
          reason: string
          requested_in: string
          requested_out: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          original_in?: string | null
          original_out?: string | null
          reason?: string
          requested_in?: string
          requested_out?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          device_id: string
          id: string
          last_seen_at: string | null
          os_type: Database["public"]["Enums"]["os_type"]
          user_id: string
        }
        Insert: {
          device_id: string
          id?: string
          last_seen_at?: string | null
          os_type: Database["public"]["Enums"]["os_type"]
          user_id: string
        }
        Update: {
          device_id?: string
          id?: string
          last_seen_at?: string | null
          os_type?: Database["public"]["Enums"]["os_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          device_id: string | null
          id: string
          metadata: Json | null
          processed: boolean
          processed_at: string | null
          timestamp: string
          type: Database["public"]["Enums"]["event_type"]
          user_id: string
        }
        Insert: {
          device_id?: string | null
          id?: string
          metadata?: Json | null
          processed?: boolean
          processed_at?: string | null
          timestamp: string
          type: Database["public"]["Enums"]["event_type"]
          user_id: string
        }
        Update: {
          device_id?: string | null
          id?: string
          metadata?: Json | null
          processed?: boolean
          processed_at?: string | null
          timestamp?: string
          type?: Database["public"]["Enums"]["event_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          manager_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_teams_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          password_hash: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          password_hash: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          password_hash?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          id: string
          source: Database["public"]["Enums"]["session_source"]
          start_time: string
          total_active_seconds: number
          total_idle_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          source?: Database["public"]["Enums"]["session_source"]
          start_time: string
          total_active_seconds?: number
          total_idle_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          source?: Database["public"]["Enums"]["session_source"]
          start_time?: string
          total_active_seconds?: number
          total_idle_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      attendance_status: "PRESENT" | "ABSENT" | "LEAVE" | "HOLIDAY"
      correction_status: "PENDING" | "APPROVED" | "REJECTED"
      event_type:
        | "LOGIN"
        | "LOGOUT"
        | "ACTIVITY"
        | "IDLE_START"
        | "IDLE_END"
        | "MANUAL_CLOCK_IN"
        | "MANUAL_CLOCK_OUT"
      os_type: "WINDOWS" | "MACOS" | "LINUX"
      session_source: "AUTO" | "MANUAL" | "MIXED"
      user_role: "EMPLOYEE" | "MANAGER" | "ADMIN"
      user_status: "ACTIVE" | "INACTIVE"
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
      attendance_status: ["PRESENT", "ABSENT", "LEAVE", "HOLIDAY"],
      correction_status: ["PENDING", "APPROVED", "REJECTED"],
      event_type: [
        "LOGIN",
        "LOGOUT",
        "ACTIVITY",
        "IDLE_START",
        "IDLE_END",
        "MANUAL_CLOCK_IN",
        "MANUAL_CLOCK_OUT",
      ],
      os_type: ["WINDOWS", "MACOS", "LINUX"],
      session_source: ["AUTO", "MANUAL", "MIXED"],
      user_role: ["EMPLOYEE", "MANAGER", "ADMIN"],
      user_status: ["ACTIVE", "INACTIVE"],
    },
  },
} as const
