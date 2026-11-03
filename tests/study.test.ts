import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daySeconds, elapsedSeconds, formatTime, localDate, newTimer, remainingSeconds } from '../src/lib/study';

test('백그라운드에서 tick이 없어도 실제 경과 시간으로 계산한다', () => {
  const timer = { ...newTimer(25), status: 'running' as const, deadline: 1_500_000 };
  assert.equal(remainingSeconds(timer, 600_000), 900);
  assert.equal(elapsedSeconds(timer, 600_000), 600);
  assert.equal(remainingSeconds(timer, 1_500_001), 0);
});

test('일시 정지한 시간은 경과 시간에서 제외한다', () => {
  const timer = { ...newTimer(25), status: 'paused' as const, remaining: 1000 };
  assert.equal(remainingSeconds(timer, 9_999_999), 1000);
  assert.equal(elapsedSeconds(timer, 9_999_999), 500);
});

test('자정을 넘긴 기록은 종료한 로컬 날짜에 합산한다', () => {
  const startedAt = new Date(2026, 10, 3, 23, 50).getTime();
  const endedAt = new Date(2026, 10, 4, 0, 15).getTime();
  const sessions = [{ id: 'test', startedAt, endedAt, seconds: 1500, mode: 'solo' as const, subject: '공부' }];
  assert.equal(localDate(endedAt), '2026-11-04');
  assert.equal(daySeconds(sessions, '2026-11-04'), 1500);
  assert.equal(daySeconds(sessions, '2026-11-03'), 0);
});

test('120분 및 0초를 표시한다', () => {
  assert.equal(formatTime(7200), '120:00');
  assert.equal(formatTime(0), '00:00');
});
