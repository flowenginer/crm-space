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
      chatbot_flows: {
        Row: {
          channel_ids: string[] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_draft: boolean | null
          name: string
          priority: number | null
          published_at: string | null
          run_once_per_contact: boolean | null
          total_completions: number | null
          total_errors: number | null
          total_executions: number | null
          updated_at: string | null
        }
        Insert: {
          channel_ids?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_draft?: boolean | null
          name: string
          priority?: number | null
          published_at?: string | null
          run_once_per_contact?: boolean | null
          total_completions?: number | null
          total_errors?: number | null
          total_executions?: number | null
          updated_at?: string | null
        }
        Update: {
          channel_ids?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_draft?: boolean | null
          name?: string
          priority?: number | null
          published_at?: string | null
          run_once_per_contact?: boolean | null
          total_completions?: number | null
          total_errors?: number | null
          total_executions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      close_reasons: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          order_position: number | null
          value: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_position?: number | null
          value: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_position?: number | null
          value?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          business_hours: Json | null
          city: string | null
          cnpj: string | null
          company_name: string | null
          conversion_status_ids: string[] | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          max_conversations_per_agent: number | null
          owner_agent_enabled: boolean | null
          owner_agent_inactivity_days: number | null
          owner_agent_on_reopen: boolean | null
          owner_agent_reopen_reasons: string[] | null
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
          conversion_status_ids?: string[] | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          max_conversations_per_agent?: number | null
          owner_agent_enabled?: boolean | null
          owner_agent_inactivity_days?: number | null
          owner_agent_on_reopen?: boolean | null
          owner_agent_reopen_reasons?: string[] | null
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
          conversion_status_ids?: string[] | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          max_conversations_per_agent?: number | null
          owner_agent_enabled?: boolean | null
          owner_agent_inactivity_days?: number | null
          owner_agent_on_reopen?: boolean | null
          owner_agent_reopen_reasons?: string[] | null
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
      contact_requests: {
        Row: {
          contact_id: string
          conversation_id: string | null
          created_at: string | null
          current_owner_id: string | null
          id: string
          reason: string | null
          request_type: string
          requester_id: string
          responded_at: string | null
          responded_by: string | null
          response_note: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id: string
          conversation_id?: string | null
          created_at?: string | null
          current_owner_id?: string | null
          id?: string
          reason?: string | null
          request_type: string
          requester_id: string
          responded_at?: string | null
          responded_by?: string | null
          response_note?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          conversation_id?: string | null
          created_at?: string | null
          current_owner_id?: string | null
          id?: string
          reason?: string | null
          request_type?: string
          requester_id?: string
          responded_at?: string | null
          responded_by?: string | null
          response_note?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_current_owner_id_fkey"
            columns: ["current_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          is_typing: boolean | null
          last_interaction_at: string | null
          last_seen_at: string | null
          lead_score: number | null
          lead_status: string | null
          negotiated_value: number | null
          neighborhood: string | null
          notes: string | null
          number: string | null
          origin: string | null
          origin_campaign: string | null
          person_type: string | null
          phone: string
          referral_data: Json | null
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
          is_typing?: boolean | null
          last_interaction_at?: string | null
          last_seen_at?: string | null
          lead_score?: number | null
          lead_status?: string | null
          negotiated_value?: number | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          origin?: string | null
          origin_campaign?: string | null
          person_type?: string | null
          phone: string
          referral_data?: Json | null
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
          is_typing?: boolean | null
          last_interaction_at?: string | null
          last_seen_at?: string | null
          lead_score?: number | null
          lead_status?: string | null
          negotiated_value?: number | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          origin?: string | null
          origin_campaign?: string | null
          person_type?: string | null
          phone?: string
          referral_data?: Json | null
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
      conversation_events: {
        Row: {
          actor_id: string | null
          conversation_id: string
          created_at: string | null
          data: Json | null
          event_type: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          conversation_id: string
          created_at?: string | null
          data?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          conversation_id?: string
          created_at?: string | null
          data?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
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
          previous_close_reason: string | null
          previous_closed_at: string | null
          previous_closed_by: string | null
          priority: string | null
          queue_id: string | null
          referral_data: Json | null
          referral_source: string | null
          reopen_count: number | null
          reopened_at: string | null
          sla_status: string | null
          status: string | null
          total_active_time_seconds: number | null
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
          previous_close_reason?: string | null
          previous_closed_at?: string | null
          previous_closed_by?: string | null
          priority?: string | null
          queue_id?: string | null
          referral_data?: Json | null
          referral_source?: string | null
          reopen_count?: number | null
          reopened_at?: string | null
          sla_status?: string | null
          status?: string | null
          total_active_time_seconds?: number | null
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
          previous_close_reason?: string | null
          previous_closed_at?: string | null
          previous_closed_by?: string | null
          priority?: string | null
          queue_id?: string | null
          referral_data?: Json | null
          referral_source?: string | null
          reopen_count?: number | null
          reopened_at?: string | null
          sla_status?: string | null
          status?: string | null
          total_active_time_seconds?: number | null
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
            foreignKeyName: "conversations_previous_closed_by_fkey"
            columns: ["previous_closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      flow_connections: {
        Row: {
          created_at: string | null
          flow_id: string | null
          id: string
          source_handle: string | null
          source_node_id: string | null
          target_node_id: string | null
        }
        Insert: {
          created_at?: string | null
          flow_id?: string | null
          id?: string
          source_handle?: string | null
          source_node_id?: string | null
          target_node_id?: string | null
        }
        Update: {
          created_at?: string | null
          flow_id?: string | null
          id?: string
          source_handle?: string | null
          source_node_id?: string | null
          target_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_connections_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_connections_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_connections_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_execution_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          execution_id: string | null
          id: string
          log_type: string
          message: string
          node_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          execution_id?: string | null
          id?: string
          log_type: string
          message: string
          node_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          execution_id?: string | null
          id?: string
          log_type?: string
          message?: string
          node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_execution_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "flow_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_executions: {
        Row: {
          channel_id: string | null
          completed_at: string | null
          contact_id: string | null
          conversation_id: string | null
          current_node_id: string | null
          error_message: string | null
          flow_id: string | null
          id: string
          last_activity_at: string | null
          started_at: string | null
          status: string | null
          variables: Json | null
          waiting_for: string | null
          waiting_until: string | null
        }
        Insert: {
          channel_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          current_node_id?: string | null
          error_message?: string | null
          flow_id?: string | null
          id?: string
          last_activity_at?: string | null
          started_at?: string | null
          status?: string | null
          variables?: Json | null
          waiting_for?: string | null
          waiting_until?: string | null
        }
        Update: {
          channel_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          current_node_id?: string | null
          error_message?: string | null
          flow_id?: string | null
          id?: string
          last_activity_at?: string | null
          started_at?: string | null
          status?: string | null
          variables?: Json | null
          waiting_for?: string | null
          waiting_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_executions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_node_templates: {
        Row: {
          category: string
          color: string | null
          created_at: string | null
          default_config: Json | null
          description: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          node_subtype: string
          node_type: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string | null
          default_config?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          node_subtype: string
          node_type: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string | null
          default_config?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          node_subtype?: string
          node_type?: string
        }
        Relationships: []
      }
      flow_nodes: {
        Row: {
          config: Json | null
          created_at: string | null
          flow_id: string | null
          id: string
          name: string | null
          node_subtype: string
          node_type: string
          position_x: number | null
          position_y: number | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          flow_id?: string | null
          id?: string
          name?: string | null
          node_subtype: string
          node_type: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          flow_id?: string | null
          id?: string
          name?: string | null
          node_subtype?: string
          node_type?: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          created: number | null
          created_at: string | null
          created_by: string | null
          errors: number | null
          id: string
          log: Json | null
          processed: number | null
          skipped: number | null
          source_name: string
          source_type: string
          status: string | null
          tags_assigned: number | null
          tags_created: number | null
          total_rows: number | null
          updated: number | null
        }
        Insert: {
          created?: number | null
          created_at?: string | null
          created_by?: string | null
          errors?: number | null
          id?: string
          log?: Json | null
          processed?: number | null
          skipped?: number | null
          source_name: string
          source_type: string
          status?: string | null
          tags_assigned?: number | null
          tags_created?: number | null
          total_rows?: number | null
          updated?: number | null
        }
        Update: {
          created?: number | null
          created_at?: string | null
          created_by?: string | null
          errors?: number | null
          id?: string
          log?: Json | null
          processed?: number | null
          skipped?: number | null
          source_name?: string
          source_type?: string
          status?: string | null
          tags_assigned?: number | null
          tags_created?: number | null
          total_rows?: number | null
          updated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      lead_assignment_history: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assigned_from: string | null
          assigned_to: string | null
          assignment_type: string | null
          contact_id: string
          conversation_id: string | null
          created_at: string | null
          id: string
          time_to_assign_seconds: number | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_from?: string | null
          assigned_to?: string | null
          assignment_type?: string | null
          contact_id: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          time_to_assign_seconds?: number | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_from?: string | null
          assigned_to?: string | null
          assignment_type?: string | null
          contact_id?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          time_to_assign_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_history_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_assigned_from_fkey"
            columns: ["assigned_from"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          contact_id: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          new_status: string
          previous_status: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          contact_id: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          new_status: string
          previous_status?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          contact_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          new_status?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_status_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_statuses: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          order_position: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_position: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_position?: number
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          category: string | null
          content: string
          content_blocks: Json | null
          created_at: string
          created_by: string | null
          department_id: string | null
          folder_id: string | null
          id: string
          is_active: boolean | null
          is_favorite: boolean | null
          media_name: string | null
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
          content_blocks?: Json | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          media_name?: string | null
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
          content_blocks?: Json | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          media_name?: string | null
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
      meta_ad_accounts: {
        Row: {
          access_token: string
          account_id: string
          account_name: string | null
          business_id: string | null
          created_at: string | null
          currency: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          refresh_token: string | null
          timezone: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          account_id: string
          account_name?: string | null
          business_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          refresh_token?: string | null
          timezone?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          account_id?: string
          account_name?: string | null
          business_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          refresh_token?: string | null
          timezone?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      meta_adsets: {
        Row: {
          adset_id: string
          campaign_id: string | null
          daily_budget: number | null
          id: string
          lifetime_budget: number | null
          meta_account_id: string | null
          name: string
          status: string | null
          targeting: Json | null
          updated_at: string | null
        }
        Insert: {
          adset_id: string
          campaign_id?: string | null
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_account_id?: string | null
          name: string
          status?: string | null
          targeting?: Json | null
          updated_at?: string | null
        }
        Update: {
          adset_id?: string
          campaign_id?: string | null
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_account_id?: string | null
          name?: string
          status?: string | null
          targeting?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_adsets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_adsets_meta_account_id_fkey"
            columns: ["meta_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaign_insights: {
        Row: {
          actions: Json | null
          campaign_id: string | null
          clicks: number | null
          conversions: number | null
          cost_per_conversion: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          date_start: string
          date_stop: string
          id: string
          impressions: number | null
          reach: number | null
          spend: number | null
        }
        Insert: {
          actions?: Json | null
          campaign_id?: string | null
          clicks?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date_start: string
          date_stop: string
          id?: string
          impressions?: number | null
          reach?: number | null
          spend?: number | null
        }
        Update: {
          actions?: Json | null
          campaign_id?: string | null
          clicks?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date_start?: string
          date_stop?: string
          id?: string
          impressions?: number | null
          reach?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaign_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          campaign_id: string
          created_time: string | null
          daily_budget: number | null
          id: string
          lifetime_budget: number | null
          meta_account_id: string | null
          name: string
          objective: string | null
          start_time: string | null
          status: string | null
          stop_time: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          created_time?: string | null
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_account_id?: string | null
          name: string
          objective?: string | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          created_time?: string | null
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_account_id?: string | null
          name?: string
          objective?: string | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_meta_account_id_fkey"
            columns: ["meta_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
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
      pinned_conversations: {
        Row: {
          conversation_id: string
          id: string
          pinned_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          pinned_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          pinned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_conversations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
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
      user_departments: {
        Row: {
          created_at: string | null
          department_id: string
          id: string
          is_primary: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department_id: string
          id?: string
          is_primary?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          department_id?: string
          id?: string
          is_primary?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_departments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      user_sessions: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string | null
          device_type: string | null
          ended_at: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_activity_at: string | null
          os: string | null
          region: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          ended_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_activity_at?: string | null
          os?: string | null
          region?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          ended_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_activity_at?: string | null
          os?: string | null
          region?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          auth_header_name: string | null
          auth_header_value: string | null
          auth_token: string | null
          auth_type: string | null
          created_at: string | null
          created_by: string | null
          events: Json | null
          filters: Json | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_sent_at: string | null
          name: string
          total_failed: number | null
          total_sent: number | null
          total_success: number | null
          updated_at: string | null
          url: string
        }
        Insert: {
          auth_header_name?: string | null
          auth_header_value?: string | null
          auth_token?: string | null
          auth_type?: string | null
          created_at?: string | null
          created_by?: string | null
          events?: Json | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sent_at?: string | null
          name: string
          total_failed?: number | null
          total_sent?: number | null
          total_success?: number | null
          updated_at?: string | null
          url: string
        }
        Update: {
          auth_header_name?: string | null
          auth_header_value?: string | null
          auth_token?: string | null
          auth_type?: string | null
          created_at?: string | null
          created_by?: string | null
          events?: Json | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sent_at?: string | null
          name?: string
          total_failed?: number | null
          total_sent?: number | null
          total_success?: number | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          event_type: string
          id: string
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_time_ms: number | null
          status: string | null
          status_code: number | null
          webhook_id: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          response_time_ms?: number | null
          status?: string | null
          status_code?: number | null
          webhook_id?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_time_ms?: number | null
          status?: string | null
          status_code?: number | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
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
      can_access_conversation: {
        Args: { conv_id: string; user_id: string }
        Returns: boolean
      }
      can_create_conversation_for_contact: {
        Args: { p_contact_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_all_data: { Args: { _user_id: string }; Returns: boolean }
      check_user_permission: {
        Args: { permission_key: string; user_id: string }
        Returns: boolean
      }
      get_agent_distribution_advanced: {
        Args: {
          p_conversion_status_names?: string[]
          p_date_from: string
          p_date_to: string
          p_department_id?: string
        }
        Returns: {
          agent_id: string
          agent_name: string
          avatar_url: string
          avg_response_time: number
          conversion_rate: number
          conversions: number
          leads_received: number
          leads_responded: number
          meta_ads_count: number
          organic_count: number
          other_count: number
        }[]
      }
      get_contact_filter_counts: { Args: never; Returns: Json }
      get_contacts_by_tag_filter: {
        Args: {
          p_assigned_to?: string
          p_department_id?: string
          p_limit?: number
          p_offset?: number
          p_search_query?: string
          p_state_filter?: string
          p_status_filter?: string
          p_tag_ids: string[]
        }
        Returns: {
          contact_id: string
          total_count: number
        }[]
      }
      get_conversation_owner_name: {
        Args: { conv_id: string }
        Returns: string
      }
      get_conversation_tag_counts: {
        Args: {
          p_agent_id?: string
          p_channel_id?: string
          p_department_id?: string
          p_origin?: string
        }
        Returns: Json
      }
      get_conversion_timeline: {
        Args: {
          p_agent_id?: string
          p_conversion_status_names?: string[]
          p_date_from: string
          p_date_to: string
          p_department_id?: string
        }
        Returns: {
          conversions: number
          date_day: string
          new_leads: number
        }[]
      }
      get_lead_alerts: {
        Args: {
          p_agent_id?: string
          p_department_id?: string
          p_limit?: number
        }
        Returns: {
          alert_type: string
          contact_id: string
          contact_name: string
          contact_phone: string
          conversation_id: string
          lead_status: string
          waiting_minutes: number
        }[]
      }
      get_lead_journey_metrics: {
        Args: {
          p_agent_id?: string
          p_conversion_status_names?: string[]
          p_date_from: string
          p_date_to: string
          p_department_id?: string
        }
        Returns: {
          assignment_rate: number
          avg_time_to_assignment: number
          avg_time_to_first_response: number
          conversion_rate: number
          conversions: number
          lead_response_rate: number
          total_assigned: number
          total_unassigned: number
        }[]
      }
      get_lead_status_summary: {
        Args: { _user_id?: string }
        Returns: {
          contact_count: number
          lead_status: string
          total_value: number
        }[]
      }
      get_leads_by_origin: {
        Args: {
          p_agent_id?: string
          p_conversion_status_names?: string[]
          p_date_from: string
          p_date_to: string
          p_department_id?: string
        }
        Returns: {
          converted: number
          origin: string
          total: number
        }[]
      }
      get_origin_timeline: {
        Args: {
          p_agent_id?: string
          p_date_from: string
          p_date_to: string
          p_department_id?: string
        }
        Returns: {
          date_day: string
          meta_ads_count: number
          organic_count: number
          other_count: number
        }[]
      }
      get_status_funnel: {
        Args: {
          p_agent_id?: string
          p_date_from: string
          p_date_to: string
          p_department_id?: string
        }
        Returns: {
          avg_duration: number
          color: string
          order_position: number
          status_count: number
          status_name: string
        }[]
      }
      get_user_department_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_unread: { Args: { conv_id: string }; Returns: undefined }
      increment_webhook_stats: {
        Args: {
          p_error_message?: string
          p_is_success: boolean
          p_webhook_id: string
        }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_supervisor: { Args: { _user_id: string }; Returns: boolean }
      is_lid_contact: { Args: { phone: string }; Returns: boolean }
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
      search_conversations_report: {
        Args: {
          p_agent_ids?: string[]
          p_channel_ids?: string[]
          p_department_ids?: string[]
          p_end_date?: string
          p_lead_status?: string[]
          p_name?: string
          p_page?: number
          p_page_size?: number
          p_phone?: string
          p_start_date?: string
          p_tag_ids?: string[]
        }
        Returns: {
          agent_name: string
          assigned_to: string
          channel_id: string
          channel_name: string
          close_reason: string
          closed_at: string
          contact_full_name: string
          contact_id: string
          contact_lead_status: string
          contact_phone: string
          created_at: string
          department_id: string
          department_name: string
          first_message_content: string
          id: string
          last_message_at: string
          lead_status: string
          status: string
          total_count: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      transfer_conversation: {
        Args: {
          p_conversation_id: string
          p_note?: string
          p_to_department_id?: string
          p_to_user_id: string
        }
        Returns: boolean
      }
      user_has_department: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
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
