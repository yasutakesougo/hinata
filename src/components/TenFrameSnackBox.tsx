import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { StarProgress } from '../App';

interface TenFrameSnackBoxScreenProps {
  currentStep: number;
  totalSteps: number;
  starResults: boolean[];
  soundEnabled: boolean;
  onPlaySound: (type: 'correct' | 'wrong' | 'tap' | 'whoosh' | 'pop' | 'damage' | 'victory' | 'clear' | 'eat' | 'sparkle' | 'ton') => void;
  speakText: (text: string, enabled: boolean) => void;
  onGoBack: () => void;
  onStepComplete: (total: number) => void;
  onNextStep: () => void;
  reducedMotion: boolean;
}

// 初期メッセージと褒め言葉を決定するヘルパー関数
// (set-state-in-effect エラーを回避するため、初期状態定義時に使用します)
const getInitialMessages = (count: number, reducedMotion: boolean, randomPraise: string) => {
  if (!reducedMotion) {
    return {
      message: `おやつが ${count}こ あるよ。`,
      praiseText: ''
    };
  }

  if (count === 5) {
    return {
      message: '💮 5のまとまりが できたね',
      praiseText: randomPraise
    };
  } else if (count > 5 && count < 10) {
    const rest = count - 5;
    return {
      message: `💮 5と${rest}に わけて みえたね`,
      praiseText: `5と ${rest} で ${count} だね。 ${randomPraise}`
    };
  } else if (count === 10) {
    return {
      message: '💮 10のはこが いっぱいになったね',
      praiseText: `10になったことに気づけたね。 ${randomPraise}`
    };
  } else {
    return {
      message: `💮 ${count}こ のおやつだね`,
      praiseText: randomPraise
    };
  }
};

export const TenFrameSnackBoxScreen: React.FC<TenFrameSnackBoxScreenProps> = ({
  currentStep,
  totalSteps,
  starResults,
  soundEnabled,
  onPlaySound,
  speakText,
  onGoBack,
  onStepComplete,
  onNextStep,
  reducedMotion,
}) => {
  // おやつの数をランダムに決定 (1〜10)。
  // 5と10のまとまりの学習を意識するため、5〜10が出やすい重み付け（5〜10: 80%, 1〜4: 20%）にします。
  const [targetCount] = useState<number>(() => {
    const isBig = Math.random() < 0.8;
    if (isBig) {
      return Math.floor(Math.random() * 6) + 5; // 5〜10
    } else {
      return Math.floor(Math.random() * 4) + 1; // 1〜4
    }
  });

  const [visibleCount, setVisibleCount] = useState<number>(reducedMotion ? targetCount : 0);
  const [animationState, setAnimationState] = useState<'idle' | 'playing' | 'paused' | 'done'>(
    reducedMotion ? 'done' : 'idle'
  );
  
  // 褒め言葉のバリエーション
  const [randomPraise] = useState<string>(() => {
    const praises = [
      'よく みつけたね',
      'かたまりで みえたね',
      'ひとつずつ かぞえなくても みえたね'
    ];
    return praises[Math.floor(Math.random() * praises.length)];
  });

  // 初期メッセージ設定
  const [initialData] = useState(() => getInitialMessages(targetCount, reducedMotion, randomPraise));
  const [message, setMessage] = useState<string>(initialData.message);
  const [praiseText, setPraiseText] = useState<string>(initialData.praiseText);
  const [isGlowing, setIsGlowing] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // アニメーション完了時のメッセージとエフェクトトリガー
  const triggerDoneEffects = (count: number) => {
    if (count === 5) {
      setMessage('💮 5のまとまりが できたね');
      setPraiseText(randomPraise);
    } else if (count > 5 && count < 10) {
      const rest = count - 5;
      const msg = `💮 5と${rest}に わけて みえたね`;
      setMessage(msg);
      setPraiseText(`5と ${rest} で ${count} だね。 ${randomPraise}`);
      onPlaySound('sparkle');
      speakText(`5と ${rest}に わけて みえたね。 5と ${rest}で、 ${count}だね。`, soundEnabled);
    } else if (count === 10) {
      setMessage('💮 10のはこが いっぱいになったね');
      setPraiseText(`10になったことに気づけたね。 ${randomPraise}`);
      if (!reducedMotion) {
        setIsGlowing(true);
        // 発光エフェクト時間
        setTimeout(() => setIsGlowing(false), 2000);
      }
      onPlaySound('sparkle');
      speakText(`10のはこが いっぱいになったね。 10になったことにきづけたね。`, soundEnabled);
    } else {
      // 1〜4個の場合
      setMessage(`💮 ${count}こ のおやつだね`);
      setPraiseText(randomPraise);
      onPlaySound('sparkle');
      speakText(`${count}こ のおやつだね。`, soundEnabled);
    }
  };

  // 開始時の音声アナウンスと初期メッセージ
  useEffect(() => {
    // アニメーションの自動開始（reducedMotion がオフのときのみ）
    if (!reducedMotion) {
      const startText = `おやつが ${targetCount}こ あるよ。はこに いれてみよう！`;
      const voiceTimer = setTimeout(() => {
        speakText(startText, soundEnabled);
      }, 450);

      const animStartTimer = setTimeout(() => {
        setAnimationState('playing');
      }, 1200);
      return () => {
        clearTimeout(voiceTimer);
        clearTimeout(animStartTimer);
        window.speechSynthesis.cancel();
      };
    } else {
      // reducedMotion 時の初期音声再生と読み上げ (非同期的な副作用のみ行う)
      onPlaySound('sparkle');
      const speakMsg = targetCount === 5 
        ? '5のまとまりができたね'
        : targetCount > 5 && targetCount < 10
        ? `5と ${targetCount - 5}に わけて みえたね。 5と ${targetCount - 5}で、 ${targetCount}だね。`
        : targetCount === 10
        ? '10のはこが いっぱいになったね。 10になったことにきづけたね。'
        : `${targetCount}こ のおやつだね。`;

      const voiceTimer = setTimeout(() => {
        speakText(speakMsg, soundEnabled);
      }, 450);

      return () => {
        clearTimeout(voiceTimer);
        window.speechSynthesis.cancel();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCount, reducedMotion]);

  // アニメーション進行制御
  useEffect(() => {
    if (animationState !== 'playing' || reducedMotion) return;

    const nextCount = visibleCount + 1;

    if (nextCount <= targetCount) {
      const isTopRow = nextCount <= 5;
      const interval = isTopRow ? 180 : 360;

      timerRef.current = setTimeout(() => {
        setVisibleCount(nextCount);

        // 音声効果
        if (isTopRow) {
          onPlaySound('tap');
        } else {
          onPlaySound('ton');
        }

        // 5個目のマイルストーン判定
        if (nextCount === 5 && targetCount >= 5) {
          setAnimationState('paused');
          setMessage('💮 5のまとまりが できたね');
          onPlaySound('sparkle');
          speakText('5のまとまりができたね', soundEnabled);

          // 600ms後に再開するか、完了にするか
          timerRef.current = setTimeout(() => {
            if (targetCount > 5) {
              setAnimationState('playing');
            } else {
              setAnimationState('done');
              // 5個で完了した時のメッセージをセット
              setPraiseText(randomPraise);
            }
          }, 700);
        } else if (nextCount === targetCount) {
          setAnimationState('done');
          triggerDoneEffects(targetCount);
        }
      }, interval);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCount, animationState, targetCount, reducedMotion]);

  // 「できた！」ボタン押下でステップを完了する
  const handleComplete = () => {
    window.speechSynthesis.cancel();
    onPlaySound('tap');
    onStepComplete(targetCount);
    onNextStep();
  };

  const isDone = animationState === 'done';

  return (
    <div className="w-full flex flex-col items-center gap-4 animate-fadeIn">
      {/* 上部ナビゲーションと進捗 */}
      <div className="w-full max-w-2xl flex items-center justify-between gap-4">
        <button onClick={onGoBack} className="hinata-btn-secondary p-2.5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <StarProgress
          currentStep={currentStep}
          totalSteps={totalSteps}
          title="おやつばこ テンフレーム"
          starResults={starResults}
        />
        <div className="w-12 h-12" /> {/* 左右バランス用 */}
      </div>

      {/* メインゲームボード */}
      <div className={`hinata-activity-frame ${isGlowing ? 'ring-8 ring-amber-400 bg-amber-50/20' : ''} transition-all duration-300`}>
        {/* 指示テキスト */}
        <div className="bg-hinata-active-bg border-4 border-hinata-border rounded-2xl p-4 text-center">
          <span className="bg-hinata-accent text-white font-black text-xs px-2.5 py-0.5 rounded-full inline-block mb-1">
            みてみよう
          </span>
          <h2 className="text-xl md:text-2xl font-black text-hinata-text leading-relaxed mt-1">
            おやつが <span className="text-hinata-accent text-3xl font-black">{targetCount}</span> こ あるよ。
          </h2>
          <p className="text-sm font-bold text-slate-500 mt-1">
            5と10の まとまりを みつけてみてね！
          </p>
        </div>

        {/* 10マスのおやつ箱 (5のまとまり表示) */}
        <div className="flex flex-col gap-2 my-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-extrabold text-slate-500">
              📦 おやつばこ ({visibleCount} / 10)
            </span>
          </div>

          {/* 10マスのグリッド */}
          <div className={`bg-hinata-active-bg/40 border-4 border-hinata-border rounded-2xl p-4 flex flex-col gap-2 shadow-inner transition-colors duration-300 ${isGlowing ? 'bg-amber-100/50 border-amber-300' : ''}`}>
            {/* 上段5マス */}
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 5 }).map((_, idx) => {
                const isFilled = idx < visibleCount;
                return (
                  <div
                    key={`top-${idx}`}
                    className={`aspect-square rounded-xl flex items-center justify-center relative border-2 transition-all duration-200 ${
                      isFilled
                        ? 'border-hinata-border bg-white shadow-xs scale-100'
                        : 'border-slate-200 bg-slate-100/40 border-dashed scale-95'
                    }`}
                  >
                    {isFilled && (
                      <span className={`text-4xl md:text-5xl filter drop-shadow-sm select-none ${reducedMotion ? '' : 'animate-bounce-once'}`}>
                        🍓
                      </span>
                    )}
                    {!isFilled && (
                      <div className="w-8 h-8 rounded-full bg-slate-200/20 border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400/40 font-bold select-none">
                        {idx + 1}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 下段5マス */}
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 5 }).map((_, idx) => {
                const gridIdx = idx + 5;
                const isFilled = gridIdx < visibleCount;
                return (
                  <div
                    key={`bottom-${idx}`}
                    className={`aspect-square rounded-xl flex items-center justify-center relative border-2 transition-all duration-200 ${
                      isFilled
                        ? 'border-hinata-border bg-white shadow-xs scale-100'
                        : 'border-slate-200 bg-slate-100/40 border-dashed scale-95'
                    }`}
                  >
                    {isFilled && (
                      <span className={`text-4xl md:text-5xl filter drop-shadow-sm select-none ${reducedMotion ? '' : 'animate-bounce-once'}`}>
                        🍓
                      </span>
                    )}
                    {!isFilled && (
                      <div className="w-8 h-8 rounded-full bg-slate-200/20 border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400/40 font-bold select-none">
                        {gridIdx + 1}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* メッセージ表示カード */}
        <div className="min-h-[100px] flex flex-col justify-center items-center">
          {message && (
            <div className="w-full bg-hinata-active-bg border-4 border-hinata-border rounded-2xl p-4 text-center animate-scaleUp">
              <span className="text-lg md:text-xl font-black text-hinata-text block leading-normal">
                {message}
              </span>
              {isDone && praiseText && (
                <span className="text-xs md:text-sm font-bold text-slate-500 block mt-2 animate-fadeIn">
                  💡 {praiseText}
                </span>
              )}
            </div>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex justify-center mt-2 min-h-[48px]">
          {isDone && (
            <button
              onClick={handleComplete}
              className="hinata-btn-primary px-14 py-3 text-lg font-black min-h-[48px] animate-scaleUp"
            >
              できた！ ➔
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
