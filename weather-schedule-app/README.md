# 캐릭터 시스템 리포트

이 문서는 `weather-schedule-app`에서 문한나가 담당한 캐릭터 모듈을 정리한다. 담당 범위는 캐릭터 5인의 상태 관리, 상황별 대사·포즈·음성 연동, 그리고 립싱크와 대사 영상 재생이다. 코드는 React Native, Expo SDK 58, TypeScript로 작성했다.

## 1. 실행 및 검증

저장소의 `weather-schedule-app` 폴더에서 Node.js 24 LTS로 실행한다.

```sh
npm ci                # 의존성 설치
npm run typecheck     # tsc --noEmit
npm test              # node --test tests/*.test.mjs
npm run test:avatar   # 캐릭터 모듈 테스트만 실행
npm start             # Expo 개발 서버
```

`npm start` 후 터미널에 나오는 Expo 안내에 따라 Android 기기나 에뮬레이터에서 연다.

## 2. 캐릭터 5인 구성

인물 설정은 `src/features/avatar/characters.json`에 있고, 홈 대사는 `src/features/avatar/homeDialogueLines.ts`에 있다.

| ID | 이름 | 관계·나이 | 성격 | 대사 톤 |
| --- | --- | --- | --- | --- |
| `char1` | 나비 | 막내 손녀, 17살 여고생 | 애교가 많고 밝다. 칭찬을 아끼지 않는다. | 하이톤. "~해요!", "헤헤"로 문장 끝을 올린다. |
| `char2` | 서윤 | 손녀, 18살 모범생 | 차분하고 꼼꼼하다. | 또박또박한 존댓말. 순서대로 확인하는 말투다. |
| `char3` | 지은 | 말벗, 22살 간호학과 대학생 | 다정하고 공감을 먼저 한다. | 부드러운 말투. 공감한 뒤 짧게 덧붙인다. |
| `char4` | 준호 | 손자, 21살 대학생 | 활기차고 살갑다. | "와", "오" 같은 감탄사가 많고 힘차게 말한다. |
| `char5` | 도윤 | 손자, 18살 남고생 | 쑥스럽지만 속이 깊다. | 짧고 담백하다. 말 앞에 "…"으로 머뭇거린다. |

캐릭터마다 상황 7종(`greeting`, `night`, `schedulePending`, `scheduleComplete`, `rain`, `snow`, `thunder`)의 대사 1줄과 녹음 음원 1개가 있어 홈 대사는 모두 35줄이다.

## 3. 대사·포즈·음성 연동 구조

1. 홈 화면이 외부 상태(시각, 일정 완료 여부, 상황 조건)를 `homeDialoguePresentation.ts`에 넘긴다. 이 파일이 상황 키(`HomeDialogueSituation`) 하나를 고른다. 우선순위는 `thunder`·`snow`·`rain`, `night`(22시~6시), `scheduleComplete`, `schedulePending`, `greeting` 순이다.
2. 캐릭터 ID와 상황 키로 대사와 음원을 정한다.
   - 대사: `homeDialogueLines[characterId][situation]`
   - 음원: `characterVoices[characterId][situation]`(`assets/voices/*.m4a`)
3. `DialogueAvatar.tsx`가 재생 방식을 고른다.
   - `getDialogueMedia()`(`dialogueMedia.ts`)가 해당 캐릭터의 `dialogue/` 폴더에서 상황 키에 맞는 영상(`<situation>.mp4`)을 찾으면 영상을 재생한다. 영상 속 음성을 쓰고, 끝나면 `idle` 포즈로 돌아간다.
   - 영상이 없거나 재생에 실패하면 `useHomeDialogueAudio`로 `.m4a`를 재생하고 이미지로 입을 움직인다.
4. 이미지로 입을 움직이는 방식은 두 가지다. 홈 화면은 몸을 `idle`로 고정한다.
   - 입 모양 PNG 세트가 있으면 `estimateMouthCues()`가 한글 음절과 음원 길이로 입 모양을 고른다. 기본 세트(`mouthSet = 'aio'`)는 에를 이로, 우를 오로 합쳐 아·이·오 3장만 쓴다. 110ms 미만 모양은 앞 모양에 합치고, 중간 쉼은 150ms 이상일 때만 표시한다. ㅁ·ㅂ·ㅍ은 받침에서만 닫힌 입 후보가 된다.
   - PNG 세트가 불완전하면 기존 `mouth_a` JPG로 200ms 간격의 입 모양 전환을 적용한다.
   - 이미지 재생에서는 `idle` 자세를 고정하고 음성이 나오는 동안 입 주변 영역만 약 60ms에 걸쳐 전환한다. 쉼이나 음성 종료 시에는 기본 입 모양이 보인다.

## 4. 에셋 규격 및 현재 반영 현황

### 기존 포즈 이미지와 음원

| 캐릭터 | 포즈 이미지 (`assets/characters/<id>/`, 810×1080 JPG) | 음원 (`assets/voices/`) |
| --- | --- | --- |
| `char1` 나비 | `idle`, `wave`, `ok`, `encourage`, `mouth_a`, `mouth_o`, `mouth_i`, `profile`(512×512) | `char1.m4a` 외 6개 |
| `char2` 서윤 | `idle`, `wave`, `ok`, `encourage`, `mouth_a`, `mouth_o`, `profile` | `char2.m4a` 외 6개 |
| `char3` 지은 | `idle`, `wave`, `ok`, `mouth_a`, `profile` | `char3.m4a` 외 6개 |
| `char4` 준호 | `idle`, `wave`, `ok`, `mouth_a`, `profile` | `char4.m4a` 외 6개 |
| `char5` 도윤 | `idle`, `wave`, `ok`, `mouth_a`, `profile` | `char5.m4a` 외 6개 |

### 캐릭터 ID와 이름

코드와 에셋 경로는 캐릭터 ID를 쓴다.

| ID | 이름 | 에셋 폴더 |
| --- | --- | --- |
| `char1` | 나비 | `assets/characters/char1/` |
| `char2` | 서윤 | `assets/characters/char2/` |
| `char3` | 지은 | `assets/characters/char3/` |
| `char4` | 준호 | `assets/characters/char4/` |
| `char5` | 도윤 | `assets/characters/char5/` |

### 선택형 에셋 규격

경로는 캐릭터마다 `assets/characters/<id>/dialogue/`이다. `dialogueMedia.ts`의 `require.context`가 이 폴더에서 아래 이름만 읽는다.

| 파일 | 규격 |
| --- | --- |
| `mouth_a.png`, `mouth_i.png`, `mouth_o.png` | 같은 캐릭터의 `<id>_idle.jpg`와 같은 810×1080, 배경 투명 PNG. 기본 세트에서 3장이 모두 있을 때 적용한다. |
| `mouth_e.png`, `mouth_u.png` | 같은 규격. `mouthSet`을 `'aeiou'`로 바꾸면 5장이 모두 있는 캐릭터에서 쓴다. 기본 세트에서는 보관만 한다. |
| `greeting.mp4` | 인사 영상. 해당 캐릭터의 `greeting` 음원(`<id>.m4a`)을 포함한다. 같은 규칙으로 `night.mp4`, `schedule_pending.mp4`, `schedule_complete.mp4`, `rain.mp4`, `snow.mp4`, `thunder.mp4`도 인식한다. |

기본 자세는 `characterOutlines.json`의 `<id>_idle` 윤곽선으로 잘라 표시한다. 열린 입 프레임은 같은 810×1080 좌표에 맞추고, 입 주변만 가장자리가 부드러운 마스크로 합성한다. 기본 자세의 얼굴과 몸 위치는 고정된다.

### 현재 반영 현황

| 캐릭터 | 사용 대상 PNG | 아·이·오 립싱크 | `greeting.mp4` | `encourage` 포즈 |
| --- | --- | --- | --- | --- |
| 나비 | 아·이·오 | 적용 | 미반영 | 있음 |
| 서윤 | 아·이·오 | 적용 | 미반영 | 있음 |
| 지은 | 아 | 기본 JPG 사용 (이·오 필요) | 미반영 | 없음 (`idle`로 대체) |
| 준호 | 아·이·오 | 적용 | 미반영 | 없음 (`idle`로 대체) |
| 도윤 | 아 | 기본 JPG 사용 (이·오 필요) | 미반영 | 없음 (`idle`로 대체) |

입 모양 PNG는 별도로 만든 입 모양 이미지에서 입 주변만 잘라 각 캐릭터의 `idle` 위에 합성했다. 그래서 얼굴과 몸 위치는 `idle`과 같다. 세트가 갖춰지지 않은 캐릭터는 기존 `mouth_a`·`idle` JPG의 입 영역을 사용한다.

| 캐릭터 | 보관 중인 입 모양 PNG |
| --- | --- |
| 나비 | 아·에·이·오·우 |
| 서윤 | 아·에·이·오·우 |
| 지은 | 아 |
| 준호 | 아·에·이·오 |
| 도윤 | 아·에 |

추가 방법은 다음과 같다. 규격에 맞춘 파일을 `assets/characters/<id>/dialogue/`에 정확한 파일명으로 넣는다. `npm test`로 규격 검사를 통과하는지 확인한 뒤 Expo를 다시 시작한다(`npm start -- --clear`). 코드는 고칠 필요가 없다.

## 5. 대사 영상 전환 대비

이미지 방식은 대사 영상이 준비되기 전까지 쓰는 기본 재생 방식이다. 상황별 영상 파일을 `dialogue/`에 넣으면 해당 대사만 영상으로 바뀌고, 코드는 고치지 않는다.

- 영상의 첫 프레임과 마지막 프레임은 `<id>_idle.jpg`와 같게 만든다. 영상이 끝나면 `idle` 이미지로 돌아가므로 두 프레임이 다르면 화면이 튄다.
- 중간 동작은 `homeDialoguePresentation.ts`의 `homePoses`를 기준으로 한다.

| 상황 | 영상 파일 | 중간 동작 기준 포즈 |
| --- | --- | --- |
| 인사 | `greeting.mp4` | `wave` |
| 남은 일정 | `schedule_pending.mp4` | `encourage` (없는 캐릭터는 `idle`) |
| 일정 완료 | `schedule_complete.mp4` | `ok` |
| 밤 | `night.mp4` | `idle` |
| 비·눈·낙뢰 | `rain.mp4`, `snow.mp4`, `thunder.mp4` | `idle` (말하는 입 모양만) |

- 포즈 JPG(`wave`, `ok`, `encourage`)와 5모음 PNG는 홈 화면에서 지금 쓰지 않지만 영상 제작 기준 이미지로 보관한다.
- 음성은 `assets/voices/<id>_<situation>.m4a`(인사는 `<id>.m4a`)를 그대로 쓴다.
- mp4는 배경이 투명하지 않아 `idle`의 회색 배경이 그대로 보인다. 홈 화면에 넣을 때는 배경을 지운 투명 애니메이션으로 바꾸거나, 영상통화 카드 형태로 표시하는 방식을 정해야 한다.

## 6. 날씨 안내 영역 규칙

날씨 안내는 날씨 담당 브랜치의 구성을 그대로 쓴다.

- `HomeScreen.tsx`는 할 일 카드 아래에 `credit` 한 줄을 두고, 화면 아래쪽에 `<WeatherMessage weather={weather} notice={notice}/>`를 표시한다.
- `WeatherMessage.tsx`, `src/features/weather/*`, `shared/*`, `server/*`는 캐릭터 작업에서 수정하지 않는다.
- 캐릭터 대사창(`CharacterDialogue`)은 날씨 안내 패널 위(`bottom: 183`)에 둔다.
- `tests/home-weather-layout.test.mjs`가 이 조건을 검사한다.

## 7. 주요 파일 구조

| 파일 | 역할 |
| --- | --- |
| `src/features/avatar/characterTypes.ts` | `CharacterId`, `Pose`, `HomeDialogueSituation`, `SpokenVowel`, `Mouth`, `MouthCue` 등 캐릭터 모듈 타입 |
| `src/features/avatar/characters.json`, `characterConfig.ts` | 캐릭터 5인 설정, `poseFallback`, 공통 대화 규칙 |
| `src/features/avatar/homeDialogueLines.ts` | 캐릭터 × 상황 키별 홈 대사 35줄 |
| `src/features/avatar/homeDialoguePresentation.ts` | 상황 키 선택 우선순위, 영상 제작용 상황별 포즈(`homePoses`), 데모 순서 |
| `src/features/avatar/characterVoices.ts` | 캐릭터 × 상황 키별 `.m4a` 음원 매핑 |
| `src/features/avatar/useHomeDialogue.ts`, `useHomeDialogueAudio.ts` | 홈 대사 상태 관리, 음원 재생과 입 모양 큐 계산 |
| `src/features/avatar/visemes.ts` | 한글 음절 분해, 아·이·오 또는 5모음 분류, 최소 유지 시간이 적용된 입 모양 큐 |
| `src/features/avatar/characterMotion.ts` | 200ms 입 프레임 전환, 캐릭터별 입 마스크 위치와 대체 프레임 |
| `src/features/avatar/dialogueMedia.ts` | 입 모양 세트 설정(`mouthSet`), 캐릭터별 입 모양 PNG와 대사 영상 탐색 |
| `src/features/avatar/characterAssets.ts`, `characterOutlines.json` | 포즈 이미지 연결, 포즈 대체, 배경 투명 처리용 윤곽 |
| `src/components/home/DialogueAvatar.tsx` | 영상 재생과 음원·이미지 재생 분기 |
| `src/components/home/DialogueVideo.tsx`, `DialogueVideo.web.tsx` | `expo-video` 기반 대사 영상 재생(네이티브·웹) |
| `src/components/home/AvatarView.tsx`, `CharacterImage.tsx` | 포즈·입 프레임 렌더링, 비율과 여백 |
| `tests/avatar*.test.mjs` | 상황 선택, 모션, 입 모양 큐, 선택형 에셋 탐색 테스트 |
| `tests/avatar-dialogue-assets.test.mjs` | 5명의 `dialogue/` 폴더 파일명, PNG 크기(각 `idle`과 동일)·투명 채널, MP4 형식 검사 |
| `tests/home-weather-layout.test.mjs` | 날씨 안내 영역 구성과 대사창 위치 검사 |
