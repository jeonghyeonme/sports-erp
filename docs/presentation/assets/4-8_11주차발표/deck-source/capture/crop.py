# 덱 브라우저 프레임(약 1.9:1)에 맞춰 캡처를 자른다. 사용: python3 capture/crop.py screenshots
import sys
from PIL import Image
d = sys.argv[1] if len(sys.argv) > 1 else 'screenshots'
# (원본, 결과, 왼쪽, 위) — 원본은 1440×900 @2x = 2880×1800, 사이드바(약 460px) 오른쪽만 2420×1270
CROPS = [
    ('ux-quick.png', 'deck-ux-quick.png', 460, 0),
    ('list-assets.png', 'deck-list-assets.png', 460, 0),
    ('doc-box.png', 'deck-doc-box.png', 460, 0),
    ('chart-hq.png', 'deck-chart-hq.png', 460, 200),
]
for src, out, x, y in CROPS:
    im = Image.open(f'{d}/{src}')
    im.crop((x, y, x + 2420, y + 1270)).save(f'{d}/{out}', optimize=True)
    print(out)
