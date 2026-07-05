import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { unauthenticatedScanLimiter, authenticatedScanLimiter } from '../middleware/rateLimiter';
import { runUrlScan, runCodeScan, runGithubScan } from '../services/scanService';

const router = Router();

const urlScanSchema = z.object({
  url: z.string().url().refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
    message: 'URL must start with http:// or https://',
  }),
});

const codeScanSchema = z.object({
  code: z.string().min(1).max(500 * 1024),
});

const githubScanSchema = z.object({
  repoUrl: z.string().url().refine((u) => u.includes('github.com'), {
    message: 'Must be a valid GitHub repository URL',
  }),
});

router.post('/url',
  optionalAuth,
  unauthenticatedScanLimiter,
  authenticatedScanLimiter,
  async (req: AuthRequest, res) => {
    const parsed = urlScanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid URL', details: parsed.error.errors });
    }

    const result = await runUrlScan(parsed.data.url, req.userId);
    return res.json(result);
  }
);

router.post('/code',
  optionalAuth,
  unauthenticatedScanLimiter,
  authenticatedScanLimiter,
  async (req: AuthRequest, res) => {
    const parsed = codeScanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid code input', details: parsed.error.errors });
    }

    const result = await runCodeScan(parsed.data.code, req.userId);
    return res.json(result);
  }
);

router.post('/github',
  optionalAuth,
  unauthenticatedScanLimiter,
  authenticatedScanLimiter,
  async (req: AuthRequest, res) => {
    const parsed = githubScanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid GitHub URL', details: parsed.error.errors });
    }

    const result = await runGithubScan(parsed.data.repoUrl, req.userId);
    return res.json(result);
  }
);

export { router as scanRouter };
