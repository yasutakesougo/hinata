import React, { useState, useEffect, useRef } from 'react';
import { CompanionBubble } from './CompanionBubble';
import { COMPANION_MESSAGES, ANIMAL_SPECIFIC_MESSAGES } from '../constants/companionMessages';

interface CompanionWalkerProps {
  unlockedRewards: string[];
  reducedMotion: boolean;
  onPlaySound: (type: 'tap') => void;
  isDecorating?: boolean;
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
}) => {
  const [activeBubbles, setActiveBubbles] = useState<Record<number, string | null>>({});
  const bubbleTimers = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});

  useEffect(() => {
    const currentTimers = bubbleTimers.current;
    return () => {
      // Clean up timers on unmount
      Object.values(currentTimers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const unlockedAnimals = unlockedRewards
    .map(name => ({ name, emoji: REWARD_EMOJIS[name] }))
    .filter(item => Boolean(item.emoji));

  if (unlockedAnimals.length === 0) {
    // 初期状態で解放済み動物がいない場合は、既存の案内役リス表示を維持する
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

    // メッセージの決定
    const specific = ANIMAL_SPECIFIC_MESSAGES[emoji];
    const messages = specific && specific.length > 0 ? specific : COMPANION_MESSAGES;
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
  const walkClasses = ['animate-walk-a', 'animate-walk-b', 'animate-walk-c'];
  // 静止位置
  const staticPositions = ['left-[25%]', 'left-[50%]', 'left-[75%]'];
  const staticLeftValues = ['25%', '50%', '75%'];

  return (
    <div className="absolute inset-x-0 bottom-6 h-14 z-10 pointer-events-none">
      {displayAnimals.map((animal, idx) => {
        const hasBubble = Boolean(activeBubbles[idx]);
        const bubbleMsg = activeBubbles[idx] || '';

        // アニメーションOFF設定の時は静止クラス、ONの時は往復アニメーション
        const walkClass = reducedMotion ? staticPositions[idx] : walkClasses[idx];

        return (
          <div
            key={idx}
            className={`absolute bottom-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300 ${walkClass} ${
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
              className={`text-5xl select-none filter drop-shadow-md hover:scale-110 active:scale-95 transition-transform duration-150 block ${
                isDecorating ? 'cursor-default opacity-80' : 'cursor-pointer'
              }`}
              role="img"
              aria-label={animal.name}
            >
              {animal.emoji}
            </span>
          </div>
        );
      })}
    </div>
  );
};
