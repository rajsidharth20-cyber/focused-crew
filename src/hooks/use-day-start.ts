import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getDayStartHour, setDayStartHour, subscribeDayStartHour } from '@/lib/day-boundary';

/**
 * Keeps the "a new day starts at" hour in sync between the profile row,
 * localStorage and the day-boundary helpers.
 */
export function useDayStart() {
  const { user, isGuest } = useAuth();
  const [hour, setHourState] = useState(getDayStartHour);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeDayStartHour(setHourState);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!user || isGuest) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('day_start_hour')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if (typeof data.day_start_hour === 'number') setDayStartHour(data.day_start_hour);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isGuest]);

  const update = useCallback(
    async (next: number) => {
      setDayStartHour(next);
      if (!user || isGuest) return;
      setSaving(true);
      await supabase.from('profiles').update({ day_start_hour: next }).eq('id', user.id);
      setSaving(false);
    },
    [user, isGuest]
  );

  return { hour, setHour: update, saving };
}

export const DAY_START_OPTIONS = Array.from({ length: 12 }, (_, h) => ({
  value: h,
  label: h === 0 ? '12:00 AM (midnight)' : `${h}:00 AM`,
}));
