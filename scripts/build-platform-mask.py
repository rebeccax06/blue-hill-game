"""Isolate section 12's visible platform from the shared yellow source mask.
Reviewed against the extracted source drawing: the long central island at
source pixels x=740..913, y=299..318, west of Vesta Road. Other yellow
components are daylighting/curb markings, not this platform.
"""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parent.parent
source = root / 'public/explorer/assets/section-12-layer-yellow.png'
im = Image.open(source).convert('RGBA')
alpha = im.getchannel('A')
isolated = Image.new('L', im.size, 0)
box = (738, 297, 916, 320)
isolated.paste(alpha.crop(box), box[:2])
im.putalpha(isolated)
im.save(root / 'public/explorer/assets/section-12-layer-platforms.png')
print('Isolated reviewed platform:', isolated.getbbox())
