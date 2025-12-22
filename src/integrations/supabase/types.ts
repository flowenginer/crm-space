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
      account_movements: {
        Row: {
          account_id: string
          amount: number
          balance_after: number
          balance_before: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string | null
          transaction_id: string | null
          type: string
        }
        Insert: {
          account_id: string
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
          transaction_id?: string | null
          type: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
          transaction_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_movements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      active_rescues: {
        Row: {
          activated_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          contact_id: string
          conversation_id: string
          created_at: string | null
          current_step: number | null
          id: string
          next_send_at: string | null
          responded_at: string | null
          status: string | null
          template_id: string
          updated_at: string | null
        }
        Insert: {
          activated_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          contact_id: string
          conversation_id: string
          created_at?: string | null
          current_step?: number | null
          id?: string
          next_send_at?: string | null
          responded_at?: string | null
          status?: string | null
          template_id: string
          updated_at?: string | null
        }
        Update: {
          activated_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          contact_id?: string
          conversation_id?: string
          created_at?: string | null
          current_step?: number | null
          id?: string
          next_send_at?: string | null
          responded_at?: string | null
          status?: string | null
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "active_rescues_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_rescues_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_rescues_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_rescues_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_rescues_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rescue_templates"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ad_message_patterns: {
        Row: {
          campaign_name: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          match_type: string
          pattern: string
          priority: number
          source: string
          updated_at: string
        }
        Insert: {
          campaign_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          match_type?: string
          pattern: string
          priority?: number
          source?: string
          updated_at?: string
        }
        Update: {
          campaign_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          match_type?: string
          pattern?: string
          priority?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      availability_release_requests: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          locked_by: string | null
          reason: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          locked_by?: string | null
          reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          locked_by?: string | null
          reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_release_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_release_requests_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_release_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_dispatch_contacts: {
        Row: {
          active_rescue_id: string | null
          contact_id: string
          conversation_id: string | null
          created_at: string
          dispatch_id: string
          error_message: string | null
          id: string
          responded_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          active_rescue_id?: string | null
          contact_id: string
          conversation_id?: string | null
          created_at?: string
          dispatch_id: string
          error_message?: string | null
          id?: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          active_rescue_id?: string | null
          contact_id?: string
          conversation_id?: string | null
          created_at?: string
          dispatch_id?: string
          error_message?: string | null
          id?: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_dispatch_contacts_active_rescue_id_fkey"
            columns: ["active_rescue_id"]
            isOneToOne: false
            referencedRelation: "active_rescues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_dispatch_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_dispatch_contacts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_dispatch_contacts_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "bulk_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_dispatches: {
        Row: {
          channel_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_count: number
          filters: Json
          id: string
          interval_seconds: number
          name: string
          paused_at: string | null
          processed_count: number
          responded_count: number
          sent_count: number
          started_at: string | null
          status: string
          template_id: string
          total_contacts: number
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          filters?: Json
          id?: string
          interval_seconds?: number
          name: string
          paused_at?: string | null
          processed_count?: number
          responded_count?: number
          sent_count?: number
          started_at?: string | null
          status?: string
          template_id: string
          total_contacts?: number
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          filters?: Json
          id?: string
          interval_seconds?: number
          name?: string
          paused_at?: string | null
          processed_count?: number
          responded_count?: number
          sent_count?: number
          started_at?: string | null
          status?: string
          template_id?: string
          total_contacts?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_dispatches_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_dispatches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_dispatches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rescue_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_date: string
          call_time: string
          contact_id: string
          conversation_id: string | null
          created_at: string | null
          followup_date: string | null
          followup_message: string | null
          id: string
          notes: string | null
          result_id: string | null
          schedule_followup: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          call_date?: string
          call_time?: string
          contact_id: string
          conversation_id?: string | null
          created_at?: string | null
          followup_date?: string | null
          followup_message?: string | null
          id?: string
          notes?: string | null
          result_id?: string | null
          schedule_followup?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          call_date?: string
          call_time?: string
          contact_id?: string
          conversation_id?: string | null
          created_at?: string | null
          followup_date?: string | null
          followup_message?: string | null
          id?: string
          notes?: string | null
          result_id?: string | null
          schedule_followup?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "call_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_results: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          order_position: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_position?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_position?: number | null
        }
        Relationships: []
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
          gamification_source: string | null
          id: string
          lead_distribution_agents: Json | null
          lead_distribution_department_id: string | null
          lead_distribution_enabled: boolean | null
          lead_distribution_include_offline: boolean | null
          lead_distribution_position: number | null
          lead_distribution_type: string | null
          logo_url: string | null
          max_conversations_per_agent: number | null
          owner_agent_enabled: boolean | null
          owner_agent_inactivity_days: number | null
          owner_agent_on_reopen: boolean | null
          owner_agent_reopen_reasons: string[] | null
          payment_gateway_config: Json | null
          phone: string | null
          response_alert_minutes: number | null
          shipping_config: Json | null
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
          gamification_source?: string | null
          id?: string
          lead_distribution_agents?: Json | null
          lead_distribution_department_id?: string | null
          lead_distribution_enabled?: boolean | null
          lead_distribution_include_offline?: boolean | null
          lead_distribution_position?: number | null
          lead_distribution_type?: string | null
          logo_url?: string | null
          max_conversations_per_agent?: number | null
          owner_agent_enabled?: boolean | null
          owner_agent_inactivity_days?: number | null
          owner_agent_on_reopen?: boolean | null
          owner_agent_reopen_reasons?: string[] | null
          payment_gateway_config?: Json | null
          phone?: string | null
          response_alert_minutes?: number | null
          shipping_config?: Json | null
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
          gamification_source?: string | null
          id?: string
          lead_distribution_agents?: Json | null
          lead_distribution_department_id?: string | null
          lead_distribution_enabled?: boolean | null
          lead_distribution_include_offline?: boolean | null
          lead_distribution_position?: number | null
          lead_distribution_type?: string | null
          logo_url?: string | null
          max_conversations_per_agent?: number | null
          owner_agent_enabled?: boolean | null
          owner_agent_inactivity_days?: number | null
          owner_agent_on_reopen?: boolean | null
          owner_agent_reopen_reasons?: string[] | null
          payment_gateway_config?: Json | null
          phone?: string | null
          response_alert_minutes?: number | null
          shipping_config?: Json | null
          sla_first_response_minutes?: number | null
          sla_resolution_minutes?: number | null
          state?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_lead_distribution_department_id_fkey"
            columns: ["lead_distribution_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_merge_log: {
        Row: {
          conversations_transferred: number | null
          id: string
          keep_contact_id: string
          keep_name: string | null
          keep_phone: string | null
          merged_at: string | null
          merged_contact_id: string
          merged_name: string | null
          merged_phone: string | null
          messages_transferred: number | null
          tags_transferred: number | null
        }
        Insert: {
          conversations_transferred?: number | null
          id?: string
          keep_contact_id: string
          keep_name?: string | null
          keep_phone?: string | null
          merged_at?: string | null
          merged_contact_id: string
          merged_name?: string | null
          merged_phone?: string | null
          messages_transferred?: number | null
          tags_transferred?: number | null
        }
        Update: {
          conversations_transferred?: number | null
          id?: string
          keep_contact_id?: string
          keep_name?: string | null
          keep_phone?: string | null
          merged_at?: string | null
          merged_contact_id?: string
          merged_name?: string | null
          merged_phone?: string | null
          messages_transferred?: number | null
          tags_transferred?: number | null
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
          contact_type: string | null
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
          segment_id: string | null
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
          contact_type?: string | null
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
          segment_id?: string | null
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
          contact_type?: string | null
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
          segment_id?: string | null
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
          {
            foreignKeyName: "contacts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
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
          is_new_transfer: boolean | null
          is_unread: boolean | null
          last_message_at: string | null
          last_message_is_from_me: boolean | null
          last_message_preview: string | null
          lead_status: string | null
          origin_detection_method: string | null
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
          is_new_transfer?: boolean | null
          is_unread?: boolean | null
          last_message_at?: string | null
          last_message_is_from_me?: boolean | null
          last_message_preview?: string | null
          lead_status?: string | null
          origin_detection_method?: string | null
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
          is_new_transfer?: boolean | null
          is_unread?: boolean | null
          last_message_at?: string | null
          last_message_is_from_me?: boolean | null
          last_message_preview?: string | null
          lead_status?: string | null
          origin_detection_method?: string | null
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
          can_transfer_freely: boolean | null
          can_view_all_conversations: boolean | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          can_transfer_freely?: boolean | null
          can_view_all_conversations?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          can_transfer_freely?: boolean | null
          can_view_all_conversations?: boolean | null
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
      email_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          details: Json | null
          email_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          email_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          email_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activity_log_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "internal_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_shared_box_members: {
        Row: {
          created_at: string | null
          is_active: boolean | null
          order_position: number | null
          shared_box_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          is_active?: boolean | null
          order_position?: number | null
          shared_box_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          is_active?: boolean | null
          order_position?: number | null
          shared_box_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_shared_box_members_shared_box_id_fkey"
            columns: ["shared_box_id"]
            isOneToOne: false
            referencedRelation: "email_shared_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_shared_box_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_shared_boxes: {
        Row: {
          created_at: string | null
          current_position: number | null
          department_id: string | null
          description: string | null
          distribution_type: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_position?: number | null
          department_id?: string | null
          description?: string | null
          distribution_type?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_position?: number | null
          department_id?: string | null
          description?: string | null
          distribution_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_shared_boxes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_visibility_rules: {
        Row: {
          created_at: string | null
          id: string
          is_allowed: boolean | null
          source_role: string
          target_role: string | null
          target_shared_box_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_allowed?: boolean | null
          source_role: string
          target_role?: string | null
          target_shared_box_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_allowed?: boolean | null
          source_role?: string
          target_role?: string | null
          target_shared_box_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_visibility_rules_target_shared_box_id_fkey"
            columns: ["target_shared_box_id"]
            isOneToOne: false
            referencedRelation: "email_shared_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_number: string | null
          agency: string | null
          bank_name: string | null
          color: string | null
          created_at: string | null
          current_balance: number | null
          id: string
          initial_balance: number | null
          is_active: boolean | null
          name: string
          tenant_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          color?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          color?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          tenant_id: string | null
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          tenant_id?: string | null
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string | null
          amount: number
          attachment_url: string | null
          category_id: string | null
          competence_date: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          due_date: string
          id: string
          installment_number: number | null
          is_recurring: boolean | null
          notes: string | null
          order_id: string | null
          paid_amount: number | null
          paid_at: string | null
          parent_transaction_id: string | null
          recurrence_interval: number | null
          recurrence_type: string | null
          status: string
          tenant_id: string | null
          total_installments: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_url?: string | null
          category_id?: string | null
          competence_date?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          installment_number?: number | null
          is_recurring?: boolean | null
          notes?: string | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          parent_transaction_id?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          status?: string
          tenant_id?: string | null
          total_installments?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_url?: string | null
          category_id?: string | null
          competence_date?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          installment_number?: number | null
          is_recurring?: boolean | null
          notes?: string | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          parent_transaction_id?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          status?: string
          tenant_id?: string | null
          total_installments?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      gamification_badge_definitions: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          criteria_type: string | null
          criteria_value: number | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          criteria_type?: string | null
          criteria_value?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          criteria_type?: string | null
          criteria_value?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      gamification_badges: {
        Row: {
          badge_code: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "gamification_badge_definitions"
            referencedColumns: ["code"]
          },
        ]
      }
      gamification_events: {
        Row: {
          created_at: string | null
          data: Json | null
          event_type: string
          id: string
          is_read: boolean | null
          message: string | null
          related_user_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          event_type: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_user_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          event_type?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gamification_points: {
        Row: {
          action_type: string
          created_at: string | null
          description: string | null
          id: string
          points: number
          reference_id: string | null
          reference_type: string | null
          reference_value: number | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          points: number
          reference_id?: string | null
          reference_type?: string | null
          reference_value?: number | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          reference_type?: string | null
          reference_value?: number | null
          user_id?: string
        }
        Relationships: []
      }
      gamification_profiles: {
        Row: {
          avatar_url: string | null
          best_streak: number | null
          car_color: string | null
          created_at: string | null
          current_level: string | null
          current_streak: number | null
          display_name: string | null
          id: string
          last_sale_date: string | null
          sounds_enabled: boolean | null
          total_deals: number | null
          total_points: number | null
          total_points_alltime: number | null
          total_sales: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          best_streak?: number | null
          car_color?: string | null
          created_at?: string | null
          current_level?: string | null
          current_streak?: number | null
          display_name?: string | null
          id?: string
          last_sale_date?: string | null
          sounds_enabled?: boolean | null
          total_deals?: number | null
          total_points?: number | null
          total_points_alltime?: number | null
          total_sales?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          best_streak?: number | null
          car_color?: string | null
          created_at?: string | null
          current_level?: string | null
          current_streak?: number | null
          display_name?: string | null
          id?: string
          last_sale_date?: string | null
          sounds_enabled?: boolean | null
          total_deals?: number | null
          total_points?: number | null
          total_points_alltime?: number | null
          total_sales?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gamification_rankings: {
        Row: {
          avg_close_time_seconds: number | null
          conversion_rate: number | null
          created_at: string | null
          id: string
          period_date: string
          period_type: string
          position: number | null
          total_deals: number | null
          total_points: number | null
          total_sales: number | null
          user_id: string
        }
        Insert: {
          avg_close_time_seconds?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: string
          period_date: string
          period_type: string
          position?: number | null
          total_deals?: number | null
          total_points?: number | null
          total_sales?: number | null
          user_id: string
        }
        Update: {
          avg_close_time_seconds?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: string
          period_date?: string
          period_type?: string
          position?: number | null
          total_deals?: number | null
          total_points?: number | null
          total_sales?: number | null
          user_id?: string
        }
        Relationships: []
      }
      gamification_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
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
      internal_chat_messages: {
        Row: {
          content: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_deleted: boolean
          media_mime_type: string | null
          media_name: string | null
          media_url: string | null
          message_type: string
          reply_to_message_id: string | null
          sender_id: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          media_mime_type?: string | null
          media_name?: string | null
          media_url?: string | null
          message_type?: string
          reply_to_message_id?: string | null
          sender_id: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          media_mime_type?: string | null
          media_name?: string | null
          media_url?: string | null
          message_type?: string
          reply_to_message_id?: string | null
          sender_id?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_participants: {
        Row: {
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          thread_id: string
          unread_count: number
          user_id: string
        }
        Insert: {
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          thread_id: string
          unread_count?: number
          user_id: string
        }
        Update: {
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          thread_id?: string
          unread_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          last_message_sender_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_sender_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_sender_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_threads_last_message_sender_id_fkey"
            columns: ["last_message_sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_email_attachments: {
        Row: {
          created_at: string | null
          email_id: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_layout_file: boolean | null
          layout_version: number | null
          mime_type: string | null
        }
        Insert: {
          created_at?: string | null
          email_id: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_layout_file?: boolean | null
          layout_version?: number | null
          mime_type?: string | null
        }
        Update: {
          created_at?: string | null
          email_id?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_layout_file?: boolean | null
          layout_version?: number | null
          mime_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "internal_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_email_labels: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          tenant_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          tenant_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_email_labels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_email_labels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_email_recipients: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          email_id: string
          folder: string | null
          id: string
          is_archived: boolean | null
          is_deleted: boolean | null
          is_read: boolean | null
          is_starred: boolean | null
          labels: string[] | null
          read_at: string | null
          recipient_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email_id: string
          folder?: string | null
          id?: string
          is_archived?: boolean | null
          is_deleted?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          labels?: string[] | null
          read_at?: string | null
          recipient_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email_id?: string
          folder?: string | null
          id?: string
          is_archived?: boolean | null
          is_deleted?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          labels?: string[] | null
          read_at?: string | null
          recipient_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_email_recipients_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "internal_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_email_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_emails: {
        Row: {
          body: string
          body_html: string | null
          category: string | null
          claimed_at: string | null
          claimed_by: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          deleted_by_sender_at: string | null
          id: string
          is_deleted_by_sender: boolean | null
          order_id: string | null
          parent_email_id: string | null
          priority: string | null
          quote_id: string | null
          scheduled_at: string | null
          sender_id: string
          sent_at: string | null
          shared_box_id: string | null
          status: string | null
          subject: string
          tenant_id: string | null
          thread_id: string | null
          updated_at: string | null
          workflow_status: string | null
        }
        Insert: {
          body: string
          body_html?: string | null
          category?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          deleted_by_sender_at?: string | null
          id?: string
          is_deleted_by_sender?: boolean | null
          order_id?: string | null
          parent_email_id?: string | null
          priority?: string | null
          quote_id?: string | null
          scheduled_at?: string | null
          sender_id: string
          sent_at?: string | null
          shared_box_id?: string | null
          status?: string | null
          subject: string
          tenant_id?: string | null
          thread_id?: string | null
          updated_at?: string | null
          workflow_status?: string | null
        }
        Update: {
          body?: string
          body_html?: string | null
          category?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          deleted_by_sender_at?: string | null
          id?: string
          is_deleted_by_sender?: boolean | null
          order_id?: string | null
          parent_email_id?: string | null
          priority?: string | null
          quote_id?: string | null
          scheduled_at?: string | null
          sender_id?: string
          sent_at?: string | null
          shared_box_id?: string | null
          status?: string | null
          subject?: string
          tenant_id?: string | null
          thread_id?: string | null
          updated_at?: string | null
          workflow_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_emails_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_emails_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_emails_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_emails_parent_email_id_fkey"
            columns: ["parent_email_id"]
            isOneToOne: false
            referencedRelation: "internal_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_emails_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_emails_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_emails_shared_box_id_fkey"
            columns: ["shared_box_id"]
            isOneToOne: false
            referencedRelation: "email_shared_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      inventory_movements: {
        Row: {
          cost_per_unit: number | null
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          stock_after: number
          stock_before: number
          tenant_id: string | null
          variation_id: string
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after: number
          stock_before: number
          tenant_id?: string | null
          variation_id: string
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number
          stock_before?: number
          tenant_id?: string | null
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
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
      menu_items: {
        Row: {
          created_at: string | null
          href: string | null
          icon: string
          id: string
          is_active: boolean | null
          parent_id: string | null
          permission: string | null
          position: number
          roles: string[] | null
          show_badge: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          href?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          parent_id?: string | null
          permission?: string | null
          position?: number
          roles?: string[] | null
          show_badge?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          href?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          parent_id?: string | null
          permission?: string | null
          position?: number
          roles?: string[] | null
          show_badge?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
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
      meta_ads: {
        Row: {
          ad_id: string
          adset_id: string | null
          campaign_id: string | null
          created_time: string | null
          creative_id: string | null
          id: string
          meta_account_id: string | null
          name: string
          preview_url: string | null
          status: string | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          ad_id: string
          adset_id?: string | null
          campaign_id?: string | null
          created_time?: string | null
          creative_id?: string | null
          id?: string
          meta_account_id?: string | null
          name: string
          preview_url?: string | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_id?: string
          adset_id?: string | null
          campaign_id?: string | null
          created_time?: string | null
          creative_id?: string | null
          id?: string
          meta_account_id?: string | null
          name?: string
          preview_url?: string | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "meta_adsets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_meta_account_id_fkey"
            columns: ["meta_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      order_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          fulfilled_quantity: number | null
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string | null
          subtotal: number | null
          tenant_id: string | null
          unit_cost: number | null
          unit_price: number
          variation_id: string | null
          variation_name: string | null
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          fulfilled_quantity?: number | null
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sku?: string | null
          subtotal?: number | null
          tenant_id?: string | null
          unit_cost?: number | null
          unit_price: number
          variation_id?: string | null
          variation_name?: string | null
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          fulfilled_quantity?: number | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string | null
          subtotal?: number | null
          tenant_id?: string | null
          unit_cost?: number | null
          unit_price?: number
          variation_id?: string | null
          variation_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string | null
          gateway: string | null
          gateway_response: Json | null
          id: string
          installment_number: number | null
          order_id: string
          paid_at: string | null
          payment_method: string
          refund_amount: number | null
          refunded_at: string | null
          status: string | null
          tenant_id: string | null
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date?: string | null
          gateway?: string | null
          gateway_response?: Json | null
          id?: string
          installment_number?: number | null
          order_id: string
          paid_at?: string | null
          payment_method: string
          refund_amount?: number | null
          refunded_at?: string | null
          status?: string | null
          tenant_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string | null
          gateway?: string | null
          gateway_response?: Json | null
          id?: string
          installment_number?: number | null
          order_id?: string
          paid_at?: string | null
          payment_method?: string
          refund_amount?: number | null
          refunded_at?: string | null
          status?: string | null
          tenant_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_status: string | null
          id: string
          notes: string | null
          order_id: string
          tenant_id: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          order_id: string
          tenant_id?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          tenant_id?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_statuses: {
        Row: {
          can_edit_order: boolean | null
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_final: boolean | null
          name: string
          order_position: number | null
          value: string
        }
        Insert: {
          can_edit_order?: boolean | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_final?: boolean | null
          name: string
          order_position?: number | null
          value: string
        }
        Update: {
          can_edit_order?: boolean | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_final?: boolean | null
          name?: string
          order_position?: number | null
          value?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          assigned_to: string | null
          canceled_at: string | null
          canceled_reason: string | null
          channel_id: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          customer_notes: string | null
          delivered_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          discount_type: string | null
          down_payment_date: string | null
          down_payment_type: string | null
          down_payment_value: number | null
          expected_delivery_date: string | null
          first_installment_date: string | null
          fulfillment_status: string | null
          id: string
          installments: number | null
          internal_notes: string | null
          is_free_shipping: boolean | null
          item_discount: number | null
          notes: string | null
          order_date: string | null
          order_number: string
          order_type: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_condition: string | null
          payment_method: string | null
          payment_schedule: Json | null
          payment_status: string | null
          seller_id: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          shipping_method: string | null
          status: string
          store_id: string | null
          subtotal: number | null
          tax_amount: number | null
          tenant_id: string | null
          total: number | null
          total_discount: number | null
          tracking_code: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          canceled_at?: string | null
          canceled_reason?: string | null
          channel_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          customer_notes?: string | null
          delivered_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          discount_type?: string | null
          down_payment_date?: string | null
          down_payment_type?: string | null
          down_payment_value?: number | null
          expected_delivery_date?: string | null
          first_installment_date?: string | null
          fulfillment_status?: string | null
          id?: string
          installments?: number | null
          internal_notes?: string | null
          is_free_shipping?: boolean | null
          item_discount?: number | null
          notes?: string | null
          order_date?: string | null
          order_number: string
          order_type?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_condition?: string | null
          payment_method?: string | null
          payment_schedule?: Json | null
          payment_status?: string | null
          seller_id?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string | null
          total?: number | null
          total_discount?: number | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          canceled_at?: string | null
          canceled_reason?: string | null
          channel_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          customer_notes?: string | null
          delivered_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          discount_type?: string | null
          down_payment_date?: string | null
          down_payment_type?: string | null
          down_payment_value?: number | null
          expected_delivery_date?: string | null
          first_installment_date?: string | null
          fulfillment_status?: string | null
          id?: string
          installments?: number | null
          internal_notes?: string | null
          is_free_shipping?: boolean | null
          item_discount?: number | null
          notes?: string | null
          order_date?: string | null
          order_number?: string
          order_type?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_condition?: string | null
          payment_method?: string | null
          payment_schedule?: Json | null
          payment_status?: string | null
          seller_id?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string | null
          total?: number | null
          total_discount?: number | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          created_by: string | null
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          expires_at: string | null
          external_id: string | null
          gateway_response: Json | null
          id: string
          installments_used: number | null
          max_installments: number | null
          order_id: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method_used: string | null
          payment_methods: string[] | null
          payment_url: string | null
          provider: string
          quote_id: string | null
          status: string | null
          updated_at: string | null
          webhook_received_at: string | null
        }
        Insert: {
          amount: number
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expires_at?: string | null
          external_id?: string | null
          gateway_response?: Json | null
          id?: string
          installments_used?: number | null
          max_installments?: number | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method_used?: string | null
          payment_methods?: string[] | null
          payment_url?: string | null
          provider?: string
          quote_id?: string | null
          status?: string | null
          updated_at?: string | null
          webhook_received_at?: string | null
        }
        Update: {
          amount?: number
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expires_at?: string | null
          external_id?: string | null
          gateway_response?: Json | null
          id?: string
          installments_used?: number | null
          max_installments?: number | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method_used?: string | null
          payment_methods?: string[] | null
          payment_url?: string | null
          provider?: string
          quote_id?: string | null
          status?: string | null
          updated_at?: string | null
          webhook_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
      product_attribute_price_rules: {
        Row: {
          adjustment_type: string
          adjustment_value: number
          attribute_value_id: string
          created_at: string
          id: string
          is_active: boolean
          priority: number
          product_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          adjustment_type?: string
          adjustment_value?: number
          attribute_value_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          product_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          adjustment_type?: string
          adjustment_value?: number
          attribute_value_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          product_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_price_rules_attribute_value_id_fkey"
            columns: ["attribute_value_id"]
            isOneToOne: false
            referencedRelation: "product_attribute_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_price_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_types: {
        Row: {
          allow_multiple: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_required: boolean
          name: string
          slug: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          allow_multiple?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          name: string
          slug: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_multiple?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          name?: string
          slug?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_values: {
        Row: {
          attribute_type_id: string
          created_at: string
          display_order: number
          display_value: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          slug: string
          tenant_id: string | null
          updated_at: string
          value: string
        }
        Insert: {
          attribute_type_id: string
          created_at?: string
          display_order?: number
          display_value?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          slug: string
          tenant_id?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          attribute_type_id?: string
          created_at?: string
          display_order?: number
          display_value?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          slug?: string
          tenant_id?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_values_attribute_type_id_fkey"
            columns: ["attribute_type_id"]
            isOneToOne: false
            referencedRelation: "product_attribute_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attributes: {
        Row: {
          attribute_type_id: string
          created_at: string | null
          display_order: number | null
          id: string
          is_required: boolean | null
          product_id: string
        }
        Insert: {
          attribute_type_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          product_id: string
        }
        Update: {
          attribute_type_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attributes_attribute_type_id_fkey"
            columns: ["attribute_type_id"]
            isOneToOne: false
            referencedRelation: "product_attribute_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_catalogs: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          settings: Json | null
          slug: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          settings?: Json | null
          slug: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          settings?: Json | null
          slug?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_catalogs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_template_variations: {
        Row: {
          adjustment_type: string | null
          attribute_value_ids: string[]
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          price_adjustment: number | null
          template_id: string | null
          tenant_id: string | null
          variation_name: string | null
          weight_override: number | null
        }
        Insert: {
          adjustment_type?: string | null
          attribute_value_ids?: string[]
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          price_adjustment?: number | null
          template_id?: string | null
          tenant_id?: string | null
          variation_name?: string | null
          weight_override?: number | null
        }
        Update: {
          adjustment_type?: string | null
          attribute_value_ids?: string[]
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          price_adjustment?: number | null
          template_id?: string | null
          tenant_id?: string | null
          variation_name?: string | null
          weight_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_template_variations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_template_variations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_templates: {
        Row: {
          created_at: string | null
          default_height_cm: number | null
          default_length_cm: number | null
          default_weight_kg: number | null
          default_width_cm: number | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          tenant_id: string | null
          updated_at: string | null
          use_global_price_rules: boolean | null
        }
        Insert: {
          created_at?: string | null
          default_height_cm?: number | null
          default_length_cm?: number | null
          default_weight_kg?: number | null
          default_width_cm?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          tenant_id?: string | null
          updated_at?: string | null
          use_global_price_rules?: boolean | null
        }
        Update: {
          created_at?: string | null
          default_height_cm?: number | null
          default_length_cm?: number | null
          default_weight_kg?: number | null
          default_width_cm?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          tenant_id?: string | null
          updated_at?: string | null
          use_global_price_rules?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "product_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          attribute_value_ids: string[] | null
          attributes: Json
          barcode: string | null
          cost_price: number | null
          created_at: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          length_cm: number | null
          low_stock_threshold: number | null
          price: number | null
          price_override: boolean | null
          product_id: string
          sku: string
          stock_quantity: number | null
          tenant_id: string | null
          updated_at: string | null
          variation_name: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          attribute_value_ids?: string[] | null
          attributes?: Json
          barcode?: string | null
          cost_price?: number | null
          created_at?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          length_cm?: number | null
          low_stock_threshold?: number | null
          price?: number | null
          price_override?: boolean | null
          product_id: string
          sku: string
          stock_quantity?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          variation_name?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          attribute_value_ids?: string[] | null
          attributes?: Json
          barcode?: string | null
          cost_price?: number | null
          created_at?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          length_cm?: number | null
          low_stock_threshold?: number | null
          price?: number | null
          price_override?: boolean | null
          product_id?: string
          sku?: string
          stock_quantity?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          variation_name?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_pis: number | null
          base_price: number
          catalog_id: string | null
          cest: string | null
          cfop_devolucao: string | null
          cfop_venda: string | null
          codigo_beneficio_fiscal: string | null
          codigo_enquadramento_ipi: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string | null
          created_by: string | null
          csosn: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_ipi: string | null
          cst_pis: string | null
          description: string | null
          display_order: number | null
          ex_tipi: string | null
          fator_conversao_tributavel: number | null
          gallery_images: Json | null
          gtin: string | null
          gtin_tributavel: string | null
          has_variations: boolean | null
          height_cm: number | null
          icms_st_aliquota: number | null
          icms_st_modalidade: string | null
          icms_st_mva: number | null
          id: string
          informacoes_adicionais: string | null
          is_active: boolean | null
          is_featured: boolean | null
          length_cm: number | null
          main_image_url: string | null
          metadata: Json | null
          name: string
          ncm: string | null
          origem: number | null
          packaging_type: string | null
          peso_bruto: number | null
          peso_liquido: number | null
          reducao_base_icms: number | null
          regime_tributario: string | null
          search_vector: unknown
          short_description: string | null
          sku: string | null
          slug: string | null
          tags: string[] | null
          template_id: string | null
          tenant_id: string | null
          tipo_produto: string | null
          track_inventory: boolean | null
          unidade_comercial: string | null
          unidade_tributavel: string | null
          updated_at: string | null
          width_cm: number | null
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          base_price?: number
          catalog_id?: string | null
          cest?: string | null
          cfop_devolucao?: string | null
          cfop_venda?: string | null
          codigo_beneficio_fiscal?: string | null
          codigo_enquadramento_ipi?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          created_by?: string | null
          csosn?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          description?: string | null
          display_order?: number | null
          ex_tipi?: string | null
          fator_conversao_tributavel?: number | null
          gallery_images?: Json | null
          gtin?: string | null
          gtin_tributavel?: string | null
          has_variations?: boolean | null
          height_cm?: number | null
          icms_st_aliquota?: number | null
          icms_st_modalidade?: string | null
          icms_st_mva?: number | null
          id?: string
          informacoes_adicionais?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          length_cm?: number | null
          main_image_url?: string | null
          metadata?: Json | null
          name: string
          ncm?: string | null
          origem?: number | null
          packaging_type?: string | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          reducao_base_icms?: number | null
          regime_tributario?: string | null
          search_vector?: unknown
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          tags?: string[] | null
          template_id?: string | null
          tenant_id?: string | null
          tipo_produto?: string | null
          track_inventory?: boolean | null
          unidade_comercial?: string | null
          unidade_tributavel?: string | null
          updated_at?: string | null
          width_cm?: number | null
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          base_price?: number
          catalog_id?: string | null
          cest?: string | null
          cfop_devolucao?: string | null
          cfop_venda?: string | null
          codigo_beneficio_fiscal?: string | null
          codigo_enquadramento_ipi?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          created_by?: string | null
          csosn?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          description?: string | null
          display_order?: number | null
          ex_tipi?: string | null
          fator_conversao_tributavel?: number | null
          gallery_images?: Json | null
          gtin?: string | null
          gtin_tributavel?: string | null
          has_variations?: boolean | null
          height_cm?: number | null
          icms_st_aliquota?: number | null
          icms_st_modalidade?: string | null
          icms_st_mva?: number | null
          id?: string
          informacoes_adicionais?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          length_cm?: number | null
          main_image_url?: string | null
          metadata?: Json | null
          name?: string
          ncm?: string | null
          origem?: number | null
          packaging_type?: string | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          reducao_base_icms?: number | null
          regime_tributario?: string | null
          search_vector?: unknown
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          tags?: string[] | null
          template_id?: string | null
          tenant_id?: string | null
          tipo_produto?: string | null
          track_inventory?: boolean | null
          unidade_comercial?: string | null
          unidade_tributavel?: string | null
          updated_at?: string | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "product_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability_locked_by: string | null
          avatar_url: string | null
          bonus_target_1: number | null
          bonus_target_2: number | null
          bonus_target_3: number | null
          can_transfer_freely: boolean | null
          can_view_all_conversations: boolean | null
          commission_percent: number | null
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
          sales_target_1: number | null
          sales_target_2: number | null
          sales_target_3: number | null
          signature_enabled: boolean | null
          signature_name: string | null
          tenant_id: string | null
          unavailability_reason: string | null
          unavailable_until: string | null
          updated_at: string
        }
        Insert: {
          availability_locked_by?: string | null
          avatar_url?: string | null
          bonus_target_1?: number | null
          bonus_target_2?: number | null
          bonus_target_3?: number | null
          can_transfer_freely?: boolean | null
          can_view_all_conversations?: boolean | null
          commission_percent?: number | null
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
          sales_target_1?: number | null
          sales_target_2?: number | null
          sales_target_3?: number | null
          signature_enabled?: boolean | null
          signature_name?: string | null
          tenant_id?: string | null
          unavailability_reason?: string | null
          unavailable_until?: string | null
          updated_at?: string
        }
        Update: {
          availability_locked_by?: string | null
          avatar_url?: string | null
          bonus_target_1?: number | null
          bonus_target_2?: number | null
          bonus_target_3?: number | null
          can_transfer_freely?: boolean | null
          can_view_all_conversations?: boolean | null
          commission_percent?: number | null
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
          sales_target_1?: number | null
          sales_target_2?: number | null
          sales_target_3?: number | null
          signature_enabled?: boolean | null
          signature_name?: string | null
          tenant_id?: string | null
          unavailability_reason?: string | null
          unavailable_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_availability_locked_by_fkey"
            columns: ["availability_locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      quote_expiration_notifications: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel_id: string | null
          contact_id: string | null
          created_at: string | null
          days_before: number
          error_message: string | null
          id: string
          notification_type: string
          paused: boolean | null
          paused_at: string | null
          paused_by: string | null
          quote_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          days_before: number
          error_message?: string | null
          id?: string
          notification_type: string
          paused?: boolean | null
          paused_at?: string | null
          paused_by?: string | null
          quote_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          days_before?: number
          error_message?: string | null
          id?: string
          notification_type?: string
          paused?: boolean | null
          paused_at?: string | null
          paused_by?: string | null
          quote_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_expiration_notifications_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_expiration_notifications_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_expiration_notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_expiration_notifications_paused_by_fkey"
            columns: ["paused_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_expiration_notifications_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_expiration_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          quote_id: string
          sku: string | null
          subtotal: number | null
          tenant_id: string | null
          unit_price: number
          variation_id: string | null
          variation_name: string | null
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          quote_id: string
          sku?: string | null
          subtotal?: number | null
          tenant_id?: string | null
          unit_price: number
          variation_id?: string | null
          variation_name?: string | null
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          quote_id?: string
          sku?: string | null
          subtotal?: number | null
          tenant_id?: string | null
          unit_price?: number
          variation_id?: string | null
          variation_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          channel_id: string | null
          contact_id: string | null
          conversation_id: string | null
          converted_at: string | null
          converted_to_order_id: string | null
          created_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          down_payment_date: string | null
          down_payment_type: string | null
          down_payment_value: number | null
          expected_delivery_date: string | null
          first_installment_date: string | null
          id: string
          installments: number | null
          internal_notes: string | null
          notes: string | null
          notifications_auto_pause_reason: string | null
          notifications_auto_paused: boolean | null
          notifications_paused: boolean | null
          notifications_paused_at: string | null
          notifications_paused_by: string | null
          payment_condition: string | null
          payment_method: string | null
          payment_schedule: Json | null
          quote_number: string
          seller_id: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          shipping_method: string | null
          status: string
          store_id: string | null
          subtotal: number | null
          tenant_id: string | null
          total: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          channel_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          converted_at?: string | null
          converted_to_order_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          down_payment_date?: string | null
          down_payment_type?: string | null
          down_payment_value?: number | null
          expected_delivery_date?: string | null
          first_installment_date?: string | null
          id?: string
          installments?: number | null
          internal_notes?: string | null
          notes?: string | null
          notifications_auto_pause_reason?: string | null
          notifications_auto_paused?: boolean | null
          notifications_paused?: boolean | null
          notifications_paused_at?: string | null
          notifications_paused_by?: string | null
          payment_condition?: string | null
          payment_method?: string | null
          payment_schedule?: Json | null
          quote_number: string
          seller_id?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number | null
          tenant_id?: string | null
          total?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          channel_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          converted_at?: string | null
          converted_to_order_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          down_payment_date?: string | null
          down_payment_type?: string | null
          down_payment_value?: number | null
          expected_delivery_date?: string | null
          first_installment_date?: string | null
          id?: string
          installments?: number | null
          internal_notes?: string | null
          notes?: string | null
          notifications_auto_pause_reason?: string | null
          notifications_auto_paused?: boolean | null
          notifications_paused?: boolean | null
          notifications_paused_at?: string | null
          notifications_paused_by?: string | null
          payment_condition?: string | null
          payment_method?: string | null
          payment_schedule?: Json | null
          quote_number?: string
          seller_id?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number | null
          tenant_id?: string | null
          total?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_to_order_id_fkey"
            columns: ["converted_to_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_notifications_paused_by_fkey"
            columns: ["notifications_paused_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      required_fields_rules: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          is_enabled: boolean
          required_fields: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_enabled?: boolean
          required_fields?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_enabled?: boolean
          required_fields?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "required_fields_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "required_fields_rules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "required_fields_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rescue_scheduled_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          audio_url: string | null
          cancelled_at: string | null
          content: string
          created_at: string | null
          id: string
          rescue_id: string
          scheduled_for: string
          sent_at: string | null
          status: string | null
          step_number: number
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          audio_url?: string | null
          cancelled_at?: string | null
          content: string
          created_at?: string | null
          id?: string
          rescue_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
          step_number: number
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          audio_url?: string | null
          cancelled_at?: string | null
          content?: string
          created_at?: string | null
          id?: string
          rescue_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rescue_scheduled_messages_rescue_id_fkey"
            columns: ["rescue_id"]
            isOneToOne: false
            referencedRelation: "active_rescues"
            referencedColumns: ["id"]
          },
        ]
      }
      rescue_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          final_action: string
          final_action_config: Json | null
          id: string
          is_active: boolean | null
          on_reply_action: string | null
          on_reply_config: Json | null
          steps: Json
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          final_action?: string
          final_action_config?: Json | null
          id?: string
          is_active?: boolean | null
          on_reply_action?: string | null
          on_reply_config?: Json | null
          steps?: Json
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          final_action?: string
          final_action_config?: Json | null
          id?: string
          is_active?: boolean | null
          on_reply_action?: string | null
          on_reply_config?: Json | null
          steps?: Json
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rescue_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      segments: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      shared_conversations: {
        Row: {
          conversation_id: string
          department_id: string | null
          id: string
          note: string | null
          permission_level: string
          shared_at: string
          shared_by: string
          shared_with: string | null
        }
        Insert: {
          conversation_id: string
          department_id?: string | null
          id?: string
          note?: string | null
          permission_level?: string
          shared_at?: string
          shared_by: string
          shared_with?: string | null
        }
        Update: {
          conversation_id?: string
          department_id?: string | null
          id?: string
          note?: string | null
          permission_level?: string
          shared_at?: string
          shared_by?: string
          shared_with?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_conversations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_conversations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_conversations_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_conversations_shared_with_fkey"
            columns: ["shared_with"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      space_memory: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      tenant_admins: {
        Row: {
          created_at: string | null
          id: string
          is_owner: boolean | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_owner?: boolean | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_owner?: boolean | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_admins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_notification_config: {
        Row: {
          created_at: string | null
          daily_limit: number | null
          days_after_sent: number[] | null
          id: string
          min_interval_hours: number | null
          notification_channel_id: string | null
          notification_send_time: string | null
          notification_send_times: string[] | null
          notification_trigger_type: string | null
          pause_on_weekends: boolean | null
          quote_expiration_days: number[] | null
          quote_expiration_enabled: boolean | null
          quote_expiration_template: string | null
          tenant_id: string | null
          updated_at: string | null
          use_client_channel: boolean | null
        }
        Insert: {
          created_at?: string | null
          daily_limit?: number | null
          days_after_sent?: number[] | null
          id?: string
          min_interval_hours?: number | null
          notification_channel_id?: string | null
          notification_send_time?: string | null
          notification_send_times?: string[] | null
          notification_trigger_type?: string | null
          pause_on_weekends?: boolean | null
          quote_expiration_days?: number[] | null
          quote_expiration_enabled?: boolean | null
          quote_expiration_template?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          use_client_channel?: boolean | null
        }
        Update: {
          created_at?: string | null
          daily_limit?: number | null
          days_after_sent?: number[] | null
          id?: string
          min_interval_hours?: number | null
          notification_channel_id?: string | null
          notification_send_time?: string | null
          notification_send_times?: string[] | null
          notification_trigger_type?: string | null
          pause_on_weekends?: boolean | null
          quote_expiration_days?: number[] | null
          quote_expiration_enabled?: boolean | null
          quote_expiration_template?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          use_client_channel?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_notification_config_notification_channel_id_fkey"
            columns: ["notification_channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_notification_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          max_contacts: number | null
          max_users: number | null
          name: string
          plan_type: string | null
          settings: Json | null
          slug: string
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_contacts?: number | null
          max_users?: number | null
          name: string
          plan_type?: string | null
          settings?: Json | null
          slug: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_contacts?: number | null
          max_users?: number | null
          name?: string
          plan_type?: string | null
          settings?: Json | null
          slug?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      user_quick_templates: {
        Row: {
          created_at: string | null
          id: string
          position: number
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          position: number
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          position?: number
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_quick_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
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
      calculate_variation_price: {
        Args: {
          p_attribute_value_ids: string[]
          p_product_id: string
          p_tenant_id: string
        }
        Returns: number
      }
      can_access_contact: {
        Args: { _contact_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_conversation: {
        Args: { conv_id: string; user_id: string }
        Returns: boolean
      }
      can_access_conversation_fast: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      can_create_conversation_for_contact: {
        Args: { p_contact_id: string; p_user_id: string }
        Returns: boolean
      }
      can_manage_tenant: {
        Args: { _tenant_id: string; _user_id?: string }
        Returns: boolean
      }
      can_transfer_freely: { Args: { _user_id: string }; Returns: boolean }
      can_view_all_data: { Args: { _user_id: string }; Returns: boolean }
      can_view_email_attachment: {
        Args: { p_email_id: string; p_user_id: string }
        Returns: boolean
      }
      check_overdue_transactions: { Args: never; Returns: undefined }
      check_user_permission: {
        Args: { permission_key: string; user_id: string }
        Returns: boolean
      }
      delete_contact_permanently: {
        Args: { p_contact_id: string }
        Returns: undefined
      }
      detect_origin_by_message_pattern: {
        Args: { p_message: string }
        Returns: {
          campaign_name: string
          pattern_id: string
          source: string
        }[]
      }
      find_contact_by_phone_suffix: {
        Args: { phone_suffix: string }
        Returns: {
          assigned_to: string
          avatar_url: string
          department_id: string
          email: string
          full_name: string
          id: string
          phone: string
        }[]
      }
      find_or_create_direct_thread: {
        Args: { p_other_user_id: string; p_user_id: string }
        Returns: string
      }
      fix_conversation_last_message_sync: {
        Args: never
        Returns: {
          details: Json
          fixed_count: number
        }[]
      }
      fix_historical_origin_detection: {
        Args: never
        Returns: {
          source_breakdown: Json
          updated_count: number
        }[]
      }
      gamification_check_badges: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      generate_order_number: { Args: { p_tenant_id: string }; Returns: string }
      generate_quote_number: { Args: { p_tenant_id: string }; Returns: string }
      get_agent_counts: {
        Args: {
          p_channel_id?: string
          p_date_filter?: string
          p_department_id?: string
          p_origin?: string
          p_timezone?: string
        }
        Returns: Json
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
      get_agent_waiting_conversations: {
        Args: { p_agent_id: string }
        Returns: {
          contact_avatar: string
          contact_id: string
          contact_name: string
          contact_phone: string
          conversation_id: string
          last_message_preview: string
          waiting_minutes: number
          waiting_since: string
        }[]
      }
      get_agents_response_history: {
        Args: { p_days?: number }
        Returns: {
          agent_id: string
          agent_name: string
          avg_response_minutes: number
          report_date: string
          total_conversations: number
        }[]
      }
      get_agents_response_status: {
        Args: never
        Returns: {
          agent_id: string
          agent_name: string
          avatar_url: string
          department_name: string
          is_available: boolean
          is_online: boolean
          oldest_waiting_minutes: number
          open_conversations: number
          unavailability_reason: string
          unavailable_until: string
          waiting_response: number
        }[]
      }
      get_all_conversation_counts: {
        Args: {
          p_agent_id?: string
          p_channel_id?: string
          p_date_filter?: string
          p_department_id?: string
          p_origin?: string
          p_status_filter?: string
          p_timezone?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_channel_by_instance: {
        Args: { p_instance_id: string }
        Returns: {
          department_id: string
          id: string
          instance_id: string
          name: string
          provider_admin_token: string
          provider_base_url: string
          provider_code: string
        }[]
      }
      get_channel_counts: {
        Args: {
          p_agent_id?: string
          p_date_filter?: string
          p_department_id?: string
          p_origin?: string
          p_timezone?: string
        }
        Returns: Json
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
      get_conversations_by_tags: {
        Args: {
          p_agent_id?: string
          p_channel_id?: string
          p_department_id?: string
          p_exclude_no_tags?: boolean
          p_limit?: number
          p_offset?: number
          p_origin?: string
          p_tag_ids: string[]
        }
        Returns: {
          contact_id: string
          conversation_id: string
          total_count: number
        }[]
      }
      get_conversion_status_names: { Args: never; Returns: string[] }
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
      get_dashboard_metrics_aggregated: {
        Args: {
          p_agent_id?: string
          p_date_from: string
          p_date_to: string
          p_department_id?: string
        }
        Returns: Json
      }
      get_date_filter_counts: {
        Args: {
          p_agent_id?: string
          p_channel_id?: string
          p_department_id?: string
          p_origin?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_department_counts: {
        Args: {
          p_agent_id?: string
          p_channel_id?: string
          p_date_filter?: string
          p_origin?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_funnel_data_batch: {
        Args: {
          p_agent_id?: string
          p_date_from: string
          p_date_to: string
          p_department_id?: string
        }
        Returns: {
          avg_duration_seconds: number
          count: number
          order_position: number
          stage_color: string
          stage_name: string
        }[]
      }
      get_internal_chat_threads: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          last_message_at: string
          last_message_preview: string
          last_message_sender_id: string
          other_user_avatar: string
          other_user_department_color: string
          other_user_department_id: string
          other_user_department_name: string
          other_user_id: string
          other_user_name: string
          other_user_online: boolean
          thread_id: string
          unread_count: number
          updated_at: string
        }[]
      }
      get_internal_chat_unread_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_internal_email_unread_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_kanban_contacts_optimized: {
        Args: { _limit_per_status?: number; _user_id: string }
        Returns: {
          assigned_to: string
          assignee_avatar: string
          assignee_id: string
          assignee_name: string
          avatar_url: string
          contact_id: string
          conversation_id: string
          email: string
          full_name: string
          lead_status: string
          negotiated_value: number
          phone: string
          unread_count: number
          updated_at: string
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
      get_lead_journey_metrics:
        | {
            Args: {
              p_agent_id?: string
              p_channel_id?: string
              p_date_from: string
              p_date_to: string
              p_department_id?: string
              p_origin?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_agent_id?: string
              p_conversion_status_names?: string[]
              p_date_from: string
              p_date_to: string
              p_department_id?: string
              p_origin?: string
            }
            Returns: {
              assignment_rate: number
              avg_time_to_assignment: number
              avg_time_to_first_response: number
              conversion_rate: number
              conversions: number
              lead_response_rate: number
              total_assigned: number
              total_converted_value: number
              total_unassigned: number
            }[]
          }
        | {
            Args: {
              p_agent_id?: string
              p_date_from: string
              p_date_to: string
              p_department_id?: string
              p_origin?: string
            }
            Returns: {
              avg_time_in_funnel: number
              avg_time_to_assignment: number
              avg_time_to_first_response: number
              conversion_count: number
              conversion_rate: number
              new_contacts: number
              total_conversations: number
            }[]
          }
        | {
            Args: {
              p_agent_id?: string
              p_channel_id?: string
              p_department_id?: string
              p_end_date: string
              p_start_date: string
            }
            Returns: Json
          }
      get_lead_status_counts: {
        Args: {
          p_agent_id?: string
          p_channel_id?: string
          p_department_id?: string
          p_origin?: string
          p_status_filter?: string
        }
        Returns: Json
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
      get_leads_by_status_batch: {
        Args: {
          p_agent_id?: string
          p_date_from: string
          p_date_to: string
          p_department_id?: string
        }
        Returns: {
          count: number
          order_position: number
          status_color: string
          status_id: string
          status_name: string
        }[]
      }
      get_leads_distribution_by_agent: {
        Args: { p_date_from: string; p_date_to: string; p_origin?: string }
        Returns: {
          agent_avatar: string
          agent_id: string
          agent_name: string
          conversion_rate: number
          converted_count: number
          lead_count: number
        }[]
      }
      get_no_tag_conversation_count: {
        Args: {
          p_agent_id?: string
          p_channel_id?: string
          p_department_id?: string
          p_origin?: string
        }
        Returns: number
      }
      get_origin_counts: {
        Args: {
          p_agent_id?: string
          p_channel_id?: string
          p_date_filter?: string
          p_department_id?: string
          p_timezone?: string
        }
        Returns: Json
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
      get_returning_leads_metrics: {
        Args: {
          p_agent_id?: string
          p_channel_id?: string
          p_date_from: string
          p_date_to: string
          p_department_id?: string
          p_origin?: string
        }
        Returns: {
          new_contact_rate: number
          new_contacts: number
          returning_contacts: number
          total_conversations: number
        }[]
      }
      get_shared_conversation_count: {
        Args: { p_user_id: string }
        Returns: {
          total: number
          unread: number
        }[]
      }
      get_status_funnel: {
        Args: {
          p_agent_id?: string
          p_date_from: string
          p_date_to: string
          p_department_id?: string
          p_origin?: string
        }
        Returns: {
          avg_duration_seconds: number
          color: string
          count: number
          status: string
          status_order: number
        }[]
      }
      get_status_funnel_historical: {
        Args: {
          p_agent_id?: string
          p_date_from: string
          p_date_to: string
          p_department_id?: string
          p_origin?: string
        }
        Returns: {
          avg_duration_seconds: number
          lead_count: number
          status_color: string
          status_name: string
          status_order: number
        }[]
      }
      get_status_funnel_realtime: {
        Args: { p_agent_id?: string; p_department_id?: string }
        Returns: {
          avg_duration_seconds: number
          lead_count: number
          status_color: string
          status_name: string
          status_order: number
        }[]
      }
      get_timeline_data_batch: {
        Args: {
          p_agent_id?: string
          p_conversion_status_names?: string[]
          p_date_from: string
          p_date_to: string
          p_department_id?: string
        }
        Returns: {
          conversions: number
          date: string
          new_leads: number
        }[]
      }
      get_transfer_history: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_from_department_id?: string
          p_from_user_id?: string
          p_limit?: number
          p_offset?: number
          p_search_query?: string
          p_to_department_id?: string
          p_to_user_id?: string
          p_transfer_type?: string
        }
        Returns: {
          actor_id: string
          actor_name: string
          contact_id: string
          contact_name: string
          contact_phone: string
          conversation_id: string
          from_department_id: string
          from_department_name: string
          from_user_id: string
          from_user_name: string
          id: string
          is_return: boolean
          is_share: boolean
          to_department_id: string
          to_department_name: string
          to_user_id: string
          to_user_name: string
          total_count: number
          transfer_note: string
          transferred_at: string
        }[]
      }
      get_user_accessible_departments: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_department_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
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
      is_conversation_owner: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_email_recipient: {
        Args: { p_email_id: string; p_user_id: string }
        Returns: boolean
      }
      is_email_sender: {
        Args: { p_email_id: string; p_user_id: string }
        Returns: boolean
      }
      is_lid_contact: { Args: { phone: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_tenant_owner: { Args: { _user_id?: string }; Returns: boolean }
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
      process_incoming_message: {
        Args: {
          p_channel_department_id: string
          p_channel_id: string
          p_contact_name: string
          p_is_from_me?: boolean
          p_media_mime_type?: string
          p_media_url?: string
          p_message_content: string
          p_message_type: string
          p_origin?: string
          p_phone: string
          p_referral_data?: Json
          p_referral_source?: string
          p_whatsapp_message_id?: string
        }
        Returns: Json
      }
      register_inventory_movement: {
        Args: {
          p_cost_per_unit?: number
          p_movement_type: string
          p_notes?: string
          p_quantity: number
          p_reference_id?: string
          p_reference_type?: string
          p_variation_id: string
        }
        Returns: string
      }
      register_payment: {
        Args: {
          p_account_id: string
          p_amount: number
          p_paid_at?: string
          p_transaction_id: string
        }
        Returns: string
      }
      search_contacts_for_erp: {
        Args: { result_limit?: number; search_term: string }
        Returns: {
          city: string
          cpf_cnpj: string
          email: string
          full_name: string
          id: string
          neighborhood: string
          number: string
          phone: string
          state: string
          street: string
          zip_code: string
        }[]
      }
      search_contacts_paginated: {
        Args: {
          p_assigned_to?: string
          p_department_id?: string
          p_limit?: number
          p_offset?: number
          p_search_query?: string
          p_state_filter?: string
          p_status_filter?: string
        }
        Returns: {
          assigned_to: string
          avatar_url: string
          birth_date: string
          city: string
          complement: string
          country: string
          cpf_cnpj: string
          created_at: string
          custom_fields: Json
          department_id: string
          email: string
          first_contact_at: string
          full_name: string
          id: string
          is_online: boolean
          last_interaction_at: string
          lead_status: string
          neighborhood: string
          notes: string
          number: string
          origin: string
          person_type: string
          phone: string
          state: string
          street: string
          total_count: number
          updated_at: string
          zip_code: string
        }[]
      }
      search_contacts_unaccent:
        | {
            Args: { p_limit?: number; p_search_query: string }
            Returns: {
              assigned_to: string
              avatar_url: string
              email: string
              full_name: string
              id: string
              lead_status: string
              phone: string
            }[]
          }
        | {
            Args: { p_search_term: string }
            Returns: {
              id: string
            }[]
          }
      search_conversations_report: {
        Args: {
          p_agent_ids?: string[]
          p_channel_ids?: string[]
          p_conversation_status?: string[]
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
          p_force?: boolean
          p_note?: string
          p_to_department_id?: string
          p_to_user_id?: string
        }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_message_whatsapp_id: {
        Args: {
          p_content: string
          p_conversation_id: string
          p_media_url?: string
          p_message_type: string
          p_whatsapp_message_id: string
        }
        Returns: Json
      }
      user_belongs_to_tenant: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      user_has_department: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "manager"
        | "supervisor"
        | "seller"
        | "super_admin"
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
      app_role: [
        "admin",
        "user",
        "manager",
        "supervisor",
        "seller",
        "super_admin",
      ],
    },
  },
} as const
