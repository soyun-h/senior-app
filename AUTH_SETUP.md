# Google 및 카카오 인증 설정

이 문서는 기존 개발 환경의 검증 주소를 포함한다. 출시팀은 새 프로젝트 기준의 [출시 가이드](RELEASE_GUIDE.md)에서 입력값을 확인한다.

## Redirect URI

| 입력 위치 | 값 |
| --- | --- |
| Google Authorized redirect URIs | Supabase Dashboard의 Google Provider에 표시되는 `https://<PROJECT_REF>.supabase.co/auth/v1/callback` |
| Kakao Login Redirect URI | Supabase Dashboard의 Kakao Provider에 표시되는 `https://<PROJECT_REF>.supabase.co/auth/v1/callback` |
| Supabase Authentication → URL Configuration → Site URL | `https://soyun-h.github.io/senior-app/` |
| Supabase Redirect URLs, Pages 기본 화면 | `https://soyun-h.github.io/senior-app/` |
| Supabase Redirect URLs, 직접 index.html 주소도 사용한다면 | `https://soyun-h.github.io/senior-app/index.html` |
| Supabase Redirect URLs, 외부 삭제 화면 | `https://soyun-h.github.io/senior-app/delete-account.html` |
| Supabase Redirect URLs, Android 릴리스 | `com.allitcare.android.oauth://auth/callback` |
| Supabase Redirect URLs, Android debug | `com.allitcare.android.debug.oauth://auth/callback` |
| 로컬 브라우저를 8080에서 테스트할 때 추가 | `http://localhost:8080/`, `http://localhost:8080/delete-account.html` |
| 로컬 브라우저를 8090에서 테스트할 때 추가 | `http://localhost:8090/`, `http://localhost:8090/delete-account.html` |

Android는 `applicationId`에 `.oauth`를 붙인 URI를 처리한다. 패키지명은 릴리스 `com.allitcare.android`, 디버그 `com.allitcare.android.debug`다. 이번 방식은 Google Android SDK와 Kakao Android SDK의 네이티브 로그인을 사용하지 않고 Supabase의 웹 OAuth를 외부 시스템 브라우저에서 연다. 공급업체의 웹 OAuth 클라이언트에 Android 서명 SHA-1, Kakao 네이티브 키나 앱 링크 파일을 등록할 필요는 없다. 사용자가 WebView에서 대기한 채 시스템 브라우저에서 인증을 마치면 앱으로 돌아오고, PKCE 코드를 세션으로 교환한다. Custom URI가 앱을 열어도 로컬 PKCE 검증값이 없으면 세션이 발급되지 않는다. [Supabase Redirect 설정](https://supabase.com/docs/guides/auth/redirect-urls) · [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)

## Google Auth Platform

1. Google Cloud 프로젝트에 **Google Auth Platform → Branding**, **Audience**를 설정한다. Testing 상태일 때 로그인할 테스트 Google 계정들을 Test users에 등록한다.
2. **Clients → Create client → Web application**을 선택한다.
3. **Authorized JavaScript origins**에 `https://soyun-h.github.io`를 넣는다. 로컬 브라우저를 사용할 경우 실제 테스트 origin을 추가한다. Origin에는 `/senior-app/` 경로가 없다.
4. **Authorized redirect URIs**에 위 표의 Supabase `/auth/v1/callback` 주소를 복사한다.
5. Client ID와 Client Secret은 Supabase Dashboard의 **Authentication → Sign In / Providers → Google**에 입력하고 활성화한다. [Supabase Google 설정](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

## Kakao Developers

1. 대상 앱의 REST API 앱 키를 확인하고 **카카오 로그인**을 활성화한다. 로그인 Client Secret을 사용하는 설정에서 Secret을 발급하고 활성화한다.
2. 카카오 로그인 Redirect URI에 Supabase의 `/auth/v1/callback` 주소를 등록한다.
3. 동의 항목에서 `profile_nickname`, `profile_image`를 사용하고, `account_email`은 끈다. Android 앱과 외부 삭제 페이지는 같은 로그인 모듈에서 Supabase의 기본 카카오 권한을 `scope=profile_nickname profile_image`로 지정한다. 프로젝트가 실제로 카카오에 두 권한만 전달하는 것을 확인했다. [Supabase의 기본 Kakao 권한](https://github.com/supabase/auth/blob/master/internal/api/provider/kakao.go)
4. Supabase Dashboard의 **Authentication → Sign In / Providers → Kakao**에 REST API 앱 키와 Client Secret을 입력하고 **Allow users without an email**을 켠다.
5. Supabase의 수동 ID 연결은 비활성 상태로 유지한다. 표준 Kakao 구성에서는 Google의 이메일과 비교할 이메일이 없으므로 계정이 분리된다. Auth에서 설정 오류로 두 공급업체의 연결을 시도하면 DB 트리거가 이를 거부한다. [Supabase Kakao 설정](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao) · [Supabase 자동 계정 연결](https://supabase.com/docs/guides/auth/auth-identity-linking)

## 빌드와 테스트

- 위 로컬 웹 Redirect를 시험하려면 앱 폴더에서 `npx expo start --web --localhost --port 8080`을 실행하고 `http://localhost:8080/`으로 연다. Android에서의 복귀 주소는 로컬 웹 서버를 사용하는 경우에도 앱 패키지의 Deep Link다.
- Pages GitHub Actions를 운영자가 추가하거나 사용하는 경우 Repository Variables에 `EXPO_PUBLIC_SUPABASE_URL`과 `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 등록하고 `npm run build:web:pages` 스텝의 환경변수로 넘긴다. `weather-schedule-app/dist`가 배포 산출물이다. OAuth 비밀값은 공급업체 설정에만 들어간다. 기존 원격 설정은 이번 작업에서 수정하지 않았다.
- 로컬 Android에서 `npm run android:sync` 후 Gradle APK를 빌드한다. Pages URL을 불러오는 APK는 `npm run build:web:pages && npm run android:pages` 후 빌드한다. Linux 실행은 [ANDROID_DEVELOPMENT.md](ANDROID_DEVELOPMENT.md)를 참고한다.
- 배포 예정 개인정보 처리방침은 `https://soyun-h.github.io/senior-app/privacy.html`, 외부 삭제 화면은 `https://soyun-h.github.io/senior-app/delete-account.html`이다. 배포 전에 개인정보 처리방침의 운영자, 담당 이메일과 보관 정책을 확정한다.
- 지정된 기본 Pages 주소는 공개 조회에서 HTTP 404를 반환했다. 로컬 정적 빌드에서 `/senior-app/` 아래의 앱 진입점과 두 페이지를 검증했다. 배포 후 세 URL의 실제 응답과 웹 OAuth 복귀를 다시 확인한다.
- 두 페이지를 실제로 배포하고 테스트한 후 Play Console의 앱 콘텐츠 및 Data safety에서 개인정보 처리방침과 외부 계정 삭제 주소를 사용한다. [Google Play 계정 삭제 요구사항](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- 각 제공업체에서 신규 가입·기존 계정·취소를 각각 확인한다. Android 브라우저에서 로그인 진행 중 앱을 배경으로 보낸 경우와 `am kill`로 프로세스를 종료한 경우도 시험한다. 이미 소비한 콜백, 다른 URI, 코드 없이 돌아온 경우를 검사하고, 앱 재시작 및 토큰 만료 후 세션을 확인한다. 전경에서 돌아온 뒤 로그인 화면의 **로그인 취소**로 대기 중인 요청을 취소할 수 있다.
- Android에서는 세션과 진행 중인 로그인별 PKCE 검증값을 Keystore AES-GCM 저장소에 보관한다. 독립 웹에서는 IndexedDB를 사용한다. 취소하면 대기 중인 요청과 해당 PKCE 검증값이 제거된다. 웹에서 동일 Pages origin의 코드가 공유되는 점을 고려해 신뢰할 수 있는 콘텐츠만 동일 origin에 게시한다.
