import type { AvatarMotion } from '../../shared/types';
import { motionFromFace } from './avatar-motion';

export type FaceTracker = { detect: (video: HTMLVideoElement) => Promise<AvatarMotion | null>; dispose: () => void };

async function loadTracker(isActive: () => boolean): Promise<FaceTracker> {
  const { Human } = await import('@vladmandic/human');
  if (!isActive()) throw new DOMException('Camera stopped', 'AbortError');
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2');
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  const human = new Human({
    backend: gl ? 'webgl' : 'cpu',
    modelBasePath: new URL('/face-models/', location.origin).href,
    cacheModels: false,
    debug: false,
    async: false,
    warmup: 'none',
    cacheSensitivity: 0,
    filter: { enabled: false, return: false },
    gesture: { enabled: false },
    face: {
      enabled: true,
      detector: { rotation: true, maxDetected: 1, skipFrames: 0, skipTime: 0, minConfidence: .6, return: false },
      mesh: { enabled: true, keepInvalid: false },
      attention: { enabled: false },
      iris: { enabled: false },
      emotion: { enabled: false },
      description: { enabled: false },
      antispoof: { enabled: false },
      liveness: { enabled: false },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    segmentation: { enabled: false },
  });
  const dispose = () => {
    for (const model of Object.values(human.models.models)) model?.dispose();
    human.models.reset();
    human.result.face = [];
    human.reset();
    if (human.process.canvas) { human.process.canvas.width = 0; human.process.canvas.height = 0; }
  };
  try { await human.load(); } catch (error) { dispose(); throw error; }
  return {
    async detect(video) {
      const result = await human.detect(video);
      const face = result.face[0];
      return face && face.faceScore >= .6 ? motionFromFace(face) : null;
    },
    dispose,
  };
}

let previousCapture: Promise<void> = Promise.resolve();

export async function createFaceTracker(isActive = () => true): Promise<FaceTracker> {
  const previous = previousCapture;
  let release!: () => void;
  previousCapture = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    if (!isActive()) throw new DOMException('Camera stopped', 'AbortError');
    const tracker = await loadTracker(isActive);
    let disposed = false;
    return {
      detect: tracker.detect,
      dispose() {
        if (disposed) return;
        disposed = true;
        try { tracker.dispose(); } finally { release(); }
      },
    };
  } catch (error) { release(); throw error; }
}
