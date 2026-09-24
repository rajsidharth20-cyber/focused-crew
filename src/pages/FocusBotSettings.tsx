import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, Loader2, Save, ShieldAlert, Trash2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { callFocusBot, type FocusBotConfig, type FocusBotPermission } from '@/hooks/use-focusbot';
import { toast } from 'sonner';

const permissionLabels: Record<FocusBotPermission, { title: string; detail: string }> = {
  spam_detection: { title: 'Spam detection', detail: 'Checks links, repetition, and message bursts.' },
  ai_moderation: { title: 'AI moderation', detail: 'Reviews messages that need a meaning-based check.' },
  study_assistance: { title: 'Study assistance', detail: 'Answers only when someone mentions @FocusBot.' },
  chat_summaries: { title: 'Chat summaries', detail: 'Allows /summary for a limited recent message window.' },
  focus_sessions: { title: 'Focus sessions', detail: 'Allows members to start a 25-minute /focus session.' },
  productivity_reminders: { title: 'Productivity reminders', detail: 'Allows occasional study reminders.' },
  polls: { title: 'Polls', detail: 'Allows members to create in-chat polls.' },
};

const permissionKeys = Object.keys(permissionLabels) as FocusBotPermission[];

export default function FocusBotSettings() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [config, setConfig] = useState<FocusBotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      setConfig(await callFocusBot<FocusBotConfig>({ action: 'get_config', groupId }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'FocusBot settings are unavailable.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!groupId || !config || !config.isAdmin) return;
    setSaving(true);
    try {
      await callFocusBot({
        action: 'save_config',
        groupId,
        enabled: config.bot.enabled,
        permissions: config.permissionMap,
        settings: config.settings,
      });
      toast.success('FocusBot settings saved');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save FocusBot settings.');
    } finally {
      setSaving(false);
    }
  };

  const review = async (flagId: string, decision: 'dismiss' | 'delete' | 'mute') => {
    if (!groupId) return;
    try {
      await callFocusBot({ action: 'review_flag', groupId, flagId, decision });
      toast.success(decision === 'dismiss' ? 'Flag dismissed' : decision === 'delete' ? 'Message deleted' : 'Member temporarily muted');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not review this flag.');
    }
  };

  if (loading) return <div className="min-h-screen bg-background grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (!config) return <div className="min-h-screen bg-background grid place-items-center p-6"><Button onClick={() => navigate(`/groups/${groupId}`)}>Back to group</Button></div>;

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="sticky top-0 z-20 flex items-center gap-2 px-3 py-3 border-b border-border/60 bg-background/95 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/groups/${groupId}`)} aria-label="Back"><ArrowLeft className="w-5 h-5" /></Button>
        <Bot className="w-5 h-5 text-primary" />
        <div className="min-w-0 flex-1"><h1 className="font-semibold leading-tight">FocusBot</h1><p className="text-[11px] text-muted-foreground">Study-group assistant</p></div>
        {config.isAdmin && <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}Save</Button>}
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <section className="border border-border/60 rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="font-semibold">Enable FocusBot</h2><p className="text-xs text-muted-foreground mt-1">When enabled, FocusBot can analyze group messages for the permissions below.</p></div>
            <Switch checked={config.bot.enabled} disabled={!config.isAdmin} onCheckedChange={enabled => setConfig(current => current ? { ...current, bot: { ...current.bot, enabled } } : current)} aria-label="Enable FocusBot" />
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground border-t border-border/50 pt-3"><ShieldAlert className="w-4 h-4 shrink-0 text-primary" /><p>Members will see an active notice in chat. FocusBot never reads ordinary private conversations.</p></div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Permissions</h2>
          <div className="border border-border/60 rounded-lg bg-card divide-y divide-border/50">
            {permissionKeys.map(key => <div key={key} className="flex items-center justify-between gap-4 p-3"><div><p className="text-sm font-medium">{permissionLabels[key].title}</p><p className="text-xs text-muted-foreground mt-0.5">{permissionLabels[key].detail}</p></div><Switch checked={config.permissionMap[key]} disabled={!config.isAdmin} onCheckedChange={enabled => setConfig(current => current ? { ...current, permissionMap: { ...current.permissionMap, [key]: enabled } } : current)} aria-label={permissionLabels[key].title} /></div>)}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Moderation</h2>
          <Select disabled={!config.isAdmin} value={config.settings.moderation_level} onValueChange={moderation_level => setConfig(current => current ? { ...current, settings: { ...current.settings, moderation_level } } : current)}><SelectTrigger aria-label="Moderation level"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="conservative">Conservative</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="strict">Strict</SelectItem></SelectContent></Select>
          <div className="border border-border/60 rounded-lg bg-card divide-y divide-border/50">
            <div className="flex items-center justify-between gap-4 p-3"><div><p className="text-sm font-medium">Automatic deletion</p><p className="text-xs text-muted-foreground">Delete only high-confidence violations.</p></div><Switch checked={config.settings.auto_delete_enabled} disabled={!config.isAdmin} onCheckedChange={auto_delete_enabled => setConfig(current => current ? { ...current, settings: { ...current.settings, auto_delete_enabled } } : current)} /></div>
            <div className="flex items-center justify-between gap-4 p-3"><div><p className="text-sm font-medium">Automatic temporary mute</p><p className="text-xs text-muted-foreground">Temporarily stop repeated violations.</p></div><Switch checked={config.settings.auto_mute_enabled} disabled={!config.isAdmin} onCheckedChange={auto_mute_enabled => setConfig(current => current ? { ...current, settings: { ...current.settings, auto_mute_enabled } } : current)} /></div>
          </div>
          <div><label className="text-sm font-medium" htmlFor="group-rules">Group rules</label><Textarea id="group-rules" className="mt-1.5" rows={5} value={config.settings.group_rules} disabled={!config.isAdmin} onChange={event => setConfig(current => current ? { ...current, settings: { ...current.settings, group_rules: event.target.value } } : current)} /></div>
        </section>

        {config.isAdmin && <section className="space-y-2"><h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Moderation review</h2>{config.flags.filter(flag => flag.status === 'open').length === 0 ? <p className="text-sm text-muted-foreground">No messages need review.</p> : <div className="space-y-2">{config.flags.filter(flag => flag.status === 'open').map(flag => <div key={flag.id} className="border border-border/60 rounded-lg bg-card p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{flag.classification.replaceAll('_', ' ')}</span><span className="text-xs tabular-nums text-muted-foreground">{Math.round(flag.confidence * 100)}%</span></div><p className="text-sm mt-1">{flag.reason}</p><div className="flex gap-2 mt-3"><Button size="sm" variant="outline" onClick={() => review(flag.id, 'dismiss')}>Dismiss</Button><Button size="sm" variant="outline" onClick={() => review(flag.id, 'delete')}><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button><Button size="sm" variant="outline" onClick={() => review(flag.id, 'mute')}><UserX className="w-3.5 h-3.5 mr-1" />Mute</Button></div></div>)}</div>}</section>}

        {!config.isAdmin && <p className="text-sm text-muted-foreground text-center">Only a group owner or admin can change these settings.</p>}
      </main>
    </div>
  );
}