# 모바일 빌드 & 스토어 등록 가이드

FitLog 를 Android AAB/APK 로 빌드하고 스토어에 등록하기 위한 절차입니다.

## 1. Capacitor 네이티브 프로젝트 추가

`android` / `ios` 폴더는 `.gitignore` 처리되어 있으므로 최초 1회 생성이 필요합니다.

```bash
# 웹 빌드 + 네이티브 동기화
npm run build
npx cap add android      # 최초 1회
npx cap sync             # 이후 빌드마다
npx cap open android     # Android Studio 실행
```

iOS 도 동일 (`npx cap add ios` → `npx cap open ios`, macOS + Xcode 필요).

## 2. 앱 아이콘 / 스플래시 이미지

`@capacitor/assets` 로 한 번에 생성합니다.

```bash
# resources/icon.png (1024x1024), resources/splash.png (2732x2732) 준비 후
npx capacitor-assets generate
```

`capacitor.config.ts` 의 SplashScreen 배경은 `#0F1621` (다크 네이비)로 설정되어 있습니다.

## 3. 퍼미션 (Android)

MVP 는 로컬 저장(localStorage)만 사용하므로 필수 퍼미션은 없습니다. 향후 확장 시:

- 카메라 (기구 스캐너, 눈바디 사진): `android.permission.CAMERA`
- 알림 (휴식 타이머 백그라운드): `android.permission.POST_NOTIFICATIONS` (API 33+)
- 스마트워치 연동은 별도 플러그인 필요.

## 4. 서명 키 & 릴리스 빌드

```bash
keytool -genkey -v -keystore fitlog.keystore -alias fitlog \
  -keyalg RSA -keysize 2048 -validity 10000
```

Android Studio → Build → Generate Signed Bundle / APK → **Android App Bundle (.aab)** 선택.

## 5. 스토어 등록 정보 (예시)

- **앱 이름**: FitLog — 헬스 운동 기록·분석
- **짧은 설명**: 10초 만에 세트 하나. 1RM 강도 색상, 볼륨 추이, 부위 균형까지.
- **카테고리**: 건강 및 피트니스
- **개인정보처리방침**: 체중·체지방 등 건강 정보 처리 안내 필수 (WBS 10.1)
