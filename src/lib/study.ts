import type { Presence, StudySession, StudyTask, TimerState } from '../../shared/types';

export function remainingSeconds(timer: TimerState, now = Date.now()) {
  return timer.status === 'running' && timer.deadline !== null ? Math.min(timer.duration, Math.max(0, Math.ceil((timer.deadline - now) / 1000))) : timer.remaining;
}

export function elapsedSeconds(timer: TimerState, now = Date.now()) {
  return Math.max(0, timer.duration - remainingSeconds(timer, now));
}

export function localDate(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daySeconds(sessions: StudySession[], date = localDate(Date.now())) {
  return sessions.filter(s => localDate(s.endedAt) === date).reduce((sum, s) => sum + s.seconds, 0);
}

export function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function formatMinutes(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
}

export function newTimer(minutes = 25): TimerState {
  return { kind: 'focus', id: crypto.randomUUID(), startedAt: 0, duration: minutes * 60, remaining: minutes * 60, deadline: null, status: 'idle', mode: 'solo', subject: '' };
}

export function timerPresence(timer: TimerState): Presence {
  if (timer.status === 'idle') return 'ready';
  return timer.kind === 'break' || timer.status === 'paused' ? 'away' : 'focusing';
}

export function taskProgress(task: StudyTask, sessions: StudySession[]) {
  const seconds = sessions.filter(session => session.taskId === task.id).reduce((sum, session) => sum + session.seconds, 0);
  const remaining = Math.max(0, task.minutes * 60 - seconds);
  return {
    seconds,
    remainingSeconds: remaining,
    percentage: Math.min(100, Math.floor(seconds / (task.minutes * 60) * 100)),
    completed: task.completed || remaining === 0,
    nextMinutes: Math.min(120, Math.max(1, Math.ceil(remaining / 60))),
  };
}
