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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          log_id: string
          mime_type: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          log_id: string
          mime_type?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          log_id?: string
          mime_type?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          cover_image_url: string | null
          cover_storage_path: string | null
          created_at: string
          created_by: string
          goal: string | null
          id: string
          title: string
        }
        Insert: {
          cover_image_url?: string | null
          cover_storage_path?: string | null
          created_at?: string
          created_by: string
          goal?: string | null
          id?: string
          title: string
        }
        Update: {
          cover_image_url?: string | null
          cover_storage_path?: string | null
          created_at?: string
          created_by?: string
          goal?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_links: {
        Row: {
          book_id: string
          created_at: string
          created_by: string
          id: string
          role: string
          token: string
        }
        Insert: {
          book_id: string
          created_at?: string
          created_by: string
          id?: string
          role?: string
          token: string
        }
        Update: {
          book_id?: string
          created_at?: string
          created_by?: string
          id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_links_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      log_marks: {
        Row: {
          created_at: string
          log_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          log_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          log_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_marks_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_marks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      log_tags: {
        Row: {
          log_id: string
          tag_id: string
        }
        Insert: {
          log_id: string
          tag_id: string
        }
        Update: {
          log_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_tags_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          page_end: number | null
          page_start: number | null
          parent_log_id: string | null
          resolved_at: string | null
          title: string | null
          type: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          parent_log_id?: string | null
          resolved_at?: string | null
          title?: string | null
          type?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          parent_log_id?: string | null
          resolved_at?: string | null
          title?: string | null
          type?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_parent_log_id_fkey"
            columns: ["parent_log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          book_id: string
          deleted_at: string | null
          display_order: number
          id: string
          joined_at: string
          last_seen_at: string
          role: string
          shelf_status: string
          user_id: string
        }
        Insert: {
          book_id: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          joined_at?: string
          last_seen_at?: string
          role?: string
          shelf_status?: string
          user_id: string
        }
        Update: {
          book_id?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          joined_at?: string
          last_seen_at?: string
          role?: string
          shelf_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
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
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          book_id: string
          id: string
          name: string
        }
        Insert: {
          book_id: string
          id?: string
          name: string
        }
        Update: {
          book_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          book_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          objective: string | null
          order: number
          page_from: number | null
          page_to: number | null
          presenter_id: string | null
          scheduled_date: string | null
          start_note: string | null
          status: string
          title: string
        }
        Insert: {
          book_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          objective?: string | null
          order: number
          page_from?: number | null
          page_to?: number | null
          presenter_id?: string | null
          scheduled_date?: string | null
          start_note?: string | null
          status?: string
          title: string
        }
        Update: {
          book_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          objective?: string | null
          order?: number
          page_from?: number | null
          page_to?: number | null
          presenter_id?: string | null
          scheduled_date?: string | null
          start_note?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_presenter_id_fkey"
            columns: ["presenter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_id_of_log: { Args: { target_log_id: string }; Returns: string }
      book_id_of_tag: { Args: { target_tag_id: string }; Returns: string }
      book_id_of_unit: { Args: { target_unit_id: string }; Returns: string }
      can_delete_storage_path: {
        Args: { object_path: string }
        Returns: boolean
      }
      can_edit: { Args: { target_book_id: string }; Returns: boolean }
      can_edit_storage_path: { Args: { object_path: string }; Returns: boolean }
      create_book: {
        Args: {
          book_cover_image_url?: string
          book_goal?: string
          book_title: string
        }
        Returns: string
      }
      has_any_membership: { Args: { target_book_id: string }; Returns: boolean }
      is_member: { Args: { target_book_id: string }; Returns: boolean }
      is_member_of_storage_path: {
        Args: { object_path: string }
        Returns: boolean
      }
      join_book_with_token: { Args: { invite_token: string }; Returns: string }
      shares_book_with: { Args: { target_user_id: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
