# 날씨와 일정 · 캐릭터 시스템 리포트

React Native, Expo SDK 58, TypeScript로 만든 상황 반응형 AI 컴패니언 앱입니다. 홈에서 오늘의 일정과 날씨를 확인할 수 있고, 캐릭터가 현재 상황에 맞는 대사와 포즈로 반응합니다. 현재 홈은 작성된 대사 35개와 앱에 포함된 한국어 음원을 사용합니다.

## 캐릭터 5명

| 캐릭터 | 성격과 대사 톤 |
| --- | --- |
| 나비 | 애교 많고 밝은 막내 손녀. 짧고 경쾌하게 말을 건네고 칭찬합니다. |
| 서윤 | 차분하고 꼼꼼한 손녀. 일정을 하나씩 확인하고 다정하게 챙깁니다. |
| 지은 | 따뜻하고 믿음직한 말벗. 공감과 쉬운 생활 안내를 건넵니다. |
| 준호 | 활기차고 든든한 손자. 힘찬 인사와 응원으로 분위기를 북돋습니다. |
| 도윤 | 수줍고 속 깊은 손자. 짧고 담백하게 안부를 묻습니다. |

캐릭터마다 인사, 밤 인사, 대기 일정, 일정 완료, 비, 눈, 낙뢰에 대한 대사와 서로 다른 목소리가 있습니다. 포즈는 기본 모습, 인사, 격려, 좋아요, 입 모양 등 기존 이미지 중에서 고릅니다.

## 대사·포즈·음성 연동

1. 홈은 일정의 시각·완료 여부, 기기의 현재 시각, 기존 날씨 훅이 제공하는 상태를 캐릭터 기능에 전달합니다. 홈의 일정 카드는 현재 샘플 데이터를 사용합니다.
2. 상황 판정은 최신 비·눈·낙뢰 상태, 야간, 일정 완료·대기, 기본 인사 순으로 적용합니다. 기상청 연동 설정은 [날씨 연동 안내](docs/WEATHER-INTEGRATION.md)에 있습니다.
3. 캐릭터 ID와 상황 키로 하단 대사, 포즈, 음원을 함께 고릅니다. 상황이 바뀌면 이전 음성을 멈추고 새 대사의 음성을 재생합니다.
4. 음성이 재생되는 동안, 기본 자세의 닫힌 입 이미지와 같은 자세의 열린 입 이미지를 재생 위치 기준 약 200ms 간격으로 전환합니다. 인사·격려·좋아요처럼 짝이 없는 포즈에는 React Native Animated로 미세한 상하 움직임을 줍니다. 음성이 끝나면 기본 자세로 돌아옵니다.
5. 이미지는 윤곽 마스크로 배경을 투명하게 표시합니다. 원본 종횡비를 유지하며 좌우에 안전 여백을 둡니다. 원본 사진의 프레임에서 이미 잘린 부분은 그대로 표시됩니다.

개발 데모에서는 테스트 날씨가 8초마다 바뀌고, 나비 → 서윤 → 지은 → 준호 → 도윤 순으로 각자의 대사·포즈·음성을 확인할 수 있습니다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| [characterTypes.ts](src/features/avatar/characterTypes.ts), [characters.json](src/features/avatar/characters.json) | 캐릭터 타입, 인물 설정, 포즈 목록 |
| [homeDialogueLines.ts](src/features/avatar/homeDialogueLines.ts) | 캐릭터별 상황 대사 |
| [homeDialoguePresentation.ts](src/features/avatar/homeDialoguePresentation.ts) | 일정·시간·날씨 우선순위와 데모 순서 |
| [characterVoices.ts](src/features/avatar/characterVoices.ts), [useHomeDialogueAudio.ts](src/features/avatar/useHomeDialogueAudio.ts) | 음원 매핑, 재생과 재생 상태 |
| [characterAssets.ts](src/features/avatar/characterAssets.ts), [characterOutlines.json](src/features/avatar/characterOutlines.json) | 기존 이미지 연결과 투명 윤곽 |
| [characterMotion.ts](src/features/avatar/characterMotion.ts), [AvatarView.tsx](src/components/home/AvatarView.tsx), [CharacterImage.tsx](src/components/home/CharacterImage.tsx) | 입 프레임 선택, 말하기 모션, 비율과 여백 |
| [useHomeDialogue.ts](src/features/avatar/useHomeDialogue.ts), [HomeScreen.tsx](src/screens/HomeScreen.tsx) | 상황을 실제 홈의 캐릭터와 대사창에 연결 |

## 실행 및 검증

Node.js 24 LTS 환경에서 저장소의 `weather-schedule-app` 폴더에서 실행합니다.

```sh
npm ci
npm run typecheck
npm start
```

터미널의 Expo 안내에 따라 Android 기기나 에뮬레이터에서 엽니다. 웹에서 다섯 캐릭터를 확인하려면 아래 명령으로 데모를 실행하고, 표시된 로컬 주소를 엽니다.

```sh
EXPO_PUBLIC_WEATHER_MODE=demo npm start -- --web
```

브라우저가 첫 자동 재생을 차단하면 화면을 한 번 클릭하거나 탭합니다. 데모를 보는 동안 탭을 활성 상태로 둡니다.

```sh
npm run test:avatar
npm test
```
