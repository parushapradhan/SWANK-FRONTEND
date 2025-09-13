# PBF Import Guide for Road Classification Dashboard

## Overview

This guide explains how to import your `us-osm.pbf` file into the PostgreSQL database with PostGIS extensions. The import process will create comprehensive road data with Pennsylvania state focus.

## Prerequisites

### Required Software
1. **PostgreSQL 12+** with PostGIS extension
2. **osm2pgsql** - OSM data importer
3. **Docker** (optional, for containerized setup)

### Installation Commands

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgis postgresql-15-postgis-3 osm2pgsql
```

#### macOS (with Homebrew)
```bash
brew install postgresql postgis osm2pgsql
```

#### Windows
- Download PostgreSQL from https://www.postgresql.org/download/windows/
- Download PostGIS from https://postgis.net/install/
- Download osm2pgsql from https://osm2pgsql.org/

## Quick Start

### Option 1: Automated Import (Recommended)

```bash
# Navigate to database directory
cd database

# Make script executable
chmod +x import_us_osm.sh

# Run import (will use ../us-osm.pbf by default)
./import_us_osm.sh

# Or specify custom PBF file
./import_us_osm.sh /path/to/your/file.pbf
```

### Option 2: Manual Import

```bash
# 1. Create database and setup schema
psql -U postgres -d road_dashboard -f pbf_import.sql

# 2. Import PBF file
osm2pgsql --host localhost --port 5432 --username postgres --database road_dashboard \
  --create --slim --drop --cache 4096 --number-processes 8 \
  --style osm2pgsql_us_style.lua --output-pgsql-schema public \
  --multi-geometry --hstore --hstore-all --verbose \
  ../us-osm.pbf

# 3. Extract roads and intersections
psql -U postgres -d road_dashboard -c "SELECT extract_roads_from_ways();"
psql -U postgres -d road_dashboard -c "SELECT extract_intersections_from_nodes();"

# 4. Update Pennsylvania state field
psql -U postgres -d road_dashboard -c "
UPDATE osm_roads SET state = 'PA' 
WHERE ST_Intersects(geom, ST_MakeEnvelope(-80.5, 39.7, -74.7, 42.3, 4326));
"
```

## Database Schema for PBF Import

### OSM Tables Created

#### 1. osm_nodes
Raw OSM node data (intersections, points of interest)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | OSM node ID |
| `version` | INTEGER | OSM version |
| `user_id` | INTEGER | OSM user ID |
| `tstamp` | TIMESTAMP | Last modified timestamp |
| `changeset_id` | BIGINT | OSM changeset ID |
| `tags` | HSTORE | OSM tags (key-value pairs) |
| `geom` | GEOMETRY(POINT, 4326) | Point geometry |

#### 2. osm_ways
Raw OSM way data (roads, polygons)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | OSM way ID |
| `version` | INTEGER | OSM version |
| `user_id` | INTEGER | OSM user ID |
| `tstamp` | TIMESTAMP | Last modified timestamp |
| `changeset_id` | BIGINT | OSM changeset ID |
| `tags` | HSTORE | OSM tags (key-value pairs) |
| `nodes` | BIGINT[] | Array of node IDs |
| `geom` | GEOMETRY(GEOMETRY, 4326) | Line or polygon geometry |

#### 3. osm_relations
Raw OSM relation data (administrative boundaries, routes)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | OSM relation ID |
| `version` | INTEGER | OSM version |
| `user_id` | INTEGER | OSM user ID |
| `tstamp` | TIMESTAMP | Last modified timestamp |
| `changeset_id` | BIGINT | OSM changeset ID |
| `tags` | HSTORE | OSM tags (key-value pairs) |
| `members` | TEXT[] | Array of relation members |

### Processed Tables

#### 4. osm_roads
Extracted road data from OSM ways

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Auto-incrementing primary key |
| `osm_id` | BIGINT | Original OSM way ID |
| `name` | VARCHAR(255) | Road name |
| `highway` | VARCHAR(50) | Highway type (motorway, trunk, primary, etc.) |
| `surface` | VARCHAR(50) | Surface type (asphalt, concrete, etc.) |
| `maxspeed` | VARCHAR(20) | Speed limit |
| `lanes` | INTEGER | Number of lanes |
| `width` | DECIMAL(8,2) | Road width |
| `oneway` | BOOLEAN | One-way indicator |
| `bridge` | BOOLEAN | Bridge indicator |
| `tunnel` | BOOLEAN | Tunnel indicator |
| `access` | VARCHAR(50) | Access restrictions |
| `ref` | VARCHAR(100) | Road reference number |
| `operator` | VARCHAR(255) | Road operator |
| `network` | VARCHAR(100) | Road network |
| `state` | VARCHAR(10) | State code (default: 'PA') |
| `county` | VARCHAR(100) | County name |
| `city` | VARCHAR(100) | City name |
| `tags` | HSTORE | All OSM tags |
| `geom` | GEOMETRY(LINESTRING, 4326) | Road line geometry |
| `length_meters` | DECIMAL(12,2) | Calculated length in meters |
| `created_at` | TIMESTAMP | Import timestamp |

#### 5. osm_intersections
Extracted intersection data from OSM nodes

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Auto-incrementing primary key |
| `osm_id` | BIGINT | Original OSM node ID |
| `name` | VARCHAR(255) | Intersection name |
| `highway` | VARCHAR(50) | Highway type |
| `junction` | VARCHAR(50) | Junction type |
| `traffic_signals` | BOOLEAN | Traffic signals present |
| `state` | VARCHAR(10) | State code (default: 'PA') |
| `county` | VARCHAR(100) | County name |
| `city` | VARCHAR(100) | City name |
| `tags` | HSTORE | All OSM tags |
| `geom` | GEOMETRY(POINT, 4326) | Intersection point |
| `created_at` | TIMESTAMP | Import timestamp |

## Import Process Details

### 1. osm2pgsql Configuration

The import uses a custom style file (`osm2pgsql_us_style.lua`) that focuses on:

- **Road-related tags**: highway, surface, lanes, width, etc.
- **Administrative data**: state, county, city information
- **TIGER data**: US Census Bureau road data
- **Pennsylvania-specific**: State and county boundaries

### 2. Data Extraction Process

#### Road Extraction
```sql
-- Roads are extracted from OSM ways with highway tags
-- Highway types mapped to facility types:
-- motorway -> Interstate (Type 1)
-- trunk, primary -> US Route (Type 2)  
-- secondary, tertiary -> State Route (Type 3)
-- residential, unclassified -> Local Road (Type 5)
```

#### Intersection Extraction
```sql
-- Intersections extracted from nodes with:
-- highway = traffic_signals, stop, give_way, mini_roundabout
-- junction tags
```

#### State Assignment
```sql
-- Pennsylvania roads identified by:
-- 1. TIGER state tags (tiger:state = 'PA')
-- 2. Geographic bounding box (-80.5, 39.7, -74.7, 42.3)
-- 3. Administrative boundary intersections
```

### 3. Performance Optimization

#### Memory Settings
- **Cache size**: 4096 MB (adjust based on available RAM)
- **Number of processes**: 8 (adjust based on CPU cores)
- **Batch processing**: Large datasets processed in chunks

#### Index Creation
- **Spatial indexes**: GIST indexes on all geometry columns
- **Attribute indexes**: B-tree indexes on commonly queried fields
- **HStore indexes**: GIN indexes for tag-based queries

## API Endpoints for OSM Data

### Get OSM Roads
```
GET /api/osm-roads?state=PA&highway=motorway&limit=1000
```

**Parameters:**
- `state` - State code (default: 'PA')
- `highway` - Highway type filter
- `limit` - Result limit (default: 10000)
- `offset` - Result offset (default: 0)

### Get Heat Map Data (OSM)
```
GET /api/heatmap?type=condition&data_source=osm
```

**Parameters:**
- `type` - Heat map type (condition, traffic, age)
- `data_source` - Data source ('csv' or 'osm')

## Monitoring Import Progress

### Check Import Status
```sql
-- Check OSM table sizes
SELECT 
  schemaname, 
  tablename, 
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'osm_%';

-- Check road extraction progress
SELECT COUNT(*) as total_ways FROM osm_ways WHERE tags ? 'highway';
SELECT COUNT(*) as extracted_roads FROM osm_roads;
```

### Import Statistics
```sql
-- Road statistics by highway type
SELECT * FROM get_road_statistics();

-- Pennsylvania roads count
SELECT COUNT(*) as pa_roads FROM osm_roads WHERE state = 'PA';

-- Intersection count
SELECT COUNT(*) as intersections FROM osm_intersections WHERE state = 'PA';
```

## Troubleshooting

### Common Issues

#### 1. Memory Errors
```bash
# Increase PostgreSQL memory settings
# Edit postgresql.conf:
shared_buffers = 2GB
work_mem = 256MB
maintenance_work_mem = 1GB
```

#### 2. Disk Space
```bash
# Check available space
df -h

# Monitor import progress
watch -n 5 'du -sh /var/lib/postgresql/data/'
```

#### 3. Import Failures
```bash
# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql-15-main.log

# Verify osm2pgsql installation
osm2pgsql --version
```

#### 4. Geometry Issues
```sql
-- Fix invalid geometries
UPDATE osm_roads 
SET geom = ST_MakeValid(geom) 
WHERE NOT ST_IsValid(geom);
```

### Performance Tuning

#### Database Configuration
```sql
-- Optimize for spatial queries
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_cache_size = '4GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
SELECT pg_reload_conf();
```

#### Index Maintenance
```sql
-- Rebuild indexes if needed
REINDEX INDEX idx_osm_roads_geom;
REINDEX INDEX idx_osm_intersections_geom;
```

## Post-Import Tasks

### 1. Verify Data Quality
```sql
-- Check for Pennsylvania roads
SELECT COUNT(*) FROM osm_roads WHERE state = 'PA';

-- Verify geometry validity
SELECT COUNT(*) FROM osm_roads WHERE NOT ST_IsValid(geom);

-- Check for major highways
SELECT highway, COUNT(*) FROM osm_roads WHERE state = 'PA' GROUP BY highway;
```

### 2. Update Statistics
```sql
-- Refresh materialized views
SELECT refresh_osm_statistics();

-- Update table statistics
ANALYZE osm_roads;
ANALYZE osm_intersections;
```

### 3. Create Additional Views
```sql
-- Create view for Pennsylvania highways
CREATE VIEW pa_highways AS
SELECT * FROM osm_roads 
WHERE state = 'PA' 
  AND highway IN ('motorway', 'trunk', 'primary');

-- Create view for urban roads
CREATE VIEW pa_urban_roads AS
SELECT * FROM osm_roads 
WHERE state = 'PA' 
  AND city IS NOT NULL;
```

## Integration with Dashboard

### Frontend Updates
The dashboard can now access both CSV and OSM data:

```javascript
// Fetch OSM roads
const osmRoads = await fetch('/api/osm-roads?state=PA');

// Fetch combined data
const allRoads = await fetch('/api/roads?data_source=both');

// Fetch OSM heat map
const osmHeatmap = await fetch('/api/heatmap?data_source=osm&type=condition');
```

### Map Visualization
OSM roads will be displayed with:
- **Color coding** based on highway type
- **Line width** based on number of lanes
- **State field** showing 'PA' for Pennsylvania roads
- **Additional attributes** from OSM tags

This comprehensive PBF import process provides a robust foundation for your road classification dashboard with both CSV and OSM data sources!
