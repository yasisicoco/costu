import { useEffect, useRef, useState } from 'react';
import type { AvatarMotion } from '../../shared/types';
import type { FaceTracker } from '../lib/face-tracker';
import { smoothMotion } from '../lib/avatar-motion';

type CameraStatus = 'off' | 'loading' | 'tracking' | 'searching' | 'error';
type Capture = { stream: MediaStream; video: HTMLVideoElement; tracker: FaceTracker | null; timer?: ReturnType<typeof setTimeout>; busy: boolean; stopped: boolean };

export function useCameraAvatar(onMotion: (motion: AvatarMotion | null) => void) {
  const [status, setStatus] = useState<CameraStatus>('off');
  const [motion, setMotion] = useState<AvatarMotion | null>(null);
  const [error, setError] = useState('');
  const capture = useRef<Capture | null>(null);
  const generation = useRef(0);
  const previous = useRef<AvatarMotion | null>(null);
  const callback = useRef(onMotion);
  callback.current = onMotion;

  function stop(update = true) {
    generation.current++;
    const current = capture.current;
    capture.current = null;
    if (current) {
      current.stopped = true; clearTimeout(current.timer);
      current.stream.getTracks().forEach(track => track.stop());
      current.video.pause(); current.video.srcObject = null; current.video.remove();
      if (!current.busy) current.tracker?.dispose();
    }
    previous.current = null;
    callback.current(null);
    if (update) { setMotion(null); setStatus('off'); setError(''); }
  }

  async function start() {
    stop();
    const attempt = generation.current;
    setStatus('loading'); setError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus('error'); setError('카메라 연결은 HTTPS 또는 localhost의 지원 브라우저에서 사용할 수 있어요.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } }, audio: false });
      if (attempt !== generation.current || document.hidden) { stream.getTracks().forEach(track => track.stop()); return; }
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.autoplay = true; video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1;
      video.style.cssText = 'position:fixed;width:1px;height:1px;clip-path:inset(100%);pointer-events:none;';
      video.srcObject = stream;
      document.body.appendChild(video);
      const current: Capture = { stream, video, tracker: null, busy: false, stopped: false };
      capture.current = current;
      for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => {
        if (capture.current !== current) return;
        stop(); setStatus('error'); setError('카메라 연결이 종료됐어요. 원하면 다시 연결해 주세요.');
      }, { once: true });
      await video.play();
      if (attempt !== generation.current) return;
      const { createFaceTracker } = await import('../lib/face-tracker');
      if (attempt !== generation.current || document.hidden) return;
      const tracker = await createFaceTracker(() => attempt === generation.current && !document.hidden);
      if (attempt !== generation.current || document.hidden) { tracker.dispose(); return; }
      current.tracker = tracker;
      setStatus('searching');
      const tick = async () => {
        if (current.stopped) return;
        const started = performance.now();
        try {
          if (video.readyState >= 2) {
            current.busy = true;
            const detected = await tracker.detect(video);
            if (current.stopped) return;
            const next = detected ? smoothMotion(detected, previous.current) : null;
            previous.current = next; setMotion(next); setStatus(next ? 'tracking' : 'searching'); callback.current(next);
          }
        } catch {
          if (!current.stopped) { stop(); setStatus('error'); setError('이 기기에서 표정 연결을 계속할 수 없어요. 카메라를 끄고 기본 아바타로 돌아왔어요.'); }
        } finally {
          current.busy = false;
          if (current.stopped) tracker.dispose();
          else current.timer = setTimeout(tick, Math.max(60, 125 - (performance.now() - started)));
        }
      };
      void tick();
    } catch (reason) {
      if (attempt !== generation.current) return;
      stop(); setStatus('error');
      const name = reason instanceof Error || reason instanceof DOMException ? reason.name : '';
      setError(name === 'NotAllowedError' ? '카메라 권한을 허용하지 않았어요. 브라우저 설정에서 허용한 뒤 다시 시도할 수 있어요.' : name === 'NotFoundError' ? '사용할 카메라를 찾지 못했어요. 카메라가 연결된 기기에서 다시 시도해 주세요.' : '카메라나 표정 모델을 준비하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    }
  }

  useEffect(() => {
    const visibility = () => { if (document.hidden) stop(); };
    const leaving = () => stop();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', leaving);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', leaving); stop(false); };
  }, []);
  return { status, motion, error, start, stop };
}
