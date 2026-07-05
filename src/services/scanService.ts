import { PrismaClient, ScanType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { capturePageData } from './playwrightService';
import { analyzeCode, analyzeScreenshot, AiIssue } from './aiService';
import { fetchRepositoryFiles, parseGitHubUrl } from './githubService';
import { computeScores } from './scoreService';
import { validateUrl } from '../middleware/ssrfProtection';

const prisma = new PrismaClient();

export interface ScanResult {
  scanId: string;
  score: number;
  principles: { perceivable: number; operable: number; understandable: number; robust: number };
  issues: AiIssue[];
  screenshotUrl?: string;
  domSnapshot?: string;
  truncated?: boolean;
  createdAt: string;
}

function deduplicateIssues(issues: AiIssue[]): AiIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.wcagCriterion}-${issue.selector}-${issue.filePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runUrlScan(url: string, userId?: string): Promise<ScanResult> {
  const validation = await validateUrl(url);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.reason || 'Invalid URL'), { status: 422 });
  }

  let screenshotBase64 = '';
  let domSnapshot = '';

  try {
    const pageData = await capturePageData(url);
    screenshotBase64 = pageData.screenshotBase64;
    domSnapshot = pageData.domSnapshot;
  } catch (err) {
    throw Object.assign(
      new Error(`Could not load the URL: ${(err as Error).message}`),
      { status: 422 }
    );
  }

  const [visualIssues, codeIssues] = await Promise.all([
    analyzeScreenshot(screenshotBase64, domSnapshot),
    analyzeCode(domSnapshot),
  ]);

  const allIssues = deduplicateIssues([...visualIssues, ...codeIssues]);
  const scores = computeScores(allIssues);

  const scan = await prisma.scan.create({
    data: {
      id: uuidv4(),
      userId: userId || null,
      scanType: ScanType.URL,
      targetUrl: url,
      score: scores.score,
      perceivableScore: scores.perceivableScore,
      operableScore: scores.operableScore,
      understandableScore: scores.understandableScore,
      robustScore: scores.robustScore,
      screenshotUrl: screenshotBase64 ? `data:image/png;base64,${screenshotBase64.slice(0, 100)}...` : null,
      domSnapshot: domSnapshot.slice(0, 50000),
      issues: {
        create: allIssues.map((issue) => ({
          wcagCriterion: issue.wcagCriterion,
          wcagName: issue.wcagName,
          description: issue.description,
          selector: issue.selector || null,
          lineNumber: issue.lineNumber || null,
          severity: issue.severity.toUpperCase() as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
          principle: issue.principle.toUpperCase() as 'PERCEIVABLE' | 'OPERABLE' | 'UNDERSTANDABLE' | 'ROBUST',
          filePath: issue.filePath || null,
        })),
      },
    },
  });

  return {
    scanId: scan.id,
    score: scores.score,
    principles: {
      perceivable: scores.perceivableScore,
      operable: scores.operableScore,
      understandable: scores.understandableScore,
      robust: scores.robustScore,
    },
    issues: allIssues,
    screenshotUrl: `data:image/png;base64,${screenshotBase64}`,
    domSnapshot,
    createdAt: scan.createdAt.toISOString(),
  };
}

export async function runCodeScan(code: string, userId?: string): Promise<ScanResult> {
  if (Buffer.byteLength(code, 'utf8') > 500 * 1024) {
    throw Object.assign(new Error('Code snippet exceeds 500 KB limit'), { status: 422 });
  }

  const issues = await analyzeCode(code);
  const scores = computeScores(issues);

  const scan = await prisma.scan.create({
    data: {
      id: uuidv4(),
      userId: userId || null,
      scanType: ScanType.CODE,
      codeSnippet: code.slice(0, 50000),
      score: scores.score,
      perceivableScore: scores.perceivableScore,
      operableScore: scores.operableScore,
      understandableScore: scores.understandableScore,
      robustScore: scores.robustScore,
      issues: {
        create: issues.map((issue) => ({
          wcagCriterion: issue.wcagCriterion,
          wcagName: issue.wcagName,
          description: issue.description,
          selector: issue.selector || null,
          lineNumber: issue.lineNumber || null,
          severity: issue.severity.toUpperCase() as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
          principle: issue.principle.toUpperCase() as 'PERCEIVABLE' | 'OPERABLE' | 'UNDERSTANDABLE' | 'ROBUST',
          filePath: issue.filePath || null,
        })),
      },
    },
  });

  return {
    scanId: scan.id,
    score: scores.score,
    principles: {
      perceivable: scores.perceivableScore,
      operable: scores.operableScore,
      understandable: scores.understandableScore,
      robust: scores.robustScore,
    },
    issues,
    createdAt: scan.createdAt.toISOString(),
  };
}

export async function runGithubScan(repoUrl: string, userId?: string): Promise<ScanResult> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw Object.assign(new Error('Invalid GitHub repository URL'), { status: 422 });
  }

  const { files, truncated } = await fetchRepositoryFiles(parsed.owner, parsed.repo);

  const allIssues: AiIssue[] = [];
  for (const file of files) {
    const fileIssues = await analyzeCode(file.content, file.path);
    allIssues.push(...fileIssues);
  }

  const scores = computeScores(allIssues);
  const issuesByFile = allIssues.reduce((acc, issue) => {
    const key = issue.filePath || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {} as Record<string, AiIssue[]>);

  const scan = await prisma.scan.create({
    data: {
      id: uuidv4(),
      userId: userId || null,
      scanType: ScanType.GITHUB,
      targetRepo: repoUrl,
      score: scores.score,
      perceivableScore: scores.perceivableScore,
      operableScore: scores.operableScore,
      understandableScore: scores.understandableScore,
      robustScore: scores.robustScore,
      truncated,
      issues: {
        create: allIssues.map((issue) => ({
          wcagCriterion: issue.wcagCriterion,
          wcagName: issue.wcagName,
          description: issue.description,
          selector: issue.selector || null,
          lineNumber: issue.lineNumber || null,
          severity: issue.severity.toUpperCase() as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
          principle: issue.principle.toUpperCase() as 'PERCEIVABLE' | 'OPERABLE' | 'UNDERSTANDABLE' | 'ROBUST',
          filePath: issue.filePath || null,
        })),
      },
    },
  });

  return {
    scanId: scan.id,
    score: scores.score,
    principles: {
      perceivable: scores.perceivableScore,
      operable: scores.operableScore,
      understandable: scores.understandableScore,
      robust: scores.robustScore,
    },
    issues: allIssues,
    truncated,
    createdAt: scan.createdAt.toISOString(),
  };

  // Suppress unused variable warning
  void issuesByFile;
}
