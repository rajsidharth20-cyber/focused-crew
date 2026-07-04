import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { StudyTag } from '@/hooks/use-study-store';

const PALETTE = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#22C55E', '#14B8A6', '#EAB308', '#EF4444'];

interface Props {
  tags: StudyTag[];
  onAdd: (name: string, color: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<StudyTag,'name'|'color'>>) => void;
  onRemove: (id: string) => void;
}

export function TagManager({ tags, onAdd, onUpdate, onRemove }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), color);
    setName('');
  };

  const startEdit = (t: StudyTag) => {
    setEditingId(t.id); setEditName(t.name); setEditColor(t.color);
  };
  const saveEdit = () => {
    if (editingId && editName.trim()) onUpdate(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-primary/80">Tags</h3>
        <span className="text-[10px] text-muted-foreground">{tags.length} total</span>
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="e.g. DSA, Physics, Reading"
          className="flex-1 bg-background border border-border/60 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={submit}
          className="px-3 py-2 rounded-md bg-gradient-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PALETTE.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : ''}`}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        {tags.length === 0 && <p className="text-xs text-muted-foreground py-2">No tags yet. Add one above.</p>}
        {tags.map(t => (
          <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/40 bg-secondary/30">
            {editingId === t.id ? (
              <>
                <div className="flex gap-1">
                  {PALETTE.map(c => (
                    <button key={c} onClick={() => setEditColor(c)} className={`w-4 h-4 rounded-full ${editColor === c ? 'ring-2 ring-foreground' : ''}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 bg-background border border-border/60 rounded px-2 py-1 text-sm" />
                <button onClick={saveEdit} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingId(null)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span className="flex-1 text-sm truncate">{t.name}</span>
                <button onClick={() => startEdit(t)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => onRemove(t.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
