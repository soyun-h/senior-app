# 날씨와 일정 — Android 프로젝트 기반

React Native + Expo SDK 58 + TypeScript. 정식 출시는 Android만 대상으로 하며, iPhone Expo Go는 개발 확인용으로 허용합니다.
공식 `expo-template-blank-typescript@58.0.34` 기반이며 기존 저장소의 HTML·이미지를 사용하지 않습니다.

## 실행

Node.js 24 LTS와 npm을 권장합니다.

```sh
cd weather-schedule-app
npm ci
npm run typecheck
npm start
```

Android 휴대폰에서 현재 SDK를 지원하는 Expo Go를 설치하고 QR 코드를 스캔합니다.
개발 컴퓨터와 휴대폰은 같은 네트워크에 연결해야 합니다.
Cloud 작업 공간의 LAN 주소는 휴대폰에서 접근하지 못할 수 있으므로 로컬 컴퓨터 실행을 권장합니다.
Android 에뮬레이터가 있는 컴퓨터에서는 `npm run android`를 사용합니다.

## 구조

- `App.tsx`: 앱 진입 UI
- `index.ts`: Expo 루트 등록
- `src/screens/`: 화면
- `src/components/`: 아바타 표시 등 재사용 컴포넌트
- `src/theme/`: 색상·간격 등의 디자인 토큰
- `src/features/weather/types.ts`: 향후 기상청 어댑터가 사용할 날씨 데이터 계약
- `src/features/alarms/types.ts`: 날짜·시간·시간대를 포함한 일정 데이터 계약
- `src/features/avatar/types.ts`: 아바타 이미지·영상·음성 확장을 위한 데이터 계약
- `assets/`: 공식 템플릿의 임시 앱 아이콘
- `assets/design/`: 앞으로 추가할 디자인 이미지

현재 화면은 큰 글씨와 시스템 안전 영역을 적용한 정적 시작 화면입니다.
실제 날씨 조회·배경 전환·알람 예약·알림 권한·아바타 선택·미디어 재생·DB·회원가입은 구현하지 않았습니다.

## 다음 작업: Figma와 이미지

Figma 화면 링크와 대상 프레임, 폰트·색상·여백·상태별 디자인을 전달해 주세요.
사용 권한이 있는 신규 이미지를 `assets/design/`에 추가하고 정적 `require`로 연결할 수 있습니다.
기존 저장소 상위의 이미지와 HTML은 참조하지 않습니다.
디자인 토큰은 `src/theme/`, 공통 UI는 `src/components/`, 화면 구성은 `src/screens/`에서 확장합니다.
원격 미디어의 캐싱·다운로드·재생은 요구사항이 확정되면 별도 구현합니다.

## 출시와 실제 알림 테스트

이 프로젝트는 개발 기반이며 출시용 빌드는 아직 생성하지 않았습니다.
향후 Android applicationId(패키지명), 앱 아이콘, 서명키, 개인정보처리방침,
Play Console 데이터 보안 및 대상 API 요건을 확정해야 합니다.
기상청 API 키는 앱 번들에 비밀로 보관할 수 없으므로 서버 중계 필요 여부를 검토합니다.

알림 구현 단계에서는 Expo SDK에 맞는 알림 모듈을 설치하고 Android 알림 권한,
채널, 절전·재부팅·시간대 변경 및 정확한 알람 권한 필요성을 설계합니다.
Expo Go만으로 출시 동작을 보장할 수 없으므로 실제 기기의 Android development build에서 검증합니다.
향후 AAB 출시 빌드와 EAS 설정은 별도 작업입니다.

## 이번 작업의 검증 결과

- npm 패키지 설치 완료 (`package-lock.json` 포함)
- `npm run typecheck` 통과
- `npx expo install --check` 통과
- `npm run export:android` 통과 (Android JS/Hermes 번들 생성)
- Metro 개발 서버 및 Android manifest 응답 확인
- 실제 기기 UI와 APK/AAB 네이티브 빌드는 미검증

Cloud 환경의 읽기 전용 홈 디렉터리로 인한 캐시 오류는 검증 명령에서만
`npm_config_cache=/tmp/weather-schedule-npm-cache`,
`__UNSAFE_EXPO_HOME_DIRECTORY=/tmp/weather-schedule-expo`,
`XDG_CACHE_HOME=/tmp/weather-schedule-cache`로 우회했습니다.
이 설정은 프로젝트나 일반 로컬 실행 환경에 저장하지 않았습니다.

## 홈 UI (이번 구현)

`src/components/home/`에 배경, 아바타, 텍스트, 아이콘 버튼, 일정 카드,
안내 문구, 하단 내비게이션을 나누었습니다. 화면은 하나이며 다른 화면으로 이동하지 않습니다.
설정·할 일·달력 버튼은 표시만 하며 아직 비활성 상태입니다.

개발 모드에서 `useDemoWeather`가 앱 활성 상태일 때 8초마다
맑음 → 흐림 → 비 → 눈 → 번개를 순환합니다. 화면의 일정·13도·안내 문구는 참고 화면과
동일한 고정 테스트 데이터입니다. 기상청 출처 표시는 디자인 재현용이며 실제 조회는 하지 않습니다.
릴리스에서는 자동 순환이 꺼지고 기본 맑음 테스트 화면이 보입니다. 출시 전에 실데이터 연결이 필요합니다.

실제 API는 기존 `WeatherProvider` 계약으로 구현한 뒤 HomeScreen의 `weather` prop에
정규화한 WeatherSnapshot을 전달합니다. `presentation.ts`가 배경 상태와 안내 문구를 처리하며
guidance가 없으면 상태별 안내 문구를 생성합니다. unknown은 흐림 배경으로 처리합니다.
선택된 AvatarDefinition을 `avatar` prop에 전달하면 imageUri로 기본 이미지를 교체합니다.
videoUri·voiceId 계약은 유지하며 재생 기능은 구현하지 않았습니다.

360×730 앱 영역 기준 비율을 사용하고 Android 시스템 하단 영역은 안전 영역으로 남깁니다.
ZIP에 폰트·아이콘 원본이 없어 시스템 폰트와 SVG 선 아이콘을 사용하며 원본과 차이가 있을 수 있습니다.
실제 Android 기기에서 글꼴 확대·화면 비율·안전 영역 확인이 추가로 필요합니다.

로직 검증: `node --test tests/weather.test.mjs` (Node.js 24).
UI 검증: 개발 빌드에서 8초 간격으로 다섯 배경이 바뀌는지 확인하고,
일정·아바타·하단 UI가 유지되는지 확인하세요. 실제 날씨/알람 기능은 이번 범위에 포함되지 않습니다.


## iPhone Expo Go 개발 테스트

최종 출시는 Android 전용입니다. `app.json`의 platforms에 ios를 추가한 것은 Expo Go에서
JS를 실행하기 위한 설정이며, iOS 네이티브 프로젝트·bundleIdentifier·서명·배포 설정은 없습니다.
Android 설정과 기존 홈 UI·에셋·전환 로직은 유지합니다.

한국 App Store 조회 결과 Expo Go 58.0.5는 SDK 58 지원을 명시하며 iOS 16.4 이상이 필요합니다.
설치된 Expo Go를 최신 버전으로 업데이트하세요. 사용 기기에서의 실제 실행은 아직 미검증입니다.
현재 사용한 react-native-svg, safe-area-context, expo-status-bar는 Expo SDK 호환 검사에 통과했습니다.
현재 홈에는 별도 네이티브 모듈이 없으며 영상·음성·실제 알림 기능은 구현되어 있지 않습니다.

### Mac에서 확인하는 방법

```sh
git clone --single-branch --branch '허소윤/members' https://github.com/soyun-h/senior-app.git
cd senior-app/weather-schedule-app
npm ci
npm start -- --go
```

기존 복제본이 있으면 작업 내용을 보존한 뒤 해당 브랜치의 최신 변경을 받으세요.
Node.js 24 LTS를 권장합니다. Xcode와 iOS 프로젝트 생성은 Expo Go 테스트에 필요하지 않습니다.
Mac과 iPhone을 같은 Wi-Fi에 연결하고 iPhone 카메라로 터미널 QR을 스캔한 뒤
Expo Go에서 열기를 선택합니다. iOS 로컬 네트워크 접근 권한도 허용하세요.
홈의 배경이 8초마다 맑음·흐림·비·눈·번개로 바뀌는지 확인합니다.
안내 문구와 일정은 테스트 데이터입니다. 앱을 활성 상태로 유지해야 자동 전환됩니다.

같은 Wi-Fi에서 연결이 안 되면 Mac에서 다음 명령으로 공개 개발 터널을 사용할 수 있습니다.

```sh
npm start -- --go --tunnel
```

Expo CLI가 요청하는 ngrok 도구 설치에 동의한 후 새 QR을 사용하세요.
터널은 개발 서버가 실행되는 동안만 유효하고 공유 시 프로젝트 개발 리소스에 접근할 수 있으므로
테스트 후 Ctrl+C로 종료합니다. Expo 계정 로그인이 요청되면 본인 계정으로 로그인하세요.

### 검사 명령

```sh
npm run typecheck
npx expo install --check
node --test tests/weather.test.mjs
npx expo export --platform ios --output-dir dist-ios
npm run export:android
```

iOS JS/Hermes 번들 생성은 iPhone 기기 실행·서명된 iOS 빌드 검증을 의미하지 않습니다.
출시 빌드는 계속 Android 대상으로만 진행합니다.


### 이번 Cloud 검증 결과

- TypeScript·Expo 의존성 검사·날씨 로직 테스트 2개 통과.
- iOS 및 Android JS/Hermes 번들 생성 통과, 원본 배경·아바타 6개 포함.
- Cloud 기본 터널은 Expo 로그인 미설정으로 실패했습니다.
- 로그인 없이 사용하는 `--tunnel ngrok`도 연결 시간 초과로 실패했습니다.
- 따라서 외부 iPhone이 접속할 수 있는 URL·QR을 확보하지 못했습니다.
- 실제 iPhone 실행은 미검증입니다. 위 Mac 실행 방법으로 확인하세요.
- 터널 검증 도구는 일시 설치했으며 프로젝트 의존성·lockfile에 저장하지 않았습니다.

## 컴퓨터 브라우저 웹 미리보기

웹은 개발·디자인 확인용이며 최종 출시는 Android 전용입니다.
기존 홈 UI·날씨 순환 코드는 수정하지 않았습니다.
Expo SDK 58 호환 react-dom 19.3.0, react-native-web ~0.21.4,
@expo/metro-runtime ~58.0.17을 추가하고 platforms에 web을 허용했습니다.
기존 저장소의 index.html은 사용하지 않으며 Expo가 웹 문서를 생성합니다.

Mac에서 이 작업 파일이 있는 프로젝트 폴더를 연 뒤:

```sh
npm ci
npx expo start --web
```

또는 `npm run web`을 사용합니다. 터미널에 표시된 localhost 주소를 같은 Mac의 브라우저에서 여세요.
Cloud의 localhost 주소는 사용자 컴퓨터에서 열리는 주소가 아닙니다.
브라우저 개발자 도구의 기기 툴바에서 360×730 또는 390×844로 설정하면 모바일 비율을 확인할 수 있습니다.
데스크톱에서는 같은 비율의 홈 화면이 중앙에 표시됩니다.
탭을 활성 상태로 두면 8초마다 다섯 배경이 순환하며 백그라운드 탭에서는 브라우저 타이머 제한이 적용될 수 있습니다.
웹에서는 Android 알림·시스템 동작을 검증하지 않습니다.
이번 변경은 아직 GitHub에 커밋·푸시하지 않았으므로 원격 복제본만으로는 웹 설정이 포함되지 않습니다.

## 기상청 운영 연동 구조

기본 날씨 모드는 이제 live입니다. 인증키/서버 주소가 없으면 실제 온도 대신 설정 안내가 표시됩니다.
8초 디자인 테스트는 개발 모드에서만 `EXPO_PUBLIC_WEATHER_MODE=demo`로 켭니다.
위의 과거 '기본 맑음 테스트 화면' 설명은 이 설정으로 대체됩니다.
운영 설정·키 보호·캐시·시간 해석·검증 한계는 `docs/WEATHER-INTEGRATION.md`를 참고하세요.
서버와 실제 기상청 연결은 아직 배포·검증하지 않았습니다.
