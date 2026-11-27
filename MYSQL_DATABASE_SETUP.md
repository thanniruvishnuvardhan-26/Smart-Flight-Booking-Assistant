# MySQL Database Integration & Setup Guide

**Project:** Smart Flight Booking Assistant  
**Module:** MySQL Relational Storage & Admin Telemetry  
**Security Policy:** Academic Demonstration — Zero Login / Registration  

---

## 1. Overview

The Smart Flight Booking Assistant utilizes a relational database to store user searches, model price predictions, and feedback ratings anonymously.

The machine learning Random Forest pipeline (`flight_price_rf_pipeline_v2.pkl`) continues to perform flight-fare estimation and price curves. The relational database provides telemetry and powers the **Administrator Analytics Dashboard**.

The application is engineered with an automatic **dual-database architecture**:
1. **Primary Target (MySQL):** When MySQL credentials are provided via `.env` or system environment variables, the system connects directly to MySQL using `pymysql`.
2. **Resilient Local Fallback (SQLite):** If MySQL is not running or credentials are not yet configured, the system falls back gracefully to a local SQLite database (`backend/local_flight_assistant.db`) without crashing, preserving full dashboard functionality.

---

## 2. MySQL Installation & Database Creation

### Step 1: Install MySQL Server
If MySQL is not already installed on your Windows machine:
1. Download MySQL Community Server from:  
   [https://dev.mysql.com/downloads/mysql/](https://dev.mysql.com/downloads/mysql/)
2. Complete the installation and note your `root` password.
3. Verify MySQL service is running via Windows Services (`services.msc`).

### Step 2: Create the Database
Log into MySQL via Command Prompt or MySQL Workbench:
```sql
mysql -u root -p
```
Run the following SQL commands to create the database:
```sql
CREATE DATABASE IF NOT EXISTS flight_booking_assistant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 3. Relational Table Schema

The application automatically creates the following tables upon startup:

### 1. `search_activity` Table
Stores anonymous flight search queries:
```sql
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
```

### 2. `prediction_history` Table
Stores individual flight price valuation outputs:
```sql
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
```

### 3. `user_feedback` Table
Stores user satisfaction ratings and comments:
```sql
CREATE TABLE IF NOT EXISTS user_feedback (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,
    prediction_id INT NULL,
    feedback_rating VARCHAR(20) NOT NULL,
    feedback_comments TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_fb_rating (feedback_rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 4. Environment Variables Configuration

Copy `.env.example` to `.env` in the project root:
```ini
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_actual_mysql_password
MYSQL_DATABASE=flight_booking_assistant
```

Never commit your actual `.env` file containing passwords to Git. The project `.gitignore` already protects `.env`.
