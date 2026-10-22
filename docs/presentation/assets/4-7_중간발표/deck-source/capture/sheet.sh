#!/usr/bin/env bash
# 부록 X1 — 요구사항정의서.xlsx의 "RFP 충족 판정" 시트를 이미지로(LibreOffice 인쇄 렌더, 엑셀 화면 아님).
# 사용: bash capture.sh 의 출력 폴더와 같은 곳에 appx-sheet.png를 만든다.  bash sheet.sh <출력 폴더>
set -euo pipefail
OUT="${1:-screenshots}"; TMP="$(mktemp -d)"
python3 - "$TMP" <<'PY'
import sys
from openpyxl import load_workbook
wb = load_workbook('docs/deliverables/요구사항정의서.xlsx')
for n in wb.sheetnames:
    if n != 'RFP 충족 판정':
        del wb[n]
sh = wb['RFP 충족 판정']
sh.page_setup.orientation = 'landscape'
sh.sheet_properties.pageSetUpPr.fitToPage = True
sh.page_setup.fitToWidth, sh.page_setup.fitToHeight = 1, 0
wb.save(f'{sys.argv[1]}/sheet.xlsx')
PY
(cd "$TMP" && soffice --headless --convert-to pdf sheet.xlsx >/dev/null)
pdftoppm -r 220 -f 1 -l 1 -png "$TMP/sheet.pdf" "$TMP/p"
# 집계·판정 기준·F1~F4가 보이는 범위만 자른다(F5-1 행 앞).
python3 -c "from PIL import Image; Image.open('$TMP/p-1.png').crop((150,200,2250,1535)).save('$OUT/appx-sheet.png')"
