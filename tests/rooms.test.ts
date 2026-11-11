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

test('재접속은 같은 자리를 복원하고 단절 중 퇴장한 자리는 복원하지 않는다', async () => {
  const { httpServer, io, rooms } = createApp({ disconnectGraceMs: 1000 });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address(); assert.ok(address && typeof address !== 'string');
  const clients: Socket[] = [];
  const client = async (auth = {}) => {
    const socket = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true, auth }); clients.push(socket);
    const session = await new Promise<{ resumeToken: string }>((resolve, reject) => { socket.once('session', resolve); socket.once('connect_error', reject); });
    return { socket, ...session };
  };
  const until = async (predicate: () => boolean) => {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
    assert.fail('방 상태 변경 시간 초과');
  };
  try {
    const first = await client();
    const created: Reply = await first.socket.timeout(2000).emitWithAck('room:create', { name: '나', avatar: 'cat', roomName: '복귀 검증' });
    const code = created.room!.code;
    first.socket.emit('presence:update', 'away');
    await until(() => rooms.get(code)?.members[0].status === 'away');
    first.socket.disconnect();
    await until(() => rooms.get(code)?.members[0].online === false);
    const resumed = await client({ resumeToken: first.resumeToken, roomCode: code });
    const joined: Reply = await resumed.socket.timeout(2000).emitWithAck('room:join', { name: '나', avatar: 'cat', code });
    assert.equal(joined.room!.members.length, 1);
    assert.equal(joined.room!.members[0].id, resumed.socket.id);
    assert.equal(joined.room!.members[0].status, 'away');
    assert.equal(joined.room!.members[0].online, true);
    resumed.socket.disconnect();
    await until(() => rooms.get(code)?.members[0].online === false);
    await client({ resumeToken: resumed.resumeToken, roomCode: null });
    assert.equal(rooms.has(code), false);
  } finally { clients.forEach(socket => socket.disconnect()); await new Promise<void>(resolve => io.close(() => resolve())); }
});

test('재접속 유예가 만료된 서재는 되살리지 않는다', async () => {
  const { httpServer, io, rooms } = createApp({ disconnectGraceMs: 20 });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address(); assert.ok(address && typeof address !== 'string');
  const socket = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true });
  let resumed: Socket | undefined;
  try {
    const { resumeToken } = await new Promise<{ resumeToken: string }>(resolve => socket.once('session', resolve));
    const created: Reply = await socket.timeout(2000).emitWithAck('room:create', { name: '나', avatar: 'cat', roomName: '만료 검증' });
    socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(rooms.size, 0);
    resumed = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], auth: { resumeToken } });
    await new Promise<void>(resolve => resumed!.once('connect', resolve));
    const result: Reply = await resumed.timeout(2000).emitWithAck('room:join', { name: '나', avatar: 'cat', code: created.room!.code });
    assert.equal(result.ok, false); assert.equal(rooms.size, 0);
  } finally { socket.disconnect(); resumed?.disconnect(); await new Promise<void>(resolve => io.close(() => resolve())); }
});

test('서버가 이전 연결의 단절을 감지하기 전 복귀해도 자리를 중복 생성하지 않는다', async () => {
  const { httpServer, io, rooms } = createApp();
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address(); assert.ok(address && typeof address !== 'string');
  const first = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true });
  let next: Socket | undefined;
  try {
    const { resumeToken } = await new Promise<{ resumeToken: string }>(resolve => first.once('session', resolve));
    const created: Reply = await first.timeout(2000).emitWithAck('room:create', { name: '나', avatar: 'cat', roomName: '빠른 복귀' });
    const disconnected = new Promise<void>(resolve => first.once('disconnect', () => resolve()));
    next = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true, auth: { resumeToken, roomCode: created.room!.code } });
    await new Promise<void>(resolve => next!.once('session', () => resolve()));
    await disconnected;
    const room = rooms.get(created.room!.code)!;
    assert.equal(room.members.length, 1); assert.equal(room.members[0].id, next.id);
    const joined: Reply = await next.timeout(2000).emitWithAck('room:join', { name: '나', avatar: 'cat', code: room.code });
    assert.equal(joined.room!.members.length, 1);
    next.emit('room:leave');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(rooms.size, 0);
  } finally { first.disconnect(); next?.disconnect(); await new Promise<void>(resolve => io.close(() => resolve())); }
});
