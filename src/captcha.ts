// Simple arithmetic captcha with 4 shuffled answer buttons.
// Good enough to block the vast majority of link/adult-content spam bots,
// which almost never solve interactive challenges -- they just blast messages.

export interface CaptchaChallenge {
  question: string;
  correctAnswer: number;
  options: number[];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateCaptcha(): CaptchaChallenge {
  const a = randomInt(1, 9);
  const b = randomInt(1, 9);
  const correctAnswer = a + b;

  const options = new Set<number>([correctAnswer]);
  while (options.size < 4) {
    const decoy = correctAnswer + randomInt(-5, 5);
    if (decoy > 0 && decoy !== correctAnswer) options.add(decoy);
  }
  const shuffled = Array.from(options).sort(() => Math.random() - 0.5);

  return {
    question: `${a} + ${b} = ?`,
    correctAnswer,
    options: shuffled,
  };
}

export function buildCaptchaKeyboard(chatId: number, userId: number, challenge: CaptchaChallenge) {
  return {
    inline_keyboard: [
      challenge.options.map((opt) => ({
        text: String(opt),
        callback_data: `cap:${chatId}:${userId}:${opt}`,
      })),
    ],
  };
}
