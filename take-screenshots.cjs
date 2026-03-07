const { chromium } = require('playwright-core');

const BASE = 'http://localhost:3456';
const DIR = '/home/user/lobsterboard/screenshots';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
  });

  const page = await ctx.newPage();
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = (name) => page.screenshot({ path: DIR + '/' + name, fullPage: false });
  const shotFull = (name) => page.screenshot({ path: DIR + '/' + name, fullPage: true });

  // Open/close settings drawer via JS to avoid toggle issues
  const openSettings = () => page.evaluate(() => {
    document.getElementById('settings-drawer')?.classList.add('open');
  });
  const closeSettings = () => page.evaluate(() => {
    document.getElementById('settings-drawer')?.classList.remove('open');
  });
  const switchViewTo = (v) => page.evaluate((view) => {
    // Directly call the view switch buttons
    document.querySelector(`[data-view="${view}"]`)?.click();
  }, v);
  const setTheme = (t) => page.evaluate((theme) => {
    const sel = document.getElementById('mobile-theme-select');
    if (sel) { sel.value = theme; sel.dispatchEvent(new Event('change')); }
  }, t);

  // ─── 1. STANDALONE SETUP SCREEN ───
  console.log('📸 1. Standalone setup screen...');
  await page.goto(BASE + '/mobile-standalone.html', { waitUntil: 'domcontentloaded' });
  await wait(1000);
  await shot('01-standalone-setup.png');

  // ─── 2-7. MOBILE STREAM VIEW ───
  console.log('📸 2. Stream view (default)...');
  await page.goto(BASE + '/mobile', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await wait(5000);
  await shot('02-stream-view-all.png');

  console.log('📸 3. Stream view scrolled...');
  await page.evaluate(() => window.scrollTo(0, 600));
  await wait(500);
  await shot('03-stream-scrolled.png');

  console.log('📸 4. Stream full page...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(300);
  await shotFull('04-stream-full-page.png');

  console.log('📸 5. OpenClaw filter...');
  await page.click('[data-filter="openclaw"]');
  await wait(2000);
  await shot('05-filter-openclaw.png');

  console.log('📸 6. AI filter...');
  await page.click('[data-filter="ai"]');
  await wait(2000);
  await shot('06-filter-ai.png');

  console.log('📸 7. System filter...');
  await page.click('[data-filter="system"]');
  await wait(2000);
  await shot('07-filter-system.png');

  // Reset
  await page.click('[data-filter="all"]');
  await wait(1000);

  // ─── 8. SETTINGS DRAWER ───
  console.log('📸 8. Settings drawer...');
  await openSettings();
  await wait(500);
  await shot('08-settings-drawer.png');
  await closeSettings();

  // ─── 9-10. TABS VIEW ───
  console.log('📸 9. Tabs view...');
  await openSettings();
  await wait(200);
  await switchViewTo('tabs');
  await wait(200);
  await closeSettings();
  await wait(2000);
  await shot('09-tabs-view.png');

  console.log('📸 10. Tabs full page...');
  await shotFull('10-tabs-full-page.png');

  // ─── 11-12. COMMAND CENTER ───
  console.log('📸 11. Command Center...');
  await openSettings();
  await wait(200);
  await switchViewTo('command');
  await wait(200);
  await closeSettings();
  await wait(3000);
  await shot('11-command-center.png');

  console.log('📸 12. Command Center full page...');
  await shotFull('12-command-full-page.png');

  // ─── 13. FULLSCREEN WIDGET ───
  console.log('📸 13. Fullscreen widget...');
  await page.evaluate(() => {
    const w = document.querySelector('.mobile-widget');
    if (w) w.click();
  });
  await wait(2000);
  await shot('13-fullscreen-widget.png');
  await page.evaluate(() => {
    const overlay = document.getElementById('fullscreen-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  });
  await wait(300);

  // ─── THEME SCREENSHOTS — switch to stream first ───
  await switchViewTo('stream');
  await wait(2000);

  console.log('📸 14. Feminine theme...');
  await setTheme('feminine');
  await wait(1000);
  await shot('14-theme-feminine.png');

  console.log('📸 15. Feminine Dark theme...');
  await setTheme('feminine-dark');
  await wait(1000);
  await shot('15-theme-feminine-dark.png');

  console.log('📸 16. Terminal theme...');
  await setTheme('terminal');
  await wait(1000);
  await shot('16-theme-terminal.png');

  console.log('📸 17. Paper theme...');
  await setTheme('paper');
  await wait(1000);
  await shot('17-theme-paper.png');

  // ─── 18. TERMINAL + COMMAND CENTER ───
  console.log('📸 18. Terminal + Command Center...');
  await setTheme('terminal');
  await switchViewTo('command');
  await wait(2000);
  await shot('18-terminal-command.png');

  // ─── 19. DEFAULT + TABS ───
  console.log('📸 19. Default + Tabs...');
  await setTheme('default');
  await switchViewTo('tabs');
  await wait(2000);
  await shot('19-default-tabs.png');

  // ─── 20. SETTINGS WITH VIEW SWITCHER ───
  console.log('📸 20. Settings view switcher...');
  await openSettings();
  await wait(500);
  await shot('20-settings-view-switcher.png');

  await browser.close();
  console.log('\n✅ All 20 screenshots saved to ' + DIR);
})();
