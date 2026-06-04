// ============================================================================
// World Research Lab (せかいけんきゅうじょ) — localStorage ユーティリティ
// ============================================================================

import type { WorldResearchLabLog } from '../types/worldResearchLab';

const STORAGE_KEY = 'hinata_world_research_lab_logs_v1';
const MAX_LOGS = 30;

/**
 * localStorageからログを読み込む。
 * JSON parse失敗時はクラッシュさせず、空配列にフォールバックする。
 */
export function loadWorldResearchLabLogs(): WorldResearchLabLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 不正な形状のアイテムを除外し、クラッシュを防ぐ
    return parsed.filter(
      (item): item is WorldResearchLabLog =>
        item != null &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.hp === 'number' &&
        typeof item.signs === 'object' &&
        item.signs != null
    );
  } catch {
    return [];
  }
}

/**
 * ログ配列をlocalStorageに保存する。
 * 最新30件のみ保持する。
 */
export function saveWorldResearchLabLogs(logs: WorldResearchLabLog[]): void {
  try {
    const trimmed = logs.slice(0, MAX_LOGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage が満杯、または無効化されている場合は無視する
  }
}

/**
 * 新しいログを先頭に追加し、最新30件に切り詰めて保存する。
 * 保存後のログ配列を返す。
 */
export function addWorldResearchLabLog(log: WorldResearchLabLog): WorldResearchLabLog[] {
  const existing = loadWorldResearchLabLogs();
  const updated = [log, ...existing].slice(0, MAX_LOGS);
  saveWorldResearchLabLogs(updated);
  return updated;
}

/**
 * ログをすべて削除する。
 */
export function clearWorldResearchLabLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
}

/**
 * ログ配列をJSON文字列にエクスポートする。
 */
export function exportWorldResearchLabLogsJson(logs: WorldResearchLabLog[]): string {
  return JSON.stringify(logs, null, 2);
}
