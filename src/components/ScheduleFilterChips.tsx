import { RANGE_OPTIONS, type RangeKey } from '@/lib/schedule-filter';

interface Props {
  value: RangeKey;
  onChange: (key: RangeKey) => void;
  className?: string;
}

export function ScheduleFilterChips({ value, onChange, className }: Props) {
  return (
    <div className={`flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 ${className ?? ''}`}>
      {RANGE_OPTIONS.map(opt => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors border ${
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
