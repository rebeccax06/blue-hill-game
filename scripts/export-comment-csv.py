"""Export the game's current comment classifications and topic-to-character links."""
import csv
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
index = json.loads((root / 'public/comment-index.json').read_text())
path = root / 'outputs/reddit-comment-classification.csv'
fields = ['comment_id', 'source_file', 'source_sheet', 'source_row', 'original_id',
          'thread', 'author', 'date', 'reply_to_original_id', 'source_note', 'comment',
          'assigned_topics', 'related_game_characters', 'character_topic_matches',
          'classification_method', 'manual_review_status', 'reviewed_topics',
          'review_notes', 'game_use']
with path.open('w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    for c in index['comments']:
        matches = {person: [t for t in topics if t in c['topics']]
                   for person, topics in index['peopleTopics'].items()}
        matches = {person: topics for person, topics in matches.items() if topics}
        writer.writerow(dict(zip(fields, [
            c['id'], index['source'], 'First worksheet (comments)', c['row'],
            c['sourceId'], c['thread'], c['author'], c['date'], c['replyTo'],
            c['note'], c['text'], '; '.join(c['topics']), '; '.join(matches),
            '; '.join(f'{person}: {", ".join(topics)}' for person, topics in matches.items()),
            'Automated keyword matching against topic rules derived from workbook codebook',
            'Not manually reviewed', '', '',
            'Indexed for game retrieval. Dialogue selects up to 4 comments using character-topic overlap and question keywords; inclusion in a particular generated answer is not logged.'
        ])))
with path.open(encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))
assert len(rows) == len(index['comments']) == 232
assert all(row['comment'] == c['text'] and row['assigned_topics'] == '; '.join(c['topics'])
           for row, c in zip(rows, index['comments']))
print(f'Exported and verified {len(rows)} comment rows: {path}')
