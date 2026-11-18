import type { CharacterId, HomeDialogueSituation } from './characterTypes';

export const homeDialogueLines = {
  char1: {
    greeting: '안녕하세요, 나비예요! 오늘도 저랑 기분 좋게 시작해 봐요.',
    night: '오늘 하루도 수고 많았어요! 이제 포근하게 쉬어요.',
    schedulePending: '앗, 챙길 일이 하나 남았어요! 저랑 같이 해 볼까요?',
    scheduleComplete: '오늘 할 일 다 끝났네요! 와, 정말 잘하셨어요!',
    rain: '비가 와요! 밖에 나가실 때 우산 꼭 챙겨요.',
    snow: '눈이 와요! 길이 미끄러우니 천천히 걸어요.',
    thunder: '번개 예보가 있어요. 지금은 실내에 같이 있어요!',
  },
  char2: {
    greeting: '안녕하세요, 서윤이에요. 오늘 할 일을 하나씩 같이 챙겨 볼까요?',
    night: '오늘 일정은 여기까지 볼까요? 이제 편하게 쉬실 시간이에요.',
    schedulePending: '아직 대기 중인 일정이 있어요. 오늘 할 일에서 확인해 볼까요?',
    scheduleComplete: '오늘 일정은 모두 완료됐어요. 꼼꼼히 챙기셨네요.',
    rain: '비가 와요. 나가기 전에 우산과 신발부터 챙기세요.',
    snow: '눈이 와서 길이 미끄러울 수 있어요. 발밑을 잘 살펴 주세요.',
    thunder: '낙뢰 예보가 있어요. 외출은 미루고 실내에 머무르세요.',
  },
  char3: {
    greeting: '안녕하세요, 지은이에요. 오늘도 천천히, 편안하게 보내세요.',
    night: '오늘 하루 고생하셨어요. 마음 놓고 따뜻하게 쉬세요.',
    schedulePending: '남은 일정이 있어요. 서두르지 말고 하나씩 같이 챙겨요.',
    scheduleComplete: '오늘 할 일을 모두 마치셨네요. 이제 한숨 돌리셔도 좋아요.',
    rain: '비가 오네요. 나가실 땐 우산 챙기고 천천히 다녀오세요.',
    snow: '눈이 와요. 급히 걷지 마시고 발밑부터 살펴 주세요.',
    thunder: '낙뢰 예보가 떴어요. 마음 놓고 실내에서 쉬어 가세요.',
  },
  char4: {
    greeting: '안녕하세요, 준호예요! 오늘도 제가 힘차게 응원할게요.',
    night: '오늘도 정말 수고하셨어요! 푹 쉬고 내일 또 만나요.',
    schedulePending: '아직 할 일이 남았네요! 하나씩 해 봐요. 제가 응원할게요!',
    scheduleComplete: '와, 오늘 할 일 전부 끝냈네요! 정말 멋져요!',
    rain: '오, 비가 오네요! 나가실 땐 우산 꼭 잊지 마세요.',
    snow: '눈이 꽤 와요! 발밑 조심하고 한 걸음씩 가요.',
    thunder: '번개 예보가 있어요! 잠깐 실내에서 쉬어 가요.',
  },
  char5: {
    greeting: '안녕하세요, 도윤이에요. 무리하지 말고, 천천히 해 봐요.',
    night: '오늘도 수고하셨어요. 늦었으니 푹 쉬세요.',
    schedulePending: '남은 일정이 있어요. 괜찮으시면 한 번 확인해 주세요.',
    scheduleComplete: '할 일 다 끝내셨네요. 정말 잘하셨어요.',
    rain: '밖에 비가 와요. 나가실 때 우산 꼭 챙기세요.',
    snow: '눈이 오네요. 미끄러우니 천천히 걸으세요.',
    thunder: '낙뢰 예보가 있어요. 잠깐 실내에 계시는 게 좋아요.',
  },
} as const satisfies Record<CharacterId, Record<HomeDialogueSituation, string>>;
