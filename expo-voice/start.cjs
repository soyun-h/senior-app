const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const runtime = join(__dirname, '.voice-runtime');
const whisper = process.env.WHISPER_CLI || (process.platform === 'win32'
  ? join(runtime, 'Release', 'whisper-cli.exe')
  : join(runtime, 'whisper-cli'));
const model = process.env.WHISPER_MODEL || join(runtime, 'ggml-base-q5_1.bin');

if (!existsSync(whisper) || !existsSync(model)) {
  console.error('Whisper CLI와 한국어 지원 모델을 먼저 설치해 주세요. README.md의 실행 방법을 참고하세요.');
  process.exit(1);
}

const token = randomBytes(24).toString('hex');
const expo = require.resolve('expo/bin/cli');
const server = spawn(process.execPath, [expo, 'start', '--go', '--lan', '--port', process.env.EXPO_PORT || '8088'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    WHISPER_CLI: whisper,
    WHISPER_MODEL: model,
    EXPO_PUBLIC_VOICE_TOKEN: token,
  },
});
server.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
server.once('exit', (code) => { process.exitCode = code ?? 1; });
