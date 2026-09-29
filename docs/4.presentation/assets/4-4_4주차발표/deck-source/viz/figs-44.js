// 4주차 발표 도식 2개 — 캔버스 1000×700, 1:1(scale 1)로 배치되므로 글자는 처음부터 24px 이상.
const { txt, box, arrow, svg } = require('./lib');

// ── 1 architecture-driver 방법론 (6단계 순환) ────────────────────────────────
function methodCycle() {
  return svg('m1', 1000, 700, 'Driver에서 대안·결정·구현·검증·기록까지 여섯 단계를 돌고, 기록이 다음 Driver로 다시 이어진다', () => {
    let s = txt(20, 44, '여섯 단계를 돌며 근거를 남긴다', { size: 28, w: 700 });
    const top = [
      { x: 20, t: 'Driver', d: '왜 바꾸나', k: 'blue' },
      { x: 340, t: '대안 비교', d: '장단점을 비교한다', k: 'plain' },
      { x: 660, t: '결정(ADR)', d: '근거를 문서로 남긴다', k: 'blue' },
    ];
    const bot = [
      { x: 20, t: '기록', d: '왜 맞았는지 남긴다', k: 'green' },
      { x: 340, t: '검증', d: '실제로 확인한다', k: 'plain' },
      { x: 660, t: '구현', d: '코드로 반영한다', k: 'green' },
    ];
    top.forEach((b) => { s += box(b.x, 90, 300, 140, [{ t: b.t, s: 28, w: 700 }, { t: b.d, s: 24, w: 400, c: 'ink' }], { kind: b.k, sw: 2 }); });
    bot.forEach((b) => { s += box(b.x, 470, 300, 140, [{ t: b.t, s: 28, w: 700 }, { t: b.d, s: 24, w: 400, c: 'ink' }], { kind: b.k, sw: 2 }); });
    s += arrow([[320, 160], [340, 160]], { color: 'ink', sw: 2.5 });
    s += arrow([[640, 160], [660, 160]], { color: 'ink', sw: 2.5 });
    s += arrow([[810, 230], [810, 470]], { color: 'ink', sw: 2.5, label: { x: 826, y: 350, t: '구현으로', s: 24, a: 'start' } });
    s += arrow([[660, 540], [640, 540]], { color: 'ink', sw: 2.5 });
    s += arrow([[340, 540], [320, 540]], { color: 'ink', sw: 2.5 });
    s += arrow([[170, 470], [170, 230]], { color: 'amber', sw: 2.5, dash: true, label: { x: 186, y: 350, t: '다음 사이클로', s: 24, a: 'start', c: 'amber' } });
    s += txt(970, 672, '이 프로젝트에서 확립돼 범용 스킬로 역이식됨', { size: 24, w: 500, fill: 'muted', anchor: 'end' });
    return s;
  });
}

// ── 2 자기강화형 지연 폭증 루프 ───────────────────────────────────────────────
function bottleneckLoop() {
  return svg('m2', 1000, 700, '지연이 동시 요청을 쌓고, 쌓인 요청이 CPU 경합을 키우고, 경합이 다시 지연을 키우는 자기강화 루프다', () => {
    let s = box(20, 90, 440, 150, [{ t: '① 지연 발생', s: 30, w: 700 }, { t: 'Render 무료 CPU 스로틀링', s: 24, w: 400, c: 'ink' }], { kind: 'amber', sw: 2 });
    s += box(540, 90, 440, 150, [{ t: '② 동시 요청 누적', s: 30, w: 700 }, { t: "Little's Law: L=λW", s: 24, w: 400, c: 'ink' }], { kind: 'amber', sw: 2 });
    s += box(540, 460, 440, 150, [{ t: '③ CPU 경합 심화', s: 30, w: 700 }, { t: '공유 CPU를 서로 기다린다', s: 24, w: 400, c: 'ink' }], { kind: 'red', sw: 2 });
    s += box(20, 460, 440, 150, [{ t: '④ 처리시간이 더 늘어남', s: 30, w: 700 }, { t: '한 건 처리가 더 오래 걸린다', s: 24, w: 400, c: 'ink' }], { kind: 'red', sw: 2 });
    s += arrow([[460, 165], [540, 165]], { color: 'amber', sw: 2.5, label: { x: 500, y: 145, t: '요청이 쌓인다', s: 24 } });
    s += arrow([[760, 240], [760, 460]], { color: 'red', sw: 2.5 });
    s += arrow([[540, 535], [460, 535]], { color: 'red', sw: 2.5, label: { x: 500, y: 515, t: '서로 기다린다', s: 24 } });
    s += arrow([[240, 460], [240, 240]], { color: 'red', sw: 2.5, dash: true, label: { x: 260, y: 350, t: '자기강화', s: 26, w: 700, a: 'start' } });
    s += txt(500, 300, '자기강화 루프', { size: 34, w: 800, fill: 'amber', anchor: 'middle' });
    s += txt(500, 340, '평소엔 초당 2명 미만 — 전혀 문제없다', { size: 24, w: 400, fill: 'muted', anchor: 'middle' });
    return s;
  });
}

module.exports = { methodCycle, bottleneckLoop };
