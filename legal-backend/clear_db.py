import os
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, _, v = line.partition('=')
    os.environ.setdefault(k.strip(), v.strip())

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse

db_url = os.environ['DATABASE_URL']
parsed = urlparse(db_url)
conn = psycopg2.connect(host=parsed.hostname, port=parsed.port or 5432,
                        user=parsed.username, password=parsed.password,
                        dbname=parsed.path.lstrip('/'))
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()

cur.execute('TRUNCATE TABLE extracted_fields CASCADE')
cur.execute('TRUNCATE TABLE cases CASCADE')
cur.execute('TRUNCATE TABLE audit_log CASCADE')

cur.close()
conn.close()
print('Database cleared - all cases deleted')
