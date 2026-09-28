import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useIsStaff } from '@/hooks/use-announcements';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface Report { id: string; group_id: string | null; details: string | null; created_at: string; status: string }

export default function AdminReports() {
  const { isStaff, loading } = useIsStaff();
  const [reports, setReports] = useState<Report[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (loading) return;
    if (!isStaff) { setFetching(false); return; }
    let active = true;
    supabase.from('reports').select('id,group_id,details,created_at,status').eq('target_type', 'group_message').order('created_at', { ascending: false }).limit(100).then(({ data, error: fetchError }) => {
      if (!active) return;
      if (fetchError) setError('Could not load reports.');
      else setReports(data ?? []);
      setFetching(false);
    });
    return () => { active = false; };
  }, [isStaff, loading]);
  if (loading || fetching) return <div className="min-h-screen bg-background grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  return <div className="min-h-screen bg-background"><header className="border-b border-border/60 p-3 flex items-center gap-2"><Button asChild variant="ghost" size="icon"><Link to="/more" aria-label="Back"><ArrowLeft /></Link></Button><h1 className="font-semibold">Group reports</h1></header><main className="max-w-2xl mx-auto p-4 space-y-3">{!isStaff ? <p className="text-sm text-muted-foreground">Admins only.</p> : error ? <p className="text-sm text-destructive">{error}</p> : reports.length === 0 ? <p className="text-sm text-muted-foreground">No reported messages.</p> : reports.map(report => <div key={report.id} className="border border-border/60 rounded-lg bg-card p-3 space-y-2"><div className="flex justify-between text-xs text-muted-foreground gap-2"><span>{new Date(report.created_at).toLocaleString()}</span><span>{report.status}</span></div><p className="text-sm whitespace-pre-wrap break-words">{report.details}</p>{report.group_id && <Button asChild size="sm" variant="outline"><Link to={`/groups/${report.group_id}/chat`}>Open group chat</Link></Button>}</div>)}</main></div>;
}