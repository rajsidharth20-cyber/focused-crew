ALTER TABLE public.weekly_targets ADD COLUMN IF NOT EXISTS progress_notes text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.remove_recurring_objective(_template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  PERFORM id FROM public.daily_objectives WHERE id = _template_id AND user_id = auth.uid() AND is_template = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recurring objective not found'; END IF;
  DELETE FROM public.daily_objectives WHERE user_id = auth.uid() AND template_id = _template_id;
  DELETE FROM public.daily_objectives WHERE user_id = auth.uid() AND id = _template_id AND is_template = true;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_recurring_objective(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_recurring_objective(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_weekly_target_note(_target_id uuid, _note text)
RETURNS text[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE notes text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF length(btrim(_note)) = 0 OR length(btrim(_note)) > 1000 THEN RAISE EXCEPTION 'Note must contain 1 to 1000 characters'; END IF;
  UPDATE public.weekly_targets SET progress_notes = array_append(progress_notes, json_build_object('text', btrim(_note), 'timestamp', now())::text)
    WHERE id = _target_id AND user_id = auth.uid() RETURNING progress_notes INTO notes;
  IF NOT FOUND THEN RAISE EXCEPTION 'Weekly target not found'; END IF;
  RETURN notes;
END;
$$;
REVOKE ALL ON FUNCTION public.add_weekly_target_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_weekly_target_note(uuid, text) TO authenticated;