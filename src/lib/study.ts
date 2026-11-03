import type { StudySession, TimerState } from '../../shared/types';

export function remainingSeconds(timer: TimerState, now = Date.now()) {
  return timer.status === 'running' && timer.deadline !== null ? Math.max(0, Math.ceil((timer.deadline - now) / 1000)) : timer.remaining;
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
  return { id: crypto.randomUUID(), startedAt: 0, duration: minutes * 60, remaining: minutes * 60, deadline: null, status: 'idle', mode: 'solo', subject: '' };
}
