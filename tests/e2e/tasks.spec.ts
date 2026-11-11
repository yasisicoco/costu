import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

async function addTask(page: Page, title: string, minutes: number) {
  await page.getByLabel('무엇을 공부할까요?', { exact: true }).fill(title);
  await page.getByLabel('목표 시간', { exact: true }).fill(String(minutes));
  await page.getByRole('button', { name: '할 일 추가', exact: true }).click();
}

async function createRoom(page: Page) {
  await page.getByRole('button', { name: '서재 만들기', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '서재 만들기', exact: true }).click();
  await expect(page.locator('.room-connected')).toBeVisible();
}

test('할 일의 실제 기록을 누적해 남은 목표로 다시 집중하고 목표 달성을 표시한다', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await addTask(page, '영어 단어 30개', 3);
  await addTask(page, '수학 문제 5개', 10);
  await page.screenshot({ path: 'test-results/mobile-study-plan.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.study-plan').evaluate(element => Array.from(element.querySelectorAll('button, input')).filter(control => control.getBoundingClientRect().height > 0).every(control => control.getBoundingClientRect().width >= 44 && control.getBoundingClientRect().height >= 44))).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-study-plan-320.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const row = page.getByRole('listitem').filter({ hasText: '영어 단어 30개' });
  await row.getByRole('button', { name: '이 할 일에 집중하기' }).click();
  await expect(page.getByRole('timer')).toHaveText('03:00');
  await expect(page.getByRole('textbox', { name: '공부 주제' })).toHaveValue('영어 단어 30개');
  await expect(row.getByRole('button', { name: '영어 단어 30개 할 일 삭제' })).toBeDisabled();
  await expect(page.getByRole('listitem').filter({ hasText: '수학 문제 5개' }).getByRole('button', { name: '이 할 일에 집중하기' })).toBeDisabled();
  await page.clock.fastForward(61000);
  await page.getByRole('button', { name: '집중 종료', exact: true }).click();
  await page.getByRole('button', { name: '기록하고 마치기' }).click();
  await expect(row).toContainText('1분 / 3분');
  await page.reload();
  await row.getByRole('button', { name: '이 할 일에 집중하기' }).click();
  await expect(page.getByRole('timer')).toHaveText('02:00');
  await page.clock.fastForward(121000);
  await page.getByRole('button', { name: '마친 일 1개' }).click();
  await expect(row).toContainText('목표 달성');
  await expect(row.getByRole('progressbar')).toHaveAttribute('value', '180');
  await expect(row.getByRole('button', { name: '영어 단어 30개 목표 달성' })).toBeDisabled();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions')!));
  expect(sessions).toHaveLength(2); expect(sessions[0].taskId).toBe(sessions[1].taskId);
  await row.getByRole('button', { name: '영어 단어 30개 할 일 삭제' }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('navigation', { name: '모바일 메뉴' }).getByRole('button', { name: '나의 기록' }).click();
  await expect(page.locator('.history-item')).toHaveCount(2);
  await expect(page.locator('.history-list')).toContainText('영어 단어 30개');
});

test('수동 완료와 취소는 공부 시간을 만들지 않고 여러 탭의 계획과 타이머를 공유한다', async ({ page, context }) => {
  await page.goto('/');
  const other = await context.newPage(); await other.goto('/');
  await addTask(page, '계획만 세운 공부', 25);
  const row = page.getByRole('listitem').filter({ hasText: '계획만 세운 공부' });
  await expect(other.getByRole('listitem')).toContainText('계획만 세운 공부');
  await row.getByRole('button', { name: '계획만 세운 공부 완료 표시' }).click();
  await page.getByRole('button', { name: '마친 일 1개' }).click();
  await row.getByRole('button', { name: '계획만 세운 공부 완료 취소' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions') ?? '[]'))).toHaveLength(0);
  await row.getByRole('button', { name: '이 할 일에 집중하기' }).click();
  await expect(other.getByRole('button', { name: '잠시 쉬기' })).toBeVisible();
  await expect(other.getByRole('textbox', { name: '공부 주제' })).toHaveValue('계획만 세운 공부');
  await expect(other.getByRole('button', { name: '계획만 세운 공부 할 일 삭제' })).toBeDisabled();
});

test('기록과 할 일을 함께 내보내고 다른 브라우저에 중복 없이 복원한다', async ({ page, browser }) => {
  await page.clock.install();
  await page.goto('/');
  await addTask(page, '백업할 공부', 5);
  await page.getByRole('button', { name: '이 할 일에 집중하기' }).click();
  await page.clock.fastForward(61000);
  await page.getByRole('button', { name: '집중 종료', exact: true }).click();
  await page.getByRole('button', { name: '기록하고 마치기' }).click();
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '나의 기록' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '내보내기' }).click();
  const download = await downloadPromise;
  const buffer = await readFile((await download.path())!);
  const backup = JSON.parse(buffer.toString());
  expect(backup.tasks).toHaveLength(1); expect(backup.sessions[0].taskId).toBe(backup.tasks[0].id);
  const context = await browser.newContext();
  try {
    const restored = await context.newPage(); await restored.goto('/');
    await restored.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '나의 기록' }).click();
    const file = { name: 'backup.json', mimeType: 'application/json', buffer };
    await restored.getByLabel('기록 백업 파일').setInputFiles(file);
    await restored.getByLabel('기록 백업 파일').setInputFiles(file);
    await expect(restored.locator('.history-item')).toHaveCount(1);
    await restored.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '집중 공간' }).click();
    const row = restored.getByRole('listitem').filter({ hasText: '백업할 공부' });
    await expect(row).toContainText('1분 / 5분');
    await row.getByRole('button', { name: '이 할 일에 집중하기' }).click();
    await expect(restored.getByRole('timer')).toHaveText('04:00');
  } finally { await context.close(); }
});

test('기록과 설정을 보는 동안에도 진행 상태를 확인하고 타이머로 돌아간다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await addTask(page, '계속 집중할 공부', 25);
  await page.getByRole('button', { name: '이 할 일에 집중하기' }).click();
  const nav = page.getByRole('navigation', { name: '모바일 메뉴' });
  await nav.getByRole('button', { name: '나의 기록' }).click();
  await expect(page.getByRole('region', { name: '진행 중인 타이머' })).toContainText('계속 집중할 공부');
  await expect(page.getByRole('region', { name: '진행 중인 타이머' })).toContainText('집중 진행 중');
  await nav.getByRole('button', { name: '나의 설정' }).click();
  await page.screenshot({ path: 'test-results/mobile-active-plan.png', fullPage: true });
  await page.getByRole('button', { name: '타이머로 돌아가기' }).click();
  await expect(page.getByRole('button', { name: '잠시 쉬기' })).toBeFocused();
  await page.getByRole('button', { name: '잠시 쉬기' }).click();
  await nav.getByRole('button', { name: '나의 기록' }).click();
  await expect(page.getByRole('region', { name: '진행 중인 타이머' })).toContainText('집중 일시 정지');
});

for (const result of ['success', 'cancel', 'failure'] as const) {
  test(`친구 초대 공유 시트의 ${result} 동작을 처리한다`, async ({ page }) => {
    await page.addInitScript(result => {
      const state = window as unknown as { shared: ShareData[]; copied: string[] };
      state.shared = []; state.copied = [];
      Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
        state.shared.push(data);
        if (result !== 'success') throw new DOMException('공유 결과', result === 'cancel' ? 'AbortError' : 'NotAllowedError');
      } });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { state.copied.push(value); } } });
    }, result);
    await page.goto('/'); await createRoom(page);
    const code = await page.locator('.invite-code>span').innerText();
    await page.getByRole('button', { name: new RegExp(`${code}.*친구 초대`) }).click();
    const state = await page.evaluate(() => {
      const state = window as unknown as { shared: ShareData[]; copied: string[] };
      return { shared: state.shared, copied: state.copied };
    });
    expect(state.shared).toHaveLength(1); expect(state.shared[0].url).toContain(`?room=${code}`);
    expect(state.copied).toHaveLength(result === 'failure' ? 1 : 0);
    await page.getByRole('button', { name: '링크 복사', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toHaveLength(result === 'failure' ? 2 : 1);
  });
}

test('백업 복원 중 일부 저장이 실패하면 성공으로 안내하지 않고 메모리 데이터를 내보낸다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '나의 기록' }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'costu:sessions') throw new DOMException('가득 참', 'QuotaExceededError'); original.call(this, key, value); };
  });
  const backup = { version: 1, sessions: [{ id: 'quota-session', startedAt: 1, endedAt: 60001, seconds: 60, mode: 'solo', subject: '복원한 공부', taskId: 'quota-task' }], tasks: [{ id: 'quota-task', title: '복원한 할 일', minutes: 5, createdAt: 1, completed: false }] };
  await page.getByLabel('기록 백업 파일').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole('status')).toContainText('기기 저장에 실패');
  await expect(page.locator('.history-item')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '내보내기' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.tasks).toHaveLength(1); expect(exported.sessions).toHaveLength(1);
});

test('배포 화면을 오프라인으로 열어도 할 일을 추가하고 완료 기록을 복원한다', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage(); await page.clock.install();
    await page.goto('http://localhost:3001');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); await context.setOffline(true); await page.reload();
    await addTask(page, '오프라인 공부', 1);
    await page.getByRole('button', { name: '이 할 일에 집중하기' }).click();
    await page.clock.fastForward(61000);
    await expect(page.getByRole('button', { name: '마친 일 1개' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: '마친 일 1개' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: '오프라인 공부' })).toContainText('목표 달성');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('costu:sessions')!))).toHaveLength(1);
  } finally { await context.close(); }
});
