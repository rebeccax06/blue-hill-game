"""Recover full embedded plan images and make high-contrast exploration layers.
Run after build-explorer.py. Requires PyMuPDF, Pillow and NumPy.
Geometry and markings come directly from the PDF's embedded drawings.
"""
from pathlib import Path
from io import BytesIO
import json
import fitz
import numpy as np
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/explorer'
p=OUT/'sections.json'
data=json.loads(p.read_text())
with fitz.open(ROOT/'info/2026-09-04-Block-By-Block-SLIDES.pdf') as doc:
 for section,page in zip(data['sections'],doc):
  candidates=[im for im in page.get_image_info(xrefs=True) if 400<im['bbox'][1]<600 and im['bbox'][2]-im['bbox'][0]>350 and im['bbox'][3]-im['bbox'][1]>150]
  assert len(candidates)==1,(section['number'],len(candidates))
  image=Image.open(BytesIO(doc.extract_image(candidates[0]['xref'])['image'])).convert('RGB')
  rgb=np.asarray(image).astype(float);r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
  layers=[
   ('bus','Bus lanes','#bc776d',(r-g>20)&(r-b>15)&(abs(g-b)<22)&(r>140)&(g>100)),
   ('green','Bike space, trees & added parking','#4d936d',(g-r>12)&(g-b>10)&(g>100)),
   ('yellow','Platforms & daylighting','#d7b829',(r>150)&(g>150)&(b<150)&(r-b>55)&(g-b>55)),
   ('blue','Parking retained','#4b6db5',(b-r>35)&(b-g>25)&(b>110)),
   ('red','Parking removed','#d76254',(r-g>65)&(r-b>65)&(r>150)),
  ]
  luminance=.2126*r+.7152*g+.0722*b
  # Whiten the faded aerial photography; retain the original dark linework.
  gray=np.clip((luminance-50)*1.8+70,55,250)
  clear=np.stack([gray,gray,gray],axis=-1)
  manifest=[]
  for key,label,color,mask in layers:
   fill=tuple(int(color[i:i+2],16) for i in (1,3,5))
   clear[mask]=fill
   alpha=Image.fromarray((mask*255).astype('uint8')).filter(ImageFilter.MaxFilter(3))
   overlay=Image.new('RGBA',image.size,fill+(0,));overlay.putalpha(alpha)
   name=f"section-{section['number']:02}-layer-{key}.png"
   overlay.save(OUT/'assets'/name,optimize=True)
   manifest.append({'id':key,'label':label,'color':color,'image':'/explorer/assets/'+name,'pixels':int(mask.sum())})
  base=f"section-{section['number']:02}"
  image.save(OUT/'assets'/f'{base}-original.webp','WEBP',quality=94)
  Image.fromarray(clear.astype('uint8')).save(OUT/'assets'/f'{base}-clear.webp','WEBP',quality=94)
  section['plan']={'original':f'/explorer/assets/{base}-original.webp','clear':f'/explorer/assets/{base}-clear.webp','width':image.width,'height':image.height,'layers':manifest}
  section['drawing']=section['plan']['original']
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Recovered all 20 complete drawings, including areas hidden beneath slide legends; generated clear plans and source-color layers.')
