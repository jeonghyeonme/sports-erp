const c = require('./lib'); const path=require('path');
(async () => {
  const { browser, page } = await c.connect();
  await page.addStyleTag({ content: '.page-desc{display:none!important}' });
  const clip = async (name) => { const h = await page.evaluate(()=>{let b=0;document.querySelectorAll('main *').forEach(e=>{const r=e.getBoundingClientRect();if(r.height>0)b=Math.max(b,r.bottom+window.scrollY)});return b}); await page.screenshot({path:path.join(c.OUT,name+'.png'),clip:{x:0,y:0,width:1600,height:Math.min(900,Math.max(480,Math.round(h)+48))}}); };
  const btns = () => page.evaluate(()=>[...document.querySelectorAll('main button')].map(b=>b.textContent.trim()));
  const click = async (txt, idx=0) => { const ok = await page.evaluate((t,i)=>{const b=[...document.querySelectorAll('main button')].filter(x=>x.textContent.trim()===t)[i]; if(!b) return false; b.click(); return true;}, txt, idx); if(!ok) throw new Error('버튼 없음 '+txt); await c.sleep(1200); };
  await click('예약하기', 1);
  console.log(await c.text(page)); console.log(await btns());
  await clip('s3_reserve_pending');
  const b = await btns();
  const pay = b.find(x=>/결제/.test(x));
  if (pay) { await click(pay); console.log(await c.text(page)); console.log(await btns()); await clip('s3_reserve_paid'); }
  await browser.disconnect();
})().catch(e=>{console.error(e.message);process.exit(1)});
