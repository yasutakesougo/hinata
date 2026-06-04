import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Trash2, CheckCircle } from 'lucide-react';
import { StarProgress } from '../App';

interface HiraganaTracingScreenProps {
  soundEnabled: boolean;
  onPlaySound: (type: 'correct' | 'wrong' | 'tap' | 'victory') => void;
  speakText: (text: string, enabled: boolean) => void;
  onGoBack: () => void;
  logActivity: (message: string) => void;
}

const BRUSH_COLORS = [
  { id: 'blue', name: 'あお 🔵', value: '#3b82f6', border: 'border-blue-300', bg: 'bg-blue-500' },
  { id: 'pink', name: 'あか 🔴', value: '#ec4899', border: 'border-pink-300', bg: 'bg-pink-500' },
  { id: 'green', name: 'みどり 🟢', value: '#10b981', border: 'border-emerald-300', bg: 'bg-emerald-500' },
];

export const HiraganaTracingScreen: React.FC<HiraganaTracingScreenProps> = ({
  soundEnabled,
  onPlaySound,
  speakText,
  onGoBack,
  logActivity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#3b82f6');
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // 音声アナウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      speakText('ひらがなの 「し」 を なぞってみよう！ゆびや マウスで なぞってね。', soundEnabled);
    }, 450);
    return () => clearTimeout(timer);
  }, [speakText, soundEnabled]);

  // キャンバスの初期設定
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 高解像度ディスプレイ対応（Retina対応）
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    
    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(2, 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 12; // 子どもが描きやすい太めの線
    contextRef.current = context;
  }, []);

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
      // タッチイベントの場合
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      // マウスイベントの場合
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  // 描画開始
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCoords(e);
    if (!coords || !contextRef.current) return;

    contextRef.current.beginPath();
    contextRef.current.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  // 描画中
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current) return;
    
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

  // けす（キャンバスクリア）
  const handleClear = () => {
    onPlaySound('tap');
    const canvas = canvasRef.current;
    if (!canvas || !contextRef.current) return;

    // 一旦クリアし再設定
    contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // できた！ボタン
  const handleDone = () => {
    if (!hasDrawn || isCompleted) return;

    onPlaySound('victory');
    setShowSuccessAnim(true);
    setIsCompleted(true);
    logActivity('ひらがな「し」のなぞり書きをクリア！');

    // キラキラ演出と被らないように少し遅らせて読み上げる
    setTimeout(() => {
      speakText('せいかい！「し」が じょうずに かけたね！すごい！', soundEnabled);
    }, 400);
  };

  return (
    <div className="w-full flex flex-col items-center gap-5 animate-fadeIn">
      {/* 上部ナビゲーション */}
      <div className="w-full max-w-2xl flex items-center justify-between gap-4">
        <button
          onClick={onGoBack}
          className="bg-white hover:bg-slate-50 border-4 border-slate-200 p-2.5 rounded-2xl shadow-sm cursor-pointer active:translate-y-[1px] flex items-center justify-center transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <StarProgress
          currentStep={1}
          totalSteps={1}
          title="もじの なぞりかき"
          starResults={[isCompleted]}
        />
        <div className="w-12 h-12" /> {/* バランス用ダミー */}
      </div>

      {/* スケッチブック風ボード */}
      <div className="w-full max-w-2xl bg-white border-8 border-sky-300 rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col gap-5 relative overflow-hidden">
        
        {/* 正解時キラキラエフェクト */}
        {showSuccessAnim && (
          <div className="absolute inset-0 bg-sky-500/10 pointer-events-none flex items-center justify-center z-20 animate-fadeIn">
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
            こくご
          </span>
          <h2 className="text-lg md:text-xl font-black text-sky-800 leading-relaxed mt-1">
            ガイドの すじを ゆびで なぞってみよう！
          </h2>
        </div>

        {/* メインの描画ボード */}
        <div className="flex flex-col items-center justify-center gap-4">
          
          {/* キャンバスコンテナ */}
          <div className="relative w-72 h-72 bg-[#FCFBF8] border-8 border-amber-100 rounded-3xl shadow-md overflow-hidden flex items-center justify-center">
            
            {/* 背景の文字ガイド (し) */}
            <div className="absolute inset-0 flex items-center justify-center select-none text-slate-100 font-black text-[220px] pointer-events-none leading-none">
              し
            </div>
            
            {/* キャンバス */}
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-10"
              style={{ touchAction: 'none' }}
            />
          </div>

          {/* カラーパレット */}
          {!isCompleted && (
            <div className="flex items-center gap-3.5 bg-amber-50/50 p-2.5 rounded-2xl border-2 border-amber-100">
              <span className="text-[10px] font-black text-amber-800">ペンの いろ：</span>
              <div className="flex gap-2">
                {BRUSH_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onPlaySound('tap');
                      setBrushColor(c.value);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all border-2 cursor-pointer flex items-center gap-1.5 ${
                      brushColor === c.value
                        ? 'border-amber-400 bg-amber-100 text-amber-950 scale-105 ring-2 ring-amber-200'
                        : 'border-transparent bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${c.bg}`} />
                    <span>{c.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* コントロール・フィードバック */}
        <div className="flex flex-col items-center gap-3">
          {!isCompleted ? (
            <div className="flex gap-4">
              <button
                onClick={handleClear}
                disabled={!hasDrawn}
                className={`font-black text-sm px-6 py-3 rounded-2xl transition-all shadow-sm active:translate-y-[2px] active:border-b border-b-4 flex items-center gap-1.5 cursor-pointer ${
                  hasDrawn
                    ? 'bg-rose-100 hover:bg-rose-200 border-rose-300 text-rose-700'
                    : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>けす</span>
              </button>

              <button
                onClick={handleDone}
                disabled={!hasDrawn}
                className={`font-black text-md px-12 py-3 rounded-2xl transition-all shadow-md active:translate-y-[2px] active:border-b-2 border-b-4 flex items-center gap-2 cursor-pointer ${
                  hasDrawn
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
                  まねきねこ「とても きれいな 『し』 だよ！」
                </span>
              </div>
              <button
                onClick={onGoBack}
                className="bg-sky-500 hover:bg-sky-600 border-b-4 border-sky-700 text-white font-black text-md px-14 py-2.5 rounded-xl shadow-md cursor-pointer mt-1"
              >
                ひろばに もどる ➔
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
