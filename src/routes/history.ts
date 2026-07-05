import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const PAGE_SIZE = 20;

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const search = String(req.query.search || '');
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    userId: req.userId,
    ...(search ? {
      OR: [
        { targetUrl: { contains: search, mode: 'insensitive' as const } },
        { targetRepo: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      include: { _count: { select: { issues: true } } },
    }),
    prisma.scan.count({ where }),
  ]);

  return res.json({
    scans: scans.map((scan) => ({
      id: scan.id,
      scanType: scan.scanType,
      targetUrl: scan.targetUrl,
      targetRepo: scan.targetRepo,
      score: scan.score,
      issueCount: scan._count.issues,
      createdAt: scan.createdAt,
    })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  });
});

router.get('/:scanId', authenticateToken, async (req: AuthRequest, res) => {
  const scan = await prisma.scan.findFirst({
    where: { id: req.params.scanId, userId: req.userId },
    include: { issues: true },
  });

  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  return res.json({
    scanId: scan.id,
    scanType: scan.scanType,
    targetUrl: scan.targetUrl,
    targetRepo: scan.targetRepo,
    score: scan.score,
    principles: {
      perceivable: scan.perceivableScore,
      operable: scan.operableScore,
      understandable: scan.understandableScore,
      robust: scan.robustScore,
    },
    issues: scan.issues.map((issue) => ({
      ...issue,
      severity: issue.severity.toLowerCase(),
      principle: issue.principle.toLowerCase(),
    })),
    truncated: scan.truncated,
    domSnapshot: scan.domSnapshot,
    createdAt: scan.createdAt,
  });
});

router.delete('/:scanId', authenticateToken, async (req: AuthRequest, res) => {
  const scan = await prisma.scan.findFirst({
    where: { id: req.params.scanId, userId: req.userId },
  });

  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  await prisma.scan.delete({ where: { id: req.params.scanId } });
  return res.json({ success: true, message: 'Scan deleted successfully' });
});

export { router as historyRouter };
