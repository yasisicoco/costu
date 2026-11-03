import { test } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect, type Socket } from 'socket.io-client';
import { createApp } from '../server/app';
import type { Reply, Room } from '../shared/types';

test('실제 클라이언트의 방 생성·참여·상태·리액션·정원·삭제를 검증한다', async () => {
  const { httpServer, io, rooms } = createApp({ disconnectGraceMs: 20 });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const clients: Socket[] = [];
  const client = async () => {
    const socket = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  };
  const emit = (socket: Socket, event: string, data: unknown) => socket.timeout(2000).emitWithAck(event, data) as Promise<Reply>;
  const waitFor = <T>(socket: Socket, event: string, predicate: (value: T) => boolean = () => true) => new Promise<T>((resolve, reject) => {
    const listener = (value: T) => { if (!predicate(value)) return; clearTimeout(timeout); socket.off(event, listener); resolve(value); };
    const timeout = setTimeout(() => { socket.off(event, listener); reject(new Error(`${event} timeout`)); }, 2000);
    socket.on(event, listener);
  });
  try {
    const owner = await client();
    const profile = { name: '첫 친구', avatar: 'cat' };
    assert.equal((await emit(owner, 'room:create', { ...profile, roomName: '' })).ok, false);
    const created = await emit(owner, 'room:create', { ...profile, roomName: '테스트 서재' });
    assert.equal(created.ok, true); assert.match(created.room!.code, /^[A-Z2-9]{8}$/);
    const friend = await client();
    assert.equal((await emit(friend, 'room:join', { ...profile, code: 'ZZZZZZZZ' })).ok, false);
    const joined = await emit(friend, 'room:join', { name: '두 번째 친구', avatar: 'bunny', code: created.room!.code });
    assert.equal(joined.room!.members.length, 2);
    const presence = waitFor<Room>(owner, 'room:update', value => value.members.some(m => m.id === friend.id && m.status === 'focusing')); friend.emit('presence:update', 'focusing');
    assert.equal((await presence).members.find(m => m.id === friend.id)?.status, 'focusing');
    const reaction = waitFor<{ emoji: string; memberId: string }>(owner, 'reaction'); friend.emit('reaction', '🌱');
    assert.equal((await reaction).emoji, '🌱');
    for (let i = 0; i < 4; i++) { const socket = await client(); assert.equal((await emit(socket, 'room:join', { ...profile, code: created.room!.code })).ok, true); }
    const overflow = await client();
    assert.equal((await emit(overflow, 'room:join', { ...profile, code: created.room!.code })).ok, false);
    const left = waitFor<Room>(owner, 'room:update', value => value.members.length === 5); friend.emit('room:leave'); assert.equal((await left).members.length, 5);
    for (const socket of clients) socket.disconnect();
    await new Promise<void>(resolve => setTimeout(resolve, 60));
    assert.equal(rooms.size, 0);
  } finally {
    clients.forEach(socket => socket.disconnect());
    await new Promise<void>(resolve => io.close(() => resolve()));
  }
});

test('같은 socket이 방을 옮기면 이전 방에서 제외된다', async () => {
  const { httpServer, io, rooms } = createApp();
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address(); assert.ok(address && typeof address !== 'string');
  const socket = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'] });
  try {
    await new Promise<void>(resolve => socket.once('connect', resolve));
    const payload = { name: '공부', avatar: 'cat', roomName: '서재' };
    const first: Reply = await socket.timeout(2000).emitWithAck('room:create', payload);
    const second: Reply = await socket.timeout(2000).emitWithAck('room:create', payload);
    assert.notEqual(first.room!.code, second.room!.code);
    assert.equal(rooms.size, 1);
    assert.equal(rooms.has(first.room!.code), false);
  } finally { socket.disconnect(); await new Promise<void>(resolve => io.close(() => resolve())); }
});

test('알 수 없는 웹 Origin의 WebSocket 연결을 거절한다', async () => {
  const { httpServer, io } = createApp();
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address(); assert.ok(address && typeof address !== 'string');
  const socket = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], reconnection: false, extraHeaders: { Origin: 'https://untrusted.example' } });
  try {
    await new Promise<void>((resolve, reject) => { socket.once('connect_error', () => resolve()); socket.once('connect', () => reject(new Error('untrusted origin accepted'))); });
    assert.equal(socket.connected, false);
  } finally { socket.disconnect(); await new Promise<void>(resolve => io.close(() => resolve())); }
});
