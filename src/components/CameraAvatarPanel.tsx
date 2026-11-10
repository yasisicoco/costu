import { Camera, CameraOff, ScanFace, ShieldCheck } from 'lucide-react';
import type { Avatar as AvatarType, AvatarMotion } from '../../shared/types';
import { Avatar } from './Avatar';

type CameraAvatarPanelProps = {
  avatar: AvatarType;
  motion: AvatarMotion | null;
  status: 'off' | 'loading' | 'tracking' | 'searching' | 'error';
  error: string;
  onStart: () => void;
  onStop: () => void;
};

export function CameraAvatarPanel({ avatar, motion, status, error, onStart, onStop }: CameraAvatarPanelProps) {
  const enabled = status === 'tracking' || status === 'searching';
  const label = { off: '카메라 꺼짐', loading: '움직임 준비 중', tracking: '내 표정과 연결됐어요', searching: '얼굴을 찾는 중이에요', error: '연결을 확인해 주세요' }[status];
  return <section className={`card camera-avatar-panel camera-avatar-${status}`} aria-labelledby="camera-avatar-heading">
    <div className="camera-avatar-heading"><div><h2 id="camera-avatar-heading"><ScanFace size={21}/>표정이 담긴 아바타</h2><p>눈을 깜빡이고, 웃고, 고개를 움직여 보세요.</p></div><span className="camera-avatar-badge" aria-live="polite"><span/>{label}</span></div>
    <div className="camera-avatar-content">
      <div className="camera-avatar-preview"><div className="camera-avatar-preview-circle"><Avatar kind={avatar} size={220} motion={enabled ? motion : null}/></div><p>{enabled ? '얼굴 대신, 이 아바타가 움직여요.' : '친구에게 보일 나의 아바타예요.'}</p></div>
      <div className="camera-avatar-controls">
        <p className="camera-avatar-description">{status === 'off' ? '원할 때만 카메라를 켜서 내 표정과 고개 움직임을 아바타에 담아요.' : status === 'loading' ? '이 기기에서 아바타 움직임을 준비하고 있어요. 잠시만 기다려 주세요.' : status === 'tracking' ? '눈 깜빡임, 미소, 입 벌림과 고개 움직임을 실시간으로 반영하고 있어요.' : status === 'searching' ? '카메라를 바라봐 주세요. 얼굴이 보이면 아바타가 다시 따라 움직여요.' : '카메라 연결을 다시 시도할 수 있어요. 기본 아바타로도 계속 집중할 수 있어요.'}</p>
        {status === 'error' && error && <p className="camera-avatar-error" role="alert">{error}</p>}
        <div className="camera-avatar-actions">{status === 'off' || status === 'error' ? <button type="button" className="primary" aria-describedby="camera-avatar-privacy" onClick={onStart}><Camera size={18}/>{status === 'error' ? '다시 연결하기' : '내 표정으로 움직이기'}</button> : <button type="button" className="secondary" onClick={onStop}><CameraOff size={18}/>{status === 'loading' ? '준비 취소' : '표정 연결 끄기'}</button>}</div>
        <div className="camera-avatar-privacy" id="camera-avatar-privacy"><ShieldCheck size={19}/><div><strong>얼굴은 이 기기에만 머물러요.</strong><p>영상은 이 기기에서만 처리해요. 화면에 얼굴 영상을 표시하거나 저장하지 않아요. 친구에게는 아바타 움직임만 공유해요.</p></div></div>
        <p className="camera-avatar-footnote">처음에는 꺼져 있어요. 카메라를 켜도 마이크는 사용하지 않아요.</p>
      </div>
    </div>
  </section>;
}
