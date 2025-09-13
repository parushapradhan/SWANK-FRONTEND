# Road Classification Dashboard - Database Documentation

## Overview

This document provides comprehensive documentation for the PostgreSQL database used in the Road Classification Dashboard. The database is designed to handle both CSV road data and OpenStreetMap (OSM) PBF data with advanced spatial capabilities using PostGIS.

## Database Architecture

### Core Extensions
- **PostGIS**: Spatial and geographic objects support
- **HStore**: Key-value storage for flexible attributes
- **UUID-OSSP**: UUID generation functions

### Database Schema

## Tables

### 1. road_segments (CSV Data)
Primary table for road segment data from CSV files.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Auto-incrementing primary key |
| `objectid` | INTEGER | Original object ID from CSV |
| `st_rt_no` | VARCHAR(10) | State route number |
| `cty_code` | VARCHAR(5) | County code |
| `district_no` | VARCHAR(5) | District number |
| `seg_no` | VARCHAR(10) | Segment number |
| `seg_lngth_feet` | DECIMAL(10,2) | Segment length in feet |
| `fac_type` | VARCHAR(5) | Facility type (1=Interstate, 2=US Route, etc.) |
| `surf_type` | VARCHAR(5) | Surface type (52=Asphalt, 61=Concrete, etc.) |
| `lane_cnt` | INTEGER | Number of lanes |
| `total_width` | DECIMAL(8,2) | Total road width |
| `rough_indx` | DECIMAL(8,2) | Roughness index (condition rating) |
| `frictn_coeff` | DECIMAL(8,2) | Friction coefficient |
| `pvmnt_cond_rate` | VARCHAR(10) | Pavement condition rating |
| `cur_aadt` | INTEGER | Current Annual Average Daily Traffic |
| `street_name` | VARCHAR(255) | Street name |
| `traf_rt_no` | VARCHAR(20) | Traffic route number |
| `start_point` | GEOMETRY(POINT, 4326) | Start coordinates (spatial) |
| `end_point` | GEOMETRY(POINT, 4326) | End coordinates (spatial) |
| `road_line` | GEOMETRY(LINESTRING, 4326) | Road line geometry (auto-generated) |
| `segment_miles` | DECIMAL(10,4) | Segment length in miles |
| `lane_miles` | DECIMAL(10,4) | Lane miles |
| `iri_rating_text` | VARCHAR(20) | IRI rating text |
| `opi_rating_text` | VARCHAR(20) | OPI rating text |
| `surface_year` | INTEGER | Year of surface construction |
| `urban_rural` | VARCHAR(5) | Urban/rural classification |
| `nhs_ind` | VARCHAR(5) | National Highway System indicator |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Record update timestamp |

### 2. osm_roads (OSM Data)
Road data extracted from OpenStreetMap PBF files.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT PRIMARY KEY | Auto-incrementing primary key |
| `osm_id` | BIGINT | Original OSM ID |
| `name` | VARCHAR(255) | Road name |
| `highway` | VARCHAR(50) | Highway type (motorway, trunk, primary, etc.) |
| `surface` | VARCHAR(50) | Surface type (asphalt, concrete, etc.) |
| `maxspeed` | VARCHAR(20) | Maximum speed limit |
| `lanes` | INTEGER | Number of lanes |
| `width` | DECIMAL(8,2) | Road width |
| `oneway` | BOOLEAN | One-way road indicator |
| `bridge` | BOOLEAN | Bridge indicator |
| `tunnel` | BOOLEAN | Tunnel indicator |
| `access` | VARCHAR(50) | Access restrictions |
| `ref` | VARCHAR(100) | Road reference number |
| `operator` | VARCHAR(255) | Road operator |
| `network` | VARCHAR(100) | Road network |
| `state` | VARCHAR(10) | State code (default: 'PA') |
| `county` | VARCHAR(100) | County name |
| `city` | VARCHAR(100) | City name |
| `tags` | HSTORE | Additional OSM tags |
| `geom` | GEOMETRY(LINESTRING, 4326) | Road line geometry |
| `length_meters` | DECIMAL(12,2) | Road length in meters (auto-calculated) |
| `created_at` | TIMESTAMP | Record creation timestamp |

### 3. osm_intersections (OSM Data)
Intersection data from OpenStreetMap.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Auto-incrementing primary key |
| `osm_id` | BIGINT | Original OSM ID |
| `name` | VARCHAR(255) | Intersection name |
| `highway` | VARCHAR(50) | Highway type |
| `junction` | VARCHAR(50) | Junction type |
| `traffic_signals` | BOOLEAN | Traffic signals present |
| `state` | VARCHAR(10) | State code (default: 'PA') |
| `county` | VARCHAR(100) | County name |
| `city` | VARCHAR(100) | City name |
| `tags` | HSTORE | Additional OSM tags |
| `geom` | GEOMETRY(POINT, 4326) | Intersection point geometry |
| `created_at` | TIMESTAMP | Record creation timestamp |

### 4. osm_admin_boundaries (OSM Data)
Administrative boundaries from OpenStreetMap.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Auto-incrementing primary key |
| `osm_id` | BIGINT | Original OSM ID |
| `name` | VARCHAR(255) | Boundary name |
| `admin_level` | INTEGER | Administrative level |
| `boundary` | VARCHAR(50) | Boundary type |
| `place` | VARCHAR(50) | Place type |
| `population` | INTEGER | Population |
| `tags` | HSTORE | Additional OSM tags |
| `geom` | GEOMETRY(MULTIPOLYGON, 4326) | Boundary geometry |
| `created_at` | TIMESTAMP | Record creation timestamp |

### 5. osm_nodes, osm_ways, osm_relations (Raw OSM Data)
Raw OpenStreetMap data tables created by osm2pgsql.

## Indexes

### Spatial Indexes (GIST)
- `idx_road_segments_start_point` - Start point geometry
- `idx_road_segments_end_point` - End point geometry  
- `idx_road_segments_road_line` - Road line geometry
- `idx_osm_nodes_geom` - OSM nodes geometry
- `idx_osm_ways_geom` - OSM ways geometry
- `idx_osm_roads_geom` - OSM roads geometry
- `idx_osm_intersections_geom` - Intersections geometry
- `idx_osm_admin_geom` - Admin boundaries geometry

### Attribute Indexes
- `idx_road_segments_fac_type` - Facility type
- `idx_road_segments_surf_type` - Surface type
- `idx_road_segments_district` - District number
- `idx_road_segments_condition` - Condition rating
- `idx_road_segments_traffic` - Traffic volume
- `idx_osm_roads_highway` - Highway type
- `idx_osm_roads_surface` - Surface type

### HStore Indexes
- `idx_osm_nodes_highway` - Highway tags in nodes
- `idx_osm_ways_highway` - Highway tags in ways

## Functions

### Spatial Functions

#### `get_roads_in_bounds(min_lat, min_lng, max_lat, max_lng)`
Returns roads within a bounding box.

**Parameters:**
- `min_lat` - Minimum latitude
- `min_lng` - Minimum longitude  
- `max_lat` - Maximum latitude
- `max_lng` - Maximum longitude

**Returns:** Table with road data within bounds

#### `find_roads_near_point(point_lat, point_lng, distance_meters)`
Finds roads within a specified distance of a point.

**Parameters:**
- `point_lat` - Point latitude
- `point_lng` - Point longitude
- `distance_meters` - Search radius in meters (default: 1000)

**Returns:** Table with nearby roads and distances

#### `search_roads_by_name(search_term)`
Searches roads by name or route number.

**Parameters:**
- `search_term` - Search string

**Returns:** Table with matching roads

### Data Processing Functions

#### `extract_roads_from_ways()`
Extracts road data from OSM ways and populates osm_roads table.

#### `extract_intersections_from_nodes()`
Extracts intersection data from OSM nodes.

#### `extract_admin_boundaries_from_ways()`
Extracts administrative boundaries from OSM ways.

#### `generate_road_line()`
Auto-generates road line geometry from start and end points.

#### `calculate_road_length()`
Calculates road length in meters using Web Mercator projection.

### Statistics Functions

#### `get_road_statistics()`
Returns road statistics grouped by highway type.

**Returns:** Table with highway type, count, total length, average length, average lanes

#### `refresh_osm_statistics()`
Refreshes materialized views with current data.

## Materialized Views

### `road_statistics_mv`
Pre-computed road statistics for fast dashboard loading.

| Column | Type | Description |
|--------|------|-------------|
| `highway` | VARCHAR | Highway type |
| `road_count` | BIGINT | Number of roads |
| `total_length_meters` | DECIMAL | Total length in meters |
| `avg_length_meters` | DECIMAL | Average length in meters |
| `avg_lanes` | DECIMAL | Average number of lanes |
| `bridge_count` | BIGINT | Number of bridges |
| `tunnel_count` | BIGINT | Number of tunnels |

## Triggers

### `calculate_road_length_trigger`
Automatically calculates road length when geometry is inserted or updated.

### `generate_road_line_trigger`
Automatically generates road line geometry from start and end points.

### `update_road_segments_updated_at`
Updates the `updated_at` timestamp when records are modified.

## Data Import Process

### CSV Data Import
1. **File Processing**: CSV files are parsed and validated
2. **Data Cleaning**: Coordinates and numeric values are cleaned
3. **Spatial Conversion**: Coordinates are converted to PostGIS geometries
4. **Batch Insert**: Data is inserted in batches with transaction management
5. **Index Creation**: Spatial and attribute indexes are created

### PBF Data Import
1. **osm2pgsql**: Raw OSM data is imported using osm2pgsql
2. **Data Extraction**: Roads, intersections, and boundaries are extracted
3. **State Assignment**: Pennsylvania roads are identified and tagged
4. **Geometry Processing**: Spatial geometries are processed and indexed
5. **Statistics Update**: Materialized views are refreshed

## API Endpoints

### `/api/roads`
Returns road segments with optional filtering.

**Query Parameters:**
- `fac_type` - Facility type filter
- `surf_type` - Surface type filter
- `district_no` - District filter
- `urban_rural` - Urban/rural filter
- `min_condition` - Minimum condition rating
- `max_condition` - Maximum condition rating
- `limit` - Result limit (default: 10000)
- `offset` - Result offset (default: 0)

### `/api/statistics`
Returns road network statistics.

**Returns:**
- Total segments count
- Total miles
- Breakdown by facility type
- Breakdown by surface type
- Breakdown by condition
- Breakdown by district

### `/api/heatmap`
Returns heat map data for visualization.

**Query Parameters:**
- `type` - Heat map type (condition, traffic, age)

## Performance Optimization

### Spatial Queries
- GIST indexes on all spatial columns
- Spatial query optimization using PostGIS functions
- Bounding box queries for map rendering

### Data Access
- Connection pooling for concurrent access
- Materialized views for fast statistics
- Batch processing for large data imports

### Indexing Strategy
- Spatial indexes for geographic queries
- Attribute indexes for filtering
- HStore indexes for tag-based queries

## Backup and Maintenance

### Regular Maintenance
```sql
-- Refresh materialized views
SELECT refresh_osm_statistics();

-- Update table statistics
ANALYZE road_segments;
ANALYZE osm_roads;

-- Vacuum tables
VACUUM ANALYZE road_segments;
VACUUM ANALYZE osm_roads;
```

### Backup Procedures
```bash
# Full database backup
pg_dump -h localhost -U postgres road_dashboard > backup.sql

# Data-only backup
pg_dump -h localhost -U postgres --data-only road_dashboard > data_backup.sql

# Schema-only backup
pg_dump -h localhost -U postgres --schema-only road_dashboard > schema_backup.sql
```

## Troubleshooting

### Common Issues

1. **Spatial Index Problems**
   ```sql
   -- Recreate spatial indexes
   DROP INDEX IF EXISTS idx_road_segments_road_line;
   CREATE INDEX idx_road_segments_road_line ON road_segments USING GIST (road_line);
   ```

2. **Memory Issues During Import**
   - Increase `shared_buffers` in postgresql.conf
   - Use smaller batch sizes in import scripts
   - Increase `work_mem` for large operations

3. **Geometry Validation Errors**
   ```sql
   -- Fix invalid geometries
   UPDATE road_segments 
   SET road_line = ST_MakeValid(road_line) 
   WHERE NOT ST_IsValid(road_line);
   ```

### Performance Monitoring
```sql
-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables WHERE schemaname = 'public';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes;
```

## Security Considerations

### Access Control
- Use dedicated database users with minimal privileges
- Implement connection limits
- Use SSL for remote connections

### Data Protection
- Regular backups with encryption
- Access logging and monitoring
- Input validation for all API endpoints

This database design provides a robust foundation for the Road Classification Dashboard with advanced spatial capabilities, efficient querying, and scalable architecture.
