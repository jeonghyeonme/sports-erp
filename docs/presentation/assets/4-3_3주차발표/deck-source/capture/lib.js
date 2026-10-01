// 로그인된 Chrome 창(원격 디버깅 9333)에 붙어서 화면을 파일로 캡처하는 공용 도구.
// 새로고침·주소창 이동을 하면 토큰(메모리)이 사라지므로 항상 사이드바 링크 클릭으로만 이동한다.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

async function connect() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('localhost:5173'));
  if (!page) throw new Error('앱 탭을 찾지 못함');
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  return { browser, page };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function nav(page, href) {
  const ok = await page.evaluate((h) => {
    const a = document.querySelector(`a[href="${h}"]`);
    if (!a) return false;
    a.click();
    return true;
  }, href);
  if (!ok) throw new Error('링크 없음: ' + href);
  await sleep(1200);
}
async function shot(page, name, opts = {}) {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, ...opts });
  return file;
}
async function links(page) {
  return page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map((a) => `${a.getAttribute('href')} | ${a.textContent.trim().slice(0, 20)}`));
}
async function text(page, sel = 'main') {
  return page.evaluate((s) => (document.querySelector(s) || document.body).innerText.replace(/\n{2,}/g, '\n').slice(0, 1500), sel);
}
module.exports = { connect, nav, shot, links, text, sleep, OUT };
