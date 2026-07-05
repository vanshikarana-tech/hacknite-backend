import { Request, Response, NextFunction } from 'express';
import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);

const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fd[0-9a-f]{2}:/,
];

const BLOCKED_HOSTS = ['localhost', '0.0.0.0', '[::]', '[::1]'];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((range) => range.test(ip));
}

export async function validateUrl(url: string): Promise<{ valid: boolean; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, reason: 'Only HTTP and HTTPS URLs are allowed' };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTS.some((h) => h.toLowerCase() === hostname.toLowerCase())) {
    return { valid: false, reason: 'Access to localhost and loopback addresses is not allowed' };
  }

  if (isPrivateIp(hostname)) {
    return { valid: false, reason: 'Access to private IP ranges is not allowed' };
  }

  try {
    const addresses = await resolve4(hostname);
    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        return { valid: false, reason: 'URL resolves to a private IP address' };
      }
    }
  } catch {
    return { valid: false, reason: 'Could not resolve hostname' };
  }

  return { valid: true };
}

export function ssrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const url = req.body?.url;
  if (!url) {
    next();
    return;
  }

  validateUrl(url).then((result) => {
    if (!result.valid) {
      res.status(422).json({ error: `Invalid URL: ${result.reason}` });
    } else {
      next();
    }
  }).catch(() => {
    res.status(422).json({ error: 'URL validation failed' });
  });
}
