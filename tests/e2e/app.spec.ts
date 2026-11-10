import { test, expect } from '@playwright/test';

test('타이머를 새로고침해도 복구하고 종료 기록을 보관한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: '공부 주제' }).fill('영어 단어');
  await page.getByRole('button', { name: '집중 시작하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '잠시 쉬기' })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByRole('button', { name: '잠시 쉬기' })).toBeVisible();
  await page.getByRole('button', { name: '잠시 쉬기' }).click();
  await page.getByRole('button', { name: '집중 종료', exact: true }).click();
  await page.getByRole('button', { name: '기록하고 마치기' }).click();
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '나의 기록' }).click();
  await expect(page.locator('.history-list')).toContainText('영어 단어');
  await page.reload();
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '나의 기록' }).click();
  await expect(page.locator('.history-item')).toHaveCount(1);
});

test('서로 다른 브라우저에서 초대 링크·상태·리액션이 동기화된다', async ({ browser }) => {
  const a = await browser.newContext(); const b = await browser.newContext();
  try {
    const owner = await a.newPage(); const friend = await b.newPage();
    await owner.goto('/');
    await owner.getByRole('button', { name: '서재 만들기', exact: true }).click();
    await owner.getByRole('dialog').getByRole('button', { name: '서재 만들기', exact: true }).click();
    await expect(owner.locator('.invite-code')).toBeVisible();
    const code = await owner.locator('.invite-code>span').innerText();
    await friend.goto(`/?room=${code}`);
    await friend.getByRole('dialog').getByRole('button', { name: '함께 집중하기', exact: true }).click();
    await expect(owner.locator('.member')).toHaveCount(2);
    await friend.getByRole('button', { name: '집중 시작하기', exact: true }).click();
    await expect(owner.locator('.member.focusing')).toHaveCount(1);
    await friend.getByRole('button', { name: '🌱 리액션 보내기' }).click();
    await expect(owner.locator('.reaction-bubble')).toHaveText('🌱');
    await friend.getByRole('button', { name: '서재 나가기' }).click();
    await expect(owner.locator('.member')).toHaveCount(1);
  } finally { await a.close(); await b.close(); }
});

test('시간 만료는 한 번만 저장되고 손상된 저장 데이터는 복구된다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('costu:profile', 'broken');
    localStorage.setItem('costu:timer', JSON.stringify({ id: 'expired', startedAt: Date.now() - 61000, duration: 60, remaining: 60, deadline: Date.now() - 1000, status: 'running', mode: 'solo', subject: '완료 테스트' }));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: '집중 시작하기', exact: true })).toBeVisible();
  await page.reload();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions')!));
  expect(sessions).toHaveLength(1);
  expect(sessions[0].seconds).toBe(60);
});

test('모바일 화면에서 가로 넘침 없이 설정·모달·기록을 사용한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: '모바일 메뉴' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-focus.png', fullPage: true });
  await page.getByRole('navigation', { name: '모바일 메뉴' }).getByRole('button', { name: '나의 설정' }).click();
  await page.getByLabel('닉네임').fill('테스트하는 나');
  await page.getByLabel('하루 집중 목표').fill('90');
  await page.getByRole('button', { name: '설정 저장하기' }).click();
  await page.getByRole('navigation', { name: '모바일 메뉴' }).getByRole('button', { name: '집중 공간' }).click();
  await page.getByRole('button', { name: '25분', exact: true }).click();
  await page.getByRole('button', { name: '45분', exact: true }).click();
  await page.getByRole('button', { name: '이 시간으로 집중하기' }).click();
  await expect(page.getByRole('timer')).toHaveText('45:00');
});

test('데스크톱의 초기 화면과 키보드 모달 접근성을 확인한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('각자의 공부');
  await page.screenshot({ path: 'test-results/desktop-focus.png', fullPage: true });
  await page.getByRole('button', { name: '초대 코드로 참여' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('혼자 있는 방도 새로고침하면 재연결하고 참가자를 중복 생성하지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '서재 만들기', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '서재 만들기', exact: true }).click();
  await expect(page.locator('.invite-code')).toBeVisible();
  const code = await page.locator('.invite-code>span').innerText();
  await page.reload();
  await expect(page.locator('.invite-code>span')).toHaveText(code);
  await expect(page.locator('.member')).toHaveCount(1);
});

test('기록 복원은 기존 기록을 보관하고 중복 항목을 합친다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '나의 기록' }).click();
  const session = { id: 'backup-1', startedAt: Date.now() - 60000, endedAt: Date.now(), seconds: 60, mode: 'solo', subject: '복원한 공부' };
  const file = { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, sessions: [session] })) };
  await page.getByLabel('기록 백업 파일').setInputFiles(file);
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.getByLabel('기록 백업 파일').setInputFiles(file);
  await expect(page.locator('.history-item')).toHaveCount(1);
  await expect(page.locator('.history-list')).toContainText('복원한 공부');
  await page.getByLabel('기록 백업 파일').setInputFiles({ ...file, buffer: Buffer.from('{bad json') });
  await expect(page.getByRole('status')).toContainText('올바른 costu 백업');
});

test('배포 빌드를 한 번 열면 오프라인에서도 개인 집중을 시작할 수 있다', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('http://localhost:3001');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('button', { name: '집중 시작하기', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '집중 시작하기', exact: true }).click();
    await expect(page.getByRole('button', { name: '잠시 쉬기' })).toBeVisible();
  } finally { await context.close(); }
});

test('같은 브라우저의 다른 탭에도 타이머 변경을 반영한다', async ({ context, page }) => {
  await page.goto('/');
  const other = await context.newPage(); await other.goto('/');
  await page.getByRole('button', { name: '집중 시작하기', exact: true }).click();
  await expect(other.getByRole('button', { name: '잠시 쉬기' })).toBeVisible();
  await other.getByRole('button', { name: '잠시 쉬기' }).click();
  await expect(page.getByRole('button', { name: '다시 집중하기' })).toBeVisible();
});

test('집중 후 선택한 5분 휴식만 시작하고 휴식 기록과 자동 집중을 만들지 않는다', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '25분', exact: true }).click();
  await page.getByLabel('직접 설정').fill('1');
  await page.getByRole('button', { name: '이 시간으로 집중하기' }).click();
  await page.getByRole('button', { name: '집중 시작하기', exact: true }).click();
  await page.clock.fastForward(61000);
  await expect(page.getByRole('button', { name: '5분 휴식 시작하기' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('01:00');
  await page.reload();
  await page.getByRole('button', { name: '5분 휴식 시작하기' }).click();
  await expect(page.getByRole('timer')).toHaveText('05:00');
  await page.clock.fastForward(60000);
  await page.getByRole('button', { name: '휴식 일시 정지' }).click();
  const paused = await page.getByRole('timer').innerText();
  await page.clock.fastForward(60000);
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText(paused);
  await page.getByRole('button', { name: '휴식 계속하기' }).click();
  await page.clock.fastForward(241000);
  await expect(page.getByRole('button', { name: '집중 시작하기', exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('01:00');
  await expect(page.getByRole('button', { name: '5분 휴식 시작하기' })).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions')!))).toHaveLength(1);
});

test('휴식을 건너뛰거나 일찍 마쳐도 다음 집중 길이와 공부 기록을 보존한다', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '집중 시작하기', exact: true }).click();
  await page.clock.fastForward(61000);
  await page.getByRole('button', { name: '집중 종료', exact: true }).click();
  await page.getByRole('button', { name: '기록하고 마치기' }).click();
  await page.getByRole('button', { name: '휴식 건너뛰기' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '5분 휴식 시작하기' })).toHaveCount(0);
  await page.getByRole('button', { name: '집중 시작하기', exact: true }).click();
  await page.clock.fastForward(1501000);
  await page.getByRole('button', { name: '5분 휴식 시작하기' }).click();
  await page.clock.fastForward(10000);
  await page.reload();
  await expect(page.getByRole('button', { name: '휴식 일시 정지' })).toBeVisible();
  await page.getByRole('button', { name: '휴식 마치기', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveText('25:00');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions')!))).toHaveLength(2);
});

test('여러 탭에서 동시에 만료해도 기록이 한 번만 남고 휴식을 공유한다', async ({ page, context }) => {
  await page.goto('/');
  const other = await context.newPage(); await other.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('costu:timer', JSON.stringify({ id: 'shared-expiry', startedAt: Date.now() - 61000, duration: 60, remaining: 60, deadline: Date.now() - 1000, status: 'running', mode: 'solo', subject: '동시 완료' }));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: '5분 휴식 시작하기' })).toBeVisible();
  await expect(other.getByRole('button', { name: '5분 휴식 시작하기' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions')!))).toHaveLength(1);
  await other.getByRole('button', { name: '5분 휴식 시작하기' }).click();
  await expect(page.getByRole('button', { name: '휴식 일시 정지' })).toBeVisible();
  await page.getByRole('button', { name: '휴식 마치기', exact: true }).click();
  await expect(other.getByRole('button', { name: '집중 시작하기', exact: true })).toBeVisible();
  expect(await other.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions')!))).toHaveLength(1);
});

test('연결 단절 중 일시 정지한 상태와 기록이 복귀 후에도 유지된다', async ({ browser }) => {
  const a = await browser.newContext(); const b = await browser.newContext();
  try {
    const owner = await a.newPage(); const friend = await b.newPage();
    await owner.goto('/');
    await owner.getByRole('button', { name: '서재 만들기', exact: true }).click();
    await owner.getByRole('dialog').getByRole('button', { name: '서재 만들기', exact: true }).click();
    const code = await owner.locator('.invite-code>span').innerText();
    await friend.goto(`/?room=${code}`);
    await friend.getByRole('dialog').getByRole('button', { name: '함께 집중하기', exact: true }).click();
    await friend.getByRole('button', { name: '집중 시작하기', exact: true }).click();
    await expect(owner.locator('.member.focusing')).toHaveCount(1);
    await friend.waitForTimeout(1100);
    await b.setOffline(true);
    await expect(friend.locator('.room-offline')).toBeVisible();
    await friend.getByRole('button', { name: '잠시 쉬기' }).click();
    await expect(friend.getByRole('button', { name: '🌱 리액션 보내기' })).toBeDisabled();
    const paused = await friend.getByRole('timer').innerText();
    await b.setOffline(false);
    await expect(friend.locator('.room-connected')).toBeVisible({ timeout: 15000 });
    await expect(owner.locator('.member.away')).toHaveCount(1);
    await expect(owner.locator('.member')).toHaveCount(2);
    await expect(friend.getByRole('timer')).toHaveText(paused);
    await friend.reload();
    await expect(owner.locator('.member.away')).toHaveCount(1);
    await expect(friend.getByRole('button', { name: '다시 집중하기' })).toBeVisible();
    await friend.getByRole('button', { name: '집중 종료', exact: true }).click();
    await friend.getByRole('button', { name: '기록하고 마치기' }).click();
    await friend.reload();
    const sessions = await friend.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions') ?? '[]'));
    expect(sessions).toHaveLength(1); expect(sessions[0].mode).toBe('together');
  } finally { await a.close(); await b.close(); }
});

test('단절 중 서재에서 나가면 복귀 시 자동으로 다시 들어가지 않는다', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '서재 만들기', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '서재 만들기', exact: true }).click();
  await expect(page.locator('.room-connected')).toBeVisible();
  await context.setOffline(true);
  await expect(page.locator('.room-offline')).toBeVisible();
  await page.getByRole('button', { name: '서재 나가기' }).click();
  await context.setOffline(false);
  await expect(page.locator('.connection-notice')).toHaveCount(0, { timeout: 15000 });
  await page.reload();
  await expect(page.locator('.room-panel')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('costu:room'))).toBeNull();
});

test('복귀 시 이미 저장된 세션을 덮어쓰지 않고 백업 기록도 보존한다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const saved = { id: 'saved', startedAt: Date.now() - 60000, endedAt: Date.now() - 1000, seconds: 59, mode: 'solo', subject: '원래 기록' };
    localStorage.setItem('costu:sessions', JSON.stringify([saved]));
    localStorage.setItem('costu:timer', JSON.stringify({ id: 'saved', startedAt: saved.startedAt, duration: 60, remaining: 60, deadline: Date.now() - 1000, status: 'running', mode: 'solo', subject: '중복 완료' }));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: '5분 휴식 시작하기' })).toBeVisible();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions')!));
  expect(sessions).toHaveLength(1); expect(sessions[0].subject).toBe('원래 기록'); expect(sessions[0].seconds).toBe(59);
});

test('오프라인에서 만료된 집중은 한 번 기록하고 휴식 상태도 서재에 복원한다', async ({ browser }) => {
  const a = await browser.newContext(); const b = await browser.newContext();
  try {
    const owner = await a.newPage(); const friend = await b.newPage();
    await friend.clock.install();
    await owner.goto('/');
    await owner.getByRole('button', { name: '서재 만들기', exact: true }).click();
    await owner.getByRole('dialog').getByRole('button', { name: '서재 만들기', exact: true }).click();
    const code = await owner.locator('.invite-code>span').innerText();
    await friend.goto(`/?room=${code}`);
    await friend.getByRole('dialog').getByRole('button', { name: '함께 집중하기', exact: true }).click();
    await friend.getByRole('button', { name: '25분', exact: true }).click();
    await friend.getByLabel('직접 설정').fill('1');
    await friend.getByRole('button', { name: '이 시간으로 집중하기' }).click();
    await friend.getByRole('button', { name: '집중 시작하기', exact: true }).click();
    await expect(owner.locator('.member.focusing')).toHaveCount(1);
    await b.setOffline(true);
    await expect(friend.locator('.room-offline')).toBeVisible();
    await friend.clock.fastForward(61000);
    await expect(friend.getByRole('button', { name: '5분 휴식 시작하기' })).toBeVisible();
    await b.setOffline(false);
    await expect(friend.locator('.room-connected')).toBeVisible();
    await expect(owner.locator('.member.focusing')).toHaveCount(0);
    await friend.getByRole('button', { name: '5분 휴식 시작하기' }).click();
    await expect(owner.locator('.member.away')).toHaveCount(1);
    await friend.reload();
    await expect(friend.locator('.room-connected')).toBeVisible();
    await expect(owner.locator('.member.away')).toHaveCount(1);
    await expect(owner.locator('.member')).toHaveCount(2);
    await friend.getByRole('button', { name: '휴식 마치기', exact: true }).click();
    await expect(owner.locator('.member.away')).toHaveCount(0);
    const sessions = await friend.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions')!));
    expect(sessions).toHaveLength(1); expect(sessions[0].seconds).toBe(60);
  } finally { await a.close(); await b.close(); }
});

test('키보드 포커스가 모달 안에서 순환하고 닫으면 이전 버튼으로 돌아간다', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '25분', exact: true });
  await trigger.click();
  const close = page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: '이 시간으로 집중하기' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
