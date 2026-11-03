import express from 'express';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Server } from 'socket.io';
import { z } from 'zod';
import type { Member, Room } from '../shared/types';

const profileSchema = z.object({ name: z.string().trim().min(1).max(16), avatar: z.enum(['cat', 'bunny', 'bear', 'frog']) });
const joinSchema = profileSchema.extend({ code: z.string().regex(/^[A-Z2-9]{8}$/) });
const createSchema = profileSchema.extend({ roomName: z.string().trim().min(1).max(32) });
const statusSchema = z.enum(['ready', 'focusing', 'away']);
const reactions = z.enum(['👏', '🌱', '🔥', '☕']);

export function createApp({ disconnectGraceMs = 30000 } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('Permissions-Policy', 'camera=(), microphone=()'); next(); });
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    maxHttpBufferSize: 4096,
    serveClient: false,
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      if (!origin) return callback(null, true);
      try {
        const configured = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
        callback(null, new URL(origin).host === req.headers.host || configured.includes(origin));
      } catch { callback(null, false); }
    },
  });
  const rooms = new Map<string, Room>();
  const memberships = new Map<string, string>();
  const pending = new Map<string, { id: string; timeout: ReturnType<typeof setTimeout> }>();
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  const emitRoom = (room: Room) => io.to(room.code).emit('room:update', room);
  function leave(id: string) {
    const code = memberships.get(id);
    if (!code) return;
    const room = rooms.get(code);
    memberships.delete(id);
    io.sockets.sockets.get(id)?.leave(code);
    if (!room) return;
    room.members = room.members.filter(m => m.id !== id);
    if (!room.members.length) rooms.delete(code); else emitRoom(room);
  }
  io.on('connection', socket => {
    const suppliedToken = socket.handshake.auth?.resumeToken;
    const previous = typeof suppliedToken === 'string' ? pending.get(suppliedToken) : undefined;
    const resumeToken = previous ? suppliedToken : randomBytes(32).toString('hex');
    socket.data.resumeToken = resumeToken;
    if (previous) {
      clearTimeout(previous.timeout); pending.delete(resumeToken);
      const code = memberships.get(previous.id);
      const room = rooms.get(code ?? '');
      const member = room?.members.find(m => m.id === previous.id);
      memberships.delete(previous.id);
      if (room && member) {
        member.id = socket.id; member.online = true;
        memberships.set(socket.id, room.code); socket.join(room.code); emitRoom(room);
      }
    }
    socket.emit('session', { resumeToken });
    let count = 0;
    let windowStart = Date.now();
    const allowed = () => {
      if (Date.now() - windowStart > 10000) { windowStart = Date.now(); count = 0; }
      return ++count <= 30;
    };
    socket.on('room:create', (input, callback) => {
      if (typeof callback !== 'function') return;
      if (!allowed()) return callback({ ok: false, error: '잠시 후 다시 시도해 주세요.' });
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) return callback({ ok: false, error: '닉네임과 방 이름을 확인해 주세요.' });
      if (rooms.size >= 1000) return callback({ ok: false, error: '지금은 새 방을 만들 수 없어요. 잠시 후 다시 시도해 주세요.' });
      leave(socket.id);
      let code: string;
      do { code = Array.from(randomBytes(8), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''); } while (rooms.has(code));
      const member: Member = { id: socket.id, name: parsed.data.name, avatar: parsed.data.avatar, status: 'ready' };
      const room: Room = { code, name: parsed.data.roomName, capacity: 6, members: [member] };
      rooms.set(code, room); memberships.set(socket.id, code); socket.join(code);
      callback({ ok: true, room, memberId: socket.id });
    });
    socket.on('room:join', (input, callback) => {
      if (typeof callback !== 'function') return;
      if (!allowed()) return callback({ ok: false, error: '잠시 후 다시 시도해 주세요.' });
      const parsed = joinSchema.safeParse(input);
      if (!parsed.success) return callback({ ok: false, error: '8자리 초대 코드를 확인해 주세요.' });
      const room = rooms.get(parsed.data.code);
      if (!room) return callback({ ok: false, error: '방을 찾을 수 없어요. 초대 코드를 확인해 주세요.' });
      if (memberships.get(socket.id) === room.code) return callback({ ok: true, room, memberId: socket.id });
      if (room.members.length >= room.capacity) return callback({ ok: false, error: '방이 가득 찼어요. 최대 6명까지 함께할 수 있어요.' });
      leave(socket.id);
      room.members.push({ id: socket.id, name: parsed.data.name, avatar: parsed.data.avatar, status: 'ready' });
      memberships.set(socket.id, room.code); socket.join(room.code);
      callback({ ok: true, room, memberId: socket.id }); emitRoom(room);
    });
    socket.on('presence:update', input => {
      if (!allowed()) return;
      const parsed = statusSchema.safeParse(input);
      const room = rooms.get(memberships.get(socket.id) ?? '');
      if (!room || !parsed.success) return;
      const member = room.members.find(m => m.id === socket.id);
      if (member) member.status = parsed.data;
      emitRoom(room);
    });
    socket.on('reaction', input => {
      if (!allowed()) return;
      const parsed = reactions.safeParse(input);
      const code = memberships.get(socket.id);
      if (parsed.success && code) io.to(code).emit('reaction', { memberId: socket.id, emoji: parsed.data, at: Date.now() });
    });
    socket.on('room:leave', () => leave(socket.id));
    socket.on('disconnect', () => {
      const room = rooms.get(memberships.get(socket.id) ?? '');
      if (!room) return;
      const member = room.members.find(m => m.id === socket.id);
      if (member) member.online = false;
      emitRoom(room);
      const timeout = setTimeout(() => { pending.delete(resumeToken); leave(socket.id); }, disconnectGraceMs);
      timeout.unref();
      pending.set(resumeToken, { id: socket.id, timeout });
    });
  });
  return { app, httpServer, io, rooms };
}
