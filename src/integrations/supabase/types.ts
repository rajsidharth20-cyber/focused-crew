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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      active_timers: {
        Row: {
          accumulated_seconds: number
          created_at: string
          is_running: boolean
          started_at: string | null
          subject_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accumulated_seconds?: number
          created_at?: string
          is_running?: boolean
          started_at?: string | null
          subject_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accumulated_seconds?: number
          created_at?: string
          is_running?: boolean
          started_at?: string | null
          subject_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_timers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          action_text: string | null
          action_url: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          image_url: string | null
          is_important: boolean
          is_published: boolean
          published_at: string | null
          scheduled_for: string | null
          short_description: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          action_text?: string | null
          action_url?: string | null
          content: string
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string | null
          is_important?: boolean
          is_published?: boolean
          published_at?: string | null
          scheduled_for?: string | null
          short_description?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          action_text?: string | null
          action_url?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string | null
          is_important?: boolean
          is_published?: boolean
          published_at?: string | null
          scheduled_for?: string | null
          short_description?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      bot_direct_state: {
        Row: {
          created_at: string
          enabled: boolean
          last_message_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          last_message_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          last_message_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_events: {
        Row: {
          actor_id: string | null
          bot_instance_id: string
          created_at: string
          error_code: string | null
          event_type: string
          group_id: string
          id: string
          message_id: string | null
          processed_at: string | null
          result: Json
          status: string
        }
        Insert: {
          actor_id?: string | null
          bot_instance_id: string
          created_at?: string
          error_code?: string | null
          event_type: string
          group_id: string
          id?: string
          message_id?: string | null
          processed_at?: string | null
          result?: Json
          status?: string
        }
        Update: {
          actor_id?: string | null
          bot_instance_id?: string
          created_at?: string
          error_code?: string | null
          event_type?: string
          group_id?: string
          id?: string
          message_id?: string | null
          processed_at?: string | null
          result?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_events_bot_instance_id_fkey"
            columns: ["bot_instance_id"]
            isOneToOne: false
            referencedRelation: "bot_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_flags: {
        Row: {
          bot_instance_id: string
          classification: string
          confidence: number
          created_at: string
          group_id: string
          id: string
          message_id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_user_id: string
        }
        Insert: {
          bot_instance_id: string
          classification: string
          confidence: number
          created_at?: string
          group_id: string
          id?: string
          message_id: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_user_id: string
        }
        Update: {
          bot_instance_id?: string
          classification?: string
          confidence?: number
          created_at?: string
          group_id?: string
          id?: string
          message_id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_flags_bot_instance_id_fkey"
            columns: ["bot_instance_id"]
            isOneToOne: false
            referencedRelation: "bot_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_flags_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_flags_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_focus_sessions: {
        Row: {
          active: boolean
          bot_instance_id: string
          ends_at: string
          group_id: string
          id: string
          started_at: string
          started_by: string
        }
        Insert: {
          active?: boolean
          bot_instance_id: string
          ends_at: string
          group_id: string
          id?: string
          started_at?: string
          started_by: string
        }
        Update: {
          active?: boolean
          bot_instance_id?: string
          ends_at?: string
          group_id?: string
          id?: string
          started_at?: string
          started_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_focus_sessions_bot_instance_id_fkey"
            columns: ["bot_instance_id"]
            isOneToOne: false
            referencedRelation: "bot_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_focus_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_instances: {
        Row: {
          bot_type: string
          created_at: string
          created_by: string
          enabled: boolean
          group_id: string
          id: string
          updated_at: string
        }
        Insert: {
          bot_type?: string
          created_at?: string
          created_by: string
          enabled?: boolean
          group_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          bot_type?: string
          created_at?: string
          created_by?: string
          enabled?: boolean
          group_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_instances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_permissions: {
        Row: {
          bot_instance_id: string
          created_at: string
          enabled: boolean
          id: string
          permission: string
          updated_at: string
        }
        Insert: {
          bot_instance_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          permission: string
          updated_at?: string
        }
        Update: {
          bot_instance_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          permission?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_permissions_bot_instance_id_fkey"
            columns: ["bot_instance_id"]
            isOneToOne: false
            referencedRelation: "bot_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_poll_options: {
        Row: {
          id: string
          label: string
          poll_id: string
          position: number
        }
        Insert: {
          id?: string
          label: string
          poll_id: string
          position: number
        }
        Update: {
          id?: string
          label?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "bot_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "bot_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "bot_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "bot_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_polls: {
        Row: {
          bot_instance_id: string
          created_at: string
          created_by: string
          group_id: string
          id: string
          message_id: string | null
          question: string
          status: string
        }
        Insert: {
          bot_instance_id: string
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          message_id?: string | null
          question: string
          status?: string
        }
        Update: {
          bot_instance_id?: string
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          message_id?: string | null
          question?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_polls_bot_instance_id_fkey"
            columns: ["bot_instance_id"]
            isOneToOne: false
            referencedRelation: "bot_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_settings: {
        Row: {
          auto_delete_enabled: boolean
          auto_mute_enabled: boolean
          bot_instance_id: string
          created_at: string
          group_ai_requests_per_minute: number
          group_rules: string
          id: string
          language: string
          moderation_level: string
          mute_minutes: number
          response_mode: string
          updated_at: string
          user_requests_per_minute: number
        }
        Insert: {
          auto_delete_enabled?: boolean
          auto_mute_enabled?: boolean
          bot_instance_id: string
          created_at?: string
          group_ai_requests_per_minute?: number
          group_rules?: string
          id?: string
          language?: string
          moderation_level?: string
          mute_minutes?: number
          response_mode?: string
          updated_at?: string
          user_requests_per_minute?: number
        }
        Update: {
          auto_delete_enabled?: boolean
          auto_mute_enabled?: boolean
          bot_instance_id?: string
          created_at?: string
          group_ai_requests_per_minute?: number
          group_rules?: string
          id?: string
          language?: string
          moderation_level?: string
          mute_minutes?: number
          response_mode?: string
          updated_at?: string
          user_requests_per_minute?: number
        }
        Relationships: [
          {
            foreignKeyName: "bot_settings_bot_instance_id_fkey"
            columns: ["bot_instance_id"]
            isOneToOne: true
            referencedRelation: "bot_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          created_at: string
          date: string | null
          end_time: string
          id: string
          recurring_days: number[] | null
          start_time: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          end_time: string
          id?: string
          recurring_days?: number[] | null
          start_time: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string | null
          end_time?: string
          id?: string
          recurring_days?: number[] | null
          start_time?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_notes: {
        Row: {
          content: string
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          date: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_objectives: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          deadline: string | null
          estimated_minutes: number
          id: string
          is_template: boolean
          priority: string
          progress_notes: string[]
          recurring_days: number[] | null
          skipped: boolean
          subject_id: string
          task: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date?: string
          deadline?: string | null
          estimated_minutes?: number
          id?: string
          is_template?: boolean
          priority?: string
          progress_notes?: string[]
          recurring_days?: number[] | null
          skipped?: boolean
          subject_id: string
          task: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          deadline?: string | null
          estimated_minutes?: number
          id?: string
          is_template?: boolean
          priority?: string
          progress_notes?: string[]
          recurring_days?: number[] | null
          skipped?: boolean
          subject_id?: string
          task?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_objectives_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_objectives_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "daily_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_time: string | null
          event_date: string | null
          id: string
          notified_at: Json | null
          recurring_days: number[] | null
          start_time: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          id?: string
          notified_at?: Json | null
          recurring_days?: number[] | null
          start_time?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          id?: string
          notified_at?: Json | null
          recurring_days?: number[] | null
          start_time?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          app_user_id: string | null
          calendar_id: string
          connection_key_enc: string
          created_at: string
          google_email: string | null
          last_synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_user_id?: string | null
          calendar_id?: string
          connection_key_enc: string
          created_at?: string
          google_email?: string | null
          last_synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_user_id?: string | null
          calendar_id?: string
          connection_key_enc?: string
          created_at?: string
          google_email?: string | null
          last_synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_sync_map: {
        Row: {
          created_at: string
          fingerprint: string | null
          google_event_id: string
          id: string
          item_id: string
          item_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint?: string | null
          google_event_id: string
          id?: string
          item_id: string
          item_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string | null
          google_event_id?: string
          id?: string
          item_id?: string
          item_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_announcements: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          created_at: string
          group_id: string
          id: string
          invitee_id: string
          inviter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          invitee_id: string
          inviter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_member_restrictions: {
        Row: {
          created_at: string
          created_by: string
          group_id: string
          id: string
          reason: string
          restricted_until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          reason: string
          restricted_until: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          reason?: string
          restricted_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_member_restrictions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          author_type: string
          bot_event_id: string | null
          content: string
          created_at: string
          group_id: string
          id: string
          image_url: string | null
          moderation_status: string
          pinned: boolean
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          author_type?: string
          bot_event_id?: string | null
          content?: string
          created_at?: string
          group_id: string
          id?: string
          image_url?: string | null
          moderation_status?: string
          pinned?: boolean
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          author_type?: string
          bot_event_id?: string | null
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          image_url?: string | null
          moderation_status?: string
          pinned?: boolean
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          scope?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          bot_role: string | null
          bot_type: string | null
          created_at: string
          id: string
          message: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          bot_role?: string | null
          bot_type?: string | null
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          bot_role?: string | null
          bot_type?: string | null
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          body: string | null
          category: string
          created_at: string
          dedupe_key: string
          id: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          category: string
          created_at?: string
          dedupe_key: string
          id?: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          direct_messages: boolean
          event_reminders: boolean
          friend_requests: boolean
          goal_completion: boolean
          group_invites: boolean
          group_messages: boolean
          mentions: boolean
          push_enabled: boolean
          schedule_reminders: boolean
          streak_reminders: boolean
          study_reminders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direct_messages?: boolean
          event_reminders?: boolean
          friend_requests?: boolean
          goal_completion?: boolean
          group_invites?: boolean
          group_messages?: boolean
          mentions?: boolean
          push_enabled?: boolean
          schedule_reminders?: boolean
          streak_reminders?: boolean
          study_reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          direct_messages?: boolean
          event_reminders?: boolean
          friend_requests?: boolean
          goal_completion?: boolean
          group_invites?: boolean
          group_messages?: boolean
          mentions?: boolean
          push_enabled?: boolean
          schedule_reminders?: boolean
          streak_reminders?: boolean
          study_reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string | null
          kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          day_start_hour: number
          full_name: string | null
          id: string
          is_private: boolean
          theme: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          day_start_hour?: number
          full_name?: string | null
          id: string
          is_private?: boolean
          theme?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          day_start_hour?: number
          full_name?: string | null
          id?: string
          is_private?: boolean
          theme?: string | null
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          action?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          handled_by: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          handled_by?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          handled_by?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          background: string | null
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          background?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          background?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      story_likes: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          join_code: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          join_code?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          join_code?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_presence: {
        Row: {
          is_studying: boolean
          mode: string | null
          started_at: string | null
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          is_studying?: boolean
          mode?: string | null
          started_at?: string | null
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          is_studying?: boolean
          mode?: string | null
          started_at?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          created_at: string
          delay_minutes: number | null
          duration_seconds: number
          ended_at: string
          id: string
          notes: string | null
          planned_seconds: number | null
          started_at: string
          subject_id: string | null
          tag_id: string | null
          topic: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delay_minutes?: number | null
          duration_seconds?: number
          ended_at?: string
          id?: string
          notes?: string | null
          planned_seconds?: number | null
          started_at?: string
          subject_id?: string | null
          tag_id?: string | null
          topic?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delay_minutes?: number | null
          duration_seconds?: number
          ended_at?: string
          id?: string
          notes?: string | null
          planned_seconds?: number | null
          started_at?: string
          subject_id?: string | null
          tag_id?: string | null
          topic?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "study_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      study_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      user_quotes: {
        Row: {
          author: string | null
          created_at: string
          id: string
          text: string
          user_id: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          text: string
          user_id: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      user_restrictions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          restricted_until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          restricted_until: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          restricted_until?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_targets: {
        Row: {
          completed: boolean
          created_at: string
          deadline: string | null
          id: string
          subject_id: string
          target: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          deadline?: string | null
          id?: string
          subject_id: string
          target: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          deadline?: string | null
          id?: string
          subject_id?: string
          target?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_targets_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      announcement_read_counts: {
        Args: never
        Returns: {
          announcement_id: string
          read_count: number
        }[]
      }
      consume_rate_limit: {
        Args: { _action: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      get_profile_overview: { Args: { _user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      search_profiles_by_username: {
        Args: { _term: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          username: string
        }[]
      }
      set_group_message_pinned: {
        Args: { _message_id: string; _pinned: boolean }
        Returns: undefined
      }
      suggest_usernames: {
        Args: { _base?: string }
        Returns: {
          username: string
        }[]
      }
      username_available: { Args: { _username: string }; Returns: boolean }
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
