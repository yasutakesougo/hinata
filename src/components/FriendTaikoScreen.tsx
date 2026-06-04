import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { StarProgress } from '../App';

interface FriendTaikoScreenProps {
  currentStep: number;
  totalSteps: number;
  starResults: boolean[];
  soundEnabled: boolean;
  onPlaySound: (type: 'correct' | 'wrong' | 'tap' | 'victory' | 'pop') => void;
  speakText: (text: string, enabled: boolean) => void;
  onGoBack: () => void;
  onStepComplete: (initial: number, tapped: number) => void;
  onNextStep: () => void;
  reducedMotion: boolean;
}

// 乱数用ヘルパー
function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ランダムに吹き出しキャラを決める用のリスト
const ANIMAL_PARTNERS = [
  { emoji: '🐰', name: 'ミミちゃん' },
  { emoji: '🐿', name: 'ココちゃん' },
  { emoji: '🐱', name: 'ニャンコ' },
  { emoji: '🐨', name: 'コアラくん' }
];

export const FriendTaikoScreen: React.FC<FriendTaikoScreenProps> = ({
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
  // 初期ランプ点灯数を決定 (6〜9)
  const [initialCount] = useState<number>(() => getRandomNumber(6, 9));
  const neededCount = 10 - initialCount;

  // 出演する動物をランダムに決定
  const [animal] = useState(() => ANIMAL_PARTNERS[getRandomNumber(0, ANIMAL_PARTNERS.length - 1)]);

  // 状態管理
  const [tappedCount, setTappedCount] = useState<number>(0);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDrumActive, setIsDrumActive] = useState<boolean>(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);

  // タイマー参照
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentLights = initialCount + tappedCount;

  // 開始時の音声アナウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      speakText(
        `${initialCount}こ 光っているよ。あといくつで 10こかな？ たいこを 叩いてみよう！`,
        soundEnabled
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [initialCount, speakText, soundEnabled]);

  // コンポーネント破棄時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  // 太鼓専用のポンという音声を Web Audio API で再生 (爆音防止のボリューム調整)
  const playDrumAudio = () => {
    if (!soundEnabled) return;
    const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.type = 'triangle'; // 和太鼓に似た丸みのある音波

      // 音程のスライド (ポン！というアタックと余韻を再現)
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);

      // ボリュームコントロール (低刺激に抑えるため小さめの 0.05)
      gainNode.gain.setValueAtTime(0.06, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.error('Failed to play drum synth sound:', e);
    }
  };

  // 太鼓をタップした時の処理
  const handleDrumTap = () => {
    if (result === 'correct' || isProcessing) return;

    // 太鼓のビジュアルリアクション
    setIsDrumActive(true);
    setTimeout(() => setIsDrumActive(false), 100);

    // 太鼓の合成音を再生
    playDrumAudio();

    // 叩いた回数をインクリメント
    const nextTapped = tappedCount + 1;
    setTappedCount(nextTapped);

    const nextLights = initialCount + nextTapped;

    if (nextLights === 10) {
      // ちょうど10に達した場合 (正解)
      setIsProcessing(true);
      setResult('correct');
      setShowSuccessAnim(true);
      onPlaySound('correct');

      // 履歴等へ記録
      onStepComplete(initialCount, nextTapped);

      // コール＆レスポンスの読み上げ (10になった嬉しさを伝える)
      setTimeout(() => {
        speakText(
          `${neededCount}！ ${initialCount} と ${neededCount} で 10！ ぴかぴかになったね。`,
          soundEnabled
        );
        setIsProcessing(false);
      }, 500);

    } else if (nextLights > 10) {
      // 10を超えてしまった場合 (過剰タップ)
      setIsProcessing(true);
      setResult('wrong');
      onPlaySound('wrong');

      speakText(
        `おっと！ たたきすぎちゃった。もういちど 10に してみよう！`,
        soundEnabled
      );

      // 1.8秒後に自動的に初期状態にリセット
      resetTimerRef.current = setTimeout(() => {
        setTappedCount(0);
        setResult(null);
        setIsProcessing(false);
      }, 1800);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 animate-fadeIn">
      {/* 上部ナビゲーションと進捗 */}
      <div className="w-full max-w-2xl flex items-center justify-between gap-4">
        <button
          onClick={onGoBack}
          className="hinata-btn-secondary p-2.5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <StarProgress
          currentStep={currentStep}
          totalSteps={totalSteps}
          title="10の ともだちたいこ"
          starResults={starResults}
        />
        <div className="w-12 h-12" /> {/* 左右バランス用 */}
      </div>

      {/* メインゲームボード */}
      <div className="hinata-activity-frame">
        {/* 正解時キラキラエフェクト */}
        {showSuccessAnim && (
          <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none flex items-center justify-center z-20 animate-fadeIn">
            <div className="flex gap-4">
              <Sparkles className="w-16 h-16 text-yellow-400 animate-spin" />
              <Sparkles className="w-16 h-16 text-yellow-400 animate-bounce" />
            </div>
          </div>
        )}

        {/* コール＆レスポンス どうぶつ吹き出しエリア */}
        <div className="flex items-start gap-3 bg-hinata-active-bg border-4 border-hinata-border rounded-2xl p-4 min-h-[100px] relative">
          <div className="text-5xl select-none flex-shrink-0 animate-fadeIn">
            {animal.emoji}
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <span className="text-[10px] font-black text-hinata-accent block mb-1">
              {animal.name}
            </span>
            <h2 className="text-base md:text-lg font-black text-hinata-text leading-relaxed">
              {result === 'correct' ? (
                <span>
                  <span className="text-2xl text-emerald-600 font-extrabold">{neededCount}！</span>
                  <br className="sm:hidden" />
                  {initialCount} と {neededCount} で 10！
                </span>
              ) : result === 'wrong' ? (
                <span className="text-[#DC2626] font-black">
                  おっと！たたきすぎちゃった。もういちど 10にしてみよう！
                </span>
              ) : (
                <span>
                  <span className="text-xl text-hinata-accent font-extrabold">{initialCount}</span> の おともだちは なーんだ？
                  たいこを トントン たたいてみよう！
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* 10マスのともだちランプ (5マス×2段) */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-extrabold text-slate-500">
              💡 ともだちランプ ({currentLights} / 10)
            </span>
          </div>

          <div className="bg-hinata-active-bg/40 border-4 border-hinata-border rounded-2xl p-4 flex flex-col gap-2 shadow-inner">
            {/* 上段5マス */}
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 5 }).map((_, idx) => {
                const isLit = idx < currentLights;
                const isInitial = idx < initialCount;

                return (
                  <div
                    key={`top-lamp-${idx}`}
                    className={`aspect-square rounded-full flex items-center justify-center relative border-3 transition-all duration-200 ${
                      isLit
                        ? isInitial
                          ? 'border-yellow-400 bg-gradient-to-br from-amber-300 to-yellow-400 shadow-md shadow-yellow-300/40 text-yellow-950 font-black'
                          : result === 'wrong'
                            ? 'border-rose-400 bg-rose-300 text-rose-950 font-black'
                            : 'border-emerald-400 bg-gradient-to-br from-emerald-300 to-green-400 shadow-md shadow-emerald-300/40 text-emerald-950 font-black'
                        : 'border-slate-200 bg-white text-slate-300 border-dashed'
                    }`}
                  >
                    {isLit ? (
                      <span className={`text-base font-black ${!reducedMotion && !isInitial && result !== 'wrong' ? 'animate-pulse' : ''}`}>
                        🌟
                      </span>
                    ) : (
                      <span className="text-xs select-none font-bold">{idx + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 下段5マス */}
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 5 }).map((_, idx) => {
                const gridIdx = idx + 5;
                const isLit = gridIdx < currentLights;
                const isInitial = gridIdx < initialCount;

                return (
                  <div
                    key={`bottom-lamp-${idx}`}
                    className={`aspect-square rounded-full flex items-center justify-center relative border-3 transition-all duration-200 ${
                      isLit
                        ? isInitial
                          ? 'border-yellow-400 bg-gradient-to-br from-amber-300 to-yellow-400 shadow-md shadow-yellow-300/40 text-yellow-950 font-black'
                          : result === 'wrong'
                            ? 'border-rose-400 bg-rose-300 text-rose-950 font-black'
                            : 'border-emerald-400 bg-gradient-to-br from-emerald-300 to-green-400 shadow-md shadow-emerald-300/40 text-emerald-950 font-black'
                        : 'border-slate-200 bg-white text-slate-300 border-dashed'
                    }`}
                  >
                    {isLit ? (
                      <span className={`text-base font-black ${!reducedMotion && !isInitial && result !== 'wrong' ? 'animate-pulse' : ''}`}>
                        🌟
                      </span>
                    ) : (
                      <span className="text-xs select-none font-bold">{gridIdx + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* たいこ 🥁 エリア */}
        <div className="flex flex-col items-center justify-center py-4 relative">
          {/* 太鼓の台座と太鼓本体 */}
          <div className="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center">

            {/* 太鼓のバウンスアニメーション */}
            <button
              onClick={handleDrumTap}
              disabled={result === 'correct' || result === 'wrong' || isProcessing}
              className={`w-40 h-40 md:w-48 md:h-48 rounded-full bg-gradient-to-b from-[#EF4444] to-[#B91C1C] border-8 border-[#991B1B] shadow-[0_8px_0_#7F1D1D] active:translate-y-[4px] active:shadow-[0_2px_0_#7F1D1D] transition-all outline-none select-none cursor-pointer relative z-10 ${
                isDrumActive && !reducedMotion ? 'scale-90 duration-75' : 'hover:scale-[1.02] duration-150'
              } disabled:opacity-90 disabled:cursor-not-allowed`}
            >
              {/* 太鼓の皮・打面 */}
              <div className="w-[82%] h-[82%] rounded-full bg-[#FCF8F2] border-4 border-dashed border-[#DC2626]/40 flex flex-col items-center justify-center shadow-inner relative">

                {/* 伝統的な三つ巴マークの簡略的な表示 */}
                <div className="text-[#B91C1C]/15 text-5xl font-serif select-none absolute">
                  🥁
                </div>

                {/* テキストガイド */}
                <span className="text-[#DC2626] font-black text-base md:text-lg tracking-wider relative z-20">
                  たたこう！
                </span>
                <span className="text-[#DC2626]/60 font-extrabold text-[10px] tracking-tight relative z-20 mt-0.5">
                  トントン！
                </span>
              </div>
            </button>

            {/* 太鼓の木製台座 */}
            <div className="absolute bottom-[-10px] w-48 h-12 bg-amber-800 rounded-lg border-b-4 border-amber-950 flex justify-around items-center px-6 z-0 shadow-md">
              <div className="w-4 h-8 bg-amber-900 border-l border-amber-950 rounded-xs" />
              <div className="w-4 h-8 bg-amber-900 border-r border-amber-950 rounded-xs" />
            </div>
          </div>

          {/* 叩きすぎ警告時のエフェクト表示 */}
          {result === 'wrong' && (
            <div className="absolute inset-0 bg-red-500/5 pointer-events-none flex items-center justify-center animate-pulse z-20">
              <span className="text-red-600 font-extrabold text-sm bg-white/90 border border-red-300 py-1.5 px-4 rounded-full shadow-lg">
                ⚠️ たたきすぎちゃった！
              </span>
            </div>
          )}
        </div>

        {/* 下部数式と次へ進むボタン */}
        <div className="flex flex-col items-center gap-3 min-h-[76px]">
          {result === 'correct' ? (
            <div className="text-center w-full animate-fadeIn flex flex-col items-center gap-4">
              {/* ピカピカ数式表示 */}
              <div className="w-full bg-hinata-active-bg border-4 border-hinata-border rounded-2xl py-3 px-6 flex items-center justify-center gap-3 font-black text-hinata-text select-none shadow-xs">
                <span className="text-3xl md:text-4xl">{initialCount}</span>
                <span className="text-xl">と</span>
                <span className="text-3xl md:text-4xl text-hinata-accent animate-pulse">{neededCount}</span>
                <span className="text-xl">で</span>
                <span className="text-3xl md:text-4xl">10</span>
              </div>

              <button
                onClick={() => {
                  if (isProcessing) return;
                  setIsProcessing(true);
                  onNextStep();
                }}
                disabled={isProcessing}
                className="hinata-btn-primary bg-emerald-500 border-emerald-600 border-b-emerald-700 hover:bg-emerald-400 text-white px-14 py-3 min-h-[48px] disabled:opacity-50"
              >
                つぎへすすむ ➔
              </button>
            </div>
          ) : result === 'wrong' ? (
            <span className="text-xs font-extrabold text-rose-500 animate-pulse bg-rose-50 border border-rose-200 px-4 py-1.5 rounded-full">
              おやつをリセットするよ。もういちど 叩いてみてね！
            </span>
          ) : (
            <span className="text-xs font-bold text-slate-400">
              あと <span className="text-hinata-accent font-black text-sm">{neededCount - tappedCount}回</span> たたこう！
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
