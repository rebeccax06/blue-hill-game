"""Render the supplied project PDFs and extract their section text.
Requires PyMuPDF (fitz). Run: python3 scripts/build-explorer.py
"""
from pathlib import Path
import json
import re
import shutil
import subprocess
import sys
import unicodedata
import fitz

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/explorer'
ASSETS = OUT / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)
BLOCKS = '2026-09-04-Block-By-Block-SLIDES.pdf'
VIEWS = 'Blue-Hill-Ave-Renderings-9_3_26.pdf'

def clean(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', text)).strip()

def render(page, filename, scale=2.5, clip=None):
    # Keep the original labels, annotations, and geometry intact.
    from PIL import Image
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False)
    Image.frombytes('RGB', [pix.width, pix.height], pix.samples).save(ASSETS / filename, 'WEBP', quality=88)
    return '/explorer/assets/' + filename

sections = []
with fitz.open(ROOT / 'info' / BLOCKS) as doc:
    for index, page in enumerate(doc):
        blocks = page.get_text('blocks', sort=True)
        title = next(clean(b[4]) for b in blocks if 85 < b[1] < 125 and ' TO ' in b[4])
        description = clean(' '.join(b[4] for b in blocks if 125 < b[1] < 175))
        notes = [clean(b[4]) for b in blocks if 245 < b[1] < 560 and b[0] > 90]
        assert len(notes) == 6, (index + 1, notes)
        topics = ['Traffic', 'Parking', 'Turns & crossings', 'Walking & biking', 'Bus stops', 'Trees']
        if index == 0:
            topics[3] = 'Walking & crossings'
        number = index + 1
        # The embedded complete drawing is recovered by build-plan-assets.py below.
        drawing = f'/explorer/assets/section-{number:02}-original.webp'
        slide = render(page, f'section-{number:02}-slide.webp')
        sections.append({
            'id': f'section-{number:02}', 'number': number,
            'title': title.title().replace(' To ', ' to '),
            'description': description, 'page': number,
            'drawing': drawing, 'slide': slide,
            'topics': [{'label': label, 'text': text} for label, text in zip(topics, notes)],
            'renderings': [],
        })

# Related views are associated with sections around the named landmark.
view_groups = [
    ('Mattapan Square', [1], [2, 3]),
    ('Morning Star Baptist Church', [5, 6], [4, 5, 6]),
    ('Happy Supermarket', [12], [7, 8]),
    ('Grove Hall', [19, 20], [9, 10]),
]
renderings = []
with fitz.open(ROOT / 'info' / VIEWS) as doc:
    for location, numbers, pages in view_groups:
        for number in pages:
            page = doc[number - 1]
            title = clean(page.get_text('blocks', sort=True)[0][4])
            item = {'id': f'rendering-{number:02}', 'title': title, 'location': location, 'page': number,
                    'condition': 'Existing' if 'existing' in title else 'Proposed Sunday' if 'Sunday' in title else 'Proposed',
                    'image': render(page, f'rendering-{number:02}.webp')}
            renderings.append(item)
            for section in sections:
                if section['number'] in numbers:
                    section['renderings'].append(item['id'])

for name in [BLOCKS, VIEWS]:
    shutil.copyfile(ROOT / 'info' / name, OUT / name)
manifest = {
    'title': 'Blue Hill Avenue, block by block',
    'proposalDate': 'September 2026',
    'sources': {
        'blocks': {'title': 'Blue Hill Ave Block-by-Block', 'date': 'September 4, 2026', 'url': '/explorer/' + BLOCKS},
        'renderings': {'title': 'Investing in Blue Hill Ave — Renderings', 'date': 'September 3, 2026', 'url': '/explorer/' + VIEWS},
    },
    'sections': sections, 'renderings': renderings,
}
(OUT / 'sections.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'Rendered {len(sections)} sections and {len(renderings)} existing/proposed views.')

subprocess.run([sys.executable, str(ROOT / "scripts/build-plan-assets.py")], check=True)
