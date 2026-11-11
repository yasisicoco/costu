import { Avatar } from './Avatar';
import type { Avatar as AvatarType, AvatarMotion } from '../../shared/types';

export function StudyScene({ avatar, active, motion }: { avatar: AvatarType; active: boolean; motion?: AvatarMotion | null }) {
  return <div className={`study-scene ${active ? 'is-studying' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 660 260" className="scene-art">
      <defs><linearGradient id="sky" x2="0" y2="1"><stop stopColor="#dce5d8"/><stop offset="1" stopColor="#eef1df"/></linearGradient><pattern id="paper" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M0 15h15" stroke="#ece8de" strokeWidth=".6"/></pattern></defs>
      <ellipse cx="329" cy="244" rx="264" ry="12" fill="#e8e8dc"/>
      <rect x="235" y="20" width="193" height="150" rx="80" fill="#eeeadd"/>
      <path d="M248 166V96a83 83 0 0 1 166 0v70Z" fill="url(#sky)"/>
      <circle cx="370" cy="66" r="19" fill="#f5e5b4"/>
      <path d="m248 133 43-26 40 20 40-37 43 39v37H248" fill="#c1cdb5" opacity=".7"/>
      <path d="M331 20v149M246 106h170" stroke="#f8f6ef" strokeWidth="7"/>
      <rect x="231" y="165" width="200" height="9" rx="4" fill="#d5cbb6"/>
      <path d="M130 227q-15-42-10-79M121 182q-35-18-27-38 31 1 28 37M122 199q27-32 43-18-5 28-40 27M119 160q-2-29 18-35 17 22-16 43" fill="#92a178" stroke="#85966e" strokeWidth="2"/>
      <path d="m102 217 7 29h27l8-29" fill="#d9c6ab"/>
      <path d="m495 230 7-77h6l7 77" fill="#8c9676"/>
      <path d="m470 149 16-47h43l17 47Z" fill="#cbd2aa"/>
      <path d="M490 103h35" stroke="#8a9772" strokeWidth="5" strokeLinecap="round"/>
      <rect x="197" y="211" width="268" height="12" rx="5" fill="#bea887"/>
      <path d="M211 222v28m238-28v28" stroke="#b9a386" strokeWidth="8"/>
      <path d="M292 210q-3-51 34-51t38 51" fill="#8e9e7c"/>
      <path d="m272 209 55-4 9 11-60 2Zm64 7 9-11 48 4-1 9Z" fill="#fffdf5" stroke="#d4cbb7"/>
      <path d="m285 211 36-1m25 0 33 2" stroke="#d4cbb7" strokeWidth="2"/>
      <rect x="407" y="192" width="21" height="20" rx="4" fill="#f6f1e4"/>
      <path d="M428 195q15-1 8 10h-8" fill="none" stroke="#e0d6be" strokeWidth="3"/>
      <path className="steam" d="M412 186q-6-6 0-12m9 12q-6-6 0-12" fill="none" stroke="#bdc2af" strokeWidth="2" strokeLinecap="round"/>
      <rect x="170" y="204" width="41" height="7" rx="2" fill="#9ba589"/><rect x="174" y="196" width="35" height="8" rx="2" fill="#d6c9ad"/>
      <path d="M549 195v35m-10-21 10 8 12-14" stroke="#8f9e7b" fill="none" strokeWidth="3"/><circle cx="549" cy="194" r="9" fill="#b1bd98"/><path d="m535 228 5 18h20l5-18" fill="#d6d8c2"/>
      <path d="M178 65h31m-15-15v30" stroke="#d5d9c5" strokeWidth="2"/>
      <circle cx="469" cy="61" r="3" fill="#c4cbaa"/>
    </svg>
    <div className="scene-avatar"><Avatar kind={avatar} size={88} motion={motion}/></div>
    <div className="scene-caption">{active ? '지금 이 순간, 나에게 집중하는 중' : '작은 시작이 모여, 나만의 속도가 돼요'}</div>
  </div>;
}
