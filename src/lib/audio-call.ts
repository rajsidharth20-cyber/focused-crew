export type CallState = 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'busy';
export type CallPeer = { id: string; full_name: string | null; username: string | null; avatar_url: string | null };
export type SignalKind = 'offer' | 'answer' | 'ice' | 'ringing' | 'ended' | 'rejected' | 'busy';
export type CallSignal = { call_id: string; sender_id: string; kind: SignalKind; payload: Record<string, unknown> };
export type AudioCall = { id: string; peer: CallPeer; state: CallState; incoming: boolean; muted: boolean; connectedAt?: number };
type Dependencies = {
  send: (peer: string, id: string, kind: SignalKind, payload?: Record<string, unknown>) => Promise<void>;
  profile: (id: string) => Promise<CallPeer>;
  allowed: (id: string) => Promise<boolean>;
  change: (call: AudioCall | null) => void;
  error: (message: string) => void;
  remote: (stream: MediaStream | null) => void;
};
export const AUDIO_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
export function microphoneError(error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone permission was denied. Allow microphone access in your browser settings and try again.';
  if (name === 'NotFoundError') return 'No microphone was found. Connect a microphone and try again.';
  if (name === 'NotReadableError') return 'Your microphone is in use or unavailable. Close other calls and try again.';
  return error instanceof Error ? error.message : 'Could not start the audio call. Please try again.';
}

/** One live call owns all media, timeouts and ordered remote ICE candidates. */
export class AudioCallController {
  call: AudioCall | null = null;
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private offer: RTCSessionDescriptionInit | null = null;
  private candidates: RTCIceCandidateInit[] = [];
  private outgoing: RTCIceCandidateInit[] = [];
  private descriptionSent = false;
  private sendQueue = Promise.resolve();
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private disconnect: ReturnType<typeof setTimeout> | undefined;
  private clearTimer: ReturnType<typeof setTimeout> | undefined;
  private queue = Promise.resolve();
  private disposed = false;
  constructor(private deps: Dependencies) {}
  private update(patch: Partial<AudioCall>) {
    if (!this.call || this.disposed) return;
    this.call = { ...this.call, ...patch }; this.deps.change(this.call);
  }
  private live(id: string) { return !this.disposed && this.call?.id === id && ['calling', 'ringing', 'connected'].includes(this.call.state); }
  private async signal(kind: SignalKind, payload: Record<string, unknown> = {}) {
    const call = this.call;
    if (call) await this.deps.send(call.peer.id, call.id, kind, payload);
  }
  private deadline() {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => { this.deps.error('The call could not connect. Your friend may be offline or this network may block direct calls.'); this.end(); }, 45000);
  }
  private async microphone(id: string) {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') throw new Error('Audio calls are not supported in this browser. Use a recent browser with microphone access.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (!this.live(id)) { stream.getTracks().forEach(track => track.stop()); return null; }
    this.stream = stream; return stream;
  }
  private connection(id: string, stream: MediaStream) {
    const pc = new RTCPeerConnection({ iceServers: AUDIO_ICE_SERVERS });
    this.pc = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = event => {
      if (!event.candidate || !this.live(id)) return;
      this.outgoing.push(event.candidate.toJSON());
      if (this.descriptionSent) this.sendCandidates(id);
    };
    pc.ontrack = event => {
      if (this.live(id)) this.deps.remote(event.streams[0] ?? new MediaStream([event.track]));
    };
    pc.onconnectionstatechange = () => {
      if (!this.live(id)) return;
      if (pc.connectionState === 'connected') {
        clearTimeout(this.timeout); clearTimeout(this.disconnect);
        this.update({ state: 'connected', connectedAt: this.call?.connectedAt ?? Date.now() });
      } else if (pc.connectionState === 'failed') {
        this.deps.error('This network could not connect the audio call. Try a different network.'); this.end();
      } else if (pc.connectionState === 'disconnected') {
        clearTimeout(this.disconnect); this.disconnect = setTimeout(() => this.end(), 10000);
      }
    };
    return pc;
  }
  async start(peer: CallPeer) {
    if (this.call) { this.deps.error('Finish your current call first.'); return; }
    const id = crypto.randomUUID();
    this.call = { id, peer, state: 'calling', incoming: false, muted: false }; this.deps.change(this.call); this.deadline();
    try {
      if (!await this.deps.allowed(peer.id)) throw new Error('Audio calls are available only between friends.');
      if (!this.live(id)) return;
      const stream = await this.microphone(id); if (!stream) return;
      const pc = this.connection(id, stream);
      await pc.setLocalDescription(await pc.createOffer());
      if (this.live(id)) {
        await this.signal('offer', { type: 'offer', sdp: pc.localDescription?.sdp });
        if (this.live(id)) { this.descriptionSent = true; this.sendCandidates(id); }
      }
    } catch (error) { if (this.live(id)) { this.deps.error(microphoneError(error)); this.end(); } }
  }
  receive(signal: CallSignal) {
    this.queue = this.queue.then(() => this.process(signal)).catch(() => {
      if (!this.disposed) { this.deps.error('Could not connect the call. Please try again.'); this.end(); }
    });
    return this.queue;
  }
  private async process(signal: CallSignal) {
    if (this.disposed) return;
    if (signal.kind === 'offer') {
      if (this.call) {
        if (this.call.id !== signal.call_id) await this.deps.send(signal.sender_id, signal.call_id, 'busy');
        return;
      }
      if (!await this.deps.allowed(signal.sender_id)) return;
      const peer = await this.deps.profile(signal.sender_id);
      if (this.disposed) return;
      // A local start may have won the race while the profile was loading.
      if (this.call) { await this.deps.send(signal.sender_id, signal.call_id, 'busy'); return; }
      if (signal.payload.type !== 'offer' || typeof signal.payload.sdp !== 'string') return;
      this.offer = { type: 'offer', sdp: signal.payload.sdp };
      this.call = { id: signal.call_id, peer, state: 'ringing', incoming: true, muted: false };
      this.deps.change(this.call); this.deadline(); await this.signal('ringing'); return;
    }
    if (!this.call || this.call.id !== signal.call_id || this.call.peer.id !== signal.sender_id || !this.live(signal.call_id)) return;
    if (signal.kind === 'ringing' && !this.call.incoming && this.call.state === 'calling') this.update({ state: 'ringing' });
    if (['ended', 'rejected', 'busy'].includes(signal.kind)) { this.finish(signal.kind as CallState); return; }
    if (signal.kind === 'ice') {
      const candidate = signal.payload as RTCIceCandidateInit;
      if (this.pc?.remoteDescription) await this.pc.addIceCandidate(candidate);
      else if (this.candidates.length < 100) this.candidates.push(candidate);
    }
    if (signal.kind === 'answer' && !this.call.incoming && this.pc && !this.pc.remoteDescription) {
      if (signal.payload.type !== 'answer' || typeof signal.payload.sdp !== 'string') return;
      await this.pc.setRemoteDescription({ type: 'answer', sdp: signal.payload.sdp });
      await this.flush(this.pc);
    }
  }
  private async flush(pc: RTCPeerConnection) {
    const pending = this.candidates; this.candidates = [];
    for (const candidate of pending) { if (this.pc !== pc) return; await pc.addIceCandidate(candidate); }
  }
  private sendCandidates(id: string) {
    const pending = this.outgoing; this.outgoing = [];
    for (const candidate of pending) {
      this.sendQueue = this.sendQueue.then(async () => {
        if (this.live(id)) await this.signal('ice', candidate as unknown as Record<string, unknown>);
      }).catch(() => {
        if (this.live(id)) { this.deps.error('Call connection was interrupted. Please try again.'); this.end(); }
      });
    }
  }
  async accept() {
    const call = this.call; const offer = this.offer;
    if (!call?.incoming || call.state !== 'ringing' || !offer) return;
    this.update({ state: 'calling' });
    try {
      const stream = await this.microphone(call.id); if (!stream) return;
      const pc = this.connection(call.id, stream);
      await pc.setRemoteDescription(offer); await this.flush(pc);
      await pc.setLocalDescription(await pc.createAnswer());
      if (this.live(call.id)) {
        await this.signal('answer', { type: 'answer', sdp: pc.localDescription?.sdp });
        if (this.live(call.id)) { this.descriptionSent = true; this.sendCandidates(call.id); }
      }
    } catch (error) { if (this.live(call.id)) { this.deps.error(microphoneError(error)); this.end(); } }
  }
  mute() {
    if (!this.stream || !this.call) return;
    const muted = !this.call.muted;
    this.stream.getAudioTracks().forEach(track => { track.enabled = !muted; }); this.update({ muted });
  }
  end(reject = false) {
    if (!this.call) return;
    void this.signal(reject ? 'rejected' : 'ended').catch(() => {});
    this.finish(reject ? 'rejected' : 'ended');
  }
  private release() {
    clearTimeout(this.timeout); clearTimeout(this.disconnect);
    if (this.pc) { this.pc.ontrack = null; this.pc.onicecandidate = null; this.pc.onconnectionstatechange = null; this.pc.close(); this.pc = null; }
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.candidates = []; this.outgoing = []; this.descriptionSent = false; this.offer = null; this.deps.remote(null);
  }
  private finish(state: CallState) {
    this.release(); this.update({ state });
    clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => { this.call = null; if (!this.disposed) this.deps.change(null); }, 2000);
  }
  dispose() {
    if (this.call && this.live(this.call.id)) void this.signal('ended').catch(() => {});
    this.disposed = true; this.release(); clearTimeout(this.clearTimer); this.call = null;
  }
}