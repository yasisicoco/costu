import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

const fixture = (await readFile(new URL('../fixtures/astronaut.png', import.meta.url))).toString('base64');

async function cameraInput(page: Page, mode: 'face' | 'none' | 'denied' | 'pending' = 'face') {
  await page.addInitScript(({ data, mode }) => {
    const state = window as unknown as { cameraCalls: number; cameraStreams: MediaStream[]; releaseCamera?: () => void; stopFace?: () => void };
    state.cameraCalls = 0; state.cameraStreams = [];
    navigator.mediaDevices.getUserMedia = async constraints => {
      state.cameraCalls++;
      if (constraints?.audio !== false) throw new Error('Audio must remain off');
      if (mode === 'denied') throw new DOMException('denied', 'NotAllowedError');
      if (mode === 'pending') await new Promise<void>(resolve => { state.releaseCamera = resolve; });
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 320;
      const context = canvas.getContext('2d')!;
      if (mode === 'face') { const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode(); context.drawImage(image, 0, 0, 320, 320); }
      else { context.fillStyle = '#aaa'; context.fillRect(0, 0, 320, 320); }
      const stream = canvas.captureStream(15); state.cameraStreams.push(stream);
      state.stopFace = () => { context.fillStyle = '#aaa'; context.fillRect(0, 0, 320, 320); canvas.getContext('2d')?.getImageData(0, 0, 1, 1); };
      return stream;
    };
  }, { data: fixture, mode });
}

async function tracks(page: Page) {
  return page.evaluate(() => (window as unknown as { cameraStreams: MediaStream[] }).cameraStreams.flatMap(stream => stream.getTracks().map(track => track.readyState)));
}

async function createRoom(page: Page) {
  await page.getByRole('button', { name: '서재 만들기', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '서재 만들기', exact: true }).click();
  await expect(page.locator('.room-connected')).toBeVisible();
}

test('카메라는 기본 꺼짐이며 권한 거부 뒤에도 개인 집중을 사용할 수 있다', async ({ page }) => {
  await cameraInput(page, 'denied');
  const loaded: string[] = []; page.on('request', request => loaded.push(request.url()));
  await page.goto('/');
  await expect(page.locator('.camera-avatar-off')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { cameraCalls: number }).cameraCalls)).toBe(0);
  expect(loaded.some(url => url.includes('face-models') || url.includes('human.esm'))).toBe(false);
  await page.getByRole('button', { name: '내 표정으로 움직이기' }).click();
  await expect(page.locator('.camera-avatar-error[role="alert"]')).toContainText('카메라 권한');
  await page.getByRole('button', { name: '집중 시작하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '잠시 쉬기' })).toBeVisible();
  expect(await page.locator('video').count()).toBe(0);
});

test('실제 로컬 모델로 얼굴을 추적하고 끄기·새로고침 때 촬영과 포즈를 해제한다', async ({ page }) => {
  test.setTimeout(60000);
  await cameraInput(page);
  const network: string[] = []; page.on('request', request => network.push(request.url()));
  await page.goto('/');
  await page.getByRole('button', { name: '내 표정으로 움직이기' }).click();
  await expect(page.locator('.camera-avatar-tracking')).toBeVisible({ timeout: 45000 });
  expect(network.filter(url => url.includes('/face-models/') && /\.(json|bin)$/.test(url))).toHaveLength(4);
  expect(network.filter(url => !url.startsWith('http://localhost:5173'))).toEqual([]);
  expect(await page.locator('video').evaluateAll(videos => videos.every(video => getComputedStyle(video).clipPath === 'inset(100%)'))).toBe(true);
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.locator('.camera-avatar-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/camera-tracking.png', fullPage: true });
  await page.getByRole('button', { name: '표정 연결 끄기' }).click();
  await expect(page.locator('.camera-avatar-off')).toBeVisible();
  expect(await tracks(page)).toEqual(['ended']); expect(await page.locator('video').count()).toBe(0);
  expect(await page.locator('.camera-avatar-preview svg>g>g').getAttribute('transform')).toBeNull();
  await page.getByRole('button', { name: '내 표정으로 움직이기' }).click();
  await expect(page.locator('.camera-avatar-tracking')).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: '표정 연결 끄기' }).click();
  expect(await tracks(page)).toEqual(['ended', 'ended']);
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { cameraCalls: number }).cameraCalls)).toBe(0);
  await expect(page.locator('.camera-avatar-off')).toBeVisible();
});

test('같은 서재에는 동작 수치만 전달하고 카메라를 끄면 친구 아바타가 중립으로 돌아간다', async ({ browser }) => {
  test.setTimeout(60000);
  const a = await browser.newContext(); const b = await browser.newContext();
  try {
    const owner = await a.newPage(); const friend = await b.newPage();
    await cameraInput(owner);
    const packets: string[] = [];
    owner.on('websocket', socket => socket.on('framesent', message => { if (typeof message.payload === 'string') packets.push(message.payload); }));
    await owner.goto('/'); await createRoom(owner);
    const code = await owner.locator('.invite-code>span').innerText();
    await friend.goto(`/?room=${code}`);
    await friend.getByRole('dialog').getByRole('button', { name: '함께 집중하기', exact: true }).click();
    await expect(owner.locator('.member')).toHaveCount(2);
    await owner.getByRole('button', { name: '내 표정으로 움직이기' }).click();
    await expect(owner.locator('.camera-avatar-tracking')).toBeVisible({ timeout: 45000 });
    const remote = friend.locator('.member-avatar svg>g>g').first();
    await expect(remote).toHaveAttribute('transform', /rotate/);
    const sent = packets.filter(packet => packet.startsWith('42[')).map(packet => JSON.parse(packet.slice(2))).filter(packet => packet[0] === 'avatar:motion' && packet[1]);
    expect(sent.length).toBeGreaterThan(0);
    for (const [, motion] of sent) {
      expect(Object.keys(motion).sort()).toEqual(['leftEye', 'mouth', 'pitch', 'rightEye', 'roll', 'smile', 'yaw']);
      expect(Object.values(motion).every(value => typeof value === 'number')).toBe(true);
    }
    expect(packets.some(packet => packet.includes('data:image') || packet.includes('base64'))).toBe(false);
    const keys = await owner.evaluate(() => Object.keys(localStorage));
    expect(keys.some(key => /camera|motion|face/i.test(key))).toBe(false);
    await owner.evaluate(() => (window as unknown as { stopFace: () => void }).stopFace());
    await expect(owner.locator('.camera-avatar-searching')).toBeVisible();
    await expect(remote).not.toHaveAttribute('transform', /rotate/);
    await owner.getByRole('button', { name: '표정 연결 끄기' }).click();
    await expect(remote).not.toHaveAttribute('transform', /rotate/);
    expect(await tracks(owner)).toEqual(['ended']);
  } finally { await a.close(); await b.close(); }
});

test('권한 요청 중 취소하면 나중에 도착한 스트림도 즉시 종료한다', async ({ page }) => {
  await cameraInput(page, 'pending'); await page.goto('/');
  await page.getByRole('button', { name: '내 표정으로 움직이기' }).click();
  await page.getByRole('button', { name: '준비 취소' }).click();
  await page.evaluate(() => (window as unknown as { releaseCamera: () => void }).releaseCamera());
  await expect.poll(() => tracks(page)).toEqual(['ended']);
  await expect(page.locator('.camera-avatar-off')).toBeVisible(); expect(await page.locator('video').count()).toBe(0);
});

test('얼굴이 없으면 중립으로 표시하고 앱을 숨기면 카메라를 해제한다', async ({ page }) => {
  test.setTimeout(60000);
  await cameraInput(page, 'none'); await page.goto('/');
  await page.getByRole('button', { name: '집중 시작하기', exact: true }).click();
  await page.getByRole('button', { name: '내 표정으로 움직이기' }).click();
  await expect(page.locator('.camera-avatar-searching')).toBeVisible({ timeout: 45000 });
  expect(await page.locator('.camera-avatar-preview svg>g>g').getAttribute('transform')).toBeNull();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.camera-avatar-off')).toBeVisible();
  expect(await tracks(page)).toEqual(['ended']);
  await expect(page.getByRole('button', { name: '잠시 쉬기' })).toBeVisible();
});

test('카메라 장치가 종료되면 움직임을 멈추고 모든 트랙을 해제한다', async ({ page }) => {
  test.setTimeout(60000);
  await cameraInput(page); await page.goto('/');
  await page.getByRole('button', { name: '내 표정으로 움직이기' }).click();
  await expect(page.locator('.camera-avatar-tracking')).toBeVisible({ timeout: 45000 });
  await page.evaluate(() => (window as unknown as { cameraStreams: MediaStream[] }).cameraStreams[0].getVideoTracks()[0].dispatchEvent(new Event('ended')));
  await expect(page.locator('.camera-avatar-error[role="alert"]')).toContainText('카메라 연결이 종료');
  expect(await tracks(page)).toEqual(['ended']); expect(await page.locator('video').count()).toBe(0);
});

test('한 번 준비한 표정 모델은 같은 배포의 오프라인 개인 아바타에도 사용한다', async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext();
  try {
    const page = await context.newPage(); await cameraInput(page);
    await page.goto('http://localhost:3001');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload();
    await page.getByRole('button', { name: '내 표정으로 움직이기' }).click();
    await expect(page.locator('.camera-avatar-tracking')).toBeVisible({ timeout: 45000 });
    await page.getByRole('button', { name: '표정 연결 끄기' }).click();
    await expect.poll(() => page.evaluate(async () => {
      const stored = (await Promise.all((await caches.keys()).filter(key => key.startsWith('costu-')).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat();
      return stored.filter(url => url.includes('/face-models/') && /\.(json|bin)$/.test(url)).length;
    })).toBe(4);
    await context.setOffline(true); await page.reload();
    await expect(page.locator('.camera-avatar-off')).toBeVisible();
    await page.getByRole('button', { name: '내 표정으로 움직이기' }).click();
    await expect(page.locator('.camera-avatar-tracking')).toBeVisible({ timeout: 45000 });
    await page.getByRole('button', { name: '표정 연결 끄기' }).click();
    expect(await tracks(page)).toEqual(['ended']);
  } finally { await context.close(); }
});
