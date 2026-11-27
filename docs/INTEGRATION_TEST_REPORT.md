# 계정 및 Supabase 통합 검증

## Pages 빌드의 날씨와 공유 화면

- 현재 개발 날씨 Worker는 서울 격자의 기상청 관측값을 반환했다. 허용된 `http://localhost:8081`에서 React Native Web 미리보기의 관측 기온, 달력의 사진 영역, 말벗의 글 답변을 확인했다.
- `/senior-app/` 출시 빌드는 로컬 Chromium에서 로그인 버튼과 계정 삭제 페이지 진입을 확인했다. 공개 Pages는 HTTP 404이며, 기존 Worker는 `https://soyun-h.github.io`에 HTTP 403 `ORIGIN_DENIED`를 반환했다. 워크플로는 게시 전 배포된 Worker의 Pages CORS와 실측 데이터 응답을 점검한다.
- 기기 전용 APK에 빠졌던 날씨 URL을 로컬 공개 설정에서 주입해 두 APK를 빌드했다. 서명 및 번들 설정을 검증했다. 설치 시점에 에뮬레이터가 연결되어 있지 않아 새 APK의 기기 화면 확인은 남아 있다.

## 실제 개발 Supabase 적용과 검증

2026-11-27에 승인된 개발 프로젝트에 `202611270001_account_data.sql`, `202611270002_profile_onboarding.sql`, `202611270003_ai_foundation.sql`을 순서대로 적용했다. CLI 3.4.0으로 원격 이력 3건과 재실행 Dry Run 대기 0건을 확인했다. 원격 카탈로그에서 앱 테이블 8개, 앱 인덱스 5개, 소유자 RLS 정책 8개, Storage 정책 3개, Auth 트리거, 프로필 및 완료 RPC 권한, `extensions.vector`, 비공개 `verification-photos` 버킷을 확인했다.

| 실제 프로젝트 검증 | 확인한 동작 |
| --- | --- |
| Auth와 사용자 데이터 | 별도로 만든 시험 계정 두 개로 각각 토큰을 발급받아 프로필과 설정, 보호자, 일정 등록·수정·완료, 대화와 양방향 메시지를 저장하고 재조회했다. |
| 비공개 사진 | 로그인 상태에서 JPEG를 업로드하고 사진 메타데이터를 저장했다. 다운로드한 JPEG의 바이트가 원본과 일치했다. |
| 사용자 격리 | 두 계정이 서로의 테이블 8개를 조회할 수 없었다. 타인 일정 수정·삭제 및 다른 사용자로 행 쓰기, 다른 사용자의 부모를 참조하는 변경, Storage 업로드·다운로드와 익명 접근이 차단됐다. |
| Android 실제 연동 | 기존 소셜 로그인 세션에서 시험 일정을 앱 UI로 저장하고 API로 확인했다. Android 알람의 소리·진동과 시스템 카메라를 거쳐 인증 사진을 등록했다. 실제 완료 행과 사진 메타데이터가 연결됐고 인증된 Storage 다운로드가 HTTP 200을 반환했다. Android 연락처 선택기로 시험 보호자를 등록한 뒤 사진과 일정 본문이 있는 MMS 초안을 확인했다. 별도 시험 일정은 정각 예약 확인 후 앱 프로세스를 종료하고 화면을 껐다. 정각에 Android 알람 화면·소리·진동이 작동했고 네이티브 확인 버튼의 완료 기록을 실제 DB에서 재조회했다. |
| 시험 데이터 정리 | 별도로 만든 두 시험 계정과 사진, 에뮬레이터 계정에 추가한 시험 일정 두 건·사진·보호자를 정리했다. 에뮬레이터 계정의 첫 프로필 안내는 기본값으로 건너뛰었다. |
| 계정 탈퇴 | 개발 프로젝트에서 Edge Function 경로는 HTTP 404 `NOT_FOUND`였다. 소스는 저장소에 유지되며 원격 배포와 탈퇴 검증에 별도 승인이 필요하다. |

개발용 최신 APK의 달력에서 실제 Supabase에 저장한 서로 다른 두 달의 시험 사진을 검증했다. 사진이 있는 날짜에 표시가 보이고 선택 날짜의 사진만 목록에 나왔다. 두 사진을 각각 비공개 Storage에서 받아 화면에 표시했다. 자정을 넘겨 촬영한 일정 사진은 일정 날짜로 표시됐다. 검증 후 시험 사진과 기기 캐시를 정리했다.

두 열 갤러리 변경 후 개발용 APK에서 같은 날의 사진 두 장이 선택 날짜 아래에 바로 표시되는 것과 다른 달의 사진으로 전환되는 것을 확인했다. 기기 전용 APK를 업데이트한 뒤 기존 11월 27일 사진 네 장이 날짜 아래에 나열되고 선택한 원본이 크게 열리는 것도 확인했다.

## DB 적용 전 일정과 달력 재검증

- 개발 프로젝트의 `profiles`, `schedules`, `schedule_occurrences`, `guardians`, `photos` API에서 HTTP 404와 `PGRST205`를 확인했다. 앱 origin `https://localhost`는 응답에 허용되었다. 원격 카탈로그와 Dry Run에서 이 프로젝트의 앱 DB가 초기화되기 전이며 적용된 마이그레이션은 0건임을 확인했다. 적용 대기는 `202611270001_account_data.sql`, `202611270002_profile_onboarding.sql`, `202611270003_ai_foundation.sql`이다. Auth 변경은 필요하지 않다.
- 기존 로그인 세션이 남은 개발용 APK를 업데이트했다. 서버 오류가 표시된 일정 화면에서 추가 폼을 열었고, 달력에서 다음 달의 날짜를 골라 같은 날짜로 추가 폼을 열었다. 폼에서 돌아오면 달력에 선택 날짜가 유지됐다. 원격 저장과 기기 자료 복사는 DB 스키마 반영 후 검증할 수 있다.
- 기기 전용 APK에서 시험 일정을 등록하고, 선택 날짜의 일정 표시와 일정 목록에서의 조회 및 기기 저장을 확인했다. 앱과 Worker의 타입 검사 및 자동 테스트 84개도 통과했다.

## Pages 배포 전 Android 시험

- 개발 Supabase에서 내장 APK origin `https://localhost`로 REST와 Storage 사전 요청을 보내 HTTP 200을 받았다. 프로필 조회는 `PGRST205`, 계정 삭제 함수의 OPTIONS는 `NOT_FOUND`로 404를 반환했다. 함수 호출까지 검증하려면 먼저 DB 마이그레이션과 함수 배포가 필요하다.
- 로컬 Deno의 삭제 함수에서 `https://localhost`와 개발 웹 origin `http://localhost:8080`의 사전 요청이 HTTP 204를 반환했다. 비허용 origin은 403, 토큰 없는 삭제는 401을 반환했다.
- 개발 초기화 명령은 Pages 주소를 생략한 실제 개발 프로젝트 Dry Run을 통과했다. SQL 3개와 Android Redirect 등록, 개발 CORS 및 함수 배포를 미리 확인했다. 이번 시험에서 원격 변경은 수행하지 않았다.
- 기기 전용과 Supabase 연결 시험 APK를 각각 디버그 키로 빌드하고 서명을 검증했다. 두 APK 모두 웹을 내장한다. 기기 전용 APK 번들에는 개발 프로젝트 URL과 공개 키가 없음을 확인했다. [실기기 설치 절차](ANDROID_DEVELOPMENT.md#pages-배포-전-apk-시험)
- Pixel 6 Android 16에서 새 기기 전용 APK로 Android 연락처 선택, 앱 프로세스 종료 후 비행기 모드·화면 꺼짐 상태의 사전 알림, 정각 소리·진동·알람 화면, 카메라 촬영·미리보기·인증 등록과 사진·본문이 있는 MMS 초안을 확인했다. 초안의 첨부를 지웠으며 실제 발송은 하지 않았다. 에뮬레이터에 STT Activity와 TTS 서비스가 없어서 음성 입출력은 실기기 검증이 남아 있다.
- 새 개발 Supabase APK에서 Google·카카오 로그인 버튼을 확인했다. 카카오 버튼으로 외부 Firefox가 열렸고 앱에서 로그인 취소가 동작했다. 실계정 인증 완료와 앱 복귀는 미검증이다. 시험 후 비행기 모드를 끄고 기기 전용 시험 앱으로 돌아갔다.

## 출시 환경 분리 및 초기화 검증

| 범위 | 결과 |
| --- | --- |
| 실제 개발 전용 Supabase | 승인 후 SQL 3개를 적용했다. 실제 데이터 API 및 Storage의 사용자별 검증은 위 섹션에 있다. |
| 로컬 빈 DB | PostgreSQL 18과 실제 pgvector 0.8.1을 임시 디렉터리에서 실행했다. 기본 Auth·Storage 픽스처에 세 마이그레이션을 적용하고 재실행했다. 두 번째 CLI 실행에 대기 SQL은 없었다. 카탈로그, 앱 RLS, 비공개 RAG 스키마, 복합 소유자 외래키와 삭제 연쇄를 검증했다. |
| 로컬 Edge | Deno 타입 검사, 출시 사이트 CORS 허용, 비슷한 도메인·출시용 로컬 개발 origin 차단, 익명 삭제 요청 거부를 확인했다. |
| 출시 빌드 분리 | 서로 다른 두 예제 프로젝트의 공개 URL과 키를 주입해 Pages를 빌드했다. 자산 경로, CSP, 개인정보 처리방침, 삭제 페이지 및 결과 번들의 연결 대상이 바뀌는 것을 확인했다. Supabase 관리자 환경변수 없이 임시 키로 Android APK·AAB를 빌드하고, 서명·버전·내장 연결 대상을 확인했다. |

새 팀의 별도 원격 프로젝트에는 접근 권한이 제공되지 않았다. 로컬 PostgreSQL 검증은 전체 Supabase 스택, 실제 소셜 가입, Storage 이미지 API 및 본인 탈퇴 검증을 포함하지 않는다. 실행 절차는 [출시 가이드](RELEASE_GUIDE.md)에 있다.

검증 대상은 로컬 `dev` 작업 폴더다. 로컬 검증은 임시 PostgreSQL과 Pixel 6 Android 16 에뮬레이터를 사용했다. `.env.local`에 입력된 공개 설정으로 실제 Supabase Auth와 읽기 전용 API 응답도 확인했다.

## 구현 산출물

| 변경 위치 | 내용 |
| --- | --- |
| `supabase/migrations/202611270001_account_data.sql`, `202611270002_profile_onboarding.sql` | 사용자별 관계형 테이블, RLS·복합 FK, 소셜 ID 분리, 실행 기록과 프로필 RPC, 첫 설정 완료 시각, Private JPEG 버킷, 계정 삭제 차단 마커 |
| `supabase/functions/delete-account/index.ts` | 요청자 인증 토큰 검증, Storage API 배치 삭제, Auth 사용자와 관련 DB 기록 삭제 |
| `src/weather-schedule-app/src/features/account/` | 공통 Supabase 클라이언트, PKCE, 로그인·첫 프로필 설정, 카카오 권한 설정, 로컬 자료 감지 및 동의 흐름, 일정·연락처·사진·대화 접근 계층과 재시도 |
| `src/weather-schedule-app/src/screens/AndroidCareScreen.tsx`, `App.tsx`, `src/features/schedules/ScheduleProvider.tsx` | 계정 화면, 일정 캐시 선행 복구, 사진·음성 흐름의 비차단 저장, 로그인 상태 화면 제어 |
| `src/weather-schedule-app/capacitor-android/`, `src/features/android/bridge.ts` | 시스템 브라우저, 딥링크와 Keystore, 계정별 요청 검사·안드로이드 예약·사진 분리, 원본 사진 복사와 JPEG 압축 |
| `src/weather-schedule-app/public/privacy.html`, `scripts/web-policy.mjs` | 개인정보 처리방침 및 동일 인증·삭제 흐름을 쓰는 외부 정적 페이지 생성 |
| `src/weather-schedule-app/tsconfig.json` | Pages와 Capacitor가 생성한 파일을 소스 타입 검사에서 제외 |
| `supabase/tests/`, `src/weather-schedule-app/tests/oauth-callback.test.mjs`, `tests/legacy-data.test.mjs` | PostgreSQL 정책 및 온보딩 검사, 콜백과 공식 SDK의 PKCE URL 생성 검사, 기존 자료 감지 및 시험·잘못된 사진 제외 검증 |

## 로컬 검증 결과

| 항목 | 결과 |
| --- | --- |
| 정적 검사 | Expo 앱과 Cloudflare Worker의 TypeScript 검사, 삭제 Edge Function의 Deno 타입 검사 통과 |
| 자동 테스트 | 84개 통과. 기존 일정과 캐릭터, 딥링크의 오리진·경로·만료·중복 `code`·인증 취소, SDK의 S256 URL과 로그인별 PKCE 저장 키, 가져오기 대상 분류를 확인 |
| DB 및 접근 제어 | 임시 PostgreSQL 18에서 마이그레이션 설치. A의 B 일정·대화·사진 조회, 타인 수정·삭제·삽입·부모 참조 및 무인증 접근 거부. 인증된 클라이언트의 관리자 삭제 RPC 차단 확인 |
| 데이터 처리 | PostgreSQL에서 완료 재시도의 중복 방지, 프로필·온보딩 완료 시각과 음성 설정 기록, 잘못된 반복일 거부, 공급업체 교차 연결 거부, 삭제 대기 접근 차단 및 A의 자료를 유지하면서 B의 DB 기록만 삭제 확인 |
| Pages | 실제 공개 프로젝트 설정으로 `/senior-app/` 에셋 경로, Supabase CSP origin, no-referrer, 개인정보·삭제 페이지를 확인 |
| CLI | Supabase CLI 3.4.0에서 `--dry-run --remote`와 원격 마이그레이션 목록 옵션을 확인했다. |
| Android 빌드 | Expo Android Hermes 번들, Capacitor 디버그 APK와 서명 전 릴리스 APK 생성. 로컬 데모 APK를 Pixel 6에 설치 |
| Android 알람 회귀 | 로컬 데모에서 앱을 백그라운드로 보낸 후 프로세스를 종료했다. 비행기 모드와 화면 꺼짐 상태에서 30초 사전 알림, Android의 정각 `USAGE_ALARM` 출력·진동·`AlarmActivity` 실행을 확인했다. |
| Android 카메라·연락처·메시지 | 네이티브 알람에서 시스템 카메라로 촬영, 미리보기, 사진 인증 등록까지 동작했다. Android 메시지 앱에서 사진과 시험 본문이 첨부된 MMS 초안을 열고 첨부를 취소했다. 시스템 연락처 선택기로 고른 시험용 이름과 번호가 앱에 반환됐다. |
| Android STT·TTS | 에뮬레이터에서 한국어 음성 인식 앱이 없다는 안내를 확인했다. 시스템 TTS 서비스도 없어서 한국어 인식과 합성 출력은 미검증이다. |
| Android OAuth | 최종 디버그 APK에서 Google·카카오 버튼으로 외부 Firefox가 열렸다. 앱으로 돌아와 대기 중인 카카오 로그인을 취소했다. 디버그·릴리스 Manifest의 두 URI가 `OAuthCallbackActivity`를 가리킨다. 대기 중인 로그인 없이 전달한 시험 코드는 세션을 생성하지 않았다. |

Pixel 6 에뮬레이터 이미지의 HTTPS 처리기는 WebView Shell이었다. OAuth 시험용으로 해당 에뮬레이터에 Mozilla Firefox를 설치하고 Android 기본 브라우저로 지정했다. 현행 SDK의 로그인별 PKCE 저장 키와 이전 형식의 키를 모두 Android Keystore 어댑터가 처리하도록 수정했다.

정상 검증 명령은 `./supabase/tests/run-local-postgres.sh`, `npm run typecheck`, `npm run typecheck:server`, `node --test --experimental-test-isolation=none tests/*.test.mjs`다. DB 검증의 Auth와 Storage 스키마는 로컬 픽스처다. 정책과 외래키는 실제 PostgreSQL이 실행했으며, 운영 Supabase Storage의 바이너리 전송과 JWT 발급은 이 테스트의 범위 밖이다.

## 초기 적용 전 실제 프로젝트 응답

| 항목 | 결과 |
| --- | --- |
| Supabase Auth 설정 | HTTP 200, Google 및 Kakao 활성화 |
| Android 디버그·외부 삭제용 Google 로그인 시작 | 두 요청 모두 HTTP 302로 Google OAuth에 연결, `email profile` |
| Android 디버그·외부 삭제용 Kakao 로그인 시작 | 두 요청 모두 HTTP 302로 Kakao OAuth에 연결, `profile_nickname profile_image`만 전달 |
| 앱 테이블 및 계정 삭제 함수 | 초기화 당시 `profiles`, `schedules` Data API와 삭제 함수 경로 모두 HTTP 404 |
| GitHub Pages | 지정한 공개 기본 주소 HTTP 404 |

OAuth 검증은 공급업체로 넘어가는 HTTP 응답과 범위까지 진행했다. 공급업체 로그인 완료, 이메일이 없는 Kakao 사용자의 계정 발급, Redirect 허용 목록 및 세션 재발급은 별도 검증이 필요하다.

## 외부 연결 후 검증 항목

- Google·카카오 신규 가입과 재로그인, 공급업체 콘솔 취소, 브라우저 OAuth를 끝낸 뒤 전경·백그라운드·프로세스 종료 상태로 돌아오기, 토큰 갱신 및 계정 전환.
- 신규 기기로 계정 데이터를 복구하고 오프라인 완료·사진 큐 재전송, 로그아웃 후 예약과 로컬 파일 정리를 확인한다.
- 회원 탈퇴 함수의 파일 삭제와 Auth 계정 제거, 앱과 외부 웹페이지에서의 삭제.
- Google Play 배포 및 실기기 검증. 운영자 이름, 개인정보 문의 이메일과 세부 보관 정책 확인.

실제 프로젝트 연결은 [SUPABASE_SETUP.md](SUPABASE_SETUP.md), 공급업체 콘솔의 입력 값과 Redirect URI는 [AUTH_SETUP.md](AUTH_SETUP.md)에 정리했다.
