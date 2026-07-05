import PDFDocument from 'pdfkit';
import { Writable } from 'stream';
import { Prisma } from '@prisma/client';

type ScanWithIssues = Prisma.ScanGetPayload<{ include: { issues: true } }>;

export async function generatePdf(scan: ScanWithIssues): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    doc.pipe(stream);

    doc.fontSize(24).font('Helvetica-Bold').text('Accessibility Audit Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Scan ID: ${scan.id}`);
    doc.text(`Date: ${scan.createdAt.toISOString()}`);
    doc.text(`Target: ${scan.targetUrl || scan.targetRepo || 'Code Snippet'}`);
    doc.moveDown();

    doc.fontSize(18).font('Helvetica-Bold').text('Accessibility Score');
    doc.fontSize(36).fillColor(scan.score >= 75 ? '#16a34a' : scan.score >= 50 ? '#d97706' : '#dc2626')
      .text(`${scan.score}/100`, { align: 'center' });
    doc.fillColor('#000000').moveDown();

    doc.fontSize(16).font('Helvetica-Bold').text('WCAG Principle Breakdown');
    doc.fontSize(12).font('Helvetica');
    doc.text(`Perceivable: ${scan.perceivableScore}/100`);
    doc.text(`Operable: ${scan.operableScore}/100`);
    doc.text(`Understandable: ${scan.understandableScore}/100`);
    doc.text(`Robust: ${scan.robustScore}/100`);
    doc.moveDown();

    doc.fontSize(16).font('Helvetica-Bold').text(`Issues (${scan.issues.length} total)`);
    doc.moveDown(0.5);

    for (const issue of scan.issues) {
      const color = issue.severity === 'CRITICAL' ? '#dc2626' : issue.severity === 'HIGH' ? '#ea580c' : issue.severity === 'MEDIUM' ? '#d97706' : '#2563eb';
      doc.fontSize(13).font('Helvetica-Bold').fillColor(color).text(`[${issue.severity}] WCAG ${issue.wcagCriterion} - ${issue.wcagName}`);
      doc.fillColor('#000000').fontSize(11).font('Helvetica').text(issue.description);
      if (issue.selector) doc.text(`Selector: ${issue.selector}`, { oblique: true });
      if (issue.filePath) doc.text(`File: ${issue.filePath}`);
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function generateJson(scan: ScanWithIssues): string {
  return JSON.stringify({
    scanId: scan.id,
    target: scan.targetUrl || scan.targetRepo || 'code-snippet',
    scanType: scan.scanType,
    createdAt: scan.createdAt,
    score: scan.score,
    principles: {
      perceivable: scan.perceivableScore,
      operable: scan.operableScore,
      understandable: scan.understandableScore,
      robust: scan.robustScore,
    },
    totalIssues: scan.issues.length,
    issues: scan.issues,
  }, null, 2);
}

export function generateCsv(scan: ScanWithIssues): string {
  const header = 'File/URL,WCAG Criterion,WCAG Name,Description,Severity,Principle,Selector\n';
  const rows = scan.issues.map((issue) => {
    const target = issue.filePath || scan.targetUrl || scan.targetRepo || 'code-snippet';
    const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    return [target, issue.wcagCriterion, issue.wcagName, issue.description, issue.severity, issue.principle, issue.selector || '']
      .map(escape).join(',');
  });
  return header + rows.join('\n');
}

export function generateMarkdown(scan: ScanWithIssues): string {
  const target = scan.targetUrl || scan.targetRepo || 'Code Snippet';
  const date = scan.createdAt.toISOString().split('T')[0];

  let md = `# Accessibility Audit Report\n\n`;
  md += `**Target:** ${target}\n**Date:** ${date}\n**Scan ID:** ${scan.id}\n\n`;
  md += `## Overall Score: ${scan.score}/100\n\n`;
  md += `| Principle | Score |\n|-----------|-------|\n`;
  md += `| Perceivable | ${scan.perceivableScore}/100 |\n`;
  md += `| Operable | ${scan.operableScore}/100 |\n`;
  md += `| Understandable | ${scan.understandableScore}/100 |\n`;
  md += `| Robust | ${scan.robustScore}/100 |\n\n`;
  md += `## Issues (${scan.issues.length} total)\n\n`;

  for (const issue of scan.issues) {
    const emoji = issue.severity === 'CRITICAL' ? '🔴' : issue.severity === 'HIGH' ? '🟠' : issue.severity === 'MEDIUM' ? '🟡' : '🔵';
    md += `### ${emoji} [${issue.severity}] WCAG ${issue.wcagCriterion} - ${issue.wcagName}\n\n`;
    md += `${issue.description}\n\n`;
    if (issue.selector) md += `**Selector:** \`${issue.selector}\`\n\n`;
    if (issue.filePath) md += `**File:** \`${issue.filePath}\`\n\n`;
    md += `---\n\n`;
  }

  return md;
}
