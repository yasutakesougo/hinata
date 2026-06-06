import { describe, it, expect } from 'vitest';
import { validateAiOutput } from '../validateAiOutput';
import { CURRENT_POLICY_VERSION } from '../aiSafetyPolicy';
import type { AiOutput } from '../types';

describe('validateAiOutput', () => {
  const allowedFacts = ['fact-123', 'fact-456'];
  const validOutputBase: AiOutput = {
    message: 'お子さまは今日、おやつの時間に5つのブロックをきれいに並べて遊んでいました。とても集中している様子でした。',
    usedFactIds: ['fact-123'],
    riskFlags: [],
    promptVersion: '1.2.0',
    policyVersion: CURRENT_POLICY_VERSION,
    status: 'approved',
    reviewedBy: 'educator-hash-01',
    reviewedAt: '2026-06-06T12:00:00Z',
  };

  it('正常系: 安全な文章と正しいメタデータが合格すること', () => {
    const result = validateAiOutput(validOutputBase, allowedFacts);
    expect(result.isValid).toBe(true);
    expect(result.blockedTerms).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('異常系: 診断を想起させる言葉（自閉症）が含まれる場合に不合格となること', () => {
    const invalidOutput: AiOutput = {
      ...validOutputBase,
      message: 'お子さまがブロックを並べる行動は、自閉症の傾向が見られます。',
    };

    const result = validateAiOutput(invalidOutput, allowedFacts);
    expect(result.isValid).toBe(false);
    expect(result.blockedTerms).toContain('自閉症');
    expect(result.errors[0]).toContain('安全ポリシーに違反する禁止表現が検出されました');
  });

  it('異常系: 原因の断定（〜が原因）が含まれる場合に不合格となること', () => {
    const invalidOutput: AiOutput = {
      ...validOutputBase,
      message: 'ブロックの片付けができないのは、集中力が足りないのが原因です。',
    };

    const result = validateAiOutput(invalidOutput, allowedFacts);
    expect(result.isValid).toBe(false);
    expect(result.blockedTerms).toContain('原因です');
    expect(result.errors[0]).toContain('安全ポリシーに違反する禁止表現が検出されました');
  });

  it('異常系: message が空文字の場合は不合格となること', () => {
    const invalidOutput: AiOutput = {
      ...validOutputBase,
      message: '   ',
    };

    const result = validateAiOutput(invalidOutput, allowedFacts);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('message が空文字です');
  });

  it('異常系: usedFactIds に存在しない factId が含まれる場合は不合格となること', () => {
    const invalidOutput: AiOutput = {
      ...validOutputBase,
      usedFactIds: ['fact-123', 'fact-not-exist'], // fact-not-existは存在しない
    };

    const result = validateAiOutput(invalidOutput, allowedFacts);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('存在しない事実IDが参照されました: "fact-not-exist"');
  });

  it('異常系: usedFactIds が空配列の場合に不合格となること', () => {
    const invalidOutput: AiOutput = {
      ...validOutputBase,
      usedFactIds: [],
    };

    const result = validateAiOutput(invalidOutput, allowedFacts);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('usedFactIds は1つ以上のIDを含む必要があります');
  });

  it('異常系: riskFlags に unsupported_claim が含まれる場合は不合格となること', () => {
    const invalidOutput: AiOutput = {
      ...validOutputBase,
      riskFlags: ['unsupported_claim'],
    };

    const result = validateAiOutput(invalidOutput, allowedFacts);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('安全ポリシー違反: リスクフラグが検出されました [unsupported_claim]');
  });

  it('異常系: status が approved なのに reviewedBy がない場合は不合格となること', () => {
    const invalidOutput: AiOutput = {
      ...validOutputBase,
      status: 'approved',
      reviewedBy: undefined, // レビュー者不在
    };

    const result = validateAiOutput(invalidOutput, allowedFacts);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('ステータスが "approved" ですが、レビュー担当者 (reviewedBy) が指定されていません');
  });

  it('正常系＆警告: status が generated の場合は reviewedBy がなくても isValid は true であり warnings に入ること', () => {
    const generatedOutput: AiOutput = {
      ...validOutputBase,
      status: 'generated',
      reviewedBy: undefined, // 未レビュー
    };

    const result = validateAiOutput(generatedOutput, allowedFacts);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('人間のレビュー (reviewedBy) が完了していません');
  });

  it('異常系: 必須フィールドが不足している場合に不合格となること', () => {
    const invalidOutput = {
      message: 'テストメッセージ',
      usedFactIds: ['fact-123'],
      // promptVersion などが不足
    };

    const result = validateAiOutput(invalidOutput, allowedFacts);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(err => err.includes('必須フィールド'))).toBe(true);
  });
});
