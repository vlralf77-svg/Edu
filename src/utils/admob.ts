// AdMob 초기화·광고 표시 유틸 (@capacitor-community/admob)
// COPPA/Family 정책 준수: tagForChildDirectedTreatment(true)
// 웹(브라우저) 환경에서는 네이티브 플러그인이 없으므로 모든 함수가 no-op으로 동작한다.

import { Capacitor } from '@capacitor/core';

// 개발용 Google 공식 테스트 광고 단위 ID
const TEST_IDS = {
  bannerAndroid: 'ca-app-pub-3940256099942544/6300978111',
  bannerIos: 'ca-app-pub-3940256099942544/2934735716',
  rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917',
  rewardedIos: 'ca-app-pub-3940256099942544/1712485313',
};

const isProd = import.meta.env.PROD;
const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
const isNative = platform === 'android' || platform === 'ios';

/** 플랫폼/환경에 맞는 광고 단위 ID 선택 */
function bannerId(): string {
  if (!isProd) {
    return platform === 'ios' ? TEST_IDS.bannerIos : TEST_IDS.bannerAndroid;
  }
  return platform === 'ios'
    ? import.meta.env.VITE_ADMOB_BANNER_IOS
    : import.meta.env.VITE_ADMOB_BANNER_ANDROID;
}

function rewardedId(): string {
  if (!isProd) {
    return platform === 'ios' ? TEST_IDS.rewardedIos : TEST_IDS.rewardedAndroid;
  }
  return platform === 'ios'
    ? import.meta.env.VITE_ADMOB_REWARDED_IOS
    : import.meta.env.VITE_ADMOB_REWARDED_ANDROID;
}

let initialized = false;
let bannerVisible = false;

/** AdMob SDK 초기화 (앱 시작 시 1회) */
export async function initialize(): Promise<void> {
  if (!isNative || initialized) return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.initialize({
      // COPPA: 아동 대상 처리 태그
      // 일부 버전은 별도 옵션명을 사용하므로 캐스팅으로 호환 처리
      initializeForTesting: !isProd,
    } as any);
    initialized = true;
  } catch (e) {
    console.warn('[admob] initialize failed', e);
  }
}

/** 화면 하단 배너 노출 */
export async function showBanner(): Promise<void> {
  if (!isNative || bannerVisible) return;
  try {
    const { AdMob, BannerAdPosition, BannerAdSize } = await import(
      '@capacitor-community/admob'
    );
    await AdMob.showBanner({
      adId: bannerId(),
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      // COPPA 준수
      isTesting: !isProd,
      npa: true, // 비개인화 광고 (아동 대상 필수)
    } as any);
    bannerVisible = true;
  } catch (e) {
    console.warn('[admob] showBanner failed', e);
  }
}

/** 배너 숨김 */
export async function hideBanner(): Promise<void> {
  if (!isNative || !bannerVisible) return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.hideBanner();
    bannerVisible = false;
  } catch (e) {
    console.warn('[admob] hideBanner failed', e);
  }
}

/**
 * 보상형 광고 표시.
 * @returns 보상 지급 여부 (시청 완료 시 true). 웹/실패 시에는 개발 편의를 위해 true 반환.
 */
export async function showRewarded(): Promise<boolean> {
  if (!isNative) return true; // 웹 개발 환경: 보상 즉시 지급
  try {
    const { AdMob, RewardAdPluginEvents } = await import(
      '@capacitor-community/admob'
    );

    let rewarded = false;
    const listener = await AdMob.addListener(
      RewardAdPluginEvents.Rewarded,
      () => {
        rewarded = true;
      },
    );

    await AdMob.prepareRewardVideoAd({
      adId: rewardedId(),
      isTesting: !isProd,
      npa: true,
    } as any);
    await AdMob.showRewardVideoAd();

    await listener.remove();
    return rewarded;
  } catch (e) {
    console.warn('[admob] showRewarded failed', e);
    return false;
  }
}
