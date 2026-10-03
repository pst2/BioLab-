import sqlite3

for db_path in ['bio_backend.db', 'backend_scaffold/bio_backend.db']:
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        print(f"=== DB: {db_path} ===")
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [r[0] for r in cur.fetchall()]
        for t in tables:
            if t == 'alembic_version': continue
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            cnt = cur.fetchone()[0]
            print(f"  {t}: {cnt}")
        
        # Check HTTP status codes in request_metrics if table exists
        if 'request_metrics' in tables:
            cur.execute("SELECT status_code, COUNT(*) FROM request_metrics GROUP BY status_code ORDER BY COUNT(*) DESC")
            rows = cur.fetchall()
            print("  request_metrics status distribution:")
            for sc, count in rows:
                print(f"    {sc}: {count}")
        conn.close()
    except Exception as e:
        print(f"Error reading {db_path}: {e}")
