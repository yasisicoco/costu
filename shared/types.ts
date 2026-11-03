export type Avatar = 'cat' | 'bunny' | 'bear' | 'frog';
export type Presence = 'ready' | 'focusing' | 'away';
export type Profile = { name: string; avatar: Avatar; goal: number };
export type Member = { id: string; name: string; avatar: Avatar; status: Presence; online?: boolean };
export type Room = { code: string; name: string; members: Member[]; capacity: number };
export type Reply = { ok: boolean; error?: string; room?: Room; memberId?: string };
export type StudySession = { id: string; startedAt: number; endedAt: number; seconds: number; mode: 'solo' | 'together'; subject: string };
export type TimerState = { id: string; startedAt: number; duration: number; remaining: number; deadline: number | null; status: 'idle' | 'running' | 'paused'; mode: 'solo' | 'together'; subject: string };
