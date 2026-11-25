const { execFile } = require('node:child_process');
const { mkdtemp, readFile, rm, rmdir, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { basename, dirname, join } = require('node:path');
const { promisify } = require('node:util');

const execute = promisify(execFile);
const wavRate = 16000;
const maxBytes = 2 * 1024 * 1024;

function makeWave(pcm, rate, channels) {
  const frames = pcm.length / (channels * 2);
  const samples = Math.floor(frames * wavRate / rate);
  const wave = Buffer.alloc(44 + samples * 2);
  wave.write('RIFF');
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(wavRate, 24);
  wave.writeUInt32LE(wavRate * 2, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write('data', 36);
  wave.writeUInt32LE(samples * 2, 40);

  for (let i = 0; i < samples; i++) {
    const start = Math.floor(i * rate / wavRate);
    const end = Math.min(frames, Math.max(start + 1, Math.floor((i + 1) * rate / wavRate)));
    let sum = 0;
    for (let frame = start; frame < end; frame++) {
      for (let channel = 0; channel < channels; channel++) {
        sum += pcm.readInt16LE((frame * channels + channel) * 2);
      }
    }
    wave.writeInt16LE(Math.round(sum / ((end - start) * channels)), 44 + i * 2);
  }
  return wave;
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function attachVoiceApi(next) {
  let busy = false;
  return async (request, response, done) => {
    const path = request.url.split('?', 1)[0];
    if (path !== '/_oneureun/voice') return next(request, response, done);

    const token = process.env.EXPO_PUBLIC_VOICE_TOKEN;
    if (!token || !process.env.WHISPER_CLI || !process.env.WHISPER_MODEL) {
      return send(response, 503, { error: '음성 서버를 npm start로 실행해 주세요.' });
    }
    if (request.method === 'GET') return send(response, 200, { ready: true });
    if (request.method !== 'POST') return send(response, 405, { error: '지원하지 않는 요청이에요.' });
    if (request.headers.authorization !== 'Bearer ' + token) return send(response, 401, { error: 'Expo Go에서 QR을 다시 열어 주세요.' });
    if (busy) return send(response, 429, { error: '음성 서버가 사용 중이에요. 잠시 후 다시 말씀해 주세요.' });

    const rate = Number(request.headers['x-sample-rate']);
    const channels = Number(request.headers['x-channels']);
    if (!Number.isInteger(rate) || rate < 8000 || rate > 96000 || ![1, 2].includes(channels)) {
      return send(response, 400, { error: '마이크 오디오 형식을 읽을 수 없어요.' });
    }

    busy = true;
    let folder;
    try {
      const chunks = [];
      let bytes = 0;
      request.setTimeout(8000, () => request.destroy());
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          send(response, 413, { error: '목소리를 짧게 말씀해 주세요.' });
          return;
        }
        chunks.push(chunk);
      }
      request.setTimeout(0);
      if (bytes < rate * channels * 0.3 || bytes % (channels * 2)) return send(response, 200, { text: '' });
      folder = await mkdtemp(join(tmpdir(), 'oneureun-transcribe-'));
      const audio = join(folder, 'voice.wav');
      const result = join(folder, 'text');
      await writeFile(audio, makeWave(Buffer.concat(chunks, bytes), rate, channels));
      const modelPath = process.env.WHISPER_MODEL;
      await execute(process.env.WHISPER_CLI, [
        '-m', basename(modelPath), '-f', audio, '-l', 'ko', '-t', '4',
        '-ng', '-nt', '-otxt', '-of', result,
      ], { cwd: dirname(modelPath), windowsHide: true, timeout: 25000 });
      const text = (await readFile(result + '.txt', 'utf8'))
        .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').trim().replace(/\s+/g, ' ');
      send(response, 200, { text });
    } catch (error) {
      if (!response.destroyed) {
        console.warn('Whisper:', error.code || error.name);
        send(response, 503, { error: '음성 인식에 실패했어요. 잠시 후 다시 말씀해 주세요.' });
      }
    } finally {
      busy = false;
      if (folder) {
        await Promise.allSettled(['voice.wav', 'text.txt'].map((file) => rm(join(folder, file), { force: true })));
        await rmdir(folder).catch(() => {});
      }
    }
  };
}

module.exports = { attachVoiceApi };
