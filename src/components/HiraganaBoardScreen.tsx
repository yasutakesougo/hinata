import React, { useState } from 'react';
import { Volume2, ChevronLeft, Trash2 } from 'lucide-react';

interface HiraganaBoardScreenProps {
  onGoBack: () => void;
  soundEnabled: boolean;
  speakText: (text: string, enabled: boolean) => void;
  reducedMotion: boolean;
}

const HIRAGANA_GRID = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', '',   'ゆ', '',   'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', 'を', 'ん', 'ー', 'っ']
];

export const HiraganaBoardScreen: React.FC<HiraganaBoardScreenProps> = ({
  onGoBack,
  soundEnabled,
  speakText,
  reducedMotion
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [showHanamaru, setShowHanamaru] = useState<boolean>(false);
  const [isReading, setIsReading] = useState<boolean>(false);

  const handleCharTap = (char: string) => {
    if (inputText.length >= 12) return; // 最大12文字制限
    
    // 単音を再生
    speakText(char, soundEnabled);
    setInputText(prev => prev + char);
  };

  const handleBackspace = () => {
    speakText("けす", soundEnabled);
    setInputText(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    speakText("ぜんぶけす", soundEnabled);
    setInputText('');
    setShowHanamaru(false);
  };

  const handleRead = () => {
    if (inputText.length === 0) {
      speakText("もじをえらんでね", soundEnabled);
      return;
    }

    setIsReading(true);
    speakText(inputText, soundEnabled);

    // 読み上げアニメーションと 💮できた！ 演出の起動
    setShowHanamaru(true);
    
    // できた！メッセージの再生（ディレイをかけて読み上げ後に聞こえるようにする）
    setTimeout(() => {
      speakText("💮 できた！おみごと！", soundEnabled);
      setIsReading(false);
    }, Math.max(1200, inputText.length * 350)); // 文字数に応じたディレイ
  };

  return (
    <div className="w-full max-w-2xl bg-white border-8 border-sky-300 rounded-3xl p-4 md:p-6 shadow-2xl flex flex-col gap-5 my-4 relative animate-fadeIn">
      {/* CSSスタイルインジェクション */}
      <style>{`
        @keyframes hanamaru-zoom {
          0% { transform: scale(0) rotate(-45deg); opacity: 0; }
          60% { transform: scale(1.3) rotate(15deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes sparkle-pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        .animate-hanamaru {
          animation: ${reducedMotion ? 'none' : 'hanamaru-zoom 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'};
        }
        .animate-sparkle {
          animation: ${reducedMotion ? 'none' : 'sparkle-pulse 1.5s ease-in-out infinite'};
        }
      `}</style>

      {/* ヘッダーエリア */}
      <div className="text-center space-y-1 relative">
        <h2 className="text-2xl md:text-3xl font-black text-sky-600 flex items-center justify-center gap-1.5 select-none">
          <span>🗣️</span> あいう おんどくの もり <span>📖</span>
        </h2>
        <p className="text-xs font-bold text-slate-400">
          ひらがなを ならべて、じぶんの ことばを つくってみよう！
        </p>
      </div>

      {/* 入力された文字の表示エリア */}
      <div className="w-full bg-slate-50 border-4 border-dashed border-sky-200 rounded-2xl p-4 min-h-[96px] flex items-center justify-center relative overflow-hidden shadow-inner bg-[radial-gradient(#e0f2fe_1px,transparent_1px)] [background-size:16px_16px]">
        {inputText.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-full">
            {inputText.split('').map((char, index) => (
              <span
                key={`${char}-${index}`}
                className={`bg-white border-2 border-sky-200 text-2xl md:text-3xl font-black text-sky-900 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-xs select-none ${
                  reducedMotion ? '' : 'animate-scaleUp'
                }`}
                style={reducedMotion ? {} : { animationDelay: `${index * 0.05}s` }}
              >
                {char}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm font-bold text-slate-400 animate-pulse">
            したの ひらがなを タップして ならべてね
          </span>
        )}

        {/* 💮できた！モーダルオーバーレイ */}
        {showHanamaru && (
          <div className="absolute inset-0 bg-white/95 rounded-xl flex flex-col items-center justify-center gap-2 z-10 animate-fadeIn border-2 border-amber-300">
            <div className="flex items-center gap-2">
              <span className="text-6xl filter drop-shadow-md select-none animate-hanamaru block">💮</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-amber-600 animate-bounce">
              できました！おみごと！
            </h3>
            <button
              onClick={() => setShowHanamaru(false)}
              className="bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-xs px-4 py-1.5 rounded-full border-b-2 border-amber-600 active:translate-y-[1px] active:border-b-0 cursor-pointer shadow-xs mt-1 transition-all"
            >
              とじる
            </button>
          </div>
        )}
      </div>

      {/* 操作ボタンエリア */}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <button
          onClick={onGoBack}
          className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-4 py-2.5 rounded-2xl border-b-4 border-slate-300 active:translate-y-[2px] active:border-b-2 text-xs md:text-sm cursor-pointer select-none transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          もりにもどる
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleBackspace}
            disabled={inputText.length === 0 || showHanamaru}
            className={`flex items-center gap-1 bg-rose-50 text-rose-700 font-black px-3.5 py-2.5 rounded-2xl border-b-4 border-rose-300 active:translate-y-[2px] active:border-b-2 text-xs md:text-sm transition-all ${
              inputText.length === 0 ? 'opacity-40 cursor-not-allowed border-b-2 translate-y-[2px]' : 'hover:bg-rose-100/70 cursor-pointer'
            }`}
          >
            ◀ けす
          </button>

          <button
            onClick={handleClear}
            disabled={inputText.length === 0}
            className={`flex items-center gap-1 bg-slate-100 text-slate-500 font-black px-3.5 py-2.5 rounded-2xl border-b-4 border-slate-300 active:translate-y-[2px] active:border-b-2 text-xs md:text-sm transition-all ${
              inputText.length === 0 ? 'opacity-40 cursor-not-allowed border-b-2 translate-y-[2px]' : 'hover:bg-slate-200 cursor-pointer hover:text-slate-700'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            ぜんぶけす
          </button>
        </div>

        <button
          onClick={handleRead}
          disabled={inputText.length === 0 || isReading}
          className={`flex items-center gap-1.5 bg-sky-500 text-white font-black px-6 py-2.5 rounded-2xl border-b-4 border-sky-700 active:translate-y-[2px] active:border-b-2 text-xs md:text-sm transition-all shadow-md ${
            inputText.length === 0 || isReading
              ? 'opacity-40 cursor-not-allowed border-b-2 translate-y-[2px]'
              : 'hover:bg-sky-600 cursor-pointer hover:shadow-lg active:scale-98'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          🗣️ よむ
        </button>
      </div>

      {/* ひらがな五十音図グリッド */}
      <div className="bg-sky-50/50 border-4 border-sky-100 rounded-3xl p-3 md:p-4 select-none">
        <div className="grid grid-cols-5 gap-2 md:gap-3 w-full max-w-lg mx-auto">
          {HIRAGANA_GRID.map((row, rowIndex) =>
            row.map((char, colIndex) => {
              if (char === '') {
                return <div key={`empty-${rowIndex}-${colIndex}`} className="invisible" />;
              }
              return (
                <button
                  key={char}
                  onClick={() => handleCharTap(char)}
                  disabled={inputText.length >= 12 || showHanamaru}
                  className={`bg-white border-2 border-slate-200 text-slate-800 font-black text-lg md:text-xl p-2.5 rounded-xl shadow-xs flex items-center justify-center min-h-[48px] select-none transition-all ${
                    inputText.length >= 12 || showHanamaru
                      ? 'opacity-50 cursor-not-allowed bg-slate-50'
                      : 'hover:border-sky-300 hover:bg-sky-50/50 cursor-pointer active:scale-90 active:bg-sky-100/50'
                  }`}
                >
                  {char}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* やさしいヒントメッセージ */}
      <div className="w-full bg-sky-50/40 border border-sky-100 rounded-2xl p-3 text-left">
        <p className="text-[10px] md:text-xs font-bold text-sky-800 leading-relaxed flex items-start gap-1.5">
          <span>💡</span>
          <span>
            せいかいや まちがいは ありません。すきな もじを なべて、おとを ならしながら、じゆうに あそんでね！
          </span>
        </p>
      </div>
    </div>
  );
};
