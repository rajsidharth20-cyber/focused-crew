import { useState } from 'react';
import { ShieldCheck, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTerms } from '@/lib/terms';
import { EmptyState } from '@/components/EmptyState';

interface FlightProtocolsProps {
  protocols: string[];
  onAdd: (protocol: string) => void;
  onRemove: (index: number) => void;
}

export function FlightProtocols({ protocols, onAdd, onRemove }: FlightProtocolsProps) {
  const t = useTerms();
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput('');
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <ShieldCheck className="w-4 h-4 text-primary" />
          {t.protocols}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t.protocolsHint}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. No phone during study..."
            className="h-9 text-sm bg-background/50"
          />
          <Button onClick={handleAdd} size="sm" className="h-9 shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {protocols.length === 0 && (
          <EmptyState compact icon={ShieldCheck} title="No rules yet" hint="Add a daily rule you want to hold yourself to." />
        )}


        <ul className="space-y-1.5">
          {protocols.map((protocol, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-foreground/90 bg-primary/5 border border-primary/10 rounded-md px-3 py-2">
              <ShieldCheck className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <span className="flex-1">{protocol}</span>
              <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
