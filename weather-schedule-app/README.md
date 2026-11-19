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
4. 이미지로 입을 움직이는 방식은 두 가지다.
   - 입 모양 PNG 5장(`mouth_a`~`mouth_u`)이 모두 있으면, `visemes.ts`의 `estimateFiveVowelCues()`가 대사의 한글 음절과 음원 길이로 아·에·이·오·우 큐를 만든다. 쉼표, 마침표, 끝에서는 입을 닫는다.
   - PNG 세트가 불완전하면 기존 `mouth_a` JPG로 200ms 간격의 입 모양 전환을 적용한다.
   - 이미지 재생에서는 `idle` 자세를 고정하고 음성이 나오는 동안 입 주변 영역만 바꾼다. 쉼이나 음성 종료 시에는 기본 입 모양이 보인다.

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

코드와 에셋 경로는 캐릭터 ID를 쓴다. 생성 원본은 바탕화면 `_gemini_raw/<이름>/<이름>_<모음 또는 자세>.png`로 이름별로 정리한다.

| ID | 이름 | 에셋 폴더 | 원본 폴더 |
| --- | --- | --- | --- |
| `char1` | 나비 | `assets/characters/char1/` | `_gemini_raw/나비/` |
| `char2` | 서윤 | `assets/characters/char2/` | `_gemini_raw/서윤/` |
| `char3` | 지은 | `assets/characters/char3/` | `_gemini_raw/지은/` |
| `char4` | 준호 | `assets/characters/char4/` | `_gemini_raw/준호/` |
| `char5` | 도윤 | `assets/characters/char5/` | `_gemini_raw/도윤/` |

### 선택형 에셋 규격

경로는 캐릭터마다 `assets/characters/<id>/dialogue/`이다. `dialogueMedia.ts`의 `require.context`가 이 폴더에서 아래 이름만 읽는다.

| 파일 | 규격 |
| --- | --- |
| `mouth_a.png`, `mouth_e.png`, `mouth_i.png`, `mouth_o.png`, `mouth_u.png` | 같은 캐릭터의 `<id>_idle.jpg`와 같은 810×1080, 배경 투명 PNG. 얼굴·손·옷·구도는 `idle`과 같고 입 모양만 다르다. 5장이 모두 있어야 적용된다. |
| `greeting.mp4` | 인사 영상. 해당 캐릭터의 `greeting` 음원(`<id>.m4a`)을 포함한다. 같은 규칙으로 `night.mp4`, `schedule_pending.mp4`, `schedule_complete.mp4`, `rain.mp4`, `snow.mp4`, `thunder.mp4`도 인식한다. |

기본 자세는 `characterOutlines.json`의 `<id>_idle` 윤곽선으로 잘라 표시한다. 열린 입 프레임은 같은 810×1080 좌표에 맞추고, 입 주변만 가장자리가 부드러운 마스크로 합성한다. 기본 자세의 얼굴과 몸 위치는 고정된다.

### 현재 반영 현황

| 캐릭터 | 입 모양 PNG | 5모음 립싱크 | `greeting.mp4` | `encourage` 포즈 |
| --- | --- | --- | --- | --- |
| 나비 | 아·에·이·오·우 | 적용 | 미반영 | 있음 |
| 서윤 | 아·에·이·오·우 | 적용 | 미반영 | 있음 |
| 지은 | 아 | 미적용 (에·이·오·우 필요) | 미반영 | 없음 (`idle`로 대체) |
| 준호 | 아·에·이·오 | 미적용 (우 필요) | 미반영 | 없음 (`idle`로 대체) |
| 도윤 | 아·에 | 미적용 (이·오·우 필요) | 미반영 | 없음 (`idle`로 대체) |

'아'(전원)와 나비 '이'·'오', 서윤 '오'는 기존 `<id>_mouth_*.jpg`에서, 나머지는 Gemini로 생성한 이미지에서 입 영역을 합성했다. 5장이 모이지 않은 캐릭터는 기존 `mouth_a`·`idle` JPG 2프레임 방식으로 동작한다.

추가 방법은 다음과 같다. 규격에 맞춘 파일을 `assets/characters/<id>/dialogue/`에 정확한 파일명으로 넣는다. `npm test`로 규격 검사를 통과하는지 확인한 뒤 Expo를 다시 시작한다(`npm start -- --clear`). 코드는 고칠 필요가 없다.

## 5. 주요 파일 구조

| 파일 | 역할 |
| --- | --- |
| `src/features/avatar/characterTypes.ts` | `CharacterId`, `Pose`, `HomeDialogueSituation`, `SpokenVowel`, `Mouth`, `MouthCue` 등 캐릭터 모듈 타입 |
| `src/features/avatar/characters.json`, `characterConfig.ts` | 캐릭터 5인 설정, `poseFallback`, 공통 대화 규칙 |
| `src/features/avatar/homeDialogueLines.ts` | 캐릭터 × 상황 키별 홈 대사 35줄 |
| `src/features/avatar/homeDialoguePresentation.ts` | 상황 키 선택 우선순위, 상황별 포즈 매핑, 데모 순서 |
| `src/features/avatar/characterVoices.ts` | 캐릭터 × 상황 키별 `.m4a` 음원 매핑 |
| `src/features/avatar/useHomeDialogue.ts`, `useHomeDialogueAudio.ts` | 홈 대사 상태 관리, 음원 재생과 입 모양 큐 계산 |
| `src/features/avatar/visemes.ts` | 한글 음절 분해, 3모음(`vowelMouth`)·5모음(`fiveVowelMouth`) 입 모양 분류, 큐 생성(`estimateFiveVowelCues`, `mouthAt`) |
| `src/features/avatar/characterMotion.ts` | 200ms 입 프레임 전환, 캐릭터별 입 마스크 위치와 대체 프레임 |
| `src/features/avatar/dialogueMedia.ts` | 캐릭터별 선택형 에셋(입 모양 PNG, 대사 영상) 탐색 |
| `src/features/avatar/characterAssets.ts`, `characterOutlines.json` | 포즈 이미지 연결, 포즈 대체, 배경 투명 처리용 윤곽 |
| `src/components/home/DialogueAvatar.tsx` | 영상 재생과 음원·이미지 재생 분기 |
| `src/components/home/DialogueVideo.tsx`, `DialogueVideo.web.tsx` | `expo-video` 기반 대사 영상 재생(네이티브·웹) |
| `src/components/home/AvatarView.tsx`, `CharacterImage.tsx` | 포즈·입 프레임 렌더링, 비율과 여백 |
| `tests/avatar*.test.mjs` | 상황 선택, 모션, 입 모양 큐, 선택형 에셋 탐색 테스트 |
| `tests/avatar-dialogue-assets.test.mjs` | 5명의 `dialogue/` 폴더 파일명, PNG 크기(각 `idle`과 동일)·투명 채널, MP4 형식 검사 |
