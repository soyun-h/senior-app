# 올잇 출시팀 설정 가이드

출시팀 소유의 Supabase·Google·카카오·GitHub 계정을 사용한다. 개발 프로젝트의 데이터, 테스트 사용자, OAuth 비밀값과 CLI 인증 정보는 이전하지 않는다. 저장소 루트의 `supabase/`가 인프라의 원본이고, `weather-schedule-app/`이 앱이다.

## 1. 출시용 Supabase 프로젝트 생성

1. Supabase Dashboard에서 출시팀 조직의 Free 프로젝트를 생성한다. 개발 프로젝트와 다른 Project Ref를 사용한다.
2. Dashboard의 **Connect**에서 Project URL, **Settings → API Keys → Publishable keys**에서 `sb_publishable_…` 키, **Settings → General**에서 Project Ref를 확인한다. Project URL은 `https://<PROJECT_REF>.supabase.co` 형식이다.
3. 팀의 공개 웹 주소를 정한다. GitHub Pages 프로젝트 사이트라면 `https://<OWNER>.github.io/<REPO>/`, 루트 사이트라면 `https://<OWNER>.github.io/`다. 커스텀 도메인도 사용할 수 있다.
4. Node.js 22와 npm을 준비한다. Android 빌드에는 JDK 21, Android SDK Platform 36이 추가로 필요하다.

## 2. 인프라 초기화

```bash
cd weather-schedule-app
npm ci
npm run setup:supabase
```

스크립트는 npm을 통해 **Supabase CLI 3.4.0**을 사용한다. 인증이 필요하면 같은 터미널에서 `npx supabase@3.4.0 login` 후 다시 실행한다. 프롬프트에 `release`, 새 프로젝트 URL·Ref·Publishable Key, 팀의 Pages 주소를 입력한다. 팀의 날씨 Worker URL은 선택 사항이며, 배포 뒤 앱의 공개 설정에 추가할 수 있다.

1. 표시된 프로젝트 Ref를 입력해 사전 점검을 진행한다. 프로젝트 계정 접근권, Publishable Key, CLI 연결 대상, 이력과 스키마 충돌을 자동 확인한다. 이 작업용 CLI 링크는 임시 디렉터리에 생성한다.
2. Dry Run에 표시되는 마이그레이션, Auth Redirect와 배포 함수 목록을 검토한다. 적용할 때만 프롬프트에 `apply <PROJECT_REF>`를 입력한다.
3. SQL은 테이블·제약·인덱스·RPC·트리거·RLS와 Private Storage 버킷을 생성한다. Auth에는 Site URL과 필요한 Redirect URL을 등록하고 기존 Redirect URL을 유지한다. Edge에는 공개 웹 origin 설정을 전송하고 저장소의 함수들을 배포한다.
4. 원격 카탈로그와 함수 상태, 익명 접근 거절, 삭제 함수의 CORS 응답이 확인되면 `.env.release.local`을 생성한다. 아직 공급자를 설정하지 않았다면 이 시점의 소셜 로그인 버튼은 공급자 인증을 완료할 수 없다.

`npm run setup:supabase -- --plan`은 조회·연결·Dry Run까지만 실행한다. 자동화에서 공개 입력을 `ALLIT_SETUP_PROFILE`, `ALLIT_SETUP_SUPABASE_URL`, `ALLIT_SETUP_PROJECT_REF`, `ALLIT_SETUP_PUBLISHABLE_KEY`, `ALLIT_SETUP_SITE_URL`, 선택 값 `ALLIT_SETUP_WEATHER_API_URL`로 전달한다. 적용에는 터미널의 명시적 확인이 필요하다.

재실행은 원격 이력에서 이미 적용된 마이그레이션을 건너뛴다. Auth Redirect 중복을 제거하고 기존 URL을 보존하며, 함수는 같은 이름으로 갱신한다. 스키마와 이력이 불일치하거나 등록된 프로필이 다른 프로젝트를 가리키면 중단한다. 초기 공통 행은 필요하지 않다. 기본 프로필·설정은 첫 로그인 때 DB 기본값과 앱의 초기화 로직으로 생성된다. RAG 스키마는 `allit_ai`에 비공개로 있으며 pgvector를 `extensions`에 설치한다. 문서·청크·임베딩을 저장할 구조까지만 포함한다. 추후 사용할 모델과 차원을 결정한 뒤 해당 차원의 벡터 인덱스와 검색 API를 추가한다.

직접 접속에 IPv6 오류가 나면 CLI 링크의 기본 무료 Session pooler를 사용한다. DB 비밀번호가 필요한 경우 터미널에서 아래처럼 입력한다. 비밀번호를 명령 문자열, 프로젝트 환경 파일이나 CI 공개 변수에 넣지 않는다.

```bash
(
  read -rsp 'Supabase DB password: ' SUPABASE_DB_PASSWORD
  printf '\n'
  export SUPABASE_DB_PASSWORD
  npm run setup:supabase
)
```

CLI 로그인은 팀의 관리 권한으로 한다. 빌드 단계에서 이 인증이나 비밀번호는 필요하지 않다. [Supabase CLI 명령](https://supabase.com/docs/guides/local-development/local-and-hosted-projects) · [Session pooler](https://supabase.com/docs/guides/database/connecting-to-postgres)

## 3. Google과 카카오 설정

초기화 명령이 입력받은 Project URL에서 콜백을 생성해 출력한다. `<SITE_URL>`은 끝에 `/`가 있는 공개 사이트 주소다.

| 설정 위치 | 값 |
| --- | --- |
| Google과 카카오 개발자 콘솔의 Callback / Redirect URI | `https://<PROJECT_REF>.supabase.co/auth/v1/callback` |
| Google Web application의 Authorized JavaScript origins | Pages origin만 입력. 예시 `https://<OWNER>.github.io` |
| Supabase **Authentication → URL Configuration → Site URL** | `<SITE_URL>` |
| Supabase **Redirect URLs** | `<SITE_URL>`, `<SITE_URL>index.html`, `<SITE_URL>delete-account.html`, `com.allitcare.android.oauth://auth/callback` |
| 개발 프로젝트에만 추가하는 Redirect | `com.allitcare.android.debug.oauth://auth/callback`, `http://localhost:8080/`, `http://localhost:8080/delete-account.html`, `http://localhost:8090/`, `http://localhost:8090/delete-account.html` |

**Google**은 팀의 Google Auth Platform에서 Branding·Audience를 설정하고 **Clients → Create client → Web application**을 만든다. 위 Callback URI 및 웹 origin을 입력한다. Testing 상태라면 검증 계정을 Test users로 등록한다. Client ID와 Client Secret을 새 Supabase 프로젝트의 **Authentication → Sign In / Providers → Google**에 입력해 활성화한다. 공개 출시 전 앱 공개 상태와 필요한 동의 화면 심사를 확인한다. [Google OAuth 공식 문서](https://developers.google.com/identity/protocols/oauth2/web-server) · [Supabase Google 로그인](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

**카카오**는 팀 앱을 생성하고 **App → Platform Key → REST API key**에서 Redirect URI를 등록한다. REST API Key와 활성화한 Kakao Login Client Secret을 **Authentication → Sign In / Providers → Kakao**에 입력한다. 카카오 로그인을 활성화하고, 동의 항목은 `profile_nickname`, `profile_image`를 설정한다. Supabase의 **Allow users without an email**을 활성화한다. 앱은 이메일 scope를 요청하지 않는다. Android 복귀에는 Supabase의 웹 OAuth와 외부 시스템 브라우저를 사용한다. [카카오 공식 문서](https://developers.kakao.com/docs/en/kakaologin/prerequisite) · [Supabase 카카오 로그인](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao)

## 4. 출시 공개 환경변수

로컬은 초기화에서 만든 `weather-schedule-app/.env.release.local`에 아래 공개 항목을 채운다. CI에서는 같은 값을 GitHub **Settings → Secrets and variables → Actions → Variables**에 설정한다. GitHub 변수 방식에서는 공개 키·URL·사이트 주소를 모두 같은 출시 환경에서 지정한다.

| 변수 | 값 |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | 새 프로젝트 Project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 새 프로젝트 Publishable Key |
| `EXPO_PUBLIC_ALLIT_SITE_URL` | 위의 공개 사이트 URL |
| `EXPO_PUBLIC_WEATHER_API_URL` | Pages 게시에 사용할 팀 날씨 Worker의 `https://…/weather` |
| `ALLIT_PUBLIC_OPERATOR` | 개인정보 처리방침에 게시할 운영자 |
| `ALLIT_PUBLIC_PRIVACY_EMAIL` | 공개 문의 이메일 |
| `ALLIT_PUBLIC_RETENTION` | 운영팀이 확정한 공개 보관 기간·기준 |

`npm run build:web:release`와 `npm run android:sync:release`는 일반 Expo dotenv 읽기를 끈다. 공개 설정을 셸 또는 출시 전용 파일에서 가져오므로 개발용 `.env.local`을 읽지 않는다. 공개 설정을 환경으로 주입할 때는 정책의 세 항목도 같은 환경에 넣는다. Supabase 관리 토큰, DB 비밀번호, 서비스 역할 키, OAuth 비밀값은 앱 빌드에 필요하지 않다. 배포 성공 후 초기화 스크립트를 다시 실행할 때 같은 프로젝트의 정책 항목은 유지된다.

개발팀은 `development` 프로필로 초기화하고 별도 `.env.development.local`을 사용한다. Pages 배포 전 APK 시험에서는 사이트 URL을 생략할 수 있다. 내장 Android의 CORS origin은 `https://localhost`이며, 이 경우 초기화 스크립트가 기존 Supabase Site URL을 보존한다. Node의 dotenv 로더에 해당 파일을 지정하면 Expo의 기본 `.env.local`보다 우선 적용된다. [APK 시험 절차](ANDROID_DEVELOPMENT.md#pages-배포-전-apk-시험)

```bash
node --env-file=.env.development.local --run android:sync
```

## 5. GitHub Pages

1. 출시팀 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택한다. GitHub Free에서는 공개 저장소에 Pages를 배포할 수 있다. [GitHub Pages 공식 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
2. 위 공개 Actions 변수를 채운다. 출시팀 계정에서 `.github/workflows/release-pages.yml`의 **Release Pages**를 수동 실행한다. 게시 전에 실제 Worker에 사이트 origin으로 서울 격자 날씨를 요청해 CORS와 기상청 응답을 확인한다. Worker의 `ALLOWED_ORIGINS`에는 `/senior-app/`을 뺀 `https://<OWNER>.github.io`를 넣는다. 결과물은 `weather-schedule-app/dist/`이며, 로컬에서는 `npm run build:web:release`로 동일하게 빌드할 수 있다.
3. 새 Pages 도메인에서 `/`, `privacy.html`, `delete-account.html`이 정상 응답하는지 확인한다. 프로젝트 사이트라면 세 주소가 저장소 하위 경로를 포함해야 한다. [Pages 배포 원본 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 6. Android APK 및 AAB

출시 빌드는 최신 웹 번들을 APK/AAB에 내장한다. 팀의 Android 업로드 키를 프로젝트 외부에 만든다. 기존 앱을 업데이트하는 경우 기존 업로드 키와 패키지 ID를 사용하고 `versionCode`를 올린다.

```bash
cd weather-schedule-app
keytool -genkeypair -v -keystore /path/to/team-upload.p12 -storetype PKCS12 \
  -alias allit-upload -keyalg RSA -keysize 2048 -validity 10000
npm run android:sync:release
cd capacitor-android
(
  export ALLIT_ANDROID_KEYSTORE=/path/to/team-upload.p12
  export ALLIT_ANDROID_KEY_ALIAS=allit-upload
  export ALLIT_ANDROID_VERSION_CODE=1
  export ALLIT_ANDROID_VERSION_NAME=1.0
  read -rsp 'Keystore password: ' ALLIT_ANDROID_KEYSTORE_PASSWORD
  printf '\n'
  export ALLIT_ANDROID_KEYSTORE_PASSWORD
  export ALLIT_ANDROID_KEY_PASSWORD="$ALLIT_ANDROID_KEYSTORE_PASSWORD"
  ./gradlew --no-daemon :app:assembleRelease :app:bundleRelease
)
```

Windows에서는 `gradlew.bat`와 해당 셸의 보안 입력을 사용한다. 출력은 `app/build/outputs/apk/release/`의 APK와 `app/build/outputs/bundle/release/app-release.aab`다. 로컬 설치는 서명된 APK로 검증하고 Play Console에는 서명된 AAB를 올린다. 현재 코드의 패키지명은 `com.allitcare.android`, target SDK는 36이다. Android Studio의 **Generate Signed Bundle / APK**에서도 팀 키를 선택할 수 있다. [Android 서명 공식 문서](https://developer.android.com/studio/publish/app-signing) · [Google Play target API](https://support.google.com/googleplay/android-developer/answer/11926878)

## 7. 실제 환경 검증

- 팀의 Google·카카오 시험 계정으로 각각 처음 로그인하고 Android 복귀를 확인한다. 이메일 권한이 없는 카카오 로그인, 프로필 생성·저장, 앱 재실행 후 세션 복구를 확인한다.
- 각 사용자로 일정 저장·조회·완료, 대화 이력, 인증 사진 업로드·다시 열기를 확인한다. 비공개 버킷과 RLS는 두 사용자 세션으로 상호 접근 차단을 확인한다.
- 시험 계정 하나만 앱 또는 공개 삭제 페이지에서 탈퇴한다. 해당 계정과 사진이 사라지고 다른 시험 계정의 데이터는 유지되어야 한다.
- Android에서 알림·정확한 알람 권한과 잠금 화면 알람, 연락처 선택, 카메라, MMS 작성, 한국어 STT/TTS를 실제 기기에서 확인한다.
- 새 팀 프로젝트에 `npm run setup:supabase -- --plan`을 다시 실행해 마이그레이션 대기 목록이 비었는지 확인한다.

로컬 SQL 회귀는 PostgreSQL과 같은 버전의 pgvector 확장 패키지를 설치한 뒤 저장소 루트에서 `./supabase/tests/run-local-postgres.sh`로 실행한다. Docker를 사용할 수 있다면 저장소 루트에서 `npx supabase@3.4.0 start`, `npx supabase@3.4.0 migration list`, `npx supabase@3.4.0 functions serve delete-account --env-file <로컬 Edge 변수 파일>` 순서로 로컬 스택을 사용할 수 있다. 로컬 Edge에는 시험할 웹 origin인 `ALLIT_WEB_ORIGIN`을 지정한다.

## 8. Google Play 출시

출시팀의 Play Console에서 앱 항목과 Play App Signing을 설정한다. 내부 테스트 트랙에 AAB를 올려 설치·인증·알람·사진 흐름을 검증한 뒤 프로덕션 심사에 제출한다. 앱 정책 설정의 개인정보 처리방침과 계정 삭제 URL에 공개 Pages 주소를 넣는다. Data safety, 앱 접근 안내 및 실제 사용 중인 알림·전체 화면 인텐트·포그라운드 서비스 선언을 앱 동작에 맞춰 작성한다. [계정 삭제 요구사항](https://support.google.com/googleplay/android-developer/answer/13327111) · [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)

## 팀 소유 날씨 Worker

`weather-schedule-app/server/wrangler.jsonc`에 Worker, SQLite Durable Object와 마이그레이션을 정의했다. Cloudflare 팀 계정으로 로그인하고 팀 account ID를 명시한다. `<TEAM_PAGES_ORIGIN>`은 경로 없는 HTTPS origin이다.

```bash
cd weather-schedule-app
export CLOUDFLARE_ACCOUNT_ID='<TEAM_ACCOUNT_ID>'
npx wrangler@4 login
npx wrangler@4 deploy --config server/wrangler.jsonc \
  --var 'ALLOWED_ORIGINS:<TEAM_PAGES_ORIGIN>,https://localhost'
npx wrangler@4 secret put KMA_SERVICE_KEY --config server/wrangler.jsonc
```

배포 결과가 보여주는 팀 Worker 주소에 `/weather`를 붙여 공개 빌드 변수에 제공한다. KMA 인증키는 Wrangler 프롬프트에서만 입력한다. 재배포에도 같은 CORS 입력을 제공한다. 향후 Workers AI도 팀 계정에서 바인딩을 코드화하고 같은 공개 URL·서버 비밀 분리 원칙을 적용한다. 이번 작업에는 AI 모델 연결, 임베딩 실행이나 별도 과금 인프라가 없다. [Wrangler 공식 명령](https://developers.cloudflare.com/workers/wrangler/commands/workers/) · [Worker 비밀 관리](https://developers.cloudflare.com/workers/configuration/secrets/)
