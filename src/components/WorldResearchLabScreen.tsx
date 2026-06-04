// ============================================================================
// 🧪 せかいけんきゅうじょ — World Research Lab Screen
// Phase WRL-1: HPメーター + SOSログ + localStorage保存 + 直近履歴表示
// ============================================================================

import React, { useState, useCallback } from 'react';
import type { WorldResearchLabLog, SignKey } from '../types/worldResearchLab';
import {
  SIGN_LABELS,
  SIGN_KEYS,
  getHpMessage,
  createEmptySigns,
} from '../types/worldResearchLab';
import {
  loadWorldResearchLabLogs,
  addWorldResearchLabLog,
  clearWorldResearchLabLogs,
  exportWorldResearchLabLogsJson,
} from '../utils/worldResearchLabStorage';

// ============================================================================
// Props
// ============================================================================

interface WorldResearchLabScreenProps {
  onGoBack: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const WorldResearchLabScreen: React.FC<WorldResearchLabScreenProps> = ({
  onGoBack,
}) => {
  // --- State ---
  const [hp, setHp] = useState<number>(5);
  const [signs, setSigns] = useState(createEmptySigns);
  const [logs, setLogs] = useState<WorldResearchLabLog[]>(loadWorldResearchLabLogs);
  const [saved, setSaved] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copyResult, setCopyResult] = useState<'success' | 'fallback' | null>(null);

  // --- Handlers ---
  const handleToggleSign = useCallback((key: SignKey) => {
    setSigns(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }, []);

  const handleHpChange = useCallback((value: number) => {
    setHp(value);
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    const now = new Date();
    const log: WorldResearchLabLog = {
      id: `wrl_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now.toISOString(),
      displayDate: now.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      hp,
      signs: { ...signs },
    };
    const updated = addWorldResearchLabLog(log);
    setLogs(updated);
    setSaved(true);
    // 3秒後に保存メッセージを消す
    setTimeout(() => setSaved(false), 3000);
  }, [hp, signs]);

  const handleClearLogs = useCallback(() => {
    clearWorldResearchLabLogs();
    setLogs([]);
    setShowClearConfirm(false);
  }, []);

  const handleExportJson = useCallback(async () => {
    const json = exportWorldResearchLabLogsJson(logs);
    try {
      await navigator.clipboard.writeText(json);
      setCopyResult('success');
    } catch {
      setCopyResult('fallback');
    }
    setTimeout(() => setCopyResult(null), 3000);
  }, [logs]);

  // --- HP message ---
  const hpInfo = getHpMessage(hp);

  // --- HP color helpers ---


  const getHpBarColor = (hp: number): string => {
    if (hp <= 3) return 'bg-violet-400';
    if (hp <= 6) return 'bg-amber-400';
    return 'bg-emerald-400';
  };

  const getHpMsgBg = (hp: number): string => {
    if (hp <= 3) return 'bg-violet-50/90 border-violet-300 text-violet-800';
    if (hp <= 6) return 'bg-amber-50/90 border-amber-300 text-amber-950';
    return 'bg-emerald-50/90 border-emerald-300 text-emerald-950';
  };

  // --- Active signs for log display ---
  const getActiveSignLabels = (logSigns: WorldResearchLabLog['signs']): string => {
    return SIGN_KEYS
      .filter(k => logSigns[k])
      .map(k => SIGN_LABELS[k].label)
      .join('、');
  };

  const getLogHpLabel = (logHp: number): string => {
    if (logHp <= 3) return '→ じゅうでんモード';
    if (logHp <= 6) return '→ ゆっくりモード';
    return '→ いいかんじ';
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="w-full max-w-2xl bg-white bg-[linear-gradient(to_right,rgba(226,232,240,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,0.15)_1px,transparent_1px)] [background-size:24px_24px] border-8 border-violet-300 rounded-3xl p-6 shadow-2xl flex flex-col gap-6 my-4 animate-scaleUp">

      {/* ヘッダー */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl md:text-3xl font-black text-violet-600 flex items-center gap-1.5 justify-center">
          <span>🧪</span> せかいけんきゅうじょ
        </h2>
        <p className="text-xs font-bold text-slate-500">
          じぶんの こころと からだの けんきゅう
        </p>
      </div>

      {/* 説明文 */}
      <div className="bg-violet-50/60 border-2 border-violet-100 rounded-2xl p-4 text-center">
        <p className="text-sm font-bold text-violet-700 leading-relaxed">
          きょうの こころバッテリーを しらべよう。<br />
          1でも だいじょうぶ。すくない日は じゅうでんの日です。
        </p>
      </div>

      {/* ─── HPメーター ─── */}
      <div className="space-y-3">
        <h3 className="text-lg font-black text-violet-700 flex items-center gap-1.5">
          <span>🔋</span> こころの バッテリー
        </h3>

        {/* HPバー型 10セグメントボタン */}
        <div 
          className="flex gap-1.5 w-full p-1.5 bg-slate-100 border-2 border-slate-200 rounded-2xl"
          role="radiogroup"
          aria-label="こころバッテリーのじゅうでんりょう"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map(value => {
            const isActive = value <= hp;
            const activeColor = getHpBarColor(hp);
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={hp === value}
                aria-label={`こころバッテリー ${value}`}
                aria-pressed={hp === value}
                onClick={() => handleHpChange(value)}
                className={`flex-1 h-12 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center font-black text-sm relative border-b-2 ${
                  isActive 
                    ? `${activeColor} text-white shadow-sm border-black/10`
                    : 'bg-slate-200/40 text-slate-400 hover:bg-slate-200 border-slate-300/50'
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>

        {/* HPメッセージ（カードモニター） */}
        <div className={`border-3 rounded-2xl p-4 text-center shadow-inner transition-colors duration-300 ${getHpMsgBg(hp)}`}>
          <p className="text-sm md:text-base font-black leading-relaxed">
            <span className="text-xl mr-1.5 inline-block">{hpInfo.emoji}</span>
            {hpInfo.message}
          </p>
        </div>
      </div>

      {/* ─── SOSサイン ─── */}
      <div className="space-y-3">
        <h3 className="text-lg font-black text-violet-700 flex items-center gap-1.5">
          <span>📋</span> こころとからだのセンサー
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SIGN_KEYS.map(key => {
            const info = SIGN_LABELS[key];
            const isChecked = signs[key];
            return (
              <button
                key={key}
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                aria-label={info.label}
                onClick={() => handleToggleSign(key)}
                className={`flex flex-col items-center justify-between p-4 rounded-2xl border-3 font-black text-xs text-center transition-all active:scale-95 cursor-pointer min-h-[120px] ${
                  isChecked
                    ? 'bg-violet-100/90 border-violet-400 text-violet-900 shadow-md'
                    : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <span className={`text-3xl my-1 block transition-transform ${isChecked ? 'scale-110' : ''}`}>
                  {info.emoji}
                </span>
                <span className="flex-1 flex items-center justify-center leading-tight px-1 mb-1">
                  {info.label}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold mt-1 ${
                  isChecked 
                    ? 'bg-violet-200 text-violet-800' 
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {isChecked ? 'きょうのサイン' : 'しらべる'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 保存ボタン ─── */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white font-black text-base md:text-lg py-4 px-8 rounded-2xl border-b-4 border-violet-800 shadow-md transition-all active:translate-y-[1px] active:border-b-3 cursor-pointer flex items-center justify-center gap-2"
        >
          <span>📝</span>
          けんきゅうカードを ほぞんする
        </button>

        {/* 保存成功メッセージ */}
        {saved && (
          <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-700 font-black text-sm py-2 px-4 rounded-xl animate-scaleUp">
            💮 きょうの けんきゅうを のこしました
          </div>
        )}
      </div>

      {/* ─── 親向け履歴エリア（折りたたみ） ─── */}
      <div className="border-t-2 border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-2xl p-3 cursor-pointer transition-colors active:scale-[0.99]"
          aria-expanded={historyOpen}
        >
          <span className="font-black text-sm text-slate-600 flex items-center gap-1.5">
            <span>🔒</span> パパ・ママ用 けんきゅうログ
          </span>
          <span className="text-slate-400 font-bold text-lg">
            {historyOpen ? '▲' : '▼'}
          </span>
        </button>

        {historyOpen && (
          <div className="mt-3 space-y-3 animate-scaleUp">

            {/* ログ一覧 */}
            {logs.length === 0 ? (
              <p className="text-center text-sm text-slate-400 font-bold py-4">
                まだ けんきゅうデータが ありません
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {logs.map(log => {
                  const activeSignsText = getActiveSignLabels(log.signs);
                  const hpLabel = getLogHpLabel(log.hp);
                  return (
                    <div
                      key={log.id}
                      className={`border-2 rounded-xl p-3 text-xs leading-relaxed ${
                        log.hp <= 3
                          ? 'bg-violet-50/50 border-violet-200'
                          : log.hp <= 6
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-emerald-50/50 border-emerald-200'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-black text-slate-700">
                          {log.displayDate}
                        </span>
                        <span className="font-black text-slate-500 flex-shrink-0">
                          HP {log.hp} / 10
                        </span>
                      </div>
                      {activeSignsText && (
                        <p className="text-slate-500 font-bold mt-1">
                          サイン：{activeSignsText}
                        </p>
                      )}
                      <p className="font-black text-slate-600 mt-0.5">{hpLabel}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 管理操作 */}
            {logs.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                {/* JSONエクスポート */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="text-xs font-black text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    📋 JSONをコピー
                  </button>
                </div>

                {/* ログ整理（さらに折りたたみ） */}
                <details className="bg-slate-50 border border-slate-200 rounded-xl">
                  <summary className="text-[10px] font-black text-slate-400 cursor-pointer px-3 py-2 select-none hover:text-slate-600 transition-colors">
                    🔧 パパ・ママ用：けんきゅうログを整理する
                  </summary>
                  <div className="px-3 pb-3 pt-1">
                    {!showClearConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(true)}
                        className="text-xs font-black text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                      >
                        🗑️ けんきゅうログをすべてクリアする
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 bg-rose-50 border-2 border-rose-300 rounded-xl px-3 py-2 animate-scaleUp">
                        <span className="text-xs font-black text-rose-600">
                          けんきゅうログをすべて消します。よろしいですか？
                        </span>
                        <button
                          type="button"
                          onClick={handleClearLogs}
                          className="text-xs font-black bg-rose-500 hover:bg-rose-600 text-white px-3 py-1 rounded-lg cursor-pointer transition-colors"
                        >
                          消す
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(false)}
                          className="text-xs font-black bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-1 rounded-lg cursor-pointer transition-colors"
                        >
                          やめる
                        </button>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* コピー結果 */}
            {copyResult === 'success' && (
              <p className="text-xs font-bold text-emerald-600 text-right animate-scaleUp">
                ✅ JSONをクリップボードにコピーしました
              </p>
            )}
            {copyResult === 'fallback' && (
              <div className="animate-scaleUp">
                <p className="text-xs font-bold text-amber-600 mb-1">
                  ⚠️ コピーできませんでした。以下をコピーしてください：
                </p>
                <textarea
                  readOnly
                  value={exportWorldResearchLabLogsJson(logs)}
                  className="w-full h-32 text-[10px] font-mono bg-slate-50 border border-slate-200 rounded-lg p-2 resize-none"
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── もどるボタン ─── */}
      <div className="flex justify-center border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onGoBack}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-6 py-2.5 rounded-2xl border-b-3 border-slate-300 transition-all active:translate-y-[1px] active:border-b-2 text-sm cursor-pointer"
        >
          <span>🏡</span>
          ひろばに もどる
        </button>
      </div>
    </div>
  );
};
