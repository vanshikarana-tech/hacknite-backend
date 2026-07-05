import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { chatResponse, AiIssue } from '../services/aiService';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { chatLimiter } from '../middleware/rateLimiter';

const router = Router();
const prisma = new PrismaClient();

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
  issueId: z.string().uuid().optional(),
  scanId: z.string().uuid().optional(),
});

router.post('/', optionalAuth, chatLimiter, async (req: AuthRequest, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid chat request', details: parsed.error.errors });
  }

  const { message, history, issueId, scanId } = parsed.data;

  let issueContext: AiIssue | undefined;
  if (issueId) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (issue) {
      issueContext = {
        id: issue.id,
        wcagCriterion: issue.wcagCriterion,
        wcagName: issue.wcagName,
        description: issue.description,
        severity: issue.severity.toLowerCase() as AiIssue['severity'],
        principle: issue.principle.toLowerCase() as AiIssue['principle'],
        selector: issue.selector || undefined,
        filePath: issue.filePath || undefined,
      };
    }
  }

  const messages = [
    ...history,
    { role: 'user' as const, content: message },
  ];

  const responseText = await chatResponse(messages, { issue: issueContext });

  if (req.userId) {
    await prisma.chatMessage.createMany({
      data: [
        { userId: req.userId, scanId: scanId || null, issueId: issueId || null, role: 'user', content: message },
        { userId: req.userId, scanId: scanId || null, issueId: issueId || null, role: 'assistant', content: responseText },
      ],
    });
  }

  return res.json({ response: responseText, role: 'assistant' });
});

export { router as chatRouter };
