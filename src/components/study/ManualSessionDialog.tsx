import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { StudyTag } from '@/hooks/use-study-store';
import type { Subject } from '@/hooks/use-planner-store';

interface Props {
  tags: StudyTag[];
  subjects: Subject[];
  onSave?: (input: {
    tagId: string | null;
    subjectId: string | null;
    topic: string;
    durationSeconds: number;
    startedAt: string;
    endedAt: string;
    notes: string | null;
  }) => void;
}

export function ManualSessionDialog({}: Props) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/study/add-session')}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gradient-primary text-primary-foreground font-semibold shadow-md hover:opacity-90 transition"
      aria-label="Add missed session"
    >
      <Plus className="w-3.5 h-3.5" />
      <span className="hidden xs:inline sm:inline">Add session</span>
      <span className="xs:hidden sm:hidden">Add</span>
    </button>
  );
}
