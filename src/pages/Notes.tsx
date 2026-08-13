import { DailyNote } from '@/components/DailyNote';
import { BottomNav } from '@/components/shell/BottomNav';

export default function Notes() {
  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <h1 className="text-[17px] font-bold tracking-tight">Daily note</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-28">
        <DailyNote />
      </main>

      <BottomNav />
    </div>
  );
}
