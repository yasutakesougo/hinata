import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Plus, Minus } from 'lucide-react';
import { StarProgress } from '../App';

interface CatSplitQuestion {
  total: number;
  leftTarget: number;
  rightTarget: number;
}

interface CatState {
  id: number;
  position: 'wait' | 'left' | 'right';
  emoji: string;
}

interface CatRoomSplitScreenProps {
  currentStep: number;
  totalSteps: number;
  starResults: boolean[];
  soundEnabled: boolean;
  onPlaySound: (type: 'correct' | 'wrong' | 'tap' | 'victory') => void;
  speakText: (text: string, enabled: boolean) => void;
  onGoBack: () => void;
  onStepComplete: (
    isCorrect: boolean,
    leftVal: number,
    rightVal: number,
    targetLeft: number,
    targetRight: number,
    total: number,
    attempts: number
  ) => void;
  onNextStep: () => void;
  maxVal?: number;
}

// Purity rule workarounds
function getRandom(): number {
  return Math.random();
}

export const CatRoomSplitScreen: React.FC<CatRoomSplitScreenProps> = ({
  currentStep,
  totalSteps,
  starResults,
  soundEnabled,
  onPlaySound,
  speakText,
  onGoBack,
  onStepComplete,
  onNextStep,
  maxVal,
}) => {
  // マウント時に一度だけ実行される初期ゲームステート
  const [gameState] = useState<{ question: CatSplitQuestion; cats: CatState[] }>(() => {
    // maxVal が 5 なら 3〜5、それ以外なら 5〜10 のランダムな合計数
    const total = maxVal === 5
      ? Math.floor(getRandom() * 3) + 3
      : Math.floor(getRandom() * 6) + 5;
    // 左側の目標数 (1 〜 total-1)
    const leftTarget = Math.floor(getRandom() * (total - 1)) + 1;
    const rightTarget = total - leftTarget;

    const initialCats: CatState[] = Array.from({ length: total }).map((_, i) => ({
      id: i,
      position: 'wait',
      emoji: '🐱'
    }));

    return {
      question: { total, leftTarget, rightTarget },
      cats: initialCats
    };
  });

  const question = gameState.question;
  const [cats, setCats] = useState<CatState[]>(gameState.cats);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [attempt, setAttempt] = useState<number>(0);
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // マウント時の音声アナウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      speakText(
        `${question.total}ひきの ネコちゃんを ２つの おへやに わけてみよう！ひだりの おへやに ${question.leftTarget}ひき いれると、みぎは なんびきかな？`,
        soundEnabled
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [question, speakText, soundEnabled]);

  const currentLeft = cats.filter(c => c.position === 'left').length;
  const currentRight = cats.filter(c => c.position === 'right').length;
  const currentWait = cats.filter(c => c.position === 'wait').length;

  // ネコちゃんをタップしたときの処理
  const handleCatTap = (cat: CatState) => {
    if (result === 'correct' || isProcessing) return;
    onPlaySound('tap');
    
    if (cat.position === 'wait') {
      // 待機エリアのネコは選択状態にする
      setSelectedCatId(selectedCatId === cat.id ? null : cat.id);
    } else {
      // 部屋にいるネコをタップした時は待機エリアに戻す
      setCats(prev =>
        prev.map(c => (c.id === cat.id ? { ...c, position: 'wait' } : c))
      );
      setSelectedCatId(null);
    }
  };

  // お部屋をタップしたときの処理
  const handleRoomTap = (room: 'left' | 'right') => {
    if (selectedCatId === null || result === 'correct' || isProcessing) return;
    onPlaySound('tap');
    
    setCats(prev =>
      prev.map(c => (c.id === selectedCatId ? { ...c, position: room } : c))
    );
    setSelectedCatId(null);
  };

  // アジャスターボタンによる調整
  const adjustCats = (room: 'left' | 'right', amount: number) => {
    if (result === 'correct' || isProcessing) return;
    onPlaySound('tap');

    if (amount > 0) {
      // 待機中から最初に見つかったネコをお部屋へ
      const catToMove = cats.find(c => c.position === 'wait');
      if (catToMove) {
        setCats(prev =>
          prev.map(c => (c.id === catToMove.id ? { ...c, position: room } : c))
        );
      }
    } else {
      // お部屋から最後に見つかったネコを待機エリアへ
      const catToMove = [...cats].reverse().find(c => c.position === room);
      if (catToMove) {
        setCats(prev =>
          prev.map(c => (c.id === catToMove.id ? { ...c, position: 'wait' } : c))
        );
      }
    }
    setSelectedCatId(null);
  };

  // 回答確認
  const handleCheckAnswer = () => {
    if (result === 'correct' || isProcessing) return;
    setIsProcessing(true);

    const isCorrect =
      currentLeft === question.leftTarget && currentRight === question.rightTarget;

    if (isCorrect) {
      onPlaySound('correct');
      setResult('correct');
      setShowSuccessAnim(true);
      
      // アニメーションと音声が被らないよう、0.4秒ずらして読み上げる
      setTimeout(() => {
        speakText(
          `せいかい！ ${question.total} は ${question.leftTarget} と ${question.rightTarget} だね！`,
          soundEnabled
        );
      }, 400);

      onStepComplete(
        true,
        currentLeft,
        currentRight,
        question.leftTarget,
        question.rightTarget,
        question.total,
        attempt
      );
    } else {
      onPlaySound('wrong');
      setResult('wrong');
      const nextAttempt = attempt + 1;
      setAttempt(nextAttempt);
      if (nextAttempt === 1) {
        speakText('ちがうよ、おへやのネコちゃんのかずを よくかぞえてみよう！', soundEnabled);
      } else {
        speakText(`ひだりの おへやに ${question.leftTarget}ひき いれると、みぎは ${question.rightTarget}ひき だよ。`, soundEnabled);
      }
      // 間違えた場合は1秒後に再度回答可能にする
      setTimeout(() => {
        setIsProcessing(false);
      }, 1000);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-5 animate-fadeIn">
      {/* 上部ナビゲーションと進捗 */}
      <div className="w-full max-w-2xl flex items-center justify-between gap-4">
        <button
          onClick={onGoBack}
          className="bg-white hover:bg-slate-50 border-4 border-slate-200 p-2.5 rounded-2xl shadow-sm cursor-pointer active:translate-y-[1px] flex items-center justify-center transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <StarProgress
          currentStep={currentStep}
          totalSteps={totalSteps}
          title="ねこの おへやわけ"
          starResults={starResults}
        />
        <div className="w-12 h-12" /> {/* 左右バランス用ダミー */}
      </div>

      {/* メインゲームボード */}
      <div className="w-full max-w-2xl bg-white border-8 border-emerald-300 rounded-3xl p-5 shadow-2xl flex flex-col gap-5 relative overflow-hidden">
        
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
        <div className="bg-emerald-50/50 border-4 border-emerald-100 rounded-2xl p-4 text-center">
          <span className="bg-emerald-400 text-emerald-950 font-black text-xs px-2.5 py-0.5 rounded-full inline-block mb-1">
            もんだい
          </span>
          <h2 className="text-lg md:text-xl font-black text-emerald-800 leading-relaxed mt-1">
            {question.total}ひきの ネコちゃんを ２つの おへやに わけてみよう！
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            ひだりの おへやに <span className="text-emerald-600 text-sm font-black">{question.leftTarget}ひき</span> いれると、みぎは なんびきかな？
          </p>
        </div>

        {/* ネコちゃん待機エリア */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-extrabold text-slate-500">🐾 お部屋に入るのを待っているネコ ({currentWait}匹)</span>
            {selectedCatId !== null && (
              <span className="text-[10px] bg-yellow-100 border border-yellow-300 text-yellow-800 font-extrabold px-2 py-0.5 rounded-md animate-pulse">
                いれる お部屋を タップしてね！
              </span>
            )}
          </div>
          <div className="w-full bg-slate-50 border-4 border-slate-200 border-dashed rounded-2xl p-4 min-h-[84px] flex flex-wrap gap-2.5 items-center justify-center relative shadow-inner">
            {cats.filter(c => c.position === 'wait').length === 0 ? (
              <span className="text-xs font-bold text-slate-400">全員お部屋に入ったよ！🐾</span>
            ) : (
              cats
                .filter(c => c.position === 'wait')
                .map(cat => {
                  const isSelected = selectedCatId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCatTap(cat)}
                      className={`text-4xl filter drop-shadow-sm select-none cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95 p-1 rounded-full ${
                        isSelected
                          ? 'ring-4 ring-yellow-400 bg-yellow-50 animate-pulse scale-110'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      {cat.emoji}
                    </button>
                  );
                })
            )}
          </div>
        </div>

        {/* お部屋エリア */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* 左のお部屋 */}
          <div
            onClick={() => handleRoomTap('left')}
            className={`bg-sky-50/40 hover:bg-sky-50/60 border-4 border-sky-200 rounded-3xl p-4 min-h-[180px] flex flex-col justify-between items-center transition-all relative cursor-pointer ${
              selectedCatId !== null ? 'ring-2 ring-dashed ring-sky-400' : ''
            }`}
          >
            <div className="w-full flex justify-between items-center border-b border-sky-100 pb-2">
              <span className="text-xs font-black text-sky-800 flex items-center gap-1">
                🔵 ひだりのおへや
              </span>
              <span className="bg-sky-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
                {currentLeft}ひき
              </span>
            </div>

            {/* お部屋の中のネコちゃん表示 */}
            <div className="flex flex-wrap gap-2 justify-center items-center my-4 min-h-[60px] w-full">
              {cats
                .filter(c => c.position === 'left')
                .map(cat => (
                  <button
                    key={cat.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCatTap(cat);
                    }}
                    className="text-4xl filter drop-shadow-xs select-none cursor-pointer transition-transform hover:scale-110 active:scale-95"
                    title="待機に戻す"
                  >
                    {cat.emoji}
                  </button>
                ))}
            </div>

            {/* アジャスターボタン */}
            <div className="flex gap-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => adjustCats('left', -1)}
                disabled={currentLeft === 0}
                className="bg-white border-2 border-sky-300 hover:bg-sky-50 disabled:opacity-40 disabled:cursor-not-allowed text-sky-700 font-extrabold rounded-full w-12 h-12 flex items-center justify-center shadow-xs active:translate-y-[1px]"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={() => adjustCats('left', 1)}
                disabled={currentWait === 0}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-full w-12 h-12 flex items-center justify-center shadow-xs border-b-4 border-sky-800 active:translate-y-[1px]"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 右のお部屋 */}
          <div
            onClick={() => handleRoomTap('right')}
            className={`bg-pink-50/40 hover:bg-pink-50/60 border-4 border-pink-200 rounded-3xl p-4 min-h-[180px] flex flex-col justify-between items-center transition-all relative cursor-pointer ${
              selectedCatId !== null ? 'ring-2 ring-dashed ring-pink-400' : ''
            }`}
          >
            <div className="w-full flex justify-between items-center border-b border-pink-100 pb-2">
              <span className="text-xs font-black text-pink-800 flex items-center gap-1">
                🔴 みぎのおへや
              </span>
              <span className="bg-pink-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
                {currentRight}ひき
              </span>
            </div>

            {/* お部屋の中のネコちゃん表示 */}
            <div className="flex flex-wrap gap-2 justify-center items-center my-4 min-h-[60px] w-full">
              {cats
                .filter(c => c.position === 'right')
                .map(cat => (
                  <button
                    key={cat.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCatTap(cat);
                    }}
                    className="text-4xl filter drop-shadow-xs select-none cursor-pointer transition-transform hover:scale-110 active:scale-95"
                    title="待機に戻す"
                  >
                    {cat.emoji}
                  </button>
                ))}
            </div>

            {/* アジャスターボタン */}
            <div className="flex gap-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => adjustCats('right', -1)}
                disabled={currentRight === 0}
                className="bg-white border-2 border-pink-300 hover:bg-pink-50 disabled:opacity-40 disabled:cursor-not-allowed text-pink-700 font-extrabold rounded-full w-12 h-12 flex items-center justify-center shadow-xs active:translate-y-[1px]"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={() => adjustCats('right', 1)}
                disabled={currentWait === 0}
                className="bg-pink-600 hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-full w-12 h-12 flex items-center justify-center shadow-xs border-b-4 border-pink-800 active:translate-y-[1px]"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

        </div>

        {/* 分解表示数式 */}
        <div className="w-full bg-amber-50 border-4 border-amber-200 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
          <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">今のわかれかた</span>
          <div className="flex items-baseline gap-2 font-black text-amber-900 select-none">
            <span className="text-3xl md:text-4xl">{question.total}</span>
            <span className="text-lg md:text-xl">は</span>
            <span className={`text-3xl md:text-4xl px-2 py-0.5 rounded-xl transition-all ${
              currentLeft === question.leftTarget 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-amber-100/50'
            }`}>{currentLeft}</span>
            <span className="text-lg md:text-xl">と</span>
            <span className={`text-3xl md:text-4xl px-2 py-0.5 rounded-xl transition-all ${
              currentRight === question.rightTarget 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-amber-100/50'
            }`}>{currentRight}</span>
          </div>

          {/* 目標の式との比較表示 */}
          <div className="text-[10px] text-slate-400 font-extrabold mt-1.5">
            めざすお部屋の数 ➔ ひだり: {question.leftTarget}匹 / みぎ: {question.rightTarget}匹
          </div>
        </div>

        {/* アクションボタンとフィードバック */}
        <div className="flex flex-col items-center gap-3">
          {result !== 'correct' ? (
            <button
              onClick={handleCheckAnswer}
              disabled={currentWait !== 0 || isProcessing}
              className={`font-black text-md px-14 py-3 rounded-2xl transition-all shadow-md active:translate-y-[2px] active:border-b-2 border-b-4 ${
                currentWait === 0 && !isProcessing
                  ? 'bg-amber-400 hover:bg-amber-500 border-amber-600 text-amber-950 scale-105 animate-pulse'
                  : 'bg-slate-200 border-slate-400 text-slate-400 cursor-not-allowed'
              }`}
            >
              {currentWait > 0 ? `のこり ${currentWait}匹 をお部屋にいれてね` : isProcessing ? 'かくにんちゅう...' : 'できた！'}
            </button>
          ) : (
            <div className="text-center animate-bounce flex flex-col items-center">
              <span className="text-xl md:text-2xl font-black text-emerald-600 block mb-2">🌟 せいかい！ 🌟</span>
              <button
                onClick={() => {
                  if (isProcessing) return;
                  setIsProcessing(true);
                  onNextStep();
                }}
                disabled={isProcessing}
                className="bg-emerald-500 hover:bg-emerald-600 border-b-4 border-emerald-700 text-white font-black text-md px-14 py-2.5 rounded-xl shadow-md disabled:opacity-50"
              >
                つぎへすすむ ➔
              </button>
            </div>
          )}

          {result === 'wrong' && (
            <div className="bg-rose-100 border-2 border-rose-200 text-rose-600 font-black text-xs md:text-sm px-6 py-2 rounded-full animate-pulse text-center">
              {attempt === 1 
                ? "🐱 もういちど、よくかぞえて みよう！" 
                : `💡 ヒント：ひだりに ${question.leftTarget}ひき いれると、みぎは ${question.rightTarget}ひき になるよ！`}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
