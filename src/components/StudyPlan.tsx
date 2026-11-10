import { useRef, useState, type FormEvent } from 'react';
import { Check, ChevronDown, ClipboardList, Clock3, Play, Plus, Trash2 } from 'lucide-react';
import { formatMinutes } from '../lib/study';

type StudyPlanItem = { id: string; title: string; minutes: number; seconds: number; completed: boolean };
type StudyPlanProps = {
  tasks: StudyPlanItem[];
  activeTaskId?: string;
  canStart: boolean;
  onAdd: (title: string, minutes: number) => boolean | void;
  onStart: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export function StudyPlan({ tasks, activeTaskId, canStart, onAdd, onStart, onToggle, onDelete }: StudyPlanProps) {
  const [title, setTitle] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const [minutes, setMinutes] = useState(25);
  const [error, setError] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const remaining = tasks.filter(task => !task.completed);
  const completed = tasks.filter(task => task.completed);

  function addTask(event: FormEvent) {
    event.preventDefault();
    const name = title.trim();
    if (!name || !Number.isInteger(minutes) || minutes < 1 || minutes > 120) { setError('할 일과 1–120분 사이의 목표 시간을 입력해 주세요.'); return; }
    if (onAdd(name, minutes) === false) { setError('할 일을 추가하지 못했어요. 입력 내용을 다시 확인해 주세요.'); return; }
    setTitle(''); setError(''); titleRef.current?.focus();
    if (remaining.length >= 5) setShowAll(true);
  }

  function taskRow(task: StudyPlanItem) {
    const active = task.id === activeTaskId;
    const reachedGoal = task.seconds >= task.minutes * 60;
    const seconds = Math.max(0, Math.min(task.seconds, task.minutes * 60));
    const progress = task.seconds > 0 && task.seconds < 60 ? `${Math.floor(task.seconds)}초` : formatMinutes(task.seconds);
    return <li className={`study-plan-item${task.completed ? ' completed' : ''}${active ? ' current' : ''}`} key={task.id}>
      <button className="study-plan-check" aria-label={`${task.title} ${reachedGoal ? '목표 달성' : task.completed ? '완료 취소' : '완료 표시'}`} aria-pressed={task.completed} disabled={active || reachedGoal} onClick={() => onToggle(task.id)}><span>{task.completed && <Check size={17}/>}</span></button>
      <div className="study-plan-detail"><strong>{task.title}</strong><div className="study-plan-progress-label"><span>{progress} / {task.minutes}분</span>{reachedGoal && <span className="study-plan-current">목표 달성</span>}{active && <span className="study-plan-current">진행 중</span>}</div><progress value={seconds} max={task.minutes * 60} aria-label={`${task.title} 목표 진행률`}/></div>
      <button className="study-plan-delete" aria-label={`${task.title} 할 일 삭제`} disabled={active} onClick={() => onDelete(task.id)}><Trash2 size={17}/></button>
      {!task.completed && <button className="secondary study-plan-start" disabled={!canStart || active} onClick={() => onStart(task.id)}><Play size={14}/>{active ? '진행 중인 할 일' : '이 할 일에 집중하기'}</button>}
    </li>;
  }

  return <section className="card study-plan" aria-labelledby="study-plan-heading">
    <div className="study-plan-heading"><div><h2 id="study-plan-heading"><ClipboardList size={20}/>공부할 일</h2><p>할 일을 고르면, 목표 시간만큼 바로 집중해요.</p></div><span className="study-plan-count">남은 일 {remaining.length}개</span></div>
    <form className="study-plan-form" onSubmit={addTask}>
      <div className="study-plan-title-field"><label htmlFor="study-plan-title">무엇을 공부할까요?</label><input id="study-plan-title" ref={titleRef} value={title} onChange={event => { setTitle(event.target.value); setError(''); }} maxLength={50} required placeholder="예: 영어 단어 30개 외우기"/></div>
      <div className="study-plan-minutes-field"><label htmlFor="study-plan-minutes">목표 시간</label><div className="study-plan-minutes-input"><input id="study-plan-minutes" type="number" inputMode="numeric" min={1} max={120} step={1} value={minutes || ''} onChange={event => { setMinutes(Number(event.target.value)); setError(''); }} required aria-describedby="study-plan-hint"/><span>분</span></div></div>
      <button className="primary study-plan-add" type="submit"><Plus size={17}/>할 일 추가</button>
      <p className="study-plan-hint" id="study-plan-hint"><Clock3 size={14}/>목표는 1–120분. 나누어 집중해도 기록이 이어져요.</p>
      {error && <p className="study-plan-error" role="alert">{error}</p>}
    </form>
    {remaining.length ? <ul className="study-plan-list" id="study-plan-pending-list" aria-label="남은 공부할 일">{(showAll ? remaining : remaining.slice(0, 5)).map(taskRow)}</ul> : <div className="study-plan-empty"><ClipboardList size={25}/><p>{tasks.length ? '적어 둔 할 일을 모두 마쳤어요.' : '무엇부터 해볼까요?'}</p><span>{tasks.length ? '수고했어요. 다음 공부도 나의 속도로 준비해요.' : '작은 할 일 하나를 적고, 가볍게 시작해 보세요.'}</span></div>}
    {remaining.length > 5 && <button className="study-plan-more" aria-expanded={showAll} aria-controls="study-plan-pending-list" onClick={() => setShowAll(value => !value)}>{showAll ? '할 일 접기' : `남은 할 일 모두 보기 (${remaining.length}개)`}<ChevronDown size={17} className={showAll ? 'expanded' : ''}/></button>}
    {!canStart && remaining.length > 0 && <p className="study-plan-busy">진행 중인 집중이나 휴식을 마치면 다른 할 일을 시작할 수 있어요.</p>}
    {completed.length > 0 && <div className="study-plan-completed"><button className="study-plan-completed-toggle" aria-expanded={showCompleted} aria-controls="study-plan-completed-list" onClick={() => setShowCompleted(value => !value)}><Check size={17}/>마친 일 {completed.length}개<ChevronDown size={17} className={showCompleted ? 'expanded' : ''}/></button><ul className="study-plan-list" id="study-plan-completed-list" aria-label="마친 공부할 일" hidden={!showCompleted}>{completed.map(taskRow)}</ul></div>}
    <p className="study-plan-privacy">할 일과 공부 기록은 나에게만 보여요.</p>
  </section>;
}
