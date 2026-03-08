import { useState } from 'react';
import { Sparkles, Send, Loader2, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import type { PlannerState } from '@/hooks/use-planner-store';

interface AIAdvisorProps {
  state: PlannerState;
}

type Mode = 'next' | 'summary';

function buildPrompt(state: PlannerState, mode: Mode, userMessage?: string): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const subjectMap = Object.fromEntries(state.subjects.map(s => [s.id, s.name]));

  const weeklyLines = state.weeklyTargets.map(t =>
    `- [${t.completed ? 'x' : ' '}] ${subjectMap[t.subjectId] ?? 'Unknown'}: ${t.target}`
  ).join('\n');

  const dailyLines = state.dailyObjectives.map(o => {
    const notes = o.progressNotes.length > 0 ? ` (Progress: ${o.progressNotes.join('; ')})` : '';
    return `- [${o.completed ? 'x' : ' '}] ${subjectMap[o.subjectId] ?? 'Unknown'}: ${o.task} (~${o.estimatedMinutes}min)${notes}`;
  }).join('\n');

  const commitmentLines = state.commitments
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(c => `- ${c.startTime}-${c.endTime}: ${c.title} (${c.type})`)
    .join('\n');

  const base = `Current time: ${timeStr}

## Weekly Targets
${weeklyLines || 'None set'}

## Today's Objectives
${dailyLines || 'None set'}

## Today's Commitments
${commitmentLines || 'None'}`;

  if (mode === 'next') {
    return `You are a productivity coach. Based on the user's schedule, objectives, progress, and commitments below, suggest what they should do NEXT. Be specific, actionable, and consider time gaps between commitments. If the user has shared additional context, factor that in.

${base}

${userMessage ? `User's message: "${userMessage}"` : ''}

Give a concise, actionable recommendation. Use markdown formatting. Be encouraging but direct.`;
  }

  return `You are a productivity coach. Summarize the user's day progress based on the data below. Highlight what was accomplished, what's remaining, and suggest improvements for tomorrow. Be honest but supportive.

${base}

${userMessage ? `User's additional context: "${userMessage}"` : ''}

Give a clear day summary with markdown formatting. Include a brief analysis of time management.`;
}

export function AIAdvisor({ state }: AIAdvisorProps) {
  const [mode, setMode] = useState<Mode>('next');
  const [userMessage, setUserMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (loading) return;
    setLoading(true);
    setResponse('');

    const prompt = buildPrompt(state, mode, userMessage);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-advisor`;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          setResponse('⏳ Rate limited. Please wait a moment and try again.');
          setLoading(false);
          return;
        }
        if (resp.status === 402) {
          setResponse('💳 AI credits exhausted. Please add credits in your Lovable workspace settings.');
          setLoading(false);
          return;
        }
        throw new Error('Failed to get AI response');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullResponse = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResponse += content;
              setResponse(fullResponse);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error(err);
      setResponse('❌ Could not connect to AI. Make sure Lovable Cloud is enabled.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card glow-amber p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-semibold tracking-wide uppercase text-gradient">
            AI Advisor
          </h3>
        </div>
        <div className="flex gap-1 bg-secondary/50 rounded-md p-0.5">
          <button
            onClick={() => setMode('next')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              mode === 'next' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            What's Next?
          </button>
          <button
            onClick={() => setMode('summary')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              mode === 'summary' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            Summary
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={userMessage}
          onChange={e => setUserMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk()}
          placeholder={mode === 'next' ? "Any context? (e.g. 'I just finished studying chapter 3')" : "Any notes about your day?"}
          className="flex-1 bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          onClick={handleAsk}
          disabled={loading}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {mode === 'next' ? 'Advise' : 'Summarize'}
        </button>
      </div>

      <AnimatePresence>
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary/30 rounded-md p-4 prose prose-sm prose-invert max-w-none"
          >
            <ReactMarkdown>{response}</ReactMarkdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
