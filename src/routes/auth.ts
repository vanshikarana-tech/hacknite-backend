import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const oauthSchema = z.object({
  provider: z.enum(['google', 'github']),
  providerId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
});

function signToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  return jwt.sign({ userId, email }, secret, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
  }

  const { email, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: name || null, provider: 'email' },
  });

  const token = signToken(user.id, user.email);
  return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user.id, user.email);
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

router.post('/oauth', async (req, res) => {
  const parsed = oauthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid OAuth payload' });
  }

  const { provider, providerId, email, name } = parsed.data;
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: { email, name: name || null, provider, providerId },
    });
  }

  const token = signToken(user.id, user.email);
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

export { router as authRouter };
