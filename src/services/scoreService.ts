import { AiIssue } from './aiService';

export interface ScoreResult {
  score: number;
  perceivableScore: number;
  operableScore: number;
  understandableScore: number;
  robustScore: number;
}

const SEVERITY_PENALTIES: Record<string, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
};

function computeScore(issues: AiIssue[]): number {
  if (issues.length === 0) return 100;
  const penalty = issues.reduce((sum, issue) => {
    return sum + (SEVERITY_PENALTIES[issue.severity] || 0);
  }, 0);
  return Math.max(0, 100 - penalty);
}

export function computeScores(issues: AiIssue[]): ScoreResult {
  const overall = computeScore(issues);
  const perceivable = computeScore(issues.filter((i) => i.principle === 'perceivable'));
  const operable = computeScore(issues.filter((i) => i.principle === 'operable'));
  const understandable = computeScore(issues.filter((i) => i.principle === 'understandable'));
  const robust = computeScore(issues.filter((i) => i.principle === 'robust'));

  return {
    score: overall,
    perceivableScore: perceivable,
    operableScore: operable,
    understandableScore: understandable,
    robustScore: robust,
  };
}

export function getScoreColor(score: number): string {
  if (score >= 75) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}
