import type { AvatarMotion } from '../../shared/types';

type FaceGeometry = { mesh: readonly (readonly [number, number, number?])[]; rotation?: { angle: { yaw: number; pitch: number; roll: number } } | null };
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function motionFromFace(face: FaceGeometry): AvatarMotion | null {
  const points = face.mesh;
  const required = [33, 133, 159, 145, 263, 362, 386, 374, 13, 14, 61, 291];
  if (required.some(index => !points[index] || !points[index].slice(0, 2).every(Number.isFinite))) return null;
  const distance = (a: number, b: number) => Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]);
  const leftWidth = distance(33, 133), rightWidth = distance(263, 362), mouthWidth = distance(61, 291);
  if (Math.min(leftWidth, rightWidth, mouthWidth) < 1) return null;
  const angle = face.rotation?.angle ?? { yaw: 0, pitch: 0, roll: 0 };
  if (!Object.values(angle).every(Number.isFinite)) return null;
  const lipCenter = (points[13][1] + points[14][1]) / 2;
  const cornerCenter = (points[61][1] + points[291][1]) / 2;
  return {
    yaw: clamp(-angle.yaw / .7, -1, 1),
    pitch: clamp(angle.pitch / .7, -1, 1),
    roll: clamp(-angle.roll / .6, -1, 1),
    leftEye: clamp((distance(159, 145) / leftWidth - .04) / .22),
    rightEye: clamp((distance(386, 374) / rightWidth - .04) / .22),
    mouth: clamp((distance(13, 14) / mouthWidth - .015) / .4),
    smile: clamp(((lipCenter - cornerCenter) / mouthWidth - .015) * 10),
  };
}

export function smoothMotion(current: AvatarMotion, previous: AvatarMotion | null): AvatarMotion {
  if (!previous) return current;
  return { ...current, yaw: previous.yaw * .4 + current.yaw * .6, pitch: previous.pitch * .4 + current.pitch * .6, roll: previous.roll * .4 + current.roll * .6 };
}
