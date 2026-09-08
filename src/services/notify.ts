// 진동·알림·링톤 통합 유틸
//
// 웹: Vibration API + Notifications API + WebAudio 합성 벨소리
// Capacitor 네이티브: Haptics · LocalNotifications 사용 (동적 import)

let vibrateTimer: number | null = null;
let ringOsc: OscillatorNode | null = null;
let ringGain: GainNode | null = null;
let ringCtx: AudioContext | null = null;
let ringInterval: number | null = null;

const isNative = () => {
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!w.Capacitor?.isNativePlatform?.();
};

export async function requestNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch { /* noop */ }
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.requestPermissions();
    }
  } catch { /* noop */ }
}

export async function showIncomingNotification(fromName: string) {
  const title = '가족 전화';
  const body = `${fromName} 님이 전화 중입니다`;
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1001,
            title,
            body,
            sound: undefined,
            smallIcon: 'ic_stat_icon_config_sample',
            ongoing: true,
          },
        ],
      });
      return;
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'family-call-incoming', requireInteraction: true });
    }
  } catch { /* noop */ }
}

export async function clearIncomingNotification() {
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
    }
  } catch { /* noop */ }
}

/** 진동 시작 (수신벨과 함께 지속) */
export function startVibration() {
  stopVibration();
  const pattern = [600, 400, 600, 400]; // 짧은 반복
  const runPattern = () => {
    try {
      if (isNative()) {
        import('@capacitor/haptics').then(({ Haptics }) => {
          Haptics.vibrate({ duration: 600 }).catch(() => { /* noop */ });
        });
      } else if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch { /* noop */ }
  };
  runPattern();
  vibrateTimer = window.setInterval(runPattern, 1600);
}

export function stopVibration() {
  if (vibrateTimer !== null) {
    clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  try {
    if (!isNative() && 'vibrate' in navigator) navigator.vibrate(0);
  } catch { /* noop */ }
}

/** 짧은 햅틱 (버튼 눌렀을 때 등) */
export async function tapHaptic() {
  try {
    if (isNative()) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  } catch { /* noop */ }
}

/** 수신 벨소리 시작 (합성음) */
export function startRingtone() {
  stopRingtone();
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ringCtx = ctx;
    const play = () => {
      if (!ringCtx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
      ringOsc = osc;
      ringGain = gain;
    };
    play();
    ringInterval = window.setInterval(play, 1200);
  } catch { /* noop */ }
}

export function stopRingtone() {
  if (ringInterval !== null) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  try { ringOsc?.stop(); } catch { /* noop */ }
  try { ringGain?.disconnect(); } catch { /* noop */ }
  try { ringCtx?.close(); } catch { /* noop */ }
  ringOsc = null;
  ringGain = null;
  ringCtx = null;
}

/** 발신 중 뚜~뚜~ 톤 */
let outCtx: AudioContext | null = null;
let outInterval: number | null = null;

export function startOutgoingTone() {
  stopOutgoingTone();
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    outCtx = ctx;
    const beep = () => {
      if (!outCtx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    };
    beep();
    outInterval = window.setInterval(beep, 2500);
  } catch { /* noop */ }
}

export function stopOutgoingTone() {
  if (outInterval !== null) {
    clearInterval(outInterval);
    outInterval = null;
  }
  try { outCtx?.close(); } catch { /* noop */ }
  outCtx = null;
}
