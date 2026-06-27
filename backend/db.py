import os
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path="../.env")
load_dotenv()

try:
    import psycopg2
    import psycopg2.extras
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False

DATABASE_URL = os.environ.get("DATABASE_URL")
IS_POSTGRES = HAS_POSTGRES and DATABASE_URL and (DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://"))

print(f"WELLNESS DB CONFIG: Using {'PostgreSQL' if IS_POSTGRES else 'SQLite'} database.")

def get_db_connection():
    global IS_POSTGRES
    if IS_POSTGRES:
        try:
            conn_url = DATABASE_URL
            if conn_url.startswith("postgres://"):
                conn_url = conn_url.replace("postgres://", "postgresql://", 1)
            conn = psycopg2.connect(conn_url)
            return conn
        except Exception as e:
            print(f"PostgreSQL connection failed: {e}. Falling back to SQLite.")
            IS_POSTGRES = False
            
    conn = sqlite3.connect("wellness.db")
    conn.row_factory = sqlite3.Row
    return conn

def get_cursor(conn):
    if IS_POSTGRES:
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    return conn.cursor()

def execute_query(cursor, query: str, params=()):
    if IS_POSTGRES:
        query = query.replace("?", "%s")
    cursor.execute(query, params)

def init_db():
    conn = get_db_connection()
    cursor = get_cursor(conn)
    
    if IS_POSTGRES:
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS wellness_logs (
            id SERIAL PRIMARY KEY,
            mood INTEGER NOT NULL,
            sleep_hours REAL NOT NULL,
            stress_level INTEGER NOT NULL,
            notes TEXT NOT NULL,
            insights TEXT,
            created_at TEXT NOT NULL
        )
        ''')
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        ''')
    else:
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS wellness_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mood INTEGER NOT NULL,
            sleep_hours REAL NOT NULL,
            stress_level INTEGER NOT NULL,
            notes TEXT NOT NULL,
            insights TEXT,
            created_at TEXT NOT NULL
        )
        ''')
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        ''')
        
    conn.commit()
    conn.close()

def add_log(mood: int, sleep_hours: float, stress_level: int, notes: str, insights: Optional[str] = None) -> Dict[str, Any]:
    created_at = datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = get_cursor(conn)
    
    execute_query(
        cursor,
        "INSERT INTO wellness_logs (mood, sleep_hours, stress_level, notes, insights, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (mood, sleep_hours, stress_level, notes, insights, created_at)
    )
    
    if IS_POSTGRES:
        cursor.execute("SELECT lastval()")
        log_id = cursor.fetchone()['lastval']
    else:
        log_id = cursor.lastrowid
        
    conn.commit()
    conn.close()
    
    return {
        "id": log_id,
        "mood": mood,
        "sleep_hours": sleep_hours,
        "stress_level": stress_level,
        "notes": notes,
        "insights": insights,
        "created_at": created_at
    }

def get_logs(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = get_cursor(conn)
    
    execute_query(cursor, "SELECT * FROM wellness_logs ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    
    logs = []
    for row in rows:
        logs.append({
            "id": row["id"],
            "mood": row["mood"],
            "sleep_hours": row["sleep_hours"],
            "stress_level": row["stress_level"],
            "notes": row["notes"],
            "insights": row["insights"],
            "created_at": row["created_at"]
        })
        
    conn.close()
    return logs

def delete_log(log_id: int) -> bool:
    conn = get_db_connection()
    cursor = get_cursor(conn)
    
    # Check if exists
    execute_query(cursor, "SELECT 1 FROM wellness_logs WHERE id = ?", (log_id,))
    if not cursor.fetchone():
        conn.close()
        return False
        
    execute_query(cursor, "DELETE FROM wellness_logs WHERE id = ?", (log_id,))
    conn.commit()
    conn.close()
    return True

# Settings Management
def set_setting(key: str, value: str):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    
    if IS_POSTGRES:
        execute_query(
            cursor,
            "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (key, value)
        )
    else:
        execute_query(
            cursor,
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            (key, value)
        )
    conn.commit()
    conn.close()

def get_setting(key: str, default: str = "") -> str:
    conn = get_db_connection()
    cursor = get_cursor(conn)
    execute_query(cursor, "SELECT value FROM app_settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return row["value"]
    return default

# Data Retention Pruning
def prune_logs() -> int:
    retention_days_str = get_setting("data_retention_days", "0")
    try:
        retention_days = int(retention_days_str)
    except ValueError:
        return 0
        
    if retention_days <= 0:
        return 0  # Keep forever
        
    cutoff_date = (datetime.utcnow() - timedelta(days=retention_days)).isoformat()
    
    conn = get_db_connection()
    cursor = get_cursor(conn)
    
    if IS_POSTGRES:
        # Get count
        execute_query(cursor, "SELECT COUNT(*) as count FROM wellness_logs WHERE created_at < ?", (cutoff_date,))
        row = cursor.fetchone()
        count = row["count"] if row else 0
        
        if count > 0:
            execute_query(cursor, "DELETE FROM wellness_logs WHERE created_at < ?", (cutoff_date,))
            conn.commit()
    else:
        execute_query(cursor, "SELECT COUNT(*) as count FROM wellness_logs WHERE created_at < ?", (cutoff_date,))
        row = cursor.fetchone()
        count = row["count"] if row else 0
        
        if count > 0:
            execute_query(cursor, "DELETE FROM wellness_logs WHERE created_at < ?", (cutoff_date,))
            conn.commit()
            
    conn.close()
    return count

def purge_all_logs():
    conn = get_db_connection()
    cursor = get_cursor(conn)
    execute_query(cursor, "DELETE FROM wellness_logs")
    conn.commit()
    conn.close()
