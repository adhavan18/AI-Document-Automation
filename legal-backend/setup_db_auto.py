"""Non-interactive database setup: runs migrations and seeds admin."""
import os, sys, uuid
from pathlib import Path

os.chdir(Path(__file__).parent)

# Load .env
for line in Path(".env").read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    os.environ.setdefault(k.strip(), v.strip())

from urllib.parse import urlparse
db_url = os.environ["DATABASE_URL"]
parsed = urlparse(db_url)

# Step 1: Connect as postgres superuser to ensure uscis has CREATEDB + privileges
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
conn = psycopg2.connect(host=parsed.hostname, port=parsed.port or 5432,
                        user="postgres", password="0406", dbname="postgres")
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()
cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (parsed.path.lstrip("/"),))
if not cur.fetchone():
    cur.execute(f'CREATE DATABASE "{parsed.path.lstrip("/")}"')
    print("Created database.")
else:
    print("Database already exists.")
cur.execute("GRANT ALL PRIVILEGES ON DATABASE legal_processing TO uscis")
cur.close(); conn.close()

# Step 2: Run Alembic migrations
from alembic.config import Config
from alembic import command
cfg = Config("alembic.ini")
cfg.set_main_option("sqlalchemy.url", db_url)
command.upgrade(cfg, "head")
print("Migrations applied.")

# Step 3: Grant schema permissions to uscis
conn2 = psycopg2.connect(host=parsed.hostname, port=parsed.port or 5432,
                         user="postgres", password="0406", dbname="legal_processing")
conn2.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur2 = conn2.cursor()
cur2.execute("GRANT ALL ON SCHEMA public TO uscis")
cur2.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO uscis")
cur2.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO uscis")
cur2.close(); conn2.close()

# Step 4: Seed admin user
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

engine = create_engine(db_url)
Session = sessionmaker(bind=engine)
db = Session()
row = db.execute(text("SELECT id FROM caseworkers WHERE email = :e"),
                 {"e": "admin@uscis.local"}).fetchone()
if row:
    print("Admin already exists.")
else:
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db.execute(text(
        "INSERT INTO caseworkers (id, name, email, hashed_password, role) "
        "VALUES (:id, :name, :email, :pw, :role)"),
        {"id": str(uuid.uuid4()), "name": "Admin",
         "email": "admin@uscis.local",
         "pw": pwd_ctx.hash("Admin1234!"), "role": "admin"})
    db.commit()
    print("Admin seeded: admin@uscis.local / Admin1234!")
db.close()
print("Setup complete.")
