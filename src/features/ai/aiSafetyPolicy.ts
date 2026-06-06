/**
 * ひなたアプリ AI安全ポリシー定義
 */

export const CURRENT_POLICY_VERSION = '1.0.0';

/**
 * 診断、専門的評価、および決めつけに関連する禁止表現の定義
 * 
 * ひなたアプリのAIは「保護者向け翻訳補助」であり、
 * 子どもの評価・診断・原因推定を行うことは厳格に禁止されています。
 */
export const BLOCKED_KEYWORDS = [
  // 診断名・障害名
  '自閉症',
  '自閉スペクトラム',
  'アスペルガー',
  '発達障害',
  'ADHD',
  '注意欠陥',
  '多動性障害',
  '学習障害',
  'LD',
  '知的障害',
  '精神遅滞',
  '障害の可能性',
  '障害があります',
  '～症',

  // 評価・診断・アセスメント行為を示す言葉
  '診断',
  'アセスメント',
  '判定',
  '検査を推奨',
  '発達検査',
  '知能指数',
  'IQ',
  'レベル',
  '評価します',
  '評価は',

  // 原因推定・断定・決めつけ
  'が原因',
  'のせい',
  '原因は',
  '原因です',
  '傾向があります',
  '傾向があるため',
  'だからできない',
  'するはずです',
  'に問題がある',
  'の欠陥',
  '異常',

  // 医療的、カウンセリング的な過度な介入を想起させる言葉
  '治療',
  '療育が必要',
  'セラピー',
  'カウンセリングを推奨',
  '医学的',
  '医師に相談',
];

/**
 * メタデータおよびフィールドのチェック要件
 */
export const POLICY_RULES = {
  /** 必須プロパティの検証 */
  requiredFields: [
    'message',
    'promptVersion',
    'policyVersion',
    'usedFactIds',
    'riskFlags',
    'status',
  ] as const,
  
  /** 許容されるステータス */
  allowedStatuses: ['generated', 'approved', 'rejected', 'retired'] as const,

  /** 許容されるリスクフラグ */
  allowedRiskFlags: ['unsupported_claim', 'medical_advice', 'harmful_content', 'other'] as const,
};
