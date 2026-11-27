"""
Database Management Module for Smart Flight Booking Assistant
Supports MySQL relational persistence with automatic local SQLite fallback for resilient execution.
Never requires user authentication or logins.
"""

import os
import sqlite3
import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

try:
    import pymysql
    import pymysql.cursors
    HAS_PYMYSQL = True
except ImportError:
    HAS_PYMYSQL = False

# Environment configuration
DB_HOST = os.getenv("MYSQL_HOST", "localhost")
DB_PORT = int(os.getenv("MYSQL_PORT", 3306))
DB_USER = os.getenv("MYSQL_USER", "root")
DB_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
DB_NAME = os.getenv("MYSQL_DATABASE", "flight_booking_assistant")

LOCAL_SQLITE_PATH = Path(__file__).resolve().parent / "local_flight_assistant.db"

class DatabaseManager:
    def __init__(self):
        self.use_mysql = False
        self.mysql_tested = False
        self._init_connection()

    def _init_connection(self):
        """Test MySQL connection or fallback gracefully to SQLite without crashing."""
        if HAS_PYMYSQL and os.getenv("MYSQL_DATABASE"):
            try:
                conn = pymysql.connect(
                    host=DB_HOST,
                    port=DB_PORT,
                    user=DB_USER,
                    password=DB_PASSWORD,
                    database=DB_NAME,
                    cursorclass=pymysql.cursors.DictCursor,
                    connect_timeout=2
                )
                conn.close()
                self.use_mysql = True
                print(f"[*] Successfully connected to MySQL database: {DB_NAME} on {DB_HOST}:{DB_PORT}")
            except Exception as e:
                self.use_mysql = False
                print(f"[!] MySQL connection not active ({e}). Using resilient local database storage.")
        else:
            self.use_mysql = False

        self.ensure_tables()

    def get_connection(self):
        """Retrieve active database connection."""
        if self.use_mysql:
            try:
                return pymysql.connect(
                    host=DB_HOST,
                    port=DB_PORT,
                    user=DB_USER,
                    password=DB_PASSWORD,
                    database=DB_NAME,
                    cursorclass=pymysql.cursors.DictCursor,
                    autocommit=True
                )
            except Exception:
                # On transient connection loss, return sqlite connection
                pass

        # SQLite connection
        conn = sqlite3.connect(LOCAL_SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def ensure_tables(self):
        """Create database tables if they do not exist."""
        conn = self.get_connection()
        cursor = conn.cursor()

        if self.use_mysql:
            # 1. Search Activity Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS search_activity (
                search_id INT AUTO_INCREMENT PRIMARY KEY,
                source_city VARCHAR(50) NOT NULL,
                destination_city VARCHAR(50) NOT NULL,
                days_left INT NOT NULL,
                search_mode VARCHAR(20) NOT NULL,
                combinations_found INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_route (source_city, destination_city),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 2. Prediction History Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS prediction_history (
                prediction_id INT AUTO_INCREMENT PRIMARY KEY,
                search_id INT NULL,
                source_city VARCHAR(50) NOT NULL,
                destination_city VARCHAR(50) NOT NULL,
                days_left INT NOT NULL,
                airline VARCHAR(50) NOT NULL,
                flight_class VARCHAR(20) NOT NULL,
                stops INT NOT NULL,
                departure_time VARCHAR(30) NOT NULL,
                duration DECIMAL(5,2) NOT NULL,
                arrival_time VARCHAR(30) NOT NULL,
                predicted_price DECIMAL(10,2) NOT NULL,
                lower_price DECIMAL(10,2) NOT NULL,
                upper_price DECIMAL(10,2) NOT NULL,
                prediction_mode VARCHAR(20) NOT NULL,
                selected_option VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pred_route (source_city, destination_city),
                INDEX idx_pred_airline (airline),
                INDEX idx_pred_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 3. User Feedback Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_feedback (
                feedback_id INT AUTO_INCREMENT PRIMARY KEY,
                prediction_id INT NULL,
                feedback_rating VARCHAR(20) NOT NULL,
                feedback_comments TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_fb_rating (feedback_rating)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
        else:
            # SQLite Syntax
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS search_activity (
                search_id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_city TEXT NOT NULL,
                destination_city TEXT NOT NULL,
                days_left INTEGER NOT NULL,
                search_mode TEXT NOT NULL,
                combinations_found INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS prediction_history (
                prediction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                search_id INTEGER NULL,
                source_city TEXT NOT NULL,
                destination_city TEXT NOT NULL,
                days_left INTEGER NOT NULL,
                airline TEXT NOT NULL,
                flight_class TEXT NOT NULL,
                stops INTEGER NOT NULL,
                departure_time TEXT NOT NULL,
                duration REAL NOT NULL,
                arrival_time TEXT NOT NULL,
                predicted_price REAL NOT NULL,
                lower_price REAL NOT NULL,
                upper_price REAL NOT NULL,
                prediction_mode TEXT NOT NULL,
                selected_option TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_feedback (
                feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
                prediction_id INTEGER NULL,
                feedback_rating TEXT NOT NULL,
                feedback_comments TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            """)
            conn.commit()

        cursor.close()
        conn.close()

    def record_search(self, source_city: str, destination_city: str, days_left: int, search_mode: str, combinations_found: int = 0) -> int:
        """Insert search activity record."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            if self.use_mysql:
                sql = """
                INSERT INTO search_activity (source_city, destination_city, days_left, search_mode, combinations_found)
                VALUES (%s, %s, %s, %s, %s)
                """
                cursor.execute(sql, (source_city, destination_city, days_left, search_mode, combinations_found))
                search_id = cursor.lastrowid
            else:
                sql = """
                INSERT INTO search_activity (source_city, destination_city, days_left, search_mode, combinations_found)
                VALUES (?, ?, ?, ?, ?)
                """
                cursor.execute(sql, (source_city, destination_city, days_left, search_mode, combinations_found))
                conn.commit()
                search_id = cursor.lastrowid
            cursor.close()
            conn.close()
            return search_id
        except Exception as e:
            print(f"[ERROR] Failed to record search: {e}")
            return 0

    def record_prediction(self, data: Dict[str, Any]) -> int:
        """Insert prediction record."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            params = (
                data.get("search_id"),
                data.get("source_city"),
                data.get("destination_city"),
                data.get("days_left"),
                data.get("airline"),
                data.get("flight_class"),
                data.get("stops"),
                data.get("departure_time"),
                data.get("duration"),
                data.get("arrival_time"),
                data.get("predicted_price"),
                data.get("lower_price"),
                data.get("upper_price"),
                data.get("prediction_mode", "Advanced"),
                data.get("selected_option")
            )
            if self.use_mysql:
                sql = """
                INSERT INTO prediction_history (
                    search_id, source_city, destination_city, days_left, airline,
                    flight_class, stops, departure_time, duration, arrival_time,
                    predicted_price, lower_price, upper_price, prediction_mode, selected_option
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql, params)
                pred_id = cursor.lastrowid
            else:
                sql = """
                INSERT INTO prediction_history (
                    search_id, source_city, destination_city, days_left, airline,
                    flight_class, stops, departure_time, duration, arrival_time,
                    predicted_price, lower_price, upper_price, prediction_mode, selected_option
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                cursor.execute(sql, params)
                conn.commit()
                pred_id = cursor.lastrowid
            cursor.close()
            conn.close()
            return pred_id
        except Exception as e:
            print(f"[ERROR] Failed to record prediction: {e}")
            return 0

    def record_feedback(self, rating: str, comments: Optional[str] = None, prediction_id: Optional[int] = None) -> int:
        """Insert user feedback."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            if self.use_mysql:
                sql = "INSERT INTO user_feedback (prediction_id, feedback_rating, feedback_comments) VALUES (%s, %s, %s)"
                cursor.execute(sql, (prediction_id, rating, comments))
                fb_id = cursor.lastrowid
            else:
                sql = "INSERT INTO user_feedback (prediction_id, feedback_rating, feedback_comments) VALUES (?, ?, ?)"
                cursor.execute(sql, (prediction_id, rating, comments))
                conn.commit()
                fb_id = cursor.lastrowid
            cursor.close()
            conn.close()
            return fb_id
        except Exception as e:
            print(f"[ERROR] Failed to record feedback: {e}")
            return 0

    def get_admin_metrics(self) -> Dict[str, Any]:
        """Aggregate actual database records for administrator dashboard."""
        metrics: Dict[str, Any] = {
            "database_type": "MySQL" if self.use_mysql else "Local Resilient SQLite",
            "total_searches": 0,
            "total_predictions": 0,
            "smart_searches": 0,
            "advanced_searches": 0,
            "top_sources": [],
            "top_destinations": [],
            "popular_routes": [],
            "popular_airlines": [],
            "stops_distribution": {"0": 0, "1": 0, "2": 0},
            "feedback_summary": {"helpful": 0, "unhelpful": 0, "total": 0},
            "recent_activity": []
        }

        try:
            conn = self.get_connection()
            cursor = conn.cursor()

            # Searches count and mode breakdown
            cursor.execute("SELECT COUNT(*) as count FROM search_activity")
            row = cursor.fetchone()
            metrics["total_searches"] = row["count"] if isinstance(row, dict) else row[0]

            cursor.execute("SELECT search_mode, COUNT(*) as count FROM search_activity GROUP BY search_mode")
            for r in cursor.fetchall():
                mode = r["search_mode"] if isinstance(r, dict) else r[0]
                cnt = r["count"] if isinstance(r, dict) else r[1]
                if str(mode).lower() == "smart":
                    metrics["smart_searches"] = cnt
                else:
                    metrics["advanced_searches"] = cnt

            # Predictions count
            cursor.execute("SELECT COUNT(*) as count FROM prediction_history")
            row = cursor.fetchone()
            metrics["total_predictions"] = row["count"] if isinstance(row, dict) else row[0]

            # Top Sources
            cursor.execute("SELECT source_city, COUNT(*) as count FROM search_activity GROUP BY source_city ORDER BY count DESC LIMIT 5")
            metrics["top_sources"] = [
                {"city": (r["source_city"] if isinstance(r, dict) else r[0]), "count": (r["count"] if isinstance(r, dict) else r[1])}
                for r in cursor.fetchall()
            ]

            # Top Destinations
            cursor.execute("SELECT destination_city, COUNT(*) as count FROM search_activity GROUP BY destination_city ORDER BY count DESC LIMIT 5")
            metrics["top_destinations"] = [
                {"city": (r["destination_city"] if isinstance(r, dict) else r[0]), "count": (r["count"] if isinstance(r, dict) else r[1])}
                for r in cursor.fetchall()
            ]

            # Popular Routes
            cursor.execute("SELECT source_city, destination_city, COUNT(*) as count FROM search_activity GROUP BY source_city, destination_city ORDER BY count DESC LIMIT 6")
            metrics["popular_routes"] = [
                {
                    "route": f"{(r['source_city'] if isinstance(r, dict) else r[0])} → {(r['destination_city'] if isinstance(r, dict) else r[1])}",
                    "count": (r["count"] if isinstance(r, dict) else r[2])
                }
                for r in cursor.fetchall()
            ]

            # Popular Airlines
            cursor.execute("SELECT airline, COUNT(*) as count FROM prediction_history GROUP BY airline ORDER BY count DESC LIMIT 6")
            metrics["popular_airlines"] = [
                {"airline": (r["airline"] if isinstance(r, dict) else r[0]), "count": (r["count"] if isinstance(r, dict) else r[1])}
                for r in cursor.fetchall()
            ]

            # Stops distribution
            cursor.execute("SELECT stops, COUNT(*) as count FROM prediction_history GROUP BY stops")
            for r in cursor.fetchall():
                st = str(r["stops"] if isinstance(r, dict) else r[0])
                cnt = r["count"] if isinstance(r, dict) else r[1]
                if st in metrics["stops_distribution"]:
                    metrics["stops_distribution"][st] = cnt

            # Feedback summary
            cursor.execute("SELECT feedback_rating, COUNT(*) as count FROM user_feedback GROUP BY feedback_rating")
            fb_total = 0
            for r in cursor.fetchall():
                rating = str(r["feedback_rating"] if isinstance(r, dict) else r[0]).lower()
                cnt = r["count"] if isinstance(r, dict) else r[1]
                fb_total += cnt
                if rating in ("yes", "helpful", "good"):
                    metrics["feedback_summary"]["helpful"] += cnt
                else:
                    metrics["feedback_summary"]["unhelpful"] += cnt
            metrics["feedback_summary"]["total"] = fb_total

            # Recent activity table (last 10 records)
            cursor.execute("""
            SELECT p.created_at, p.source_city, p.destination_city, p.days_left, p.prediction_mode, p.airline, p.predicted_price
            FROM prediction_history p
            ORDER BY p.prediction_id DESC LIMIT 10
            """)
            for r in cursor.fetchall():
                metrics["recent_activity"].append({
                    "timestamp": str(r["created_at"] if isinstance(r, dict) else r[0]),
                    "source": r["source_city"] if isinstance(r, dict) else r[1],
                    "destination": r["destination_city"] if isinstance(r, dict) else r[2],
                    "days_left": r["days_left"] if isinstance(r, dict) else r[3],
                    "mode": r["prediction_mode"] if isinstance(r, dict) else r[4],
                    "airline": r["airline"] if isinstance(r, dict) else r[5],
                    "price": float(r["predicted_price"] if isinstance(r, dict) else r[6])
                })

            cursor.close()
            conn.close()
        except Exception as e:
            print(f"[ERROR] Failed to fetch admin metrics: {e}")

        return metrics

# Singleton database manager instance
db_manager = DatabaseManager()
