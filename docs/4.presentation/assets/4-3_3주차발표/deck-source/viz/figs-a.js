// 1부·2부 도식(간추림): 슬라이드 4, 5, 7 — 개발 지식이 있는 청중 대상, 동작하는 것만
const { txt, box, arrow, line, rect, svg, col } = require('./lib');

// ── 슬라이드 4: 분석서는 영역마다 3단으로 완결된다 ────────────────────────────
function f04() {
  return svg('f04', 1200, 560, '기업 분석 자료는 6개 영역으로 이루어지고, 영역 하나는 실무 상세, 분석 결과, 결론의 3단으로 완결된다', () => {
    const doms = ['사업 구조', '위탁계약', '인력 운용', '예약·결제·정산', '물적자원', '문서관리'];
    let s = txt(22, 28, '기업 분석 자료 — 6개 영역', { size: 20, w: 700 });
    doms.forEach((d, i) => {
      s += box(22 + i * 196, 46, 176, 62, [{ t: d, s: 19, w: i === 1 ? 700 : 500 }], { kind: i === 1 ? 'green' : 'plain' });
    });
    s += arrow([[306, 108], [306, 172]], { color: 'green', sw: 2.5, label: { x: 322, y: 146, t: '한 영역을 열어 보면', a: 'start', s: 16 } });
    s += `<rect x="22" y="172" width="1156" height="360" rx="16" fill="${col('greenBg')}" opacity="0.35"/>`;
    s += `<rect x="22" y="172" width="1156" height="360" rx="16" fill="none" stroke="${col('green')}" stroke-width="2" stroke-dasharray="8 6"/>`;
    s += txt(46, 210, '예: 위탁계약', { size: 20, w: 700, fill: 'green' });
    const cols = [
      { h: '실무 상세', b: '위탁계약이 끝나면\n현장에서는 무슨 일이 생기는가' },
      { h: '분석 결과', b: '종료된 지점에 새 회원·예약이\n들어오면 안 된다' },
      { h: '결론', b: '지점에 계약 상태를 두고\n종료되면 신규 활동을 막는다' },
    ];
    cols.forEach((c, i) => {
      const x = 46 + i * 380;
      s += box(x, 240, 340, 230, [
        { t: c.h, s: 28, w: 700, c: 'ink' },
        { t: ' ', s: 10 },
        { t: c.b, s: 19, w: 400, c: 'ink' },
      ], { kind: 'plain', sw: 2 });
      if (i < 2) s += arrow([[x + 340, 355], [x + 380, 355]], { color: 'green', sw: 3 });
    });
    s += txt(600, 508, '영역 하나만 읽어도 이해되도록 구성했다', { size: 17, anchor: 'middle', fill: 'muted', w: 500 });
    return s;
  });
}

// ── 슬라이드 5: 실무 지도 — 두 개의 관계 + 계약 종료 시 동작 ─────────────────
function f05() {
  return svg('f05', 1200, 560, '본사와 위탁센터는 계약 관계, 위탁센터와 직원·이용자는 운영 관계이며, 계약이 종료된 지점은 신규 회원·예약·게시글이 막힌다', () => {
    let s = '';
    s += txt(20, 28, '사업 구조 — 두 개의 관계', { size: 20, w: 700 });
    s += box(290, 48, 190, 68, [{ t: '본사', s: 24, w: 700 }], { kind: 'blue' });
    s += box(290, 206, 190, 68, [{ t: '위탁센터 (지점)', s: 21, w: 700 }], { kind: 'blue' });
    s += box(290, 396, 190, 68, [{ t: '이용자', s: 24, w: 700 }], { kind: 'green' });
    s += box(20, 206, 170, 68, [{ t: '직원', s: 24, w: 700 }], { kind: 'green' });
    s += arrow([[350, 116], [350, 206]], { color: 'blue', sw: 2.5, label: { x: 338, y: 166, t: '위탁운영 계약', a: 'end', s: 16 } });
    s += arrow([[430, 206], [430, 116]], { color: 'gray', dash: true, label: { x: 442, y: 166, t: '운영 데이터', a: 'start', s: 16, c: 'muted' } });
    s += arrow([[290, 82], [105, 82], [105, 206]], { color: 'green', sw: 2.5, label: { x: 116, y: 156, t: '채용', a: 'start', s: 16 } });
    s += arrow([[190, 240], [290, 240]], { color: 'green', sw: 2.5, label: { x: 240, y: 228, t: '파견', s: 16 } });
    s += arrow([[385, 274], [385, 396]], { color: 'green', sw: 2.5, label: { x: 397, y: 340, t: '서비스 제공', a: 'start', s: 16 } });
    s += txt(20, 506, '계약 관계', { size: 15, fill: 'blue', w: 700 }) + line(100, 500, 134, 500, { c: 'blue', sw: 3 });
    s += txt(156, 506, '운영 관계', { size: 15, fill: 'green', w: 700 }) + line(236, 500, 270, 500, { c: 'green', sw: 3 });
    s += txt(292, 506, '피드백', { size: 15, fill: 'muted', w: 500 }) + line(356, 500, 390, 500, { c: 'gray', dash: true, sw: 2 });

    s += txt(620, 28, '위탁계약 상태', { size: 20, w: 700 });
    s += box(620, 56, 120, 62, [{ t: '정상', s: 20, w: 700 }], { kind: 'green' });
    s += box(790, 56, 140, 62, [{ t: '갱신임박', s: 20, w: 700 }], { kind: 'amber' });
    s += box(1010, 24, 130, 54, [{ t: '만료', s: 20, w: 700 }], { kind: 'gray' });
    s += box(1010, 98, 130, 54, [{ t: '종료', s: 20, w: 700 }], { kind: 'red' });
    s += arrow([[740, 87], [790, 87]], { color: 'green', sw: 2.5 });
    s += arrow([[930, 78], [1010, 52]], { color: 'gray', sw: 2 });
    s += arrow([[930, 96], [1010, 124]], { color: 'red', sw: 2 });

    s += rect(620, 232, 560, 268, { fill: 'redBg', stroke: 'red', r: 14, sw: 1.8 });
    s += txt(648, 274, '계약이 종료된 지점에서는', { size: 21, w: 700, fill: 'red' });
    ['신규 회원 등록', '신규 예약', '게시글 신규 작성'].forEach((t, i) => {
      s += box(648, 296 + i * 62, 504, 50, [{ t: t + ' 차단', s: 20, w: 600 }], { kind: 'plain', sw: 1.6 });
    });
    s += txt(648, 490, '과거 데이터의 조회는 그대로 유지된다', { size: 16, fill: 'muted', w: 500 });
    return s;
  });
}

// ── 슬라이드 7: 확장 지도 + 판단 프레임 ───────────────────────────────────────
function f07() {
  return svg('f07', 1200, 560, 'RFP 원본 8개 도메인에 자원문서관리를 신설했고, 넣고 뺄지는 네 가지 질문으로 가렸다', () => {
    let s = '';
    const cx = 330, cy = 272, rx = 232, ry = 190;
    const nodes = [
      ['권한관리', 'green'], ['인사정보관리', 'green'], ['근태관리', 'green'], ['게시판·공지', 'green'],
      ['혼잡도관리', 'green'], ['예약·결제', 'green'], ['강사·프로그램', 'green'], ['회원관리', 'green'], ['자원문서관리', 'blue'],
    ];
    const pos = nodes.map((n, i) => {
      const a = ((-90 + i * 40) * Math.PI) / 180;
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    });
    pos.forEach(([x, y]) => { s += line(cx, cy, x, y, { c: 'line', sw: 1.5 }); });
    s += `<circle cx="${cx}" cy="${cy}" r="60" fill="${col('surface')}" stroke="${col('ink')}" stroke-width="2"/>`;
    s += txt(cx, cy - 4, '스포이즘', { size: 20, w: 700, anchor: 'middle' }) + txt(cx, cy + 27, 'ERP', { size: 20, w: 700, anchor: 'middle' });
    nodes.forEach(([name, kind], i) => {
      const [x, y] = pos[i];
      s += box(x - 78, y - 24, 156, 48, [{ t: name, s: 18, w: 700 }], { kind });
    });
    s += txt(cx, cy + 92, '그 밖에 강사·회차·계약 관리를\n각 도메인 안에서 확장', { size: 15, fill: 'blue', anchor: 'middle', w: 600 });
    s += `<rect x="20" y="524" width="16" height="16" rx="3" fill="${col('greenBg')}" stroke="${col('green')}" stroke-width="1.5"/>`;
    s += txt(46, 538, 'RFP 원본 8개 도메인', { size: 15, fill: 'muted' });
    s += `<rect x="230" y="524" width="16" height="16" rx="3" fill="${col('blueBg')}" stroke="${col('blue')}" stroke-width="1.5"/>`;
    s += txt(256, 538, '이번에 신설', { size: 15, fill: 'muted' });

    s += txt(700, 30, '넣을까 뺄까 — 4가지 질문', { size: 21, w: 700 });
    const qs = [
      ['① RFP가 요구했는가?', '예', '반드시 포함', 'green', '아니오'],
      ['② 별도 시스템(스케줄러·\n알림·파일 저장소)이 필요한가?', '예', '보류', 'gray', '아니오'],
      ['③ 화면에서 눈에 보이는가?', '아니오', '제외 후보', 'gray', '예'],
      ['④ 다른 기능과 겹치는가?', '예', '제외', 'gray', '아니오'],
    ];
    qs.forEach(([q, sideLabel, out, kind, downLabel], i) => {
      const y = 54 + i * 108;
      s += box(700, y, 300, 68, [{ t: q, s: 17, w: 600 }], { kind: 'plain' });
      s += arrow([[1000, y + 34], [1040, y + 34]], { color: kind === 'green' ? 'green' : 'gray', label: { x: 1020, y: y + 22, t: sideLabel, s: 14 } });
      s += box(1040, y + 8, 140, 52, [{ t: out, s: 17, w: 700 }], { kind });
      s += arrow([[850, y + 68], [850, y + 108]], { color: 'ink', label: { x: 860, y: y + 93, t: downLabel, a: 'start', s: 14 } });
    });
    s += box(700, 486, 300, 48, [{ t: '구현 범위에 포함', s: 19, w: 700 }], { kind: 'green' });
    return s;
  });
}

module.exports = { f04, f05, f07 };
