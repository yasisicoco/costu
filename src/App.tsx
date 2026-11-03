import { useEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, BarChart3, BookOpen, Check, ChevronRight, CircleHelp, Clock3, Coffee, Copy, Flame, Leaf, Link, LogOut, Pause, Play, Plus, Settings2, ShieldCheck, Sparkles, Sprout, Square, Sun, Target, Timer, Users, Volume2, VolumeX, X } from 'lucide-react';
import type { Avatar as AvatarType, Presence, Profile, Reply, Room, StudySession } from '../shared/types';
import { Avatar } from './components/Avatar';
import { StudyScene } from './components/StudyScene';
import { Modal } from './components/Modal';
import { daySeconds, elapsedSeconds, formatMinutes, formatTime, localDate, newTimer, remainingSeconds } from './lib/study';
import { parseBackup, readProfile, readSessions, readTimer, writeStorage } from './lib/storage';

type Page = 'focus' | 'records' | 'settings';
type Dialog = 'create' | 'join' | 'duration' | 'finish' | 'help' | null;
const presenceLabel = { ready: '시작 준비', focusing: '집중 중', away: '잠깐 쉬는 중' };
const avatars: AvatarType[] = ['cat', 'bunny', 'bear', 'frog'];

export default function App() {
  const [page, setPage] = useState<Page>('focus');
  const [profile, setProfile] = useState<Profile>(readProfile);
  const [sessions, setSessions] = useState<StudySession[]>(readSessions);
  const [timer, setTimer] = useState(readTimer);
  const [now, setNow] = useState(Date.now());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [selfId, setSelfId] = useState('');
  const [tab, setTab] = useState<'solo' | 'together'>('solo');
  const [roomName, setRoomName] = useState('우리의 작은 서재');
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(location.search).get('room')?.slice(0, 8).toUpperCase() ?? '');
  const [duration, setDuration] = useState(25);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; at: number }>>({});
  const [sound, setSound] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const roomRef = useRef<Room | null>(null);
  const profileRef = useRef(profile);
  const timerRef = useRef(timer);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audioRef = useRef<AudioContext | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  profileRef.current = profile; timerRef.current = timer; roomRef.current = room;

  function notify(message: string) { setToast(message); clearTimeout(toastTimeout.current); toastTimeout.current = setTimeout(() => setToast(''), 4200); }
  function save(key: string, value: unknown) { if (!writeStorage(key, value)) setStorageError(true); }

  useEffect(() => { save('profile', profile); }, [profile]);
  useEffect(() => { save('sessions', sessions); }, [sessions]);
  useEffect(() => { save('timer', timer); }, [timer]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === 'costu:profile') setProfile(readProfile());
      if (event.key === 'costu:sessions') setSessions(readSessions());
      if (event.key === 'costu:timer') setTimer(readTimer());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, []);

  function finish(completed = false) {
    const current = timerRef.current;
    if (current.status === 'idle') return;
    const seconds = completed ? current.duration : elapsedSeconds(current);
    if (seconds > 0) {
      const session: StudySession = { id: current.id, startedAt: current.startedAt, endedAt: completed && current.deadline ? current.deadline : Date.now(), seconds, mode: current.mode, subject: current.subject || '자유 공부' };
      setSessions(previous => {
        const merged = new Map([...readSessions(), ...previous].map(s => [s.id, s]));
        merged.set(session.id, session);
        return [...merged.values()].sort((a, b) => a.endedAt - b.endedAt);
      });
    }
    const next = newTimer(current.duration / 60);
    timerRef.current = next;
    setTimer(next); setDialog(null); socketRef.current?.emit('presence:update', 'ready');
    notify(seconds > 0 ? `${formatMinutes(seconds)}의 집중을 기록했어요. 수고했어요!` : '다음 집중을 준비했어요.');
  }

  useEffect(() => { if (timer.status === 'running' && remainingSeconds(timer, now) === 0) finish(true); }, [now, timer]);
  useEffect(() => {
    document.title = timer.status === 'running' ? `${formatTime(remainingSeconds(timer, now))} · costu` : 'costu — 각자의 공부, 함께하는 시간';
  }, [timer, now]);

  useEffect(() => {
    let resumeToken: string | null = null;
    try { resumeToken = sessionStorage.getItem('costu:resume'); } catch {}
    const socket = io({ autoConnect: true, auth: { resumeToken } });
    socketRef.current = socket;
    socket.on('session', ({ resumeToken: token }: { resumeToken: string }) => {
      socket.auth = { resumeToken: token };
      try { sessionStorage.setItem('costu:resume', token); } catch {}
    });
    socket.on('connect', () => {
      setConnected(true); setSelfId(socket.id ?? '');
      let code = roomRef.current?.code;
      try { code = code ?? sessionStorage.getItem('costu:room') ?? undefined; } catch {}
      if (code) socket.timeout(5000).emit('room:join', { ...profileRef.current, code }, (err: Error | null, result: Reply) => {
        if (err || !result?.ok) { setRoom(null); roomRef.current = null; try { sessionStorage.removeItem('costu:room'); } catch {} notify('이전 방에 다시 연결하지 못했어요. 초대 코드로 다시 참여해 주세요.'); return; }
        setRoom(result.room!); setTab('together'); socket.emit('presence:update', timerRef.current.status === 'running' ? 'focusing' : 'ready');
      });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:update', (next: Room) => setRoom(next));
    socket.on('reaction', (reaction: { memberId: string; emoji: string; at: number }) => setReactions(previous => ({ ...previous, [reaction.memberId]: { ...reaction, at: Date.now() } })));
    if (new URLSearchParams(location.search).has('room')) { setDialog('join'); history.replaceState({}, '', location.pathname); }
    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  useEffect(() => () => { clearTimeout(toastTimeout.current); audioRef.current?.close(); }, []);

  const remaining = remainingSeconds(timer, now);
  const today = daySeconds(sessions);
  const todaySessions = sessions.filter(s => localDate(s.endedAt) === localDate(now));
  const percentage = Math.min(100, Math.floor(today / (profile.goal * 60) * 100));
  const myStatus = room?.members.find(m => m.id === selfId)?.status ?? 'ready';
  const active = timer.status === 'running';
  const total = sessions.reduce((sum, session) => sum + session.seconds, 0);

  function toggleTimer() {
    const current = timerRef.current;
    if (current.status === 'running') {
      setTimer({ ...current, remaining: remainingSeconds(current), deadline: null, status: 'paused' });
      socketRef.current?.emit('presence:update', 'away');
    } else {
      setTimer({ ...current, startedAt: current.startedAt || Date.now(), deadline: Date.now() + current.remaining * 1000, status: 'running', mode: room ? 'together' : current.mode });
      socketRef.current?.emit('presence:update', 'focusing');
    }
  }

  function openDialog(next: Dialog) { setError(''); setBusy(false); setDialog(next); }

  function submitRoom(event: FormEvent) {
    event.preventDefault(); setError('');
    const socket = socketRef.current;
    if (!socket?.connected) { setError('서버에 연결 중이에요. 잠시 후 다시 시도해 주세요.'); return; }
    setBusy(true);
    socket.timeout(5000).emit(dialog === 'create' ? 'room:create' : 'room:join', { ...profile, roomName, code: joinCode.trim().toUpperCase() }, (err: Error | null, result: Reply) => {
      setBusy(false);
      if (err || !result?.ok) { setError(err ? '응답이 늦어지고 있어요. 다시 시도해 주세요.' : result.error ?? '방에 참여하지 못했어요.'); return; }
      setRoom(result.room!); roomRef.current = result.room!; setSelfId(result.memberId!); setTab('together'); setPage('focus'); setDialog(null);
      try { sessionStorage.setItem('costu:room', result.room!.code); } catch {}
      if (timerRef.current.status !== 'idle') setTimer(previous => ({ ...previous, mode: 'together' }));
      socket.emit('presence:update', timerRef.current.status === 'running' ? 'focusing' : 'ready');
      notify(dialog === 'create' ? '서재를 만들었어요. 친구에게 초대 링크를 보내 보세요.' : '서재에 들어왔어요. 반가워요!');
    });
  }

  function leaveRoom() {
    socketRef.current?.emit('room:leave'); setRoom(null); roomRef.current = null; setTab('solo');
    try { sessionStorage.removeItem('costu:room'); } catch {}
    notify('서재에서 나왔어요. 나의 타이머는 계속 사용할 수 있어요.');
  }

  async function copyInvite() {
    if (!room) return;
    try { await navigator.clipboard.writeText(`${location.origin}/?room=${room.code}`); notify('초대 링크를 복사했어요.'); } catch { notify(`초대 코드는 ${room.code}예요. 화면의 코드를 길게 눌러 복사해 주세요.`); }
  }

  async function toggleSound() {
    if (sound) { await audioRef.current?.suspend(); setSound(false); return; }
    try {
      if (!audioRef.current) {
        const context = new AudioContext();
        const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
        const data = buffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < data.length; i++) { previous = (previous + Math.random() * 0.04 - 0.02) / 1.02; data[i] = previous * 3.5; }
        const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
        const gain = context.createGain(); gain.gain.value = 0.16; source.connect(gain); gain.connect(context.destination); source.start(); audioRef.current = context;
      }
      await audioRef.current.resume(); setSound(true);
    } catch { notify('이 브라우저에서는 배경음을 재생할 수 없어요.'); }
  }

  function exportRecords() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), profile, sessions }, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `costu-records-${localDate(now)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('공부 기록을 내보냈어요.');
  }

  async function importRecords(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('too large');
      const imported = parseBackup(JSON.parse(await file.text()));
      setSessions(previous => {
        const merged = new Map(previous.map(session => [session.id, session]));
        imported.forEach(session => { if (!merged.has(session.id)) merged.set(session.id, session); });
        return [...merged.values()].sort((a, b) => a.endedAt - b.endedAt);
      });
      notify('공부 기록을 복원했어요. 기존 기록도 함께 보관해요.');
    } catch { notify('올바른 costu 백업 파일인지 확인해 주세요. 최대 5MB까지 불러올 수 있어요.'); }
    if (importRef.current) importRef.current.value = '';
  }

  function changePresence(status: Presence) {
    if (status === 'away' && timer.status === 'running') toggleTimer();
    else if (status === 'focusing' && timer.status !== 'running') toggleTimer();
    else socketRef.current?.emit('presence:update', status);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" onClick={e => { e.preventDefault(); setPage('focus'); }} aria-label="costu 홈"><span className="brand-icon"><BookOpen size={25}/></span>costu<span className="brand-dot">.</span></a>
      <div className="sidebar-label">MY LITTLE STUDY SPACE</div>
      <nav aria-label="주 메뉴">
        <button className={page === 'focus' ? 'nav-item selected' : 'nav-item'} onClick={() => setPage('focus')}><Timer size={20}/>집중 공간<span className="nav-dot"/></button>
        <button className={page === 'records' ? 'nav-item selected' : 'nav-item'} onClick={() => setPage('records')}><BarChart3 size={20}/>나의 기록</button>
        <button className={page === 'settings' ? 'nav-item selected' : 'nav-item'} onClick={() => setPage('settings')}><Settings2 size={20}/>나의 설정</button>
      </nav>
      <div className="sidebar-note"><Sprout size={27}/><p>잘하고 있어요.<br/>조금씩, 나의 속도로.</p><span>오늘의 작은 집중을 응원해요.</span></div>
      <div className="sidebar-bottom"><button className="help-link" onClick={() => openDialog('help')}><CircleHelp size={17}/>costu 사용 가이드<ChevronRight size={15}/></button><button className="profile-button" onClick={() => setPage('settings')}><span className="profile-avatar"><Avatar kind={profile.avatar} size={38}/></span><span><strong>{profile.name}</strong><small>오늘도 만나서 반가워요</small></span><Settings2 size={17}/></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">나만의 작은 서재 <span>/</span> <strong>{{ focus: '집중 공간', records: '나의 기록', settings: '나의 설정' }[page]}</strong></div><div className="topbar-right"><span className="today-date">{new Date(now).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span><span className="soft-badge"><Sun size={15}/> 좋은 하루예요</span></div></header>
      {storageError && <div className="warning" role="alert">기기 저장 공간을 사용할 수 없어 기록이 사라질 수 있어요. 나의 기록에서 내보내기를 해 주세요.</div>}
      <div className="page-content">
        {page === 'focus' && <>
          <section className="page-heading"><div><div className="eyebrow"><span/> A LITTLE FOCUS, TOGETHER</div><h1>각자의 공부, <span>함께하는 시간.</span></h1><p>혼자여도 괜찮아요. 함께라면 조금 더 힘이 나니까.</p></div><div className="heading-doodle"><Sprout size={43} strokeWidth={1.3}/><span>let’s grow, slowly</span></div></section>
          <div className="dashboard-grid">
            <section className="focus-card card">
              <div className="focus-card-top"><div className="segmented" aria-label="공부 모드"><button className={tab === 'solo' ? 'active' : ''} onClick={() => setTab('solo')}><Leaf size={16}/>혼자 집중</button><button className={tab === 'together' ? 'active' : ''} onClick={() => setTab('together')}><Users size={16}/>함께 집중{room && <span className="count">{room.members.length}</span>}</button></div><span className="quiet-label"><span className={active ? 'status-dot pulse' : 'status-dot'}/>{active ? '집중 중이에요' : timer.status === 'paused' ? '잠시 쉬어가요' : '시작할 준비 완료'}</span></div>
              <StudyScene avatar={profile.avatar} active={active}/>
              <div className="timer-area"><button className="timer-subject" disabled={timer.status !== 'idle'} onClick={() => { document.getElementById('subject')?.focus(); }}><span className="tiny-leaf">✦</span> 나를 위한 집중 시간</button><div className="timer-display" role="timer" aria-label={`남은 시간 ${formatTime(remaining)}`}>{formatTime(remaining)}</div><div className="timer-track"><span style={{ width: `${(1 - remaining / timer.duration) * 100}%` }}/></div><label className="subject-label" htmlFor="subject">오늘은 무엇에 집중할까요?</label><input id="subject" className="subject-input" maxLength={50} value={timer.subject} disabled={timer.status !== 'idle'} onChange={e => setTimer(previous => ({ ...previous, subject: e.target.value }))} placeholder="오늘은 무엇에 집중할까요?" aria-label="공부 주제"/>
                <div className="timer-actions"><button className="duration-button" disabled={timer.status !== 'idle'} onClick={() => { setDuration(timer.duration / 60); openDialog('duration'); }}><Clock3 size={17}/>{timer.duration / 60}분<Settings2 size={15}/></button><button className="primary start-button" onClick={toggleTimer}>{active ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}{active ? '잠시 쉬기' : timer.status === 'paused' ? '다시 집중하기' : '집중 시작하기'}</button>{timer.status !== 'idle' && <button className="stop-button" aria-label="집중 종료" onClick={() => openDialog('finish')}><Square size={17}/></button>}</div>
              </div>
              <div className="focus-footer"><span><ShieldCheck size={15}/>얼굴 공개 없이, 편안하게</span><button className={sound ? 'sound-button on' : 'sound-button'} onClick={toggleSound} aria-pressed={sound}>{sound ? <Volume2 size={16}/> : <VolumeX size={16}/>}바람 소리<span className="toggle"><i/></span></button></div>
            </section>
            <aside className="right-column">
              <section className="goal-card card"><div className="section-card-heading"><h2><Target size={18}/>오늘의 작은 목표</h2><button className="icon-button" aria-label="목표 설정" onClick={() => setPage('settings')}><Settings2 size={16}/></button></div><div className="goal-circle" style={{ background: `conic-gradient(#85996c ${percentage}%, #f0f1e9 0)` }}><div><Sprout size={25}/><strong>{percentage}<small>%</small></strong><span>차곡차곡 쌓는 중</span></div></div><div className="goal-time"><strong>{formatMinutes(today)}</strong><span> / {formatMinutes(profile.goal * 60)}</span></div><p>{percentage >= 100 ? '오늘의 목표를 이뤘어요. 정말 수고했어요!' : '작은 집중도 소중한 한 걸음이에요.'}</p><div className="goal-stats"><div><Clock3 size={15}/><strong>{todaySessions.length}<span>번</span></strong><small>오늘의 집중</small></div><div><Flame size={15}/><strong>{new Set(sessions.map(s => localDate(s.endedAt))).size}<span>일</span></strong><small>함께한 공부 날</small></div></div></section>
              <section className="invite-card"><div className="invite-illustration"><span><Avatar kind="cat" size={48}/></span><span><Avatar kind="bunny" size={48}/></span><Sparkles size={18}/></div><h2>가까운 친구와, 더 가볍게.</h2><p>약속도 카메라도 필요 없어요.<br/>링크 하나로 같은 서재에 앉아보세요.</p><button onClick={() => openDialog('create')}>우리만의 서재 만들기<ArrowRight size={17}/></button></section>
            </aside>
          </div>
          <section className="together-section"><div className="section-heading"><div><h2>{room ? room.name : '함께라서 좋은 집중'} <span className="small-tag">초대형 서재</span></h2><p>{room ? '각자의 속도로 공부하고, 가볍게 응원을 건네세요.' : '아는 사람과 조용히 연결되는, 우리만의 공부 공간.'}</p></div>{room ? <button className="text-button" onClick={leaveRoom}><LogOut size={16}/>서재 나가기</button> : <button className="text-button" onClick={() => openDialog('join')}><Link size={16}/>초대 코드로 참여<ArrowRight size={15}/></button>}</div>
            {room ? <div className="room-panel card"><div className="room-toolbar"><span className={connected ? 'room-connected' : 'room-offline'}><span className="status-dot"/>{connected ? `${room.members.length}명이 함께하고 있어요` : '연결이 끊겼어요. 다시 연결하는 중…'}</span><button className="invite-code" onClick={copyInvite} disabled={!connected}><span>{room.code}</span><Copy size={14}/>초대하기</button></div><div className="members">{room.members.map(member => <div className={`member ${member.status}`} key={member.id}><div className="member-avatar"><Avatar kind={member.avatar} size={73}/>{reactions[member.id] && now - reactions[member.id].at < 3000 && <span className="reaction-bubble">{reactions[member.id].emoji}</span>}</div><strong>{member.name}{member.id === selfId && <span>나</span>}</strong><small><i/>{member.online === false ? '재연결 중' : presenceLabel[member.status]}</small></div>)}{room.members.length < 6 && <button className="empty-seat" onClick={copyInvite} disabled={!connected}><span><Plus size={23}/></span><strong>친구의 자리</strong><small>초대 링크 보내기</small></button>}</div><div className="room-controls"><div className="status-controls"><button disabled={!connected} className={myStatus === 'focusing' ? 'selected' : ''} onClick={() => changePresence('focusing')}><BookOpen size={15}/>집중</button><button disabled={!connected} className={myStatus === 'away' ? 'selected' : ''} onClick={() => changePresence('away')}><Coffee size={15}/>자리 비움</button></div><div className="reactions" aria-label="친구에게 응원 보내기">{['👏', '🌱', '🔥', '☕'].map(emoji => <button key={emoji} aria-label={`${emoji} 리액션 보내기`} disabled={!connected} onClick={() => socketRef.current?.emit('reaction', emoji)}>{emoji}</button>)}</div></div></div> : <div className="room-empty card"><div className="room-empty-art"><Users size={27} strokeWidth={1.5}/></div><div><h3>{tab === 'together' ? '함께 앉을 서재를 골라볼까요?' : '혼자 시작해도, 언제든 함께할 수 있어요.'}</h3><p>친구를 초대하거나 받은 코드로 들어오세요. 최대 6명이 함께해요.</p></div><button className="secondary" onClick={() => openDialog('create')}><Plus size={17}/>서재 만들기</button></div>}
          </section>
          <footer className="page-footer"><span><Leaf size={14}/>경쟁보다 동행, 완벽보다 꾸준함.</span><span>MADE FOR YOUR OWN PACE</span></footer>
        </>}
        {page === 'records' && <>
          <section className="page-heading"><div><div className="eyebrow"><span/> YOUR LITTLE STEPS</div><h1>작은 집중이 <span>이만큼 쌓였어요.</span></h1><p>남과 비교하지 않고, 어제의 나와 가까워지는 시간.</p></div><div className="backup-actions"><input type="file" ref={importRef} accept="application/json,.json" hidden aria-label="기록 백업 파일" onChange={e => void importRecords(e.target.files?.[0])}/><button className="secondary" onClick={() => importRef.current?.click()}><ArrowUpFromLine size={16}/>불러오기</button><button className="secondary" onClick={exportRecords}><ArrowDownToLine size={17}/>내보내기</button></div></section>
          <div className="record-summary"><div className="card"><Clock3 size={23}/><span>오늘의 집중</span><strong>{formatMinutes(today)}</strong></div><div className="card"><BookOpen size={23}/><span>지금까지의 집중</span><strong>{formatMinutes(total)}</strong></div><div className="card"><Sprout size={23}/><span>완료한 집중</span><strong>{sessions.length}<small>번</small></strong></div></div>
          <section className="card weekly-card"><div className="section-heading"><div><h2>최근 7일의 발자국</h2><p>매일 조금씩, 나의 속도로.</p></div><span className="soft-badge">공부 시간 · 분</span></div><div className="weekly-chart">{Array.from({ length: 7 }, (_, i) => { const date = new Date(now); date.setDate(date.getDate() - 6 + i); const seconds = daySeconds(sessions, localDate(date.getTime())); const max = Math.max(profile.goal * 60, ...Array.from({ length: 7 }, (_, j) => { const d = new Date(now); d.setDate(d.getDate() - j); return daySeconds(sessions, localDate(d.getTime())); })); return <div className="chart-day" key={i}><strong>{Math.floor(seconds / 60)}</strong><div className="chart-track"><div style={{ height: `${seconds / max * 100}%` }}/></div><span className={i === 6 ? 'today' : ''}>{i === 6 ? '오늘' : date.toLocaleDateString('ko-KR', { weekday: 'short' })}</span></div>; })}</div></section>
          <section className="card history-card"><h2>나의 집중 기록</h2>{sessions.length ? <div className="history-list">{[...sessions].reverse().map(session => <div className="history-item" key={session.id}><span className="history-icon">{session.mode === 'together' ? <Users size={20}/> : <Leaf size={20}/>}</span><div><strong>{session.subject}</strong><small>{new Date(session.endedAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {session.mode === 'together' ? '함께 집중' : '혼자 집중'}</small></div><strong>{formatMinutes(session.seconds)}{session.seconds < 60 && <small> ({session.seconds}초)</small>}</strong><Check size={17}/></div>)}</div> : <div className="empty-record"><Sprout size={42} strokeWidth={1.2}/><h3>첫 번째 집중을 기다리고 있어요.</h3><p>타이머를 시작하고 마치면, 이곳에 기록이 쌓여요.</p><button className="primary" onClick={() => setPage('focus')}>첫 집중 시작하기<ArrowRight size={16}/></button></div>}</section><p className="privacy-note"><ShieldCheck size={15}/>기록은 이 브라우저에 저장돼요. 브라우저 데이터를 지우기 전에 내보내기를 해 주세요.</p>
        </>}
        {page === 'settings' && <>
          <section className="page-heading"><div><div className="eyebrow"><span/> MAKE YOURSELF AT HOME</div><h1>나에게 편안한 <span>작은 공간.</span></h1><p>어떤 모습이든 좋아요. 나다운 집중을 준비해요.</p></div></section>
          <form className="card settings-card" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const name = String(data.get('name') ?? '').trim(); const goal = Number(data.get('goal')); if (!name || name.length > 16 || !Number.isInteger(goal) || goal < 15 || goal > 720) return; setProfile(previous => ({ ...previous, name, goal })); notify(room ? '설정을 저장했어요. 닉네임과 아바타는 다음 서재 입장부터 반영돼요.' : '나의 설정을 저장했어요.'); }}><h2>나의 프로필</h2><label className="field-label">함께 공부할 나의 모습</label><div className="avatar-options">{avatars.map(kind => <button type="button" aria-label={`${{ cat: '고양이', bunny: '토끼', bear: '곰', frog: '개구리' }[kind]} 아바타 선택`} aria-pressed={profile.avatar === kind} className={profile.avatar === kind ? 'chosen' : ''} key={kind} onClick={() => setProfile(previous => ({ ...previous, avatar: kind }))}><Avatar kind={kind} size={72}/>{profile.avatar === kind && <i><Check size={12}/></i>}</button>)}</div><label className="field-label" htmlFor="nickname">닉네임</label><input id="nickname" name="name" key={profile.name} defaultValue={profile.name} minLength={1} maxLength={16} required/><p className="field-hint">친구들에게 보여줄 이름이에요. 최대 16자.</p><label className="field-label" htmlFor="daily-goal">하루 집중 목표</label><div className="input-unit"><input id="daily-goal" name="goal" type="number" min={15} max={720} step={1} defaultValue={profile.goal} required/><span>분</span></div><p className="field-hint">15분부터 720분까지. 부담 없는 목표로 시작해 보세요.</p><button className="primary" type="submit"><Check size={17}/>설정 저장하기</button></form>
          <section className="card privacy-card"><ShieldCheck size={24}/><div><h2>편안하게 집중할 권리</h2><p>현재 버전은 카메라와 마이크 권한을 요청하지 않아요. 얼굴이나 음성을 수집하지 않으며, 공부 상태는 직접 선택해요. 서재가 비면 참가 정보도 서버에서 사라져요.</p><p>로그인 없이 사용하는 초기 버전이에요. 다른 기기 간 기록 동기화는 아직 지원하지 않아요.</p></div></section>
        </>}
      </div>
    </main>
    <nav className="mobile-nav" aria-label="모바일 메뉴"><button className={page === 'focus' ? 'selected' : ''} onClick={() => setPage('focus')}><Timer size={21}/>집중 공간</button><button className={page === 'records' ? 'selected' : ''} onClick={() => setPage('records')}><BarChart3 size={21}/>나의 기록</button><button className={page === 'settings' ? 'selected' : ''} onClick={() => setPage('settings')}><Settings2 size={21}/>나의 설정</button></nav>
    {toast && <div className="toast" role="status"><Check size={18}/>{toast}<button aria-label="알림 닫기" onClick={() => setToast('')}><X size={15}/></button></div>}
    {(dialog === 'create' || dialog === 'join') && <Modal title={dialog === 'create' ? '우리만의 서재 만들기' : '친구의 서재에 참여하기'} onClose={() => { if (!busy) setDialog(null); }}><p className="modal-description">{dialog === 'create' ? '친한 친구와 조용히 집중하는 공간. 최대 6명까지 함께해요.' : '친구에게 받은 8자리 초대 코드를 입력해 주세요.'}</p><form onSubmit={submitRoom}>{dialog === 'create' ? <><label className="field-label" htmlFor="room-name">서재 이름</label><input id="room-name" value={roomName} onChange={e => setRoomName(e.target.value)} required maxLength={32}/></> : <><label className="field-label" htmlFor="join-code">초대 코드</label><input id="join-code" className="code-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} placeholder="예: ABCD2345" minLength={8} maxLength={8} autoComplete="off" required/></>}<div className="joining-profile"><Avatar kind={profile.avatar} size={42}/><span><strong>{profile.name}</strong>으로 참여해요.</span></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary full-width" type="submit" disabled={busy || !connected}>{busy ? '서재에 연결하는 중…' : !connected ? '서버에 연결하는 중…' : dialog === 'create' ? '서재 만들기' : '함께 집중하기'}<ArrowRight size={17}/></button></form><p className="modal-footnote"><ShieldCheck size={14}/>초대 링크를 아는 사람만 참여할 수 있어요.</p></Modal>}
    {dialog === 'duration' && <Modal title="얼마나 집중할까요?" onClose={() => setDialog(null)}><p className="modal-description">나에게 맞는 시간을 골라보세요. 잠깐의 집중도 충분해요.</p><div className="duration-options">{[15, 25, 45, 50].map(minutes => <button className={duration === minutes ? 'chosen' : ''} key={minutes} onClick={() => setDuration(minutes)}>{minutes}분{minutes === 25 && <small>추천</small>}</button>)}</div><form onSubmit={e => { e.preventDefault(); if (!Number.isInteger(duration) || duration < 1 || duration > 120) return; setTimer(newTimer(duration)); setDialog(null); }}><label className="field-label" htmlFor="custom-duration">직접 설정 (1–120분)</label><div className="input-unit"><input id="custom-duration" type="number" min={1} max={120} step={1} required value={duration || ''} onChange={e => setDuration(Number(e.target.value))}/><span>분</span></div><button className="primary full-width" type="submit">이 시간으로 집중하기<Check size={17}/></button></form></Modal>}
    {dialog === 'finish' && <Modal title="여기까지도 충분히 잘했어요." onClose={() => setDialog(null)}><p className="modal-description">지금까지 집중한 <strong>{formatTime(elapsedSeconds(timer, now))}</strong>을 기록하고 마칠까요?</p><div className="finish-sprout"><Sprout size={57} strokeWidth={1.2}/></div><button className="primary full-width" onClick={() => finish()}>기록하고 마치기<Check size={17}/></button><button className="full-width text-button centered" onClick={() => setDialog(null)}>조금 더 집중할게요</button></Modal>}
    {dialog === 'help' && <Modal title="나의 속도로, costu 사용하기" onClose={() => setDialog(null)}><div className="guide-step"><span>1</span><div><h3>준비 없이 바로 시작해요</h3><p>집중 시간을 고르고 시작 버튼을 눌러요. 잠깐 쉬거나 일찍 마쳐도 기록이 남아요.</p></div></div><div className="guide-step"><span>2</span><div><h3>친구와 같은 서재에 앉아요</h3><p>서재를 만들고 링크를 공유해요. 친구는 코드나 링크로 참여할 수 있어요. 실제 접속한 친구만 표시돼요.</p></div></div><div className="guide-step"><span>3</span><div><h3>상태와 응원만 가볍게 나눠요</h3><p>얼굴과 음성은 공유하지 않아요. 집중·자리 비움 상태와 이모티콘으로 함께 있다는 느낌을 나눠요.</p></div></div><p className="modal-footnote">이 초기 버전은 같은 서버에 연결되어야 함께 사용할 수 있어요. 휴대폰 화면이 꺼지면 연결이 중단될 수 있고, 다시 열면 재연결해요. 서재는 마지막 사람이 나가면 사라져요.</p></Modal>}
  </div>;
}
