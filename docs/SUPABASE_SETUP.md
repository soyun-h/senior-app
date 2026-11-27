# Supabase 프로젝트 설정

이 문서는 CLI 개별 명령을 확인하기 위한 보조 문서다. 새 프로젝트의 초기화와 출시 빌드는 [RELEASE_GUIDE.md](RELEASE_GUIDE.md)의 `npm run setup:supabase` 절차를 따른다. 기존 연결 프로젝트는 개발·시험 전용이다.

## 공개 클라이언트 설정

1. Supabase Dashboard에서 대상 프로젝트를 열고 **Connect** 또는 **Settings → Data API**에서 Project URL을 확인한다. 기본 주소는 `https://<PROJECT_REF>.supabase.co`다.
2. **Settings → API Keys → Publishable keys**의 `sb_publishable_` 키를 복사한다.
3. `src/weather-schedule-app/.env.example`을 기준으로 `.env.local`에 다음 두 줄을 넣는다. Android APK 및 Pages 정적 파일에 들어가는 값이다.

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

URL의 `PROJECT_REF`는 실제 프로젝트의 소문자 slug로 바꾼다. `sb_secret_` 키, `service_role` 키, Google 및 Kakao Client Secret은 이 파일과 공개 빌드에 넣지 않는다. 설정을 변경하면 앱을 다시 빌드한다. 두 값이 없는 로컬 Android 빌드에서는 기존 기기 데모를 확인할 수 있다. Pages 빌드는 계정 설정을 요구한다.

## 운영 반영 전 확인

`supabase/migrations/202611270001_account_data.sql`은 기존 Auth 사용자 정보를 유지하고 앱 테이블과 비공개 버킷을 만든다. `202611270002_profile_onboarding.sql`은 프로필의 첫 설정 완료 시각을 추가한다. `202611270003_ai_foundation.sql`은 공개 RPC의 익명 권한을 정리하고 pgvector 및 비공개 RAG 테이블을 설치한다. `profiles` 등 같은 이름의 테이블이나 `verification-photos` 버킷, 같은 Auth 사용자에 Google 및 Kakao가 둘 다 연결된 기존 계정이 있으면 먼저 조사한다. 마이그레이션의 `auth.identities` 트리거는 새 교차 연결을 차단한다.

이후 테이블, 인덱스, RLS, 버킷, DB 함수, 트리거, 확장을 변경할 때는 `supabase/migrations/`에 더 큰 버전 번호의 SQL 파일을 추가한다. 이미 적용한 파일은 그대로 보존한다. Edge Function 소스와 배포 설정은 `supabase/functions/`와 `supabase/config.toml`에 보존한다. 새 팀은 자체 프로젝트에서 이 파일들을 순서대로 적용하고 소셜 로그인 공급자를 설정한 뒤, 자체 Project URL과 Publishable Key로 다시 빌드한다.

Supabase CLI 3.4.0에서 확인한 명령이다. 저장소의 `dev` 작업 폴더에서 먼저 프로젝트를 확인하고 적용 예정 목록을 검토한다.

```bash
npx supabase@3.4.0 login
npx supabase@3.4.0 projects list
npx supabase@3.4.0 link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase@3.4.0 migration list --remote
npx supabase@3.4.0 db query --remote="$SUPABASE_PROJECT_REF" --read-only --file supabase/tests/inspect_catalog.sql
npx supabase@3.4.0 db push --dry-run --remote --skip-vault
npx supabase@3.4.0 functions list --remote="$SUPABASE_PROJECT_REF"
```

실행 전에 `SUPABASE_PROJECT_REF`를 해당 프로젝트 ref로 설정한다. CLI의 `Target`과 마이그레이션 목록을 확인하고 초기화 대상 SQL을 검토한다. 직접 DB 연결에 IPv6 오류가 나면 Dashboard의 **Connect → Session pooler**에서 무료 IPv4 세션 연결을 사용한다. 반영은 카탈로그와 Dry Run 결과를 검토한 뒤 사용자 승인을 받아 진행한다. [Supabase CLI 로컬·원격 명령](https://supabase.com/docs/guides/local-development/local-and-hosted-projects)

IPv4 Session pooler가 필요한 경우, 신규 터미널에서 아래 명령을 실행할 수 있다. Dashboard의 Session pooler 주소에서 **호스트 이름만** 복사한다. DB 비밀번호는 화면에 표시되지 않으며 하위 셸이 끝나면 환경에서 사라진다.

```bash
(
  set -e
  : "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF first}"
  read -rp 'Session pooler host: ' allit_pooler_host
  read -rsp 'Database password: ' PGPASSWORD
  printf '\n'
  export PGPASSWORD
  allit_pooler_url="postgresql://postgres.${SUPABASE_PROJECT_REF}@${allit_pooler_host}:5432/postgres?sslmode=require"
  npx supabase@3.4.0 migration list --remote="$allit_pooler_url"
  npx supabase@3.4.0 db push --remote="$allit_pooler_url" --dry-run --skip-vault
)
```

다음 명령은 승인 이후의 운영 반영 절차다.

```bash
npx supabase@3.4.0 db push --remote --skip-vault
npx supabase@3.4.0 functions deploy delete-account --remote="$SUPABASE_PROJECT_REF" --use-api
npx supabase@3.4.0 migration list --remote
npx supabase@3.4.0 db query --remote="$SUPABASE_PROJECT_REF" --read-only --file supabase/tests/inspect_catalog.sql
```

SQL은 앱 테이블 8개의 RLS, 같은 소유자 외래키, 인증 사진의 Storage RLS를 함께 설치한다. Storage 화면에서 `verification-photos`가 Private이며 JPEG만 허용하고 한도가 1 MiB인지 확인한다. 관리자 Access Token과 DB 비밀번호는 CLI 로그인 또는 승인된 셸 비밀 저장소에서만 사용한다.

Edge Function은 Supabase가 주입하는 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 서버에서 읽는다. 함수 배포 시 기본 JWT 검증을 사용하고, 함수 내부에서도 `auth.getUser`로 호출자를 확인한다. 삭제 함수에 전달할 `user_id` 설정은 없다. 데이터 삭제 검증은 별도의 테스트 계정으로 한다.

## 검증과 비용

- PostgreSQL과 같은 버전의 pgvector 확장이 설치된 환경에서 `./supabase/tests/run-local-postgres.sh`로 정책을 검사한다. `supabase/tests/rls.sql`은 시험 사용자와 행을 만들고 마지막에 롤백하는 별도 테스트다.
- 실제 프로젝트 검증에서는 테스트 계정 두 개를 만들고 일정·대화·Storage 접근 범위 및 삭제 결과를 각각 확인한다. 사진은 서명 URL을 발급하는 대신 로그인 세션의 인증 다운로드를 사용한다.
- 공식 Free 요금제 표에는 프로젝트당 DB 500 MB, Storage 1 GB, 월간 인증 활성 사용자 50,000명, Edge Function 500,000회, 일반 egress 5 GB가 표시돼 있다. Free 프로젝트는 1주 비활동 시 일시 정지될 수 있다. 데이터 증가 및 제공량은 Dashboard에서 관리한다. [Supabase Free 요금제](https://supabase.com/pricing)
- 사진을 긴 변 1280px의 JPEG로 저장하고 300 KiB를 목표로 품질을 조정한다. 사진과 대화 조회는 페이지 단위다. 한도 또는 연결 문제가 발생하면 큐가 남고, 앱에서 동기화를 다시 시도할 수 있다.

로그인 공급업체 설정은 [AUTH_SETUP.md](AUTH_SETUP.md), 데이터 흐름은 [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md)에 있다.
