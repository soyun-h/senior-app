# 캐릭터 시스템 리포트

이 문서는 `weather-schedule-app`에서 문한나가 담당한 캐릭터 모듈을 정리한다. 홈에서는 캐릭터 5인의 기본 이미지, 상황별 대사와 음성을 연결한다. 코드는 React Native, Expo SDK 58, TypeScript로 작성했다.

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

## 3. 홈의 대사·음성 연동

1. 홈 화면이 외부 상태(시각, 일정 완료 여부, 상황 조건)를 `homeDialoguePresentation.ts`에 넘긴다. 이 파일이 상황 키(`HomeDialogueSituation`) 하나를 고른다. 우선순위는 `thunder`·`snow`·`rain`, `night`(22시~6시), `scheduleComplete`, `schedulePending`, `greeting` 순이다.
2. 캐릭터 ID와 상황 키로 대사와 음원을 정한다.
   - 대사: `homeDialogueLines[characterId][situation]`
   - 음원: `characterVoices[characterId][situation]`(`assets/voices/*.m4a`)
3. `DialogueAvatar.tsx`는 캐릭터의 기본 이미지를 고정해 표시하고 `useHomeDialogueAudio`로 해당 음원을 재생한다. 하단에는 캐릭터 대사만 표시한다. 날씨 상태는 배경과 대사 선택에 쓰고 출처는 할 일 카드 아래에 표시한다.

대사 영상 규격은 아래에 정리했다. 현재 홈에서는 기본 이미지와 별도 음원을 사용하고, 입 모양 이미지는 저장소에 두지 않는다.

## 4. 에셋 규격 및 현재 반영 현황

### 기존 포즈 이미지와 음원

| 캐릭터 | 포즈 이미지 (`assets/characters/<id>/`, 810×1080 JPG) | 음원 (`assets/voices/`) |
| --- | --- | --- |
| `char1` 나비 | `idle`, `wave`, `ok`, `encourage`, `profile`(512×512) | `char1.m4a` 외 6개 |
| `char2` 서윤 | `idle`, `wave`, `ok`, `encourage`, `profile` | `char2.m4a` 외 6개 |
| `char3` 지은 | `idle`, `wave`, `ok`, `encourage`, `profile` | `char3.m4a` 외 6개 |
| `char4` 준호 | `idle`, `wave`, `ok`, `encourage`, `profile` | `char4.m4a` 외 6개 |
| `char5` 도윤 | `idle`, `wave`, `ok`, `encourage`, `profile` | `char5.m4a` 외 6개 |

다섯 캐릭터 모두 `idle`, `wave`, `ok`, `encourage` 네 자세가 있다. 지은의 네 자세와 준호·도윤의 `ok`·`wave`·`encourage`는 잘린 어깨와 팔을 보완한 이미지로 교체했다. 나비의 `wave`·`encourage`는 왼쪽 어깨가 이미지 끝에 닿아 있어 보완본을 받으면 교체한다.

### 캐릭터 ID와 이름

코드와 에셋 경로는 캐릭터 ID를 쓴다.

| ID | 이름 | 에셋 폴더 |
| --- | --- | --- |
| `char1` | 나비 | `assets/characters/char1/` |
| `char2` | 서윤 | `assets/characters/char2/` |
| `char3` | 지은 | `assets/characters/char3/` |
| `char4` | 준호 | `assets/characters/char4/` |
| `char5` | 도윤 | `assets/characters/char5/` |

### 대사 영상 폴더

경로는 캐릭터마다 `assets/characters/<id>/dialogue/`이다. 지금은 비어 있다(`.gitkeep`만 있음). `dialogueMedia.ts`의 `require.context`가 이 폴더에서 아래 이름만 읽는다.

| 파일 | 규격 |
| --- | --- |
| `greeting.mp4` | 인사 영상. 해당 캐릭터의 `greeting` 음원(`<id>.m4a`)을 포함한다. 같은 규칙으로 `night.mp4`, `schedule_pending.mp4`, `schedule_complete.mp4`, `rain.mp4`, `snow.mp4`, `thunder.mp4`도 인식한다. |

홈은 `characterOutlines.json`의 기본 자세 윤곽선으로 배경을 잘라 표시한다.

### 입 모양 이미지

홈에서 입을 움직이지 않기로 해 입 모양 이미지(`mouth_*.png`, `<id>_mouth_*.jpg`)와 립싱크 코드(`visemes.ts`, `characterMotion.ts`)를 저장소에서 뺐다. 다섯 캐릭터의 아·에·이·오·우 이미지는 저장소 밖에 따로 보관한다.

## 5. 대사 영상 제작 규격

아래 규격은 영상 제작에 참고할 수 있다. 홈은 현재 기본 이미지와 별도 음원을 재생한다.

- 영상의 첫 프레임과 마지막 프레임은 `<id>_idle.jpg`와 같게 만든다. 영상이 끝나면 `idle` 이미지로 돌아가므로 두 프레임이 다르면 화면이 튄다.
- 중간 동작은 `homeDialoguePresentation.ts`의 `homePoses`를 기준으로 한다.

| 상황 | 영상 파일 | 중간 동작 기준 포즈 |
| --- | --- | --- |
| 인사 | `greeting.mp4` | `wave` |
| 남은 일정 | `schedule_pending.mp4` | `encourage` |
| 일정 완료 | `schedule_complete.mp4` | `ok` |
| 밤 | `night.mp4` | `idle` |
| 비·눈·낙뢰 | `rain.mp4`, `snow.mp4`, `thunder.mp4` | `idle` |

- 포즈 JPG(`wave`, `ok`, `encourage`)는 홈 화면에서 지금 쓰지 않지만 영상 제작 기준 이미지로 둔다.
- 음성은 `assets/voices/<id>_<situation>.m4a`(인사는 `<id>.m4a`)를 그대로 쓴다.
- mp4는 배경이 투명하지 않아 `idle`의 회색 배경이 그대로 보인다. 홈 화면에 넣을 때는 배경을 지운 투명 애니메이션으로 바꾸거나, 영상통화 카드 형태로 표시하는 방식을 정해야 한다.

## 6. 홈의 날씨 표시

- 할 일 카드 아래에 기상청 출처 또는 데모 표시를 둔다.
- 하단에는 캐릭터 대사창을 표시한다. 날씨 상태는 기존 훅을 통해 배경과 대사 선택에 전달한다.
- `tests/home-weather-layout.test.mjs`가 홈 구성과 정적 이미지 표시를 확인한다.

## 7. 주요 파일 구조

| 파일 | 역할 |
| --- | --- |
| `src/features/avatar/characterTypes.ts` | `CharacterId`, `Pose`, `HomeDialogueSituation` 등 캐릭터 모듈 타입 |
| `src/features/avatar/characters.json`, `characterConfig.ts` | 캐릭터 5인 설정, `poseFallback`, 공통 대화 규칙 |
| `src/features/avatar/homeDialogueLines.ts` | 캐릭터 × 상황 키별 홈 대사 35줄 |
| `src/features/avatar/homeDialoguePresentation.ts` | 상황 키 선택 우선순위, 영상 제작용 상황별 포즈(`homePoses`), 데모 순서 |
| `src/features/avatar/characterVoices.ts` | 캐릭터 × 상황 키별 `.m4a` 음원 매핑 |
| `src/features/avatar/useHomeDialogue.ts`, `useHomeDialogueAudio.ts` | 홈 대사 상태 관리와 음원 재생 |
| `src/features/avatar/dialogueMedia.ts` | 캐릭터별 대사 영상 탐색(홈에는 아직 연결하지 않음) |
| `src/features/avatar/characterAssets.ts`, `characterOutlines.json` | 포즈 이미지 연결, 포즈 대체, 배경 투명 처리용 윤곽 |
| `src/components/home/DialogueAvatar.tsx` | 홈 기본 이미지와 대사 음원 연결 |
| `src/components/home/DialogueVideo.tsx`, `DialogueVideo.web.tsx` | `expo-video` 기반 대사 영상 재생(네이티브·웹, 홈에는 아직 연결하지 않음) |
| `src/components/home/AvatarView.tsx`, `CharacterImage.tsx` | 기본 이미지 렌더링, 비율과 여백 |
| `tests/avatar*.test.mjs` | 캐릭터 설정, 상황 선택, 대사 영상 탐색 테스트 |
| `tests/avatar-dialogue-assets.test.mjs` | 5명의 `dialogue/` 폴더 파일명과 MP4 형식 검사 |
| `tests/home-weather-layout.test.mjs` | 홈 구성(날씨 배경·출처, 대사창)과 정적 이미지 표시 검사 |
