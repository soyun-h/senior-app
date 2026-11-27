const recognitionErrors = {
  "not-allowed": "주소창에서 마이크를 허용한 뒤 대사창을 눌러 주세요.",
  "service-not-allowed": "브라우저에서 음성 인식을 사용할 수 없어요. Chrome 설정을 확인해 주세요.",
  "audio-capture": "마이크를 연결하거나 입력 장치를 확인한 뒤 대사창을 눌러 주세요.",
  "language-not-supported": "이 브라우저에서는 한국어 음성 인식을 사용할 수 없어요.",
  network: "음성 인식 연결이 끊겼어요. 인터넷을 확인한 뒤 대사창을 눌러 주세요.",
};

let releasingInput;

function releaseInput(input) {
  let timeout;
  const release = new Promise((resolve) => {
    const done = () => {
      clearTimeout(timeout);
      resolve();
    };
    input.onend = done;
    timeout = setTimeout(done, 350);
    input.abort();
  });
  releasingInput = release;
  release.then(() => { if (releasingInput === release) releasingInput = null; });
}

export function createVoiceSession({ update, onAnswer, onMiss }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  let active = false;
  let turn = 0;
  let retry;
  let outputDeadline;
  let recognition;
  let utterance;
  let lastPrompt;
  let misses = 0;

  function stop() {
    active = false;
    turn++;
    clearTimeout(retry);
    clearTimeout(outputDeadline);
    if (recognition) {
      const input = recognition;
      recognition = null;
      releaseInput(input);
    }
    if (utterance) {
      utterance = null;
      synth.cancel();
    }
  }

  function fail(message) {
    stop();
    update({ phase: "error", message });
  }

  function listen(id) {
    if (!active || turn !== id) return;
    if (!Recognition) return fail("한국어 음성 인식은 Chrome에서 페이지를 열어 사용해 주세요.");
    if (!window.isSecureContext) return fail("마이크를 사용하려면 localhost 또는 HTTPS에서 열어 주세요.");

    const input = new Recognition();
    recognition = input;
    input.lang = "ko-KR";
    input.continuous = false;
    input.interimResults = true;
    input.maxAlternatives = 1;
    let final = "";
    let heardSpeech = false;
    let error;

    update({ phase: "waiting", transcript: "", message: "" });
    input.onaudiostart = () => {
      if (recognition === input) update({ phase: "listening" });
    };
    input.onspeechstart = () => { heardSpeech = true; };
    input.onresult = ({ results, resultIndex }) => {
      if (recognition !== input) return;
      const interim = [];
      for (let i = resultIndex; i < results.length; i++) {
        const result = results[i];
        if (result.isFinal) final += ` ${result[0].transcript}`;
        else interim.push(result[0].transcript);
      }
      update({ phase: "listening", transcript: [final, ...interim].join(" ").trim() });
    };
    input.onnomatch = () => { error = "no-match"; };
    input.onerror = (event) => {
      if (recognition !== input) return;
      error = event.error;
      if (recognitionErrors[error]) fail(recognitionErrors[error]);
    };
    input.onend = () => {
      if (recognition !== input || !active || turn !== id) return;
      recognition = null;
      const answer = final.trim();
      if (answer) {
        misses = 0;
        update({ phase: "thinking", transcript: answer });
        onAnswer(answer);
        return;
      }
      if (heardSpeech || error === "no-match" || ++misses === 2) {
        misses = 0;
        onMiss(heardSpeech || error === "no-match");
        return;
      }
      update({ phase: "waiting", transcript: "" });
      retry = setTimeout(() => listen(id), 450);
    };
    try {
      input.start();
    } catch {
      recognition = null;
      fail("마이크를 시작하지 못했어요. 대사창을 눌러 다시 시도해 주세요.");
    }
  }

  function say(text, { wait = true, after, display = text } = {}) {
    stop();
    lastPrompt = { text, wait, after, display };
    active = true;
    const id = turn;
    update({ phase: "speaking", line: display, message: "" });
    const finish = () => {
      if (!active || turn !== id) return;
      utterance = null;
      clearTimeout(outputDeadline);
      if (wait) {
        update({ phase: "waiting", transcript: "" });
        // Give the output device a short time to clear its audio buffer.
        retry = setTimeout(() => listen(id), 220);
      } else {
        active = false;
        update({ phase: "idle", transcript: "" });
        after?.();
      }
    };
    if (!synth || !window.SpeechSynthesisUtterance) {
      fail("이 브라우저에서는 아바타 음성을 사용할 수 없어요.");
      return;
    }
    const output = new SpeechSynthesisUtterance(text);
    const korean = synth.getVoices().find((voice) => /^ko(?:[-_]|$)/i.test(voice.lang));
    if (korean) output.voice = korean;
    output.lang = "ko-KR";
    output.rate = 0.9;
    output.onend = finish;
    output.onerror = ({ error }) => {
      if (!active || turn !== id) return;
      fail(error === "not-allowed"
        ? "대사창을 눌러 음성 대화를 시작해 주세요."
        : "한국어 음성을 재생하지 못했어요. 브라우저의 한국어 음성을 확인해 주세요.");
    };
    const speak = () => {
      if (!active || turn !== id) return;
      utterance = output;
      outputDeadline = setTimeout(() => {
        if (active && turn === id) fail("음성 재생을 시작하지 못했어요. 대사창을 눌러 다시 시도해 주세요.");
      }, Math.max(15000, text.length * 320));
      synth.speak(output);
    };
    if (releasingInput) releasingInput.then(speak);
    else speak();
  }

  return {
    say,
    stop,
    pause() {
      stop();
      update({ phase: "idle", transcript: "" });
    },
    restart() {
      if (lastPrompt) say(lastPrompt.text, lastPrompt);
    },
  };
}

export function callIntent(text) {
  const words = text.trim().replace(/[.,!?~。？！]/g, "");
  if (/뭐라고|다시\s*(말|설명|알려)|무슨\s*(약|일정)|어떤\s*(약|일정)|못\s*들었/.test(words)) return "repeat";
  if (/^(아니(?:요)?|싫어(?:요)?)(?:\s|$)|나중|있다가|이따|안\s*(찍|먹|할|해)|괜찮(?:아|아요)(?:\s|$)|안\s*돼/.test(words)) return "decline";
  if (/^(응|엉|네|예|그래(?:요)?|좋아(?:요)?)(?:\s|$)|알겠|알았|먹을\s*게|찍을\s*게|찍겠|할\s*게|할래/.test(words)) return "accept";
  return "unknown";
}
