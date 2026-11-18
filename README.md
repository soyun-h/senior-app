# 오느른 사진 촬영 및 복약 등록

Flutter 기능 모듈과 실행 미리보기입니다. 처방전 촬영, 기기 내 OCR, 정보 확인과 수정, 복약 사진 인증, 건너뛰기 기록, 달력 조회를 제공합니다. `lib/main.dart`로 이 폴더를 별도 Flutter 앱처럼 실행해 화면 흐름을 볼 수 있고, 기존 앱에는 `OnureunPhotoFeature`를 기능 화면으로 연결합니다.

## 기존 앱에 넣기

기존 Flutter 프로젝트에서 이 패키지 경로를 `pubspec.yaml`에 연결하고 `import 'package:onureun_photo_feature/onureun_photo_feature.dart';`를 사용합니다. 기존 프로젝트의 Flutter/Android/iOS 설정에 아래 플랫폼 요구사항도 반영하세요. 이 폴더에는 기능 코드와 미리보기 `main.dart`가 포함되며, Flutter가 생성하는 Android/iOS host 폴더는 포함하지 않았습니다. 현재 기능은 저장 경계를 `PhotoFeatureRepository`로 분리했습니다. 단독 오프라인 사용은 `LocalPhotoFeatureRepository`가 앱 문서 폴더의 JSON 및 사진 파일에 기록합니다.

```yaml
dependencies:
  onureun_photo_feature:
    path: ../onureun_photo_feature
```

기존 일정 저장소에 붙일 때는 다음 위젯을 일정 메뉴 화면에 둡니다. `onMedicationPlanSaved`에서 기존 `ScheduleStore`의 일정 저장을 호출하고, 인증 변경 콜백에서 해당 일정의 날짜별 완료/건너뛰기를 기존 저장소에 반영합니다. `plan.id`는 일정 ID로 그대로 전달해 중복 호출을 멱등하게 처리하세요.

```dart
OnureunPhotoFeature(
  userId: profile.id,
  repository: LocalPhotoFeatureRepository(),
  onMedicationPlanSaved: (plan) {
    final schedule = Schedule(
      id: plan.id,
      title: plan.medicationName,
      date: DateTime.now(),
      times: plan.intakeTimes,
      repeat: ScheduleRepeat.weekly,
      category: '약',
      note: '${plan.dosage} · ${plan.mealCondition}',
    );
    return scheduleStore.byId(plan.id) == null
        ? scheduleStore.addAll([schedule])
        : scheduleStore.update(schedule);
  },
  onVerificationChanged: (entry) => scheduleStore.setCompleted(
    entry.scheduleId,
    entry.status == IntakeStatus.verified,
    now: entry.verifiedAt,
  ),
  onMedicationPlanDeleted: scheduleStore.delete,
  onVerificationDeleted: (entry) => scheduleStore.setCompleted(
    entry.scheduleId,
    false,
    now: entry.verifiedAt,
  ),
)
```

기존 알림/AI 통화 화면의 사진 인증 선택 영역에는 `MedicationReminderPrompt`를 표시합니다. `scheduleId`를 그대로 전달하며, `나중에 할게요`는 저장 상태를 변경하지 않습니다. `오늘은 건너뛰기`는 실제 완료로 기록하지 않고 `skipped`로 저장합니다. 인증 상태의 달력 표시는 이 기능의 기록 화면에서 즉시 조회되고, 기존 달력과 연결하려면 같은 `PhotoFeatureRepository.verifications()`를 날짜별로 읽으면 됩니다.

`Schedule` 예시는 기존 앱 자료의 모델에 맞춘 연결 예입니다. 기존 `Schedule`이 여러 요일이나 하루에 반복 횟수별 상태를 지원하지 않으므로, 전체 요일 정보를 유지하려면 `MedicationPlan.weekdays`를 읽어 해당 요일을 반복시키도록 앱의 기존 일정 모델/저장소 adapter에서 매핑해야 합니다. 콜백은 API 호출이 아니며, 이 모듈에는 원격 서버 업로드가 포함되지 않습니다.

## 플랫폼 설정

- Android: `minSdk` 24 이상, `compileSdk` 35 이상. `android/app/build.gradle`의 dependencies에 `implementation 'com.google.mlkit:text-recognition-korean:16.0.0'`를 추가하세요.
- iOS: Deployment Target 15.5 이상, Xcode 15.3 이상. `ios/Podfile`에 `platform :ios, '15.5'`와 `pod 'GoogleMLKit/TextRecognitionKorean', '~> 7.0.0'`를 설정하세요.
- iOS `Info.plist`에는 카메라 설명을 지정하세요: `NSCameraUsageDescription` / `처방전과 복약 인증 사진을 촬영합니다.`. 카메라 플러그인 안내에 따라 `NSMicrophoneUsageDescription`도 지정하세요. 촬영 컨트롤러에서는 오디오 녹음을 끕니다.
- OCR 플러그인은 Android/iOS용입니다. 브라우저 웹 실행은 지원하지 않습니다.

OCR은 명시적으로 읽힌 약 이름, 용량, 횟수, 복용 조건, 날짜 및 시간만 초안에 넣습니다. 알 수 없는 항목을 임의로 보완하지 않으며 신뢰도 수치는 해당 OCR API가 제공하지 않아 만들지 않습니다. 처방전 내용을 확인할 수 없으면 원문을 보여 주고 사용자가 입력하도록 합니다. 사진 파일은 JPG/JPEG/PNG/WEBP, 10MB 이하로 검증하며 앱 문서 폴더에 저장합니다.

## 실행

Flutter SDK가 있는 환경에서 Android/iOS 실행 파일을 한 번 생성하고 실행합니다. iOS는 아래 설정을 먼저 적용해야 합니다.

```sh
flutter create --platforms=android,ios .
flutter pub get
flutter run
```

현재 Codex 실행 환경에는 Flutter/Dart SDK가 없어 `pub get`, 분석, 에뮬레이터 빌드 및 기기 카메라 검증은 실행할 수 없었습니다.
