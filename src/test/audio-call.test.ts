import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_ICE_SERVERS, AudioCallController } from '@/lib/audio-call';

const peer = { id: 'friend', full_name: 'Friend', username: null, avatar_url: null };
let pcs: FakePeer[] = [];
class FakePeer {
  connectionState = 'new'; localDescription: RTCSessionDescriptionInit | null = null; remoteDescription: RTCSessionDescriptionInit | null = null;
  onicecandidate: ((event: { candidate: { toJSON: () => object } }) => void) | null = null;
  ontrack: unknown = null; onconnectionstatechange: (() => void) | null = null;
  addTrack = vi.fn(); close = vi.fn(); addIceCandidate = vi.fn().mockResolvedValue(undefined);
  createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' });
  createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' });
  setLocalDescription = vi.fn(async (value: RTCSessionDescriptionInit) => {
    this.localDescription = value;
    this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: 'local-candidate' }) } });
  });
  setRemoteDescription = vi.fn(async (value: RTCSessionDescriptionInit) => { this.remoteDescription = value; });
  constructor(public config: unknown) { pcs.push(this); }
}
function setup() {
  const track = { enabled: true, stop: vi.fn() };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const media = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: media } });
  const deps = { send: vi.fn().mockResolvedValue(undefined), allowed: vi.fn().mockResolvedValue(true), profile: vi.fn().mockResolvedValue(peer), change: vi.fn(), error: vi.fn(), remote: vi.fn() };
  return { engine: new AudioCallController(deps), deps, track, stream, media };
}
describe('friend audio calls', () => {
  beforeEach(() => { pcs = []; vi.useFakeTimers(); vi.stubGlobal('RTCPeerConnection', FakePeer); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('uses only the requested Google STUN server and sends offer before ICE', async () => {
    const { engine, deps, media } = setup(); await engine.start(peer); await Promise.resolve();
    expect(AUDIO_ICE_SERVERS).toEqual([{ urls: 'stun:stun.l.google.com:19302' }]);
    expect(pcs[0].config).toEqual({ iceServers: AUDIO_ICE_SERVERS });
    expect(media).toHaveBeenCalledWith({ audio: true, video: false });
    expect(deps.send.mock.calls.map(call => call[2]).slice(0, 2)).toEqual(['offer', 'ice']); engine.dispose();
  });
  it('rejects calls to non-friends before requesting the microphone', async () => {
    const { engine, deps, media } = setup(); deps.allowed.mockResolvedValue(false); await engine.start(peer);
    expect(media).not.toHaveBeenCalled(); expect(deps.send).not.toHaveBeenCalledWith(peer.id, expect.any(String), 'offer', expect.anything());
    expect(engine.call?.state).toBe('ended'); engine.dispose();
  });
  it('shows incoming ringing without opening the microphone and decline sends rejected', async () => {
    const { engine, media, deps } = setup();
    await engine.receive({ call_id: 'incoming', sender_id: peer.id, kind: 'offer', payload: { type: 'offer', sdp: 'sdp' } });
    expect(engine.call?.state).toBe('ringing'); expect(media).not.toHaveBeenCalled();
    engine.end(true); expect(deps.send).toHaveBeenCalledWith(peer.id, 'incoming', 'rejected', {});
    expect(engine.call?.state).toBe('rejected'); engine.dispose();
  });
  it('queues ICE until Accept and remote description, connects, mutes and releases everything', async () => {
    const { engine, track } = setup();
    await engine.receive({ call_id: 'incoming', sender_id: peer.id, kind: 'offer', payload: { type: 'offer', sdp: 'sdp' } });
    await engine.receive({ call_id: 'incoming', sender_id: peer.id, kind: 'ice', payload: { candidate: 'remote' } });
    await engine.accept(); const pc = pcs[0];
    expect(pc.addIceCandidate).toHaveBeenCalledWith({ candidate: 'remote' });
    pc.connectionState = 'connected'; pc.onconnectionstatechange?.(); expect(engine.call?.state).toBe('connected');
    engine.mute(); expect(track.enabled).toBe(false); engine.mute(); expect(track.enabled).toBe(true);
    engine.end(); expect(track.stop).toHaveBeenCalledTimes(1); expect(pc.close).toHaveBeenCalledTimes(1);
    expect(pc.onicecandidate).toBeNull(); expect(pc.ontrack).toBeNull(); expect(pc.onconnectionstatechange).toBeNull(); engine.dispose();
  });
  it('answers busy without replacing an active call', async () => {
    const { engine, deps } = setup(); await engine.start(peer); const id = engine.call?.id;
    await engine.receive({ call_id: 'another', sender_id: peer.id, kind: 'offer', payload: { type: 'offer', sdp: 'sdp' } });
    expect(deps.send).toHaveBeenCalledWith(peer.id, 'another', 'busy'); expect(engine.call?.id).toBe(id); engine.dispose();
  });
  it('handles microphone denial and unsupported browsers without creating a peer', async () => {
    const { engine, deps, media } = setup(); media.mockRejectedValue(new DOMException('Denied', 'NotAllowedError')); await engine.start(peer);
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining('permission was denied')); expect(pcs).toHaveLength(0); engine.dispose();
    const other = setup(); vi.stubGlobal('RTCPeerConnection', undefined); await other.engine.start(peer);
    expect(other.deps.error).toHaveBeenCalledWith(expect.stringContaining('not supported')); other.engine.dispose();
  });
  it('stops a delayed microphone stream if hangup happened during permission prompt', async () => {
    const { engine, media, stream, track } = setup(); let resolve: ((value: unknown) => void) | undefined;
    media.mockReturnValue(new Promise(r => { resolve = r; })); const starting = engine.start(peer);
    await Promise.resolve(); engine.end(); resolve?.(stream); await starting;
    expect(track.stop).toHaveBeenCalledTimes(1); expect(pcs).toHaveLength(0); engine.dispose();
  });
  it.each(['ended', 'rejected', 'busy'] as const)('handles remote %s and ignores other call IDs', async kind => {
    const { engine, track } = setup(); await engine.start(peer); const id = engine.call?.id;
    if (!id) throw new Error('missing call');
    await engine.receive({ call_id: 'wrong', sender_id: peer.id, kind, payload: {} }); expect(engine.call?.state).toBe('calling');
    await engine.receive({ call_id: id, sender_id: peer.id, kind, payload: {} }); expect(engine.call?.state).toBe(kind); expect(track.stop).toHaveBeenCalledTimes(1); engine.dispose();
  });
});