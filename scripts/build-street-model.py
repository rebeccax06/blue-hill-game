"""Trace source-color boundaries for the first 3D prototype (project slide 12).
All coordinates remain in original drawing pixels. Heights are display assumptions.
Requires NumPy, SciPy and Pillow; rerun after build-plan-assets.py.
"""
from pathlib import Path
import json
import numpy as np
from scipy import ndimage
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/explorer'
section=json.loads((OUT/'sections.json').read_text())['sections'][11]

def simplify(points,tolerance=1.5):
 if len(points)<3:return points
 a=np.array(points[0]);b=np.array(points[-1]);v=b-a
 distances=np.linalg.norm(np.array(points)-a,axis=1) if not np.dot(v,v) else np.abs(v[0]*(np.array(points)[:,1]-a[1])-v[1]*(np.array(points)[:,0]-a[0]))/np.linalg.norm(v)
 index=int(np.argmax(distances))
 if distances[index]<=tolerance:return [points[0],points[-1]]
 return simplify(points[:index+1],tolerance)[:-1]+simplify(points[index:],tolerance)

def outlines(mask):
 # Extract pixel-edge loops, then simplify within 1.5 source pixels.
 edges={}
 ys,xs=np.where(mask)
 for y,x in zip(ys.tolist(),xs.tolist()):
  for missing,a,b in [(y==0 or not mask[y-1,x],(x,y),(x+1,y)),(x==mask.shape[1]-1 or not mask[y,x+1],(x+1,y),(x+1,y+1)),(y==mask.shape[0]-1 or not mask[y+1,x],(x+1,y+1),(x,y+1)),(x==0 or not mask[y,x-1],(x,y+1),(x,y))]:
   if missing:edges.setdefault(a,[]).append(b)
 loops=[]
 while edges:
  start=next(iter(edges));point=start;loop=[start]
  while point in edges:
   nxt=edges[point].pop()
   if not edges[point]:del edges[point]
   point=nxt;loop.append(point)
   if point==start:break
  if point!=start or len(loop)<8:continue
  # Split the closed ring at its farthest point before RDP simplification.
  farthest=max(range(len(loop)-1),key=lambda i:(loop[i][0]-start[0])**2+(loop[i][1]-start[1])**2)
  ring=simplify(loop[:farthest+1])[:-1]+simplify(loop[farthest:])[:-1]
  area=sum(ring[i][0]*ring[(i+1)%len(ring)][1]-ring[(i+1)%len(ring)][0]*ring[i][1] for i in range(len(ring)))/2
  if area>45:loops.append([list(p) for p in ring])
 return loops

features=[]
for layer in section['plan']['layers']:
 image=Image.open(ROOT/'public'/layer['image'].lstrip('/')).convert('RGBA')
 mask=np.array(image)[:,:,3]>0
 # Exclude same-colored aerial-photo artifacts outside the annotated street band.
 row=np.arange(mask.shape[0])[:,None]
 mask &= (row>=(180 if layer['id']=='green' else 220)) & (row<=440)
 mask=ndimage.binary_closing(mask,iterations=1)
 mask=ndimage.binary_fill_holes(mask)
 labels,count=ndimage.label(mask)
 sizes=np.bincount(labels.ravel());mask=np.isin(labels,np.where(sizes>=55)[0]);mask[labels==0]=False
 rings=outlines(mask)
 features.append({'id':layer['id'],'label':layer['label'],'color':layer['color'],'polygons':rings})
 print(layer['id'],len(rings),'polygons')
model={
 'section':12,'sourcePage':12,'sourceImage':section['plan']['original'],
 'coordinateSystem':'Original embedded drawing pixels; x right, y down',
 'width':section['plan']['width'],'height':section['plan']['height'],
 'provenance':'Colored boundaries traced from the source drawing, simplified within 1.5 image pixels. Context footprints manually interpreted from the same image. Heights are illustrative, not surveyed.',
 'features':features,
 'road':[[0,263],[247,264],[370,257],[399,244],[925,237],[985,227],[1078,231],[1078,382],[990,382],[930,398],[600,412],[540,402],[264,419],[240,434],[0,422]],
 'sidewalks':[
 [[0,245],[370,244],[399,226],[408,236],[390,251],[1078,226],[1078,247],[390,271],[250,277],[0,281]],
 [[0,409],[241,405],[265,390],[536,384],[540,366],[572,365],[575,385],[930,369],[955,362],[1078,351],[1078,385],[955,391],[600,413],[263,422],[240,439],[0,438]],
 ],
 'carriageway':[[274,358],[510,351],[530,360],[517,379],[311,386],[278,379]],
 'buildings':[
 {'name':'Happy Supermarket','footprint':[[276,420],[573,409],[577,475],[478,478],[476,529],[426,549],[376,515],[300,528]],'height':8},
 {'name':'Context building','footprint':[[717,125],[815,46],[851,111],[852,226],[788,234]],'height':9},
 {'name':'Context building','footprint':[[370,77],[434,20],[495,83],[438,140]],'height':7},
 ],
 'trees':[[79,265],[162,261],[312,402],[393,396],[470,391],[536,249],[616,246],[712,243],[787,239],[856,235],[926,232],[993,218],[1020,214],[899,393],[646,386]],
 'buses':[[480,317],[800,332]],
 'cars':[[350,394],[430,391],[783,269],[844,266],[500,295],[805,354]],
}
(OUT/'street-12.json').write_text(json.dumps(model,separators=(',',':'))+'\n')
