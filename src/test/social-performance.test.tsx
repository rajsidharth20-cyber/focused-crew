import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSocialResource } from '@/hooks/use-social-resource';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
describe('shared Social reads', () => {
  it('deduplicates simultaneous readers and paints cached data on tab remount', async () => {
    const { wrapper } = setup();
    const fetcher = vi.fn().mockResolvedValue(['friend']);
    const first = renderHook(() => useSocialResource('user', 'friends', [] as string[], fetcher), { wrapper });
    const second = renderHook(() => useSocialResource('user', 'friends', [] as string[], fetcher), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual(['friend']));
    expect(fetcher).toHaveBeenCalledTimes(1);
    act(() => first.result.current.setData(prev => [...prev, 'new-friend']));
    await waitFor(() => expect(second.result.current.data).toEqual(['friend', 'new-friend']));
    first.unmount(); second.unmount();
    const again = renderHook(() => useSocialResource('user', 'friends', [] as string[], fetcher), { wrapper });
    expect(again.result.current.loading).toBe(false);
    expect(again.result.current.data).toEqual(['friend', 'new-friend']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not display another account’s cache or fetch for guests', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(['social', 'first', 'chats'], ['private-message']);
    const fetcher = vi.fn().mockResolvedValue([]);
    const other = renderHook(() => useSocialResource('second', 'chats', [] as string[], fetcher), { wrapper });
    expect(other.result.current.data).toEqual([]);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const guestFetcher = vi.fn();
    const guest = renderHook(() => useSocialResource(undefined, 'chats', [] as string[], guestFetcher), { wrapper });
    expect(guest.result.current.data).toEqual([]);
    expect(guestFetcher).not.toHaveBeenCalled();
  });
});