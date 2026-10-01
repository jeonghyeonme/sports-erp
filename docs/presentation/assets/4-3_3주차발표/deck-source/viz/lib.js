// 시각화 생성 공용 라이브러리 — 같은 도식 코드로 (a) CSS 변수 테마를 쓰는 페이지용 SVG와
// (b) PowerPoint에 넣을 고정 색 독립 SVG를 함께 만든다.
const LIGHT = {
  ink: '#17212B', muted: '#566771', line: '#C5D1CE', paper: '#F4F7F6', surface: '#FFFFFF',
  green: '#17714F', greenBg: '#E2F2EB', blue: '#2456C8', blueBg: '#E4ECFB',
  amber: '#8F5407', amberBg: '#FBEFD9', red: '#B4302A', redBg: '#FBE6E4', gray: '#5F6C74', grayBg: '#ECF0EF',
  lv1: '#2E9E6B', lv2: '#7DB33F', lv3: '#D6B41F', lv4: '#E48A1E', lv5: '#C93B2F',
};
const DARK = {
  ink: '#E6EDF0', muted: '#9DABB3', line: '#34454C', paper: '#0F171B', surface: '#162127',
  green: '#4CC79A', greenBg: '#153A2E', blue: '#86AAFF', blueBg: '#18294F',
  amber: '#F0B45A', amberBg: '#3D2C10', red: '#FF8B82', redBg: '#43201E', gray: '#9AA7AF', grayBg: '#1F2D33',
  lv1: '#3DB37D', lv2: '#8FC24F', lv3: '#DDBA2D', lv4: '#EE9A32', lv5: '#E2564A',
};
const SANS = "'IBM Plex Sans KR','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
const MONO = "'IBM Plex Mono',Consolas,'Courier New',monospace";

let MODE = 'page';
let CUR = 'f';
let USED = new Set();
const WARN = [];
const setMode = (m) => { MODE = m; };
// '#'로 시작하면 테마와 무관한 고정 색(예: 채도 높은 색 위의 글자색)
// 2주차 발표자료(cea04fa5)의 팔레트: 웜 그레이 + 네이비 포인트 + 앰버. 글자 대비가 4.5:1이 되도록 녹색·앰버 글자색만 약간 어둡게.
const DECKP = {
  ink: '#14191C', muted: '#4B5563', line: '#CBD0CD', paper: '#F4F5F3', surface: '#FFFFFF',
  green: '#187650', greenBg: '#E3F3EB', blue: '#1E3A5F', blueBg: '#E7ECF1',
  amber: '#9A5A0C', amberBg: '#FBEEDD', red: '#B3261E', redBg: '#F8E6E4', gray: '#5B6470', grayBg: '#EDEFEE',
  lv1: '#2E9E6B', lv2: '#7DB33F', lv3: '#D6B41F', lv4: '#E48A1E', lv5: '#C93B2F',
};
const col = (n) => (String(n).startsWith('#') ? n : MODE === 'page' ? `var(--${n})` : MODE === 'slide' ? DECKP[n] : LIGHT[n]);
let SLIDE = { left: 126, top: 206, scale: 1.39 };
let TEXTS = [];
const setSlide = (o) => { SLIDE = { ...SLIDE, ...o }; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function est(s, size, mono) {
  let w = 0;
  for (const ch of String(s)) w += ch.charCodeAt(0) > 127 ? size * 1.02 : size * (mono ? 0.62 : 0.56);
  return w;
}

function txt(x, y, s, o = {}) {
  if (MODE === 'slide') { TEXTS.push({ x, y, s: String(s), o }); return ''; }
  const size = o.size || 16;
  const lines = String(s).split('\n');
  const lh = o.lh || Math.round(size * 1.35);
  const tsp = lines.map((ln, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(ln)}</tspan>`).join('');
  const halo = o.halo ? ` paint-order="stroke" stroke="${col('surface')}" stroke-width="5" stroke-linejoin="round"` : '';
  return `<text x="${x}" y="${y}" font-family="${o.mono ? MONO : SANS}" font-size="${size}" font-weight="${o.w || 400}" fill="${col(o.fill || 'ink')}" text-anchor="${o.anchor || 'start'}"${halo}>${tsp}</text>`;
}

const KIND = {
  plain: ['surface', 'line', 'ink'], green: ['greenBg', 'green', 'green'], blue: ['blueBg', 'blue', 'blue'],
  amber: ['amberBg', 'amber', 'amber'], red: ['redBg', 'red', 'red'], gray: ['grayBg', 'gray', 'gray'],
};

// lines: [{t, s(size), w(weight), c(color token), mono}]  — 가운데 정렬로 박스 안에 쌓는다.
function box(x, y, w, h, lines, o = {}) {
  const [fill, stroke, tc] = KIND[o.kind || 'plain'];
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 10}" fill="${col(fill)}" stroke="${col(stroke)}" stroke-width="${o.sw || 1.8}"${o.dash ? ' stroke-dasharray="7 5"' : ''}/>`;
  if (o.term) out += `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" rx="${(o.r ?? 10) - 4}" fill="none" stroke="${col(stroke)}" stroke-width="1.2"/>`;
  const L = (Array.isArray(lines) ? lines : [{ t: lines }]).map((l) => ({ s: 17, w: 500, c: tc, ...l }));
  const heights = L.map((l) => String(l.t).split('\n').length * Math.round(l.s * 1.35));
  const total = heights.reduce((a, b) => a + b, 0);
  let cy = y + (h - total) / 2;
  const ax = o.left ? x + 16 : x + w / 2;
  L.forEach((l, i) => {
    const first = cy + l.s * 1.02;
    out += txt(ax, first, l.t, { size: l.s, w: l.w, fill: l.c, mono: l.mono, anchor: o.left ? 'start' : 'middle' });
    String(l.t).split('\n').forEach((ln) => {
      if (est(ln, l.s, l.mono) > w - 20) WARN.push(`[${CUR}] 박스 폭 초과 (${Math.round(est(ln, l.s, l.mono))}>${w - 20}): "${ln}"`);
    });
    cy += heights[i];
  });
  if (total > h - 6) WARN.push(`[${CUR}] 박스 높이 초과 (${total}>${h - 6}): "${String(L[0].t).slice(0, 20)}"`);
  return out;
}

function arrow(pts, o = {}) {
  const c = o.color || 'ink';
  USED.add(c);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  let s = `<path d="${d}" fill="none" stroke="${col(c)}" stroke-width="${o.sw || 2}"${o.dash ? ' stroke-dasharray="7 5"' : ''}${o.noHead ? '' : ` marker-end="url(#mk-${CUR}-${c})"`} stroke-linejoin="round"/>`;
  if (o.label) {
    const l = o.label;
    s += txt(l.x, l.y, l.t, { size: l.s || 14, fill: l.c || c, anchor: l.a || 'middle', halo: true, mono: l.mono, w: l.w || 500 });
  }
  return s;
}

function line(x1, y1, x2, y2, o = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col(o.c || 'line')}" stroke-width="${o.sw || 1.5}"${o.dash ? ' stroke-dasharray="6 5"' : ''}/>`;
}

function rect(x, y, w, h, o = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 0}" fill="${col(o.fill || 'surface')}" stroke="${o.stroke ? col(o.stroke) : 'none'}" stroke-width="${o.sw || 1.5}"${o.dash ? ' stroke-dasharray="7 5"' : ''}/>`;
}

// 도식 하나를 <svg>로 감싼다. claim은 aria-label(그림이 말하는 한 문장).
function slideParagraph(t) {
  const S = SLIDE.scale;
  const size = t.o.size || 16;
  const fs = Math.max(24, Math.round(size * S));
  const lines = t.s.split('\n');
  const lh = Math.round(fs * 1.3);
  const w = Math.ceil(Math.max(...lines.map((l) => est(l, fs, t.o.mono))) + 28);
  const anchor = t.o.anchor || 'start';
  const X = SLIDE.left + t.x * S;
  const left = anchor === 'middle' ? X - w / 2 : anchor === 'end' ? X - w : X;
  const top = SLIDE.top + t.y * S - fs * 1.05;
  const align = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
  const halo = t.o.halo ? ' text-shadow:0 0 6px #FFFFFF,0 0 6px #FFFFFF,0 0 3px #FFFFFF;' : '';
  const html = lines.map((l) => esc(l)).join('<br>');
  return `<p style="position:absolute; left:${Math.round(left)}px; top:${Math.round(top)}px; width:${w}px; font-size:${fs}px; font-weight:${t.o.w || 400}; line-height:${lh}px; color:${col(t.o.fill || 'ink')}; text-align:${align}; white-space:nowrap;${halo}">${html}</p>`;
}

function svg(id, W, H, claim, build) {
  CUR = id;
  USED = new Set();
  TEXTS = [];
  const inner = build();
  if (MODE === 'slide') {
    const S = SLIDE.scale;
    const w = Math.round(W * S), h = Math.round(H * S);
    const defs = [...USED]
      .map((c) => `<marker id="mk-${id}-${c}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill="${col(c)}"/></marker>`)
      .join('');
    const el = `<svg aria-label="${esc(claim)}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="position:absolute; left:${SLIDE.left}px; top:${SLIDE.top}px; width:${w}px; height:${h}px"><defs>${defs}</defs><g transform="scale(${S})">${inner}</g></svg>`;
    return el + TEXTS.map(slideParagraph).join('');
  }
  const defs = [...USED]
    .map((c) => `<marker id="mk-${id}-${c}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill="${col(c)}"/></marker>`)
    .join('');
  const bg = MODE === 'page' ? '' : `<rect width="${W}" height="${H}" fill="${col('surface')}"/>`;
  const xmlns = MODE === 'page' ? '' : ' xmlns="http://www.w3.org/2000/svg"';
  return `<svg${xmlns} viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(claim)}" font-family="${SANS}"><defs>${defs}</defs>${bg}${inner}</svg>`;
}

module.exports = { LIGHT, DARK, SANS, MONO, setMode, setSlide, col, txt, box, arrow, line, rect, svg, est, WARN, esc };
