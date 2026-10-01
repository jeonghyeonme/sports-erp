const c = require('./lib');
(async () => {
  const { browser, page } = await c.connect();
  await page.addStyleTag({ content: '.page-desc{display:none!important}' });
  const bottom = () => page.evaluate(() => Math.max(...[...document.querySelectorAll('main *')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0 && r.width > 0 && r.top < 900).map((r) => r.bottom)));
  const clipShot = async (name) => {
    const b = await bottom();
    const h = Math.min(900, Math.max(480, Math.round(b + 48)));
    const file = require('path').join(c.OUT, name + '.png');
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1600, height: h } });
    console.log(name, '1600x' + h);
  };
  const toTop = async () => { await page.evaluate(() => { window.scrollTo(0, 0); const m = document.querySelector('main'); if (m) m.scrollTop = 0; }); await c.sleep(300); };
  const setBy = (label, val) => page.evaluate((l, v) => { const f = [...document.querySelectorAll('.field')].find((x) => x.innerText.trim().startsWith(l)); const el = f && f.querySelector('input,select,textarea'); if (!el) return false; const P = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(P, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, label, val);

  // 근태 (체크인 지각 판정 + 휴가 승인 후 연차 차감)
  await c.nav(page, '/attendance'); await c.sleep(800); await toTop(); await clipShot('s1_attendance');
  // 회원 — 미성년 등록 폼
  await c.nav(page, '/members'); await c.sleep(600); await toTop();
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('회원 등록')).click()); await c.sleep(500);
  await setBy('이름', '김하준'); await setBy('연락처', '010-5555-0123'); await setBy('생년월일', '2015-05-05'); await setBy('성별', 'M'); await c.sleep(400);
  await page.evaluate(() => { const cb = document.querySelector('input[type=checkbox]'); if (cb && !cb.checked) cb.click(); }); await c.sleep(400);
  await page.screenshot({ path: require('path').join(c.OUT, 's1_member.png'), clip: { x: 0, y: 0, width: 1600, height: 900 } }); console.log('s1_member 1600x900');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '취소').click()); await c.sleep(500);
  for (const [name, href] of [['s1_program', '/programs'], ['s1_board', '/board'], ['s1_facilities', '/facilities'], ['s1_assets', '/assets'], ['s1_documents', '/documents']]) {
    await c.nav(page, href); await c.sleep(800); await toTop(); await clipShot(name);
  }
  await browser.disconnect(); console.log('완료');
})().catch((e) => { console.error('오류', e.message); process.exit(1); });
