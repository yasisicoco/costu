import type { Avatar as AvatarType } from '../../shared/types';

export function Avatar({ kind = 'cat', size = 56 }: { kind?: AvatarType; size?: number }) {
  const colors = { cat: '#8e9e7c', bunny: '#c6a6a1', bear: '#b79b7c', frog: '#9bad75' };
  return <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={{ cat: '고양이', bunny: '토끼', bear: '곰', frog: '개구리' }[kind]}>
    {kind === 'cat' && <path d="M22 45V15l23 19h12l22-19v33" fill={colors[kind]} />}
    {kind === 'bunny' && <><ellipse cx="35" cy="28" rx="12" ry="27" fill={colors[kind]} /><ellipse cx="65" cy="28" rx="12" ry="27" fill={colors[kind]} /><ellipse cx="35" cy="24" rx="5" ry="17" fill="#eed7d1" /><ellipse cx="65" cy="24" rx="5" ry="17" fill="#eed7d1" /></>}
    {kind === 'bear' && <><circle cx="24" cy="31" r="16" fill={colors[kind]} /><circle cx="76" cy="31" r="16" fill={colors[kind]} /><circle cx="24" cy="31" r="8" fill="#dec7a9" /><circle cx="76" cy="31" r="8" fill="#dec7a9" /></>}
    {kind === 'frog' && <><circle cx="29" cy="32" r="17" fill={colors[kind]} /><circle cx="71" cy="32" r="17" fill={colors[kind]} /></>}
    <rect x="16" y="31" width="68" height="57" rx="27" fill={colors[kind]} />
    <ellipse cx="35" cy="57" rx="3" ry="4" fill="#343f32" /><ellipse cx="65" cy="57" rx="3" ry="4" fill="#343f32" />
    <ellipse cx="26" cy="67" rx="7" ry="4" fill="#e3b7a1" opacity=".7" /><ellipse cx="74" cy="67" rx="7" ry="4" fill="#e3b7a1" opacity=".7" />
    <path d="m46 67 4 3 4-3M50 70v4m0 0q-5 4-8 0m8 0q5 4 8 0" fill="none" stroke="#343f32" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
