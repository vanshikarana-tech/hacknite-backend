import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { generateFix, AiIssue } from '../services/aiService';
import { optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const fixSchema = z.object({
  codeContext: z.string().min(1).max(50000),
});

router.post('/:issueId', optionalAuth, async (req: AuthRequest, res) => {
  const { issueId } = req.params;

  const parsed = fixSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Code context is required' });
  }

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { scan: true },
  });

  if (!issue) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  const aiIssue: AiIssue = {
    id: issue.id,
    wcagCriterion: issue.wcagCriterion,
    wcagName: issue.wcagName,
    description: issue.description,
    selector: issue.selector || undefined,
    lineNumber: issue.lineNumber || undefined,
    severity: issue.severity.toLowerCase() as AiIssue['severity'],
    principle: issue.principle.toLowerCase() as AiIssue['principle'],
    filePath: issue.filePath || undefined,
  };

  const fixTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(Object.assign(new Error('Fix generation timed out'), { status: 504 })), 30000)
  );

  const fixGeneration = generateFix(aiIssue, parsed.data.codeContext);
  const fixedCode = await Promise.race([fixGeneration, fixTimeout]);

  return res.json({
    issueId,
    originalCode: parsed.data.codeContext,
    fixedCode,
    wcagCriterion: issue.wcagCriterion,
    wcagName: issue.wcagName,
  });
});

router.post('/:issueId/apply', optionalAuth, async (req: AuthRequest, res) => {
  const { issueId } = req.params;
  const { fixedCode } = req.body;

  if (!fixedCode) {
    return res.status(400).json({ error: 'fixedCode is required' });
  }

  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: { resolved: true, appliedFix: fixedCode },
  });

  return res.json({ success: true, issueId: issue.id, resolved: issue.resolved });
});

export { router as fixRouter };
