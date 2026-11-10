import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudySession, StudyTask } from '../shared/types';
import { newTimer, taskProgress } from '../src/lib/study';
import { parseBackup, parseBackupTasks, readSessions, readTasks, readTimer, writeStorage } from '../src/lib/storage';

const task: StudyTask = { id: 'task-1', title: '영어 단어', minutes: 25, createdAt: 1, completed: false };
const session = (id: string, seconds: number, taskId?: string): StudySession => ({ id, seconds, taskId, startedAt: 1, endedAt: 2000, mode: 'solo', subject: '공부' });

test('할 일은 연결한 공부 기록만 누적하고 조기 종료한 분량도 이어서 집중한다', () => {
  const progress = taskProgress(task, [session('partial', 601, task.id), session('other-task', 600, 'task-2'), session('free-study', 900)]);
  assert.equal(progress.seconds, 601);
  assert.equal(progress.remainingSeconds, 899);
  assert.equal(progress.nextMinutes, 15);
  assert.equal(progress.percentage, 40);
  assert.equal(progress.completed, false);
});

test('여러 번 집중한 분량으로 목표를 채우면 완료하고 진행률은 100%를 넘지 않는다', () => {
  const progress = taskProgress(task, [session('first', 900, task.id), session('second', 660, task.id)]);
  assert.equal(progress.seconds, 1560);
  assert.equal(progress.remainingSeconds, 0);
  assert.equal(progress.percentage, 100);
  assert.equal(progress.completed, true);
  assert.equal(progress.nextMinutes, 1);
});

test('수동 완료는 공부 시간을 만들어내지 않으며 1초 남은 분량도 1분으로 설정한다', () => {
  const completed = taskProgress({ ...task, completed: true }, []);
  assert.equal(completed.completed, true);
  assert.equal(completed.seconds, 0);
  assert.equal(completed.percentage, 0);
  const almost = taskProgress(task, [session('almost', 1499, task.id)]);
  assert.equal(almost.nextMinutes, 1);
  assert.equal(almost.completed, false);
  assert.equal(taskProgress({ ...task, minutes: 120 }, []).nextMinutes, 120);
});

test('기록되지 않은 휴식과 다른 주제의 자유 공부는 할 일 진행률에 포함하지 않는다', () => {
  const resting = { ...newTimer(5), kind: 'break' as const, status: 'running' as const, deadline: 300001 };
  assert.equal(resting.taskId, undefined);
  const progress = taskProgress(task, [session('same-title-free-study', 1500)]);
  assert.equal(progress.seconds, 0);
  assert.equal(progress.completed, false);
});

test('이전 버전 백업은 유지하고 새 할 일과 연결 id를 함께 복원한다', () => {
  const old = { version: 1, sessions: [session('old', 60)] };
  assert.equal(parseBackup(old).length, 1);
  assert.deepEqual(parseBackupTasks(old), []);
  const backup = { version: 1, sessions: [session('linked', 60, task.id)], tasks: [task] };
  assert.equal(parseBackup(backup)[0].taskId, task.id);
  assert.deepEqual(parseBackupTasks(backup), [task]);
  assert.throws(() => parseBackup({ ...backup, tasks: [{ ...task, minutes: 0 }] }));
  assert.throws(() => parseBackupTasks({ ...backup, sessions: [{ ...session('bad', 60), seconds: -1 }] }));
});

test('할 일 저장과 기존 타이머 복원은 호환되고 손상된 할 일은 안전하게 읽는다', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  assert.deepEqual(readTasks(), []);
  assert.equal(writeStorage('tasks', [{ ...task, title: '  영어 단어  ' }]), true);
  assert.deepEqual(readTasks(), [task]);
  values.set('costu:tasks', JSON.stringify([{ ...task, title: '' }]));
  assert.deepEqual(readTasks(), []);
  values.set('costu:tasks', 'broken');
  assert.deepEqual(readTasks(), []);
  const previousTimer = { ...newTimer(), status: 'paused', remaining: 1000 };
  Reflect.deleteProperty(previousTimer, 'kind');
  values.set('costu:timer', JSON.stringify(previousTimer));
  assert.equal(readTimer().kind, 'focus');
  assert.equal(readTimer().remaining, 1000);
  values.set('costu:timer', JSON.stringify({ ...previousTimer, taskId: task.id }));
  assert.equal(readTimer().taskId, task.id);
  values.set('costu:sessions', JSON.stringify([session('linked', 60, task.id)]));
  assert.equal(readSessions()[0].taskId, task.id);
});
