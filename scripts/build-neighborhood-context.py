"""Align City of Boston GIS context with the source plan pixels.
Requires NumPy, SciPy, Pillow and Shapely. Run after build-street-model.py.
See data/neighborhood/registration.json for reviewed control points.
"""
from pathlib import Path
import json,math,sys
import numpy as np
from PIL import Image,ImageDraw
from shapely.geometry import Polygon,LineString,box,Point
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/explorer'
DATA=ROOT/'data/neighborhood'
streets=json.loads((DATA/'streets.json').read_text())['features']
buildings=json.loads((DATA/'buildings.json').read_text())['features']
registration=json.loads((DATA/'registration.json').read_text())['sections']
blue=[f for f in streets if f['attributes']['ST_NAME']=='Blue Hill']
blue_nodes=np.array([p[:2] for f in blue for path in f['geometry']['paths'] for p in [path[0],path[-1]]])

def intersection(key):
 name,_,part=key.partition(':')
 found=[]
 for f in streets:
  if f['attributes']['ST_NAME']!=name:continue
  for path in f['geometry']['paths']:
   for p in [path[0][:2],path[-1][:2]]:
    if np.min(np.linalg.norm(blue_nodes-p,axis=1))<1 and not any(np.linalg.norm(np.array(p)-q)<1 for q in found):found.append(p)
 if part=='N':found=[p for p in found if p[1]>891500]
 if part=='S':found=[p for p in found if p[1]<(893880 if name=='Harvard' else 891500)]
 if not found:raise ValueError(key)
 return np.mean(found,axis=0)

def parts(geometry):
 if geometry.is_empty:return []
 if geometry.geom_type=='Polygon':return [geometry]
 return [p for g in geometry.geoms for p in parts(g)] if hasattr(geometry,'geoms') else []

def ring(poly):return [[round(x,2),round(y,2)] for x,y in list(poly.exterior.coords)[:-1]]

def polyrings(geom):return [ring(p) for p in parts(geom) if p.area>12]

# Curb lines are manually interpreted in original image pixels. Each sample is
# [x, upper curb y, lower curb y]; the full road shape keeps block-specific bends.
CURBS={
1:[[0,360,480],[300,365,495],[500,375,505],[1000,385,510],[1600,395,530],[1997,400,530]],
2:[[0,330,455],[500,325,455],[950,335,465],[1681,335,470]],
3:[[0,350,480],[600,350,480],[1200,350,480],[1600,335,480],[1907,320,480]],
4:[[0,380,510],[500,390,510],[950,430,555],[1210,420,565],[1550,420,565],[1802,410,565]],
5:[[0,380,500],[500,380,500],[1000,380,500],[1412,375,500]],
6:[[0,325,430],[500,320,430],[1100,310,420],[1573,310,420]],
7:[[0,400,515],[800,400,515],[1635,395,515]],
8:[[0,310,435],[400,310,435],[1228,300,435]],
9:[[0,280,400],[600,280,400],[1000,280,400],[1226,280,400]],
10:[[0,350,480],[300,345,480],[600,340,480],[827,340,480]],
11:[[0,320,445],[600,320,445],[1100,315,445],[1515,300,435]],
12:[[0,280,410],[250,275,410],[400,270,390],[600,270,400],[925,255,385],[1078,250,375]],
13:[[0,280,390],[200,280,380],[500,260,365],[800,250,350],[966,250,350]],
14:[[0,290,410],[350,290,410],[900,285,410],[1435,280,405]],
15:[[0,260,385],[150,260,365],[650,260,365],[948,260,385]],
16:[[0,235,375],[150,235,375],[600,230,360],[900,225,375],[1016,225,370]],
17:[[0,320,440],[230,320,440],[600,310,440],[900,295,410],[1181,255,370]],
18:[[0,290,435],[250,290,390],[500,265,360],[800,255,355],[971,255,355]],
19:[[0,240,380],[250,285,410],[450,330,445],[750,400,520],[1060,450,570]],
20:[[0,270,400],[200,295,410],[450,325,430],[650,350,450],[794,365,465]],
}
LANDMARKS={
1:[['Mattapan station',310,725,'transit'],['Mattapan Square',1150,600,'place'],['Chase',1050,300,'shop']],
2:[['Jubilee Christian Church',1540,660,'civic'],['Domino’s',1120,535,'shop']],
3:[['Tejada’s Family Market',1220,260,'shop']],
4:[['Mattapan Branch Library',365,600,'civic']],
5:[['Blue Mountain Jamaican',450,270,'shop'],['Grove Hall Child Development Center',900,270,'civic']],
6:[['Morning Star Baptist Church',410,220,'civic'],['Greater Zion Church',800,540,'civic']],
7:[['Boston Police · District B-3',300,260,'civic']],
8:[],9:[['Bank of America',930,185,'shop']],
10:[['Sportsmen’s Tennis & Enrichment Center',640,650,'civic']],
11:[['Harambee Park',760,610,'park'],['Harvard Street Neighborhood Health Center',1170,215,'civic']],
12:[['Happy Supermarket',420,470,'shop']],
13:[['Mobil',745,165,'shop']],
14:[['Franklin Park',800,150,'park'],['Unity Park',755,470,'park']],
15:[['Franklin Park',460,150,'park']],16:[['Franklin Park',460,120,'park'],['Harvard Neighborhood Pharmacy',440,435,'shop']],
17:[['Franklin Park',570,170,'park']],18:[],
19:[['Mother Caroline Academy',445,175,'civic'],['Veterans Benefits',740,280,'civic']],
20:[['Grove Hall Mecca',670,505,'shop'],['Blue Hill Halal Market',430,490,'shop']],
}

selected=set(map(int,sys.argv[1:]))
for number,controls in registration.items():
 number=int(number)
 if selected and number not in selected:continue
 model=json.loads((OUT/f'street-{number}.json').read_text())
 width,height=model['width'],model['height']
 cp=np.array([intersection(c[0]) for c in controls]);ip=np.array([c[1:] for c in controls],dtype=float)
 lengths=np.linalg.norm(np.diff(cp,axis=0),axis=1);pixel_lengths=np.linalg.norm(np.diff(ip,axis=0),axis=1)
 meters_per_pixel=float(np.median(lengths/pixel_lengths))

 def transform(points):
  result=[]
  for raw in points:
   p=np.array(raw[:2]);best=None
   for i,(a,b) in enumerate(zip(cp[:-1],cp[1:])):
    direction=b-a;distance=np.linalg.norm(direction);unit=direction/distance
    t=np.dot(p-a,unit)/distance
    score=np.linalg.norm(p-(a+np.clip(t,0,1)*direction))
    if best is None or score<best[0]:best=(score,i,t,unit,distance)
   _,i,t,unit,distance=best
   lateral=np.dot(p-cp[i],np.array([unit[1],-unit[0]]))
   delta=ip[i+1]-ip[i];tangent=delta/np.linalg.norm(delta)
   pixel=ip[i]+t*delta+lateral*(np.linalg.norm(delta)/distance)*np.array([-tangent[1],tangent[0]])
   result.append(pixel.tolist())
  return result

 clip=box(0,0,width,height)
 # GIS side streets, retaining each street's actual angle and bends.
 gis_roads=[];street_labels=[];seen=set()
 for f in streets:
  name=f['attributes']['ST_NAME']
  if name in ['Blue Hill','Blue Hills']:continue
  for path in f['geometry']['paths']:
   # Avoid transforming the entire city: prefilter to the context envelope.
   p=np.array(path)[:,:2]
   if np.min(np.linalg.norm(p[:,None,:]-cp[None,:,:],axis=2))>220:continue
   line=LineString(transform(path))
   if not line.intersects(clip):continue
   road_width=13 if name in ['Morton','Columbia','Seaver','American Legion','River','Talbot','Washington','Warren'] else 7.5
   geom=line.buffer(road_width/meters_per_pixel/2,join_style=2).intersection(clip)
   gis_roads.append(geom)
   cut=line.intersection(clip)
   if not cut.is_empty and name not in seen and cut.length>35:
    # Labels sit near the edge of the model, keeping junctions clear.
    anchor=cut.interpolate(.72,normalized=True) if cut.geom_type=='LineString' else line.interpolate(.72,normalized=True)
    if 0<anchor.x<width and 0<anchor.y<height:
     street_labels.append({'text':name+' '+(f['attributes'].get('ST_TYPE') or ''),'position':[round(anchor.x,2),round(anchor.y,2)]})
     seen.add(name)
 samples=CURBS[number]
 main=Polygon([[x,top] for x,top,bottom in samples]+[[x,bottom] for x,top,bottom in reversed(samples)])
 roads=unary_union([main,*gis_roads]).intersection(clip)
 sidewalks=roads.buffer(2.3/meters_per_pixel,join_style=2).difference(roads).intersection(clip)
 model['road']=ring(main)
 model['roads']=polyrings(roads)
 model['roadShapes']=[{'outer':ring(p),'holes':[[[round(x,2),round(y,2)] for x,y in list(r.coords)[:-1]] for r in p.interiors]} for p in parts(roads) if p.area>12]
 model['sidewalks']=polyrings(sidewalks)
 # A sidewalk boundary can enclose the road: retain holes rather than cap it.
 model['sidewalkShapes']=[{'outer':ring(p),'holes':[[[round(x,2),round(y,2)] for x,y in list(r.coords)[:-1]] for r in p.interiors]} for p in parts(sidewalks) if p.area>12]
 model['buildings']=[]
 used=set()
 for feature in buildings:
  attributes=feature['attributes'];geo=feature['geometry']
  raw=geo['rings'][0]
  center=np.mean(np.array(raw)[:,:2],axis=0)
  if np.min(np.linalg.norm(cp-center,axis=1))>300:continue
  mapped=transform(raw)
  footprint=Polygon(mapped)
  if not footprint.is_valid:footprint=footprint.buffer(0)
  footprint=footprint.intersection(clip)
  for part_index,poly in enumerate(parts(footprint)):
   if poly.area<35 or roads.intersection(poly).area/poly.area>.22:continue
   # Footprints that slightly touch a proposed curb remain actual footprints.
   height_feet=attributes.get('BLDG_HGT_2010')
   measured=height_feet is not None and 5<float(height_feet)<250
   height_meters=float(height_feet)*.3048 if measured else 9.0
   model['buildings'].append({'id':attributes['OBJECTID'],'part':part_index,'name':'','footprint':ring(poly.simplify(.8,preserve_topology=True)),
    'heightMeters':round(height_meters,4),'heightSource':'Boston BLDG_HGT_2010 (feet converted to meters)' if measured else 'Illustrative 9 m fallback; height missing in GIS',
    'height':round(height_meters/meters_per_pixel*130/width,3),'use':attributes.get('BRA_Land_Use') or attributes.get('PART_USE') or 'unknown'})
   used.add(attributes['OBJECTID'])
 model['landmarks']=[]
 for name,px,py,kind in LANDMARKS[number]:
  landmark={'name':name,'position':[px,py],'kind':kind,'source':'Label on supplied project drawing'}
  if kind not in ['park','place'] and model['buildings']:
   candidates=[]
   for building in model['buildings']:
    shape=Polygon(building['footprint']);c=shape.centroid
    if (c.y-ip.mean(axis=0)[1])*(py-ip.mean(axis=0)[1])<0:continue
    candidates.append((shape.distance(Point(px,py)),building))
   if candidates:
    dist,building=min(candidates,key=lambda p:p[0])
    if dist<90:
     building['name']=name;landmark['buildingId']=building['id'];landmark['position']=list(Polygon(building['footprint']).centroid.coords)[0]
  model['landmarks'].append(landmark)
 model['streetLabels']=[label for label in street_labels if any(label['text'].lower().startswith(c[0].split(':')[0].lower()) for c in controls)]
 model['contextTrees']=[]
 if number in [11,14,15,16,17]:
  aerial=np.asarray(Image.open(ROOT/'public'/model['sourceImage'].lstrip('/')).convert('RGB')).astype(float)
  occupied=unary_union([Polygon(b['footprint']) for b in model['buildings']]).buffer(3/meters_per_pixel)
  for py in range(40,height-30,max(20,int(12/meters_per_pixel))):
   for px in range(35,width-30,max(20,int(12/meters_per_pixel))):
    point=Point(px,py)
    if roads.buffer(5/meters_per_pixel).contains(point) or occupied.contains(point):continue
    r,g,b=aerial[py-5:py+5,px-5:px+5].mean(axis=(0,1))
    if g>r*1.025 and g>b*1.025 and g<235:model['contextTrees'].append([px,py])
 # A closer, irregular canopy spacing makes Franklin Park read as woodland.
 # Limit the additional trees to the park side, using aerial vegetation and
 # excluding GIS road/path buffers and building footprints.
 if number in [14,15,16,17]:
  rng=np.random.default_rng(2026+number)
  step=max(14,int(4.5/meters_per_pixel))
  clear_roads=roads.buffer(5/meters_per_pixel)
  for gy in range(15,height-15,step):
   for gx in range(15,width-15,step):
    px=int(gx+rng.uniform(-.22,.22)*step);py=int(gy+rng.uniform(-.22,.22)*step)
    upper=float(np.interp(px,[p[0] for p in samples],[p[1] for p in samples]))
    if py>=upper-5/meters_per_pixel:continue
    point=Point(px,py)
    if clear_roads.contains(point) or occupied.contains(point):continue
    r,g,b=aerial[py-5:py+5,px-5:px+5].mean(axis=(0,1))
    if not (g>r*1.02 and g>b*1.02 and g<235):continue
    if any(math.hypot(px-tx,py-ty)*meters_per_pixel<3.4 for tx,ty in model['contextTrees']):continue
    model['contextTrees'].append([px,py])
 model['metersPerPixel']=round(meters_per_pixel,6)
 model['registration']={'controls':[{'street':c[0],'image':c[1:],'gis':p.tolist()} for c,p in zip(controls,cp)],'method':'Piecewise local similarity at manually identified intersection centers; approximate registration, not engineering survey.'}
 model['contextSource']={'buildings':json.loads((DATA/'buildings.json').read_text())['source'],'streets':json.loads((DATA/'streets.json').read_text())['source'],'heightVintage':2010,'downloaded':'2026-11-12'}
 model['provenance']='Proposal color boundaries retain source-image coordinates. Existing building footprints and available 2010 heights come from City of Boston GIS, approximately registered to the drawing at named intersections. Missing heights use an explicit 9 m assumption. Trees, facades, vehicles and passengers are illustrative.'
 model.pop('sourceSurface',None)
 # Place display vehicles within source color polygons, away from short islands.
 model['buses']=[];model['cars']=[]
 for key,target,min_length in [('bus','buses',90),('blue','cars',30)]:
  feature=next(f for f in model['features'] if f['id']==key)
  for points in feature['polygons']:
   p=Polygon(points)
   if not p.is_valid:p=p.buffer(0)
   if p.is_empty:continue
   minx,miny,maxx,maxy=p.bounds
   if maxx-minx<min_length or maxx-minx<3*(maxy-miny):continue
   for fraction in ([.35,.72] if key=='bus' else [.2,.6]):
    px=minx+(maxx-minx)*fraction
    cut=p.intersection(LineString([[px,miny-1],[px,maxy+1]]))
    if cut.is_empty:continue
    py=cut.centroid.y
    model[target].append([round(px,2),round(py,2)])
 model['buses']=model['buses'][:4];model['cars']=model['cars'][:14]
 model['passengers']=[]
 if number!=12:
  for points in next(f for f in model['features'] if f['id']=='yellow')['polygons']:
   poly=Polygon(points)
   if not poly.is_valid:continue
   minx,miny,maxx,maxy=poly.bounds
   if maxx-minx<80 or maxx-minx<5*(maxy-miny):continue
   for fraction in [.25,.5,.75]:
    px=minx+(maxx-minx)*fraction
    cut=poly.intersection(LineString([[px,miny-1],[px,maxy+1]]))
    if not cut.is_empty:model['passengers'].append([round(px,2),round(cut.centroid.y,2)])
 model['passengers']=model['passengers'][:9]
 (OUT/f'street-{number}.json').write_text(json.dumps(model,separators=(',',':'))+'\n')
 # Overlay for source registration QA: GIS footprints in translucent blue.
 im=Image.open(ROOT/'public'/model['sourceImage'].lstrip('/')).convert('RGBA')
 overlay=Image.new('RGBA',im.size);draw=ImageDraw.Draw(overlay)
 for b in model['buildings']:draw.polygon([tuple(p) for p in b['footprint']],fill=(35,100,175,65),outline=(10,60,150,220))
 for c in controls:draw.ellipse((c[1]-6,c[2]-6,c[1]+6,c[2]+6),fill=(220,40,40,255))
 im=Image.alpha_composite(im,overlay);im.thumbnail((1450,900));im.save(f'/tmp/bha-registration-{number}.png')
 print(number,len(model['buildings']),'buildings',len(model['roads']),'road pieces',round(meters_per_pixel,3),'m/pixel',flush=True)
