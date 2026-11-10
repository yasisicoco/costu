import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect, type Socket } from 'socket.io-client';
import { createApp } from '../server/app';
import type { AvatarMotion, Reply, Room } from '../shared/types';

type MotionEvent = { memberId: string; motion: AvatarMotion | null };
const motion: AvatarMotion = { yaw: .3, pitch: -.2, roll: .1, leftEye: .8, rightEye: .7, mouth: .2, smile: .6 };

async function fixture(t: TestContext) {
  const { httpServer, io, rooms } = createApp({ disconnectGraceMs: 20 });
  const clients: Socket[] = [];
  t.after(async () => { clients.forEach(socket => socket.disconnect()); await new Promise<void>(resolve => io.close(() => resolve())); });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const client = async () => {
    const socket = connect(url, { transports: ['websocket'], forceNew: true }); clients.push(socket);
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  };
  const emit = (socket: Socket, event: string, data: unknown) => socket.timeout(2000).emitWithAck(event, data) as Promise<Reply>;
  const waitFor = <T>(socket: Socket, event: string, predicate: (value: T) => boolean = () => true) => new Promise<T>((resolve, reject) => {
    const listener = (value: T) => { if (!predicate(value)) return; clearTimeout(timeout); socket.off(event, listener); resolve(value); };
    const timeout = setTimeout(() => { socket.off(event, listener); reject(new Error(`${event} timeout`)); }, 2000);
    socket.on(event, listener);
  });
  const owner = await client(); const friend = await client();
  const created = await emit(owner, 'room:create', { name: '나', avatar: 'cat', roomName: '움직임 서재' });
  const code = created.room!.code;
  await emit(friend, 'room:join', { name: '친구', avatar: 'bunny', code });
  return { url, owner, friend, code, rooms, client, emit, waitFor };
}

test('아바타 움직임은 같은 서재의 다른 참가자에게만 보내고 방에 저장하지 않는다', async t => {
  const { url, owner, friend, rooms, client, emit, waitFor } = await fixture(t);
  const outsider = await client();
  await emit(outsider, 'room:create', { name: '다른 친구', avatar: 'frog', roomName: '다른 서재' });
  const ownMessages: MotionEvent[] = []; const otherMessages: MotionEvent[] = [];
  friend.on('avatar:motion', value => ownMessages.push(value));
  outsider.on('avatar:motion', value => otherMessages.push(value));
  const received = waitFor<MotionEvent>(owner, 'avatar:motion');
  friend.emit('avatar:motion', motion);
  assert.deepEqual(await received, { memberId: friend.id, motion });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(ownMessages, []); assert.deepEqual(otherMessages, []);
  assert.equal(JSON.stringify([...rooms.values()]).includes('motion'), false);
  const response = await fetch(`${url}/api/health`);
  assert.equal(response.headers.get('permissions-policy'), 'camera=(self), microphone=()');
});

test('숫자 범위·임의 참가자 id·추가 영상 필드를 거부하고 중립화 null만 전달한다', async t => {
  const { owner, friend, waitFor } = await fixture(t);
  const received: MotionEvent[] = [];
  owner.on('avatar:motion', value => received.push(value));
  const invalid = [
    { ...motion, yaw: 2 },
    { ...motion, pitch: Infinity },
    { ...motion, mouth: -.1 },
    { ...motion, leftEye: 1.1 },
    { ...motion, smile: '0' },
    { ...motion, memberId: owner.id },
    { ...motion, rawVideo: 'data:video/webm;base64,AAAA' },
  ];
  for (const input of invalid) friend.emit('avatar:motion', input);
  const neutral = waitFor<MotionEvent>(owner, 'avatar:motion');
  friend.emit('avatar:motion', null);
  assert.deepEqual(await neutral, { memberId: friend.id, motion: null });
  assert.deepEqual(received, [{ memberId: friend.id, motion: null }]);
});

test('움직임 속도를 초당 최대 8개로 제한하고 마지막 중립화와 일반 상태 변경을 보존한다', async t => {
  const { owner, friend, waitFor } = await fixture(t);
  const received: MotionEvent[] = [];
  owner.on('avatar:motion', value => received.push(value));
  const neutral = waitFor<MotionEvent>(owner, 'avatar:motion', value => value.motion === null);
  for (let i = 0; i < 40; i++) friend.emit('avatar:motion', { ...motion, yaw: i / 40 });
  friend.emit('avatar:motion', null);
  for (let i = 0; i < 10; i++) friend.emit('avatar:motion', null);
  await neutral;
  const presence = waitFor<Room>(owner, 'room:update', value => value.members.some(member => member.id === friend.id && member.status === 'focusing'));
  friend.emit('presence:update', 'focusing');
  await presence;
  assert.equal(received.length, 8);
  assert.equal(received.filter(value => value.motion !== null).length, 7);
  assert.equal(received.at(-1)!.motion, null);
  await new Promise(resolve => setTimeout(resolve, 1050));
  const next = waitFor<MotionEvent>(owner, 'avatar:motion');
  friend.emit('avatar:motion', motion);
  assert.deepEqual(await next, { memberId: friend.id, motion });
  assert.equal(received.length, 9);
});

test('서재에서 나간 연결의 움직임을 전달하지 않는다', async t => {
  const { owner, friend, emit, code, waitFor } = await fixture(t);
  const left = waitFor<Room>(owner, 'room:update', value => value.members.length === 1);
  friend.emit('room:leave'); await left;
  const received: MotionEvent[] = [];
  owner.on('avatar:motion', value => received.push(value));
  friend.emit('avatar:motion', motion);
  await emit(friend, 'room:join', { name: '친구', avatar: 'bunny', code });
  const next = waitFor<MotionEvent>(owner, 'avatar:motion');
  friend.emit('avatar:motion', null);
  await next;
  assert.deepEqual(received, [{ memberId: friend.id, motion: null }]);
});
