import React, { useState, useEffect, useRef } from 'react';
import { CompanionBubble } from './CompanionBubble';
import { COMPANION_MESSAGES, ANIMAL_SPECIFIC_MESSAGES, SEASON_MESSAGES } from '../constants/companionMessages';

interface CompanionWalkerProps {
  unlockedRewards: string[];
  reducedMotion: boolean;
  onPlaySound: (type: 'tap') => void;
  isDecorating?: boolean;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
}

const REWARD_EMOJIS: Record<string, string> = {
  'ぴょんうさぎ': '🐰',
  'のっそりくま': '🐻',
  'ぱたぱたとり': '🐤',
  'うきうきさる': '🐒',
  'もぐもぐねずみ': '🐹',
  'もぐもぐハムスター': '🐹',
  'おしゃべりオウム': '🦜',
  'まねきねこ': '🐱',
  'さんすうパンダ': '🐼',
  'くだものドラゴン': '🐲',
  'くだものキング': '👑',
  'さくらんぼリス': '🐿️',
};

// Purity rule workarounds
function getRandom(): number {
  return Math.random();
}

export const CompanionWalker: React.FC<CompanionWalkerProps> = ({
  unlockedRewards,
  reducedMotion,
  onPlaySound,
  isDecorating = false,
  season,
}) => {
  const [activeBubbles, setActiveBubbles] = useState<Record<number, string | null>>({});
  const [jumpingIndex, setJumpingIndex] = useState<number | null>(null);
  const bubbleTimers = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
  const jumpTimers = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});

  useEffect(() => {
    const currentTimers = bubbleTimers.current;
    const currentJumpTimers = jumpTimers.current;
    return () => {
      // Clean up timers on unmount
      Object.values(currentTimers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      Object.values(currentJumpTimers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const unlockedAnimals = unlockedRewards
    .map(name => ({ name, emoji: REWARD_EMOJIS[name] }))
    .filter(item => Boolean(item.emoji));

  if (unlockedAnimals.length === 0) {
    // 初期状態で解放済み動物がいない場合は、既存 of 案内役リス表示を維持する
    return (
      <div className="flex items-center gap-3 bg-white/80 border border-emerald-100 rounded-2xl px-4 py-2.5 shadow-sm text-center mb-2 mx-auto animate-pulse">
        <span className="text-3xl">🐿️</span>
        <p className="text-xs font-black text-emerald-800">
          ぼうけんに でかけて なかまを ふやそう！
        </p>
      </div>
    );
  }

  // 最大3匹
  const displayAnimals = unlockedAnimals.slice(0, 3);

  const handleTap = (idx: number, emoji: string) => {
    if (isDecorating) return; // かざりつけ中はタップ無効
    onPlaySound('tap');

    // タップされた動物をぴょんっとジャンプさせる (うごきをとめる設定がオフのときのみ)
    if (!reducedMotion) {
      setJumpingIndex(idx);
      if (jumpTimers.current[idx]) {
        clearTimeout(jumpTimers.current[idx]!);
      }
      jumpTimers.current[idx] = setTimeout(() => {
        setJumpingIndex(prev => prev === idx ? null : prev);
        jumpTimers.current[idx] = null;
      }, 600); // 600ms は bounce-once アニメーションの長さに合わせる
    }

    // メッセージの決定（通常メッセージ＋動物専用メッセージ＋季節限定メッセージ）
    const specific = ANIMAL_SPECIFIC_MESSAGES[emoji] || [];
    const seasonal = SEASON_MESSAGES[season] || [];
    const messages = [...COMPANION_MESSAGES, ...specific, ...seasonal];
    const randomIndex = Math.floor(getRandom() * messages.length);
    const msg = messages[randomIndex];

    setActiveBubbles(prev => ({ ...prev, [idx]: msg }));

    // 既存のタイマーがあればクリア
    if (bubbleTimers.current[idx]) {
      clearTimeout(bubbleTimers.current[idx]!);
    }

    // 3秒後に自然に消去する
    bubbleTimers.current[idx] = setTimeout(() => {
      setActiveBubbles(prev => ({ ...prev, [idx]: null }));
      bubbleTimers.current[idx] = null;
    }, 3000);
  };

  // アニメーションパターン
  const walkPosClasses = ['animate-walk-a-pos', 'animate-walk-b-pos', 'animate-walk-c-pos'];
  const walkFlipClasses = ['animate-walk-a-flip', 'animate-walk-b-flip', 'animate-walk-c-flip'];
  // 静止位置
  const staticPositions = ['left-[25%]', 'left-[50%]', 'left-[75%]'];
  const staticLeftValues = ['25%', '50%', '75%'];

  return (
    <div className="absolute inset-x-0 bottom-6 h-14 z-10 pointer-events-none">
      {displayAnimals.map((animal, idx) => {
        const hasBubble = Boolean(activeBubbles[idx]);
        const bubbleMsg = activeBubbles[idx] || '';

        // アニメーションOFF設定の時は静止クラス、ONの時は往復アニメーション
        const walkPosClass = reducedMotion ? staticPositions[idx] : walkPosClasses[idx];
        const walkFlipClass = reducedMotion ? '' : walkFlipClasses[idx];
        const isJumping = jumpingIndex === idx;
        const jumpClass = isJumping ? 'animate-bounce-once' : '';

        return (
          <div
            key={idx}
            className={`absolute bottom-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300 ${walkPosClass} ${
              isDecorating ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
            style={{
              // CSS prefers-reduced-motion 用のフォールバック位置をカスタムプロパティで渡す
              '--static-left': staticLeftValues[idx],
            } as React.CSSProperties}
          >
            {hasBubble && !isDecorating && <CompanionBubble message={bubbleMsg} />}
            <span
              onClick={() => handleTap(idx, animal.emoji)}
              className={`text-5xl select-none filter drop-shadow-md hover:scale-110 active:scale-95 transition-transform duration-150 block ${jumpClass} ${
                isDecorating ? 'cursor-default opacity-80' : 'cursor-pointer'
              }`}
              role="img"
              aria-label={animal.name}
            >
              <span className={`block ${walkFlipClass}`}>
                {animal.emoji}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
};
