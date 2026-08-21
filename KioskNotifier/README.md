# KioskNotifier

폐쇄망 병원에서 키오스크 도착 이벤트를 진료실 PC 우하단에 팝업으로 띄우는 프로그램.
작업지시서 사양에 맞춰 단일 exe 로 빌드되는 WPF 클라이언트와, 접수 API 에 얹는
Spring Boot 알림 컴포넌트로 구성된다.

```
KioskNotifier/
├─ client/     # .NET 8 WPF (single-file self-contained exe)
├─ server/     # Spring Boot 3.x 알림 컴포넌트 + Oracle DDL
└─ deploy/     # install.bat (%LOCALAPPDATA% 배포)
```

## 1. 산출물

빌드 후 얻는 파일:

- `KioskNotifier.exe` — 단일 실행 파일 (self-contained, .NET 런타임 불필요)
- `appsettings.json` — 서버 주소 · 전송 방식만 담고 있음
- `install.bat` — `%LOCALAPPDATA%\KioskNotifier` 로 복사 후 자동시작 등록

## 2. 클라이언트 빌드

### 2-1. GitHub Actions (권장)

폐쇄망이 아닌 환경에서 빌드해 exe 를 내려받는 것이 가장 쉬움.

- GitHub → Actions → **"KioskNotifier - Build Windows exe"** → Run workflow
- 완료 후 **Artifacts** 탭에서 `KioskNotifier-win-x64.zip` 다운로드
- 압축 안에 `KioskNotifier.exe` + `appsettings.json` + `install.bat` 이 들어있음

### 2-2. 로컬 Windows 에서 직접 빌드

```powershell
cd KioskNotifier\client
dotnet restore
dotnet build -c Debug
dotnet publish -c Release -r win-x64 `
  /p:PublishSingleFile=true /p:SelfContained=true `
  /p:IncludeNativeLibrariesForSelfExtract=true
```

산출물: `bin\Release\net8.0-windows\win-x64\publish\`

## 3. 진료실 PC 배포

1. `KioskNotifier.exe`, `appsettings.json`, `install.bat` 세 파일을 진료실 PC 로 반입
2. `appsettings.json` 의 `serverBaseUrl` 을 알림 서버 주소로 수정
3. `install.bat` 실행 → `%LOCALAPPDATA%\KioskNotifier` 로 설치되고 자동시작 등록
4. 트레이 아이콘 우클릭 → **설정** 에서 진료실 코드/이름/의사 지정

## 4. 서버 통합

기존 접수 API (Spring Boot) 에 아래 파일을 추가:

- `Notice.java`
- `NotifyRegistry.java`
- `NotifySocketConfig.java`
- `NotifyController.java`
- `NotifyAsyncConfig.java`
- `ArrivalNotifier.java`

Oracle DDL: `server/src/main/resources/schema.sql` 실행 (PC_ROOM_MAP, NOTIFY_QUEUE).

접수 로직에서 커밋 직전에 다음처럼 이벤트를 발행:

```java
arrivalNotifier.publish(new ArrivalNotifier.Event(
    roomCd, "ARRIVAL", patientNo, patientNm, doctorNm, null));
```

`@TransactionalEventListener(AFTER_COMMIT) + @Async("notifyExecutor")` 이므로
접수 트랜잭션이 롤백되면 알림도 발행되지 않음.

## 5. 테스트

### 5-1. 서버 없이 팝업만 확인

트레이 → **알림 미리보기**

### 5-2. curl 한 방으로 종단(end-to-end) 테스트 (권장)

접수 API 로직을 아직 안 붙였어도, `/api/notify/test-fire` 로 알림을 직접
쏴서 팝업까지 검증할 수 있음. 서버는 `NOTIFY_QUEUE` INSERT → WebSocket 푸시
전 경로를 그대로 탄다.

```bash
curl -X POST http://notify.hospital.local:8080/api/notify/test-fire \
  -H "Content-Type: application/json" \
  -d '{
    "roomCd":"R101",
    "msgType":"ARRIVAL",
    "patientNo":"12345678",
    "patientNm":"홍길동",
    "doctorNm":"김의사"
  }'
```

- 소켓 모드: 즉시 팝업
- 폴링 모드: 최대 `pollIntervalSeconds` (기본 2초) 내 팝업

`msgType` 값에 따라 팝업 색상이 바뀜: `ARRIVAL`(초록), `CALL`(파랑), `CANCEL`(주황).

> **운영 배포 전 잠금**: `application.yml` 에 `notify.testFire.enabled: false`
> 를 넣으면 이 엔드포인트가 403 을 반환한다. 또는 리버스 프록시에서
> `/api/notify/test-fire` 경로를 사내망 IP 로만 허용.

### 5-3. DB 직접 주입 (폴링 검증)

접수 이벤트 발행 없이 폴링 회수만 검증하고 싶을 때:

```sql
INSERT INTO NOTIFY_QUEUE (EVENT_ID, ROOM_CD, MSG_TYPE, PATIENT_NO, PATIENT_NM, CREATED_AT)
VALUES (SYS_GUID(), 'R101', 'ARRIVAL', '12345678', '홍길동', SYSTIMESTAMP);
```

폴링 모드 클라이언트는 2초 내 회수해서 팝업.

## 6. 설정 파일 (appsettings.json)

| 키 | 기본값 | 설명 |
|---|---|---|
| `serverBaseUrl` | `http://notify.hospital.local:8080` | 알림 서버 기본 URL |
| `transport` | `auto` | `auto` / `socket` / `poll` |
| `pollIntervalSeconds` | 2 | 폴링 간격 |
| `socketFailLimit` | 3 | WS 연속 실패 시 폴링 전환 |
| `reconnectDelaySeconds` | 5 | WS 재연결 지연 |
| `pendingLookbackMinutes` | 30 | pending 회수 창 |
| `toastDurationSeconds` | 12 | 팝업 유지 시간 |
| `maxVisibleToasts` | 4 | 동시 표시 최대 개수 |
| `autoStart` | true | HKCU\Run 자동시작 |

## 7. 확인 필요 항목

작업지시서 §9 참고. 확정되지 않은 항목:

- 이벤트 소스 확정 (접수 API 이벤트 vs 키오스크 SDK 콜백)
- 접수 API 런타임 (Spring Boot 단독 vs JEUS 위)
- 리버스 프록시 유무 (Nginx/Apache Upgrade 헤더)
- 진료실 코드 체계 (드롭다운 구성용 코드 테이블 여부)
- 코드 서명 인증서 (사내 CA)
- 알림 서버 배치 (접수 API 와 동일 프로세스 vs 분리)
