# 오느른 Expo 음성 홈

팀 일정 앱과 같은 Expo SDK 58을 사용합니다. 이 폴더에서 음성 홈을 별도로 실행할 수 있습니다.

## 실행

Windows x64의 PowerShell에서 아래 명령을 실행합니다. 첫 설치 때 Expo 패키지와 Whisper 모델을 내려받습니다.

```powershell
cd expo-voice
npm ci
.\setup-voice.ps1
npm start
```

휴대폰과 PC를 같은 Wi-Fi에 연결하고 **Expo Go**로 화면의 QR을 스캔합니다. 마이크를 허용하고 나비의 말이 끝난 뒤 “오늘 기분이 좋아”라고 말해 보세요. 다른 플랫폼에서는 직접 설치한 Whisper CLI와 다국어 모델의 절대 경로를 `WHISPER_CLI`, `WHISPER_MODEL` 환경 변수로 지정합니다. 기본 Metro 포트는 8088이며 `EXPO_PORT`로 바꿀 수 있습니다.

앱은 Expo Audio로 마이크를 열고, 발화가 끝나면 같은 PC의 Metro 음성 엔드포인트에 짧은 PCM을 보냅니다. Whisper가 한국어 텍스트로 바꾸면 Expo Speech로 다음 답을 읽습니다. 음성 변환은 실행 중인 PC에서 처리하며, 처리용 임시 WAV와 결과 파일은 요청 뒤 삭제합니다. API 키 없이 사용할 수 있는 로컬 개발용 구성입니다.

Expo Go에서 시험할 수 있도록 모바일 마이크와 음성 재생을 Expo SDK 모듈로 구현했습니다. 배포용 구성에서 이 PC 기반 음성 서버를 사용하려면 별도의 운영 배포가 필요합니다.
