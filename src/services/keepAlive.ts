// 네이티브 KeepAlive 플러그인 브리지.
// - 웹 환경(브라우저)에서는 no-op.
// - Android 에서는 포어그라운드 서비스로 앱 프로세스를 유지시켜
//   가족의 전화가 백그라운드에서도 도달하도록 한다.

import { registerPlugin } from '@capacitor/core';

interface KeepAlivePlugin {
  enable(): Promise<{ enabled: boolean }>;
  disable(): Promise<{ enabled: boolean }>;
  isEnabled(): Promise<{ enabled: boolean }>;
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
}

const KeepAlive = registerPlugin<KeepAlivePlugin>('KeepAlive');

function isNative(): boolean {
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!w.Capacitor?.isNativePlatform?.();
}

export async function isStandbyEnabled(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { enabled } = await KeepAlive.isEnabled();
    return enabled;
  } catch {
    return false;
  }
}

export async function enableStandby(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { enabled } = await KeepAlive.enable();
    return enabled;
  } catch {
    return false;
  }
}

export async function disableStandby(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await KeepAlive.disable();
    return true;
  } catch {
    return false;
  }
}

export async function isBatteryOptimized(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { ignoring } = await KeepAlive.isIgnoringBatteryOptimizations();
    return !ignoring; // "최적화되고 있음" = 아직 예외가 아님
  } catch {
    return false;
  }
}

export async function requestBatteryOptExemption(): Promise<void> {
  if (!isNative()) return;
  try { await KeepAlive.requestIgnoreBatteryOptimizations(); } catch { /* noop */ }
}

export function supportsStandby(): boolean {
  return isNative();
}
