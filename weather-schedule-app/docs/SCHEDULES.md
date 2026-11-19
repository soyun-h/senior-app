# 일정 목록·등록 기능

## 범위

일정 목록, 일정 추가, 날짜 선택 모달, 요일 반복, 실행 시각, 사전 알림,
알림 방식 저장, 완료 화면, 날짜별 완료 체크, 알림 설정 토글을 구현했습니다.
삭제, 실제 영상통화/알람 실행/푸시, 달력 페이지는 없습니다.
홈의 기존 오늘 할 일 카드(고정 데이터)는 이번 작업에서 교체하지 않았습니다.

홈 → 일정 → 할 일 추가 → 저장 완료 → 일정 목록, 하단 홈으로 복귀가 가능합니다.
공통 BottomNavigation과 기존 아이콘/홈 버튼 PNG를 재사용합니다.
enabledTabs로 미구현 달력을 비활성화하며, 향후 달력 구현 시 공통 컴포넌트를 다시 작성할 필요가 없습니다.
저장 중에는 중복 제출과 네비게이션·Android 뒤로가기를 잠급니다.
화면 이동은 앱 내부 상태로 처리하며 웹 URL별 라우팅/브라우저 뒤로가기 히스토리는 추가하지 않았습니다.

## 저장과 향후 알림 연동

기존 AsyncStorage 패키지를 재사용하며 별도 패키지를 설치하지 않았습니다.
키: `weather-schedule:schedules:v1`, 저장 형식: `{ version: 1, items: Schedule[] }`.
ScheduleRepository 인터페이스를 유지하므로 추후 서버 저장소 어댑터로 교체할 수 있습니다.

- id / title / type: 식별자·직접 입력 제목·medication 또는 general
- recurrence: once+date 또는 weekly+weekdays(Mon=1~Sun=7)+startDate
- hour / minute / timeZone: Asia/Seoul 기준 실행 시각(24시간제로 저장)
- reminderMinutes: 5 / 10 / 30, 실행 시각과 별도 저장
- notificationMethod: video-call / alarm / none
- notificationsEnabled: 사용자의 알림 선호, none인 경우 항상 false이며 토글도 비활성화
- completedDates: YYYY-MM-DD 배열, 날짜별 완료이며 반복 일정 자체를 완료 처리하지 않음
- medicationNote: 사용자가 직접 입력한 약 이름·메모만 저장
- createdAt / updatedAt: UTC ISO instant

사전 알림 시각 계산·OS 알림 예약·권한·영상통화 실행은 다른 팀의 후속 작업입니다.
그때는 notificationsEnabled와 notificationMethod를 함께 확인하고 KST 발생일의 실행 시각에서
reminderMinutes를 차감해야 합니다. 이번 기능은 알림 설정을 저장할 뿐 실제 알림을 발생시키지 않습니다.

순차 저장 큐로 한 앱 인스턴스 안의 동시 변경을 직렬화하고, 저장 성공 후에만 화면 상태를 갱신합니다.
한 입력 화면의 고유 ID는 재시도에서도 유지되어 같은 제출의 중복 생성을 방지합니다.
깨진 데이터/미지원 버전은 오류로 표시하고 기존 저장소를 덮어쓰지 않습니다.
기기·브라우저별 로컬 저장으로 서버 동기화·회원 계정·백업·암호화를 제공하지 않습니다.
브라우저 저장소/앱 데이터를 삭제하면 로컬 일정도 사라집니다. 다중 브라우저 탭 간 동시 쓰기는 별도 잠금이 없습니다.

## 날짜·분류

기기 시간대와 무관하게 KST 기준 날짜/요일을 계산합니다.
15초 주기와 전경 복귀에서 오늘 날짜를 갱신하고, 반복 일정은 레코드를 복제하지 않고 해당 날짜에 필터링합니다.
일회성 일정은 현재 이후 시각만 등록할 수 있습니다. 반복 일정은 등록일 이후의 선택 요일에 나타납니다.
일정 화면의 유형 자동 분류는 단어 규칙이며 AI가 아닙니다. 직접 선택한 유형은 제목 수정 후에도 유지됩니다.
식전/식후·약 복용량 등 의료 정보를 생성하거나 추론하지 않습니다.

## 디자인 조정

제공 배경·카드 표면·SVG·홈 PNG를 그대로 사용합니다. 완료 체크는 기존 공통 체크 아이콘을 재사용합니다.
완료 화면에는 로고나 대체 그래픽을 표시하지 않고 CompletionLogoSlot을 빈 영역으로 둡니다.
시안에 없는 필수 조작(유형 선택/약 메모/시·분/오전·오후)은 같은 색상 계열로 추가했습니다.
추가 입력과 큰 터치 영역을 확보하기 위해 등록 화면은 세로 스크롤을 지원합니다.
날짜 선택은 실제 월별 모달이며 별도의 달력 페이지가 아닙니다.
목록/추가/완료 화면 모두 검수된 하단 '일정 / 홈 / 달력' 바를 사용합니다.
폰트 원본은 제공되지 않아 기존 시스템 폰트를 유지합니다.

## 검증

`npm test`, `npm run typecheck`, `npm run typecheck:server`, `npm run export:android`.
모델/저장소 테스트와 브라우저 상호작용 검사는 별도로 수행합니다.
Android JS 번들 통과는 실제 Android 기기에서의 UI·영속 저장·뒤로가기 검증을 대신하지 않습니다.
실제 기상청 서버/Cloudflare 설정은 이번 작업에서 변경하거나 재배포하지 않았습니다.

### 이번 작업에서 확인한 결과

- 단위 테스트 48개(기존 38개 + 일정 모델/저장소 10개) 통과.
- 앱·서버 TypeScript 검사 및 Android JS/Hermes 번들 생성 통과.
- Chromium에서 실제 UI 조작: 홈↔일정 이동, 빈 상태, 추가 화면, 제목 변경/자동 분류/수동 변경,
  다음 달 날짜 선택, 오전·오후/시·분, 사전 알림·방식, 성공 화면, 해당 날짜 필터링 통과.
- 저장 실패를 주입해 성공 화면으로 이동하지 않는 것과 입력 보존/재시도 확인.
- 중복 클릭해도 한 건만 저장되는 것, 체크·토글 변경 후 페이지 재실행 복원 확인.
- 목/토 반복에서 목요일 완료 후 토요일에 미완료가 되는 것, 날짜 변경 후 목록 갱신 확인.
- 320×640 / 360×780 / 390×844 / 1440×900에서 네비게이션 경계/겹침과 입력창 가로 범위 확인.
- 카드 배경의 실제 렌더링 폭이 터치 컨테이너 폭과 같은지 확인. 브라우저 pageerror 0개.
- 검증용 일정과 시각은 테스트 데이터입니다. 사용자 Codespaces의 실제 일정 데이터를 변경하지 않았습니다.
- Android 실기기 UI·OS 뒤로가기·영속 저장, VoiceOver/TalkBack, 실제 날씨 API 접속은 이번 작업에서 미검증입니다.
- 삭제/알람/영상통화 실행/달력 페이지는 구현하거나 테스트 성공으로 표시하지 않습니다.

검증용 실제 화면 PNG는 Codex의 `/workspace/work/schedule-validation/`에 있습니다.
이 내부 경로는 사용자 다운로드 URL이 아니며 기존 GitHub/Codespaces 화면에는 아직 변경이 반영되지 않았습니다.

## 추가·수정 파일 목록

- `assets/schedule/README.md`
- `assets/schedule/decoration/date-selection.svg`
- `assets/schedule/decoration/register-button.svg`
- `assets/schedule/decoration/selection.svg`
- `assets/schedule/decoration/toggle-off.svg`
- `assets/schedule/decoration/toggle-on.svg`
- `assets/schedule/icons/back.svg`
- `assets/schedule/icons/bell.svg`
- `assets/schedule/icons/check.svg`
- `assets/schedule/icons/edit.svg`
- `assets/schedule/icons/plus.svg`
- `assets/schedule/images/background.png`
- `assets/schedule/images/card-off.png`
- `assets/schedule/images/card-on.png`
- `assets/schedule/images/list-background.png`
- `docs/SCHEDULES.md`
- `src/components/schedule/DatePicker.tsx`
- `src/components/schedule/ScheduleAsset.tsx`
- `src/components/schedule/ScheduleControls.tsx`
- `src/components/schedule/ScheduleShell.tsx`
- `src/features/schedules/ScheduleProvider.tsx`
- `src/features/schedules/model.ts`
- `src/features/schedules/repository.ts`
- `src/screens/ScheduleAddScreen.tsx`
- `src/screens/ScheduleListScreen.tsx`
- `src/screens/ScheduleSuccessScreen.tsx`
- `tests/schedules.test.mjs`
- `App.tsx`
- `src/components/home/BottomNavigation.tsx`
- `src/navigation/bottomTabs.ts`
- `src/screens/HomeScreen.tsx`
