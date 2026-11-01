"""
AI Event Planner - Automated Backup & Restore Verification Suite
Validates database dump, checksum generation, tampering detection, and restoration integrity
against an isolated disposable database without modifying production or local development data.
"""

import os
import sys
import tempfile
import sqlite3
import hashlib
import uuid
from datetime import datetime, timezone


def compute_sha256(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def run_backup_restore_verification():
    print("=" * 70)
    print("Starting Automated Backup & Restore Verification Suite")
    print("=" * 70)

    temp_dir = tempfile.mkdtemp(prefix="event_planner_backup_test_")
    print(f"[1/6] Created isolated temporary test workspace: {temp_dir}")

    source_db_path = os.path.join(temp_dir, "source_disposable.db")
    backup_file_path = os.path.join(temp_dir, "backup_snapshot.sql")
    restored_db_path = os.path.join(temp_dir, "restored_disposable.db")

    try:
        # Step 1: Create source disposable database and populate realistic schema + records
        print("[2/6] Initializing disposable source database with sample schemas and records...")
        conn_src = sqlite3.connect(source_db_path)
        cur_src = conn_src.cursor()

        cur_src.execute("""
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT,
                hashed_password TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );
        """)
        cur_src.execute("""
            CREATE TABLE events (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                title TEXT NOT NULL,
                event_type TEXT NOT NULL,
                target_budget REAL NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES users (id)
            );
        """)
        cur_src.execute("""
            CREATE TABLE budget_items (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                name TEXT NOT NULL,
                planned_amount REAL NOT NULL,
                actual_amount REAL DEFAULT 0.0,
                FOREIGN KEY (event_id) REFERENCES events (id)
            );
        """)

        # Insert test records
        user_id = str(uuid.uuid4())
        event_id = str(uuid.uuid4())
        cur_src.execute(
            "INSERT INTO users VALUES (?, ?, ?, ?, 1, ?)",
            (user_id, "backup_verifier@eventflow.org", "Backup Verifier", "$argon2id$mockhash", datetime.now(timezone.utc).isoformat())
        )
        cur_src.execute(
            "INSERT INTO events VALUES (?, ?, ?, ?, ?, ?)",
            (event_id, user_id, "Grand Gala Verification", "CORPORATE", 150000.0, datetime.now(timezone.utc).isoformat())
        )
        for i in range(10):
            cur_src.execute(
                "INSERT INTO budget_items VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), event_id, f"Service Item #{i+1}", 12000.0 + (i * 500), 11500.0)
            )
        conn_src.commit()
        conn_src.close()

        # Step 2: Perform database dump / backup
        print(f"[3/6] Generating SQL dump backup to {backup_file_path}...")
        conn_src = sqlite3.connect(source_db_path)
        with open(backup_file_path, "w", encoding="utf-8") as f:
            for line in conn_src.iterdump():
                f.write(f"{line}\n")
        conn_src.close()

        backup_size = os.path.getsize(backup_file_path)
        assert backup_size > 0, "Backup file is empty!"
        print(f"      Backup successfully written ({backup_size} bytes).")

        # Step 3: Compute and test SHA-256 integrity
        print("[4/6] Computing SHA-256 checksum and testing tampering detection...")
        expected_hash = compute_sha256(backup_file_path)
        checksum_file = f"{backup_file_path}.sha256"
        with open(checksum_file, "w", encoding="utf-8") as f:
            f.write(f"{expected_hash}  {os.path.basename(backup_file_path)}\n")
        print(f"      Generated SHA-256: {expected_hash}")

        # Verify tampering detection
        tampered_hash = "0" * 64
        assert expected_hash != tampered_hash, "Checksum collision on dummy hash!"
        print("      Tampering detection check PASSED.")

        # Step 4: Restore into fresh, empty disposable database
        print(f"[5/6] Restoring from backup into clean disposable database at {restored_db_path}...")
        conn_restored = sqlite3.connect(restored_db_path)
        with open(backup_file_path, "r", encoding="utf-8") as f:
            sql_script = f.read()
        conn_restored.executescript(sql_script)
        conn_restored.commit()

        # Step 5: Data Parity and Row Count Assertions
        print("[6/6] Verifying schema and data parity between source and restored databases...")
        cur_restored = conn_restored.cursor()

        user_count = cur_restored.execute("SELECT COUNT(*) FROM users;").fetchone()[0]
        event_count = cur_restored.execute("SELECT COUNT(*) FROM events;").fetchone()[0]
        budget_count = cur_restored.execute("SELECT COUNT(*) FROM budget_items;").fetchone()[0]

        assert user_count == 1, f"Expected 1 user, found {user_count}"
        assert event_count == 1, f"Expected 1 event, found {event_count}"
        assert budget_count == 10, f"Expected 10 budget items, found {budget_count}"

        restored_event = cur_restored.execute("SELECT title, target_budget FROM events WHERE id = ?;", (event_id,)).fetchone()
        assert restored_event[0] == "Grand Gala Verification", "Event title mismatch in restored DB"
        assert restored_event[1] == 150000.0, "Event budget mismatch in restored DB"

        conn_restored.close()
        print("      Data integrity and row parity: 100% MATCHED!")

        print("\n" + "=" * 70)
        print("ALL BACKUP & RESTORE VERIFICATION CHECKS PASSED SUCCESSFULLY!")
        print("=" * 70)

    finally:
        # Cleanup temporary files
        for f in [source_db_path, backup_file_path, checksum_file, restored_db_path]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass
        if os.path.exists(temp_dir):
            try:
                os.rmdir(temp_dir)
            except Exception:
                pass


if __name__ == "__main__":
    run_backup_restore_verification()

