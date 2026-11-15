# 날씨와 일정 — Android 프로젝트 기반

React Native + Expo SDK 58 + TypeScript. Android만 대상으로 합니다.
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
