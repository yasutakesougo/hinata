import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Trash2, CheckCircle, Star } from 'lucide-react';
import { StarProgress } from '../App';
import { TRACING_GUIDES } from '../constants/tracingGuides';

interface HiraganaTracingScreenProps {
  soundEnabled: boolean;
  onPlaySound: (type: 'correct' | 'wrong' | 'tap' | 'victory') => void;
  speakText: (text: string, enabled: boolean) => void;
  onGoBack: () => void;
  logActivity: (message: string) => void;
  completedLetters: string[];
  onCompleteLetter: (letter: string) => void;
}

const BRUSH_COLORS = [
  { id: 'blue', name: 'あお 🔵', value: '#3b82f6', border: 'border-blue-300', bg: 'bg-blue-500' },
  { id: 'pink', name: 'あか 🔴', value: '#ec4899', border: 'border-pink-300', bg: 'bg-pink-500' },
  { id: 'green', name: 'みどり 🟢', value: '#10b981', border: 'border-emerald-300', bg: 'bg-emerald-500' },
];

const SELECTION_LETTERS = [
  { letter: 'し', desc: '1画の もじ (しお・しか)' },
  { letter: 'く', desc: '1画の もじ (くま・くるま)' },
  { letter: 'つ', desc: '1画の もじ (つくえ・つみき)' },
  { letter: 'へ', desc: '1画の もじ (へび・へや)' },
  { letter: 'い', desc: '2画の もじ (いぬ・いちご)' },
  { letter: 'こ', desc: '2画の もじ (こま・こいぬ)' },
  { letter: 'り', desc: '2画の もじ (りんご・りす)' },
  { letter: 'て', desc: '1画の もじ (てがみ・てんとうむし)' },
];

export const HiraganaTracingScreen: React.FC<HiraganaTracingScreenProps> = ({
  soundEnabled,
  onPlaySound,
  speakText,
  onGoBack,
  logActivity,
  completedLetters,
  onCompleteLetter,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ステート
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#3b82f6');
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isDemoPlaying, setIsDemoPlaying] = useState<boolean>(false);
  const [demoCursor, setDemoCursor] = useState<{ x: number; y: number } | null>(null);

  // 音声アナウンス
  useEffect(() => {
    if (selectedLetter === null) {
      speakText('どの ひらがなを れんしゅうする？えらんで タップしてね！', soundEnabled);
    } else {
      speakText(`ひらがなの 「${selectedLetter}」 を なぞってみよう！ゆびや マウスで なぞってね。`, soundEnabled);
    }
  }, [selectedLetter, speakText, soundEnabled]);

  // クリーニング (アンマウント時にアニメーションを解除)
  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
    };
  }, []);

  // キャンバスの初期設定 (文字選択されたとき)
  useEffect(() => {
    if (!selectedLetter) return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      
      const context = canvas.getContext('2d');
      if (!context) return;

      context.scale(2, 2);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = 12; // 太めの線
      context.strokeStyle = brushColor;
      contextRef.current = context;

      // 状態リセット
      setHasDrawn(false);
      setIsCompleted(false);
      setShowSuccessAnim(false);
      setDemoCursor(null);
      setIsDemoPlaying(false);
    }, 50);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLetter]);

  // 描画色の設定変更
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = brushColor;
    }
  }, [brushColor]);

  // 座標算出ヘルパー
  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  // 描画開始
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isDemoPlaying || isCompleted) return;
    const coords = getCoords(e);
    if (!coords || !contextRef.current) return;

    contextRef.current.beginPath();
    contextRef.current.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  // 描画中
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current || isDemoPlaying || isCompleted) return;
    
    const coords = getCoords(e);
    if (!coords) return;

    contextRef.current.lineTo(coords.x, coords.y);
    contextRef.current.stroke();
  };

  // 描画終了
  const stopDrawing = () => {
    if (!isDrawing) return;
    contextRef.current?.closePath();
    setIsDrawing(false);
  };

  // もういちど（キャンバスクリア）
  const handleClear = () => {
    onPlaySound('tap');
    const canvas = canvasRef.current;
    if (!canvas || !contextRef.current) return;

    contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // お手本補間ヘルパー
  const interpolatePoints = (keypoints: { x: number; y: number }[]) => {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < keypoints.length - 1; i++) {
      const p1 = keypoints[i];
      const p2 = keypoints[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      // 距離に応じて移動ステップ数を決定 (スムーズに動かすため)
      const steps = Math.max(8, Math.floor(Math.sqrt(dx * dx + dy * dy) / 3));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        points.push({
          x: p1.x + dx * t,
          y: p1.y + dy * t,
        });
      }
    }
    return points;
  };

  // お手本アニメーション再生 (みほんをみる)
  const handlePlayDemo = () => {
    if (!selectedLetter || isDemoPlaying || isCompleted) return;
    
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    onPlaySound('tap');
    setIsDemoPlaying(true);
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);

    // デモ描画のスタイル保存と書き換え (オレンジ半透明ペン)
    const originalStroke = context.strokeStyle;
    const originalWidth = context.lineWidth;
    context.strokeStyle = 'rgba(245, 158, 11, 0.7)'; // オレンジ
    context.lineWidth = 14;

    const data = TRACING_GUIDES[selectedLetter];
    let currentStrokeIdx = 0;
    let strokePoints = interpolatePoints(data.keypoints[0]);
    let currentPtIdx = 0;

    // タイマーによるアニメーションループ
    demoIntervalRef.current = setInterval(() => {
      if (currentPtIdx >= strokePoints.length) {
        currentStrokeIdx++;
        if (currentStrokeIdx >= data.keypoints.length) {
          // すべての画が完了
          if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
          setDemoCursor(null);
          
          // スタイルを復元
          context.strokeStyle = originalStroke;
          context.lineWidth = originalWidth;

          // 1.2秒待ってから、なぞり直せるようにクリアして解放
          setTimeout(() => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            setIsDemoPlaying(false);
          }, 1200);
          return;
        } else {
          // 次の画へ
          strokePoints = interpolatePoints(data.keypoints[currentStrokeIdx]);
          currentPtIdx = 0;
        }
      }

      const pt = strokePoints[currentPtIdx];
      setDemoCursor(pt);

      if (currentPtIdx === 0) {
        context.beginPath();
        context.moveTo(pt.x, pt.y);
      } else {
        context.lineTo(pt.x, pt.y);
        context.stroke();
      }

      currentPtIdx++;
    }, 25);
  };

  // できた！ボタン
  const handleDone = () => {
    if (!hasDrawn || isCompleted || !selectedLetter) return;

    onPlaySound('victory');
    setShowSuccessAnim(true);
    setIsCompleted(true);
    
    // クリアした文字を記録
    onCompleteLetter(selectedLetter);
    
    logActivity(`ひらがな「${selectedLetter}」のなぞり書きをクリア！`);

    setTimeout(() => {
      speakText(`せいかい！「${selectedLetter}」が じょうずに かけたね！すごい！`, soundEnabled);
    }, 400);
  };

  // 文字選択に戻る
  const handleBackToSelection = () => {
    onPlaySound('tap');
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
    }
    setSelectedLetter(null);
    setDemoCursor(null);
    setIsDemoPlaying(false);
  };

  // ==========================================
  // 1. 文字選択画面
  // ==========================================
  if (selectedLetter === null) {
    return (
      <div className="w-full flex flex-col items-center gap-5 animate-fadeIn">
        <div className="w-full max-w-2xl flex items-center justify-between gap-4">
          <button
            onClick={onGoBack}
            className="bg-white hover:bg-slate-50 border-4 border-slate-200 w-12 h-12 rounded-2xl shadow-sm cursor-pointer active:translate-y-[1px] flex items-center justify-center transition-all"
            title="ひろばにもどる"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="bg-white border-4 border-sky-100 rounded-2xl px-6 py-2 shadow-sm">
            <span className="font-extrabold text-sky-700 text-xs md:text-sm">もじえらび</span>
          </div>
          <div className="w-12 h-12" />
        </div>

        <div className="w-full max-w-2xl bg-white border-8 border-sky-300 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
          <div className="bg-sky-50/50 border-4 border-sky-100 rounded-2xl p-4 text-center">
            <span className="bg-sky-400 text-sky-950 font-black text-xs px-2.5 py-0.5 rounded-full inline-block mb-1">
              こくご
            </span>
            <h2 className="text-xl font-black text-sky-800 leading-relaxed">
              れんしゅうする ひらがなを えらぼう！
            </h2>
          </div>

          {/* 文字カード一覧 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            {SELECTION_LETTERS.map(item => {
              const isCleared = completedLetters.includes(item.letter);
              return (
                <button
                  key={item.letter}
                  onClick={() => {
                    onPlaySound('tap');
                    setSelectedLetter(item.letter);
                  }}
                  className="bg-white hover:border-sky-400 hover:bg-sky-50/40 border-4 border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 aspect-square cursor-pointer active:scale-95 transition-all shadow-md group relative overflow-hidden"
                >
                  {isCleared && (
                    <span className="absolute top-1.5 right-1.5 bg-yellow-400 text-white rounded-full p-0.5 shadow-sm text-xs font-bold leading-none select-none">
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </span>
                  )}
                  <span className="text-5xl font-black text-sky-900 group-hover:scale-110 transition-transform">
                    {item.letter}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 mt-1 truncate max-w-full">
                    {item.desc.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-left">
            <span className="text-2xl animate-bounce">💡</span>
            <p className="text-xs font-bold text-amber-900 leading-relaxed">
              ガイドの「①」「②」があるところから、やじるしの方向にむけてなぞり書きをしよう！「みほんをみる」を押すと、かきかたがわかるよ！
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. なぞり書き練習画面
  // ==========================================
  return (
    <div className="w-full flex flex-col items-center gap-5 animate-fadeIn">
      {/* 上部ナビゲーション */}
      <div className="w-full max-w-2xl flex items-center justify-between gap-4">
        <button
          onClick={handleBackToSelection}
          className="bg-white hover:bg-slate-50 border-4 border-slate-200 w-12 h-12 rounded-2xl shadow-sm cursor-pointer active:translate-y-[1px] flex items-center justify-center transition-all"
          title="もじ選択にもどる"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <StarProgress
          currentStep={completedLetters.includes(selectedLetter) ? 1 : 0}
          totalSteps={1}
          title={`「${selectedLetter}」の なぞりかき`}
          starResults={[isCompleted]}
        />
        <div className="w-12 h-12" />
      </div>

      {/* スケッチブック風ボード */}
      <div className="w-full max-w-2xl bg-white border-8 border-sky-300 rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col gap-5 relative overflow-hidden">
        
        {/* 正解時キラキラエフェクト */}
        {showSuccessAnim && (
          <div className="absolute inset-0 bg-sky-500/10 pointer-events-none flex items-center justify-center z-20 animate-fadeIn animate-pulse">
            <div className="flex gap-4">
              <Sparkles className="w-16 h-16 text-yellow-400 animate-spin" />
              <Sparkles className="w-16 h-16 text-yellow-400 animate-bounce" />
            </div>
          </div>
        )}

        {/* スケッチブックのリング装飾 */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-4 z-10 pointer-events-none select-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-3.5 h-6 bg-slate-300 border-2 border-slate-400 rounded-full shadow-inner" />
          ))}
        </div>

        {/* タイトルと説明 */}
        <div className="bg-sky-50/50 border-4 border-sky-100 rounded-2xl p-4 text-center mt-3">
          <span className="bg-sky-400 text-sky-950 font-black text-xs px-2.5 py-0.5 rounded-full inline-block mb-1">
            もじをなぞろう
          </span>
          <h2 className="text-lg md:text-xl font-black text-sky-800 leading-relaxed mt-1">
            「{selectedLetter}」 を きれいに なぞってみよう！
          </h2>
        </div>

        {/* メインの描画ボード */}
        <div className="flex flex-col items-center justify-center gap-4">
          
          {/* キャンバスコンテナ */}
          <div className="relative w-72 h-72 bg-[#FCFBF8] border-8 border-amber-100 rounded-3xl shadow-md overflow-hidden flex items-center justify-center">
            
            {/* 背景の文字ガイド */}
            <div className="absolute inset-0 flex items-center justify-center select-none text-slate-100 font-black text-[220px] pointer-events-none leading-none z-0">
              {selectedLetter}
            </div>

            {/* 始点・矢印ガイドオーバーレイ */}
            {!isCompleted && !isDemoPlaying && TRACING_GUIDES[selectedLetter]?.guides.map(g => (
              <React.Fragment key={g.id}>
                {/* 始点ドット */}
                <div
                  className="absolute w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-black select-none pointer-events-none z-20 animate-pulse border-2 border-white shadow-md"
                  style={{ left: `${g.start.x}px`, top: `${g.start.y}px`, transform: 'translate(-50%, -50%)' }}
                >
                  {g.id}
                </div>
                {/* 矢印 */}
                <div
                  className={`absolute select-none pointer-events-none text-blue-400 font-extrabold text-xl z-20 opacity-80 ${g.arrow.rotate}`}
                  style={{ left: `${g.arrow.x}px`, top: `${g.arrow.y}px`, transform: 'translate(-50%, -50%)' }}
                >
                  ➔
                </div>
              </React.Fragment>
            ))}

            {/* お手本アニメーション時の筆先カーソル (✍️) */}
            {isDemoPlaying && demoCursor && (
              <div
                className="absolute text-3xl pointer-events-none select-none z-30 transition-all duration-75"
                style={{
                  left: `${demoCursor.x}px`,
                  top: `${demoCursor.y}px`,
                  transform: 'translate(-10px, -24px)',
                }}
              >
                ✍️
              </div>
            )}
            
            {/* 描画キャンバス */}
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className={`absolute inset-0 w-full h-full z-10 ${
                isDemoPlaying || isCompleted ? 'pointer-events-none' : 'cursor-crosshair touch-none'
              }`}
              style={{ touchAction: 'none' }}
            />
          </div>

          {/* カラーパレットとみほんボタン */}
          {!isCompleted && (
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-amber-50/50 p-3 rounded-2xl border-2 border-amber-100 w-full max-w-sm justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-amber-800">ペンの いろ：</span>
                <div className="flex gap-1.5">
                  {BRUSH_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onPlaySound('tap');
                        setBrushColor(c.value);
                      }}
                      disabled={isDemoPlaying}
                      className={`w-7 h-7 rounded-full ${c.bg} border-2 transition-all active:scale-90 cursor-pointer flex items-center justify-center ${
                        brushColor === c.value
                          ? 'border-amber-400 ring-2 ring-amber-200 scale-110 shadow-sm'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      title={c.name}
                    >
                      {brushColor === c.value && (
                        <span className="text-[10px] text-white font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handlePlayDemo}
                disabled={isDemoPlaying}
                className={`px-3 py-1.5 rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all border-2 cursor-pointer ${
                  isDemoPlaying
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    : 'border-amber-300 bg-amber-400 text-amber-950 hover:bg-amber-500 hover:border-amber-400'
                }`}
              >
                {isDemoPlaying ? 'みほん 再生中...🎬' : 'みほんを みる ✍️'}
              </button>
            </div>
          )}
        </div>

        {/* コントロール・アクション */}
        <div className="flex flex-col items-center gap-3">
          {!isCompleted ? (
            <div className="flex gap-4">
              <button
                onClick={handleClear}
                disabled={!hasDrawn || isDemoPlaying}
                className={`font-black text-sm px-6 py-3 rounded-2xl transition-all shadow-sm active:translate-y-[2px] active:border-b border-b-4 flex items-center gap-1.5 cursor-pointer ${
                  hasDrawn && !isDemoPlaying
                    ? 'bg-rose-100 hover:bg-rose-200 border-rose-300 text-rose-700'
                    : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>もういちど 🔄</span>
              </button>

              <button
                onClick={handleDone}
                disabled={!hasDrawn || isDemoPlaying}
                className={`font-black text-md px-12 py-3 rounded-2xl transition-all shadow-md active:translate-y-[2px] active:border-b-2 border-b-4 flex items-center gap-2 cursor-pointer ${
                  hasDrawn && !isDemoPlaying
                    ? 'bg-sky-400 hover:bg-sky-500 border-sky-600 text-sky-950 scale-105 animate-pulse'
                    : 'bg-slate-200 border-slate-400 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-5 h-5" />
                <span>できた！</span>
              </button>
            </div>
          ) : (
            <div className="text-center animate-bounce flex flex-col items-center gap-3">
              <span className="text-xl md:text-2xl font-black text-sky-600 block">🌟 じょうずに かけたね！ 🌟</span>
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl">
                <span className="text-2xl">🐱</span>
                <span className="text-xs font-black text-emerald-800">
                  まねきねこ「とても きれいな 『{selectedLetter}』 だよ！」
                </span>
              </div>
              <button
                onClick={handleBackToSelection}
                className="bg-sky-500 hover:bg-sky-600 border-b-4 border-sky-700 text-white font-black text-md px-14 py-2.5 rounded-xl shadow-md cursor-pointer mt-1"
              >
                もじえらびに もどる ➔
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
