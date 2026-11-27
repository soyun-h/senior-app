# 올잇 Android 개발 및 실행

로컬 `dev`는 허소윤의 Expo 앱을 기반으로 한다. 문한나의 캐릭터·대화·녹음과 김가은의 사진 인증·음성 프로토타입을 함께 사용했다. `design`과 `wireframe`의 여섯 원본은 `design/individual/<이름>/` 및 `wireframes/<이름>/`에 있다.

`dev`의 병합 커밋에는 지정한 아홉 브랜치의 원본 커밋과 파일이 들어 있다. 충돌한 문한나의 `DialogueAvatar.tsx` 원본은 `members/문한나/`에 있다. 화면 연결 수정과 Android 네이티브 구현은 `dev` 작업 폴더의 미스테이징 변경으로 남겨 두었다. 아래 Capacitor 실행 명령은 이 작업 폴더의 전체 상태를 기준으로 한다.

| 원본 `origin` 브랜치 | 통합 위치 |
| --- | --- |
| `허소윤/members` | Expo 앱, 일정 UI와 저장소, 날씨 클라이언트와 Cloudflare Worker |
| `문한나/members` | 홈 캐릭터, 대사 엔진, 녹음 음성·이미지 및 관련 테스트 |
| `김가은/members` | 루트 웹 프로토타입, 사진 인증·음성 UI의 원본 자료 |
| `{김가은,문한나,허소윤}/{design,wireframe}` | 디자인 및 와이어프레임 원본 |

## Expo Go와 웹

```bash
cd src/weather-schedule-app
npm ci
cp -n .env.example .env.local
npm run typecheck
npm run typecheck:server
npm test
npx expo start --go --lan --port 8080
```

Expo Go는 앱 화면 확인에 사용할 수 있다. 아래 Android OS 기능은 Capacitor APK에서 제공한다. Expo Go의 LAN 연결에는 휴대전화에서 개발 서버의 주소와 포트에 접근할 수 있어야 한다.

`npm run web`은 Expo 웹 미리보기를 실행한다. `npm run build:web:pages`는 `EXPO_PUBLIC_ALLIT_SITE_URL`의 경로에 맞춰 `dist/`를 내보낸다. 호스트된 콘텐츠를 사용하는 테스트 APK는 같은 변수를 셸에서 설정한 뒤 `npm run android:pages`를 실행해 빌드한다. APK 내장 모드는 `npm run android:sync`, 출시용 환경 분리 빌드는 `npm run android:sync:release`다. 김가은의 웹 프로토타입은 저장소 루트의 `node serve.mjs`로 실행한다.

## Capacitor APK

필요한 도구는 Node.js 22 이상, JDK 21, Android SDK Platform 36과 Build Tools, Android Platform Tools다. Gradle Wrapper가 Gradle 8.14.3을 사용한다. Android Studio에서 `src/weather-schedule-app/capacitor-android`를 열어 같은 타깃을 실행할 수 있다. Linux 에뮬레이터의 하드웨어 가속은 `/dev/kvm` 접근이 필요하다. 실기기는 개발자 옵션에서 USB 디버깅을 허용한다.

```bash
cd src/weather-schedule-app
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$ANDROID_HOME/platform-tools:$PATH"
adb devices
npm run android:sync
cd capacitor-android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.allitcare.android.debug/com.allitcare.android.MainActivity
```

`assembleRelease`는 서명 전 릴리스 APK를 생성한다. debug 패키지는 `com.allitcare.android.debug`, 릴리스는 `com.allitcare.android`다. 시험 조작 UI와 HTTP 루프백은 디버그 빌드에서만 제공한다.

## ADB Live Reload

앱 폴더에서 `npx expo start --web --localhost --port 8090`을 실행하고 다른 터미널에서 다음을 실행한다.

```bash
adb reverse tcp:8090 tcp:8090
npm run android:live
cd capacitor-android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.allitcare.android.debug/com.allitcare.android.MainActivity
```

네이티브 코드·매니페스트를 바꾸면 APK를 빌드해 다시 설치한다. 작업 뒤 `adb reverse --remove tcp:8090`을 실행하고 `npm run android:sync`로 다음 내장 빌드를 준비한다.

## 구현 위치와 저장 방식

| 경로 | 역할 |
| --- | --- |
| `src/weather-schedule-app/App.tsx`, `src/features/schedules`, `src/screens` | 기존 일정 모델과 AsyncStorage 사용, 일정 편집·완료와 네이티브 예약 동기화, 보호자 및 사진 인증 화면 |
| `src/weather-schedule-app/src/features/android` | 브리지 타입과 네이티브 기능 호출, 보호자와 사진 기록의 앱 내 저장 |
| `src/weather-schedule-app/capacitor-android/app/src/main/java/com/allitcare/android` | `AllitPlugin`, `MainActivity`, 알람 예약·수신기·서비스·확인 화면, 사진 파일 관리 |
| `src/weather-schedule-app/capacitor.config.ts`, `app.config.ts`, `scripts/web-policy.mjs` | 웹 내장·GitHub Pages·Live Reload 설정 및 웹 콘텐츠 정책 |

일정과 완료 기록은 기존 AsyncStorage에 저장한다. 보호자와 인증 기록도 같은 저장 기술을 사용한다. Android 예약 정보와 미반영 알람 조작은 앱 전용 SharedPreferences에 보관한다. 반복 일정은 날짜별 완료 여부를 봐서 다음 알람을 예약한다. 사진 파일은 앱 전용 디렉터리에 보관하고, 시스템 카메라와 메시지 앱에 선택한 파일만 `content://` URI로 일시 공유한다.

브리지는 허용된 최상위 페이지에서만 작동한다. 내장 주소는 `https://localhost`, Pages 모드는 빌드에서 지정한 HTTPS origin과 시작 경로, Live Reload는 debug 빌드의 `http://127.0.0.1:8090`이다. 설정에 맞지 않는 탐색과 파일 접근을 차단한다. 원격 페이지는 같은 배포 출처의 업데이트를 신뢰하므로 게시할 파일에도 CSP가 적용된다. 원격 웹에 실패해도 기존 안드로이드 예약과 네이티브 종료 버튼은 기기에 남는다.

## 권한 및 기기 차이

| 권한 또는 OS 기능 | 목적 및 확인 방법 |
| --- | --- |
| `POST_NOTIFICATIONS` | Android 13 이상에서 시스템 사전 알림과 알람 알림에 필요하다. 앱의 설정 화면에서 허용한다. |
| `SCHEDULE_EXACT_ALARM` | Android 12 이상에서 정각 알람 예약에 사용하는 특별 접근 권한이다. 앱에서 알람 및 리마인더 설정을 연다. |
| `USE_FULL_SCREEN_INTENT` | 지원되는 기기의 잠금 화면 알람에 사용한다. Android 14 이상에서 꺼져 있으면 알람 알림을 눌러 화면을 연다. |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`, `VIBRATE` | 정각 알람의 사운드와 진동, 활성 알람 유지에 사용한다. 최대 재생 시간은 5분이다. |
| `RECEIVE_BOOT_COMPLETED` | 재부팅 후 Android 사용자 저장소를 처음 잠금 해제하면 예약을 복구한다. 시스템 설정의 강제 종료 상태에서는 앱을 다시 열어야 한다. |
| `INTERNET` | 원래의 공개 날씨 조회와 웹 호스팅·개발 서버 요청에 사용한다. 예약된 알람의 재생에는 연결이 필요 없다. |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | 기존 날씨 화면의 전경 위치 조회에 사용한다. 위치 권한을 거부하면 원래와 같이 대체 지역을 조회한다. |

시스템 선택기에서 사용자가 선택한 전화번호만 조회한다. 카메라·연락처·음성 입력에 쓰는 시스템 앱이 자체 권한 및 기기 기능을 관리한다. `READ_CONTACTS`, `CAMERA`, `RECORD_AUDIO`, `SEND_SMS`는 앱이 직접 요청하지 않는다. Android 11 이상의 AOSP 기본 메시지 앱에서는 앱 전용 외부 캐시의 사진 사본과 임시 UTF-8 본문을 함께 공유한 뒤 사용자가 수신자를 선택한다. 다른 메시지 앱에는 번호, 본문, 사진 URI를 넘긴다. 작성 화면에서 받는 사람과 첨부를 확인하고 사용자가 전송한다. 한국어 STT/TTS는 설치된 Android 서비스와 언어 데이터에 의존한다. 기존에 녹음된 캐릭터 음성은 별도로 동작한다.

Google Play 배포 전에는 앱 유형에 맞는 정확한 알람, 전체 화면 인텐트 및 포그라운드 서비스 선언과 심사를 확인해야 한다. 실기기에는 제조사 절전 정책과 메시지·카메라 앱 차이가 있다. 출시 서명, 스토어 등록, Pages 배포는 별도 단계다.

## 현장 테스트

1. 홈의 설정에서 알림과 알람 및 리마인더 권한을 확인한다. 디버그 APK의 **시험 알람 예약**은 30초 후 사전 알림과 1분 후 본 알람을 예약한다. 설정에 다음 알람 시각이 표시된다. 앱이 전경이면 정각에 확인 화면이 바로 열린다.
2. 일정에 알람을 켜고 사전 알림 시각을 설정한다. 앱을 종료하거나 화면을 끈 뒤 결과를 확인한다. 확인을 누르면 그 날짜의 일정이 완료된다. 일정 목록에서 먼저 완료로 표시하면 그날 알람이 취소된다.
3. **설정 → 보호자 연락처**에서 Android 연락처 선택기로 번호를 선택해 보호자로 등록한다. 한 명이면 기본 보호자로 사용한다. 여러 명이면 사용할 사람을 기본 보호자로 지정할 수 있으며, 지정 값은 기기에 계정별로 저장된다. **시험 카메라 열기** 또는 알람의 **사진으로 인증하기**에서 촬영하고 **등록하기**를 누른 뒤, 등록된 보호자의 이름과 번호가 표시된 **보호자에게 MMS 작성**을 확인한다. 보호자가 없으면 사진 인증 화면에서 먼저 등록할 수 있다. AOSP 메시지 앱에서는 사진과 본문을 첨부한 뒤 시스템 화면에서 수신자를 한 번 선택한다.
4. Android의 벨소리 모드를 무음·진동으로 바꾸거나 미디어 음량을 0으로 설정하고 홈을 연다. 홈의 녹음 대사와 말벗 음성 합성이 해당 설정을 따른다. 정각 알람은 Android의 별도 알람 볼륨을 사용한다. 한국어 STT/TTS 엔진이 없는 AOSP에서는 안내와 텍스트 입력을 확인할 수 있다.

홈 대사창의 **말벗 열기** 또는 **설정 → 말벗**에서 **음성 인식 시작**을 누른다. 알아들은 문장에 캐릭터가 바로 답한다. 다음 발화는 **계속 말하기**로 시작한다. 글 입력도 같은 대화 흐름과 저장 방식을 사용한다. Android 설치형 앱은 설치된 음성 서비스를 사용하며, 지원되는 웹 브라우저에서는 HTTPS 또는 localhost에서 브라우저의 음성 인식과 합성을 사용한다.

검증 이력은 [NATIVE_TEST_REPORT.md](NATIVE_TEST_REPORT.md)에 있다.

### Pages 배포 전 APK 시험

내장 웹 모드의 앱은 에뮬레이터와 실기기 모두 같은 WebView origin인 `https://localhost`를 사용한다. 설치된 폰에는 APK 안의 웹 번들이 들어 있으므로 Expo Go, USB 포트 역방향 연결 및 PC 개발 서버가 필요하지 않다.

| 구분 | 설정 |
| --- | --- |
| 계정 삭제 Edge Function CORS | 내장 APK의 `https://localhost`는 코드에 허용되어 있다. 별도 웹 브라우저에서 `http://localhost:8080` 또는 `http://localhost:8090`을 쓰면 개발 프로젝트의 `ALLIT_EDGE_ALLOW_LOCAL_DEV=1`을 사용한다. |
| Supabase OAuth Redirect | **Authentication → URL Configuration → Redirect URLs**에 디버그 APK의 `com.allitcare.android.debug.oauth://auth/callback`을 추가한다. 릴리스 패키지는 `com.allitcare.android.oauth://auth/callback`을 쓴다. |
| Google·카카오 공급자 콜백 | `https://<PROJECT_REF>.supabase.co/auth/v1/callback`이다. |
| REST·Storage | 인증 사용자의 JWT와 RLS를 적용한다. APK의 `https://localhost` 사전 요청은 개발 프로젝트에서 응답했다. |

Pages를 게시하면 삭제 함수의 `ALLIT_WEB_ORIGIN`에 해당 사이트의 HTTPS origin만 지정한다. Pages 없이 앱을 검증할 때는 비워도 된다. `setup:supabase`에서 `development`를 선택하면 공개 사이트 입력을 생략할 수 있다. 이 경우 기존 Supabase Site URL을 유지한다.

생성된 시험용 APK는 `src/weather-schedule-app/capacitor-android/app/build/outputs/apk/local-test/`에서 찾을 수 있다.

- `allit-native-test.apk`는 `com.allitcare.android.regression`이며, 로그인이 없는 별도 기기 전용 시험 빌드다. 알람·카메라·연락처·MMS 작성·음성 서비스를 먼저 확인한다.
- `allit-supabase-test.apk`는 개발용 Supabase를 연결한 `com.allitcare.android.debug`다. 로그인 버튼과 외부 브라우저를 확인할 수 있다. 앱 복귀와 계정별 데이터 검증은 개발 DB 및 함수 적용과 디버그 Redirect 등록이 끝난 뒤 진행한다.

폰의 개발자 옵션에서 USB 디버깅을 켜고 케이블로 연결한 뒤 화면의 RSA 확인을 승인한다. `adb devices -l`에서 폰의 시리얼을 확인한다.

```bash
cd src/weather-schedule-app/capacitor-android
adb -s <PHONE_SERIAL> install -r app/build/outputs/apk/local-test/allit-native-test.apk
adb -s <PHONE_SERIAL> shell am start -n com.allitcare.android.regression/com.allitcare.android.MainActivity
```

폰으로 APK 파일을 직접 복사해 설치할 수도 있다. 앱을 열고 설정에서 알림·알람 및 리마인더·전체 화면 알람 권한을 확인한다. **설정 → 보호자 연락처**에서 시험 번호를 먼저 등록한다. 시험 알람을 예약하고 홈 화면으로 나온 뒤 화면을 끄고 사전 알림과 정각 알람을 확인한다. 사진 인증 후 **보호자에게 MMS 작성**을 눌러 메시지 앱에서 수신자와 사진·본문 첨부를 검사한다.
