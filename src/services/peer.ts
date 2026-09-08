// PeerJS 기반 WebRTC 음성 통화 래퍼
//
// - 각 사용자에게 고유 Peer ID를 할당하고 무료 공용 PeerServer 브로커를 통해 신호 교환
// - 실제 음성 스트림은 P2P (STUN)로 전달 → 유심 없이 데이터/와이파이만으로 통화
// - onIncoming 콜백으로 UI 레이어(수신벨/진동/알람)를 트리거

import Peer, { MediaConnection } from 'peerjs';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'active' | 'ended';

export interface IncomingCallInfo {
  fromId: string;
}

type Listeners = {
  onReady?: (id: string) => void;
  onIncoming?: (info: IncomingCallInfo) => void;
  onCallEnded?: () => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onError?: (err: Error) => void;
};

class PeerService {
  private peer: Peer | null = null;
  private currentCall: MediaConnection | null = null;
  private pendingIncoming: MediaConnection | null = null;
  private localStream: MediaStream | null = null;
  private listeners: Listeners = {};
  private muted = false;

  init(peerId: string, listeners: Listeners) {
    if (this.peer && this.peer.id === peerId && !this.peer.destroyed) {
      this.listeners = listeners;
      if (this.peer.open) listeners.onReady?.(peerId);
      return;
    }
    this.dispose();
    this.listeners = listeners;

    // 자체 브로커가 설정돼 있으면 우선 사용, 아니면 공용 브로커.
    const customHost = import.meta.env.VITE_PEER_HOST as string | undefined;
    const peerOpts: ConstructorParameters<typeof Peer>[1] = {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    };
    if (customHost) {
      peerOpts.host = customHost;
      peerOpts.port = Number(import.meta.env.VITE_PEER_PORT ?? 443);
      peerOpts.path = (import.meta.env.VITE_PEER_PATH as string) || '/';
      peerOpts.secure = String(import.meta.env.VITE_PEER_SECURE ?? 'true') === 'true';
    }
    const peer = new Peer(peerId, peerOpts);

    peer.on('open', (id) => this.listeners.onReady?.(id));
    peer.on('error', (err) => this.listeners.onError?.(err as Error));
    peer.on('disconnected', () => {
      try { peer.reconnect(); } catch { /* noop */ }
    });

    peer.on('call', (call) => {
      // 다른 통화가 이미 진행 중이면 즉시 거절
      if (this.currentCall || this.pendingIncoming) {
        try { call.close(); } catch { /* noop */ }
        return;
      }
      this.pendingIncoming = call;
      call.on('close', () => {
        if (this.pendingIncoming === call) {
          this.pendingIncoming = null;
          this.listeners.onCallEnded?.();
        }
      });
      this.listeners.onIncoming?.({ fromId: call.peer });
    });

    this.peer = peer;
  }

  get id(): string | null {
    return this.peer?.id ?? null;
  }

  get isReady(): boolean {
    return !!this.peer && this.peer.open;
  }

  async call(remoteId: string): Promise<void> {
    if (!this.peer) throw new Error('연결이 초기화되지 않았습니다.');
    if (this.currentCall) throw new Error('이미 통화중입니다.');
    const stream = await this.getLocalStream();
    const call = this.peer.call(remoteId, stream);
    if (!call) throw new Error('통화를 시작할 수 없습니다.');
    this.attachCall(call);
  }

  async answerIncoming(): Promise<void> {
    const call = this.pendingIncoming;
    if (!call) return;
    this.pendingIncoming = null;
    const stream = await this.getLocalStream();
    call.answer(stream);
    this.attachCall(call);
  }

  rejectIncoming() {
    if (this.pendingIncoming) {
      try { this.pendingIncoming.close(); } catch { /* noop */ }
      this.pendingIncoming = null;
    }
  }

  hangup() {
    if (this.currentCall) {
      try { this.currentCall.close(); } catch { /* noop */ }
    }
    if (this.pendingIncoming) {
      try { this.pendingIncoming.close(); } catch { /* noop */ }
      this.pendingIncoming = null;
    }
    this.cleanupCall();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    return this.muted;
  }

  isMuted() { return this.muted; }

  private attachCall(call: MediaConnection) {
    this.currentCall = call;
    call.on('stream', (remoteStream) => {
      this.listeners.onRemoteStream?.(remoteStream);
    });
    call.on('close', () => {
      this.cleanupCall();
      this.listeners.onCallEnded?.();
    });
    call.on('error', (err) => {
      this.listeners.onError?.(err as Error);
      this.cleanupCall();
      this.listeners.onCallEnded?.();
    });
  }

  private cleanupCall() {
    this.currentCall = null;
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.muted = false;
  }

  private async getLocalStream(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    this.localStream = stream;
    return stream;
  }

  dispose() {
    this.cleanupCall();
    if (this.peer) {
      try { this.peer.destroy(); } catch { /* noop */ }
      this.peer = null;
    }
  }
}

export const peerService = new PeerService();
