import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Plus, Minus, HelpCircle } from 'lucide-react';
import { StarProgress } from '../App';

interface Question {
  left: number;
  right: number;
  answer: number;
  fruit: string;
}

const QUESTIONS: Question[] = [
  { left: 8, right: 7, answer: 15, fruit: '🍒' },
  { left: 9, right: 4, answer: 13, fruit: '🍒' },
  { left: 7, right: 4, answer: 11, fruit: '🍒' },
  { left: 6, right: 5, answer: 11, fruit: '🍒' },
];

interface CherryCombineScreenProps {
  currentStep: number;
  totalSteps: number;
  starResults: boolean[];
  soundEnabled: boolean;
  onPlaySound: (type: 'correct' | 'wrong' | 'tap' | 'victory' | 'pop') => void;
  speakText: (text: string, enabled: boolean) => void;
  onGoBack: () => void;
  onStepComplete: (formula: string, isCorrect: boolean) => void;
  onNextStep: () => void;
  reducedMotion: boolean;
}

export const CherryCombineScreen: React.FC<CherryCombineScreenProps> = ({
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
  // ステップに応じた問題を取得 (1-indexed を 0-indexed に変換)
  const qIndex = Math.min(Math.max(currentStep - 1, 0), QUESTIONS.length - 1);
  const question = QUESTIONS[qIndex];

  const [movedCount, setMovedCount] = useState<number>(0);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [attempt, setAttempt] = useState<number>(0);
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);

  const needed = 10 - question.left;
  const currentLeftTotal = question.left + movedCount;
  const currentRightTotal = question.right - movedCount;

  // 開始時の音声アナウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      speakText(
        "さくらんぼが ふたつのはこに あるよ。うえのはこを 10こに できるかな？",
        soundEnabled
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [currentStep, speakText, soundEnabled]);

  // さくらんぼ（下）をタップしたときに上に移す
  const handleCherryFromBottomTap = () => {
    if (result === 'correct' || isProcessing) return;
    if (currentLeftTotal >= 10) {
      speakText("うえのはこは もう 10こ いっぱいだよ", soundEnabled);
      return;
    }
    onPlaySound('tap');
    setMovedCount(prev => prev + 1);
    setResult(null);
  };

  // さくらんぼ（上の追加分）をタップしたときに下に戻す
  const handleCherryFromTopTap = () => {
    if (result === 'correct' || isProcessing) return;
    if (movedCount <= 0) return;
    onPlaySound('tap');
    setMovedCount(prev => prev - 1);
    setResult(null);
  };

  // UDL調整ボタン：上に送る / 下に戻す
  const handleMoveUp = () => {
    if (result === 'correct' || isProcessing) return;
    if (currentLeftTotal >= 10) return;
    onPlaySound('pop');
    setMovedCount(prev => prev + 1);
    setResult(null);
  };

  const handleMoveDown = () => {
    if (result === 'correct' || isProcessing) return;
    if (movedCount <= 0) return;
    onPlaySound('pop');
    setMovedCount(prev => prev - 1);
    setResult(null);
  };

  // ヒント表示
  const triggerHint = () => {
    onPlaySound('tap');
    setShowHint(true);
    speakText(
      `あと ${needed}こで 10に なりそうだね。したのはこから すこし かりてみよう。`,
      soundEnabled
    );
  };

  // 「できた！」チェック
  const handleCheckAnswer = () => {
    if (result === 'correct' || isProcessing) return;

    if (currentLeftTotal === 10) {
      // 正解
      setIsProcessing(true);
      onPlaySound('correct');
      setResult('correct');
      setShowSuccessAnim(true);

      const formula = `${question.left} + ${question.right} = ${question.answer}`;
      onStepComplete(formula, attempt === 0);

      // 音声アナウンス
      setTimeout(() => {
        speakText(
          `💮 10が できた！のこりは ${currentRightTotal}こ。10と ${currentRightTotal}で、${question.answer}だね。`,
          soundEnabled
        );
        setIsProcessing(false);
      }, 400);

    } else {
      // 不正解
      onPlaySound('wrong');
      setResult('wrong');
      const nextAttempt = attempt + 1;
      setAttempt(nextAttempt);

      speakText(
        "だいじょうぶ。さくらんぼは にげないよ。もういちど つくってみよう。",
        soundEnabled
      );

      // 2回目以降の誤答でヒントを自動発声/ハイライト
      if (nextAttempt >= 1) {
        setShowHint(true);
      }
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
          title="さくらんぼたいじ"
          starResults={starResults}
        />
        <button
          onClick={triggerHint}
          disabled={result === 'correct'}
          className="hinata-btn-secondary p-2.5 disabled:opacity-40"
          title="ヒントをきく"
        >
          <HelpCircle className="w-5 h-5 text-violet-600" />
        </button>
      </div>

      {/* メインボード */}
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

        {/* 問題指示テキスト */}
        <div className="bg-hinata-active-bg border-4 border-hinata-border rounded-2xl p-4 text-center">
          <span className="bg-hinata-accent text-white font-black text-xs px-2.5 py-0.5 rounded-full inline-block mb-1">
            ミッション
          </span>
          <h2 className="text-xl md:text-2xl font-black text-hinata-text leading-relaxed mt-1">
            うえの はこを <span className="text-hinata-accent text-3xl font-black">10こ</span> に しよう！
          </h2>
        </div>

        {/* 🍒 さくらんぼ計算 視覚化エリア */}
        <div className="flex flex-col items-center justify-center font-black text-3xl md:text-4xl text-hinata-text select-none py-2 relative h-36">
          <div className="flex items-center gap-6 z-10">
            <span>{question.left}</span>
            <span>+</span>
            <span className="relative inline-block px-1">
              {question.right}
              {/* さくらんぼ分解の枝 (正解時) */}
              {result === 'correct' && (
                <svg className="absolute top-[80%] left-1/2 -translate-x-1/2 w-24 h-16 overflow-visible pointer-events-none z-0">
                  <path d="M 48 0 L 16 48" stroke="#b45309" strokeWidth="4" fill="none" strokeLinecap="round" />
                  <path d="M 48 0 L 80 48" stroke="#b45309" strokeWidth="4" fill="none" strokeLinecap="round" />
                </svg>
              )}
            </span>
            <span>=</span>
            <span className={result === 'correct' ? 'text-rose-500 scale-110 transition-transform duration-300 font-extrabold' : ''}>
              {result === 'correct' ? question.answer : '?'}
            </span>
          </div>

          {/* 分解された数と結合ライン (正解時) */}
          {result === 'correct' && (
            <div className="flex justify-center gap-16 mt-14 w-40 relative text-xl md:text-2xl z-10">
              {/* 移動した数 (左の枝) */}
              <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-2xl border-2 border-sky-300 font-black animate-scaleUp z-20">
                {needed}
              </span>
              {/* 残った数 (右の枝) */}
              <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-2xl border-2 border-pink-300 font-black animate-scaleUp z-20">
                {question.right - needed}
              </span>

              {/* 10づくりの結合ライン */}
              <svg className="absolute top-1/2 left-[-80px] w-64 h-20 overflow-visible pointer-events-none z-0">
                {/* 左の元の数(left)の位置と、もらった数(needed)を結ぶ青い点線 */}
                <path d="M -8 -60 Q 20 20 54 20" stroke="#0284c7" strokeWidth="4" strokeDasharray="6,6" fill="none" strokeLinecap="round" />

                {/* 10 の合体バッジ */}
                <foreignObject x="6" y="24" width="40" height="32">
                  <div className={`bg-sky-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded-lg border-2 border-sky-800 text-center ${reducedMotion ? '' : 'animate-bounce'}`}>
                    10
                  </div>
                </foreignObject>

                {/* 10バッジと残りの数(remaining)を結んで答え(answer)に向かうブラウンの点線 */}
                <path d="M 46 36 Q 100 36 182 -48" stroke="#b45309" strokeWidth="4" strokeDasharray="6,6" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>

        {/* 📦 10マス箱 2つ */}
        <div className="flex flex-col gap-6 my-2">
          {/* うえのはこ */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold text-slate-500 flex justify-between items-center px-1">
              <span>📦 うえのはこ (いま {currentLeftTotal}こ / 10こ)</span>
              {currentLeftTotal === 10 && (
                <span className={`text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full ${reducedMotion ? '' : 'animate-bounce'}`}>
                  🈵 まんぱん！できたよ！
                </span>
              )}
            </span>
            <div className="bg-[#E6F3FF] border-4 border-sky-200 rounded-2xl p-3 flex flex-col gap-2 shadow-inner">
              {/* 上段5マス */}
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const isOriginal = idx < question.left;
                  const isFilled = idx < currentLeftTotal;
                  const isHighlighted = showHint && !isFilled && idx < 10;

                  return (
                    <div
                      key={`top-box-${idx}`}
                      className={`aspect-square rounded-xl flex items-center justify-center relative border-2 transition-all ${
                        isHighlighted
                          ? 'border-yellow-400 bg-yellow-50/50 shadow-md ring-4 ring-yellow-400/50 animate-pulse'
                          : 'border-sky-100 bg-white/80'
                      }`}
                    >
                      {isFilled && (
                        <button
                          onClick={!isOriginal ? handleCherryFromTopTap : undefined}
                          disabled={isOriginal || result === 'correct'}
                          className={`text-4xl filter drop-shadow-sm select-none p-1 rounded-full w-full h-full flex items-center justify-center transition-transform ${
                            !isOriginal && result !== 'correct'
                              ? 'cursor-pointer hover:scale-110 active:scale-95 hover:bg-rose-50 ring-2 ring-sky-300 animate-scaleUp'
                              : 'cursor-default'
                          }`}
                        >
                          {question.fruit}
                        </button>
                      )}
                      {!isFilled && isHighlighted && (
                        <span className="text-yellow-500 font-black text-xs animate-bounce">？</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 下段5マス */}
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const gridIdx = idx + 5;
                  const isOriginal = gridIdx < question.left;
                  const isFilled = gridIdx < currentLeftTotal;
                  const isHighlighted = showHint && !isFilled && gridIdx < 10;

                  return (
                    <div
                      key={`top-box-${gridIdx}`}
                      className={`aspect-square rounded-xl flex items-center justify-center relative border-2 transition-all ${
                        isHighlighted
                          ? 'border-yellow-400 bg-yellow-50/50 shadow-md ring-4 ring-yellow-400/50 animate-pulse'
                          : 'border-sky-100 bg-white/80'
                      }`}
                    >
                      {isFilled && (
                        <button
                          onClick={!isOriginal ? handleCherryFromTopTap : undefined}
                          disabled={isOriginal || result === 'correct'}
                          className={`text-4xl filter drop-shadow-sm select-none p-1 rounded-full w-full h-full flex items-center justify-center transition-transform ${
                            !isOriginal && result !== 'correct'
                              ? 'cursor-pointer hover:scale-110 active:scale-95 hover:bg-rose-50 ring-2 ring-sky-300 animate-scaleUp'
                              : 'cursor-default'
                          }`}
                        >
                          {question.fruit}
                        </button>
                      )}
                      {!isFilled && isHighlighted && (
                        <span className="text-yellow-500 font-black text-xs animate-bounce">？</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ↕️ UDL用 操作アジャスター */}
          {result !== 'correct' && (
            <div className="flex justify-center items-center gap-4 py-1">
              <button
                onClick={handleMoveDown}
                disabled={movedCount <= 0 || isProcessing}
                className="hinata-btn-secondary px-4 py-2 text-xs text-rose-700 border-rose-300 disabled:opacity-40"
              >
                <Minus className="w-4 h-4" />
                <span>1こしたにもどす</span>
              </button>
              <button
                onClick={handleMoveUp}
                disabled={currentLeftTotal >= 10 || isProcessing}
                className="hinata-btn-base bg-sky-600 border-sky-700 border-b-sky-800 text-white px-4 py-2 text-xs disabled:opacity-40 hover:bg-sky-500"
              >
                <Plus className="w-4 h-4" />
                <span>1こうえにおくる</span>
              </button>
            </div>
          )}

          {/* したのはこ */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold text-slate-500 px-1">
              📦 したのはこ (のこり {currentRightTotal}こ)
            </span>
            <div className="bg-[#FFF0F0] border-4 border-rose-200 rounded-2xl p-3 flex flex-col gap-2 shadow-inner">
              {/* 上段5マス */}
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const isFilled = idx < currentRightTotal;

                  return (
                    <div
                      key={`bottom-box-${idx}`}
                      className="aspect-square rounded-xl flex items-center justify-center relative border-2 border-rose-100 bg-white/80"
                    >
                      {isFilled && (
                        <button
                          onClick={handleCherryFromBottomTap}
                          disabled={result === 'correct'}
                          className={`text-4xl filter drop-shadow-sm select-none p-1 rounded-full w-full h-full flex items-center justify-center transition-transform ${
                            result !== 'correct'
                              ? 'cursor-pointer hover:scale-110 active:scale-95 hover:bg-sky-50'
                              : 'cursor-default'
                          }`}
                        >
                          {question.fruit}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 下段5マス */}
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const gridIdx = idx + 5;
                  const isFilled = gridIdx < currentRightTotal;

                  return (
                    <div
                      key={`bottom-box-${gridIdx}`}
                      className="aspect-square rounded-xl flex items-center justify-center relative border-2 border-rose-100 bg-white/80"
                    >
                      {isFilled && (
                        <button
                          onClick={handleCherryFromBottomTap}
                          disabled={result === 'correct'}
                          className={`text-4xl filter drop-shadow-sm select-none p-1 rounded-full w-full h-full flex items-center justify-center transition-transform ${
                            result !== 'correct'
                              ? 'cursor-pointer hover:scale-110 active:scale-95 hover:bg-sky-50'
                              : 'cursor-default'
                          }`}
                        >
                          {question.fruit}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* アクションとフィードバック */}
        <div className="flex flex-col items-center gap-3">
          {result !== 'correct' ? (
            <>
              <button
                onClick={handleCheckAnswer}
                disabled={isProcessing}
                className={`px-14 py-3 min-h-[48px] ${
                  currentLeftTotal === 10
                    ? 'hinata-btn-primary scale-105 animate-pulse'
                    : 'hinata-btn-secondary opacity-50 cursor-not-allowed'
                }`}
              >
                できた！
              </button>

              {result === 'wrong' && (
                <div className="bg-rose-100 border-2 border-rose-200 text-rose-700 font-black text-xs md:text-sm px-6 py-2.5 rounded-full animate-pulse text-center leading-relaxed">
                  だいじょうぶ。さくらんぼは にげないよ。<br />
                  もういちど みてみよう。
                </div>
              )}
            </>
          ) : (
            <div className="text-center w-full animate-fadeIn flex flex-col items-center gap-4">
              <span className="text-xl md:text-2xl font-black text-emerald-600 block">
                🌟 だいせいかい！ 🌟
              </span>
              <button
                onClick={onNextStep}
                className="hinata-btn-primary bg-emerald-500 border-emerald-600 border-b-emerald-700 hover:bg-emerald-400 text-white px-14 py-3 min-h-[48px]"
              >
                つぎへすすむ ➔
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
