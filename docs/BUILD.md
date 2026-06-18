# 모바일 빌드 & Google Play 등록 가이드

TinyLearn을 Android APK/AAB로 빌드하고 Google Play에 등록하기 위한 절차입니다.

## 1. Capacitor 네이티브 프로젝트 추가

`android` / `ios` 폴더는 `.gitignore` 처리되어 있으므로 최초 1회 생성이 필요합니다.

```bash
# 웹 빌드 + 네이티브 동기화
npm run build
npx cap add android      # 최초 1회
npx cap sync             # 이후 빌드마다
npx cap open android     # Android Studio 실행
```

iOS도 동일합니다 (`npx cap add ios` → `npx cap open ios`, macOS + Xcode 필요).

## 2. 앱 아이콘 / 스플래시 이미지

`@capacitor/assets` 로 한 번에 생성하는 것을 권장합니다.

```bash
npm i -D @capacitor/assets
# resources/icon.png (1024x1024), resources/splash.png (2732x2732) 준비 후
npx capacitor-assets generate
```

`capacitor.config.ts` 의 SplashScreen 색상은 `#7F77DD` (퍼플)로 설정되어 있습니다.

## 3. AdMob 네이티브 설정

### Android — `android/app/src/main/AndroidManifest.xml`

`<application>` 안에 AdMob 앱 ID 메타데이터를 추가합니다.

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"/>
```

퍼미션은 `INTERNET` 만 필요합니다 (광고 로딩). 위치/저장소 등 불필요한 퍼미션은 추가하지 마세요.

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

### iOS — `ios/App/App/Info.plist`

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX</string>
```

### Family 정책 (COPPA)

- 코드에서 `AdMob.initialize` 시 비개인화 광고(`npa: true`)로 요청합니다 (`src/utils/admob.ts`).
- AdMob 콘솔에서 앱을 **"아동 대상(Child-directed)"** 으로 태그하세요.
- AdMob 콘솔 앱 카테고리를 **Family** 로 설정하세요.

> `google-services.json` (Firebase/AdMob 연동 시): `android/app/google-services.json` 위치에 배치합니다.
> AdMob만 사용한다면 위 `meta-data` AppID 등록만으로 충분하며 별도 파일은 필요 없을 수 있습니다.

## 4. 서명 키 생성 & 릴리스 빌드

```bash
keytool -genkey -v -keystore tinylearn.keystore -alias tinylearn \
  -keyalg RSA -keysize 2048 -validity 10000
```

Android Studio → Build → Generate Signed Bundle / APK → **Android App Bundle (.aab)** 선택 (Play 업로드는 AAB 권장).

## 5. Google Play Console 등록

1. 앱 만들기 → 앱 이름 **"TinyLearn — 유아 영어·색깔 놀이"**.
2. 카테고리: **교육** / **Family** (아동·가족용).
3. 콘텐츠 등급 설정 시 **만 5세 미만 포함** 으로 정확히 응답.
4. **타겟 고객 및 콘텐츠** 설문에서 아동 대상 앱으로 신고 → Families 정책 적용.
5. 데이터 보안 양식 작성 (수집 데이터: 광고용 식별자 등).
6. AAB 업로드 → 내부 테스트 → 프로덕션 단계적 출시.

## 6. 스토어 등록 정보

- **앱 이름**: TinyLearn — 유아 영어·색깔 놀이
- **짧은 설명**: 그림으로 배우는 영단어! 색깔·도형 퍼즐로 인지 발달까지.
- **전체 설명**:

```
TinyLearn은 2~8세 아이들을 위한 교육 게임 앱입니다.

[영단어 그림 매칭]
귀여운 그림 카드를 보고 영단어를 맞춰보세요.
터치 한 번으로 원어민 발음도 들을 수 있어요.

[색·도형 인지 퍼즐]
빨간 것을 골라요! 동그라미를 찾아요!
쉽고 재미있는 터치 놀이로 색깔·도형 개념을 익혀요.

[특징]
• 광고 없는 게임 플레이 화면
• 별 모으기 보상 시스템
• 오늘의 학습 기록 저장
• 3세도 혼자 할 수 있는 쉬운 조작
```

- **카테고리**: 교육 > 유아/아동
