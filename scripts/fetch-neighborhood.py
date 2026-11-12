"""Refresh the public Boston GIS snapshots used by the offline model builder."""
from pathlib import Path
import json, subprocess, urllib.parse
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'data/neighborhood'
SOURCES={
 'streets':'https://gisportal.boston.gov/arcgis/rest/services/Infrastructure/OpenData/MapServer/8',
 'buildings':'https://gis.bostonplans.org/hosting/rest/services/Boston_Buildings/FeatureServer/9',
}

def query(url, params):
 command=['curl','-L','--fail','--retry','2','--max-time','60','-sS',url+'/query?'+urllib.parse.urlencode(params)]
 result=json.loads(subprocess.check_output(command))
 if 'error' in result:raise RuntimeError(result['error'])
 return result

for kind,url in SOURCES.items():
 features=[];offset=0
 while True:
  result=query(url,{'f':'json','where':'1=1','geometry':'-71.110,42.265,-71.075,42.318','geometryType':'esriGeometryEnvelope','inSR':4326,'outSR':26986,'spatialRel':'esriSpatialRelIntersects','outFields':'*','returnGeometry':'true','returnZ':'false','returnM':'false','resultOffset':offset,'resultRecordCount':2000,'orderByFields':'OBJECTID'})
  features+=result['features']
  if not result.get('exceededTransferLimit'):break
  offset+=len(result['features'])
  print(kind,len(features),'downloaded',flush=True)
 (OUT/(kind+'.json')).write_text(json.dumps({'source':url,'downloaded':'2026-11-12','spatialReference':result.get('spatialReference'),'features':features},separators=(',',':'))+'\n')
 print(kind,len(features),'saved',flush=True)

# Keep a compact, offline snapshot of just the avenue context.
import sys
subprocess.run([sys.executable,str(ROOT/"scripts/compact-neighborhood.py")],check=True)
