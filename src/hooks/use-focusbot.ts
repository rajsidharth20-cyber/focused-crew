import { supabase } from '@/integrations/supabase/client';

export type FocusBotPermission =
  | 'spam_detection'
  | 'ai_moderation'
  | 'study_assistance'
  | 'chat_summaries'
  | 'focus_sessions'
  | 'productivity_reminders'
  | 'polls';

export interface FocusBotConfig {
  bot: { id: string; enabled: boolean };
  settings: {
    group_rules: string;
    moderation_level: string;
    auto_delete_enabled: boolean;
    auto_mute_enabled: boolean;
  };
  permissionMap: Record<FocusBotPermission, boolean>;
  isAdmin: boolean;
  flags: Array<{
    id: string;
    message_id: string;
    target_user_id: string;
    classification: string;
    reason: string;
    confidence: number;
    status: string;
    created_at: string;
  }>;
}

export async function callFocusBot<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('focusbot', { body });
  if (error) throw new Error(data?.error ?? error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const processGroupMessage = (groupId: string, messageId: string) =>
  callFocusBot({ action: 'process_group_message', groupId, messageId });

export const reportGroupMessage = (groupId: string, targetMessageId: string, reason: string) =>
  supabase.rpc('submit_focusbot_report', { _group_id: groupId, _message_id: targetMessageId, _reason: reason }).then(({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  });