// ============================================================================
// World Research Lab (せかいけんきゅうじょ) — Phase WRL-1 型定義
// ============================================================================

export interface WorldResearchLabLog {
  id: string;
  createdAt: string;      // new Date().toISOString()
  displayDate: string;    // ja-JP表示用
  hp: number;             // 1〜10
  signs: {
    light: boolean;             // まぶしい
    noise: boolean;             // うるさい
    stomach: boolean;           // おなかが痛い / 気持ち悪い
    thumbSucking: boolean;      // ゆびで おちつきたくなる
    crying: boolean;            // 涙が出る
    schoolReluctance: boolean;  // 今日の予定・登校前負荷のサイン
  };
}

export type SignKey = keyof WorldResearchLabLog['signs'];

export const SIGN_LABELS: Record<SignKey, { emoji: string; label: string }> = {
  light:             { emoji: '☀️', label: 'まぶしい' },
  noise:             { emoji: '📢', label: 'うるさい' },
  stomach:           { emoji: '🤢', label: 'おなかが いたい / きもちわるい' },
  thumbSucking:      { emoji: '👍', label: 'ゆびで おちつきたくなる' },
  crying:            { emoji: '😢', label: 'なみだが でる' },
  schoolReluctance:  { emoji: '📅', label: 'きょうのよていを かんがえると からだが おもい' },
};

export const SIGN_KEYS = Object.keys(SIGN_LABELS) as SignKey[];

export function getHpMessage(hp: number): { emoji: string; message: string } {
  if (hp <= 3) {
    return {
      emoji: '🪫',
      message: 'いまは ちょう・じゅうでんモード。なにもしないで あまえてOK。',
    };
  }
  if (hp <= 6) {
    return {
      emoji: '💛',
      message: 'すこし つかれたモード。すきなことをして、ゆっくりためよう。',
    };
  }
  return {
    emoji: '🔋',
    message: 'いいかんじ。じぶんのペースで すごそう。',
  };
}

export function createEmptySigns(): WorldResearchLabLog['signs'] {
  return {
    light: false,
    noise: false,
    stomach: false,
    thumbSucking: false,
    crying: false,
    schoolReluctance: false,
  };
}
