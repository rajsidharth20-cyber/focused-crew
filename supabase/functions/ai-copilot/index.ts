import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const tools = [
  {
    type: "function",
    function: {
      name: "get_data",
      description:
        "Read the user's planner data. Always call this before answering questions about their schedule or before making changes, so you know current items and their ids.",
      parameters: {
        type: "object",
        properties: {
          scopes: {
            type: "array",
            description:
              "Which datasets to read: subjects, objectives, commitments, events, weekly_targets, study_sessions, notes",
            items: {
              type: "string",
              enum: [
                "subjects",
                "objectives",
                "commitments",
                "events",
                "weekly_targets",
                "study_sessions",
                "notes",
              ],
            },
          },
          days_back: {
            type: "number",
            description: "How many past days of objectives/sessions/notes to include (default 7).",
          },
        },
        required: ["scopes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_subject",
      description: "Create a subject/course.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_objective",
      description:
        "Add a daily objective (task). Use an existing subject id from get_data; if the subject does not exist, create it first with add_subject.",
      parameters: {
        type: "object",
        properties: {
          subject_id: { type: "string" },
          task: { type: "string" },
          estimated_minutes: { type: "number" },
          date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          deadline: { type: "string", description: "YYYY-MM-DD or empty" },
          recurring_days: {
            type: "array",
            description: "0=Sunday..6=Saturday. If provided, creates a recurring template.",
            items: { type: "number" },
          },
        },
        required: ["subject_id", "task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_objective",
      description: "Update an objective: mark complete, change task/time/priority, or append a progress note.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          completed: { type: "boolean" },
          task: { type: "string" },
          estimated_minutes: { type: "number" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          add_progress_note: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_objective",
      description: "Delete an objective by id.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "add_commitment",
      description: "Add a fixed time commitment for the day (class, visit, meeting, other).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          start_time: { type: "string", description: "HH:MM (24h)" },
          end_time: { type: "string", description: "HH:MM (24h)" },
          type: { type: "string", enum: ["class", "visit", "meeting", "other"] },
          date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
          recurring_days: { type: "array", items: { type: "number" } },
        },
        required: ["title", "start_time", "end_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_commitment",
      description: "Delete a commitment by id.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "add_event",
      description: "Add an upcoming event / deadline.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          event_date: { type: "string", description: "YYYY-MM-DD" },
          start_time: { type: "string", description: "HH:MM (24h)" },
          end_time: { type: "string", description: "HH:MM (24h)" },
          description: { type: "string" },
          recurring_days: { type: "array", items: { type: "number" } },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_event",
      description: "Update an existing event by id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          event_date: { type: "string" },
          start_time: { type: "string" },
          end_time: { type: "string" },
          description: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_event",
      description: "Delete an event by id.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "add_weekly_target",
      description: "Add a weekly target for a subject.",
      parameters: {
        type: "object",
        properties: {
          subject_id: { type: "string" },
          target: { type: "string" },
          deadline: { type: "string", description: "YYYY-MM-DD or empty" },
        },
        required: ["subject_id", "target"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_weekly_target",
      description: "Update a weekly target (text, deadline or completion).",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          target: { type: "string" },
          completed: { type: "boolean" },
          deadline: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_weekly_target",
      description: "Delete a weekly target by id.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "save_daily_note",
      description: "Write or overwrite the user's note for a day.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        },
        required: ["content"],
      },
    },
  },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function runTool(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
  name: string,
  args: Record<string, any>,
): Promise<unknown> {
  const clean = <T extends Record<string, any>>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

  switch (name) {
    case "get_data": {
      const scopes: string[] = args.scopes ?? [];
      const daysBack = Math.min(Math.max(Number(args.days_back ?? 7), 0), 60);
      const since = isoDate(new Date(Date.parse(today + "T00:00:00Z") - daysBack * 86400000));
      const out: Record<string, unknown> = { today };
      const jobs: Promise<void>[] = [];

      if (scopes.includes("subjects"))
        jobs.push(
          supabase.from("subjects").select("id,name").eq("user_id", userId).then(({ data }) => {
            out.subjects = data ?? [];
          }),
        );
      if (scopes.includes("objectives"))
        jobs.push(
          supabase
            .from("daily_objectives")
            .select("id,subject_id,task,estimated_minutes,completed,progress_notes,date,deadline,priority,recurring_days,is_template")
            .eq("user_id", userId)
            .gte("date", since)
            .order("date", { ascending: false })
            .limit(200)
            .then(({ data }) => {
              out.objectives = data ?? [];
            }),
        );
      if (scopes.includes("commitments"))
        jobs.push(
          supabase
            .from("commitments")
            .select("id,title,start_time,end_time,type,date,recurring_days")
            .eq("user_id", userId)
            .then(({ data }) => {
              out.commitments = data ?? [];
            }),
        );
      if (scopes.includes("events"))
        jobs.push(
          supabase
            .from("events")
            .select("id,title,event_date,start_time,end_time,description,recurring_days")
            .eq("user_id", userId)
            .then(({ data }) => {
              out.events = data ?? [];
            }),
        );
      if (scopes.includes("weekly_targets"))
        jobs.push(
          supabase
            .from("weekly_targets")
            .select("id,subject_id,target,completed,deadline")
            .eq("user_id", userId)
            .then(({ data }) => {
              out.weekly_targets = data ?? [];
            }),
        );
      if (scopes.includes("study_sessions"))
        jobs.push(
          supabase
            .from("study_sessions")
            .select("id,subject_id,topic,type,duration_seconds,started_at,notes")
            .eq("user_id", userId)
            .gte("started_at", since)
            .order("started_at", { ascending: false })
            .limit(200)
            .then(({ data }) => {
              out.study_sessions = data ?? [];
            }),
        );
      if (scopes.includes("notes"))
        jobs.push(
          supabase
            .from("daily_notes")
            .select("date,content")
            .eq("user_id", userId)
            .gte("date", since)
            .order("date", { ascending: false })
            .then(({ data }) => {
              out.notes = data ?? [];
            }),
        );

      await Promise.all(jobs);
      return out;
    }

    case "add_subject": {
      const { data, error } = await supabase
        .from("subjects")
        .insert({ user_id: userId, name: args.name })
        .select("id,name")
        .single();
      if (error) throw error;
      return data;
    }

    case "add_objective": {
      const recurring = Array.isArray(args.recurring_days) && args.recurring_days.length > 0
        ? args.recurring_days.map(Number)
        : null;
      const row = clean({
        user_id: userId,
        subject_id: args.subject_id,
        task: args.task,
        estimated_minutes: args.estimated_minutes ?? 30,
        date: args.date || today,
        deadline: args.deadline,
        priority: args.priority || "medium",
        progress_notes: [],
        recurring_days: recurring,
        is_template: !!recurring,
      });
      const { data, error } = await supabase.from("daily_objectives").insert(row).select().single();
      if (error) throw error;
      return data;
    }

    case "update_objective": {
      const patch: Record<string, any> = clean({
        completed: args.completed,
        task: args.task,
        estimated_minutes: args.estimated_minutes,
        priority: args.priority,
      });
      if (args.add_progress_note) {
        const { data: cur } = await supabase
          .from("daily_objectives")
          .select("progress_notes")
          .eq("id", args.id)
          .eq("user_id", userId)
          .single();
        patch.progress_notes = [...(((cur as any)?.progress_notes as string[]) ?? []), args.add_progress_note];
      }
      if (typeof args.completed === "boolean") patch.completed = args.completed;
      const { data, error } = await supabase
        .from("daily_objectives")
        .update(patch)
        .eq("id", args.id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case "delete_objective": {
      const { error } = await supabase.from("daily_objectives").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { deleted: true };
    }

    case "add_commitment": {
      const recurring = Array.isArray(args.recurring_days) && args.recurring_days.length > 0
        ? args.recurring_days.map(Number)
        : null;
      const { data, error } = await supabase
        .from("commitments")
        .insert(
          clean({
            user_id: userId,
            title: args.title,
            start_time: args.start_time,
            end_time: args.end_time,
            type: args.type || "other",
            date: recurring ? null : args.date || today,
            recurring_days: recurring,
          }),
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case "delete_commitment": {
      const { error } = await supabase.from("commitments").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { deleted: true };
    }

    case "add_event": {
      const recurring = Array.isArray(args.recurring_days) && args.recurring_days.length > 0
        ? args.recurring_days.map(Number)
        : null;
      const { data, error } = await supabase
        .from("events")
        .insert(
          clean({
            user_id: userId,
            title: args.title,
            event_date: args.event_date,
            start_time: args.start_time,
            end_time: args.end_time,
            description: args.description,
            recurring_days: recurring,
          }),
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case "update_event": {
      const { data, error } = await supabase
        .from("events")
        .update(
          clean({
            title: args.title,
            event_date: args.event_date,
            start_time: args.start_time,
            end_time: args.end_time,
            description: args.description,
          }),
        )
        .eq("id", args.id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case "delete_event": {
      const { error } = await supabase.from("events").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { deleted: true };
    }

    case "add_weekly_target": {
      const { data, error } = await supabase
        .from("weekly_targets")
        .insert(
          clean({
            user_id: userId,
            subject_id: args.subject_id,
            target: args.target,
            deadline: args.deadline,
            completed: false,
          }),
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case "update_weekly_target": {
      const patch = clean({ target: args.target, deadline: args.deadline });
      if (typeof args.completed === "boolean") (patch as any).completed = args.completed;
      const { data, error } = await supabase
        .from("weekly_targets")
        .update(patch)
        .eq("id", args.id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case "delete_weekly_target": {
      const { error } = await supabase.from("weekly_targets").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { deleted: true };
    }

    case "save_daily_note": {
      const date = args.date || today;
      const { data, error } = await supabase
        .from("daily_notes")
        .upsert({ user_id: userId, date, content: args.content }, { onConflict: "user_id,date" })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY is not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json();
    const incoming: Array<{ role: string; content: string }> = body.messages ?? [];
    const today: string = typeof body.today === "string" ? body.today : isoDate(new Date());
    const localTime: string = body.localTime ?? "";
    const timeZone: string = body.timeZone ?? "";

    const system = `You are Copilot, the in-app assistant for Task Pilot, a study planner. You were created by Sidharth.

You can BOTH analyze the user's data and change it for them using the provided tools: subjects, daily objectives (tasks), commitments (fixed time blocks), events/deadlines, weekly targets and daily notes.

Rules:
- Call get_data first whenever you need current state or item ids. Never invent an id.
- When the user asks for a change, just do it with the tools — don't ask for permission unless the request is genuinely ambiguous or destructive (deleting many items).
- Infer sensible defaults (30 min estimate, medium priority, today's date). Resolve relative dates like "tomorrow" or "Friday" yourself.
- If a subject doesn't exist yet, create it with add_subject before adding objectives or targets to it.
- After making changes, confirm briefly in plain language what you changed.
- For analysis, be specific and reference their actual data (completion rates, study hours, gaps between commitments). Keep answers short, in markdown, no fluff.

Context: today is ${today}${localTime ? `, the user's local time is ${localTime}` : ""}${timeZone ? ` (${timeZone})` : ""}. Day-of-week numbers: 0=Sunday .. 6=Saturday.`;

    const messages: any[] = [{ role: "system", content: system }, ...incoming];
    const actions: Array<{ name: string; args: Record<string, any>; ok: boolean }> = [];

    for (let step = 0; step < 8; step++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages,
          tools,
        }),
      });

      if (res.status === 429) return json({ error: "Rate limits exceeded, please try again in a moment." }, 429);
      if (res.status === 402)
        return json({ error: "AI credits exhausted. Please add credits to continue." }, 402);
      if (!res.ok) {
        const t = await res.text();
        console.error("gateway error", res.status, t);
        return json({ error: "AI gateway error" }, 500);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) return json({ error: "Empty AI response" }, 500);

      messages.push(msg);
      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) {
        return json({ reply: msg.content ?? "", actions });
      }

      for (const call of calls) {
        const name = call.function?.name;
        let args: Record<string, any> = {};
        try {
          args = JSON.parse(call.function?.arguments || "{}");
        } catch { /* ignore */ }
        let result: unknown;
        let ok = true;
        try {
          result = await runTool(supabase, user.id, today, name, args);
        } catch (e) {
          ok = false;
          result = { error: e instanceof Error ? e.message : String(e) };
          console.error("tool failed", name, result);
        }
        if (name !== "get_data") actions.push({ name, args, ok });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 20000),
        });
      }
    }

    return json({ reply: "I couldn't finish that in time — try a simpler request.", actions });
  } catch (e) {
    console.error("copilot error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
