# 가족통화 — 데이터·와이파이 전용 가족 전화 앱

**유심(SIM) 없이** 데이터·와이파이만으로 등록된 가족과 무료 음성 통화를 할 수 있는 앱입니다.
전화가 오면 상대방 폰에서 **벨소리 + 진동 + 알림**이 함께 울립니다.

## 특징

- **가족 전용 통화**: 서로의 ID 를 등록한 가족만 전화를 걸고 받을 수 있어요. 모르는 사람의 전화는 자동 거절.
- **유심 불필요**: 실제 전화망을 쓰지 않고 WebRTC(P2P) 로 음성을 주고받아 데이터·Wi-Fi 만 있으면 통화 가능.
- **수신 시 알람 + 진동**: 벨소리(합성음), 반복 진동, 시스템 알림이 동시에 발생.
- **간단한 등록**: 앱 최초 실행 시 이름·호칭·이모지만 정하면 내 ID 발급 → 가족에게 공유 → 서로 등록.
- **깔끔한 통화 UI**: 발신·수신·통화중 상태별 화면, 음소거 · 통화 시간 표시 · 종료 버튼.

## 기술 스택

| 항목 | 기술 |
|---|---|
| 프론트엔드 | React + Vite + TypeScript + MUI |
| 상태 관리 | Zustand (persist → localStorage) |
| 음성 통화 | WebRTC (PeerJS) · 공용 PeerServer 브로커 |
| 알림/진동 | Web Notifications, Vibration API, Capacitor Haptics / LocalNotifications |
| 모바일 패키징 | Capacitor 6 (Android / iOS) |

## 아키텍처 개요

```
┌──────────────┐          시그널링(공용/자체 브로커)          ┌──────────────┐
│  내 폰(A)     │  ──────  offer / answer / ICE  ──────  →  │  가족 폰(B)   │
│  React + JS  │                                            │  React + JS  │
│  Peer(fam-…) │  ←────────  P2P 음성 스트림  ────────────→ │  Peer(fam-…) │
└──────────────┘                                            └──────────────┘
       │                                                            │
       ▼                                                            ▼
  Web Audio / Haptics                                       벨소리 + 진동 + 알림
```

- 앱을 처음 열면 자기 자신에게 고유 Peer ID (`fam-xxxxxxxx`) 가 발급되어 저장됩니다.
- 이 ID 를 가족에게 공유하면(복사/공유/QR), 상대방이 앱에서 등록.
- 전화 걸기 → PeerJS 미디어 콜 요청 → 상대방 앱에서 등록된 가족이면 수신 화면 + 벨/진동/알림.
- 응답하면 P2P 음성 스트림이 STUN 을 거쳐 연결됩니다.

## 폴더 구조

```
src/
├── App.tsx                 프로필 여부에 따라 Setup / 앱 라우팅
├── main.tsx
├── theme.ts
├── index.css
├── components/
│   └── CallProvider.tsx    Peer 초기화, 수신 처리, 라우팅
├── pages/
│   ├── Setup.tsx           최초 프로필 생성
│   ├── Home.tsx            가족 목록 + 전화 버튼
│   ├── Profile.tsx         내 ID / QR / 공유
│   ├── AddFamily.tsx       가족 ID 등록
│   └── Call.tsx            발신 / 수신 / 통화 화면
├── services/
│   ├── peer.ts             PeerJS(WebRTC) 래퍼
│   └── notify.ts           벨소리 · 진동 · 알림
└── store/
    ├── useAppStore.ts      프로필 · 가족 목록 (persist)
    └── useCallStore.ts     통화 상태
```

## 개발

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # dist/ 로 프로덕션 빌드
```

두 개의 브라우저 창(또는 두 대의 기기)에서 각각 열고,
서로의 ID 를 등록한 뒤 전화 버튼을 눌러 테스트할 수 있어요.

> 마이크 권한이 필요합니다. 웹에서는 HTTPS 또는 `localhost` 에서만 동작해요.

## 모바일 빌드 (Android)

```bash
npm run build
npx cap sync android
npm run cap:android   # Android Studio 실행
```

`AndroidManifest.xml` 에는 다음 권한이 이미 선언돼 있습니다:

- `INTERNET`, `ACCESS_NETWORK_STATE` — 신호/음성 트래픽
- `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` — 마이크
- `VIBRATE` — 수신 시 진동
- `POST_NOTIFICATIONS` — 수신 시 알림
- `WAKE_LOCK`, `FOREGROUND_SERVICE` — 통화 유지

## 자체 시그널링 브로커 (선택)

기본값은 PeerJS 공용 브로커(`0.peerjs.com`) 입니다. 자체 서버를 쓰려면 `.env` 를 만들어 다음 값을 설정하세요:

```env
VITE_PEER_HOST=peer.mydomain.com
VITE_PEER_PORT=443
VITE_PEER_PATH=/
VITE_PEER_SECURE=true
```

자체 브로커는 [`peer` npm 패키지](https://github.com/peers/peerjs-server) 로 몇 줄 만에 띄울 수 있습니다.

## 보안·개인정보 메모

- 서로 등록된 가족 사이에서만 통화가 성립합니다. 알 수 없는 Peer ID 로부터 걸려온 전화는 자동 거절됩니다.
- 음성은 P2P (WebRTC/SRTP) 로 종단 간 암호화되어 오갑니다. 시그널링 서버에는 오디오가 흐르지 않습니다.
- 공용 브로커는 접속을 도와주는 용도이며, 신뢰가 필요한 환경(회사·병원 등)에서는 자체 브로커 설치를 권장합니다.

## 라이선스

MIT.
