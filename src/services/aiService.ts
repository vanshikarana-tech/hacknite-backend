import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

export interface AiIssue {
  id: string;
  wcagCriterion: string;
  wcagName: string;
  description: string;
  selector?: string;
  lineNumber?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  principle: 'perceivable' | 'operable' | 'understandable' | 'robust';
  filePath?: string;
}

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getMockIssues(filePath?: string): AiIssue[] {
  return [
    {
      id: uuidv4(), wcagCriterion: '1.1.1', wcagName: 'Non-text Content',
      description: 'Image element is missing an alt attribute, preventing screen readers from conveying the image content to visually impaired users.',
      selector: 'img:not([alt])', severity: 'critical', principle: 'perceivable', filePath,
    },
    {
      id: uuidv4(), wcagCriterion: '1.4.3', wcagName: 'Contrast (Minimum)',
      description: 'Text color #9ca3af on white background has a contrast ratio of 2.8:1, below the required 4.5:1 for normal text.',
      selector: '.text-gray-400', severity: 'high', principle: 'perceivable', filePath,
    },
    {
      id: uuidv4(), wcagCriterion: '1.3.1', wcagName: 'Info and Relationships',
      description: 'Form input field is missing an associated label element or aria-label attribute. Screen readers cannot announce the field purpose.',
      selector: 'input[type="text"]:not([aria-label]):not([id])', severity: 'critical', principle: 'perceivable', filePath,
    },
    {
      id: uuidv4(), wcagCriterion: '2.1.1', wcagName: 'Keyboard',
      description: 'Interactive button uses onClick without keyboard event handlers and tabIndex is set to -1, making it unreachable via keyboard navigation.',
      selector: 'div[onClick][tabIndex="-1"]', severity: 'high', principle: 'operable', filePath,
    },
    {
      id: uuidv4(), wcagCriterion: '3.1.1', wcagName: 'Language of Page',
      description: 'The <html> element is missing the lang attribute. Screen readers cannot switch to the correct language profile.',
      selector: 'html:not([lang])', severity: 'medium', principle: 'understandable', filePath,
    },
    {
      id: uuidv4(), wcagCriterion: '4.1.2', wcagName: 'Name, Role, Value',
      description: 'Custom dropdown uses an invalid ARIA role "dropdown". The correct role should be "listbox" or "combobox" for screen reader compatibility.',
      selector: '[role="dropdown"]', severity: 'medium', principle: 'robust', filePath,
    },
  ];
}

const ANALYSIS_SYSTEM_PROMPT = `You are an expert web accessibility auditor specializing in WCAG 2.1 compliance.
Analyze the provided content (HTML/JSX/TSX code or webpage DOM) and identify accessibility violations.
Return a JSON array of issues. Each issue must have:
- wcagCriterion: string (e.g. "1.1.1")
- wcagName: string (e.g. "Non-text Content")
- description: string (clear, actionable description of the violation)
- selector: string (CSS selector or XPath for the affected element, if determinable)
- lineNumber: number (if analyzing code with line numbers)
- severity: "critical" | "high" | "medium" | "low"
- principle: "perceivable" | "operable" | "understandable" | "robust"
Respond ONLY with valid JSON array. No explanations outside the JSON.`;

export async function analyzeCode(code: string, filePath?: string): Promise<AiIssue[]> {
  if (process.env.MOCK_MODE === 'true') {
    return getMockIssues(filePath);
  }

  const client = getClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: `Analyze this code for WCAG accessibility violations:\n\n${code.slice(0, 60000)}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content || '{"issues":[]}';
  const parsed = JSON.parse(content);
  const issues: AiIssue[] = Array.isArray(parsed) ? parsed : (parsed.issues || []);
  return issues.map((issue) => ({ ...issue, id: uuidv4(), filePath }));
}

export async function analyzeScreenshot(screenshotBase64: string, domSnapshot: string): Promise<AiIssue[]> {
  if (process.env.MOCK_MODE === 'true') {
    return getMockIssues();
  }

  const client = getClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this webpage screenshot and DOM for WCAG accessibility violations:' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'high' } },
          { type: 'text', text: `DOM Snapshot:\n${domSnapshot.slice(0, 20000)}` },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content || '{"issues":[]}';
  const parsed = JSON.parse(content);
  const issues: AiIssue[] = Array.isArray(parsed) ? parsed : (parsed.issues || []);
  return issues.map((issue) => ({ ...issue, id: uuidv4() }));
}

export async function generateFix(issue: AiIssue, codeContext: string): Promise<string> {
  if (process.env.MOCK_MODE === 'true') {
    return `<!-- Fixed: ${issue.description} -->\n<!-- Add appropriate ARIA attributes and ensure WCAG ${issue.wcagCriterion} compliance -->\n${codeContext.slice(0, 200)}`;
  }

  const client = getClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert web accessibility engineer. Generate a minimal, focused fix for the given WCAG violation.
Return ONLY the corrected code snippet that replaces or fixes the problematic element. No explanations, just the fixed code.`,
      },
      {
        role: 'user',
        content: `Fix this WCAG ${issue.wcagCriterion} (${issue.wcagName}) violation:\n${issue.description}\n\nOriginal code context:\n${codeContext}`,
      },
    ],
    temperature: 0.2,
  });

  return response.choices[0].message.content || codeContext;
}

export async function chatResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: { issue?: AiIssue; scanSummary?: string },
): Promise<string> {
  if (process.env.MOCK_MODE === 'true') {
    const last = messages[messages.length - 1];
    return `Thank you for your question about accessibility. Regarding "${last.content.slice(0, 50)}...": ${context.issue ? `WCAG ${context.issue.wcagCriterion} (${context.issue.wcagName}) requires that ${context.issue.description}. To fix this, ensure all elements are properly labeled and conform to the WCAG 2.1 AA guidelines.` : 'Please ensure your application meets WCAG 2.1 AA standards for accessibility compliance.'}`;
  }

  const client = getClient();
  const systemContent = context.issue
    ? `You are an expert WCAG accessibility consultant. You are helping a developer understand and fix a specific accessibility issue:
WCAG Criterion: ${context.issue.wcagCriterion} - ${context.issue.wcagName}
Issue: ${context.issue.description}
Severity: ${context.issue.severity}
Provide clear, practical guidance. Reference WCAG documentation when helpful.`
    : 'You are an expert WCAG 2.1 accessibility consultant. Provide clear, practical guidance on web accessibility.';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemContent },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0].message.content || 'I could not generate a response at this time.';
}
