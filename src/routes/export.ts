import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { generatePdf, generateJson, generateCsv, generateMarkdown } from '../services/reportService';

const router = Router();
const prisma = new PrismaClient();

router.get('/:scanId/:format', optionalAuth, async (req: AuthRequest, res) => {
  const { scanId, format } = req.params;

  const validFormats = ['pdf', 'json', 'csv', 'markdown', 'md'];
  if (!validFormats.includes(format.toLowerCase())) {
    return res.status(400).json({ error: `Invalid format. Supported: ${validFormats.join(', ')}` });
  }

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { issues: true },
  });

  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  const safeFilename = `accessibility-report-${scanId.slice(0, 8)}`;

  switch (format.toLowerCase()) {
    case 'pdf': {
      const pdfBuffer = await generatePdf(scan);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);
      return res.send(pdfBuffer);
    }

    case 'json': {
      const jsonContent = generateJson(scan);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.json"`);
      return res.send(jsonContent);
    }

    case 'csv': {
      const csvContent = generateCsv(scan);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.csv"`);
      return res.send(csvContent);
    }

    case 'markdown':
    case 'md': {
      const mdContent = generateMarkdown(scan);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.md"`);
      return res.send(mdContent);
    }

    default:
      return res.status(400).json({ error: 'Unsupported format' });
  }
});

export { router as exportRouter };
