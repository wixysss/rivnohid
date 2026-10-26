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
      device_settings: {
        Row: {
          device_id: string
          sos_name: string | null
          sos_phone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          device_id: string
          sos_name?: string | null
          sos_phone: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          device_id?: string
          sos_name?: string | null
          sos_phone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      voice_notes: {
        Row: {
          audio: string
          created_at: string
          device_id: string | null
          duration_ms: number | null
          id: string
          lat: number | null
          lng: number | null
          sample_rate: number
        }
        Insert: {
          audio: string
          created_at?: string
          device_id?: string | null
          duration_ms?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          sample_rate?: number
        }
        Update: {
          audio?: string
          created_at?: string
          device_id?: string | null
          duration_ms?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          sample_rate?: number
        }
        Relationships: []
      }
      sos_events: {
        Row: {
          called: boolean
          created_at: string
          device_id: string | null
          id: string
          lat: number | null
          lng: number | null
          phone: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          called?: boolean
          created_at?: string
          device_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          phone?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          called?: boolean
          created_at?: string
          device_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          phone?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string | null
          name: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      marker_types: {
        Row: {
          id: number
          label: string
          slug: string
        }
        Insert: {
          id?: never
          label: string
          slug: string
        }
        Update: {
          id?: never
          label?: string
          slug?: string
        }
        Relationships: []
      }
      markers: {
        Row: {
          created_at: string
          description: string | null
          device_id: string | null
          event_id: string | null
          id: string
          lat: number
          lng: number
          severity: string
          source: string
          type_id: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          device_id?: string | null
          event_id?: string | null
          id?: string
          lat: number
          lng: number
          severity?: string
          source?: string
          type_id: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          device_id?: string | null
          event_id?: string | null
          id?: string
          lat?: number
          lng?: number
          severity?: string
          source?: string
          type_id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "markers_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markers_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "marker_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_sos_settings: {
        Args: never
        Returns: { sos_phone: string | null, sos_name: string | null, updated_at: string } | null
      }
      set_sos_settings: {
        Args: { p_name: string, p_phone: string }
        Returns: undefined
      }
      voice_note_audio: {
        Args: { p_id: string }
        Returns: string | null
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
