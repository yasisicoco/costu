import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motionFromFace, smoothMotion } from '../src/lib/avatar-motion';

function face() {
  const mesh = Array.from({ length: 468 }, () => [0, 0, 0] as [number, number, number]);
  for (const [index, x, y] of [[33, 0, 0], [133, 20, 0], [159, 10, -3], [145, 10, 3], [263, 40, 0], [362, 60, 0], [386, 50, -3], [374, 50, 3], [61, 10, 40], [291, 50, 40], [13, 30, 40], [14, 30, 40]]) mesh[index] = [x, y, 0];
  return { mesh, rotation: { angle: { yaw: 0, pitch: 0, roll: 0 } } };
}

test('기하점에서 눈 깜빡임·입 벌림·미소와 제한된 고개 동작만 계산한다', () => {
  const input = face();
  const neutral = motionFromFace(input)!;
  assert.equal(neutral.leftEye, 1); assert.equal(neutral.rightEye, 1); assert.equal(neutral.mouth, 0); assert.equal(neutral.smile, 0);
  input.mesh[159] = [10, 0, 0]; input.mesh[145] = [10, 0, 0];
  input.mesh[13] = [30, 40, 0]; input.mesh[14] = [30, 56, 0];
  input.rotation.angle = { yaw: 3, pitch: -3, roll: 3 };
  const animated = motionFromFace(input)!;
  assert.equal(animated.leftEye, 0); assert.equal(animated.rightEye, 1);
  assert.ok(animated.mouth > .8); assert.ok(animated.smile > .5);
  assert.equal(animated.yaw, -1); assert.equal(animated.pitch, -1); assert.equal(animated.roll, -1);
  assert.deepEqual(Object.keys(animated).sort(), ['leftEye', 'mouth', 'pitch', 'rightEye', 'roll', 'smile', 'yaw']);
});

test('얼굴이 없거나 손상된 좌표는 중립으로 돌리고 고개만 부드럽게 연결한다', () => {
  assert.equal(motionFromFace({ mesh: [] }), null);
  const invalid = face(); invalid.mesh[33] = [NaN, 0, 0]; assert.equal(motionFromFace(invalid), null);
  const base = motionFromFace(face())!;
  const next = { ...base, yaw: 1, leftEye: 0, mouth: 1 };
  const smoothed = smoothMotion(next, base);
  assert.equal(smoothed.yaw, .6); assert.equal(smoothed.leftEye, 0); assert.equal(smoothed.mouth, 1);
});
