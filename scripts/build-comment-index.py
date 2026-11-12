"""Rebuild the local discussion index from the supplied workbook (standard library only)."""
import json, re, zipfile, datetime
import xml.etree.ElementTree as E
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(ROOT / 'info/Reddit comments BHA.xlsx') as z:
    strings = [''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns)]
    def rows(sheet):
        out = []
        for row in E.fromstring(z.read(f'xl/worksheets/sheet{sheet}.xml')).findall('.//m:row', ns):
            cells = {}
            for c in row:
                v = c.find('m:v', ns)
                val = v.text if v is not None else ''
                if c.get('t') == 's': val = strings[int(val)]
                cells[re.sub(r'\d', '', c.get('r'))] = val
            out.append((int(row.get('r')), cells))
        return out
    source = rows(1)
    codebook = [{'code': c.get('B'), 'definition': c.get('C')} for _, c in rows(2)[1:] if c.get('B')]
patterns = {
    'Bus': r'\bbus(?:es)?\b|\b28\b|\btransit\b', 'Rail': r'\brail\b|subway|trolley|\btrain',
    'Reliability': r'reliab|late|delay|slow|commut|wait|frequen',
    'Parking': r'park|loading|deliver|curb', 'Traffic': r'traffic|congest|driv|\bcars?\b',
    'Safety': r'safe|crash|cross|speed|pedestrian', 'Bikes': r'bik|cycl',
    'Accessibility': r'disab|wheelchair|elder|senior|accessib',
    'Displacement': r'displac|priced out|push.*out|rent|landlord|gentrif',
    'Affordability': r'afford|rent|housing|landlord', 'Gentrification': r'gentrif|property value',
    'Trust': r'trust|promise|skeptic|mbta|\bcity\b',
    'Engagement': r'meeting|outreach|engag|consult|town hall',
    'Representation': r'represent|survey|majority|minority|community|resident',
    'Equity': r'equit|inequal|underserv|investment', 'Race': r'\bblack\b|racis|racial',
    'Neighborhood identity': r'cultur|longtime|neighborhood|mattapan',
    'Funding': r'fund|budget|money|cost|\$', 'Evidence': r'data|evidence|survey|statistic|ridership',
    'Urgency': r'\bnow\b|urgent|today', 'Delay': r'delay|postpone|wait',
    'Future planning': r'future|decade|long.term', 'Access': r'access|school|jobs?|business',
    'Media framing': r'media|article|headline|coverage',
    'Polarization': r'nimby|idiot|stupid|outsider', 'Responsibility': r'responsib|agency|agencies|state',
}
comments=[]; thread=''
for row,c in source[1:]:
    thread=c.get('A') or thread
    if not c.get('C','').strip(): continue
    text=c['C'].strip(); parent=re.search(r'reply to\s*(?:id\s*)?(\d+)', c.get('F',''), re.I)
    comments.append({'id': f'reddit-{row}', 'sourceId':c.get('B'), 'row':row, 'thread':thread,
        'text':text, 'author':c.get('D',''), 'date':(datetime.date(1899,12,30)+datetime.timedelta(days=float(c['E']))).isoformat() if c.get('E') else None,
        'note':c.get('F',''), 'replyTo':parent.group(1) if parent else None,
        'topics':[tag for tag,pattern in patterns.items() if re.search(pattern,text,re.I)]})
people = {
'Malik':['Bus','Reliability','Access'], 'Simone':['Bus','Reliability','Access','Engagement'], 'Denise':['Parking','Accessibility'], 'Marisol':['Parking','Access','Funding'],
'Angela':['Traffic','Parking','Access'], 'Gloria':['Displacement','Affordability','Gentrification','Neighborhood identity'],
'Raymond':['Trust','Engagement','Responsibility','Evidence'], 'Tiana':['Safety','Bus','Access'],
}
content=json.loads((ROOT/'public/content.json').read_text())
for p in content['people']+content['experts']:
    if p['name'] not in people:
        words=(p['role']+' '+p['guidance']).lower()
        people[p['name']]=[tag for tag,pattern in patterns.items() if re.search(pattern,words,re.I)]
index={'source':'Reddit comments BHA.xlsx','method':'Keyword suggestions using the supplied codebook; topic matches are not verified coding or a representative survey. Characters are fictional and are not Reddit authors.', 'codebook':codebook,'peopleTopics':people,'comments':comments}
(ROOT/'public/comment-index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
print(f'Indexed {len(comments)} comments across {len(set(c["thread"] for c in comments))} threads.')
