const c = require('./lib');
const fs = require('fs'); const path = require('path');
(async () => {
  const { browser, page } = await c.connect();
  await page.addStyleTag({ content: '.page-desc{display:none!important}' });
  let token = null;
  page.on('request', (r) => { const a = r.headers()['authorization']; if (a && r.url().includes('/api/')) token = a; });
  const toTop = async () => { await page.evaluate(() => { window.scrollTo(0, 0); const m = document.querySelector('main'); if (m) m.scrollTop = 0; }); await c.sleep(300); };

  // 권한관리: 박서연을 지점 관리자로 전환한 화면
  await c.nav(page, '/permissions'); await c.sleep(900);
  const opts = await page.evaluate(() => [...document.querySelectorAll('tbody tr')][1].querySelector('select').innerHTML);
  console.log('select 옵션:', opts.replace(/<\/?option[^>]*?value="([^"]*)"[^>]*>/g, '[$1]').slice(0, 120));
  const changed = await page.evaluate(() => { const s = [...document.querySelectorAll('tbody tr')][1].querySelector('select'); const v = [...s.options].find((o) => /BRANCH_ADMIN/.test(o.value)); if (!v) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, v.value); s.dispatchEvent(new Event('change', { bubbles: true })); return true; });
  console.log('박서연 → 지점 관리자', changed); await c.sleep(1200); await toTop();
  await page.screenshot({ path: path.join(c.OUT, 's2_permissions.png'), clip: { x: 0, y: 0, width: 1600, height: 900 } });
  console.log('s2_permissions 저장');

  // 토큰 확보(앱이 보내는 요청 헤더에서)
  await c.nav(page, '/staff'); await c.sleep(1200);
  console.log('토큰 확보:', token ? '예' : '아니오');
  await browser.disconnect();
  if (!token) return;
  const api = async (method, url, body) => { const r = await fetch('http://localhost:3000/api/v1' + url, { method, headers: { 'Content-Type': 'application/json', Authorization: token }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, body: j }; };
  const out = {};
  out.hire = await api('POST', '/staff', { branchId: 'branch-seocho', name: '윤채원', email: 'yoon.chaewon@spoism.example', position: '트레이너', employmentType: '정규직' });
  const id = out.hire.body?.data?.id; console.log('채용', out.hire.status, id, out.hire.body?.data?.staffCode);
  if (id) {
    out.assign = await api('POST', `/staff/${id}/assignments`, { branchId: 'branch-gangnam', note: '서초점 → 강남점 재배치' });
    console.log('재배치', out.assign.status, out.assign.body?.data?.branchId);
    out.history = await api('GET', `/staff/${id}/assignments`);
    console.log('이력', out.history.status, JSON.stringify(out.history.body?.data).slice(0, 400));
  }
  fs.writeFileSync(path.join(c.OUT, 'hr_api.json'), JSON.stringify(out, null, 2));
})().catch((e) => { console.error('오류', e.message); process.exit(1); });
