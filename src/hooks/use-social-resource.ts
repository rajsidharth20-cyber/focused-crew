import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SetStateAction } from 'react';

/** In-memory, account-scoped snapshots; private social content never enters localStorage. */
export function useSocialResource<T>(userId: string | undefined, name: string, empty: T, fetcher: () => Promise<T>) {
  const client = useQueryClient();
  const key = ['social', userId ?? 'signed-out', name];
  const query = useQuery({ queryKey: key, queryFn: fetcher, enabled: !!userId,
    staleTime: 60_000, gcTime: 30 * 60_000 });
  const setData = useCallback((update: SetStateAction<T>) => {
    if (!userId) return;
    client.setQueryData<T>(['social', userId, name], previous =>
      typeof update === 'function' ? (update as (value: T) => T)(previous ?? empty) : update);
  }, [client, userId, name]);
  const reload = useCallback(async () => {
    if (!userId) return;
    await client.invalidateQueries({ queryKey: ['social', userId, name], exact: true });
  }, [client, userId, name]);
  return { data: userId ? query.data ?? empty : empty, setData, loading: !!userId && query.isPending, reload };
}