export type AiReviewStatus = 'generated' | 'approved' | 'rejected' | 'retired';

export type AiRiskFlag = 'unsupported_claim' | 'medical_advice' | 'harmful_content' | 'other';

export interface AiOutput {
  /** AIによって生成されたメッセージ */
  message: string;
  /** 生成の根拠となったアプリ内事実IDの一覧 */
  usedFactIds: string[];
  /** 検出されたリスクの種類を示すフラグ（正常時は空配列） */
  riskFlags: AiRiskFlag[];
  /** プロンプトのテンプレートバージョン */
  promptVersion: string;
  /** 安全ガイドライン(ポリシー)のバージョン */
  policyVersion: string;
  /** 出力のレビュー/検証ステータス */
  status: AiReviewStatus;
  /** レビュー担当者の識別子 (status === 'approved' の場合は必須) */
  reviewedBy?: string;
  /** レビュー日時 */
  reviewedAt?: string;
}

export interface SafetyValidationResult {
  /** 安全ポリシーを満たしているかどうか */
  isValid: boolean;
  /** 検出された禁止用語の一覧 */
  blockedTerms: string[];
  /** 検証エラーメッセージ */
  errors: string[];
  /** 警告メッセージ (generatedステータスのレビュー担当者不在など) */
  warnings: string[];
}
