import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Plus, Minus } from 'lucide-react';
import { StarProgress } from '../App';

interface Snack {
  id: number;
  status: 'box' | 'left' | 'right';
  emoji: string;
}

interface SnackSplitScreenProps {
  currentStep: number;
  totalSteps: number;
  starResults: boolean[];
  soundEnabled: boolean;
  onPlaySound: (type: 'correct' | 'wrong' | 'tap' | 'victory' | 'pop') => void;
  speakText: (text: string, enabled: boolean) => void;
  onGoBack: () => void;
  onStepComplete: (leftVal: number, rightVal: number, total: number) => void;
  onNextStep: () => void;
  maxVal?: number;
}

// 乱数用ヘルパー
function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const SnackSplitScreen: React.FC<SnackSplitScreenProps> = ({
  currentStep,
  totalSteps,
  starResults,
  soundEnabled,
  onPlaySound,
  speakText,
  onGoBack,
  onStepComplete,
  onNextStep,
}) => {
  // 今日の対象の数を決定 (7, 8, 9, 10 からランダム)
  const [totalSnacks] = useState<number>(() => getRandomNumber(7, 10));

  // おやつの状態管理 (いちご 🍓 で固定)
  const [snacks, setSnacks] = useState<Snack[]>(() =>
    Array.from({ length: totalSnacks }).map((_, i) => ({
      id: i,
      status: 'box',
      emoji: '🍓'
    }))
  );

  const [selectedSnackId, setSelectedSnackId] = useState<number | null>(null);
  const [result, setResult] = useState<'correct' | null>(null);
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showSummary, setShowSummary] = useState<boolean>(false);

  // ミミちゃん 🐰 と ココちゃん 🐿 の取り分を算出
  const leftCount = snacks.filter((s) => s.status === 'left').length;
  const rightCount = snacks.filter((s) => s.status === 'right').length;
  const boxCount = snacks.filter((s) => s.status === 'box').length;

  // 開始時の音声アナウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      speakText(
        `きょうは ${totalSnacks}この おやつだよ。ミミちゃんと ココちゃんに わけてあげよう。`,
        soundEnabled
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [totalSnacks, speakText, soundEnabled]);

  // おやつをタップしたときの選択処理
  const handleSnackTap = (snack: Snack) => {
    if (result === 'correct' || isProcessing) return;
    onPlaySound('tap');

    if (snack.status === 'box') {
      // おやつ箱にあるおやつは選択状態にする
      setSelectedSnackId(selectedSnackId === snack.id ? null : snack.id);
    } else {
      // すでに分配されているおやつをタップした場合はおやつ箱に戻す
      setSnacks((prev) =>
        prev.map((s) => (s.id === snack.id ? { ...s, status: 'box' } : s))
      );
      setSelectedSnackId(null);
    }
  };

  // 動物の皿エリアをタップしたときにおやつを移動
  const handleTargetAreaTap = (target: 'left' | 'right') => {
    if (selectedSnackId === null || result === 'correct' || isProcessing) return;
    onPlaySound('pop');

    setSnacks((prev) =>
      prev.map((s) => (s.id === selectedSnackId ? { ...s, status: target } : s))
    );
    setSelectedSnackId(null);
  };

  // ＋ / ー ボタンによる調整 (UDL対応)
  const adjustSnacks = (target: 'left' | 'right', amount: number) => {
    if (result === 'correct' || isProcessing) return;
    onPlaySound('tap');

    if (amount > 0) {
      // おやつ箱から一番若いIDのおやつをターゲットへ移動
      const snackToMove = snacks.find((s) => s.status === 'box');
      if (snackToMove) {
        setSnacks((prev) =>
          prev.map((s) => (s.id === snackToMove.id ? { ...s, status: target } : s))
        );
      }
    } else {
      // ターゲットから一番大きいIDのおやつをおやつ箱に戻す
      const snackToMove = [...snacks].reverse().find((s) => s.status === target);
      if (snackToMove) {
        setSnacks((prev) =>
          prev.map((s) => (s.id === snackToMove.id ? { ...s, status: 'box' } : s))
        );
      }
    }
    setSelectedSnackId(null);
  };

  // 「できた！」ボタンを押したときの処理
  const handleCheckAnswer = () => {
    if (result === 'correct' || isProcessing || boxCount > 0) return;
    setIsProcessing(true);
    onPlaySound('correct');
    setResult('correct');
    setShowSuccessAnim(true);

    // 回答データを記録
    onStepComplete(leftCount, rightCount, totalSnacks);

    // 音声アナウンス
    setTimeout(() => {
      speakText(
        `いいね！ ミミちゃんに ${leftCount}こ、ココちゃんに ${rightCount}こ。あわせて ${totalSnacks}こだね！`,
        soundEnabled
      );

      // 他の分け方の一覧（まとめ）を1秒後に表示
      setTimeout(() => {
        setShowSummary(true);
        speakText(
          `${totalSnacks}は いろんなわけかたがあるね。`,
          soundEnabled
        );
        setIsProcessing(false);
      }, 2500);
    }, 400);
  };

  // すべての可能な分け方のリストを生成 (0とN、Nと0も含む)
  const getCombinations = () => {
    const combs = [];
    for (let i = 0; i <= totalSnacks; i++) {
      combs.push({ left: i, right: totalSnacks - i });
    }
    return combs;
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
          title="どうぶつ おやつわけ"
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

        {/* 問題指示テキスト */}
        <div className="bg-hinata-active-bg border-4 border-hinata-border rounded-2xl p-4 text-center">
          <span className="bg-hinata-accent text-white font-black text-xs px-2.5 py-0.5 rounded-full inline-block mb-1">
            もんだい
          </span>
          <h2 className="text-xl md:text-2xl font-black text-hinata-text leading-relaxed mt-1">
            きょうは <span className="text-hinata-accent text-3xl font-black">{totalSnacks}</span> この おやつだよ。
          </h2>
          <p className="text-sm font-bold text-slate-500 mt-1">
            ミミちゃんと ココちゃんに わけて あげよう！
          </p>
        </div>

        {/* 10マスのおやつ箱 (5のまとまり表示) */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-extrabold text-slate-500">
              📦 おやつばこ (あと {boxCount}こ)
            </span>
            {selectedSnackId !== null && (
              <span className="text-[10px] bg-yellow-100 border border-yellow-300 text-yellow-800 font-extrabold px-2 py-0.5 rounded-md animate-pulse">
                どうぶつを タップして わけてね！
              </span>
            )}
          </div>

          {/* 10マスのグリッド */}
          <div className="bg-hinata-active-bg/40 border-4 border-hinata-border rounded-2xl p-4 flex flex-col gap-2 shadow-inner">
            {/* 上段5マス */}
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 5 }).map((_, idx) => {
                const isUsable = idx < totalSnacks;
                const snack = isUsable ? snacks[idx] : null;
                const isSelected = snack ? selectedSnackId === snack.id : false;
                const isInBox = snack ? snack.status === 'box' : false;

                return (
                  <div
                    key={`top-${idx}`}
                    className={`aspect-square rounded-xl flex items-center justify-center relative border-2 ${
                      isUsable
                        ? 'border-hinata-border bg-white/80 shadow-xs'
                        : 'border-slate-200 bg-slate-100/50 border-dashed'
                    }`}
                  >
                    {isUsable && isInBox && snack && (
                      <button
                        onClick={() => handleSnackTap(snack)}
                        className={`text-4xl filter drop-shadow-sm select-none cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95 p-1 rounded-full w-full h-full flex items-center justify-center ${
                          isSelected
                            ? 'ring-4 ring-yellow-400 bg-yellow-50 animate-pulse scale-105'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {snack.emoji}
                      </button>
                    )}
                    {isUsable && !isInBox && (
                      <div className="w-8 h-8 rounded-full bg-amber-100/30 border border-dashed border-amber-200 flex items-center justify-center text-[10px] text-amber-300/60 font-bold select-none">
                        空
                      </div>
                    )}
                    {!isUsable && (
                      <span className="text-slate-300/40 text-xs font-black select-none">✕</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 下段5マス */}
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 5 }).map((_, idx) => {
                const gridIdx = idx + 5;
                const isUsable = gridIdx < totalSnacks;
                const snack = isUsable ? snacks[gridIdx] : null;
                const isSelected = snack ? selectedSnackId === snack.id : false;
                const isInBox = snack ? snack.status === 'box' : false;

                return (
                  <div
                    key={`bottom-${idx}`}
                    className={`aspect-square rounded-xl flex items-center justify-center relative border-2 ${
                      isUsable
                        ? 'border-hinata-border bg-white/80 shadow-xs'
                        : 'border-slate-200 bg-slate-100/50 border-dashed'
                    }`}
                  >
                    {isUsable && isInBox && snack && (
                      <button
                        onClick={() => handleSnackTap(snack)}
                        className={`text-4xl filter drop-shadow-sm select-none cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95 p-1 rounded-full w-full h-full flex items-center justify-center ${
                          isSelected
                            ? 'ring-4 ring-yellow-400 bg-yellow-50 animate-pulse scale-105'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {snack.emoji}
                      </button>
                    )}
                    {isUsable && !isInBox && (
                      <div className="w-8 h-8 rounded-full bg-amber-100/30 border border-dashed border-amber-200 flex items-center justify-center text-[10px] text-amber-300/60 font-bold select-none">
                        空
                      </div>
                    )}
                    {!isUsable && (
                      <span className="text-slate-300/40 text-xs font-black select-none">✕</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* どうぶつ分配エリア */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 左のどうぶつ: ミミちゃん 🐰 */}
          <div
            onClick={() => handleTargetAreaTap('left')}
            className={`bg-sky-50/40 hover:bg-sky-50/60 border-4 border-sky-200 rounded-3xl p-4 min-h-[200px] flex flex-col justify-between items-center transition-all relative cursor-pointer ${
              selectedSnackId !== null ? 'ring-4 ring-dashed ring-sky-400 animate-pulse' : ''
            }`}
          >
            <div className="w-full flex justify-between items-center border-b border-sky-100 pb-2">
              <span className="text-xs font-black text-sky-800 flex items-center gap-1.5">
                <span className="text-2xl">🐰</span> ミミちゃん
              </span>
              <span className="bg-sky-600 text-white font-extrabold text-sm px-3 py-0.5 rounded-full shadow-sm">
                {leftCount} こ
              </span>
            </div>

            {/* お皿の中のおやつ */}
            <div className="flex flex-wrap gap-2 justify-center items-center my-4 min-h-[60px] w-full bg-white/50 border border-sky-100 rounded-2xl p-2.5 shadow-inner">
              {leftCount === 0 ? (
                <span className="text-xs font-bold text-slate-400 select-none">おさら（空っぽ）</span>
              ) : (
                snacks
                  .filter((s) => s.status === 'left')
                  .map((snack) => (
                    <button
                      key={snack.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSnackTap(snack);
                      }}
                      className="text-3xl filter drop-shadow-xs select-none cursor-pointer transition-transform hover:scale-110 active:scale-95"
                      title="おやつ箱に戻す"
                    >
                      {snack.emoji}
                    </button>
                  ))
              )}
            </div>

            {/* アジャスターボタン */}
            <div className="flex gap-4" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => adjustSnacks('left', -1)}
                disabled={leftCount === 0 || result === 'correct'}
                className="hinata-btn-secondary w-12 h-12 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={() => adjustSnacks('left', 1)}
                disabled={boxCount === 0 || result === 'correct'}
                className="hinata-btn-base bg-sky-600 border-sky-700 border-b-sky-800 text-white w-12 h-12 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-500"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 右のどうぶつ: ココちゃん 🐿 */}
          <div
            onClick={() => handleTargetAreaTap('right')}
            className={`bg-pink-50/40 hover:bg-pink-50/60 border-4 border-pink-200 rounded-3xl p-4 min-h-[200px] flex flex-col justify-between items-center transition-all relative cursor-pointer ${
              selectedSnackId !== null ? 'ring-4 ring-dashed ring-pink-400 animate-pulse' : ''
            }`}
          >
            <div className="w-full flex justify-between items-center border-b border-pink-100 pb-2">
              <span className="text-xs font-black text-pink-800 flex items-center gap-1.5">
                <span className="text-2xl">🐿</span> ココちゃん
              </span>
              <span className="bg-pink-600 text-white font-extrabold text-sm px-3 py-0.5 rounded-full shadow-sm">
                {rightCount} こ
              </span>
            </div>

            {/* お皿の中のおやつ */}
            <div className="flex flex-wrap gap-2 justify-center items-center my-4 min-h-[60px] w-full bg-white/50 border border-pink-100 rounded-2xl p-2.5 shadow-inner">
              {rightCount === 0 ? (
                <span className="text-xs font-bold text-slate-400 select-none">おさら（空っぽ）</span>
              ) : (
                snacks
                  .filter((s) => s.status === 'right')
                  .map((snack) => (
                    <button
                      key={snack.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSnackTap(snack);
                      }}
                      className="text-3xl filter drop-shadow-xs select-none cursor-pointer transition-transform hover:scale-110 active:scale-95"
                      title="おやつ箱に戻す"
                    >
                      {snack.emoji}
                    </button>
                  ))
              )}
            </div>

            {/* アジャスターボタン */}
            <div className="flex gap-4" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => adjustSnacks('right', -1)}
                disabled={rightCount === 0 || result === 'correct'}
                className="hinata-btn-secondary w-12 h-12 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={() => adjustSnacks('right', 1)}
                disabled={boxCount === 0 || result === 'correct'}
                className="hinata-btn-base bg-pink-600 border-pink-700 border-b-pink-800 text-white w-12 h-12 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-pink-500"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 分解表示数式 */}
        {boxCount === 0 && (
          <div className="w-full bg-hinata-active-bg border-4 border-hinata-border rounded-2xl p-4 flex flex-col items-center justify-center shadow-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">今のわかれかた</span>
            <div className="flex items-baseline gap-2 font-black text-hinata-text select-none">
              <span className="text-3xl md:text-4xl">{totalSnacks}</span>
              <span className="text-lg md:text-xl">は</span>
              <span className="text-3xl md:text-4xl px-2 py-0.5 rounded-xl bg-sky-100 text-sky-700 border border-sky-200">
                {leftCount}
              </span>
              <span className="text-lg md:text-xl">と</span>
              <span className="text-3xl md:text-4xl px-2 py-0.5 rounded-xl bg-pink-100 text-pink-700 border border-pink-200">
                {rightCount}
              </span>
            </div>
          </div>
        )}

        {/* アクションボタンとフィードバック */}
        <div className="flex flex-col items-center gap-3">
          {result !== 'correct' ? (
            <button
              onClick={handleCheckAnswer}
              disabled={boxCount > 0 || isProcessing}
              className={`px-14 py-3 min-h-[48px] ${
                boxCount === 0 && !isProcessing
                  ? 'hinata-btn-primary scale-105 animate-pulse'
                  : 'hinata-btn-secondary opacity-50 cursor-not-allowed'
              }`}
            >
              {boxCount > 0 ? `のこり ${boxCount}こ をわけてね` : 'できた！'}
            </button>
          ) : (
            showSummary && (
              <div className="text-center w-full animate-fadeIn flex flex-col items-center gap-4">
                <span className="text-xl md:text-2xl font-black text-emerald-600 block">
                  🌟 いいわけかただね！ 🌟
                </span>

                {/* 他の分け方の一覧 (探索的ヒント) */}
                <div className="w-full bg-emerald-50/50 border-4 border-emerald-100 rounded-2xl p-4 flex flex-col gap-2.5">
                  <span className="text-xs font-black text-emerald-700 block text-left">
                    💡 {totalSnacks} は いろんな わけかたが あるよ！
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {getCombinations().map((comb, i) => {
                      const isCurrentChoice =
                        comb.left === leftCount && comb.right === rightCount;
                      return (
                        <div
                          key={i}
                          className={`border-2 rounded-xl py-1.5 px-2.5 font-bold text-sm flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                            isCurrentChoice
                              ? 'bg-yellow-100 border-yellow-400 text-yellow-800 ring-2 ring-yellow-400 ring-offset-1 scale-105'
                              : 'bg-white border-slate-100 text-slate-600'
                          }`}
                        >
                          <span className="text-base font-extrabold">{totalSnacks}</span>
                          <span className="text-[10px] text-slate-400 font-extrabold">は</span>
                          <span className={`${isCurrentChoice ? 'text-sky-700' : 'text-slate-700'}`}>
                            {comb.left}
                          </span>
                          <span className="text-[10px] text-slate-400 font-extrabold">と</span>
                          <span className={`${isCurrentChoice ? 'text-pink-700' : 'text-slate-700'}`}>
                            {comb.right}
                          </span>
                        </div>
                      );
                    })}
                  </div>
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
            )
          )}
        </div>
      </div>
    </div>
  );
};
