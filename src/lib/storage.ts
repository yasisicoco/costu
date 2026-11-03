import { z } from 'zod';
import type { Profile, StudySession, TimerState } from '../../shared/types';
import { newTimer } from './study';

const profileSchema = z.object({ name: z.string().trim().min(1).max(16), avatar: z.enum(['cat', 'bunny', 'bear', 'frog']), goal: z.number().int().min(15).max(720) });
const sessionSchema = z.object({ id: z.string(), startedAt: z.number().nonnegative(), endedAt: z.number().nonnegative(), seconds: z.number().min(0).max(7200), mode: z.enum(['solo', 'together']), subject: z.string().max(50) });
const timerSchema = z.object({ id: z.string(), startedAt: z.number().nonnegative(), duration: z.number().int().min(60).max(7200), remaining: z.number().min(0).max(7200), deadline: z.number().nullable(), status: z.enum(['idle', 'running', 'paused']), mode: z.enum(['solo', 'together']), subject: z.string().max(50) });

function read<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try { return schema.parse(JSON.parse(localStorage.getItem(key) ?? 'null')); } catch { return fallback; }
}

export const readProfile = (): Profile => read('costu:profile', profileSchema, { name: '공부하는 나', avatar: 'cat', goal: 120 });
export const readSessions = (): StudySession[] => read('costu:sessions', z.array(sessionSchema), []);
export const readTimer = (): TimerState => read('costu:timer', timerSchema, newTimer());

export function parseBackup(value: unknown): StudySession[] {
  return z.object({ version: z.literal(1), sessions: z.array(sessionSchema).max(10000) }).parse(value).sessions;
}

export function writeStorage(key: string, value: unknown) {
  try { localStorage.setItem(`costu:${key}`, JSON.stringify(value)); return true; } catch { return false; }
}
