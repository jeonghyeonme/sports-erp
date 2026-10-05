// 산출물 Word 문서 공통 서식 — 기업분석·제안서와 아키텍처 설계서가 같은 모양을 쓰게 한다.
// 본문 문자열의 **굵게** 표기만 해석한다(그 밖의 마크업은 쓰지 않는다).
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, ImageRun, PageBreak, TableOfContents, Header, Footer, PageNumber, LevelFormat,
} = require('docx');

const FONT = '맑은 고딕';
const NAVY = '1E3A5F', SOFT = '4B5563', LINE = 'CBD0CD', NAVY_SOFT = 'E7ECF1', AMBER_SOFT = 'FBEEDD', AMBER = '9A5A0C';
const PAGE_W = 11906, MARGIN = 1134, CONTENT_W = PAGE_W - MARGIN * 2; // A4, 여백 2cm
const FIGS = path.join(__dirname, 'figs');

function runs(text, base = {}) {
  return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) =>
    t.startsWith('**') ? new TextRun({ ...base, text: t.slice(2, -2), bold: true }) : new TextRun({ ...base, text: t }));
}
const p = (text, opt = {}) => new Paragraph({ children: runs(text, opt.run), spacing: { after: 120, line: 300 }, ...opt.para });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const bullets = (items, level = 0) => items.map((t) => new Paragraph({ numbering: { reference: 'bullets', level }, children: runs(t), spacing: { after: 60, line: 290 } }));
const numbered = (items, ref = 'nums') => items.map((t) => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60, line: 290 } }));
const quote = (t) => new Paragraph({
  children: runs(t, { color: SOFT, italics: true }), spacing: { before: 60, after: 160, line: 290 },
  indent: { left: 360 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: NAVY, space: 8 } },
});
// 강조 상자(한 칸 표) — 결론·주의
function callout(title, lines, kind = 'navy') {
  const fill = kind === 'amber' ? AMBER_SOFT : NAVY_SOFT;
  const edge = kind === 'amber' ? AMBER : NAVY;
  const children = [new Paragraph({ children: [new TextRun({ text: title, bold: true, color: edge })], spacing: { after: 80 } }),
    ...lines.map((l) => new Paragraph({ children: runs(l), spacing: { after: 60, line: 290 } }))];
  const b = { style: BorderStyle.SINGLE, size: 4, color: fill };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill },
      margins: { top: 140, bottom: 140, left: 200, right: 200 },
      borders: { top: b, bottom: b, right: b, left: { style: BorderStyle.SINGLE, size: 24, color: edge } }, children,
    })] })],
  });
}
const gap = () => new Paragraph({ children: [], spacing: { after: 80 } });

// 표 — widths는 비율(합 아무거나), DXA로 환산
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cols = widths.map((w) => Math.floor((w / total) * CONTENT_W));
  cols[cols.length - 1] += CONTENT_W - cols.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (t, i, head) => new TableCell({
    width: { size: cols[i], type: WidthType.DXA }, borders,
    shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: NAVY } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(t).split('\n').map((line) => new Paragraph({ children: runs(line, head ? { bold: true, color: 'FFFFFF', size: 18 } : { size: 18 }), spacing: { after: 0, line: 260 } })),
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: cols,
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))],
  });
}

// 그림 — figs/<name>.png, 너비는 본문 폭 비율
function figure(name, caption, ratio = 0.9) {
  const file = path.join(FIGS, name + '.png');
  const buf = fs.readFileSync(file);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const width = Math.round((CONTENT_W / 1440) * 96 * ratio);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: 'png', data: buf, transformation: { width, height: Math.round((width * h) / w) },
        altText: { title: caption, description: caption, name } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: caption, size: 18, color: SOFT })] }),
  ];
}

function cover(title, subtitle, info) {
  return [
    new Paragraph({ children: [], spacing: { before: 2400 } }),
    new Paragraph({ children: [new TextRun({ text: '스포이즘 ERP', size: 28, color: NAVY, bold: true })], spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: title, size: 56, bold: true })], spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: subtitle, size: 26, color: SOFT })], spacing: { after: 1200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 12 } } }),
    table(['항목', '내용'], info, [1, 4]),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ children: [new TextRun({ text: '목차', size: 32, bold: true, color: NAVY })], spacing: { after: 200 } }),
    new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-2' }),
    new Paragraph({ children: [new TextRun({ text: '※ 목차가 비어 보이면 Word에서 목차를 클릭하고 [필드 업데이트]를 누르세요.', size: 16, color: SOFT })] }),
  ];
}

function build(file, docTitle, children) {
  const doc = new Document({
    title: docTitle, creator: '스포이즘 ERP 프로젝트', features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: 20 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 34, bold: true, font: FONT, color: NAVY }, paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: FONT, color: '14191C' }, paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: FONT, color: NAVY }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
      ],
    },
    numbering: { config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 800, hanging: 260 } } } }] },
      { reference: 'nums', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 300 } } } }] },
      { reference: 'nums2', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 300 } } } }] },
      { reference: 'nums3', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 300 } } } }] },
    ] },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `스포이즘 ERP · ${docTitle}`, size: 16, color: SOFT })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 16, color: SOFT })] })] }) },
      children,
    }],
  });
  return Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(file, buf); console.log('작성:', file); });
}

module.exports = { p, h1, h2, h3, bullets, numbered, quote, callout, table, figure, cover, build, gap };
