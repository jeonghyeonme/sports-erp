// 산출물 Word 문서용 도식 PNG — 발표 덱의 도식 코드(figs-45.js)를 그대로 쓰고, 독립 SVG로 그려 Chromium으로 PNG를 뜬다.
//   node scripts/deliverables/render_figs.js   → scripts/deliverables/figs/*.png
const fs = require('fs');
const path = require('path');
const VIZ = path.resolve(__dirname, '../../docs/presentation/assets/4-5_종합발표/deck-source/viz');
const lib = require(path.join(VIZ, 'lib'));
lib.setMode('file');
const F = require(path.join(VIZ, 'figs-45'));
const OUT = path.join(__dirname, 'figs');
const list = { biz: F.bizCycle, arch: F.sysArch, iso: F.isolationFlow, rsv: F.reservationFlow, erd: F.dataCore, memberapp: F.memberAppBar, docs: F.docTiers };
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  for (const [name, fn] of Object.entries(list)) {
    const svg = fn().replace(/font-family="[^"]*"/g, `font-family="'Noto Sans CJK KR','Noto Sans KR',sans-serif"`);
    await page.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
    const el = await page.$('svg');
    await el.screenshot({ path: path.join(OUT, name + '.png') });
  }
  await browser.close();
  console.log('도식', Object.keys(list).length, '개 →', OUT, lib.WARN.length ? lib.WARN : '');
})();
