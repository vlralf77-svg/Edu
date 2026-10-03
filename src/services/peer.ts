// PeerJS 기반 WebRTC 음성 통화 래퍼
//
// - 각 사용자에게 고유 Peer ID를 할당하고 공용 PeerServer 브로커를 통해 신호 교환
// - 실제 음성 스트림은 P2P (STUN + TURN) 로 전달 → 유심 없이 데이터/와이파이만으로 통화
// - 모바일 통신사 대칭형 NAT 뒤에서도 뚫리도록 TURN 서버 포함

import Peer, { MediaConnection } from 'peerjs';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'active' | 'ended';

export interface IncomingCallInfo {
  fromId: string;
}

export interface FriendlyError extends Error {
  code?: string;
}

type Listeners = {
  onReady?: (id: string) => void;
  onIncoming?: (info: IncomingCallInfo) => void;
  onCallEnded?: () => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onError?: (err: FriendlyError) => void;
  onStatus?: (msg: string) => void;
};

// PeerJS err.type → 한글 메시지
function friendlyMessage(err: any): string {
  const t = err?.type ?? err?.code ?? '';
  switch (t) {
    case 'peer-unavailable':
      return '상대방이 지금 접속해 있지 않아요. 가족에게 앱을 열어달라고 해주세요.';
    case 'network':
      return '네트워크 연결을 확인해 주세요. (Wi-Fi 또는 데이터)';
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return '시그널링 서버와 연결이 끊어졌어요. 잠시 후 다시 시도해 주세요.';
    case 'disconnected':
      return '서버 연결이 끊어졌어요. 자동 재연결을 시도합니다.';
    case 'browser-incompatible':
      return '이 브라우저/기기에서는 통화를 지원하지 않아요.';
    case 'unavailable-id':
      return '내 ID 가 이미 사용 중이에요. 앱을 재시작해 보세요.';
    case 'ssl-unavailable':
      return 'HTTPS 연결이 필요합니다.';
    case 'webrtc':
      return 'WebRTC 연결 오류입니다.';
    default:
      return err?.message || '알 수 없는 오류가 발생했어요.';
  }
}

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
      debug: 2,
      config: {
        iceServers: [
          // 공용 STUN
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          // 공용 TURN (openrelay) — 모바일 통신사 NAT 뒤에서도 중계
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      },
    };
    if (customHost) {
      peerOpts.host = customHost;
      peerOpts.port = Number(import.meta.env.VITE_PEER_PORT ?? 443);
      peerOpts.path = (import.meta.env.VITE_PEER_PATH as string) || '/';
      peerOpts.secure = String(import.meta.env.VITE_PEER_SECURE ?? 'true') === 'true';
    }

    this.listeners.onStatus?.('시그널링 서버에 연결 중…');
    const peer = new Peer(peerId, peerOpts);

    peer.on('open', (id) => {
      this.listeners.onStatus?.('온라인');
      this.listeners.onReady?.(id);
    });
    peer.on('error', (err: any) => {
      const e: FriendlyError = new Error(friendlyMessage(err));
      e.code = err?.type || err?.code;
      // peer-unavailable 류 에러는 "통화 실패"로 처리하고 세션은 유지
      this.listeners.onError?.(e);
      if (err?.type === 'peer-unavailable') {
        this.cleanupCall();
        this.listeners.onCallEnded?.();
      }
    });
    peer.on('disconnected', () => {
      this.listeners.onStatus?.('재연결 중…');
      try { peer.reconnect(); } catch { /* noop */ }
    });

    peer.on('call', (call) => {
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
    if (!this.peer) throw new Error('연결이 초기화되지 않았습니다. 잠시 후 다시 시도해 주세요.');
    if (!this.peer.open) throw new Error('아직 시그널링 서버에 연결 중이에요. 몇 초 뒤 다시 시도해 주세요.');
    if (this.currentCall) throw new Error('이미 통화중입니다.');

    let stream: MediaStream;
    try {
      stream = await this.getLocalStream();
    } catch (e: any) {
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        throw new Error('마이크 권한이 거부되었어요. 설정에서 마이크 권한을 허용해 주세요.');
      }
      if (e?.name === 'NotFoundError') {
        throw new Error('마이크를 찾을 수 없어요.');
      }
      throw new Error('마이크를 열 수 없어요: ' + (e?.message || e));
    }

    const call = this.peer.call(remoteId, stream);
    if (!call) throw new Error('통화를 시작할 수 없습니다. 상대방 ID 를 확인해 주세요.');
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
    call.on('error', (err: any) => {
      const e: FriendlyError = new Error(friendlyMessage(err));
      e.code = err?.type || err?.code;
      this.listeners.onError?.(e);
      this.cleanupCall();
      this.listeners.onCallEnded?.();
    });

    // 60초 안에 remote stream 이 안 오면 "연결 실패"로 자동 종료
    const guard = setTimeout(() => {
      if (this.currentCall === call) {
        this.listeners.onError?.(Object.assign(new Error(
          '상대방과 연결되지 않았어요. 네트워크 상태나 상대방 접속 여부를 확인해 주세요.',
        ), { code: 'timeout' }) as FriendlyError);
        try { call.close(); } catch { /* noop */ }
      }
    }, 60_000);
    call.on('stream', () => clearTimeout(guard));
    call.on('close', () => clearTimeout(guard));
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
