# 캐릭터 시스템 리포트

`문한나/members` 브랜치에서 문한나가 담당한 **캐릭터 모듈**을 정리한 문서다. 홈 화면에 캐릭터 5인을 고정 이미지로 표시하고, 시간·날씨·일정에 맞는 대사와 음성을 연결한다.

이 폴더(`weather-schedule-app`)는 팀 공용 앱이다. 날씨·서버·일정 코드(`server/`, `shared/`, `src/features/weather/` 등)는 허소윤 담당이며, 캐릭터 작업에서는 수정하지 않는다. 캐릭터 담당 파일은 아래 1번 표에 모았다.

## 1. 캐릭터 담당 파일

| 구분 | 경로 | 내용 |
| --- | --- | --- |
| 이미지 | `assets/characters/char1~5/` | 캐릭터별 자세 이미지(`idle`·`wave`·`ok`·`encourage`, 810×1080 JPG)와 `profile`(512×512) |
| 음성 | `assets/voices/` | 캐릭터 × 상황 7종 음원 35개(`.m4a`) |
| 설정 | `src/features/avatar/characters.json`, `characterConfig.ts` | 캐릭터 5인 설정, 자세 대체 규칙, 공통 대화 규칙 |
| 대사 | `src/features/avatar/homeDialogueLines.ts` | 캐릭터 × 상황별 홈 대사 35줄 |
| 상황 선택 | `src/features/avatar/homeDialoguePresentation.ts`, `useHomeDialogue.ts` | 상황 우선순위, 상황별 자세(`homePoses`), 데모 순서 |
| 음성 재생 | `src/features/avatar/characterVoices.ts`, `useHomeDialogueAudio.ts` | 음원 연결, 재생 상태(`waiting`·`speaking`·`done`), 다시 듣기 |
| 이미지 연결 | `src/features/avatar/characterAssets.ts`, `characterOutlines.json` | 자세 이미지 연결, 배경을 지우는 윤곽선 |
| AI 대화 | `src/features/avatar/characterBrain.ts` | 캐릭터별 대화 프롬프트 구성 |
| 타입 | `src/features/avatar/characterTypes.ts` | `CharacterId`, `Pose`, `HomeDialogueSituation` |
| 화면 | `src/components/home/DialogueAvatar.tsx`, `AvatarView.tsx`, `CharacterImage.tsx`, `CharacterDialogue.tsx` | 캐릭터 고정 이미지, 상황 자세 전환, 대사창 |
| 테스트 | `tests/avatar*.test.mjs`, `tests/home-weather-layout.test.mjs` | 캐릭터 설정, 상황·자세 선택, 일정 연결, 홈 배치 |

## 2. 실행 및 검증

`weather-schedule-app` 폴더에서 Node.js 24 LTS로 실행한다.

```sh
npm ci                # 의존성 설치
npm run typecheck     # tsc --noEmit
npm test              # 전체 테스트
npm run test:avatar   # 캐릭터 모듈 테스트만 실행
npm start             # Expo 개발 서버
```

`npm start` 후 터미널에 나오는 Expo 안내에 따라 Android 기기나 에뮬레이터에서 연다.

## 3. 캐릭터 5인 구성

| ID | 이름 | 관계·나이 | 성격 | 대사 톤 |
| --- | --- | --- | --- | --- |
| `char1` | 나비 | 막내 손녀, 17살 여고생 | 애교가 많고 밝다. 칭찬을 아끼지 않는다. | 하이톤. "~해요!", "헤헤"로 문장 끝을 올린다. |
| `char2` | 서윤 | 손녀, 18살 모범생 | 차분하고 꼼꼼하다. | 또박또박한 존댓말. 순서대로 확인하는 말투다. |
| `char3` | 지은 | 말벗, 22살 간호학과 대학생 | 다정하고 공감을 먼저 한다. | 부드러운 말투. 공감한 뒤 짧게 덧붙인다. |
| `char4` | 준호 | 손자, 21살 대학생 | 활기차고 살갑다. | "와", "오" 같은 감탄사가 많고 힘차게 말한다. |
| `char5` | 도윤 | 손자, 18살 남고생 | 쑥스럽지만 속이 깊다. | 짧고 담백하다. 말 앞에 "…"으로 머뭇거린다. |

캐릭터마다 상황 7종(`greeting`, `night`, `schedulePending`, `scheduleComplete`, `rain`, `snow`, `thunder`)의 대사 1줄과 음원 1개가 있어 홈 대사는 모두 35줄이다.

## 4. 홈 화면 동작

1. **상황 선택**: 시각, 일정 완료 여부, 날씨로 상황을 하나 고른다. 우선순위는 낙뢰·눈·비 → 밤(22시~6시) → 일정 완료 → 남은 일정 → 인사 순이다.
2. **대사·음성**: 캐릭터 ID와 상황으로 대사(`homeDialogueLines`)와 음원(`characterVoices`)을 정하고 재생한다.
3. **캐릭터 자세**: 움직임 없이 고정 이미지만 쓴다. 말하는 동안 상황 자세를 보여 주고, 대사가 끝나면 기본 자세(`idle`)로 바로 바꾼다. 캐릭터를 누르면 대사를 처음부터 다시 들려준다.

   | 상황 | 자세 |
   | --- | --- |
   | 인사 | `wave` (손 흔들기) |
   | 남은 일정 | `encourage` (격려) |
   | 일정 완료 | `ok` |
   | 밤, 비·눈·낙뢰 | `idle` |

4. **대사창**: 날씨 안내 위(bottom 183)에 상황 대사를 표시한다.
5. **날씨 안내·하단 메뉴**: 날씨 안내(`WeatherMessage`, bottom 90)와 하단 내비게이션(`BottomNavigation activeTab="home"`)은 허소윤/members의 구성을 그대로 쓴다.
6. **일정 연결**: 대사 선택은 홈 카드 일정의 `time`(`H:MM`)과 `completed`를 쓴다. 허소윤 preview/schedules의 `homeSchedules()`가 같은 형식으로 실제 일정을 넘기므로 합쳐도 그대로 동작한다.

## 5. 에셋 현황

| 캐릭터 | 자세 이미지 (`assets/characters/<id>/`) | 음원 (`assets/voices/`) | 비고 |
| --- | --- | --- | --- |
| `char1` 나비 | `idle`, `wave`, `ok`, `encourage`, `profile` | `char1.m4a` 외 6개 | `wave`·`encourage` 왼쪽 어깨 보완본 대기 |
| `char2` 서윤 | `idle`, `wave`, `ok`, `encourage`, `profile` | `char2.m4a` 외 6개 | |
| `char3` 지은 | `idle`, `wave`, `ok`, `encourage`, `profile` | `char3.m4a` 외 6개 | 네 자세 모두 잘린 팔 보완본 |
| `char4` 준호 | `idle`, `wave`, `ok`, `encourage`, `profile` | `char4.m4a` 외 6개 | `ok` 어깨 보완본, `encourage` 추가 |
| `char5` 도윤 | `idle`, `wave`, `ok`, `encourage`, `profile` | `char5.m4a` 외 6개 | `idle`·`ok`·`wave` 어깨 보완본, `encourage` 추가 |

이미지는 `characterOutlines.json`의 윤곽선으로 배경을 잘라 표시한다. 입 모양 이미지와 립싱크, 캐릭터 움직임, 대사 영상 재생 코드는 쓰지 않기로 해 저장소에서 뺐다(6번 참고).

## 6. 변경 과정과 결정

캐릭터 표시 방식은 아래 순서로 바뀌었다. 커밋은 모두 `문한나/members` 브랜치 기준이다.

### 6-1. 캐릭터 이미지 파일

| 시기 | 변경 | 이유 |
| --- | --- | --- |
| 11월 18일 | 5인의 `idle`·`wave`·`ok`·`profile`, 나비·서윤의 `encourage` 이미지 반영 | 홈 상황별 자세 준비 |
| 11월 19일 | 나비 입 모양(아·이·오) PNG, 이어서 5인 입 모양(아·에·이·오·우) 반영. 입꼬리 잔상 제거, 도윤 `idle` 어깨 보완 | 대사 음성에 맞춘 입 움직임 시도 |
| 11월 21~22일 | 팀원 2명에게 20장 재생성을 나눠 요청하고 18장을 받음. 지은 `idle`·`ok`·`wave`의 잘린 팔, 준호 `ok`와 도윤 `ok`·`wave`의 잘린 어깨를 보완본으로 교체. 지은·준호·도윤 `encourage` 추가 | 배경을 지우면 잘린 부분이 그대로 드러남. 5인 모두 같은 자세 4종을 갖추기 위함 |
| 11월 22일 | 입 모양 PNG·JPG를 저장소에서 삭제(원본은 저장소 밖에 보관) | 홈에서 입을 움직이지 않기로 결정 |

나비 `encourage`·`wave`의 왼쪽 어깨 보완본 2장은 아직 받지 못해 기존 이미지를 쓴다.

### 6-2. 홈 캐릭터 표시 방식

| 단계 | 커밋 | 방식 | 결과 |
| --- | --- | --- | --- |
| 1 | `fb61933`~`9e7fb4d` (11/19) | 입 모양 전환(립싱크). 3모음·5모음 세트, 최소 유지 시간 0.11초, 60ms 겹침 전환 | 입이 음성과 어긋나고 너무 빠르게 바뀌어 부자연스러움 |
| 2 | (검토만) | 상황별 대사 영상(mp4)으로 대체 | 배경 투명 불가, 첫·끝 장면을 `idle`과 맞춰야 함, 5인 × 7상황 = 35개 제작 부담, 영상 생성 도구 사용 제한으로 보류 |
| 3 | `faffe5a` (11/19) | 입 움직임과 영상 재생을 끄고 고정 `idle` 이미지 + 음성 | 날씨 안내도 함께 빠져 이후 복구. 영상 재생 코드는 11/25에 삭제 |
| 4 | `ac9aeec`·`0b57d94` (11/23~24) | 상황 자세 + 등장·말하는 중·대기 움직임, 누르면 다시 듣기 | 화면 확인 전 피드백을 받음 |
| 5 | `78d2570` (11/25) | 고정 이미지. 말하는 동안 상황 자세, 대사가 끝나면 `idle`. 다시 듣기 유지 | 현재 상태 |

### 6-3. 피드백과 결정 (11월 25일)

- 받은 피드백: 아바타는 일단 고정 이미지로 제작하거나, 동작까지 꼭 구현하려면 GIF 방식을 고려한다.
- GIF 검토 결과
  - 256색 제한으로 사진형 캐릭터의 얼굴·머리카락에 얼룩이 생긴다.
  - 투명이 켜짐·꺼짐 두 단계뿐이라 머리카락 가장자리가 계단처럼 깨진다.
  - 짧은 동작도 용량이 커서 35개를 넣기 어렵고, 음성이 끝날 때 맞춰 멈추기 어렵다.
- 결정: 고정 이미지로 간다. 입 모양과 캐릭터 움직임(등장, 말하는 중 움직임, 떠 있는 움직임)은 모두 뺐다.
- 이후 움직임이 필요하면 GIF 대신 움직이는 WebP로 캐릭터별 인사 동작 1개(총 5개)만 만들고, 마지막 장면을 `idle`과 같게 맞춰 고정 이미지로 이어지게 한다.

### 6-4. 날씨 안내 배치

- 11월 19일: 대사창과 날씨 안내(`WeatherMessage`)가 같은 위치에 겹쳐 대사창을 위로 옮겼다.
- 11월 19일 밤: `faffe5a`에서 날씨 안내가 홈에서 빠졌다.
- 11월 23일: 허소윤/members 기준으로 날씨 안내와 공용 하단 내비게이션을 다시 반영했다. 캐릭터 대사창은 날씨 안내 위에 둔다.

## 7. 남은 일

- 나비 `wave`·`encourage`의 왼쪽 어깨 보완본을 받으면 교체한다.
- 움직임이 필요해지면 움직이는 WebP로 캐릭터별 인사 동작 1개씩(총 5개)을 만들고, 마지막 장면을 `idle`과 같게 맞춘다.
- `package.json`의 `expo-video`는 지금 쓰지 않는다. 의존성 정리는 팀 브랜치를 합칠 때 함께 한다.
