# 올잇 개발 인계

기준일 2026-11-27. 다음 개발자는 이 문서와 [Supabase 설정](SUPABASE_SETUP.md), [계정 및 Supabase 통합 검증](INTEGRATION_TEST_REPORT.md)을 먼저 읽는다.

## 최신 운영 방향

연결된 `Test Project`는 사용자 소유의 **개발·테스트 전용**이다. CLI 로그의 `production` 표시는 해당 개발 프로젝트의 기본 브랜치를 뜻한다. 출시팀은 자기 계정에 별도 프로젝트를 만들고 [출시 가이드](RELEASE_GUIDE.md)에 따라 초기화한다. 실제 프로젝트 ref는 연결할 환경의 Project URL에서 가져온다.

2026-11-27에 개발 프로젝트에 기존 SQL 3개를 적용했다. 적용 후 Dry Run의 대기 파일은 0개다. 앱 테이블과 정책, 사진 버킷과 Auth 트리거를 원격 카탈로그에서 확인했다. 출시팀은 `npm run setup:supabase`의 `release` 경로에서 자체 프로젝트를 지정한다.

## 현재 상태

올잇은 고령층, 특히 독거노인을 위한 일정·복약 관리와 돌봄 보조 앱이다. 허소윤의 Expo 앱을 기반으로 팀의 원본 구현을 로컬 `dev`에 통합했다. Android 네이티브 기능과 Supabase 연동 코드는 현재 로컬 작업 트리에 있다.

**개발용 Supabase에서 실제 저장 및 조회를 검증했다.** 독립 시험 계정 두 개의 JWT로 프로필, 설정, 보호자, 일정·완료, 대화와 비공개 JPEG를 왕복 검증했다. 다른 사용자의 데이터 조회와 변경 및 파일 접근 차단을 확인했고, 별도 시험 계정은 정리했다.

Android 에뮬레이터에서 알람, 사진, 연락처 및 MMS 작성 화면을 이전에 검증했다. 로컬 Android 회귀와 운영 Supabase 통합은 별도로 판단한다. Google·카카오 신규 가입을 양쪽에서 처음부터 재현하는 검사와 한국어 STT/TTS 실출력은 별도 검증이 필요하다. 개발 프로젝트의 실제 검증 범위는 [통합 검증 보고서](INTEGRATION_TEST_REPORT.md)에 있다.

## 작업 위치와 사용자 제약

| 항목 | 상태 |
| --- | --- |
| 작업 폴더 | `/home/james-kwon/Desktop/senior-app/dev` |
| 작업 브랜치 | 로컬 `dev`, HEAD `72895b5` — 지정한 아홉 원본 브랜치의 병합 커밋 |
| 바깥 워크트리 | `/home/james-kwon/Desktop/senior-app`의 `develop` (`996eb15`)에 별도 미커밋 작업이 있다. 다음 작업의 기반은 안쪽 `dev`다. |
| 현재 변경의 위치 | 네이티브·Supabase 구현, 문서와 테스트는 `dev`의 스테이징되지 않은 수정 및 추적되지 않은 파일에 있다. 같은 워크트리에서 이어서 작업한다. HEAD 체크아웃이나 새 클론만으로는 해당 파일이 따라오지 않는다. |
| 공개 클라이언트 설정 | `dev/weather-schedule-app/.env.local`에 기존 설정이 있다. Git ignore 적용 상태 확인 완료. 변수명은 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`다. |

- **원격 Git에 push하지 않는다.** 새 변경을 stage하거나 commit하지 않는다. 기존 원본 브랜치의 커밋과 작성 이력을 유지하고, 현재 미커밋 작업도 보존한다. `develop`은 통합 대상에서 제외됐다. Supabase CLI의 `db push`는 별도 운영 변경이며 사용자 승인 후에만 실행한다.
- 지금 목표는 기존 Supabase 연동의 운영 반영과 검증이다. 기존 UI, 캐릭터, 규칙 기반 대화 엔진과 Android 네이티브 동작을 그대로 활용한다. 사용자는 특히 달력 디자인을 허소윤 원본과 비교하며 검수했다.
- 운영 SQL 적용·함수 배포 전에 프로젝트 확인, 읽기 전용 조사, Dry Run 결과를 사용자에게 보고한다. 운영 변경은 그 뒤 사용자의 명시적 승인 범위에서 진행한다.
- 관리자 Access Token, DB 비밀번호, OAuth 비밀값, Service Role 키는 프론트엔드·APK·Git·채팅·인계문서에 넣지 않는다. RLS를 유지한다. 유료 옵션 활성화와 공개 Pages 배포는 별도 범위다.
- **Cloudflare AI와 RAG는 운영 Supabase 연동을 정상 검증한 뒤 진행**한다. 기존 Cloudflare 날씨 Worker는 이미 별개로 존재한다.

## 통합 출처와 코드 지도

원본 아홉 브랜치는 `origin/{김가은,문한나,허소윤}/{design,members,wireframe}`이다. 사용자 목록에 중복 기재된 김가은 브랜치는 한 번씩 반영됐다. `git log -1 --format='%h %s%n%P'`에서 아홉 부모를 확인할 수 있다.

| 출처 / 경로 | 확인할 내용 |
| --- | --- |
| `origin/허소윤/members` | Expo 앱 기반, 일정·달력·날씨. 일정 화면을 수정하기 전에 원본과 비교할 기준이다. |
| `origin/문한나/members` | 캐릭터, 대사 엔진, 녹음 음성과 이미지. 충돌했던 원본 `DialogueAvatar.tsx`는 `members/문한나/`에도 있다. |
| `origin/김가은/members` | 저장소 루트 웹 프로토타입과 사진 인증·음성 UI의 원본. `node serve.mjs`로 별도 열 수 있다. |
| `design/individual/<이름>/`, `wireframes/<이름>/` | 여섯 원본 디자인·와이어프레임과 경로가 충돌한 일부 자료. |
| `src/weather-schedule-app/` | 실제 통합 앱. Expo SDK 58, React Native Web과 Capacitor Android 8, Kotlin·Gradle, Supabase JS SDK. |
| `src/weather-schedule-app/src/features/account/` | `client.ts` 공개 설정·세션 어댑터, `oauth.ts` 및 `oauthCallback.ts` PKCE, `Account.tsx` 세션·온보딩·가져오기, `cloudSchedules.ts`, `cloudCare.ts`, `conversations.ts`, `legacyData.ts` 데이터 접근. |
| `src/weather-schedule-app/App.tsx`, `src/features/schedules/`, `src/screens/AndroidCareScreen.tsx` | 계정 상태별 진입, 기존 일정과 서버 동기화, 네이티브 알람·카메라·음성 연동 화면. |
| `src/weather-schedule-app/capacitor-android/app/src/main/java/com/allitcare/android/` | `AccountAccess.kt` Keystore·계정 범위·외부 브라우저, `AlarmScheduler.kt`·`AlarmService.kt`·`AlarmActivity.kt` 예약과 확인, `AllitPlugin.kt` OS 브리지, `PhotoFiles.kt` 사진 저장·공유. |
| `supabase/migrations/`, `supabase/functions/delete-account/index.ts`, `supabase/tests/` | 순서가 있는 SQL 3개, 계정 삭제 함수, PostgreSQL 정책 검증. |

Supabase는 로그인 계정 자료의 원본이다. 프로필·설정·일정·보호자·대화·사진 메타데이터는 PostgreSQL에, 사진 본체는 비공개 Storage에 둔다. 계정 UUID별 IndexedDB에 조회 캐시와 오프라인 완료·사진·대화 대기열을 남긴다. Android는 예약과 확인 동작을 자체 저장하고 AlarmManager로 실행한다. 기존 기기 데이터는 동의 후 같은 origin에서 감지된 일정·완료·보호자·확정 사진을 현재 계정으로 복사한다. 원본 보존과 중복 방지 규칙은 [데이터 구조](DATA_ARCHITECTURE.md)에 있다.

## 운영 Supabase에서 본 증거

`.env.local`의 Project URL, 빌드된 디버그 APK의 CSP 호스트, 실제 응답 헤더 `sb-project-ref`가 일치했다. 아래 404 응답은 초기화 전 진단 기록이다. 공개 키 값 자체는 인계할 필요가 없다.

| 읽기 전용 또는 로그인 시작 확인 | 실제 응답 |
| --- | --- |
| `GET /auth/v1/settings` | HTTP 200. Google, Kakao 모두 활성화. |
| PKCE `/auth/v1/authorize`, Google | HTTP 302 → `accounts.google.com`. 실제 scope `email profile`. |
| PKCE `/auth/v1/authorize`, 카카오 | HTTP 302 → `kauth.kakao.com`. 실제 scope `profile_image profile_nickname`. |
| `GET /rest/v1/profiles?select=user_id&limit=0` | HTTP 404, `PGRST205`. 본문 `Could not find the table 'public.profiles' in the schema cache`. |
| `GET /rest/v1/schedules?select=id&limit=0` | HTTP 404, `PGRST205`. 본문 `Could not find the table 'public.schedules' in the schema cache`. |
| `OPTIONS` 및 `GET /functions/v1/delete-account` | HTTP 404, `NOT_FOUND`. 본문 `Requested function was not found`. |
| 공개 GitHub Pages `https://soyun-h.github.io/senior-app/` | 이전 조회 HTTP 404. 로컬 정적 빌드는 통과했다. |

`PGRST205`는 해당 테이블이 Data API 스키마 캐시에 없다는 증거다. 테이블 자체가 미생성인지, 스키마 노출 또는 캐시 문제인지 운영 카탈로그와 마이그레이션 이력을 조회해 구분한다. 함수의 두 요청은 본문에 도달하기 전에 경로 등록이 확인되지 않았다. OAuth 302는 공급자 이동까지의 결과이며 실제 사용자 로그인과 앱 복귀는 별도 확인이 필요하다.

### OAuth에서 이미 해결한 문제

- Supabase 내장 카카오 공급자의 기본 권한에 `account_email`이 들어간다. SDK의 `scopes`는 기본 목록에 권한을 추가한다. 앱은 `queryParams.scope`로 `profile_nickname profile_image`를 지정한다. 실제 운영 302에서 해당 두 권한을 확인했다. Supabase의 **Allow users without an email**과 카카오 동의 화면은 실계정으로 확인할 항목이다.
- SDK의 로그인별 PKCE 키에 숫자가 포함되어 초기 Android Keystore 어댑터가 쓰기를 거부한 문제를 수정했다. `AccountAccess.kt`는 현재 SDK의 흐름별 키와 이전 키를 처리한다. 앱은 보관한 흐름 식별자로 코드 교환을 시도하고 취소할 때 대기 요청과 해당 검증값을 정리한다.
- Android 디버그 복귀 주소는 `com.allitcare.android.debug.oauth://auth/callback`, 릴리스는 `com.allitcare.android.oauth://auth/callback`이다. 공급자 콘솔의 콜백 주소는 `https://<PROJECT_REF>.supabase.co/auth/v1/callback`이다. 허용 목록과 로컬·Pages 경로는 [OAuth 설정](AUTH_SETUP.md)을 따른다.

## 이어서 할 일

### 1. CLI 인증과 운영 변경 전 보고

Supabase CLI **3.4.0**에서 인증과 연결을 확인했다. 대상은 `Test Project` (서울, `ACTIVE_HEALTHY`)의 기본 환경이다. 이전에 링크 없이 연결할 때는 인증 및 IPv6 직접 연결 오류가 있었다. 다시 인증과 링크가 필요할 때 아래 명령을 사용한다.

```bash
# 저장소의 dev 작업 폴더에서 실행
npx supabase@3.4.0 login
npx supabase@3.4.0 projects list
: "${SUPABASE_PROJECT_REF:?먼저 대상 프로젝트 ref를 설정하세요}"
npx supabase@3.4.0 link --project-ref "$SUPABASE_PROJECT_REF"
```

로그인과 DB 비밀번호 입력이 필요하면 사용자가 로컬 터미널에서 진행한다. CLI 로그인 뒤 프로젝트 목록에서 해당 ref를 확인한다. 같은 IPv6 오류가 나면 Dashboard **Connect → Session pooler**의 무료 IPv4 세션 연결(포트 `5432`)을 사용한다. 호스트는 Dashboard에 표시된 실제 값으로 확인하고 비밀이 포함된 연결 문자열을 로그에 쓰지 않는다. [Supabase 연결 방식](https://supabase.com/docs/guides/database/connecting-to-postgres)

운영 이력과 Dry Run을 재확인할 때는 연결된 프로젝트에서 아래 명령을 사용한다.

```bash
npx supabase@3.4.0 migration list --remote
npx supabase@3.4.0 db push --remote --dry-run --skip-vault
npx supabase@3.4.0 functions list --remote="$SUPABASE_PROJECT_REF"
```

마이그레이션 조회·Dry Run에서 직접 경로가 막히면 인증된 Session pooler 연결을 쓴다. DB 카탈로그 점검은 CLI `db query --read-only --remote="$SUPABASE_PROJECT_REF" --file supabase/tests/inspect_catalog.sql`로 실행한다. 기존 동명 객체, 기존 Auth 다중 공급자 계정의 **건수**, Storage의 기존 정책 및 스키마 차이를 검토하고 실제 Dry Run과 함께 사용자에게 보고한다. 테이블이 존재하는데 이력만 다를 때는 원격 상태를 먼저 조사한다. 이력 강제 수정이나 덮어쓰기는 별도 판단이 필요하다.

| Dry Run에서 확인한 SQL | 적용 범위 |
| --- | --- |
| `202611270001_account_data.sql` | `profiles`, `user_settings`, `guardians`, `schedules`, `schedule_occurrences`, `conversations`, `messages`, `photos` 8개. 소유자 RLS와 복합 FK, 명시 인덱스 5개, 비공개 `allit_private.account_deletions`, 일정·프로필 RPC, Auth의 교차 공급자 연결을 막는 트리거. `verification-photos` 비공개 버킷과 조회·삽입·삭제 정책 3개. JPEG만 허용하며 파일 한도는 1 MiB. |
| `202611270002_profile_onboarding.sql` | `profiles.onboarding_completed_at`과 `allit_save_profile`의 최초 완료 시각 보존. |
| `202611270003_ai_foundation.sql` | 익명 RPC 권한 정리, pgvector 및 비공개 RAG 스키마의 초기 구조. |

초기 운영 이력에 세 파일의 적용 기록이 없었고 Dry Run에는 seed와 별도 role 파일이 없었다. PostgreSQL 17.12의 운영 카탈로그에서 앱 테이블 8개, 내부 스키마·테이블, 앱 RPC, 비공개 사진 버킷과 충돌할 기존 객체가 없음을 확인했다. 기존 Storage RLS는 활성화돼 있었고 `owner_id` 타입은 `text`였다. 기존 Google·카카오 포함 다중 공급자 계정 수는 0이며 함수 목록은 비어 있었다.

### 2. 별도 승인 후 적용과 검증

1. 사용자에게 승인 받은 프로젝트와 마이그레이션만 적용한다. CLI 명령은 `db push --remote="$SUPABASE_PROJECT_REF" --skip-vault` 또는 확인한 Session pooler 대상이다. 원격 스키마 reset, 무단 migration repair, seed 삽입은 현재 계획에 없다.
2. 운영 카탈로그와 마이그레이션 이력을 재조회한다. 표의 테이블, 인덱스, RLS와 Storage 정책, 버킷 속성, Auth 트리거, 온보딩 컬럼과 RPC 권한을 확인한다. 운영 Data API 응답을 다시 검사한다.
3. 승인 범위에서 `npx supabase@3.4.0 functions deploy delete-account --remote="$SUPABASE_PROJECT_REF" --use-api`로 기존 함수를 배포한다. 함께 검토한 로컬 함수는 `verify_jwt = true`, 내부 `auth.getUser(token)` 검증, 삭제 중 쓰기 차단 마커, Storage 파일 배치 삭제, 요청자 자신의 Auth 삭제를 사용한다. Service Role 키는 함수 런타임에만 둔다. 배포 뒤 함수 목록, 허용 origin OPTIONS, 비인증 삭제 거부와 시험 계정 본인 삭제를 확인한다.
4. Google과 카카오 실계정으로 OAuth 완료, Android 복귀와 PKCE 세션 교환, 세션 복구·로그아웃을 검증한다. 카카오에서 이메일 권한 없는 가입 케이스를 확인한다. 운영 테스트에는 사용자와 합의한 시험 계정·합성 데이터만 쓴다.
5. 두 개의 서로 다른 사용자 세션으로 프로필, 일정·완료, 보호자, 대화 이력, 사진 업로드 및 인증 다운로드를 각각 확인한다. A의 JWT로 B의 테이블·사진 조회, 변조, 타인 경로 쓰기 및 타인 부모 연결이 차단되는지 검증한다. 서비스 권한으로 테스트한 결과를 사용자 RLS 통과로 산정하지 않는다. 무인증 접근도 확인한다.
6. 시험 계정만 탈퇴시키고 그 계정의 Auth·DB·Storage가 삭제되며 다른 계정은 유지되는지 확인한다. 운영 동기화와 로컬 회귀 결과를 구분해 보고한다. 공개 Pages는 사용자 승인과 해당 배포 작업이 있을 때 따로 검증한다.

## 검증 이력과 재현

### 로컬 자동화

최신 재실행에서 앱 및 기존 날씨 Worker TypeScript 검사, 삭제 함수 Deno 타입 검사, Node 테스트 84개가 통과했다. PostgreSQL 18 격리 픽스처에서 SQL 적용, 8개 API 테이블 RLS, 1개 내부 테이블, 5개 명시 인덱스, 8개 소유자 정책과 3개 Storage 정책, 버킷 속성, 온보딩, Auth 트리거를 확인했다. A/B 격리, 교차 연결, 익명 접근, 삭제 중 접근 차단 및 DB 연쇄 삭제도 로컬 SQL에서 검증했다. 그 픽스처는 Auth/Storage 최소 스키마를 사용하므로 운영 JWT 발급이나 사진 바이너리 전송 검증은 남아 있다.

```bash
cd /home/james-kwon/Desktop/senior-app/dev
./supabase/tests/run-local-postgres.sh
deno check --no-lock supabase/functions/delete-account/index.ts
cd src/weather-schedule-app
npm run typecheck
npm run typecheck:server
node --test --experimental-test-isolation=none tests/*.test.mjs
```

### Android와 웹

- Expo Go의 LAN 타임아웃과 SDK 불일치 문제 때문에 실제 OS 검수는 Capacitor Android APK로 전환했다. Expo Go는 Expo UI 미리보기에 사용하고 알람·카메라·연락처·메시지·Android OAuth 브리지는 Capacitor로 확인한다.
- Pixel 6 AVD 이름은 `Allit_Pixel_6`, 기기 ID는 `emulator-5554`다. Android 16 AOSP의 기본 HTTPS 처리기는 WebView Shell이어서, OAuth 검수용 Firefox를 에뮬레이터에 설치하고 기본으로 지정했다. `com.allitcare.android.debug`에서 두 공급자 버튼이 외부 Firefox를 열고 미완료 로그인을 취소하는 것까지 검증했다.
- 이전 에뮬레이터 시험에서 앱 프로세스를 종료하고 비행기 모드·화면 꺼짐 상태로 30초 사전 알림과 정각 화면·`USAGE_ALARM` 소리·진동을 확인했다. 알람에서 시스템 카메라 촬영 후 사진 인증 등록, 연락처 선택 결과 반환, 사진·본문이 포함된 MMS 초안 생성도 확인했다. 앱은 초안을 열고, 사용자가 시스템 메시지 앱에서 전송한다. 시스템 설정에서 **강제 종료**한 경우 앱을 다시 열어야 예약을 복구한다.
- AOSP에서 실제 한국어 STT/TTS 엔진과 언어 서비스가 없어 실출력은 미검증이다. 기존 녹음 음성과 별도의 기능이다. 실기기 OS 권한, 재부팅 복구, 제조사별 정책, 카메라·메시지 앱 차이는 [Android 검증 이력](NATIVE_TEST_REPORT.md)을 참고한다.
- 최신 회귀는 기존 앱 세션을 보존하려고 `.env`를 비활성화한 임시 `com.allitcare.android.regression` APK로 진행했다. 테스트 APK는 별도 패키지로 설치됐다. 최신 진행 결과는 아래에 기록한다.
- 에뮬레이터가 호스트 OOM으로 종료된 이력이 있다. 시스템 로그에는 커널이 프로세스를 종료한 기록이 있다. 마지막 회귀에서는 빌드가 끝난 올잇 전용 Gradle 데몬을 정리한 뒤, 기존 AVD 데이터를 유지하고 `-memory 1536 -cores 2 -gpu swiftshader -feature -Vulkan -no-snapshot-load -no-boot-anim`으로 재시작했다. 부팅이 약 3분 이상 걸렸고 초기에 System UI 응답 지연도 있었다.
- 기존 디버그 APK 경로는 `src/weather-schedule-app/capacitor-android/app/build/outputs/apk/debug/app-debug.apk`다. 빌드 재현은 [Android 개발](ANDROID_DEVELOPMENT.md)의 Node·JDK 21·SDK 36 설정과 `npm run android:sync`, `./gradlew :app:assembleDebug`를 사용한다. 디버그 앱을 열 때는 아래 명령을 사용한다.

```bash
"$HOME/Android/Sdk/platform-tools/adb" -s emulator-5554 shell am start \
  -n com.allitcare.android.debug/com.allitcare.android.MainActivity
```

로컬 `npm run build:web:pages`에서 `/senior-app/` 에셋 경로와 CSP, 개인정보 처리방침과 계정 삭제 페이지 산출물을 확인했다. 운영자·문의 이메일·보관 정책 확정 및 Pages/Play 배포는 미완료다.

### 이번 회귀의 최신 결과

격리 APK에서 테스트 앱 프로세스 종료 후 비행기 모드·화면 꺼짐 상태의 사전 알림과 정각 소리·진동·알람 화면을 확인했다. 이어서 시스템 카메라 촬영, 미리보기, 사진 인증 등록이 통과했다. 초기 MMS 자동화는 선택한 연락처를 입력란에만 채운 상태에서 수신자 버튼을 찾아 중단됐다. 시스템 연락처 선택 후 **보호자 등록**을 눌러 시험 보호자가 저장되는 것을 확인했다. 그 뒤 저장된 사진에서 시스템 메시지 앱을 열어 이미지와 시험 본문이 포함된 MMS 초안을 확인했고, 첨부를 취소한 뒤 앱으로 돌아왔다.

Android 패키지 조회에서 STT 인텐트는 `No activity found`, TTS 인텐트는 `No services found`였다. 이번에도 한국어 실출력은 미검증이다. 시험 후 에뮬레이터 비행기 모드는 원래 상태인 꺼짐으로 돌아왔고 기존 `com.allitcare.android.debug`의 `MainActivity`를 다시 열었다.

로컬 진단 자료가 남아 있다면 `/tmp/allit-prod-native-regression.log`에서 최신 알람·카메라 실행과 첫 MMS 시도의 중단 경위를, `/tmp/allit-final-regression.log`에서 이전 성공 이력을 확인할 수 있다. `/tmp/allit-prod-preflight-fixture-path`는 임시 APK·테스트 스크립트 폴더의 위치, `/tmp/allit-prod-local-catalog.json`은 로컬 DB 카탈로그다. 임시 파일은 삭제될 수 있으므로 이 문서의 검증 구분과 저장소 문서를 기준으로 이어서 작업한다.

## 참고 문서

- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) — 공개 설정·CLI·기존 운영 반영 절차
- [AUTH_SETUP.md](AUTH_SETUP.md) — 공급자 설정·Redirect URL·Pages
- [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) — ERD·RLS·캐시·가져오기·삭제
- [INTEGRATION_TEST_REPORT.md](INTEGRATION_TEST_REPORT.md) — 이전 실제 응답 및 로컬 검증 범위
- [ANDROID_DEVELOPMENT.md](ANDROID_DEVELOPMENT.md) · [NATIVE_TEST_REPORT.md](NATIVE_TEST_REPORT.md) — 빌드·권한·Android 시험
