import { test, expect, type Page } from '@playwright/test';

async function checkMobile(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const problems = await page.evaluate(() => {
    const issues: string[] = [];
    const visible = (element: Element) => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden';
    for (const element of document.querySelectorAll('button, a, input:not([type="file"])')) {
      if (!visible(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 43.9 || rect.height < 43.9) issues.push(`touch: ${element.textContent?.trim() || element.getAttribute('aria-label')}: ${rect.width}×${rect.height}`);
    }
    const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const luminance = (values: number[]) => values.slice(0, 3).reduce((sum, value, i) => {
      const channel = value / 255;
      return sum + (channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
    }, 0);
    for (const element of document.querySelectorAll('body *')) {
      if (!visible(element) || element.closest('svg, [aria-hidden="true"], button:disabled, input:disabled')) continue;
      const text = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent?.trim()).join('');
      if (!text) continue;
      const style = getComputedStyle(element);
      if (parseFloat(style.fontSize) === 0) continue;
      const foreground = rgb(style.color);
      if ((foreground[3] ?? 1) === 0) continue;
      let background = [255, 255, 255];
      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        const color = rgb(getComputedStyle(parent).backgroundColor);
        if ((color[3] ?? 1) === 1) { background = color; break; }
      }
      const a = luminance(foreground), b = luminance(background);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) issues.push(`contrast: ${text.slice(0, 25)}: ${ratio.toFixed(2)}`);
    }
    return issues;
  });
  expect(problems).toEqual([]);
}

for (const width of [320, 390]) {
  test(`${width}px에서 집중·서재·설정·기록·모달의 터치 영역과 텍스트 대비를 확인한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await checkMobile(page);
    await page.getByRole('button', { name: '25분', exact: true }).click();
    await checkMobile(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '서재 만들기', exact: true }).click();
    await checkMobile(page);
    await page.getByRole('dialog').getByRole('button', { name: '서재 만들기', exact: true }).click();
    await expect(page.locator('.room-connected')).toBeVisible();
    await checkMobile(page);
    await page.screenshot({ path: `test-results/mobile-${width}-room.png`, fullPage: true });
    const nav = page.getByRole('navigation', { name: '모바일 메뉴' });
    await nav.getByRole('button', { name: '나의 설정' }).click();
    await checkMobile(page);
    await nav.getByRole('button', { name: '나의 기록' }).click();
    await checkMobile(page);
  });
}

test('1280px 화면을 200% 확대한 폭에서도 모바일 콘텐츠를 읽고 조작한다', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto('/');
  await checkMobile(page);
  await page.getByRole('button', { name: '25분', exact: true }).click();
  await page.getByLabel('직접 설정').fill('45');
  await page.getByRole('button', { name: '이 시간으로 집중하기' }).click();
  await expect(page.getByRole('timer')).toHaveText('45:00');
  await checkMobile(page);
});
