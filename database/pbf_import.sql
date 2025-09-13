-- PBF/OSM Data Import Schema for Road Classification Dashboard
-- This script creates tables optimized for OpenStreetMap data import

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- OSM Nodes table (points)
CREATE TABLE IF NOT EXISTS osm_nodes (
    id BIGINT PRIMARY KEY,
    version INTEGER,
    user_id INTEGER,
    tstamp TIMESTAMP,
    changeset_id BIGINT,
    tags HSTORE,
    geom GEOMETRY(POINT, 4326)
);

-- OSM Ways table (lines/polygons)
CREATE TABLE IF NOT EXISTS osm_ways (
    id BIGINT PRIMARY KEY,
    version INTEGER,
    user_id INTEGER,
    tstamp TIMESTAMP,
    changeset_id BIGINT,
    tags HSTORE,
    nodes BIGINT[],
    geom GEOMETRY(GEOMETRY, 4326)
);

-- OSM Relations table
CREATE TABLE IF NOT EXISTS osm_relations (
    id BIGINT PRIMARY KEY,
    version INTEGER,
    user_id INTEGER,
    tstamp TIMESTAMP,
    changeset_id BIGINT,
    tags HSTORE,
    members TEXT[]
);

-- Road-specific tables (extracted from OSM data)
CREATE TABLE IF NOT EXISTS osm_roads (
    id BIGINT PRIMARY KEY,
    osm_id BIGINT,
    name VARCHAR(255),
    highway VARCHAR(50),
    surface VARCHAR(50),
    maxspeed VARCHAR(20),
    lanes INTEGER,
    width DECIMAL(8,2),
    oneway BOOLEAN,
    bridge BOOLEAN,
    tunnel BOOLEAN,
    access VARCHAR(50),
    ref VARCHAR(100),
    operator VARCHAR(255),
    network VARCHAR(100),
    state VARCHAR(10) DEFAULT 'PA', -- State field for Pennsylvania
    county VARCHAR(100),
    city VARCHAR(100),
    tags HSTORE,
    geom GEOMETRY(LINESTRING, 4326),
    length_meters DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Road intersections table
CREATE TABLE IF NOT EXISTS osm_intersections (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    name VARCHAR(255),
    highway VARCHAR(50),
    junction VARCHAR(50),
    traffic_signals BOOLEAN,
    state VARCHAR(10) DEFAULT 'PA', -- State field for Pennsylvania
    county VARCHAR(100),
    city VARCHAR(100),
    tags HSTORE,
    geom GEOMETRY(POINT, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Administrative boundaries
CREATE TABLE IF NOT EXISTS osm_admin_boundaries (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    name VARCHAR(255),
    admin_level INTEGER,
    boundary VARCHAR(50),
    place VARCHAR(50),
    population INTEGER,
    tags HSTORE,
    geom GEOMETRY(MULTIPOLYGON, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spatial indexes for OSM tables
CREATE INDEX IF NOT EXISTS idx_osm_nodes_geom ON osm_nodes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_osm_ways_geom ON osm_ways USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_osm_roads_geom ON osm_roads USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_osm_intersections_geom ON osm_intersections USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_osm_admin_geom ON osm_admin_boundaries USING GIST (geom);

-- Indexes on tags for common queries
CREATE INDEX IF NOT EXISTS idx_osm_nodes_highway ON osm_nodes USING GIN (tags) WHERE tags ? 'highway';
CREATE INDEX IF NOT EXISTS idx_osm_ways_highway ON osm_ways USING GIN (tags) WHERE tags ? 'highway';
CREATE INDEX IF NOT EXISTS idx_osm_roads_highway ON osm_roads (highway);
CREATE INDEX IF NOT EXISTS idx_osm_roads_surface ON osm_roads (surface);

-- Function to calculate road length
CREATE OR REPLACE FUNCTION calculate_road_length()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.geom IS NOT NULL THEN
        NEW.length_meters = ST_Length(ST_Transform(NEW.geom, 3857));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate road length
CREATE TRIGGER calculate_road_length_trigger
    BEFORE INSERT OR UPDATE ON osm_roads
    FOR EACH ROW EXECUTE FUNCTION calculate_road_length();

-- Function to extract roads from OSM ways
CREATE OR REPLACE FUNCTION extract_roads_from_ways()
RETURNS void AS $$
BEGIN
    -- Clear existing roads
    DELETE FROM osm_roads;
    
    -- Insert roads from ways
    INSERT INTO osm_roads (
        osm_id, name, highway, surface, maxspeed, lanes, width, 
        oneway, bridge, tunnel, access, ref, operator, network, 
        state, county, city, tags, geom
    )
    SELECT 
        w.id as osm_id,
        w.tags->'name' as name,
        w.tags->'highway' as highway,
        w.tags->'surface' as surface,
        w.tags->'maxspeed' as maxspeed,
        CASE 
            WHEN w.tags->'lanes' ~ '^[0-9]+$' THEN (w.tags->'lanes')::INTEGER
            ELSE NULL
        END as lanes,
        CASE 
            WHEN w.tags->'width' ~ '^[0-9]+\.?[0-9]*$' THEN (w.tags->'width')::DECIMAL
            ELSE NULL
        END as width,
        CASE 
            WHEN w.tags->'oneway' = 'yes' THEN TRUE
            WHEN w.tags->'oneway' = 'no' THEN FALSE
            ELSE NULL
        END as oneway,
        CASE WHEN w.tags ? 'bridge' THEN TRUE ELSE FALSE END as bridge,
        CASE WHEN w.tags ? 'tunnel' THEN TRUE ELSE FALSE END as tunnel,
        w.tags->'access' as access,
        w.tags->'ref' as ref,
        w.tags->'operator' as operator,
        w.tags->'network' as network,
        'PA' as state, -- Default to Pennsylvania
        w.tags->'county' as county,
        w.tags->'city' as city,
        w.tags,
        w.geom
    FROM osm_ways w
    WHERE w.tags ? 'highway'
      AND w.tags->'highway' NOT IN ('no', 'proposed', 'construction')
      AND ST_GeometryType(w.geom) = 'ST_LineString';
      
    -- Update statistics
    RAISE NOTICE 'Extracted % roads from OSM ways', (SELECT COUNT(*) FROM osm_roads);
END;
$$ LANGUAGE plpgsql;

-- Function to extract intersections from nodes
CREATE OR REPLACE FUNCTION extract_intersections_from_nodes()
RETURNS void AS $$
BEGIN
    -- Clear existing intersections
    DELETE FROM osm_intersections;
    
    -- Insert intersections from nodes
    INSERT INTO osm_intersections (
        osm_id, name, highway, junction, traffic_signals, tags, geom
    )
    SELECT 
        n.id as osm_id,
        n.tags->'name' as name,
        n.tags->'highway' as highway,
        n.tags->'junction' as junction,
        CASE WHEN n.tags ? 'traffic_signals' THEN TRUE ELSE FALSE END as traffic_signals,
        n.tags,
        n.geom
    FROM osm_nodes n
    WHERE n.tags ? 'highway'
      AND n.tags->'highway' IN ('traffic_signals', 'stop', 'give_way', 'mini_roundabout', 'turning_circle')
      OR n.tags ? 'junction';
      
    -- Update statistics
    RAISE NOTICE 'Extracted % intersections from OSM nodes', (SELECT COUNT(*) FROM osm_intersections);
END;
$$ LANGUAGE plpgsql;

-- Function to extract administrative boundaries
CREATE OR REPLACE FUNCTION extract_admin_boundaries_from_ways()
RETURNS void AS $$
BEGIN
    -- Clear existing boundaries
    DELETE FROM osm_admin_boundaries;
    
    -- Insert boundaries from ways (simplified - would need relation processing for full boundaries)
    INSERT INTO osm_admin_boundaries (
        osm_id, name, admin_level, boundary, place, population, tags, geom
    )
    SELECT 
        w.id as osm_id,
        w.tags->'name' as name,
        CASE 
            WHEN w.tags->'admin_level' ~ '^[0-9]+$' THEN (w.tags->'admin_level')::INTEGER
            ELSE NULL
        END as admin_level,
        w.tags->'boundary' as boundary,
        w.tags->'place' as place,
        CASE 
            WHEN w.tags->'population' ~ '^[0-9]+$' THEN (w.tags->'population')::INTEGER
            ELSE NULL
        END as population,
        w.tags,
        w.geom
    FROM osm_ways w
    WHERE w.tags ? 'boundary'
      AND w.tags->'boundary' = 'administrative'
      AND ST_GeometryType(w.geom) = 'ST_Polygon';
      
    -- Update statistics
    RAISE NOTICE 'Extracted % administrative boundaries from OSM ways', (SELECT COUNT(*) FROM osm_admin_boundaries);
END;
$$ LANGUAGE plpgsql;

-- Function to get road statistics
CREATE OR REPLACE FUNCTION get_road_statistics()
RETURNS TABLE (
    highway_type VARCHAR,
    count BIGINT,
    total_length DECIMAL,
    avg_length DECIMAL,
    avg_lanes DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.highway,
        COUNT(*) as count,
        SUM(r.length_meters) as total_length,
        AVG(r.length_meters) as avg_length,
        AVG(r.lanes) as avg_lanes
    FROM osm_roads r
    WHERE r.highway IS NOT NULL
    GROUP BY r.highway
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to find roads within distance of a point
CREATE OR REPLACE FUNCTION find_roads_near_point(
    point_lat DECIMAL,
    point_lng DECIMAL,
    distance_meters INTEGER DEFAULT 1000
)
RETURNS TABLE (
    osm_id BIGINT,
    name VARCHAR,
    highway VARCHAR,
    distance_meters DECIMAL,
    geom GEOMETRY
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.osm_id,
        r.name,
        r.highway,
        ST_Distance(ST_Transform(r.geom, 3857), ST_Transform(ST_SetSRID(ST_MakePoint(point_lng, point_lat), 4326), 3857)) as distance_meters,
        r.geom
    FROM osm_roads r
    WHERE ST_DWithin(
        ST_Transform(r.geom, 3857), 
        ST_Transform(ST_SetSRID(ST_MakePoint(point_lng, point_lat), 4326), 3857), 
        distance_meters
    )
    ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Materialized view for road statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS road_statistics_mv AS
SELECT 
    highway,
    COUNT(*) as road_count,
    SUM(length_meters) as total_length_meters,
    AVG(length_meters) as avg_length_meters,
    AVG(lanes) as avg_lanes,
    COUNT(CASE WHEN bridge THEN 1 END) as bridge_count,
    COUNT(CASE WHEN tunnel THEN 1 END) as tunnel_count
FROM osm_roads
WHERE highway IS NOT NULL
GROUP BY highway;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_road_statistics_mv_highway ON road_statistics_mv (highway);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_osm_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW road_statistics_mv;
    RAISE NOTICE 'Refreshed OSM road statistics';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
