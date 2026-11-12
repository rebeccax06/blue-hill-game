"""Keep only the avenue's context in the downloaded public GIS snapshots."""
from pathlib import Path
import json
from shapely.geometry import LineString,Polygon,box
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parent.parent
DATA=ROOT/'data/neighborhood'
streets=json.loads((DATA/'streets.json').read_text())
center=unary_union([LineString(path) for f in streets['features'] if f['attributes']['ST_NAME']=='Blue Hill' for path in f['geometry']['paths']]).intersection(box(230000,890700,236000,895750)).buffer(230)
for kind in ['streets','buildings']:
 p=DATA/(kind+'.json');data=json.loads(p.read_text());kept=[]
 keys=['OBJECTID','ST_NAME','ST_TYPE'] if kind=='streets' else ['OBJECTID','PART_USE','BRA_Land_Use','IEL_TYPE','BLDG_HGT_2010','Added']
 for f in data['features']:
  typ='paths' if kind=='streets' else 'rings'
  geom=unary_union([LineString(points) for points in f['geometry'][typ]]) if kind=='streets' else Polygon(f['geometry']['rings'][0])
  if not geom.is_valid:geom=geom.buffer(0)
  if not geom.intersects(center):continue
  kept.append({'attributes':{k:f['attributes'].get(k) for k in keys},'geometry':{typ:[[[round(v,3) for v in point[:2]] for point in points] for points in f['geometry'][typ]]}})
 data['features']=kept;p.write_text(json.dumps(data,separators=(',',':'))+'\n')
 print(kind,len(kept),'features',p.stat().st_size,'bytes')
