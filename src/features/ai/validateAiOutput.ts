import type { AiOutput, SafetyValidationResult } from './types';
import { BLOCKED_KEYWORDS, CURRENT_POLICY_VERSION, POLICY_RULES } from './aiSafetyPolicy';

/**
 * AIから出力されたオブジェクトを安全ポリシーに基づいて検証します。
 * 
 * @param output 検証対象のオブジェクト
 * @param validFactIds アプリ内に存在する客観的事実ID（factId）のリスト。usedFactIdsの存在検証に使用します。
 * @returns 検証結果（isValid, blockedTerms, errors, warnings）
 */
export function validateAiOutput(output: unknown, validFactIds: string[]): SafetyValidationResult {
  const result: SafetyValidationResult = {
    isValid: true,
    blockedTerms: [],
    errors: [],
    warnings: [],
  };

  // 1. 基本的な型チェック
  if (!output || typeof output !== 'object') {
    result.isValid = false;
    result.errors.push('AI出力がオブジェクトではありません。');
    return result;
  }

  const aiOutput = output as Partial<AiOutput>;

  // 2. 必須フィールドの存在チェック
  for (const field of POLICY_RULES.requiredFields) {
    if (!(field in aiOutput)) {
      result.isValid = false;
      result.errors.push(`必須フィールド "${field}" が不足しています。`);
    }
  }

  // 3. ポリシーバージョンのチェック
  if (aiOutput.policyVersion && aiOutput.policyVersion !== CURRENT_POLICY_VERSION) {
    result.isValid = false;
    result.errors.push(
      `ポリシーバージョンが不一致です。期待値: "${CURRENT_POLICY_VERSION}", 取得値: "${aiOutput.policyVersion}"`
    );
  }

  // 4. ステータスの正当性チェック
  if (aiOutput.status && !POLICY_RULES.allowedStatuses.includes(aiOutput.status)) {
    result.isValid = false;
    result.errors.push(`無効なステータスです: "${aiOutput.status}"`);
  }

  // 5. メッセージのチェック (空文字NG)
  if (aiOutput.message !== undefined) {
    if (typeof aiOutput.message !== 'string') {
      result.isValid = false;
      result.errors.push('message が文字列ではありません。');
    } else if (aiOutput.message.trim() === '') {
      result.isValid = false;
      result.errors.push('message が空文字です。');
    }
  }

  // 6. 根拠性（Grounding）チェック
  if (aiOutput.usedFactIds) {
    if (!Array.isArray(aiOutput.usedFactIds)) {
      result.isValid = false;
      result.errors.push('usedFactIds は配列である必要があります。');
    } else if (aiOutput.usedFactIds.length === 0) {
      result.isValid = false;
      result.errors.push('事実に基づいた生成であることを保証するため、usedFactIds は1つ以上のIDを含む必要があります。');
    } else {
      // 存在しない factId の検証
      for (const factId of aiOutput.usedFactIds) {
        if (typeof factId !== 'string' || factId.trim() === '') {
          result.isValid = false;
          result.errors.push('usedFactIds に無効なID（空文字）が含まれています。');
        } else if (!validFactIds.includes(factId)) {
          result.isValid = false;
          result.errors.push(`存在しない事実IDが参照されました: "${factId}"`);
        }
      }
    }
  }

  // 7. リスクフラグの検証
  if (aiOutput.riskFlags) {
    if (!Array.isArray(aiOutput.riskFlags)) {
      result.isValid = false;
      result.errors.push('riskFlags は配列である必要があります。');
    } else {
      // 無効なリスクフラグの検出
      for (const flag of aiOutput.riskFlags) {
        if (!POLICY_RULES.allowedRiskFlags.includes(flag as any)) {
          result.isValid = false;
          result.errors.push(`無効なリスクフラグが指定されています: "${flag}"`);
        }
      }

      // 何らかのリスクフラグが存在する場合はポリシー違反として差し止め
      if (aiOutput.riskFlags.length > 0) {
        result.isValid = false;
        result.errors.push(`安全ポリシー違反: リスクフラグが検出されました [${aiOutput.riskFlags.join(', ')}]`);
      }
    }
  }

  // 8. レビュー状態とreviewedByの連動チェック
  if (aiOutput.status) {
    if (aiOutput.status === 'approved') {
      if (!aiOutput.reviewedBy || typeof aiOutput.reviewedBy !== 'string' || aiOutput.reviewedBy.trim() === '') {
        result.isValid = false;
        result.errors.push('ステータスが "approved" ですが、レビュー担当者 (reviewedBy) が指定されていません。');
      }
    } else if (aiOutput.status === 'generated') {
      if (!aiOutput.reviewedBy || aiOutput.reviewedBy.trim() === '') {
        // warning扱い
        result.warnings.push('ステータスが "generated" であり、人間のレビュー (reviewedBy) が完了していません。');
      }
    }
  }

  // 9. 禁止表現の検知 (messageの文言スキャン)
  if (typeof aiOutput.message === 'string') {
    const textToSearch = aiOutput.message;
    for (const keyword of BLOCKED_KEYWORDS) {
      if (textToSearch.includes(keyword)) {
        result.isValid = false;
        result.blockedTerms.push(keyword);
      }
    }

    if (result.blockedTerms.length > 0) {
      result.errors.push(
        `安全ポリシーに違反する禁止表現が検出されました: [${result.blockedTerms.join(', ')}]`
      );
    }
  }

  return result;
}
