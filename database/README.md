# PostgreSQL with PostGIS Setup Guide

This guide will help you set up PostgreSQL with PostGIS and HStore extensions for the Road Classification Dashboard.

## Prerequisites

- Docker and Docker Compose (recommended)
- OR PostgreSQL 12+ with PostGIS extension installed locally

## Option 1: Docker Setup (Recommended)

### 1. Start PostgreSQL with PostGIS

```bash
cd database
docker-compose up -d
```

This will start:
- PostgreSQL 15 with PostGIS 3.3 on port 5432
- PgAdmin 4 on port 8080

### 2. Access PgAdmin

- URL: http://localhost:8080
- Email: admin@roaddashboard.com
- Password: admin

### 3. Connect to Database in PgAdmin

- Host: postgres (or localhost if accessing from outside Docker)
- Port: 5432
- Database: road_dashboard
- Username: postgres
- Password: password

## Option 2: Local PostgreSQL Setup

### 1. Install PostgreSQL with PostGIS

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgis postgresql-15-postgis-3
```

**macOS (with Homebrew):**
```bash
brew install postgresql postgis
```

**Windows:**
Download and install from https://postgis.net/install/

### 2. Create Database and Extensions

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE road_dashboard;

# Connect to the new database
\c road_dashboard;

# Enable extensions
CREATE EXTENSION postgis;
CREATE EXTENSION hstore;
CREATE EXTENSION "uuid-ossp";
```

### 3. Run Setup Script

```bash
psql -U postgres -d road_dashboard -f setup.sql
```

## Data Migration

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env` file in the root directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=road_dashboard
DB_USER=postgres
DB_PASSWORD=password
```

### 3. Run Data Migration

```bash
# Using the migration script
node database/migrate_data.js

# OR start the server (it will automatically load CSV data)
npm run server
```

## Database Schema

### Main Table: road_segments

- **Spatial Columns:**
  - `start_point` - GEOMETRY(POINT, 4326)
  - `end_point` - GEOMETRY(POINT, 4326)
  - `road_line` - GEOMETRY(LINESTRING, 4326) - Auto-generated

- **Attributes:**
  - Road classification data (fac_type, surf_type, etc.)
  - Condition data (rough_indx, iri_rating_text, etc.)
  - Traffic data (cur_aadt)
  - Additional attributes stored in HStore

### Spatial Indexes

- GIST indexes on all spatial columns for optimal performance
- Additional indexes on commonly queried attributes

### Functions

- `get_roads_in_bounds()` - Get roads within a bounding box
- `search_roads_by_name()` - Search roads by name
- `generate_road_line()` - Auto-generate line geometry from points
- `refresh_road_statistics()` - Refresh materialized views

## Advanced Features

### Spatial Queries

```sql
-- Find roads within 1km of a point
SELECT * FROM road_segments 
WHERE ST_DWithin(start_point, ST_SetSRID(ST_MakePoint(-77.0, 39.5), 4326), 1000);

-- Get roads intersecting a polygon
SELECT * FROM road_segments 
WHERE road_line && ST_MakeEnvelope(-77.1, 39.4, -76.9, 39.6, 4326);
```

### HStore Usage

```sql
-- Store additional attributes
UPDATE road_segments 
SET additional_attrs = additional_attrs || 'bike_lane=>yes'::hstore
WHERE id = 1;

-- Query HStore data
SELECT * FROM road_segments 
WHERE additional_attrs ? 'bike_lane';
```

## Performance Optimization

### 1. Spatial Indexes

The database automatically creates GIST indexes on spatial columns for optimal performance.

### 2. Materialized Views

Statistics are pre-computed in materialized views for faster dashboard loading.

### 3. Connection Pooling

The application uses connection pooling to manage database connections efficiently.

## Troubleshooting

### Connection Issues

1. **Check if PostgreSQL is running:**
   ```bash
   # Docker
   docker ps
   
   # Local
   sudo systemctl status postgresql
   ```

2. **Test connection:**
   ```bash
   psql -h localhost -U postgres -d road_dashboard
   ```

### PostGIS Issues

1. **Verify PostGIS installation:**
   ```sql
   SELECT PostGIS_Version();
   ```

2. **Check extensions:**
   ```sql
   SELECT * FROM pg_extension WHERE extname IN ('postgis', 'hstore');
   ```

### Data Import Issues

1. **Check CSV file path:**
   Ensure `RMSSEG_(State_Roads).csv` is in the project root.

2. **Verify data format:**
   Check that coordinates are valid longitude/latitude values.

3. **Check database permissions:**
   Ensure the database user has INSERT/UPDATE/DELETE permissions.

## Backup and Restore

### Backup

```bash
# Full database backup
pg_dump -h localhost -U postgres road_dashboard > backup.sql

# Data only
pg_dump -h localhost -U postgres --data-only road_dashboard > data_backup.sql
```

### Restore

```bash
# Restore from backup
psql -h localhost -U postgres road_dashboard < backup.sql
```

## Monitoring

### Database Statistics

```sql
-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables WHERE schemaname = 'public';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes;
```

This setup provides a robust, scalable foundation for your road classification dashboard with advanced spatial capabilities!
