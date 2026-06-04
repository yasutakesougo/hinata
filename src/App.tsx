import React, { useState, useEffect, useMemo } from 'react';
import { Volume2, VolumeX, Star, Trophy, Sparkles, Plus, Minus, Check, Map, Compass, BookOpen, Home } from 'lucide-react';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged, linkWithCredential, EmailAuthProvider, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { CompanionWalker } from './components/CompanionWalker';
import { CatRoomSplitScreen } from './components/CatRoomSplitScreen';
import { FURNITURE_LIST } from './constants/furnitureList';
import { HiraganaTracingScreen } from './components/HiraganaTracingScreen';

// Purity rule workarounds (external helpers)
function getNow(): number {
  return Date.now();
}

function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
}

function getRandom(): number {
  return Math.random();
}

// ============================================================================
// ■ SECTION 1: TYPES & DATA (型定義とステージデータ)
// ============================================================================

interface Stage {
  id: number;
  name: string;
  jpName: string;
  desc: string;
  type: 'synthesis' | 'make10' | 'subtraction' | 'boss' | 'cat_split';
  maxVal: number; 
  reward: { name: string; emoji: string; desc: string };
  difficulty: string;
}

interface SynthesisQuestion {
  left: number;
  right: number;
  answer: number;
  choices: number[];
  fruit: string;
}

interface SubtractionQuestion {
  left: number;
  minus: number;
  answer: number;
  choices: number[];
  fruit: string;
}

interface Make10Question {
  initial: number;
  target: number;
  needed: number;
  choices: number[];
  fruit: string;
}

interface AnswerRecord {
  type: 'synthesis' | 'make10' | 'subtraction' | 'cat_split';
  questionText: string;
  userChoice: number;
  correctAnswer: number;
  isCorrect: boolean;
  timestamp: number;
}

interface ActivityLog {
  id: string;
  timestamp: number;
  date: string; // YYYY-MM-DD
  message: string;
}

const STAGES: Stage[] = [
  {
    id: 1,
    name: 'forest',
    jpName: 'もりの ひろば',
    desc: '5までの かずを あわせる れんしゅうだよ！',
    type: 'synthesis',
    maxVal: 5,
    reward: { name: 'ぴょんうさぎ', emoji: '🐰', desc: 'にんじんが大好きな はねるうさぎ。' },
    difficulty: '★☆☆☆☆'
  },
  {
    id: 2,
    name: 'cat_split_5',
    jpName: 'こねこの おへやわけ',
    desc: '5までの かずを ２つに わけてみよう！',
    type: 'cat_split',
    maxVal: 5,
    reward: { name: 'おしゃべりオウム', emoji: '🦜', desc: 'くだものが大好きで、おいしそうに食べるオウム。' },
    difficulty: '★★☆☆☆'
  },
  {
    id: 3,
    name: 'farm',
    jpName: 'おひさま のうえん',
    desc: '10までの かずの ごうせい！すこしふえるよ。',
    type: 'synthesis',
    maxVal: 10,
    reward: { name: 'まねきねこ', emoji: '🐱', desc: 'お部屋を分けるのが得意な招き猫。' },
    difficulty: '★★★☆☆'
  },
  {
    id: 4,
    name: 'cat_split_10',
    jpName: 'ネコちゃんの おへやわけ',
    desc: '10までの かずを ２つに わけてみよう！',
    type: 'cat_split',
    maxVal: 10,
    reward: { name: 'うきうきさる', emoji: '🐒', desc: 'いたずら好きだけど算数だけは真面目なさる。' },
    difficulty: '★★★☆☆'
  },
  {
    id: 5,
    name: 'pack',
    jpName: 'たまごの パック',
    desc: '10をつくる パズルゲーム！あといくつ必要かな？',
    type: 'make10',
    maxVal: 10,
    reward: { name: 'もぐもぐハムスター', emoji: '🐹', desc: 'ほっぺたにくだものをたくさんつめこむハムスター。' },
    difficulty: '★★★★☆'
  },
  {
    id: 6,
    name: 'hamster',
    jpName: 'もぐもぐ ハムスター',
    desc: '10までの ひきざん！ハムスターといっしょに かぞえよう。',
    type: 'subtraction',
    maxVal: 10,
    reward: { name: 'さんすうパンダ', emoji: '🐼', desc: '竹で作ったそろばんを持つ天才パンダ。' },
    difficulty: '★★★★☆'
  },
  {
    id: 7,
    name: 'boss',
    jpName: 'さんすうキングの しろ',
    desc: 'ラスボス登場！たしざんと ひきざんの スピードMIXバトル！',
    type: 'boss',
    maxVal: 10,
    reward: { name: 'くだものドラゴン', emoji: '🐲', desc: 'さんすうキングに飼われていた伝説のドラゴン。' },
    difficulty: '★★★★★'
  }
];

const FRUITS = ['🍎', '🍊', '🍓', '🍇', '🍑', '🍋', '🍒', '🍈'];

// ============================================================================
// ■ SECTION 2: AUDIO & VOICE SYSTEMS (オーディオ＆音声読み上げ)
// ============================================================================

// AudioContext の Singleton 管理（メモリリーク・重さ対策）
let globalAudioContext: AudioContext | null = null;
let globalSoundEnabled = true;
let globalSpeechRate = 1.15;

const getAudioContext = (forceCreate = false): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  
  if (!globalAudioContext) {
    if (!forceCreate) return null;
    globalAudioContext = new AudioContextClass();
  }
  
  if (globalAudioContext.state === 'suspended' && forceCreate) {
    globalAudioContext.resume();
  }
  
  return globalAudioContext;
};

// 統一効果音プレイヤー
const playSoundEffect = (type: 'correct' | 'wrong' | 'tap' | 'whoosh' | 'pop' | 'damage' | 'victory' | 'clear' | 'eat') => {
  if (!globalSoundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;

  switch (type) {
    case 'correct':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
      break;

    case 'wrong':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(174.61, now); // F3
      osc.frequency.setValueAtTime(146.83, now + 0.15); // D3
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case 'tap':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;

    case 'whoosh':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.5);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;

    case 'pop':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(550, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;

    case 'damage':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case 'eat': {
      // First crunch on the default osc
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);

      // Second crunch on a new osc
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(320, now + 0.12);
      o2.frequency.exponentialRampToValueAtTime(70, now + 0.2);
      o2.connect(g2);
      g2.connect(ctx.destination);
      g2.gain.setValueAtTime(0.12, now + 0.12);
      g2.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      o2.start(now + 0.12);
      o2.stop(now + 0.2);
      break;
    }

    case 'clear':
    case 'victory': {
      const notes = type === 'victory' 
        ? [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00] 
        : [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type === 'victory' ? 'sine' : 'triangle';
        o.frequency.setValueAtTime(freq, now + idx * 0.1);
        g.gain.setValueAtTime(0.08, now + idx * 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.1);
        o.stop(now + idx * 0.1 + 0.3);
      });
      break;
    }
  }
};

// 音声合成による読み上げ
const speakText = (text: string, enabled: boolean) => {
  if (!enabled) return;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = globalSpeechRate;
    window.speechSynthesis.speak(utterance);
  }
};

// BGM 音源データ
const MELODIES = {
  title: {
    tempo: 100, // BPM
    notes: [
      261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 329.63, 261.63,
      293.66, 329.63, 392.00, 440.00, 392.00, 440.00, 523.25, 392.00
    ],
    gains: [0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03],
    durations: [1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 2] // in beats
  },
  play: {
    tempo: 110,
    notes: [
      261.63, 0, 329.63, 0, 392.00, 0, 329.63, 0,
      293.66, 0, 349.23, 0, 440.00, 0, 349.23, 0
    ],
    gains: [0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0],
    durations: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  boss: {
    tempo: 140,
    notes: [
      220.00, 220.00, 261.63, 293.66, 311.13, 293.66, 261.63, 220.00,
      196.00, 196.00, 246.94, 293.66, 293.66, 246.94, 196.00, 220.00
    ],
    gains: [0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.05],
    durations: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2]
  }
};

let bgmIntervalId: ReturnType<typeof setInterval> | null = null;
let bgmNoteIndex = 0;
let bgmNextNoteTime = 0;
let currentBgmType: 'title' | 'play' | 'boss' | null = null;
let activeBgmOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];
const BGM_LOOKAHEAD = 25.0; // ms
const BGM_SCHEDULE_AHEAD_TIME = 0.1; // seconds

const stopBgm = () => {
  if (bgmIntervalId) {
    clearInterval(bgmIntervalId);
    bgmIntervalId = null;
  }
  activeBgmOscillators.forEach(item => {
    try {
      item.osc.stop();
    } catch {
      // Ignore errors when stopping already stopped oscillators
    }
  });
  activeBgmOscillators = [];
  currentBgmType = null;
};

const startBgm = (type: 'title' | 'play' | 'boss', enabled: boolean) => {
  if (!enabled) {
    stopBgm();
    return;
  }
  if (currentBgmType === type && bgmIntervalId) {
    return;
  }
  stopBgm();

  const ctx = getAudioContext();
  if (!ctx) return;

  currentBgmType = type;
  bgmNoteIndex = 0;
  bgmNextNoteTime = ctx.currentTime;

  const melody = MELODIES[type];
  const scheduleNextNote = () => {
    if (bgmNextNoteTime < ctx.currentTime) {
      bgmNextNoteTime = ctx.currentTime;
    }
    while (bgmNextNoteTime < ctx.currentTime + BGM_SCHEDULE_AHEAD_TIME) {
      const freq = melody.notes[bgmNoteIndex];
      const noteGainVal = melody.gains[bgmNoteIndex];
      const beatDuration = melody.durations[bgmNoteIndex];
      
      const secondsPerBeat = 60.0 / melody.tempo;
      const durationSeconds = beatDuration * secondsPerBeat;

      if (freq > 0 && noteGainVal > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'boss') {
          osc.type = 'sawtooth';
        } else if (type === 'play') {
          osc.type = 'sine';
        } else {
          osc.type = 'triangle';
        }

        osc.frequency.setValueAtTime(freq, bgmNextNoteTime);
        
        gain.gain.setValueAtTime(0, bgmNextNoteTime);
        gain.gain.linearRampToValueAtTime(noteGainVal, bgmNextNoteTime + 0.03);
        gain.gain.setValueAtTime(noteGainVal, bgmNextNoteTime + durationSeconds - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, bgmNextNoteTime + durationSeconds);

        osc.start(bgmNextNoteTime);
        osc.stop(bgmNextNoteTime + durationSeconds);

        const activeItem = { osc, gain };
        activeBgmOscillators.push(activeItem);
        setTimeout(() => {
          activeBgmOscillators = activeBgmOscillators.filter(item => item !== activeItem);
        }, (bgmNextNoteTime + durationSeconds - ctx.currentTime) * 1000 + 100);
      }

      bgmNextNoteTime += durationSeconds;
      bgmNoteIndex = (bgmNoteIndex + 1) % melody.notes.length;
    }
  };

  bgmIntervalId = setInterval(scheduleNextNote, BGM_LOOKAHEAD);
};


// ============================================================================
// ■ SECTION 3: QUESTIONS LOGIC (問題生成・選択肢ロジック)
// ============================================================================

// 3択の選択肢を確実に生成する関数
const generateThreeChoices = (correctAnswer: number, min: number, max: number): number[] => {
  const wrongs = new Set<number>();
  while (wrongs.size < 2) {
    const wrongVal = Math.floor(Math.random() * (max - min + 1)) + min;
    if (wrongVal !== correctAnswer) {
      wrongs.add(wrongVal);
    }
  }
  return [correctAnswer, ...Array.from(wrongs)].sort(() => Math.random() - 0.5);
};

// モード1: 合成(たしざん)問題生成
const generateSynthesisQuestion = (maxVal: number): SynthesisQuestion => {
  const answer = Math.floor(Math.random() * (maxVal - 2)) + 3; // 3 〜 maxVal
  const left = Math.floor(Math.random() * (answer - 1)) + 1; // 1 〜 answer-1
  const right = answer - left;
  const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
  const choices = generateThreeChoices(answer, 2, maxVal);

  return { left, right, answer, choices, fruit };
};

// モード2: 10をつくろう問題生成
const generateMake10Question = (): Make10Question => {
  const initial = Math.floor(Math.random() * 8) + 1; // 1 〜 8
  const needed = 10 - initial;
  const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
  const choices = generateThreeChoices(needed, 1, 9); // 必要な補数は 1 〜 9 の範囲

  return { initial, target: 10, needed, choices, fruit };
};

// モード3: ひきざん問題生成
const generateSubtractionQuestion = (maxVal: number): SubtractionQuestion => {
  const left = Math.floor(Math.random() * (maxVal - 3)) + 4; // 4 〜 maxVal
  const minus = Math.floor(Math.random() * (left - 1)) + 1; // 1 〜 left-1
  const answer = left - minus;
  const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
  const choices = generateThreeChoices(answer, 1, maxVal);

  return { left, minus, answer, choices, fruit };
};


// ============================================================================
// ■ SECTION 4: SUB-COMPONENTS (共通UIパーツ)
// ============================================================================

// ヘッダーコンポーネント
interface AppHeaderProps {
  screen: string;
  soundEnabled: boolean;
  onGoHome: () => void;
  onToggleSound: () => void;
  onGoZukan: () => void;
  onGoReport: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ screen, soundEnabled, onGoHome, onToggleSound, onGoZukan, onGoReport }) => {
  const [isHolding, setIsHolding] = React.useState(false);
  const [showPressHint, setShowPressHint] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHold = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable && e.type === 'touchstart') {
      e.preventDefault();
    }
    setIsHolding(true);
    setShowPressHint(false);
    timerRef.current = setTimeout(() => {
      setIsHolding(false);
      onGoReport();
    }, 3000);
  };

  const endHold = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (isHolding) {
        setShowPressHint(true);
        if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = setTimeout(() => setShowPressHint(false), 2000);
      }
    }
    setIsHolding(false);
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, []);

  return (
    <header className="bg-white border-b-4 border-amber-200 p-4 shadow-sm flex justify-between items-center max-w-4xl mx-auto w-full rounded-b-3xl">
      <div className="flex gap-2">
        {screen !== 'title' && screen !== 'home' && screen !== 'report' && (
          <button
            onClick={onGoHome}
            className="flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-black px-5 py-3 min-h-[48px] rounded-2xl border-b-4 border-amber-300 transition-all active:translate-y-[2px] active:border-b-2"
          >
            <Home className="w-5 h-5" />
            <span className="text-sm md:text-base">ひろば</span>
          </button>
        )}
        {(screen === 'home' || screen === 'map' || screen === 'report') && (
          <button
            onClick={onGoZukan}
            className="flex items-center gap-1 bg-pink-100 hover:bg-pink-200 text-pink-700 font-black px-5 py-3 min-h-[48px] rounded-2xl border-b-4 border-pink-300 transition-all active:translate-y-[2px] active:border-b-2"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-sm md:text-base">ずかん</span>
          </button>
        )}
      </div>
      
      <h1 className="text-lg md:text-2xl font-black text-amber-600 tracking-wider flex items-center gap-1.5 cursor-pointer select-none" onClick={onGoHome}>
        <span>🍎</span> さんすうアドベンチャー <span>⚔️</span>
      </h1>

      <div className="flex items-center gap-2">
        {(screen === 'title' || screen === 'home' || screen === 'map' || screen === 'zukan') && (
          <button
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
            className={`relative flex items-center gap-1 bg-violet-100 hover:bg-violet-200 text-violet-700 font-black px-5 py-3 md:py-3 md:px-5 min-h-[48px] rounded-2xl border-b-4 border-violet-300 transition-all active:translate-y-[2px] active:border-b-2 text-xs md:text-sm select-none ${
              isHolding ? 'scale-95' : ''
            }`}
          >
            {showPressHint && (
              <div className="absolute bottom-[-45px] right-0 bg-rose-500 text-white font-black text-[10px] px-2.5 py-1 rounded-xl shadow-lg z-50 whitespace-nowrap border-2 border-rose-300">
                ⚠️ 3びょう ながおし してね！
              </div>
            )}
            {isHolding ? (
              <>
                <span className="animate-ping text-[10px]">🔒</span>
                <span>3秒ながおし中...</span>
                <span className="absolute bottom-0 left-0 h-1 bg-violet-500 animate-progressBar w-full" />
              </>
            ) : (
              <>
                <span>🔑</span>
                <span className="hidden sm:inline">おうちのひとへ</span>
                <span className="sm:hidden text-[10px]">おうちの人</span>
              </>
            )}
          </button>
        )}
        <button
          onClick={onToggleSound}
          className={`p-3.5 rounded-2xl border-4 transition-all active:scale-95 shadow-sm ${
            soundEnabled 
              ? 'bg-amber-400 border-amber-500 text-amber-950' 
              : 'bg-slate-300 border-slate-400 text-slate-600'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
        </button>
      </div>
    </header>
  );
};

// 星型進捗バー
export interface StarProgressProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  starResults?: boolean[];
}

export const StarProgress: React.FC<StarProgressProps> = ({ currentStep, totalSteps, title, starResults }) => {
  return (
    <div className="w-full max-w-md bg-white border-4 border-amber-100 rounded-2xl px-4 py-2 shadow-sm flex justify-between items-center">
      <span className="font-extrabold text-amber-700 text-xs md:text-sm">
        ⛳ {title} ({currentStep} / {totalSteps})
      </span>
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const isPast = idx < currentStep - 1;
          const isCurrent = idx === currentStep - 1;
          const isFirstTryCorrect = starResults && starResults[idx] === true;
          
          return (
            <Star
              key={idx}
              className={`w-5 h-5 transition-all ${
                isPast 
                  ? isFirstTryCorrect 
                    ? 'text-yellow-400 fill-yellow-400' 
                    : 'text-slate-400 fill-slate-300' 
                  : isCurrent 
                    ? 'text-amber-500 fill-yellow-200 animate-pulse scale-110' 
                    : 'text-slate-200'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};


// ============================================================================
// ■ SECTION 5: SCREENS (各画面コンポーネント)
// ============================================================================

// --- 1. タイトル画面 ---
interface TitleScreenProps {
  onStart: () => void;
}

const TitleScreen: React.FC<TitleScreenProps> = ({ onStart }) => {
  return (
    <div className="flex flex-col items-center text-center gap-8 max-w-md w-full bg-white border-8 border-amber-300 p-8 rounded-3xl shadow-2xl relative overflow-hidden my-4">
      <div className="absolute top-2 right-2 animate-spin text-5xl">🍉</div>
      <div className="absolute bottom-2 left-2 animate-bounce text-5xl">🍒</div>
      
      <div className="space-y-3">
        <span className="text-8xl block animate-pulse">👑</span>
        <h2 className="text-3xl md:text-4xl font-extrabold text-amber-600 leading-tight select-none">
          さんすうクエスト<br/>
          <span className="text-2xl text-orange-500 font-black">〜くだものキングダム〜</span>
        </h2>
        <p className="text-slate-500 font-bold text-xs md:text-sm">
          10ぷんのぼうけんで、たしざんマスターになろう！
        </p>
      </div>

      <button
        onClick={onStart}
        className="w-full bg-emerald-600 hover:bg-emerald-700 border-b-8 border-emerald-800 text-white font-black text-xl md:text-2xl py-4 md:py-5 rounded-2xl shadow-xl transition-all active:translate-y-[4px] active:border-b-2 flex items-center justify-center gap-2"
      >
        <Compass className="w-7 h-7" />
        ぼうけんを はじめる！
      </button>
    </div>
  );
};


// --- 1.5. 森の広場ホーム画面 ---
interface HomeScreenProps {
  unlockedStageId: number;
  unlockedRewards: string[];
  themeId: string;
  onChangeTheme: (themeId: string) => void;
  onGoPlayMap: () => void;
  onSelectStageById: (id: number) => void;
  reducedMotion: boolean;
  onChangeReducedMotion: (val: boolean) => void;
  placedFurniture: Record<string, string | null>;
  setPlacedFurniture: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  isDecorating: boolean;
  setIsDecorating: (val: boolean) => void;
  selectedSpot: 'spot1' | 'spot2' | 'spot3' | null;
  setSelectedSpot: (spot: 'spot1' | 'spot2' | 'spot3' | null) => void;
  onGoPlayTracing: () => void;
  seasonMode: 'auto' | Season;
  onChangeSeason: (mode: 'auto' | Season) => void;
  currentSeason: Season;
  todayChoiceMade: boolean;
  onChooseActivity: (activity: 'walk' | 'math' | 'tracing' | 'later') => void;
}

const THEMES = [
  { id: 'cream', name: 'クリーム', bg: 'bg-[#FFFEEB]', cardBg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', activeBg: 'bg-amber-100', dot: 'bg-amber-400' },
  { id: 'pink', name: 'さくら', bg: 'bg-[#FFF0F5]', cardBg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', activeBg: 'bg-pink-100', dot: 'bg-pink-400' },
  { id: 'purple', name: 'ラベンダー', bg: 'bg-[#F3E8FF]', cardBg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', activeBg: 'bg-purple-100', dot: 'bg-purple-400' },
  { id: 'orange', name: 'オレンジ', bg: 'bg-[#FFF5EB]', cardBg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', activeBg: 'bg-orange-100', dot: 'bg-orange-400' },
  { id: 'sky', name: 'そらいろ', bg: 'bg-[#F0F9FF]', cardBg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-700', activeBg: 'bg-sky-100', dot: 'bg-sky-400' }
];

const SEASON_CONFIGS: Record<Season, {
  name: string;
  bgClass: string;
  borderClass: string;
  groundClass: string;
  decorations: string[];
  particleEmoji: string;
}> = {
  spring: {
    name: 'はる',
    bgClass: 'bg-gradient-to-b from-[#FFF5F8] to-[#ECFDF5]',
    borderClass: 'border-pink-200',
    groundClass: 'bg-emerald-300/40 rounded-b-xl border-t border-emerald-300/20 absolute bottom-0 left-0',
    decorations: ['🌲', '🌸', '🍀', '🌷'],
    particleEmoji: '🌸'
  },
  summer: {
    name: 'なつ',
    bgClass: 'bg-gradient-to-b from-[#E0F2FE] to-[#F2FDF5]',
    borderClass: 'border-sky-300',
    groundClass: 'bg-emerald-400/40 rounded-b-xl border-t border-emerald-400/20 absolute bottom-0 left-0',
    decorations: ['🌳', '🌻', '☁️', '🍉'],
    particleEmoji: '✨'
  },
  autumn: {
    name: 'あき',
    bgClass: 'bg-gradient-to-b from-[#FEF3C7] to-[#FFFBEB]',
    borderClass: 'border-amber-300',
    groundClass: 'bg-amber-200/40 rounded-b-xl border-t border-amber-300/20 absolute bottom-0 left-0',
    decorations: ['🍁', '🍂', '🍄', '🌰'],
    particleEmoji: '🍂'
  },
  winter: {
    name: 'ふゆ',
    bgClass: 'bg-gradient-to-b from-[#F1F5F9] to-[#E2E8F0]',
    borderClass: 'border-blue-200',
    groundClass: 'bg-slate-200/50 rounded-b-xl border-t border-slate-300/30 absolute bottom-0 left-0',
    decorations: ['🌲', '⛄', '❄️', '🍊'],
    particleEmoji: '❄️'
  }
};

const PARTICLES = [
  { left: '8%', delay: '0s', duration: '7s', scale: 0.8, rotation: 0 },
  { left: '22%', delay: '1.2s', duration: '8.5s', scale: 1.1, rotation: 45 },
  { left: '35%', delay: '0.5s', duration: '6s', scale: 0.7, rotation: 90 },
  { left: '50%', delay: '2.5s', duration: '9s', scale: 1.0, rotation: 120 },
  { left: '65%', delay: '1.8s', duration: '7.5s', scale: 0.9, rotation: 160 },
  { left: '78%', delay: '3.0s', duration: '11s', scale: 1.2, rotation: 200 },
  { left: '90%', delay: '0.8s', duration: '8s', scale: 0.6, rotation: 240 }
];

const HomeScreen: React.FC<HomeScreenProps> = ({
  unlockedStageId,
  unlockedRewards,
  themeId,
  onChangeTheme,
  onGoPlayMap,
  onSelectStageById,
  reducedMotion,
  onChangeReducedMotion,
  placedFurniture,
  setPlacedFurniture,
  isDecorating,
  setIsDecorating,
  selectedSpot,
  setSelectedSpot,
  onGoPlayTracing,
  seasonMode,
  onChangeSeason,
  currentSeason,
  todayChoiceMade,
  onChooseActivity
}) => {
  const [showGoodbye, setShowGoodbye] = React.useState(false);
  const [decorTrigger, setDecorTrigger] = React.useState<Record<number, boolean>>({});
  const decorTimers = React.useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});

  React.useEffect(() => {
    const currentTimers = decorTimers.current;
    return () => {
      Object.values(currentTimers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const handleDecorTap = (idx: number) => {
    playSoundEffect('pop');
    if (reducedMotion) return; // うごきを とめる設定の時はアニメーションをトリガーしない

    setDecorTrigger(prev => ({ ...prev, [idx]: true }));
    if (decorTimers.current[idx]) {
      clearTimeout(decorTimers.current[idx]!);
    }
    decorTimers.current[idx] = setTimeout(() => {
      setDecorTrigger(prev => ({ ...prev, [idx]: false }));
      decorTimers.current[idx] = null;
    }, 400); // 400ms wiggle
  };

  const handleKokugoClick = () => {
    playSoundEffect('tap');
    onGoPlayTracing();
  };

  const handleSpotClick = (spot: 'spot1' | 'spot2' | 'spot3') => {
    playSoundEffect('tap');
    setSelectedSpot(spot);
  };

  const recommendedStageId = unlockedStageId <= STAGES.length ? unlockedStageId : 1;
  const recommendedStageName = STAGES.find(s => s.id === recommendedStageId)?.jpName || 'もりの ひろば';
  const seasonConfig = SEASON_CONFIGS[currentSeason];

  return (
    <div className="w-full max-w-2xl bg-white border-8 border-emerald-300 rounded-3xl p-6 shadow-2xl flex flex-col gap-6 my-4 relative">
      
      {/* 今日の3択パネル (自己決定・自律性の支援) */}
      {!todayChoiceMade && !isDecorating && (
        <div className="absolute inset-0 bg-slate-950/40 rounded-2xl flex items-center justify-center z-40 animate-fadeIn backdrop-blur-xs px-4">
          <div className="bg-white/95 border-8 border-emerald-300 p-6 md:p-8 rounded-3xl text-center space-y-6 w-full max-w-md shadow-2xl animate-scaleUp">
            <div className="space-y-1">
              <h3 className="text-2xl md:text-3xl font-black text-emerald-700 flex items-center justify-center gap-1.5">
                <span>🌟</span> きょうは なにから はじめる？ <span>🌟</span>
              </h3>
              <p className="text-xs font-bold text-slate-500">
                じぶんで えらんで ぼうけんを はじめよう！
              </p>
            </div>

            {/* 3つの選択カード */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 選択 1: もりであそぶ */}
              <button
                type="button"
                onClick={() => onChooseActivity('walk')}
                aria-label="もりであそぶ"
                className={`bg-emerald-50 hover:bg-emerald-100/80 border-4 border-emerald-300 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-sm min-h-[110px] ${
                  reducedMotion ? '' : 'animate-float'
                }`}
                style={reducedMotion ? {} : { animationDelay: '0s' }}
              >
                <span className="text-4xl">🌲</span>
                <span className="text-xs font-black text-emerald-800">もりであそぶ</span>
              </button>

              {/* 選択 2: さんすうをする */}
              <button
                type="button"
                onClick={() => onChooseActivity('math')}
                aria-label="さんすうをする"
                className={`bg-amber-50 hover:bg-amber-100/80 border-4 border-amber-300 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-sm min-h-[110px] ${
                  reducedMotion ? '' : 'animate-float'
                }`}
                style={reducedMotion ? {} : { animationDelay: '0.4s' }}
              >
                <span className="text-4xl">🍎</span>
                <span className="text-xs font-black text-amber-800">さんすうをする</span>
              </button>

              {/* 選択 3: もじをなぞる */}
              <button
                type="button"
                onClick={() => onChooseActivity('tracing')}
                aria-label="もじをなぞる"
                className={`bg-sky-50 hover:bg-sky-100/80 border-4 border-sky-300 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-sm min-h-[110px] ${
                  reducedMotion ? '' : 'animate-float'
                }`}
                style={reducedMotion ? {} : { animationDelay: '0.8s' }}
              >
                <span className="text-4xl">✍️</span>
                <span className="text-xs font-black text-sky-800">もじをなぞる</span>
              </button>
            </div>

            {/* 退避オプション */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => onChooseActivity('later')}
                aria-label="あとで えらぶ"
                className="text-sm font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer transition-colors active:scale-95 py-2 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                あとで えらぶ (もりにはいる)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* おしまいモーダル */}
      {showGoodbye && (
        <div className="absolute inset-0 bg-slate-900/40 rounded-2xl flex items-center justify-center z-50 animate-fadeIn backdrop-blur-xs">
          <div className="bg-white border-8 border-emerald-300 p-8 rounded-3xl text-center space-y-4 max-w-xs animate-scaleUp shadow-2xl">
            <span className="text-6xl block">🌲💤</span>
            <h3 className="text-2xl font-black text-emerald-600">きょうは おしまい</h3>
            <p className="text-sm font-bold text-slate-500 leading-relaxed">
              よくがんばったね！<br/>またあした 森であそぼうね！
            </p>
            <button
              onClick={() => setShowGoodbye(false)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-6 min-h-[48px] rounded-xl border-b-4 border-emerald-800 active:translate-y-[2px] active:border-b-2 text-sm"
            >
              ひろばに もどる
            </button>
          </div>
        </div>
      )}

      {/* ヘッダーエリア: タイトルとテーマ変更 */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-emerald-100 pb-4">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl md:text-3xl font-black text-emerald-600 flex items-center gap-1 justify-center sm:justify-start">
            <span>🌲</span> もりの ひろば <span>🏡</span>
          </h2>
          <p className="text-xs text-slate-400 font-bold mt-1">
            もりのひろばへようこそ！あそぶクエストをえらんでね。
          </p>
        </div>

        {/* 設定・テーマ選択エリア */}
        <div className="flex flex-wrap items-center gap-2.5 justify-center sm:justify-end">
          {/* うごきをとめる（刺激少なめ）設定 */}
          <label className="flex items-center gap-1.5 bg-emerald-50/50 hover:bg-emerald-100 p-2 rounded-2xl border border-emerald-100 cursor-pointer select-none text-[10px] font-black text-emerald-700 transition-colors shadow-xs">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => {
                playSoundEffect('tap');
                onChangeReducedMotion(e.target.checked);
              }}
              className="accent-emerald-500 w-3.5 h-3.5 rounded cursor-pointer"
            />
            <span>うごきを とめる</span>
          </label>

          {/* きせつ切り替え */}
          <div className="flex items-center gap-1.5 bg-emerald-50/50 p-2 rounded-2xl border border-emerald-100 shadow-xs">
            <span className="text-[10px] font-black text-emerald-700 sm:block hidden">きせつ：</span>
            <select
              value={seasonMode}
              onChange={(e) => {
                playSoundEffect('tap');
                onChangeSeason(e.target.value as 'auto' | Season);
              }}
              className="bg-white border border-emerald-200 text-[10px] font-black text-emerald-800 rounded-lg px-1.5 py-0.5 cursor-pointer outline-none focus:ring-1 focus:ring-emerald-400"
            >
              <option value="auto">📅 じどう</option>
              <option value="spring">🌸 はる</option>
              <option value="summer">🌻 なつ</option>
              <option value="autumn">🍁 あき</option>
              <option value="winter">❄️ ふゆ</option>
            </select>
          </div>

          {/* テーマカラー切り替え */}
          <div className="flex items-center gap-2 bg-emerald-50/50 p-2 rounded-2xl border border-emerald-100 shadow-xs">
            <span className="text-[10px] font-black text-emerald-700 sm:block hidden">テーマ色：</span>
            <div className="flex gap-1.5">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => onChangeTheme(t.id)}
                  className={`w-6 h-6 rounded-full border-2 transition-all active:scale-95 flex items-center justify-center cursor-pointer ${t.dot} ${
                    themeId === t.id ? 'border-emerald-500 scale-110 shadow-sm' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                  title={t.name}
                >
                  {themeId === t.id && (
                    <span className="text-[10px] text-white font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 広場エリア (中景) */}
      <div className={`w-full ${seasonConfig.bgClass} border-4 ${seasonConfig.borderClass} rounded-3xl p-5 relative overflow-hidden h-40 flex flex-col justify-end shadow-inner`}>
        {/* 舞い散るパーティクルエフェクト (reducedMotion がオフのときのみ表示) */}
        {!reducedMotion && PARTICLES.map((p, i) => (
          <div
            key={`particle-${i}`}
            className="absolute pointer-events-none select-none text-xl animate-fall z-20"
            style={{
              left: p.left,
              top: '-20px',
              animationDelay: p.delay,
              animationDuration: p.duration,
              transform: `scale(${p.scale}) rotate(${p.rotation}deg)`,
            }}
          >
            {seasonConfig.particleEmoji}
          </div>
        ))}

        {/* 背景装飾（隠し探索要素：タップすると wiggle 揺れる） */}
        {seasonConfig.decorations.map((emoji, i) => {
          const positions = [
            'top-2 left-4 text-3xl',
            'top-4 right-8 text-2xl',
            'top-1 left-1/3 text-xl',
            'top-3 right-1/3 text-2xl'
          ];
          const isTriggered = decorTrigger[i];
          const wiggleClass = isTriggered ? 'animate-wiggle' : '';
          
          return (
            <button
              key={`decor-${i}`}
              onClick={() => handleDecorTap(i)}
              type="button"
              aria-label="もりの かざりを さわる"
              className={`absolute ${positions[i]} select-none cursor-pointer filter drop-shadow-xs active:scale-95 transition-transform duration-100 hover:scale-110 z-20 outline-none border-none bg-transparent ${wiggleClass}`}
              title="タップしてみてね！"
            >
              {emoji}
            </button>
          );
        })}

        {/* かざりつけモード切り替えボタン */}
        <button
          onClick={() => {
            playSoundEffect('tap');
            setIsDecorating(!isDecorating);
            if (!isDecorating) {
              setSelectedSpot('spot2'); // 真ん中をデフォルトに選択
            } else {
              setSelectedSpot(null);
            }
          }}
          className={`absolute top-2 right-2 px-3 py-1.5 rounded-full text-xs font-black shadow-sm border cursor-pointer active:translate-y-[1px] transition-all z-30 ${
            isDecorating
              ? 'bg-amber-400 border-amber-500 text-amber-950 hover:bg-amber-500 animate-pulse'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          {isDecorating ? '✓ おわる' : '🔨 かざりつけ'}
        </button>

        {/* --- 家具配置スポット (かざりつけ) --- */}
        {/* Spot 1: Left */}
        <button
          onClick={() => isDecorating && handleSpotClick('spot1')}
          disabled={!isDecorating}
          className={`absolute left-[12%] bottom-[12px] transition-all flex items-center justify-center select-none ${
            isDecorating
              ? `w-14 h-14 rounded-2xl border-4 border-dashed z-20 cursor-pointer ${
                  selectedSpot === 'spot1'
                    ? 'border-yellow-400 bg-yellow-100/60 shadow-md scale-110 animate-pulse'
                    : 'border-emerald-600 bg-emerald-100/30 hover:border-emerald-700 hover:bg-emerald-100/50'
                }`
              : 'pointer-events-none w-14 h-14'
          }`}
        >
          {placedFurniture.spot1 ? (
            <span className="text-4xl filter drop-shadow-sm select-none">
              {FURNITURE_LIST.find(f => f.id === placedFurniture.spot1)?.emoji}
            </span>
          ) : (
            isDecorating && <span className="text-emerald-700 font-black text-[9px] leading-tight text-center select-none">✨ここに<br/>おく</span>
          )}
        </button>

        {/* Spot 2: Center */}
        <button
          onClick={() => isDecorating && handleSpotClick('spot2')}
          disabled={!isDecorating}
          className={`absolute left-[50%] -translate-x-1/2 bottom-[16px] transition-all flex items-center justify-center select-none ${
            isDecorating
              ? `w-14 h-14 rounded-2xl border-4 border-dashed z-20 cursor-pointer ${
                  selectedSpot === 'spot2'
                    ? 'border-yellow-400 bg-yellow-100/60 shadow-md scale-110 animate-pulse'
                    : 'border-emerald-600 bg-emerald-100/30 hover:border-emerald-700 hover:bg-emerald-100/50'
                }`
              : 'pointer-events-none w-14 h-14'
          }`}
        >
          {placedFurniture.spot2 ? (
            <span className="text-4xl filter drop-shadow-sm select-none">
              {FURNITURE_LIST.find(f => f.id === placedFurniture.spot2)?.emoji}
            </span>
          ) : (
            isDecorating && <span className="text-emerald-700 font-black text-[9px] leading-tight text-center select-none">✨ここに<br/>おく</span>
          )}
        </button>

        {/* Spot 3: Right */}
        <button
          onClick={() => isDecorating && handleSpotClick('spot3')}
          disabled={!isDecorating}
          className={`absolute left-[88%] -translate-x-1/2 bottom-[12px] transition-all flex items-center justify-center select-none ${
            isDecorating
              ? `w-14 h-14 rounded-2xl border-4 border-dashed z-20 cursor-pointer ${
                  selectedSpot === 'spot3'
                    ? 'border-yellow-400 bg-yellow-100/60 shadow-md scale-110 animate-pulse'
                    : 'border-emerald-600 bg-emerald-100/30 hover:border-emerald-700 hover:bg-emerald-100/50'
                }`
              : 'pointer-events-none w-14 h-14'
          }`}
        >
          {placedFurniture.spot3 ? (
            <span className="text-4xl filter drop-shadow-sm select-none">
              {FURNITURE_LIST.find(f => f.id === placedFurniture.spot3)?.emoji}
            </span>
          ) : (
            isDecorating && <span className="text-emerald-700 font-black text-[9px] leading-tight text-center select-none">✨ここに<br/>おく</span>
          )}
        </button>

        {/* なかま動物歩行表示 */}
        <CompanionWalker
          unlockedRewards={unlockedRewards}
          reducedMotion={reducedMotion}
          onPlaySound={playSoundEffect}
          isDecorating={isDecorating}
          season={currentSeason}
        />

        {/* 地面 */}
        <div className={seasonConfig.groundClass} />
      </div>

      {/* かざりつけ用家具選択ツールボックス（おすすめカードと排他） */}
      {isDecorating ? (
        <div className="w-full bg-emerald-50 border-4 border-emerald-200 rounded-3xl p-4 flex flex-col gap-3 animate-scaleUp">
          <div className="flex justify-between items-center border-b border-emerald-100 pb-2 flex-wrap gap-2">
            <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
              <span>🔨</span> かざりつけする スポットを タップしてえらんでね
            </span>
            <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2.5 py-0.5 rounded-full select-none">
              {selectedSpot === 'spot1' ? '👈 ひだり' : selectedSpot === 'spot2' ? '⭐ まんなか' : selectedSpot === 'spot3' ? '👉 みぎ' : 'えらんでね'} をえらんでいるよ
            </span>
          </div>

          {/* 家具アイテムリスト */}
          <div className="flex gap-3 overflow-x-auto py-2 px-1 scrollbar-thin">
            {/* かたづけるボタン */}
            <button
              onClick={() => {
                if (!selectedSpot) return;
                playSoundEffect('tap');
                setPlacedFurniture(prev => ({ ...prev, [selectedSpot]: null }));
              }}
              disabled={!selectedSpot || !placedFurniture[selectedSpot]}
              className={`flex-shrink-0 bg-white border-2 border-slate-200 p-2.5 rounded-2xl flex flex-col items-center justify-center min-w-[76px] shadow-sm transition-all ${
                !selectedSpot || !placedFurniture[selectedSpot]
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:border-rose-300 hover:bg-rose-50 cursor-pointer active:scale-95'
              }`}
            >
              <span className="text-2xl">📦</span>
              <span className="text-[10px] font-black text-slate-500 mt-1">かたづける</span>
            </button>

            {/* 各家具アイテム */}
            {FURNITURE_LIST.map(f => {
              const isUnlocked = unlockedRewards.includes(f.requiredReward);
              const isSelected = selectedSpot ? placedFurniture[selectedSpot] === f.id : false;

              if (!isUnlocked) {
                return (
                  <div
                    key={f.id}
                    className="flex-shrink-0 bg-slate-100 border-2 border-slate-200 p-2.5 rounded-2xl flex flex-col items-center justify-center min-w-[76px] opacity-40 select-none"
                    title={`${f.requiredReward} が なかまになると 解放されます`}
                  >
                    <span className="text-2xl filter grayscale">❓</span>
                    <span className="text-[9px] font-bold text-slate-400 mt-1">ひみつ</span>
                  </div>
                );
              }

              return (
                <button
                  key={f.id}
                  onClick={() => {
                    if (!selectedSpot) return;
                    playSoundEffect('tap');
                    setPlacedFurniture(prev => ({ ...prev, [selectedSpot]: f.id }));
                  }}
                  disabled={!selectedSpot}
                  className={`flex-shrink-0 bg-white border-2 p-2.5 rounded-2xl flex flex-col items-center justify-center min-w-[76px] shadow-sm transition-all ${
                    !selectedSpot
                      ? 'opacity-40 cursor-not-allowed'
                      : isSelected
                        ? 'border-emerald-500 ring-4 ring-emerald-200 bg-emerald-50/50 scale-105 cursor-pointer font-black'
                        : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50 cursor-pointer active:scale-95'
                  }`}
                  title={f.desc}
                >
                  <span className="text-3xl filter drop-shadow-sm">{f.emoji}</span>
                  <span className="text-[9px] font-black text-slate-700 mt-1 truncate max-w-[68px]">
                    {f.name}
                  </span>
                </button>
              );
            })}
          </div>
          
          {!selectedSpot && (
            <p className="text-[10px] font-extrabold text-rose-500 text-center animate-pulse">
              ⚠️ 広場の「かざりつけしたい スポット（点線）」を タップして選んでね！
            </p>
          )}
        </div>
      ) : (
        /* 今日のおすすめ (CTA) */
        <div
          onClick={() => onSelectStageById(recommendedStageId)}
          className="w-full bg-amber-50 hover:bg-amber-100 border-4 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-4 cursor-pointer transition-all active:scale-[0.99] shadow-sm animate-pulse"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍎</span>
            <div>
              <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase">
                きょうのおすすめ
              </span>
              <p className="text-sm font-black text-amber-800 mt-1">
                ステージ {recommendedStageId} : 「{recommendedStageName}」であそぼう！
              </p>
            </div>
          </div>
          <span className="text-amber-500 font-extrabold text-xl">➔</span>
        </div>
      )}

      {/* 教科カードグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* さんすうカード */}
        <div
          onClick={onGoPlayMap}
          className="bg-emerald-50 hover:bg-emerald-100 border-4 border-emerald-300 rounded-2xl p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all active:scale-[0.98] shadow-md group relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 text-4xl opacity-10 group-hover:scale-110 transition-transform">➕</div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-emerald-800 flex items-center gap-1.5">
              <span>⚔️</span> さんすうクエスト
            </h3>
            <p className="text-xs text-emerald-700 font-bold leading-relaxed">
              ごうせい・10づくり・ひきざん！くだものキングダムをすくう ぼうけんにでよう！
            </p>
          </div>
          <div className="flex justify-between items-center border-t border-emerald-200/50 pt-2 mt-2">
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
              {unlockedStageId > STAGES.length ? 'ぜんぶクリア！' : `ステージ ${unlockedStageId} まで解放中`}
            </span>
            <span className="text-emerald-600 font-black text-sm group-hover:translate-x-1 transition-transform">
              すすむ ➔
            </span>
          </div>
        </div>

        {/* こくごカード */}
        <div
          onClick={handleKokugoClick}
          className="bg-sky-50 hover:bg-sky-100 border-4 border-sky-300 rounded-2xl p-5 flex flex-col justify-between gap-4 cursor-pointer active:scale-[0.98] transition-all group relative overflow-hidden shadow-md"
        >
          <div className="absolute top-2 right-2 text-4xl opacity-10 group-hover:scale-110 transition-transform">✏️</div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-sky-800 flex items-center gap-1.5">
              <span>✏️</span> こくごクエスト
            </h3>
            <p className="text-xs text-sky-700 font-bold leading-relaxed">
              ひらがなをなぞって、もじのかきかたをれんしゅうするよ。
            </p>
          </div>
          <div className="flex justify-between items-center border-t border-sky-200/50 pt-2 mt-2">
            <span className="text-[10px] font-black text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">
              「し」をれんしゅう ✍️
            </span>
            <span className="text-sky-600 font-black text-sm group-hover:translate-x-1 transition-transform">
              すすむ ➔
            </span>
          </div>
        </div>
      </div>

      {/* フッターアクション: おしまいボタン */}
      <div className="flex justify-center border-t border-slate-100 pt-4 mt-2">
        <button
          onClick={() => { playSoundEffect('tap'); setShowGoodbye(true); }}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-6 py-2.5 rounded-2xl border-b-4 border-slate-300 transition-all active:translate-y-[2px] active:border-b-2 text-sm cursor-pointer"
        >
          <span>🚪</span>
          きょうは おしまいにする
        </button>
      </div>

    </div>
  );
};


// --- 2. マップ画面 ---
interface MapScreenProps {
  unlockedStageId: number;
  onSelectStage: (stage: Stage) => void;
  onResetProgress: () => void;
}

const MapScreen: React.FC<MapScreenProps> = ({ unlockedStageId, onSelectStage, onResetProgress }) => {
  return (
    <div className="w-full max-w-2xl bg-white border-8 border-amber-300 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-6 my-4">
      <div className="text-center space-y-1">
        <h3 className="text-xl md:text-2xl font-black text-amber-700 flex items-center justify-center gap-2">
          <Map className="w-6 h-6 text-emerald-500" />
          ぼうけんの マップ
        </h3>
        <p className="text-xs font-bold text-slate-400">
          ステージをクリアして、さんすうキングをたおそう！
        </p>
      </div>

      <div className="w-full bg-[#EAF7FF] border-4 border-dashed border-sky-300 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-2 lg:gap-4 relative overflow-hidden">
        {STAGES.map((stage, idx) => {
          const isUnlocked = stage.id <= unlockedStageId;
          const isCurrent = stage.id === unlockedStageId;
          
          return (
            <div key={stage.id} className="flex flex-col items-center relative z-10 w-full md:w-[86px] lg:w-[96px]">
              <button
                onClick={() => onSelectStage(stage)}
                disabled={!isUnlocked}
                className={`w-16 h-16 md:w-16 md:h-16 lg:w-18 lg:h-18 rounded-full border-4 shadow-lg transition-all flex flex-col items-center justify-center relative ${
                  isCurrent 
                    ? 'bg-amber-400 border-amber-500 scale-110 animate-bounce' 
                    : isUnlocked 
                      ? 'bg-white border-emerald-600 hover:bg-emerald-50' 
                      : 'bg-slate-300 border-slate-400 cursor-not-allowed'
                }`}
              >
                {stage.type === 'boss' ? (
                  <span className={`text-3xl md:text-3xl lg:text-4xl ${!isUnlocked ? 'filter grayscale opacity-50' : ''}`}>😈</span>
                ) : (
                  <span className={`text-3xl md:text-3xl lg:text-4xl ${!isUnlocked ? 'filter grayscale opacity-50' : ''}`}>{stage.reward.emoji}</span>
                )}

                <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow">
                  {stage.id}
                </span>
              </button>

              <div className="text-center mt-2 w-full">
                <span className={`text-[10px] md:text-xs font-black block tracking-tighter break-words leading-tight ${isUnlocked ? 'text-slate-700' : 'text-slate-400'}`}>
                  {stage.jpName}
                </span>
                <span className="text-[9px] text-amber-500 font-extrabold block">
                  {stage.difficulty}
                </span>
              </div>

              {idx < STAGES.length - 1 && (
                <div className="hidden md:block absolute top-5 lg:top-6 right-[-10px] md:right-[-12px] lg:right-[-16px] text-sky-400 font-black text-lg pointer-events-none">
                  ➔
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4 text-left">
        <span className="text-2xl animate-bounce">💡</span>
        <p className="text-xs md:text-sm font-bold text-amber-900 leading-relaxed">
          クリアすると、うしろにいる**なかまのどうぶつ**がずかんにはいるよ！<br/>
          最後の「さんすうキング」を倒すと、伝説のドラゴンがなかまになるぞ！
        </p>
      </div>

      {unlockedStageId > 1 && (
        <button
          onClick={onResetProgress}
          className="text-xs font-black text-rose-400 hover:text-rose-600 transition-colors cursor-pointer mt-2 underline"
        >
          データをクリアして、はじめからあそぶ ➔
        </button>
      )}
    </div>
  );
};

// --- 3. ずかん画面 ---
interface ZukanScreenProps {
  unlockedRewards: string[];
  onGoBack: () => void;
}

const ZukanScreen: React.FC<ZukanScreenProps> = ({ unlockedRewards, onGoBack }) => {
  return (
    <div className="w-full max-w-lg bg-white border-8 border-pink-300 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-6 my-4 animate-fadeIn">
      <h2 className="text-2xl md:text-3xl font-black text-pink-600 flex items-center gap-2 select-none">
        <BookOpen className="w-7 h-7" />
        なかま ずかん
      </h2>

      <div className="grid grid-cols-2 gap-4 w-full">
        {STAGES.map((stage) => {
          const isUnlocked = unlockedRewards.includes(stage.reward.name);
          return (
            <div 
              key={stage.id} 
              className={`border-4 rounded-2xl p-3 flex flex-col items-center text-center gap-1 relative ${
                isUnlocked ? 'border-pink-200 bg-pink-50/50' : 'border-dashed border-slate-200 bg-slate-50'
              }`}
            >
              <span className={`text-4xl md:text-5xl ${isUnlocked ? '' : 'filter grayscale opacity-20'}`}>
                {isUnlocked ? stage.reward.emoji : '❓'}
              </span>
              <h3 className="font-black text-sm">
                {isUnlocked ? stage.reward.name : '？？？？'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold leading-tight">
                {isUnlocked ? stage.reward.desc : 'ステージをクリアすると なかまになるよ。'}
              </p>
            </div>
          );
        })}
      </div>

      <button
        onClick={onGoBack}
        className="bg-pink-500 hover:bg-pink-600 text-white font-black text-base md:text-lg py-2.5 px-8 rounded-2xl border-b-4 border-pink-700 transition-all active:translate-y-[2px] active:border-b-2"
      >
        マップにもどる ➔
      </button>
    </div>
  );
};

// --- 4. ステージクリア報酬画面 ---
interface StageClearScreenProps {
  stage: Stage;
  onContinue: () => void;
}

const StageClearScreen: React.FC<StageClearScreenProps> = ({ stage, onContinue }) => {
  return (
    <div className="bg-white border-8 border-emerald-300 rounded-3xl p-8 shadow-2xl w-full max-w-md text-center flex flex-col items-center gap-6 my-4 animate-scaleUp">
      <div className="relative">
        <Trophy className="w-20 h-20 text-yellow-400 fill-yellow-100 animate-bounce" />
        <Sparkles className="absolute top-0 right-0 w-8 h-8 text-amber-400 animate-ping" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-black text-emerald-600">ステージクリア！</h2>
        <p className="text-base font-bold text-slate-500">
          よくがんばったね！なかまがふえたよ！
        </p>
      </div>

      <div className="bg-emerald-50 rounded-2xl p-5 border-4 border-dashed border-emerald-300 w-full flex flex-col items-center gap-3">
        <span className="text-6xl md:text-7xl animate-pulse">{stage.reward.emoji}</span>
        <h3 className="text-xl md:text-2xl font-black text-emerald-800">「{stage.reward.name}」</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-bold">
          {stage.reward.desc}
        </p>
      </div>

      <button
        onClick={onContinue}
        className="w-full bg-emerald-500 hover:bg-emerald-600 border-b-8 border-emerald-700 text-white text-xl md:text-2xl py-3.5 rounded-2xl shadow-xl transition-all active:translate-y-[4px] active:border-b-2 flex items-center justify-center gap-2"
      >
        ぼうけんを つづける！
      </button>
    </div>
  );
};


// ============================================================================
// ■ SECTION 6: MAIN APP (全体統括、ルーティング、状態管理)
// ============================================================================

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

function getSeason(month: number): Season {
  if (month >= 2 && month <= 4) return 'spring'; // 3, 4, 5月
  if (month >= 5 && month <= 7) return 'summer'; // 6, 7, 8月
  if (month >= 8 && month <= 10) return 'autumn'; // 9, 10, 11月
  return 'winter'; // 12, 1, 2月
}

const isSeasonMode = (value: unknown): value is 'auto' | Season =>
  value === 'auto' ||
  value === 'spring' ||
  value === 'summer' ||
  value === 'autumn' ||
  value === 'winter';

export default function App() {
  const [screen, setScreen] = useState<'title' | 'home' | 'map' | 'play_synthesis' | 'play_make10' | 'play_subtraction' | 'play_boss' | 'play_cat_split' | 'play_tracing' | 'stage_clear' | 'all_clear' | 'zukan' | 'report'>('title');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  const [seasonMode, setSeasonMode] = useState<'auto' | Season>(() => {
    try {
      const saved = localStorage.getItem('sansu_quest_season');
      return isSeasonMode(saved) ? saved : 'auto';
    } catch {
      return 'auto';
    }
  });

  const [themeId, setThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem('sansu_quest_theme') || 'cream';
    } catch {
      return 'cream';
    }
  });

  const [todayChoiceMade, setTodayChoiceMade] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sansu_quest_today_choice_made_' + getTodayDateString());
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('hinata_reduced_motion');
      if (saved !== null) {
        return saved === 'true';
      }
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem('sansu_quest_activity_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse activity logs:', e);
    }
    return [];
  });

  const [completedHiragana, setCompletedHiragana] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sansu_quest_completed_hiragana');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse completed hiragana:', e);
    }
    return [];
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [parentEmail, setParentEmail] = useState<string>('');
  const [parentPassword, setParentPassword] = useState<string>('');
  const [parentAuthError, setParentAuthError] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');
  const [syncStatus, setSyncStatus] = useState<'cloud' | 'local' | 'syncing'>('cloud');

  // ぼうけん進捗
  const [unlockedStageId, setUnlockedStageId] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sansu_quest_unlocked_stage_id');
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 1 && num <= STAGES.length + 1) return num;
      }
    } catch (e) {
      console.error('Failed to parse saved unlockedStageId:', e);
    }
    return 1;
  });

  const [unlockedRewards, setUnlockedRewards] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sansu_quest_unlocked_rewards');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved unlockedRewards:', e);
    }
    return [];
  });

  // 学習履歴 (レポート用)
  const [history, setHistory] = useState<AnswerRecord[]>(() => {
    try {
      const saved = localStorage.getItem('sansu_quest_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved history:', e);
    }
    return [];
  });
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);

  // 今日のがんばり時間（秒数）
  const [activeTimeToday, setActiveTimeToday] = useState<number>(() => {
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const savedTime = localStorage.getItem(`sansu_quest_active_time_${dateStr}`);
      if (savedTime) {
        const parsed = parseInt(savedTime, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse active time:', e);
    }
    return 0;
  });

  // 家具配置状態
  const [placedFurniture, setPlacedFurniture] = useState<Record<string, string | null>>(() => {
    try {
      const saved = localStorage.getItem('sansu_quest_placed_furniture');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            spot1: parsed.spot1 || null,
            spot2: parsed.spot2 || null,
            spot3: parsed.spot3 || null,
          };
        }
      }
    } catch (e) {
      console.error('Failed to parse saved placedFurniture:', e);
    }
    return { spot1: null, spot2: null, spot3: null };
  });
  const [isDecorating, setIsDecorating] = useState<boolean>(false);
  const [selectedSpot, setSelectedSpot] = useState<'spot1' | 'spot2' | 'spot3' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sansu_quest_speech_rate');
      if (saved) {
        const rate = parseFloat(saved);
        if (!isNaN(rate)) {
          globalSpeechRate = rate;
          return rate;
        }
      }
    } catch {
      // Ignored
    }
    return 1.15;
  });

  // ステージ内部状態
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [totalSteps, setTotalSteps] = useState<number>(5);
  const [starResults, setStarResults] = useState<boolean[]>([]);
  
  // モード1 (合成) 状態
  const [synQuestion, setSynQuestion] = useState<SynthesisQuestion | null>(null);
  const [isMerged, setIsMerged] = useState<boolean>(false);
  const [countedCount, setCountedCount] = useState<number>(0);
  const [isCounting, setIsCounting] = useState<boolean>(false);
  const [synAnswer, setSynAnswer] = useState<number | null>(null);
  const [synResult, setSynResult] = useState<'correct' | 'wrong' | null>(null);
  const [synAttempt, setSynAttempt] = useState<number>(0);

  // モード2 (make10) 状態
  const [m10Question, setM10Question] = useState<Make10Question | null>(null);
  const [m10Added, setM10Added] = useState<number>(0);
  const [m10Result, setM10Result] = useState<'correct' | 'wrong' | null>(null);
  const [m10Attempt, setM10Attempt] = useState<number>(0);

  // モード3 (ひきざん) 状態
  const [subQuestion, setSubQuestion] = useState<SubtractionQuestion | null>(null);
  const [isSubtracted, setIsSubtracted] = useState<boolean>(false);
  const [subAnswer, setSubAnswer] = useState<number | null>(null);
  const [subResult, setSubResult] = useState<'correct' | 'wrong' | null>(null);
  const [subAttempt, setSubAttempt] = useState<number>(0);

  // ボス戦状態
  const [bossHp, setBossHp] = useState<number>(100);
  const [bossDmgAnim, setBossDmgAnim] = useState<boolean>(false);
  const [bossQuestType, setBossQuestType] = useState<'synthesis' | 'make10' | 'subtraction'>('synthesis');

  // オーディオアンロック処理 (ユーザー操作時に呼び出し)
  const unlockAudio = async () => {
    const ctx = getAudioContext(true);
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }
    setAudioUnlocked(true);
  };

  const logActivity = (message: string) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const newLog: ActivityLog = {
      id: `${getNow()}-${Math.floor(getRandom() * 1000)}`,
      timestamp: getNow(),
      date: dateStr,
      message
    };
    setActivityLogs(prev => [newLog, ...prev]);
  };

  // Firestore へのセーブ処理
  const saveToCloud = async (uid: string, stageId: number, rewards: string[], hist: AnswerRecord[], logs: ActivityLog[], furniture: Record<string, string | null>, hiragana: string[]) => {
    setSyncStatus('syncing');

    let isFinished = false;
    const timeoutId = setTimeout(() => {
      if (!isFinished) {
        setSyncStatus('local');
      }
    }, 2500); // 2.5s visual indicator fallback

    try {
      const setDocPromise = setDoc(doc(db, 'users', uid), {
        unlockedStageId: stageId,
        unlockedRewards: rewards,
        history: hist,
        activityLogs: logs,
        placedFurniture: furniture,
        completedHiragana: hiragana,
        updatedAt: getNow()
      });
      const setDocTimeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout syncing progress to Firestore')), 5000)
      );
      await Promise.race([setDocPromise, setDocTimeoutPromise]);

      isFinished = true;
      clearTimeout(timeoutId);
      setSyncStatus('cloud');
    } catch (e) {
      console.warn('Failed to sync to Cloud Firestore:', e);
      isFinished = true;
      clearTimeout(timeoutId);
      setSyncStatus('local');
    }
  };

  // Firebase 認証の監視と自動匿名ログイン
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setAuthLoading(true);
        setSyncStatus('local');
        try {
          const signPromise = signInAnonymously(auth);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout signing in anonymously')), 3000)
          );
          await Promise.race([signPromise, timeoutPromise]);
        } catch (e) {
          console.error('Failed to sign in anonymously:', e);
          setAuthLoading(false);
        }
      } else {
        setUser(currentUser);
        setSyncStatus('syncing');
        // クラウドから progress をロード
        try {
          const getDocPromise = getDoc(doc(db, 'users', currentUser.uid));
          const getDocTimeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout loading progress from Firestore')), 3000)
          );
          const userDoc = await Promise.race([getDocPromise, getDocTimeoutPromise]);

          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.unlockedStageId) {
              setUnlockedStageId(data.unlockedStageId);
            }
            if (data.unlockedRewards) {
              setUnlockedRewards(data.unlockedRewards);
            }
            if (data.history) {
              setHistory(data.history);
            }
            if (data.activityLogs && Array.isArray(data.activityLogs)) {
              setActivityLogs(data.activityLogs);
            }
            if (data.placedFurniture) {
              setPlacedFurniture(data.placedFurniture);
            }
            if (data.completedHiragana && Array.isArray(data.completedHiragana)) {
              setCompletedHiragana(data.completedHiragana);
            }
          } else {
            // 新しいユーザーならローカルの進捗を初回アップロード
            const setDocPromise = setDoc(doc(db, 'users', currentUser.uid), {
              unlockedStageId,
              unlockedRewards,
              history,
              activityLogs,
              placedFurniture,
              completedHiragana,
              updatedAt: getNow()
            });
            const setDocTimeoutPromise = new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout uploading initial progress')), 3000)
            );
            await Promise.race([setDocPromise, setDocTimeoutPromise]);
          }
          setSyncStatus('cloud');
        } catch (e) {
          console.warn('Failed to load progress from Cloud Firestore:', e);
          setSyncStatus('local');
        }
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // セーブ処理 (進捗変化時)
  useEffect(() => {
    try {
      localStorage.setItem('sansu_quest_unlocked_stage_id', unlockedStageId.toString());
      localStorage.setItem('sansu_quest_unlocked_rewards', JSON.stringify(unlockedRewards));
      localStorage.setItem('sansu_quest_history', JSON.stringify(history));
      localStorage.setItem('sansu_quest_theme', themeId);
      localStorage.setItem('sansu_quest_activity_logs', JSON.stringify(activityLogs));
      localStorage.setItem('sansu_quest_placed_furniture', JSON.stringify(placedFurniture));
      localStorage.setItem('sansu_quest_completed_hiragana', JSON.stringify(completedHiragana));
    } catch (e) {
      console.error('Failed to save progress:', e);
    }

    if (!user) return;

    const uid = user.uid;
    const timer = setTimeout(() => {
      saveToCloud(uid, unlockedStageId, unlockedRewards, history, activityLogs, placedFurniture, completedHiragana);
    }, 500); // 500ms debounce to avoid rapid writes and resolve React synchronous setState-in-effect warning

    return () => clearTimeout(timer);
  }, [unlockedStageId, unlockedRewards, history, themeId, activityLogs, placedFurniture, completedHiragana, user]);

  // うごきを少なくする設定保存
  useEffect(() => {
    try {
      localStorage.setItem('hinata_reduced_motion', reducedMotion.toString());
    } catch (e) {
      console.error('Failed to save reducedMotion:', e);
    }
  }, [reducedMotion]);

  // 季節設定保存
  useEffect(() => {
    try {
      localStorage.setItem('sansu_quest_season', seasonMode);
    } catch (e) {
      console.error('Failed to save seasonMode:', e);
    }
  }, [seasonMode]);


  // がんばり時間のタイマー
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hasFocus()) {
        setActiveTimeToday(prev => {
          const newTime = prev + 1;
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          try {
            localStorage.setItem(`sansu_quest_active_time_${dateStr}`, String(newTime));
          } catch (e) {
            console.error('Failed to save active time:', e);
          }
          return newTime;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 効果音の有効状態をグローバル同期する
  useEffect(() => {
    globalSoundEnabled = soundEnabled;
  }, [soundEnabled]);

  // 音声読み上げスピードの同期
  useEffect(() => {
    globalSpeechRate = speechRate;
    try {
      localStorage.setItem('sansu_quest_speech_rate', speechRate.toString());
    } catch {
      // Ignored
    }
  }, [speechRate]);

  // BGM 音源管理の自動制御
  useEffect(() => {
    if (!soundEnabled || !audioUnlocked) {
      stopBgm();
      return;
    }

    let bgmType: 'title' | 'play' | 'boss';
    if (screen === 'title' || screen === 'map' || screen === 'zukan') {
      bgmType = 'title';
    } else if (screen === 'play_boss') {
      bgmType = 'boss';
    } else if (screen === 'play_synthesis' || screen === 'play_make10' || screen === 'play_subtraction') {
      bgmType = 'play';
    } else {
      stopBgm();
      return;
    }

    startBgm(bgmType, soundEnabled && audioUnlocked);
  }, [screen, soundEnabled, audioUnlocked]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopBgm();
    };
  }, []);

  const handleResetProgress = () => {
    const confirmReset = window.confirm("さいしょから やりなおす？（あつめた どうぶつも きえちゃうよ）");
    if (confirmReset) {
      playSoundEffect('wrong');
      setUnlockedStageId(1);
      setUnlockedRewards([]);
      setHistory([]);
      setPlacedFurniture({ spot1: null, spot2: null, spot3: null });
      setCompletedHiragana([]);
      
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      // がんばり時間の初期化
      localStorage.removeItem(`sansu_quest_active_time_${dateStr}`);
      setActiveTimeToday(0);

      // ３択選択状態の初期化
      localStorage.removeItem('sansu_quest_today_choice_made_' + getTodayDateString());
      setTodayChoiceMade(false);

      const initialLog: ActivityLog = {
        id: `${getNow()}-${Math.floor(getRandom() * 1000)}`,
        timestamp: getNow(),
        date: dateStr,
        message: 'がんばり記録と進捗をリセットしました。'
      };
      setActivityLogs([initialLog]);
      speakText("はじめから やりなおすよ！", soundEnabled);
    }
  };

  // がんばりレポート用プロセスメトリクス計算
  const getProcessMetrics = () => {
    if (history.length === 0) {
      return { retryCount: 0, maxAttempts: 0 };
    }

    const chronoHistory = [...history].reverse();
    
    // 1. 各問題ごとの試行回数を集計
    const attemptsMap: Record<string, number> = {};
    chronoHistory.forEach(record => {
      attemptsMap[record.questionText] = (attemptsMap[record.questionText] || 0) + 1;
    });
    
    const attemptsValues = Object.values(attemptsMap);
    const maxAttempts = attemptsValues.length > 0 ? Math.max(...attemptsValues) : 0;

    // 2. まちがえても再挑戦した回数の算出
    const questionSequences: Record<string, boolean[]> = {};
    chronoHistory.forEach(record => {
      if (!questionSequences[record.questionText]) {
        questionSequences[record.questionText] = [];
      }
      questionSequences[record.questionText].push(record.isCorrect);
    });

    let retryCount = 0;
    Object.values(questionSequences).forEach(sequence => {
      for (let i = 0; i < sequence.length - 1; i++) {
        if (sequence[i] === false) {
          retryCount++;
        }
      }
    });

    return { retryCount, maxAttempts };
  };

  const handleGoReport = () => {
    const a = Math.floor(getRandom() * 4) + 6; // 6 to 9
    const b = Math.floor(getRandom() * 4) + 6; // 6 to 9
    const correctAnswer = a * b;
    playSoundEffect('tap');
    const parentAnswer = window.prompt(`【ほごしゃのかたへ】\nかんたんな計算の答えを入力してください。\n\n${a} × ${b} ＝ ？`);
    if (parentAnswer !== null) {
      const parsedAnswer = parseInt(parentAnswer.trim(), 10);
      if (parsedAnswer === correctAnswer) {
        playSoundEffect('correct');
        setIsTransitioning(false);
        setScreen('report');
        speakText("がんばりレポートがひらいたよ", soundEnabled);
      } else {
        playSoundEffect('wrong');
        alert("答えがちがいます。");
      }
    }
  };

  // --- ほごしゃ向け認証アクション ---
  const handleParentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentEmail || !parentPassword) {
      setParentAuthError("メールアドレスとパスワードを入力してください。");
      return;
    }
    if (parentPassword.length < 6) {
      setParentAuthError("パスワードは6文字以上で入力してください。");
      return;
    }

    setIsLinking(true);
    setParentAuthError("");
    try {
      const credential = EmailAuthProvider.credential(parentEmail, parentPassword);
      if (auth.currentUser) {
        await linkWithCredential(auth.currentUser, credential);
        playSoundEffect('correct');
        speakText("クラウドとのどうきが完了しました！", soundEnabled);
        setParentEmail('');
        setParentPassword('');
      } else {
        setParentAuthError("エラーが発生しました。アプリを再起動してください。");
      }
    } catch (error) {
      console.error("Failed to link credential:", error);
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/email-already-in-use') {
        setParentAuthError("このメールアドレスはすでに登録されています。ログインタブからログインしてください。");
      } else if (err.code === 'auth/invalid-email') {
        setParentAuthError("メールアドレスの形式が正しくありません。");
      } else {
        setParentAuthError(`エラー: ${err.message || '不明なエラーが発生しました。'}`);
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentEmail || !parentPassword) {
      setParentAuthError("メールアドレスとパスワードを入力してください。");
      return;
    }

    setIsLinking(true);
    setParentAuthError("");
    try {
      await signInWithEmailAndPassword(auth, parentEmail, parentPassword);
      playSoundEffect('correct');
      speakText("ログインに成功しました。データをロードします。", soundEnabled);
      setParentEmail('');
      setParentPassword('');
    } catch (error) {
      console.error("Failed to sign in:", error);
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setParentAuthError("メールアドレスまたはパスワードがちがいます。");
      } else if (err.code === 'auth/invalid-email') {
        setParentAuthError("メールアドレスの形式が正しくありません。");
      } else {
        setParentAuthError(`エラー: ${err.message || '不明なエラーが発生しました。'}`);
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleParentLogout = async () => {
    const confirmLogout = window.confirm("ログアウトしますか？（ログアウトすると、新しい匿名アカウントが作成されます）");
    if (!confirmLogout) return;

    try {
      await signOut(auth);
      localStorage.removeItem('sansu_quest_unlocked_stage_id');
      localStorage.removeItem('sansu_quest_unlocked_rewards');
      localStorage.removeItem('sansu_quest_history');
      setUnlockedStageId(1);
      setUnlockedRewards([]);
      setHistory([]);
      playSoundEffect('tap');
      speakText("ログアウトしました。", soundEnabled);
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  // 【改善点1解決】未定義のスタート＆リターン動作を安全に登録
  const handleStartGame = async () => {
    await unlockAudio();
    playSoundEffect('tap');
    setIsTransitioning(false);
    setScreen('home');
    speakText("さんすうアドベンチャー！くだものキングダムへようこそ！", soundEnabled);
  };

  const handleChooseActivity = (activity: 'walk' | 'math' | 'tracing' | 'later') => {
    playSoundEffect('tap');
    
    // 選択状態を永続化
    const todayStr = getTodayDateString();
    try {
      localStorage.setItem('sansu_quest_today_choice_made_' + todayStr, 'true');
    } catch (e) {
      console.error('Failed to save today choice:', e);
    }
    setTodayChoiceMade(true);

    if (activity === 'walk') {
      speakText("もりを おさんぽ しよう！", soundEnabled);
      // ホーム（広場）に留まる
    } else if (activity === 'math') {
      speakText("さんすうクエストへ しゅっぱつ！", soundEnabled);
      // さんすうマップへ遷移
      setIsTransitioning(false);
      setScreen('map');
    } else if (activity === 'tracing') {
      speakText("もじなぞり書きへ しゅっぱつ！", soundEnabled);
      // こくごなぞり書きへ遷移
      setIsTransitioning(false);
      setScreen('play_tracing');
    } else if (activity === 'later') {
      speakText("もりのひろばへ いこう！", soundEnabled);
      // ホーム（広場）に留まる
    }
  };

  const handleGoMap = () => {
    playSoundEffect('tap');
    setIsTransitioning(false);
    setScreen('home');
    speakText("つぎは どこへいこうかな？", soundEnabled);
  };

  const handleGoPlayMap = () => {
    playSoundEffect('tap');
    setIsTransitioning(false);
    setScreen('map');
    speakText("ぼうけんマップから、いくところをえらんでね！", soundEnabled);
  };

  // --- 音声切替 ---
  const handleToggleSound = async () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    
    if (nextVal) {
      await unlockAudio();
      playSoundEffect('tap');
      if (screen === 'title') {
        speakText("さんすうアドベンチャー！くだものキングダムへようこそ！", true);
      }
    } else {
      stopBgm();
      window.speechSynthesis.cancel();
      playSoundEffect('tap');
    }
  };

  // --- クエスト進行設定 ---
  const handleSelectStage = (stage: Stage) => {
    // 【改善点4解決】マップの選択時に難易度ロックを検証するガード句を設置
    if (stage.id > unlockedStageId) return;

    playSoundEffect('tap');
    setSelectedStage(stage);
    setCurrentStep(1);
    setStarResults([]);
    setIsTransitioning(false);
    logActivity(`「${stage.jpName}」のぼうけんを開始！`);

    if (stage.type === 'synthesis') {
      setTotalSteps(5);
      setupNextSynthesis(1, stage.maxVal);
      setScreen('play_synthesis');
    } else if (stage.type === 'make10') {
      setTotalSteps(5);
      setupNextMake10(1);
      setScreen('play_make10');
    } else if (stage.type === 'subtraction') {
      setTotalSteps(5);
      setupNextSubtraction(1, stage.maxVal);
      setScreen('play_subtraction');
    } else if (stage.type === 'cat_split') {
      setTotalSteps(5);
      setupNextCatSplit(1);
      setScreen('play_cat_split');
    } else if (stage.type === 'boss') {
      setTotalSteps(10);
      setBossHp(100);
      setupNextBossQuestion(1);
      setScreen('play_boss');
    }
  };

  const handleSelectStageById = (id: number) => {
    const stage = STAGES.find(s => s.id === id);
    if (stage) {
      handleSelectStage(stage);
    }
  };

  // 0.5. ネコちゃんお部屋分け問題セット
  const setupNextCatSplit = (step: number) => {
    setCurrentStep(step);
    setIsTransitioning(false);
  };

  // 1. 合成問題セット
  const setupNextSynthesis = (step: number, maxVal: number) => {
    const q = generateSynthesisQuestion(maxVal);
    setSynQuestion(q);
    setIsMerged(false);
    setCountedCount(0);
    setIsCounting(false);
    setSynAnswer(null);
    setSynResult(null);
    setSynAttempt(0);
    setCurrentStep(step);
    setIsTransitioning(false);

    setTimeout(() => {
      speakText(`ひだりに${q.left}こ、みぎに${q.right}こ。がったいすると、いくつかな？`, soundEnabled);
    }, 450);
  };

  // 2. Make10問題セット
  const setupNextMake10 = (step: number) => {
    const q = generateMake10Question();
    setM10Question(q);
    setM10Added(0);
    setM10Result(null);
    setM10Attempt(0);
    setCurrentStep(step);
    setIsTransitioning(false);

    setTimeout(() => {
      speakText(`10こにするには、あといくつ必要かな？`, soundEnabled);
    }, 450);
  };

  // 4. ひきざん問題セット
  const setupNextSubtraction = (step: number, maxVal: number) => {
    const q = generateSubtractionQuestion(maxVal);
    setSubQuestion(q);
    setIsSubtracted(false);
    setCountedCount(0);
    setIsCounting(false);
    setSubAnswer(null);
    setSubResult(null);
    setSubAttempt(0);
    setCurrentStep(step);
    setIsTransitioning(false);

    setTimeout(() => {
      speakText(`${q.left}こ から ${q.minus}こ ひくと、のこりは いくつかな？`, soundEnabled);
    }, 450);
  };

  // 3. ボス戦問題セット
  const setupNextBossQuestion = (step: number) => {
    const rand = getRandom();
    const questType = rand < 0.33 ? 'synthesis' : rand < 0.66 ? 'make10' : 'subtraction';
    setBossQuestType(questType);
    setCurrentStep(step);
    setSynAnswer(null);
    setSynResult(null);
    setSynAttempt(0);
    setM10Result(null);
    setSubAnswer(null);
    setSubResult(null);
    setSubAttempt(0);
    setIsTransitioning(false);

    if (questType === 'synthesis') {
      const q = generateSynthesisQuestion(10);
      setSynQuestion(q);
      setIsMerged(true); 
      setCountedCount(0);
      setIsCounting(false);
      setTimeout(() => {
        speakText(`${q.left}たす${q.right}は、いくつ？`, soundEnabled);
      }, 400);
    } else if (questType === 'make10') {
      const q = generateMake10Question();
      setM10Question(q);
      setM10Added(0);
      setM10Attempt(0);
      setTimeout(() => {
        speakText(`${q.initial}を10にするには、あといくつかな？`, soundEnabled);
      }, 400);
    } else {
      const q = generateSubtractionQuestion(10);
      setSubQuestion(q);
      setIsSubtracted(true);
      setCountedCount(0);
      setIsCounting(false);
      setTimeout(() => {
        speakText(`${q.left}ひく${q.minus}は、いくつ？`, soundEnabled);
      }, 400);
    }
  };

  // --- 合体合成のコントロール ---
  const handleMerge = () => {
    if (isMerged || !synQuestion) return;
    playSoundEffect('whoosh');
    setIsMerged(true);
    speakText("がったい！あわせていくつになったかな？", soundEnabled);
  };

  const handleStartCounting = () => {
    if (isCounting || !synQuestion) return;
    setIsCounting(true);
    setCountedCount(0);

    let count = 0;
    const total = synQuestion.answer;
    const interval = setInterval(() => {
      count++;
      setCountedCount(count);
      playSoundEffect('pop');
      if (count >= total) {
        clearInterval(interval);
        setIsCounting(false);
        speakText(`あわせて、${total}！`, soundEnabled);
      }
    }, 550);
  };

  // --- ネコちゃんお部屋分けの回答記録 ---
  const handleCatSplitStepComplete = (
    isCorrect: boolean,
    _leftVal: number,
    rightVal: number,
    targetLeft: number,
    targetRight: number,
    total: number,
    attempts: number
  ) => {
    const record: AnswerRecord = {
      type: 'cat_split',
      questionText: `${total} は ${targetLeft} と [ ? ]`,
      userChoice: rightVal,
      correctAnswer: targetRight,
      isCorrect,
      timestamp: getNow(),
    };
    setHistory(prev => [record, ...prev].slice(0, 100));

    if (isCorrect) {
      if (attempts === 0) {
        setStarResults(prev => [...prev, true]);
      } else {
        setStarResults(prev => [...prev, false]);
      }
    }
  };

  // --- 答えを選択したとき (モード1) ---
  const handleSelectSynAnswer = (choice: number) => {
    if (!synQuestion || synResult === 'correct' || isTransitioning) return;
    setIsTransitioning(true);
    setSynAnswer(choice);

    const isCorrect = choice === synQuestion.answer;
    const record: AnswerRecord = {
      type: 'synthesis',
      questionText: `${synQuestion.left} ＋ ${synQuestion.right}`,
      userChoice: choice,
      correctAnswer: synQuestion.answer,
      isCorrect,
      timestamp: getNow()
    };
    setHistory(prev => [record, ...prev].slice(0, 100));

    if (isCorrect) {
      playSoundEffect('correct');
      setSynResult('correct');
      if (synAttempt === 0) {
        setStarResults(prev => [...prev, true]);
      } else {
        setStarResults(prev => [...prev, false]);
      }
      speakText("せいかい！おみごと！", soundEnabled);
    } else {
      playSoundEffect('wrong');
      setSynResult('wrong');
      const nextAttempt = synAttempt + 1;
      setSynAttempt(nextAttempt);
      if (nextAttempt === 1) {
        speakText("ちがうよ、ボウルの中をかぞえてみてね", soundEnabled);
      } else {
        speakText(`ひだりに ${synQuestion.left}こ、みぎに ${synQuestion.right}こ あるよ。あわせて いくつになるかな？`, soundEnabled);
      }
      setTimeout(() => setIsTransitioning(false), 1000);
    }
  };

  // --- モード2調整 ---
  const adjustM10Added = (amount: number) => {
    if (m10Result === 'correct' || isTransitioning) return;
    const nextVal = m10Added + amount;
    if (nextVal >= 0 && nextVal <= 10) {
      playSoundEffect('tap');
      setM10Added(nextVal);
    }
  };

  const checkM10Answer = () => {
    if (!m10Question || m10Result === 'correct' || isTransitioning) return;
    setIsTransitioning(true);

    const isCorrect = m10Added === m10Question.needed;
    const record: AnswerRecord = {
      type: 'make10',
      questionText: `${m10Question.initial} ＋ [ ? ] ＝ 10`,
      userChoice: m10Added,
      correctAnswer: m10Question.needed,
      isCorrect,
      timestamp: getNow()
    };
    setHistory(prev => [record, ...prev].slice(0, 100));

    if (isCorrect) {
      playSoundEffect('correct');
      setM10Result('correct');
      if (m10Attempt === 0) {
        setStarResults(prev => [...prev, true]);
      } else {
        setStarResults(prev => [...prev, false]);
      }
      speakText("せいかい！これでぴったり10こ！", soundEnabled);
    } else {
      playSoundEffect('wrong');
      setM10Result('wrong');
      const nextAttempt = m10Attempt + 1;
      setM10Attempt(nextAttempt);
      if (nextAttempt === 1) {
        if (m10Added < m10Question.needed) {
          speakText("まだたりないよ、もっとのせてね", soundEnabled);
        } else {
          speakText("のせすぎだよ、すこしへらそう", soundEnabled);
        }
      } else {
        speakText(`いま ${m10Question.initial}こ あるよ。10こ にするには あと ${m10Question.needed}こ だよ！`, soundEnabled);
      }
      setTimeout(() => setIsTransitioning(false), 1000);
    }
  };

  // --- 引き算のコントロール ---
  const handleSubtract = () => {
    if (isSubtracted || !subQuestion) return;
    playSoundEffect('eat');
    setIsSubtracted(true);
    speakText(`くだものが ${subQuestion.left}こ あります。 ${subQuestion.minus}こ たべると、 のこりは いくつかな？`, soundEnabled);
  };

  const handleStartSubCounting = () => {
    if (isCounting || !subQuestion) return;
    setIsCounting(true);
    setCountedCount(0);

    let count = 0;
    const total = subQuestion.answer;
    const interval = setInterval(() => {
      count++;
      setCountedCount(count);
      playSoundEffect('pop');
      if (count >= total) {
        clearInterval(interval);
        setIsCounting(false);
        speakText(`のこりは、${total}！`, soundEnabled);
      }
    }, 550);
  };

  const handleSelectSubAnswer = (choice: number) => {
    if (!subQuestion || subResult === 'correct' || isTransitioning) return;
    setIsTransitioning(true);
    setSubAnswer(choice);

    const isCorrect = choice === subQuestion.answer;
    const record: AnswerRecord = {
      type: 'subtraction',
      questionText: `${subQuestion.left} － ${subQuestion.minus}`,
      userChoice: choice,
      correctAnswer: subQuestion.answer,
      isCorrect,
      timestamp: getNow()
    };
    setHistory(prev => [record, ...prev].slice(0, 100));

    if (isCorrect) {
      playSoundEffect('correct');
      setSubResult('correct');
      if (subAttempt === 0) {
        setStarResults(prev => [...prev, true]);
      } else {
        setStarResults(prev => [...prev, false]);
      }
      speakText(`せいかい！ のこりは ${subQuestion.answer}こ だね！`, soundEnabled);
    } else {
      playSoundEffect('wrong');
      setSubResult('wrong');
      const nextAttempt = subAttempt + 1;
      setSubAttempt(nextAttempt);
      if (nextAttempt === 1) {
        speakText("ちがうよ、のこったくだものをかぞえてみてね", soundEnabled);
      } else {
        speakText(`${subQuestion.left}こ から ${subQuestion.minus}こ たべちゃったから、のこりは いくつかな？`, soundEnabled);
      }
      setTimeout(() => setIsTransitioning(false), 1000);
    }
  };

  // --- ボス戦判定 ---
  const handleBossAnswer = (choice: number) => {
    // 連打による多重アタックを防ぐガード句
    if (bossQuestType === 'synthesis' && synResult === 'correct') return;
    if (bossQuestType === 'make10' && m10Result === 'correct') return;
    if (bossQuestType === 'subtraction' && subResult === 'correct') return;
    if (isTransitioning) return;
    setIsTransitioning(true);

    if (bossQuestType === 'synthesis' && synQuestion) {
      const isCorrect = choice === synQuestion.answer;
      const record: AnswerRecord = {
        type: 'synthesis',
        questionText: `${synQuestion.left} ＋ ${synQuestion.right} (ボス)`,
        userChoice: choice,
        correctAnswer: synQuestion.answer,
        isCorrect,
        timestamp: getNow()
      };
      setHistory(prev => [record, ...prev].slice(0, 100));

      if (isCorrect) {
        playSoundEffect('damage');
        setSynResult('correct');
        setBossDmgAnim(true);
        setTimeout(() => setBossDmgAnim(false), 600);
        setBossHp(prev => Math.max(0, prev - 10));
        speakText("せいかい！アタック！", soundEnabled);
        
        if (currentStep === 10) {
          setTimeout(() => triggerStageClear(), 1000);
        } else {
          setTimeout(() => setupNextBossQuestion(currentStep + 1), 1200);
        }
      } else {
        playSoundEffect('wrong');
        setSynResult('wrong');
        const nextAttempt = synAttempt + 1;
        setSynAttempt(nextAttempt);
        if (nextAttempt === 1) {
          speakText("ちがうよ、もう一回かぞえて！", soundEnabled);
        } else {
          speakText(`ひだりに ${synQuestion.left}こ、みぎに ${synQuestion.right}こ あるよ。あわせて いくつになるかな？`, soundEnabled);
        }
        setTimeout(() => setIsTransitioning(false), 1000);
      }
    } else if (bossQuestType === 'make10' && m10Question) {
      const isCorrect = choice === m10Question.needed;
      const record: AnswerRecord = {
        type: 'make10',
        questionText: `${m10Question.initial} ＋ [ ? ] ＝ 10 (ボス)`,
        userChoice: choice,
        correctAnswer: m10Question.needed,
        isCorrect,
        timestamp: getNow()
      };
      setHistory(prev => [record, ...prev].slice(0, 100));

      if (isCorrect) {
        playSoundEffect('damage');
        setM10Result('correct');
        setBossDmgAnim(true);
        setTimeout(() => setBossDmgAnim(false), 600);
        setBossHp(prev => Math.max(0, prev - 10));
        speakText("せいかい！アタック！", soundEnabled);
        
        if (currentStep === 10) {
          setTimeout(() => triggerStageClear(), 1000);
        } else {
          setTimeout(() => setupNextBossQuestion(currentStep + 1), 1200);
        }
      } else {
        playSoundEffect('wrong');
        setM10Result('wrong');
        const nextAttempt = m10Attempt + 1;
        setM10Attempt(nextAttempt);
        if (nextAttempt === 1) {
          speakText("あわないよ、もういちど考えてね", soundEnabled);
        } else {
          speakText(`いま ${m10Question.initial}こ あるよ。10こ にするには あと ${m10Question.needed}こ だよ！`, soundEnabled);
        }
        setTimeout(() => setIsTransitioning(false), 1000);
      }
    } else if (bossQuestType === 'subtraction' && subQuestion) {
      const isCorrect = choice === subQuestion.answer;
      const record: AnswerRecord = {
        type: 'subtraction',
        questionText: `${subQuestion.left} － ${subQuestion.minus} (ボス)`,
        userChoice: choice,
        correctAnswer: subQuestion.answer,
        isCorrect,
        timestamp: getNow()
      };
      setHistory(prev => [record, ...prev].slice(0, 100));

      if (isCorrect) {
        playSoundEffect('damage');
        setSubResult('correct');
        setBossDmgAnim(true);
        setTimeout(() => setBossDmgAnim(false), 600);
        setBossHp(prev => Math.max(0, prev - 10));
        speakText("せいかい！アタック！", soundEnabled);
        
        if (currentStep === 10) {
          setTimeout(() => triggerStageClear(), 1000);
        } else {
          setTimeout(() => setupNextBossQuestion(currentStep + 1), 1200);
        }
      } else {
        playSoundEffect('wrong');
        setSubResult('wrong');
        const nextAttempt = subAttempt + 1;
        setSubAttempt(nextAttempt);
        if (nextAttempt === 1) {
          speakText("ちがうよ、のこった数をよく考えてね", soundEnabled);
        } else {
          speakText(`${subQuestion.left}こ から ${subQuestion.minus}こ ひくと、のこりは いくつかな？`, soundEnabled);
        }
        setTimeout(() => setIsTransitioning(false), 1000);
      }
    }
  };

  // --- ステージ移動 ---
  const handleNextStep = () => {
    // 連打による多重遷移を防ぐガード句
    if (selectedStage?.type === 'synthesis' && synResult !== 'correct') return;
    if (selectedStage?.type === 'subtraction' && subResult !== 'correct') return;
    if (selectedStage?.type === 'make10' && m10Result !== 'correct') return;
    if (isTransitioning) return;
    setIsTransitioning(true);

    playSoundEffect('tap');
    const nextStep = currentStep + 1;
    if (nextStep > totalSteps) {
      triggerStageClear();
    } else {
      if (selectedStage?.type === 'synthesis') {
        setupNextSynthesis(nextStep, selectedStage.maxVal);
      } else if (selectedStage?.type === 'make10') {
        setupNextMake10(nextStep);
      } else if (selectedStage?.type === 'subtraction') {
        setupNextSubtraction(nextStep, selectedStage.maxVal);
      } else if (selectedStage?.type === 'cat_split') {
        setupNextCatSplit(nextStep);
      }
    }
  };

  const triggerStageClear = () => {
    if (!selectedStage) return;
    playSoundEffect('victory');
    setScreen('stage_clear');
    setIsTransitioning(false);

    logActivity(`「${selectedStage.jpName}」をクリア！`);

    setUnlockedRewards(prev => {
      if (prev.includes(selectedStage.reward.name)) return prev;
      logActivity(`新しいなかま「${selectedStage.reward.name}」をはっけん！`);
      return [...prev, selectedStage.reward.name];
    });

    if (selectedStage.id === unlockedStageId && unlockedStageId < STAGES.length) {
      setUnlockedStageId(prev => prev + 1);
    }

    speakText(`${selectedStage.jpName}をクリアしたよ！なかまが増えたよ！`, soundEnabled);
  };

  const handleFinishClearScreen = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    playSoundEffect('tap');
    if (selectedStage?.id === STAGES.length) {
      setScreen('all_clear');
      speakText("すごすぎる！さんすうキングダムをぜんぶすくってくれたよ！おめでとう！", soundEnabled);
      setIsTransitioning(false);
    } else {
      setScreen('map');
      setIsTransitioning(false);
    }
  };

  // --- テンフレーム配置(絶対座標)の計算 ---
  const fruitPositions = useMemo(() => {
    if (!synQuestion) return { left: [], right: [] };
    const { left, right } = synQuestion;

    const leftPre = Array.from({ length: left }).map((_, i) => {
      const angle = left === 1 ? 0 : (i * 2 * Math.PI) / left;
      const radiusX = left === 1 ? 0 : 12;
      const radiusY = left === 1 ? 0 : 15;
      return {
        x: 20 + radiusX * Math.cos(angle),
        y: 50 + radiusY * Math.sin(angle),
      };
    });

    const rightPre = Array.from({ length: right }).map((_, i) => {
      const angle = right === 1 ? 0 : (i * 2 * Math.PI) / right;
      const radiusX = right === 1 ? 0 : 12;
      const radiusY = right === 1 ? 0 : 15;
      return {
        x: 80 + radiusX * Math.cos(angle),
        y: 50 + radiusY * Math.sin(angle),
      };
    });

    const getTargetPos = (index: number) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      return {
        x: 32 + col * 9,
        y: 38 + row * 24,
      };
    };

    const leftPost = leftPre.map((_, i) => getTargetPos(i));
    const rightPost = rightPre.map((_, i) => getTargetPos(left + i));

    return {
      left: leftPre.map((p, i) => ({ pre: p, post: leftPost[i] })),
      right: rightPre.map((p, i) => ({ pre: p, post: rightPost[i] })),
    };
  }, [synQuestion]);

  const currentTheme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const currentSeason = seasonMode === 'auto' ? getSeason(new Date().getMonth()) : seasonMode;
  
  // がんばりレポート用プロセスメトリクス計算の実行
  const { retryCount, maxAttempts } = getProcessMetrics();

  return (
    <div className={`min-h-screen ${currentTheme.bg} flex flex-col justify-between select-none font-sans text-slate-800 pb-4`}>
      
      {/* 共通ヘッダー */}
      <AppHeader 
        screen={screen} 
        soundEnabled={soundEnabled} 
        onGoHome={handleGoMap} 
        onToggleSound={handleToggleSound} 
        onGoZukan={() => { playSoundEffect('tap'); setIsTransitioning(false); setScreen('zukan'); }} 
        onGoReport={handleGoReport}
      />

      {/* メインビューポート */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 flex flex-col items-center justify-center py-4">
        
        {/* 1. タイトル画面 */}
        {screen === 'title' && (
          <TitleScreen onStart={handleStartGame} />
        )}

        {/* 1.5. 森の広場ホーム画面 */}
        {screen === 'home' && (
          <HomeScreen
            unlockedStageId={unlockedStageId}
            unlockedRewards={unlockedRewards}
            themeId={themeId}
            onChangeTheme={setThemeId}
            onGoPlayMap={handleGoPlayMap}
            onSelectStageById={handleSelectStageById}
            reducedMotion={reducedMotion}
            onChangeReducedMotion={setReducedMotion}
            placedFurniture={placedFurniture}
            setPlacedFurniture={setPlacedFurniture}
            isDecorating={isDecorating}
            setIsDecorating={setIsDecorating}
            selectedSpot={selectedSpot}
            setSelectedSpot={setSelectedSpot}
            onGoPlayTracing={() => setScreen('play_tracing')}
            seasonMode={seasonMode}
            onChangeSeason={setSeasonMode}
            currentSeason={currentSeason}
            todayChoiceMade={todayChoiceMade}
            onChooseActivity={handleChooseActivity}
          />
        )}

        {/* 2. マップ選択画面 */}
        {screen === 'map' && (
          <MapScreen unlockedStageId={unlockedStageId} onSelectStage={handleSelectStage} onResetProgress={handleResetProgress} />
        )}

        {/* 3. 図鑑画面 */}
        {screen === 'zukan' && (
          <ZukanScreen unlockedRewards={unlockedRewards} onGoBack={handleGoMap} />
        )}

        {/* 4. ステージクリア報酬画面 */}
        {screen === 'stage_clear' && selectedStage && (
          <StageClearScreen stage={selectedStage} onContinue={handleFinishClearScreen} />
        )}

        {/* 5. 合成・がったいたしざんプレイ画面 */}
        {screen === 'play_synthesis' && synQuestion && selectedStage && (
          <div className="w-full flex flex-col items-center gap-5 animate-fadeIn">
            <StarProgress currentStep={currentStep} totalSteps={totalSteps} title={selectedStage.jpName} starResults={starResults} />

            {/* ボード(テンフレーム) */}
            <div className="relative w-full max-w-2xl bg-orange-50/70 rounded-3xl border-4 border-orange-200 shadow-inner overflow-hidden h-[240px] md:h-[280px]">
              {/* 左皿 */}
              <div className={`absolute left-[20%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-1000 ${isMerged ? 'opacity-20 scale-75' : 'opacity-100'}`}>
                <span className="text-amber-800 font-black text-xs mb-1">ひだり ({synQuestion.left})</span>
                <div className="w-28 h-28 md:w-32 md:h-32 bg-white/95 border-4 border-orange-100 rounded-full shadow-md"></div>
              </div>

              {/* プラス記号 */}
              <div className={`absolute left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 text-3xl font-black text-orange-300 transition-all duration-500 ${isMerged ? 'scale-0 opacity-0' : 'opacity-100'}`}>
                ＋
              </div>

              {/* 右皿 */}
              <div className={`absolute left-[80%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-1000 ${isMerged ? 'opacity-20 scale-75' : 'opacity-100'}`}>
                <span className="text-amber-800 font-black text-xs mb-1">みぎ ({synQuestion.right})</span>
                <div className="w-28 h-28 md:w-32 md:h-32 bg-white/95 border-4 border-orange-100 rounded-full shadow-md"></div>
              </div>

              {/* テンフレーム */}
              <div className={`absolute left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 w-[48%] h-[55%] border-4 border-dashed border-orange-400 bg-orange-100/40 rounded-2xl p-2 transition-all duration-700 flex flex-col justify-between ${isMerged ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'}`}>
                <div className="grid grid-cols-5 gap-1.5 h-full w-full">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={`frame-cell-${i}`} className="border-2 border-orange-200/60 bg-white/40 rounded-xl" />
                  ))}
                </div>
              </div>

              {/* 移動するくだもの（左から） */}
              {fruitPositions.left.map((item, idx) => {
                const coord = isMerged ? item.post : item.pre;
                const countNum = idx + 1;
                const isCounted = countedCount >= countNum;

                return (
                  <div
                    key={`fruit-left-${idx}`}
                    style={{ position: 'absolute', left: `${coord.x}%`, top: `${coord.y}%`, transform: 'translate(-50%, -50%)' }}
                    className={`text-3xl md:text-4xl transition-all duration-1000 ease-out select-none flex items-center justify-center ${isCounted ? 'scale-125' : ''}`}
                  >
                    <span>{synQuestion.fruit}</span>
                    {isMerged && isCounted && (
                      <span className="absolute -top-3 bg-yellow-400 text-amber-950 font-black text-xs rounded-full w-6 h-6 border-2 border-white flex items-center justify-center shadow animate-bounce">
                        {countNum}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* 移動するくだもの（右から） */}
              {fruitPositions.right.map((item, idx) => {
                const coord = isMerged ? item.post : item.pre;
                const countNum = synQuestion.left + idx + 1;
                const isCounted = countedCount >= countNum;

                return (
                  <div
                    key={`fruit-right-${idx}`}
                    style={{ position: 'absolute', left: `${coord.x}%`, top: `${coord.y}%`, transform: 'translate(-50%, -50%)' }}
                    className={`text-3xl md:text-4xl transition-all duration-1000 ease-out select-none flex items-center justify-center ${isCounted ? 'scale-125' : ''}`}
                  >
                    <span>{synQuestion.fruit}</span>
                    {isMerged && isCounted && (
                      <span className="absolute -top-3 bg-yellow-400 text-amber-950 font-black text-xs rounded-full w-6 h-6 border-2 border-white flex items-center justify-center shadow animate-bounce">
                        {countNum}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* アクションボタン */}
            <div className="flex flex-col items-center gap-3 w-full">
              {!isMerged ? (
                <button
                  onClick={handleMerge}
                  className="bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 text-white font-black text-xl md:text-2xl px-12 py-3.5 rounded-2xl shadow-lg transition-all transform active:translate-y-1 active:border-b-0 flex items-center gap-2"
                >
                  がったい する！ ✨
                </button>
              ) : (
                <button
                  onClick={handleStartCounting}
                  disabled={isCounting}
                  className={`border-b-4 font-black text-lg px-8 py-3 rounded-2xl shadow transition-all ${isCounting ? 'bg-slate-300 border-slate-400 text-slate-500' : 'bg-yellow-400 hover:bg-yellow-500 border-yellow-600 text-yellow-950'}`}
                >
                  1つずつ かぞえる ➔
                </button>
              )}
            </div>

            {/* 式 */}
            <div className="bg-white border-4 border-orange-200 rounded-3xl p-4 w-full max-w-md text-center shadow-sm">
              <div className="text-3xl md:text-4xl font-black text-slate-700 tracking-wide flex justify-center items-center gap-2">
                <span>{synQuestion.left}</span>
                <span className="text-orange-400 text-xl">＋</span>
                <span>{synQuestion.right}</span>
                <span className="text-orange-400 text-xl">＝</span>
                <span className="bg-orange-50 px-5 py-0.5 border-4 border-dashed border-orange-300 rounded-xl text-orange-600 min-w-[70px]">
                  {synResult === 'correct' ? synQuestion.answer : '？'}
                </span>
              </div>
            </div>

            {/* 三択 */}
            {isMerged && (
              <div className="w-full max-w-md px-2 flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-3">
                  {synQuestion.choices.map((choice) => {
                    const isSelected = synAnswer === choice;
                    let btnStyle = "bg-white text-slate-700 border-slate-300 border-b-4 hover:bg-orange-50";
                    if (isSelected) {
                      btnStyle = synResult === 'correct' 
                        ? "bg-emerald-600 text-white border-emerald-800 border-b-4 translate-y-[4px]" 
                        : "bg-rose-600 text-white border-rose-800 border-b-4 translate-y-[4px]";
                    } else if (synResult === 'correct') {
                      btnStyle = "bg-white text-slate-300 border-slate-200 opacity-50 cursor-not-allowed";
                    }

                    return (
                      <button
                        key={choice}
                        onClick={() => handleSelectSynAnswer(choice)}
                        disabled={synResult === 'correct'}
                        className={`text-3xl font-black rounded-2xl py-3.5 shadow-md transition-all ${btnStyle}`}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* フィードバック */}
            <div className="min-h-[100px] flex flex-col items-center justify-center">
              {synResult === 'correct' && (
                <div className="text-center animate-bounce">
                  <span className="text-xl md:text-2xl font-black text-emerald-600 block mb-2">🌟 せいかい！ 🌟</span>
                  <button
                    onClick={handleNextStep}
                    className="bg-emerald-500 hover:bg-emerald-600 border-b-4 border-emerald-700 text-white font-black text-md px-10 py-2 rounded-xl"
                  >
                    つぎへすすむ ➔
                  </button>
                </div>
              )}
              {synResult === 'wrong' && (
                <div className="bg-rose-100 border-2 border-rose-200 text-rose-600 font-black text-xs md:text-sm px-6 py-2 rounded-full animate-pulse text-center">
                  {synAttempt === 1 
                    ? "もういちど、よくかぞえてみよう！" 
                    : `💡 ヒント：ひだり（${synQuestion.left}）と みぎ（${synQuestion.right}）を あわせると いくつになるかな？`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. ひきざんプレイ画面 */}
        {screen === 'play_subtraction' && subQuestion && selectedStage && (
          <div className="w-full flex flex-col items-center gap-5 animate-fadeIn">
            <StarProgress currentStep={currentStep} totalSteps={totalSteps} title={selectedStage.jpName} starResults={starResults} />

            {/* ボード(川と芝生の対比) */}
            <div className="relative w-full max-w-2xl bg-[#E6F4F8] rounded-3xl border-4 border-sky-200 shadow-inner overflow-hidden h-[240px] md:h-[280px]">
              {/* 川の流れ (右側 35%) */}
              <div className="absolute right-0 top-0 bottom-0 w-[35%] bg-sky-100/70 border-l-4 border-sky-200/50 flex flex-col justify-around py-4 select-none pointer-events-none">
                <div className="text-sky-300/30 text-4xl font-black text-center animate-pulse">〰️</div>
                <div className="text-sky-300/30 text-4xl font-black text-center animate-pulse delay-75">〰️</div>
                <div className="text-sky-300/30 text-4xl font-black text-center animate-pulse delay-150">〰️</div>
              </div>

              {/* 芝生のひろば (左側 65%) */}
              <div className="absolute left-0 top-0 bottom-0 w-[65%] bg-emerald-50/60 p-4 flex flex-col justify-between">
                <span className="text-emerald-800/60 font-black text-xs">のこる くだもの ({subQuestion.left - subQuestion.minus}こ)</span>
                
                {/* のこるくだもののコンテナ */}
                <div className="flex-1 flex items-center justify-center gap-3 flex-wrap p-2">
                  {Array.from({ length: subQuestion.left - subQuestion.minus }).map((_, idx) => {
                    const countNum = idx + 1;
                    const isCounted = countedCount >= countNum;
                    return (
                      <div
                        key={`sub-remain-${idx}`}
                        className={`relative text-4xl md:text-5xl transition-all duration-300 select-none flex items-center justify-center ${isCounted ? 'scale-125' : ''}`}
                      >
                        <span>{subQuestion.fruit}</span>
                        {isCounted && (
                          <span className="absolute -top-3 bg-yellow-400 text-amber-950 font-black text-xs rounded-full w-6 h-6 border-2 border-white flex items-center justify-center shadow animate-bounce">
                            {countNum}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* くいしんぼうゾーン (オウム 🦜 または ハムスター 🐹 ＆ 食べられるくだもの) */}
              <div 
                className={`absolute right-[8%] top-[25%] flex flex-col items-center gap-1.5 transition-all duration-[1200ms] ease-in-out ${
                  isSubtracted 
                    ? 'translate-x-48 -translate-y-64 scale-50 opacity-0 pointer-events-none' 
                    : 'translate-x-0 translate-y-0 scale-100 opacity-100'
                }`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-sky-800/60 font-black text-[10px] mb-1">たべる ({subQuestion.minus}こ)</span>
                  <span className="text-5xl animate-bounce">
                    {selectedStage.id === 2 ? '🦜' : '🐹'}
                  </span>
                </div>
                
                <div className="bg-white/80 border-2 border-sky-200 rounded-2xl p-2.5 flex gap-1.5 flex-wrap justify-center max-w-[120px] shadow-sm relative">
                  {Array.from({ length: subQuestion.minus }).map((_, idx) => (
                    <span key={`sub-minus-${idx}`} className="text-3xl select-none relative">
                      {subQuestion.fruit}
                    </span>
                  ))}
                </div>
              </div>

              {/* オバケ 👻 演出 */}
              {isSubtracted && (
                <div className="absolute right-[5%] top-[10%] flex flex-col items-center gap-1 pointer-events-none animate-fadeIn select-none opacity-40">
                  <span className="text-amber-800/50 font-black text-[9px]">たべちゃった！</span>
                  <div className="flex gap-1.5 p-2 bg-slate-100/30 rounded-xl border border-slate-200/20">
                    {Array.from({ length: subQuestion.minus }).map((_, idx) => (
                      <div key={`ghost-${idx}`} className="relative text-3xl animate-bounce" style={{ animationDelay: `${idx * 150}ms` }}>
                        <span>👻</span>
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] opacity-70">
                          {subQuestion.fruit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* アクションボタン */}
            <div className="flex flex-col items-center gap-3 w-full">
              {!isSubtracted ? (
                <button
                  onClick={handleSubtract}
                  className="bg-rose-500 hover:bg-rose-600 border-b-4 border-rose-700 text-white font-black text-xl md:text-2xl px-12 py-3.5 rounded-2xl shadow-lg transition-all transform active:translate-y-1 active:border-b-0 flex items-center gap-2"
                >
                  たべる！ もぐもぐ 🐹🦜
                </button>
              ) : (
                <button
                  onClick={handleStartSubCounting}
                  disabled={isCounting}
                  className={`border-b-4 font-black text-lg px-8 py-3 rounded-2xl shadow transition-all ${
                    isCounting 
                      ? 'bg-slate-300 border-slate-400 text-slate-500' 
                      : 'bg-yellow-400 hover:bg-yellow-500 border-yellow-600 text-yellow-950'
                  }`}
                >
                  1つずつ かぞえる ➔
                </button>
              )}
            </div>

            {/* 式 */}
            <div className="bg-white border-4 border-sky-200 rounded-3xl p-4 w-full max-w-md text-center shadow-sm">
              <div className="text-3xl md:text-4xl font-black text-slate-700 tracking-wide flex justify-center items-center gap-2">
                <span>{subQuestion.left}</span>
                <span className="text-sky-400 text-xl">－</span>
                <span>{subQuestion.minus}</span>
                <span className="text-sky-400 text-xl">＝</span>
                <span className="bg-sky-50 px-5 py-0.5 border-4 border-dashed border-sky-300 rounded-xl text-sky-600 min-w-[70px]">
                  {subResult === 'correct' ? subQuestion.answer : '？'}
                </span>
              </div>
            </div>

            {/* 三択 */}
            {isSubtracted && (
              <div className="w-full max-w-md px-2 flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-3">
                  {subQuestion.choices.map((choice) => {
                    const isSelected = subAnswer === choice;
                    let btnStyle = "bg-white text-slate-700 border-slate-300 border-b-4 hover:bg-sky-50";
                    if (isSelected) {
                      btnStyle = subResult === 'correct' 
                        ? "bg-emerald-600 text-white border-emerald-800 border-b-4 translate-y-[4px]" 
                        : "bg-rose-600 text-white border-rose-800 border-b-4 translate-y-[4px]";
                    } else if (subResult === 'correct') {
                      btnStyle = "bg-white text-slate-300 border-slate-200 opacity-50 cursor-not-allowed";
                    }

                    return (
                      <button
                        key={choice}
                        onClick={() => handleSelectSubAnswer(choice)}
                        disabled={subResult === 'correct'}
                        className={`text-3xl font-black rounded-2xl py-3.5 shadow-md transition-all ${btnStyle}`}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* フィードバック */}
            <div className="min-h-[100px] flex flex-col items-center justify-center">
              {subResult === 'correct' && (
                <div className="text-center animate-bounce">
                  <span className="text-xl md:text-2xl font-black text-emerald-600 block mb-2">🌟 せいかい！ 🌟</span>
                  <button
                    onClick={handleNextStep}
                    className="bg-emerald-500 hover:bg-emerald-600 border-b-4 border-emerald-700 text-white font-black text-md px-10 py-2 rounded-xl"
                  >
                    つぎへすすむ ➔
                  </button>
                </div>
              )}
              {subResult === 'wrong' && (
                <div className="bg-rose-100 border-2 border-rose-200 text-rose-600 font-black text-xs md:text-sm px-6 py-2 rounded-full animate-pulse text-center">
                  {subAttempt === 1 
                    ? "もういちど、のこったくだものを よくかぞえてみよう！" 
                    : `💡 ヒント：${subQuestion.left}こ から ${subQuestion.minus}こ ひくと、のこりは いくつかな？`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. 10をつくろうプレイ画面 */}
        {screen === 'play_make10' && m10Question && selectedStage && (
          <div className="w-full flex flex-col items-center gap-5 animate-fadeIn">
            <StarProgress currentStep={currentStep} totalSteps={totalSteps} title={selectedStage.jpName} starResults={starResults} />

            <div className="text-lg md:text-xl font-black text-slate-700 text-center px-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl py-2.5 w-full max-w-lg">
              「10こ」にするには、あといくつ のせる？
            </div>

            {/* たまごパックの描画 */}
            <div className="w-full max-w-lg bg-white border-8 border-emerald-400 rounded-3xl p-5 shadow-lg">
              <div className="grid grid-cols-5 gap-2.5">
                {Array.from({ length: 10 }).map((_, idx) => {
                  const isInitial = idx < m10Question.initial;
                  const isAdded = idx >= m10Question.initial && idx < m10Question.initial + m10Added;
                  return (
                    <div
                      key={idx}
                      className={`h-14 md:h-16 rounded-xl border-4 flex items-center justify-center text-3xl shadow-inner transition-all ${
                        isInitial ? 'bg-amber-100 border-amber-300' : isAdded ? 'bg-emerald-50 border-emerald-400 scale-105' : 'bg-slate-50 border-dashed border-slate-300'
                      }`}
                    >
                      {isInitial && <span className="animate-pulse">{m10Question.fruit}</span>}
                      {isAdded && <span className="animate-bounce">{m10Question.fruit}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 右のせ皿 */}
            <div className="w-full max-w-md flex flex-col items-center gap-3 bg-orange-50/40 p-4 border-2 border-orange-100 rounded-3xl">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => adjustM10Added(-1)}
                  disabled={m10Added === 0 || m10Result === 'correct'}
                  className="bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-black p-3 rounded-xl border-b-4 border-rose-700 shadow"
                >
                  <Minus className="w-6 h-6" />
                </button>

                <div className="w-28 h-28 bg-white border-4 border-orange-200 rounded-full shadow-md relative flex items-center justify-center">
                  {m10Added === 0 ? (
                    <span className="text-slate-400 font-bold text-[10px]">のせてね</span>
                  ) : (
                    Array.from({ length: m10Added }).map((_, idx) => {
                      const angle = m10Added === 1 ? 0 : (idx * 2 * Math.PI) / m10Added;
                      const radius = m10Added === 1 ? 0 : 16;
                      return (
                        <div
                          key={idx}
                          style={{ position: 'absolute', left: `${50 + radius * Math.cos(angle)}%`, top: `${50 + radius * Math.sin(angle)}%`, transform: 'translate(-50%, -50%)' }}
                          className="text-3xl"
                        >
                          {m10Question.fruit}
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={() => adjustM10Added(1)}
                  disabled={m10Added + m10Question.initial >= 10 || m10Result === 'correct'}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-black p-3 rounded-xl border-b-4 border-emerald-700 shadow"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* 決定式 */}
            <div className="w-full max-w-md bg-white border-4 border-emerald-300 rounded-2xl p-4 text-center shadow-md flex flex-col gap-3">
              <div className="text-3xl font-black text-slate-700 flex justify-center items-center gap-1.5">
                <span>{m10Question.initial}</span>
                <span className="text-emerald-500 text-lg">＋</span>
                <span className="bg-emerald-50 px-4 py-0.5 border-2 border-emerald-300 text-emerald-600 rounded-xl min-w-[60px]">
                  {m10Added}
                </span>
                <span className="text-emerald-500 text-lg">＝</span>
                <span>10</span>
              </div>

              {m10Result !== 'correct' && (
                <button
                  onClick={checkM10Answer}
                  className="bg-emerald-500 hover:bg-emerald-600 border-b-4 border-emerald-700 text-white font-black text-xl py-2.5 rounded-xl flex items-center justify-center gap-1"
                >
                  <Check className="w-6 h-6" />
                  できた！
                </button>
              )}
            </div>

            {/* フィードバック */}
            <div className="min-h-[100px] flex flex-col items-center justify-center">
              {m10Result === 'correct' && (
                <div className="text-center animate-bounce">
                  <span className="text-xl md:text-2xl font-black text-emerald-600 block mb-2">🌟 せいかい！ 🌟</span>
                  <button
                    onClick={handleNextStep}
                    className="bg-emerald-500 hover:bg-emerald-600 border-b-4 border-emerald-700 text-white font-black text-md px-10 py-2 rounded-xl"
                  >
                    つぎへすすむ ➔
                  </button>
                </div>
              )}
              {m10Result === 'wrong' && (
                <div className="bg-rose-100 border-2 border-rose-200 text-rose-600 font-black text-xs md:text-sm px-6 py-2 rounded-full animate-pulse text-center">
                  {m10Attempt === 1
                    ? (m10Added < m10Question.needed ? "まだたりないよ、もっとのせてね！" : "のせすぎだよ、すこしへらそう！")
                    : `💡 ヒント：いま ${m10Question.initial}こ あるよ。10こ にするには あと ${m10Question.needed}こ だよ！`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6.5. ネコちゃんお部屋分けプレイ画面 */}
        {screen === 'play_cat_split' && selectedStage && (
          <CatRoomSplitScreen
            key={currentStep}
            currentStep={currentStep}
            totalSteps={totalSteps}
            starResults={starResults}
            soundEnabled={soundEnabled}
            onPlaySound={playSoundEffect}
            speakText={speakText}
            onGoBack={handleGoMap}
            onStepComplete={handleCatSplitStepComplete}
            onNextStep={handleNextStep}
            maxVal={selectedStage.maxVal}
          />
        )}

        {/* 6.8. もじなぞり書きプレイ画面 */}
        {screen === 'play_tracing' && (
          <HiraganaTracingScreen
            soundEnabled={soundEnabled}
            onPlaySound={playSoundEffect}
            speakText={speakText}
            onGoBack={() => { playSoundEffect('tap'); setScreen('home'); }}
            logActivity={logActivity}
            completedLetters={completedHiragana}
            onCompleteLetter={(letter) => {
              setCompletedHiragana(prev => {
                if (prev.includes(letter)) return prev;
                return [...prev, letter];
              });
            }}
          />
        )}

        {/* 7. ボス戦プレイ画面 */}
        {screen === 'play_boss' && selectedStage && (
          <div className="w-full flex flex-col items-center gap-4 animate-fadeIn">
            {/* 進捗とHPバー */}
            <div className="w-full max-w-md bg-white border-4 border-red-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm font-extrabold text-red-700">
                <span>⚔️ さんすうキングの しろ ({currentStep} / {totalSteps})</span>
                <span>キングの HP: {bossHp}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4 border-2 border-slate-200 overflow-hidden">
                <div 
                  className="bg-red-500 h-full transition-all duration-300" 
                  style={{ width: `${bossHp}%` }}
                />
              </div>
            </div>

            {/* ボスとキャラクターの対決ゾーン */}
            <div className="w-full max-w-md flex justify-between items-center bg-orange-50/50 p-6 border-4 border-orange-100 rounded-3xl relative overflow-hidden h-40">
              {/* プレイヤー側 (なかまたち) */}
              <div className="flex flex-col items-center gap-1">
                <span className={`text-5xl ${reducedMotion ? '' : 'animate-bounce'}`}>🐯</span>
                <span className="text-[10px] font-black text-slate-500">ぼうけんしゃ</span>
              </div>
              
              {/* バトルエフェクト */}
              {bossDmgAnim && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-5xl animate-ping font-black text-rose-500 select-none">
                  {reducedMotion ? '✨ アタック！' : '💥 ズバッ！'}
                </div>
              )}

              <div className="text-3xl font-black text-orange-300">VS</div>

              {/* ボス側 */}
              <div className={`flex flex-col items-center gap-1 ${bossDmgAnim ? (reducedMotion ? '' : 'animate-bounce filter invert') : ''}`}>
                <span className="text-6xl">😈</span>
                <span className="text-xs font-black text-red-600">さんすうキング</span>
              </div>
            </div>

            {/* 問題表示エリア */}
            <div className="w-full max-w-md bg-white border-4 border-red-300 rounded-3xl p-5 text-center shadow-md flex flex-col gap-3">
              {bossQuestType === 'synthesis' && synQuestion && (
                <div className="space-y-4">
                  <div className="text-lg font-black text-slate-600">くだものをあわせていくつかな？</div>
                  {/* フルーツの視覚的表示 */}
                  <div className="bg-orange-50/40 p-3 rounded-2xl border border-orange-100 flex justify-center items-center gap-4 flex-wrap">
                    {/* 左のくだもの */}
                    <div className="flex gap-1 flex-wrap justify-center max-w-[120px]">
                      {Array.from({ length: synQuestion.left }).map((_, i) => (
                        <span key={`boss-l-${i}`} className="text-2xl">{synQuestion.fruit}</span>
                      ))}
                    </div>
                    <span className="text-xl font-black text-orange-400">＋</span>
                    {/* 右のくだもの */}
                    <div className="flex gap-1 flex-wrap justify-center max-w-[120px]">
                      {Array.from({ length: synQuestion.right }).map((_, i) => (
                        <span key={`boss-r-${i}`} className="text-2xl">{synQuestion.fruit}</span>
                      ))}
                    </div>
                  </div>
                  {/* 式 */}
                  <div className="text-3xl font-black text-slate-700 flex justify-center items-center gap-2">
                    <span>{synQuestion.left}</span>
                    <span className="text-orange-400 text-lg">＋</span>
                    <span>{synQuestion.right}</span>
                    <span className="text-orange-400 text-lg">＝</span>
                    <span className="bg-red-50 px-5 py-0.5 border-4 border-dashed border-red-300 text-red-600 rounded-xl min-w-[70px]">
                      {synResult === 'correct' ? synQuestion.answer : '？'}
                    </span>
                  </div>
                </div>
              )}

              {bossQuestType === 'make10' && m10Question && (
                <div className="space-y-4">
                  <div className="text-lg font-black text-slate-600">10にするには、あといくつ必要？</div>
                  {/* テンフレーム表示 */}
                  <div className="bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100 grid grid-cols-5 gap-1.5 justify-center">
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const isFilled = idx < m10Question.initial;
                      return (
                        <div 
                          key={`boss-m10-${idx}`} 
                          className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl ${
                            isFilled ? 'bg-amber-100 border-amber-300' : 'bg-white border-dashed border-slate-300'
                          }`}
                        >
                          {isFilled && m10Question.fruit}
                        </div>
                      );
                    })}
                  </div>
                  {/* 式 */}
                  <div className="text-3xl font-black text-slate-700 flex justify-center items-center gap-2">
                    <span>{m10Question.initial}</span>
                    <span className="text-emerald-500 text-lg">＋</span>
                    <span className="bg-red-50 px-5 py-0.5 border-4 border-dashed border-red-300 text-red-600 rounded-xl min-w-[70px]">
                      {m10Result === 'correct' ? m10Question.needed : '？'}
                    </span>
                    <span className="text-emerald-500 text-lg">＝</span>
                    <span>10</span>
                  </div>
                </div>
              )}
              {bossQuestType === 'subtraction' && subQuestion && (
                <div className="space-y-4">
                  <div className="text-lg font-black text-slate-600">くだものをひくと、のこりはいくつ？</div>
                  {/* フルーツの視覚的表示 */}
                  <div className="bg-orange-50/40 p-3 rounded-2xl border border-orange-100 flex justify-center items-center gap-4 flex-wrap">
                    {/* のこるくだもの ＆ ひかれるくだもの */}
                    <div className="flex gap-1.5 flex-wrap justify-center max-w-[220px]">
                      {Array.from({ length: subQuestion.left - subQuestion.minus }).map((_, i) => (
                        <span key={`boss-sub-l-${i}`} className="text-2xl animate-pulse">{subQuestion.fruit}</span>
                      ))}
                      {Array.from({ length: subQuestion.minus }).map((_, i) => (
                        <span key={`boss-sub-ghost-${i}`} className="text-2xl relative select-none opacity-20 filter grayscale">
                          <span>{subQuestion.fruit}</span>
                          <span className="absolute inset-0 flex items-center justify-center text-red-500 font-extrabold text-[10px]">❌</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* 式 */}
                  <div className="text-3xl font-black text-slate-700 flex justify-center items-center gap-2">
                    <span>{subQuestion.left}</span>
                    <span className="text-sky-400 text-lg">－</span>
                    <span>{subQuestion.minus}</span>
                    <span className="text-sky-400 text-lg">＝</span>
                    <span className="bg-red-50 px-5 py-0.5 border-4 border-dashed border-red-300 text-red-600 rounded-xl min-w-[70px]">
                      {subResult === 'correct' ? subQuestion.answer : '？'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 選択肢 (3択) */}
            <div className="w-full max-w-md px-2">
              <div className="grid grid-cols-3 gap-3">
                {bossQuestType === 'synthesis' && synQuestion && synQuestion.choices.map((choice) => {
                  const isSelected = synAnswer === choice;
                  let btnStyle = "bg-white text-slate-700 border-slate-300 border-b-4 hover:bg-orange-50";
                  if (isSelected) {
                    btnStyle = synResult === 'correct' 
                      ? "bg-emerald-600 text-white border-emerald-800 border-b-4 translate-y-[4px]" 
                      : "bg-rose-600 text-white border-rose-800 border-b-4 translate-y-[4px]";
                  } else if (synResult === 'correct') {
                    btnStyle = "bg-white text-slate-300 border-slate-200 opacity-50 cursor-not-allowed";
                  }

                  return (
                    <button
                      key={`boss-choice-${choice}`}
                      onClick={() => handleBossAnswer(choice)}
                      disabled={synResult === 'correct'}
                      className={`text-3xl font-black rounded-2xl py-3.5 shadow-md transition-all ${btnStyle}`}
                    >
                      {choice}
                    </button>
                  );
                })}

                {bossQuestType === 'make10' && m10Question && m10Question.choices.map((choice) => {
                  const isAnswered = m10Result !== null;
                  let btnStyle = "bg-white text-slate-700 border-slate-300 border-b-4 hover:bg-emerald-50";
                  if (isAnswered) {
                    if (choice === m10Question.needed) {
                      btnStyle = "bg-emerald-600 text-white border-emerald-800 border-b-4 translate-y-[4px]";
                    } else if (m10Result === 'wrong') {
                      btnStyle = "bg-white text-slate-300 border-slate-200 opacity-50 cursor-not-allowed";
                    }
                  }

                  return (
                    <button
                      key={`boss-choice-${choice}`}
                      onClick={() => {
                        setM10Added(choice);
                        handleBossAnswer(choice);
                      }}
                      disabled={m10Result === 'correct'}
                      className={`text-3xl font-black rounded-2xl py-3.5 shadow-md transition-all ${btnStyle}`}
                    >
                      {choice}
                    </button>
                  );
                })}
                {bossQuestType === 'subtraction' && subQuestion && subQuestion.choices.map((choice) => {
                  const isSelected = subAnswer === choice;
                  let btnStyle = "bg-white text-slate-700 border-slate-300 border-b-4 hover:bg-sky-50";
                  if (isSelected) {
                    btnStyle = subResult === 'correct' 
                      ? "bg-emerald-600 text-white border-emerald-800 border-b-4 translate-y-[4px]" 
                      : "bg-rose-600 text-white border-rose-800 border-b-4 translate-y-[4px]";
                  } else if (subResult === 'correct') {
                    btnStyle = "bg-white text-slate-300 border-slate-200 opacity-50 cursor-not-allowed";
                  }

                  return (
                    <button
                      key={`boss-choice-sub-${choice}`}
                      onClick={() => handleBossAnswer(choice)}
                      disabled={subResult === 'correct'}
                      className={`text-3xl font-black rounded-2xl py-3.5 shadow-md transition-all ${btnStyle}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* フィードバックメッセージ */}
            <div className="min-h-[60px] flex items-center justify-center">
              {synResult === 'wrong' && synQuestion && (
                <div className="bg-rose-100 border-2 border-rose-200 text-rose-600 font-black text-xs md:text-sm px-6 py-2 rounded-full animate-pulse text-center">
                  {synAttempt === 1 
                    ? "もういちど、よくかぞえてみよう！" 
                    : `💡 ヒント：ひだり（${synQuestion.left}）と みぎ（${synQuestion.right}）を あわせると いくつかな？`}
                </div>
              )}
              {m10Result === 'wrong' && m10Question && (
                <div className="bg-rose-100 border-2 border-rose-200 text-rose-600 font-black text-xs md:text-sm px-6 py-2 rounded-full animate-pulse text-center">
                  {m10Attempt === 1 
                    ? "10になるか、もう一度たし算してみてね！" 
                    : `💡 ヒント：いま ${m10Question.initial}こ あるよ。10こ にするには あと ${m10Question.needed}こ だよ！`}
                </div>
              )}
              {subResult === 'wrong' && subQuestion && (
                <div className="bg-rose-100 border-2 border-rose-200 text-rose-600 font-black text-xs md:text-sm px-6 py-2 rounded-full animate-pulse text-center">
                  {subAttempt === 1 
                    ? "のこったくだものを、よくかぞえてみよう！" 
                    : `💡 ヒント：${subQuestion.left}こ から ${subQuestion.minus}こ ひくと、のこりは いくつかな？`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. オールクリア画面 */}
        {screen === 'all_clear' && (
          <div className="bg-gradient-to-br from-yellow-100 via-amber-50 to-orange-100 border-8 border-yellow-400 rounded-3xl p-8 shadow-2xl w-full max-w-md text-center flex flex-col items-center gap-6 my-4 animate-scaleUp">
            <div className="relative">
              <Trophy className="w-24 h-24 text-yellow-400 fill-yellow-200 animate-bounce" />
              <Sparkles className="absolute -top-2 -right-2 w-10 h-10 text-amber-500 animate-ping" />
              <Sparkles className="absolute -bottom-2 -left-2 w-8 h-8 text-orange-500 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black text-amber-700 tracking-wider">🎉 かんぜんクリア！ 🎉</h2>
              <p className="text-sm font-bold text-slate-600 leading-relaxed">
                さんすうキングをたおして、<br/>
                くだものキングダムの へいわをとりもどしたよ！
              </p>
            </div>

            {/* なかまたち全員集合 */}
            <div className="w-full bg-white/80 border-4 border-yellow-200 rounded-2xl p-4 flex flex-col gap-2">
              <h3 className="text-xs font-black text-amber-800">あつまった なかまたち</h3>
              <div className="flex justify-center gap-3 text-4xl py-2 flex-wrap">
                <span>🐰</span>
                <span>🦜</span>
                <span>🐱</span>
                <span>🐹</span>
                <span>🐼</span>
                <span>🐲</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 leading-tight">
                みんなでなかよく さんすうをべんきょうしよう！
              </p>
            </div>

            <button
              onClick={() => {
                playSoundEffect('tap');
                setUnlockedStageId(1);
                setUnlockedRewards([]);
                setScreen('title');
              }}
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-black text-lg py-3.5 rounded-2xl border-b-8 border-orange-700 shadow-xl transition-all active:translate-y-[4px] active:border-b-2"
            >
              もういちど さいしょからあそぶ ➔
            </button>
          </div>
        )}

        {/* 9. がんばりレポート画面 (保護者向け) */}
        {screen === 'report' && (
          <div className="w-full max-w-2xl bg-white border-8 border-violet-300 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-6 my-4 animate-fadeIn">
            <div className="text-center space-y-1">
              <h2 className="text-2xl md:text-3xl font-black text-violet-600 flex items-center justify-center gap-2 select-none">
                <span>🔑</span>
                おうちのかた向け がんばりレポート
              </h2>
              <p className="text-xs font-bold text-slate-400">
                お子様のこれまでの学習記録を確認できます。
              </p>
            </div>

            {/* 💚 おうちの方へ：安心・安全へのこだわり */}
            <div className="w-full bg-emerald-50/50 border-4 border-emerald-200 rounded-2xl p-5 flex flex-col gap-4 text-left">
              <div className="flex justify-between items-center border-b border-emerald-200 pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-emerald-800">
                  <span className="text-xl">💚</span>
                  <h3 className="text-sm font-black">このアプリの安心・安全へのこだわり</h3>
                </div>
              </div>
              <div className="text-xs text-slate-600 font-bold leading-relaxed space-y-3">
                <p>
                  『さんすうクエスト』および『森の広場』は、お子様が安心して自分のペースで学べる環境を最優先に設計されています。
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-1">
                    <h4 className="font-black text-emerald-900 flex items-center gap-1 text-[11px]">
                      <span>🚫</span> 広告・ガチャ・課金なし
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      誤操作を誘発するバナー広告や、射幸心を煽るガチャ、追加の課金誘導は一切ありません。
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-1">
                    <h4 className="font-black text-emerald-900 flex items-center gap-1 text-[11px]">
                      <span>⏳</span> 時間制限・焦りの排除
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      「早く答えなければゲームオーバー」といった時間制限はなく、じっくり考える時間を大切にしています。
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-1">
                    <h4 className="font-black text-emerald-900 flex items-center gap-1 text-[11px]">
                      <span>🧸</span> 失敗を責めないフィードバック
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      間違えた時も不快な警告音は鳴らさず、「すこしへらそう」「もう一度かぞえよう」など次につながるヒントを伝えます。
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-1">
                    <h4 className="font-black text-emerald-900 flex items-center gap-1 text-[11px]">
                      <span>🎨</span> 低刺激でやさしい画面設計
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      感覚にやさしいパステル調の色彩と、過度に興奮させない落ち着いたアニメーションを採用しています。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* サマリーカード */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              <div className="bg-violet-50/50 border-2 border-violet-100 rounded-2xl p-4 text-center flex flex-col justify-between">
                <span className="text-xs font-black text-violet-700 block mb-1">いっしょに といた問題</span>
                <span className="text-lg md:text-xl font-black text-violet-950">{history.length}回 あそんだよ</span>
              </div>
              <div className="bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl p-4 text-center flex flex-col justify-between">
                <span className="text-xs font-black text-emerald-700 block mb-1">せいかいできた数</span>
                <span className="text-lg md:text-xl font-black text-emerald-950">
                  {history.filter(h => h.isCorrect).length}回 できたよ
                </span>
              </div>
              <div className="bg-amber-50/50 border-2 border-amber-100 rounded-2xl p-4 text-center flex flex-col justify-between">
                <span className="text-xs font-black text-amber-700 block mb-1">できた！の割合</span>
                <span className="text-lg md:text-xl font-black text-amber-950">
                  {history.length > 0 
                    ? Math.round((history.filter(h => h.isCorrect).length / history.length) * 100) 
                    : 0}%
                </span>
              </div>
              <div className="bg-sky-50/50 border-2 border-sky-100 rounded-2xl p-4 text-center">
                <span className="text-xs font-black text-sky-700 block mb-1">冒険の進捗</span>
                <span className="text-md md:text-lg font-black text-sky-950 mt-1 block">
                  {unlockedRewards.includes('くだものドラゴン')
                    ? '🏆 ドラゴンげっと！' 
                    : unlockedStageId === STAGES.length 
                      ? '👑 ラストステージ' 
                      : `🐾 ステージ ${unlockedStageId} まで`}
                </span>
              </div>
            </div>

            {/* 🌱 がんばったプロセスの承認 (P2) */}
            <div className="w-full bg-emerald-50/40 border-4 border-emerald-200 rounded-2xl p-5 flex flex-col gap-3 text-left animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-800 border-b border-emerald-200 pb-2">
                <span className="text-xl">🌱</span>
                <h3 className="text-sm font-black">がんばったプロセスの承認（非認知能力）</h3>
              </div>
              <p className="text-xs text-slate-600 font-bold leading-relaxed mb-1">
                点数や正解率だけでなく、お子様が試行錯誤した「プロセス（がんばり）」を褒めてあげるためのデータです。
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-emerald-100 flex flex-col justify-between gap-1 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400">⏱️ がんばった時間</span>
                  <span className="text-sm font-black text-emerald-800">
                    きょうは <span className="text-lg font-black text-emerald-600">{activeTimeToday < 60 ? "1分未満" : `${Math.floor(activeTimeToday / 60)}分`}</span> がんばってとりくみました
                  </span>
                  <p className="text-[9px] text-slate-400 leading-normal">今日アプリを開いて学習した合計時間です。</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-100 flex flex-col justify-between gap-1 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400">🔥 あきらめないちから</span>
                  <span className="text-sm font-black text-emerald-800">
                    まちがえても、もういっかい やってみる ちからが <span className="text-lg font-black text-emerald-600">{retryCount}回</span> でました！
                  </span>
                  <p className="text-[9px] text-slate-400 leading-normal">間違えても諦めずに解き直した回数です。</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-100 flex flex-col justify-between gap-1 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400">🚀 なんどもチャレンジ</span>
                  <span className="text-sm font-black text-emerald-800">
                    おなじもんだいに 最大 <span className="text-lg font-black text-emerald-600">{maxAttempts}回</span> チャレンジしました！
                  </span>
                  <p className="text-[9px] text-slate-400 leading-normal">一つの問題に粘り強く取り組んだ最大の回数です。</p>
                </div>
              </div>
            </div>

            {/* よみあげスピードの設定 (P1) */}
            <div className="w-full bg-violet-50/50 border-4 border-violet-200 rounded-2xl p-5 flex flex-col gap-3 text-left">
              <div className="flex items-center gap-2 text-violet-800 border-b border-violet-200 pb-2">
                <span className="text-xl">⚙️</span>
                <h3 className="text-sm font-black">よみあげスピードの設定</h3>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-1">
                <p className="text-xs text-slate-600 font-bold leading-relaxed">
                  問題文やメッセージの音声読み上げスピードを調整できます。
                </p>
                <div className="flex bg-white border-2 border-violet-200 rounded-xl p-1 shrink-0 self-center sm:self-auto">
                  <button
                    onClick={() => {
                      playSoundEffect('tap');
                      setSpeechRate(1.15);
                      speakText("ふつうのスピードだよ", soundEnabled);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      speechRate === 1.15
                        ? 'bg-violet-500 text-white shadow-sm'
                        : 'text-violet-700 hover:bg-violet-50'
                    }`}
                  >
                    ふつう 🐇
                  </button>
                  <button
                    onClick={() => {
                      playSoundEffect('tap');
                      setSpeechRate(0.85);
                      speakText("ゆっくりスピードだよ", soundEnabled);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      speechRate === 0.85
                        ? 'bg-violet-500 text-white shadow-sm'
                        : 'text-violet-700 hover:bg-violet-50'
                    }`}
                  >
                    ゆっくり 🐢
                  </button>
                </div>
              </div>
            </div>

            {/* 学習カテゴリーごとの分析 */}
            <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 flex flex-col gap-3">
              <h3 className="text-sm font-black text-slate-700 border-b-2 border-slate-200 pb-1">📊 あそんだゲームと できた！の割合</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {/* たしざん（合成） */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200/50 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-slate-500 block">ごうせい（たしざん）</span>
                    <span className="text-sm font-bold text-slate-700">
                      回答: {history.filter(h => h.type === 'synthesis').length}回
                    </span>
                  </div>
                  <span className="text-xl font-black text-orange-500">
                    {history.filter(h => h.type === 'synthesis').length > 0
                      ? Math.round((history.filter(h => h.type === 'synthesis' && h.isCorrect).length / history.filter(h => h.type === 'synthesis').length) * 100)
                      : 0}%
                  </span>
                </div>
                {/* 10づくり */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200/50 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-slate-500 block">10づくり（卵パック）</span>
                    <span className="text-sm font-bold text-slate-700">
                      回答: {history.filter(h => h.type === 'make10').length}回
                    </span>
                  </div>
                  <span className="text-xl font-black text-emerald-500">
                    {history.filter(h => h.type === 'make10').length > 0
                      ? Math.round((history.filter(h => h.type === 'make10' && h.isCorrect).length / history.filter(h => h.type === 'make10').length) * 100)
                      : 0}%
                  </span>
                </div>
                {/* ひきざん */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200/50 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-slate-500 block">ひきざん（のこりはいくつ）</span>
                    <span className="text-sm font-bold text-slate-700">
                      回答: {history.filter(h => h.type === 'subtraction').length}回
                    </span>
                  </div>
                  <span className="text-xl font-black text-rose-500">
                    {history.filter(h => h.type === 'subtraction').length > 0
                      ? Math.round((history.filter(h => h.type === 'subtraction' && h.isCorrect).length / history.filter(h => h.type === 'subtraction').length) * 100)
                      : 0}%
                  </span>
                </div>
                {/* お部屋分け（数の分解） */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200/50 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-slate-500 block">お部屋分け（数の分解）</span>
                    <span className="text-sm font-bold text-slate-700">
                      回答: {history.filter(h => h.type === 'cat_split').length}回
                    </span>
                  </div>
                  <span className="text-xl font-black text-violet-500">
                    {history.filter(h => h.type === 'cat_split').length > 0
                      ? Math.round((history.filter(h => h.type === 'cat_split' && h.isCorrect).length / history.filter(h => h.type === 'cat_split').length) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* こくご（なぞり書き）のしんちょく */}
            <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 flex flex-col gap-3">
              <h3 className="text-sm font-black text-slate-700 border-b-2 border-slate-200 pb-1">✍️ こくご（ひらがななぞり書き）のしんちょく</h3>
              <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200/50 gap-4 w-full">
                <div className="text-center sm:text-left">
                  <span className="text-xs font-black text-slate-500 block">ひらがな れんしゅうの進捗</span>
                  <span className="text-xl font-black text-violet-600">
                    {completedHiragana.length} / 8 文字 クリア
                  </span>
                </div>
                
                <div className="flex gap-2 flex-wrap justify-center">
                  {['し', 'く', 'つ', 'へ', 'い', 'こ', 'り', 'て'].map(char => {
                    const isDone = completedHiragana.includes(char);
                    return (
                      <div
                        key={char}
                        className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black text-md border-2 relative transition-all ${
                          isDone
                            ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm animate-pulse'
                            : 'bg-slate-100 border-slate-200 text-slate-300'
                        }`}
                      >
                        <span className="leading-none">{char}</span>
                        {isDone && (
                          <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-400 text-white rounded-full p-0.5 shadow-xs leading-none">
                            ★
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ☁️ クラウドセーブ ＆ 保護者認証 UI */}
            <div className="w-full bg-violet-50/30 border-2 border-violet-100 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-violet-200/50 pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">☁️</span>
                  <h3 className="text-sm font-black text-violet-800">がんばり記録のクラウド保存・同期</h3>
                </div>
                <div>
                  {syncStatus === 'cloud' && (
                    <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-sm">
                      ● ほぞんずみ
                    </span>
                  )}
                  {syncStatus === 'local' && (
                    <span className="bg-amber-100 text-amber-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-sm animate-pulse">
                      ● このたんまつにほぞん
                    </span>
                  )}
                  {syncStatus === 'syncing' && (
                    <span className="bg-sky-100 text-sky-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-sm animate-pulse">
                      ● つうしんまち
                    </span>
                  )}
                </div>
              </div>

              {authLoading ? (
                <div className="text-center py-4 text-xs font-bold text-slate-400">
                  アカウント状態を確認中... ⏳
                </div>
              ) : user && !user.isAnonymous ? (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="text-left">
                    <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-sm">
                      ✅ クラウド同期中
                    </span>
                    <p className="text-xs text-slate-500 font-bold mt-1.5">
                      メールアドレス: <span className="font-mono text-slate-700 font-black">{user.email}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      進捗データは自動でクラウドに保存され、他の端末と同期されます。
                    </p>
                  </div>
                  <button
                    onClick={handleParentLogout}
                    disabled={isLinking}
                    className="bg-white border-2 border-rose-200 text-rose-500 hover:bg-rose-50 font-black text-xs px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 active:scale-95"
                  >
                    ログアウト ➔
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* アカウント同期切り替えタブ */}
                  <div className="flex border-b border-slate-200">
                    <button
                      onClick={() => { setAuthTab('register'); setParentAuthError(''); }}
                      className={`flex-1 text-center py-2 text-xs font-black transition-all ${
                        authTab === 'register' ? 'border-b-4 border-violet-500 text-violet-700' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      新しいアカウントを作る (クラウド同期)
                    </button>
                    <button
                      onClick={() => { setAuthTab('login'); setParentAuthError(''); }}
                      className={`flex-1 text-center py-2 text-xs font-black transition-all ${
                        authTab === 'login' ? 'border-b-4 border-violet-500 text-violet-700' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      すでに持っているアカウントでログイン (復元)
                    </button>
                  </div>

                  <form onSubmit={authTab === 'register' ? handleParentRegister : handleParentLogin} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 block mb-1">メールアドレス</label>
                        <input
                          type="email"
                          required
                          placeholder="parent@example.com"
                          value={parentEmail}
                          onChange={(e) => setParentEmail(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-bold focus:outline-none focus:border-violet-400 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 block mb-1">パスワード (6文字以上)</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={parentPassword}
                          onChange={(e) => setParentPassword(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-bold focus:outline-none focus:border-violet-400 transition-colors"
                        />
                      </div>
                    </div>

                    {parentAuthError && (
                      <p className="text-[11px] font-black text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-1.5 animate-pulse">
                        ⚠️ {parentAuthError}
                      </p>
                    )}

                    <div className="flex justify-end mt-2">
                      <button
                        type="submit"
                        disabled={isLinking}
                        className="bg-violet-500 hover:bg-violet-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xs px-6 py-2 rounded-xl transition-all shadow active:translate-y-[2px]"
                      >
                        {isLinking ? '処理中...' : authTab === 'register' ? 'クラウド同期を開始する ➔' : 'ログインしてデータをロード ➔'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* 最近のあゆみ（行動ログ） */}
            <div className="w-full flex flex-col gap-2">
              <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 text-left">
                <span>🐾</span>
                最近のあゆみ（こうどうログ）
              </h3>
              {activityLogs.length === 0 ? (
                <div className="text-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold text-xs">
                  まだこうどうの記録がありません。
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto border-2 border-slate-100 rounded-2xl w-full bg-slate-50/30 p-3 flex flex-col gap-2">
                  {activityLogs.slice(0, 20).map((log) => {
                    let icon = '📝';
                    if (log.message.includes('なぞり書き')) icon = '✍️';
                    else if (log.message.includes('クリア！')) icon = '🎉';
                    else if (log.message.includes('はっけん！')) icon = '🐾';
                    else if (log.message.includes('開始！')) icon = '🗺️';
                    else if (log.message.includes('リセット')) icon = '🔄';
                    else if (log.message.includes('かざり')) icon = '🪑';
                    
                    const timeStr = new Date(log.timestamp).toLocaleDateString('ja-JP', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div key={log.id} className="bg-white p-2.5 rounded-xl border border-slate-150 shadow-xs flex items-start gap-2.5 text-xs font-bold">
                        <span className="text-base select-none">{icon}</span>
                        <div className="flex-1 flex flex-col gap-0.5 text-left">
                          <p className="text-slate-800 leading-tight">{log.message}</p>
                          <span className="text-[10px] text-slate-400 font-mono font-semibold">{timeStr}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 回答履歴ログ */}
            <div className="w-full flex flex-col gap-2">
              <h3 className="text-sm font-black text-slate-700">📜 最近の回答履歴（最新20件）</h3>
              {history.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold text-sm">
                  まだ回答データがありません。ゲームで遊ぶと自動で記録されます！
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto border-2 border-slate-100 rounded-2xl w-full">
                  <table className="w-full border-collapse bg-white text-left text-xs md:text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-black">
                      <tr>
                        <th className="p-3">時間</th>
                        <th className="p-3">もんだい</th>
                        <th className="p-3 text-center">回答</th>
                        <th className="p-3 text-center">せいかい</th>
                        <th className="p-3 text-center">結果</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                      {history.slice(0, 20).map((record, index) => {
                        const dateStr = new Date(record.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        return (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="p-3 text-slate-400 font-mono">{dateStr}</td>
                            <td className="p-3 text-slate-800">{record.questionText}</td>
                            <td className="p-3 text-center font-mono">{record.userChoice}</td>
                            <td className="p-3 text-center font-mono">{record.correctAnswer}</td>
                            <td className="p-3 text-center">
                              {record.isCorrect ? (
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">💮 できた！</span>
                              ) : (
                                <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px]">⭐ あとすこし</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 💖 おうちでのあたたかい寄り添い方アドバイス (P2) */}
            <div className="w-full bg-amber-50/50 border-4 border-amber-200 rounded-2xl p-5 flex flex-col gap-3 text-left">
              <div className="flex items-center gap-2 text-amber-800 border-b border-amber-200 pb-2">
                <span className="text-xl">💝</span>
                <h3 className="text-sm font-black">おうちでのあたたかい寄り添い方アドバイス</h3>
              </div>
              <div className="text-xs text-slate-600 font-bold leading-relaxed space-y-3">
                <div className="space-y-1">
                  <h4 className="font-black text-amber-900 text-[11px]">⏳ 利用時間のめやす</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    幼児の集中力は「年齢＋1分」程度と言われています。1日10〜15分程度を目安にし、楽しく終わるタイミングで「またあした遊ぼうね」と声をかけるのが理想的です。
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-amber-900 text-[11px]">💬 間違えてしまったとき</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    「ちがうよ」と否定するのではなく、「オウムさんが食べちゃったね」「お皿のりんご、もういっかい一緒に数えてみようか！」と、ゲームのストーリーに乗せてやさしく促してあげてください。
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-amber-900 text-[11px]">💮 プロセス（がんばり）をほめる</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    「正解したこと」よりも、「最後まで考えたこと」や「なぞり書きを丁寧に書こうとしたこと」など、取り組んでいる姿そのものを「しっかり見ていたよ」と言葉にして伝えてあげると、自信につながります。
                  </p>
                </div>
              </div>
            </div>

            {/* 🔒 データ保存とプライバシーについて (P3) */}
            <div className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 flex flex-col gap-3 text-left">
              <div className="flex items-center gap-2 text-slate-700 border-b border-slate-200 pb-2">
                <span className="text-xl">🔒</span>
                <h3 className="text-sm font-black">データ保存とプライバシーポリシー</h3>
              </div>
              <div className="text-xs text-slate-500 font-bold leading-relaxed space-y-2">
                <p className="text-[10px] leading-normal">
                  本アプリは、お子様の大切な学習データ（回答履歴、進行状況、お部屋の飾りの配置状況など）を安全に保管します。
                </p>
                <ul className="list-disc pl-4 text-[9px] text-slate-400 space-y-1">
                  <li><strong>個人情報の不取得</strong>: お子様の本名、年齢、住所などの個人情報は一切取得いたしません。</li>
                  <li><strong>暗号化による保護</strong>: クラウド保存時の認証用メールアドレスは、Firebase Authを通じて高度に暗号化され、安全に保管されます。</li>
                  <li><strong>ローカル保存対応</strong>: アカウントを作成しない場合でも、ブラウザのローカルストレージを用いて端末内に進行状況が安全に保持されます。</li>
                </ul>
              </div>
            </div>

            {/* ボタンアクション */}
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-between items-center border-t border-slate-100 pt-4">
              <button
                onClick={handleResetProgress}
                className="text-xs font-black text-rose-500 hover:text-rose-600 transition-colors underline cursor-pointer"
              >
                すべての記録と進捗をリセットする
              </button>
              
              <button
                onClick={handleGoMap}
                className="bg-violet-500 hover:bg-violet-600 text-white font-black text-base px-10 py-2.5 rounded-2xl border-b-4 border-violet-700 transition-all active:translate-y-[2px] active:border-b-2 flex items-center gap-1.5"
              >
                <Map className="w-5 h-5" />
                冒険のマップへもどる
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
