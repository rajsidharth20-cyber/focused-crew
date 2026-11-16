import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioCall, CallPeer } from '@/lib/audio-call';
const mock = vi.hoisted(() => {
  const state: { change?: (call: AudioCall | null) => void } = {};
  return { state, end: vi.fn(), accept: vi.fn(), mute: vi.fn(), dispose: vi.fn(), stop: vi.fn(), listen: vi.fn(() => () => {}), rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' }, isGuest: false }) }));
vi.mock('@/lib/user-events', () => ({ onUserEvent: mock.listen }));
vi.mock('@/components/UserAvatar', () => ({ UserAvatar: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: mock.rpc,
  from: () => ({ select: () => ({ eq: () => ({ gt: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) }) }),
} }));
vi.mock('@/lib/audio-call', () => ({ AudioCallController: class {
  constructor(deps: { change: (call: AudioCall | null) => void }) { mock.state.change = deps.change; }
  end = mock.end; accept = mock.accept; mute = mock.mute; dispose = mock.dispose;
} }));
import { AudioCallProvider } from '@/hooks/use-audio-call';
const peer: CallPeer = { id: 'friend', full_name: 'Friend', username: null, avatar_url: null };
describe('global audio call ownership', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('lets an incoming call be accepted outside chat and keeps its controls across page changes', () => {
    const view = render(<AudioCallProvider><main>Planner</main></AudioCallProvider>);
    act(() => mock.state.change?.({ id: 'call', peer, state: 'ringing', incoming: true, muted: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept' })); expect(mock.accept).toHaveBeenCalledTimes(1);
    act(() => mock.state.change?.({ id: 'call', peer, state: 'connected', incoming: true, muted: false, connectedAt: Date.now() }));
    view.rerender(<AudioCallProvider><main>Social</main></AudioCallProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Mute microphone' })); expect(mock.mute).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'End call' })); expect(mock.end).toHaveBeenCalledTimes(1);
    expect(mock.listen).toHaveBeenCalledTimes(1);
    view.unmount(); expect(mock.dispose).toHaveBeenCalledTimes(1);
  });
  it('declines an incoming call without accepting microphone access', () => {
    render(<AudioCallProvider><main>Home</main></AudioCallProvider>);
    act(() => mock.state.change?.({ id: 'call', peer, state: 'ringing', incoming: true, muted: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' })); expect(mock.end).toHaveBeenCalledWith(true); expect(mock.accept).not.toHaveBeenCalled();
  });
});