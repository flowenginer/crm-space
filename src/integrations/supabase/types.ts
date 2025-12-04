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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          business_hours: Json | null
          city: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          max_conversations_per_agent: number | null
          phone: string | null
          sla_first_response_minutes: number | null
          sla_resolution_minutes: number | null
          state: string | null
          timezone: string | null
          updated_at: string | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          business_hours?: Json | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          max_conversations_per_agent?: number | null
          phone?: string | null
          sla_first_response_minutes?: number | null
          sla_resolution_minutes?: number | null
          state?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          business_hours?: Json | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          max_conversations_per_agent?: number | null
          phone?: string | null
          sla_first_response_minutes?: number | null
          sla_resolution_minutes?: number | null
          state?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_to: string | null
          avatar_url: string | null
          birth_date: string | null
          blocked_reason: string | null
          city: string | null
          complement: string | null
          country: string | null
          cpf_cnpj: string | null
          created_at: string
          custom_fields: Json | null
          department_id: string | null
          email: string | null
          first_contact_at: string | null
          full_name: string
          id: string
          is_blocked: boolean | null
          is_online: boolean | null
          last_interaction_at: string | null
          last_seen_at: string | null
          lead_score: number | null
          lead_status: string | null
          neighborhood: string | null
          notes: string | null
          number: string | null
          origin: string | null
          origin_campaign: string | null
          person_type: string | null
          phone: string
          state: string | null
          street: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blocked_reason?: string | null
          city?: string | null
          complement?: string | null
          country?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          custom_fields?: Json | null
          department_id?: string | null
          email?: string | null
          first_contact_at?: string | null
          full_name: string
          id?: string
          is_blocked?: boolean | null
          is_online?: boolean | null
          last_interaction_at?: string | null
          last_seen_at?: string | null
          lead_score?: number | null
          lead_status?: string | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          origin?: string | null
          origin_campaign?: string | null
          person_type?: string | null
          phone: string
          state?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blocked_reason?: string | null
          city?: string | null
          complement?: string | null
          country?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          custom_fields?: Json | null
          department_id?: string | null
          email?: string | null
          first_contact_at?: string | null
          full_name?: string
          id?: string
          is_blocked?: boolean | null
          is_online?: boolean | null
          last_interaction_at?: string | null
          last_seen_at?: string | null
          lead_score?: number | null
          lead_status?: string | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          origin?: string | null
          origin_campaign?: string | null
          person_type?: string | null
          phone?: string
          state?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string | null
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel_id: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          contact_id: string
          created_at: string
          department_id: string | null
          first_response_at: string | null
          id: string
          is_unread: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          lead_status: string | null
          priority: string | null
          queue_id: string | null
          sla_status: string | null
          status: string | null
          transfer_note: string | null
          transferred_at: string | null
          transferred_from: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          contact_id: string
          created_at?: string
          department_id?: string | null
          first_response_at?: string | null
          id?: string
          is_unread?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_status?: string | null
          priority?: string | null
          queue_id?: string | null
          sla_status?: string | null
          status?: string | null
          transfer_note?: string | null
          transferred_at?: string | null
          transferred_from?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          contact_id?: string
          created_at?: string
          department_id?: string | null
          first_response_at?: string | null
          id?: string
          is_unread?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_status?: string | null
          priority?: string | null
          queue_id?: string | null
          sla_status?: string | null
          status?: string | null
          transfer_note?: string | null
          transferred_at?: string | null
          transferred_from?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          default_value: string | null
          entity_type: string
          field_key: string | null
          field_type: string
          id: string
          is_required: boolean | null
          is_visible: boolean | null
          name: string
          options: Json | null
          order_position: number | null
        }
        Insert: {
          created_at?: string
          default_value?: string | null
          entity_type: string
          field_key?: string | null
          field_type: string
          id?: string
          is_required?: boolean | null
          is_visible?: boolean | null
          name: string
          options?: Json | null
          order_position?: number | null
        }
        Update: {
          created_at?: string
          default_value?: string | null
          entity_type?: string
          field_key?: string | null
          field_type?: string
          id?: string
          is_required?: boolean | null
          is_visible?: boolean | null
          name?: string
          options?: Json | null
          order_position?: number | null
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          avg_first_response_seconds: number | null
          avg_resolution_seconds: number | null
          conversations_closed: number | null
          conversations_started: number | null
          conversations_transferred: number | null
          created_at: string | null
          date: string
          deals_created: number | null
          deals_lost: number | null
          deals_won: number | null
          department_id: string | null
          id: string
          messages_received: number | null
          messages_sent: number | null
          new_contacts: number | null
          revenue: number | null
          sla_critical: number | null
          sla_ok: number | null
          sla_warning: number | null
          user_id: string | null
        }
        Insert: {
          avg_first_response_seconds?: number | null
          avg_resolution_seconds?: number | null
          conversations_closed?: number | null
          conversations_started?: number | null
          conversations_transferred?: number | null
          created_at?: string | null
          date: string
          deals_created?: number | null
          deals_lost?: number | null
          deals_won?: number | null
          department_id?: string | null
          id?: string
          messages_received?: number | null
          messages_sent?: number | null
          new_contacts?: number | null
          revenue?: number | null
          sla_critical?: number | null
          sla_ok?: number | null
          sla_warning?: number | null
          user_id?: string | null
        }
        Update: {
          avg_first_response_seconds?: number | null
          avg_resolution_seconds?: number | null
          conversations_closed?: number | null
          conversations_started?: number | null
          conversations_transferred?: number | null
          created_at?: string | null
          date?: string
          deals_created?: number | null
          deals_lost?: number | null
          deals_won?: number | null
          department_id?: string | null
          id?: string
          messages_received?: number | null
          messages_sent?: number | null
          new_contacts?: number | null
          revenue?: number | null
          sla_critical?: number | null
          sla_ok?: number | null
          sla_warning?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_tags: {
        Row: {
          created_at: string | null
          deal_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          deal_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          deal_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tags_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          days_in_stage: number | null
          description: string | null
          expected_close_date: string | null
          id: string
          last_activity_at: string | null
          lost_reason: string | null
          order_position: number | null
          pipeline_id: string
          stage_entered_at: string | null
          stage_id: string
          status: string | null
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          days_in_stage?: number | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string | null
          lost_reason?: string | null
          order_position?: number | null
          pipeline_id: string
          stage_entered_at?: string | null
          stage_id: string
          status?: string | null
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          days_in_stage?: number | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string | null
          lost_reason?: string | null
          order_position?: number | null
          pipeline_id?: string
          stage_entered_at?: string | null
          stage_id?: string
          status?: string | null
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      internal_notes: {
        Row: {
          author_id: string
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_pinned: boolean | null
        }
        Insert: {
          author_id: string
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
        }
        Update: {
          author_id?: string
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          department_id: string | null
          folder_id: string | null
          id: string
          is_active: boolean | null
          is_favorite: boolean | null
          media_type: string | null
          media_url: string | null
          shortcut: string | null
          title: string
          updated_at: string
          usage_count: number | null
          variables: Json | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          media_type?: string | null
          media_url?: string | null
          shortcut?: string | null
          title: string
          updated_at?: string
          usage_count?: number | null
          variables?: Json | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          media_type?: string | null
          media_url?: string | null
          shortcut?: string | null
          title?: string
          updated_at?: string
          usage_count?: number | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "template_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          contact_id: string | null
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_deleted: boolean | null
          is_from_me: boolean | null
          media_mime_type: string | null
          media_url: string | null
          message_type: string | null
          reactions: Json | null
          reply_to_message_id: string | null
          sender_id: string | null
          status: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          contact_id?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_from_me?: boolean | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string | null
          reactions?: Json | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          status?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          contact_id?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_from_me?: boolean | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string | null
          reactions?: Json | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          status?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          daily_summary: boolean | null
          email_enabled: boolean | null
          id: string
          new_deals: boolean | null
          new_messages: boolean | null
          push_enabled: boolean | null
          sla_alerts: boolean | null
          stage_changes: boolean | null
          updated_at: string
          user_id: string | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          created_at?: string
          daily_summary?: boolean | null
          email_enabled?: boolean | null
          id?: string
          new_deals?: boolean | null
          new_messages?: boolean | null
          push_enabled?: boolean | null
          sla_alerts?: boolean | null
          stage_changes?: boolean | null
          updated_at?: string
          user_id?: string | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          created_at?: string
          daily_summary?: boolean | null
          email_enabled?: boolean | null
          id?: string
          new_deals?: boolean | null
          new_messages?: boolean | null
          push_enabled?: boolean | null
          sla_alerts?: boolean | null
          stage_changes?: boolean | null
          updated_at?: string
          user_id?: string | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_definitions: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          permission_key: string
          permission_name: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          permission_key: string
          permission_name: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          permission_key?: string
          permission_name?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          order_position: number
          pipeline_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          order_position: number
          pipeline_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          order_position?: number
          pipeline_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_conversations: number | null
          department_id: string | null
          full_name: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          is_available: boolean | null
          is_online: boolean | null
          last_login_at: string | null
          last_seen_at: string | null
          login_count: number | null
          max_conversations: number | null
          permissions: Json | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_conversations?: number | null
          department_id?: string | null
          full_name?: string | null
          id: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_available?: boolean | null
          is_online?: boolean | null
          last_login_at?: string | null
          last_seen_at?: string | null
          login_count?: number | null
          max_conversations?: number | null
          permissions?: Json | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_conversations?: number | null
          department_id?: string | null
          full_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_available?: boolean | null
          is_online?: boolean | null
          last_login_at?: string | null
          last_seen_at?: string | null
          login_count?: number | null
          max_conversations?: number | null
          permissions?: Json | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_agents: {
        Row: {
          agent_id: string
          created_at: string | null
          is_active: boolean | null
          queue_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          is_active?: boolean | null
          queue_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          is_active?: boolean | null
          queue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_agents_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      queues: {
        Row: {
          auto_assign: boolean | null
          business_hours: Json | null
          color: string | null
          created_at: string | null
          department_id: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          max_per_agent: number | null
          name: string
          priority: string | null
        }
        Insert: {
          auto_assign?: boolean | null
          business_hours?: Json | null
          color?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          max_per_agent?: number | null
          name: string
          priority?: string | null
        }
        Update: {
          auto_assign?: boolean | null
          business_hours?: Json | null
          color?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          max_per_agent?: number | null
          name?: string
          priority?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queues_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      role_definitions: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          order_position: number | null
          permissions: Json | null
          role_key: string
          role_name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          order_position?: number | null
          permissions?: Json | null
          role_key: string
          role_name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          order_position?: number | null
          permissions?: Json | null
          role_key?: string
          role_name?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          attempts: number | null
          channel_id: string
          contact_id: string | null
          content: string
          conversation_id: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          media_url: string | null
          message_type: string | null
          recurrence_rule: string | null
          scheduled_for: string
          sent_at: string | null
          status: string | null
          template_id: string | null
          variables: Json | null
        }
        Insert: {
          attempts?: number | null
          channel_id: string
          contact_id?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          recurrence_rule?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          variables?: Json | null
        }
        Update: {
          attempts?: number | null
          channel_id?: string
          contact_id?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          recurrence_rule?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          name: string
          usage_count: number | null
          visibility: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          usage_count?: number | null
          visibility?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          usage_count?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      template_folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "template_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          department_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          department_id?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role?: string
          status?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          department_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          instance_id: string | null
          payload: Json
          processed: boolean | null
          provider: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          instance_id?: string | null
          payload: Json
          processed?: boolean | null
          provider: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          instance_id?: string | null
          payload?: Json
          processed?: boolean | null
          provider?: string
        }
        Relationships: []
      }
      whatsapp_channels: {
        Row: {
          battery_level: number | null
          channel_id: string | null
          created_at: string
          deleted_at: string | null
          department_id: string | null
          id: string
          instance_id: string | null
          instance_token: string | null
          is_deleted: boolean | null
          last_sync_at: string | null
          messages_received: number | null
          messages_received_today: number | null
          messages_sent: number | null
          messages_sent_today: number | null
          name: string
          phone: string
          provider_id: string | null
          qr_code: string | null
          qr_expires_at: string | null
          session_data: Json | null
          status: string | null
          type: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          battery_level?: number | null
          channel_id?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          is_deleted?: boolean | null
          last_sync_at?: string | null
          messages_received?: number | null
          messages_received_today?: number | null
          messages_sent?: number | null
          messages_sent_today?: number | null
          name: string
          phone: string
          provider_id?: string | null
          qr_code?: string | null
          qr_expires_at?: string | null
          session_data?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          battery_level?: number | null
          channel_id?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          is_deleted?: boolean | null
          last_sync_at?: string | null
          messages_received?: number | null
          messages_received_today?: number | null
          messages_sent?: number | null
          messages_sent_today?: number | null
          name?: string
          phone?: string
          provider_id?: string | null
          qr_code?: string | null
          qr_expires_at?: string | null
          session_data?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_channels_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_channels_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_providers: {
        Row: {
          admin_token: string | null
          api_key: string | null
          api_secret: string | null
          base_url: string
          client_token: string | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_configured: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          admin_token?: string | null
          api_key?: string | null
          api_secret?: string | null
          base_url: string
          client_token?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_configured?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          admin_token?: string | null
          api_key?: string | null
          api_secret?: string | null
          base_url?: string
          client_token?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_configured?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_user_permission: {
        Args: { permission_key: string; user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_unread: { Args: { conv_id: string }; Returns: undefined }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      merge_duplicate_contacts: {
        Args: {
          p_duplicate_contact_id: string
          p_keep_contact_id: string
          p_use_duplicate_name?: boolean
        }
        Returns: undefined
      }
      merge_duplicate_conversations: {
        Args: {
          p_duplicate_conversation_id: string
          p_keep_conversation_id: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "supervisor" | "seller"
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
      app_role: ["admin", "user", "manager", "supervisor", "seller"],
    },
  },
} as const
