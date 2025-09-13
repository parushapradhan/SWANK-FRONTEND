-- PostgreSQL Database Setup for Road Classification Dashboard
-- This script creates the database, extensions, and schema

-- Create database (run this as superuser)
-- CREATE DATABASE road_dashboard;

-- Connect to the road_dashboard database
-- \c road_dashboard;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create road_segments table with spatial data
CREATE TABLE IF NOT EXISTS road_segments (
    id SERIAL PRIMARY KEY,
    objectid INTEGER,
    st_rt_no VARCHAR(10),
    cty_code VARCHAR(5),
    district_no VARCHAR(5),
    seg_no VARCHAR(10),
    seg_lngth_feet DECIMAL(10,2),
    fac_type VARCHAR(5),
    surf_type VARCHAR(5),
    lane_cnt INTEGER,
    total_width DECIMAL(8,2),
    rough_indx DECIMAL(8,2),
    frictn_coeff DECIMAL(8,2),
    pvmnt_cond_rate VARCHAR(10),
    cur_aadt INTEGER,
    street_name VARCHAR(255),
    traf_rt_no VARCHAR(20),
    
    -- Spatial columns
    start_point GEOMETRY(POINT, 4326),
    end_point GEOMETRY(POINT, 4326),
    road_line GEOMETRY(LINESTRING, 4326),
    
    -- Additional attributes
    segment_miles DECIMAL(10,4),
    lane_miles DECIMAL(10,4),
    iri_rating_text VARCHAR(20),
    opi_rating_text VARCHAR(20),
    surface_year INTEGER,
    urban_rural VARCHAR(5),
    nhs_ind VARCHAR(5),
    
    -- HStore for flexible attributes
    additional_attrs HSTORE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_road_segments_start_point ON road_segments USING GIST (start_point);
CREATE INDEX IF NOT EXISTS idx_road_segments_end_point ON road_segments USING GIST (end_point);
CREATE INDEX IF NOT EXISTS idx_road_segments_road_line ON road_segments USING GIST (road_line);

-- Create other useful indexes
CREATE INDEX IF NOT EXISTS idx_road_segments_fac_type ON road_segments (fac_type);
CREATE INDEX IF NOT EXISTS idx_road_segments_surf_type ON road_segments (surf_type);
CREATE INDEX IF NOT EXISTS idx_road_segments_district ON road_segments (district_no);
CREATE INDEX IF NOT EXISTS idx_road_segments_condition ON road_segments (rough_indx);
CREATE INDEX IF NOT EXISTS idx_road_segments_traffic ON road_segments (cur_aadt);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_road_segments_updated_at 
    BEFORE UPDATE ON road_segments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a function to generate road line geometry from start and end points
CREATE OR REPLACE FUNCTION generate_road_line()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate road line from start and end points
    IF NEW.start_point IS NOT NULL AND NEW.end_point IS NOT NULL THEN
        NEW.road_line = ST_MakeLine(NEW.start_point, NEW.end_point);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically generate road line geometry
CREATE TRIGGER generate_road_line_trigger
    BEFORE INSERT OR UPDATE ON road_segments
    FOR EACH ROW EXECUTE FUNCTION generate_road_line();

-- Create a materialized view for road statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS road_statistics AS
SELECT 
    fac_type,
    COUNT(*) as segment_count,
    SUM(segment_miles) as total_miles,
    AVG(rough_indx) as avg_condition,
    AVG(cur_aadt) as avg_traffic,
    MIN(rough_indx) as min_condition,
    MAX(rough_indx) as max_condition
FROM road_segments
WHERE fac_type IS NOT NULL
GROUP BY fac_type;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_road_statistics_fac_type ON road_statistics (fac_type);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_road_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW road_statistics;
END;
$$ language 'plpgsql';

-- Create a spatial view for heatmap data
CREATE OR REPLACE VIEW heatmap_data AS
SELECT 
    id,
    ST_X(start_point) as longitude,
    ST_Y(start_point) as latitude,
    rough_indx as condition_value,
    cur_aadt as traffic_value,
    (EXTRACT(YEAR FROM CURRENT_DATE) - surface_year) as age_value
FROM road_segments
WHERE start_point IS NOT NULL;

-- Create a function to get roads within a bounding box
CREATE OR REPLACE FUNCTION get_roads_in_bounds(
    min_lat DECIMAL,
    min_lng DECIMAL,
    max_lat DECIMAL,
    max_lng DECIMAL
)
RETURNS TABLE (
    id INTEGER,
    objectid INTEGER,
    street_name VARCHAR,
    traf_rt_no VARCHAR,
    fac_type VARCHAR,
    surf_type VARCHAR,
    rough_indx DECIMAL,
    cur_aadt INTEGER,
    segment_miles DECIMAL,
    lane_cnt INTEGER,
    district_no VARCHAR,
    road_line GEOMETRY
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rs.id,
        rs.objectid,
        rs.street_name,
        rs.traf_rt_no,
        rs.fac_type,
        rs.surf_type,
        rs.rough_indx,
        rs.cur_aadt,
        rs.segment_miles,
        rs.lane_cnt,
        rs.district_no,
        rs.road_line
    FROM road_segments rs
    WHERE rs.start_point && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
       OR rs.end_point && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
END;
$$ LANGUAGE plpgsql;

-- Create a function to search roads by name
CREATE OR REPLACE FUNCTION search_roads_by_name(search_term VARCHAR)
RETURNS TABLE (
    id INTEGER,
    street_name VARCHAR,
    traf_rt_no VARCHAR,
    fac_type VARCHAR,
    district_no VARCHAR,
    distance DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rs.id,
        rs.street_name,
        rs.traf_rt_no,
        rs.fac_type,
        rs.district_no,
        ST_Distance(rs.start_point, ST_SetSRID(ST_MakePoint(-77.0, 39.5), 4326)) as distance
    FROM road_segments rs
    WHERE rs.street_name ILIKE '%' || search_term || '%'
       OR rs.traf_rt_no ILIKE '%' || search_term || '%'
    ORDER BY distance
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data (optional - for testing)
-- INSERT INTO road_segments (
--     objectid, st_rt_no, fac_type, surf_type, lane_cnt, 
--     start_point, end_point, street_name, traf_rt_no,
--     segment_miles, rough_indx, cur_aadt, district_no
-- ) VALUES (
--     1, '0194', '2', '52', 2,
--     ST_SetSRID(ST_MakePoint(-77.12242, 39.72012), 4326),
--     ST_SetSRID(ST_MakePoint(-77.1188, 39.72564), 4326),
--     'FREDERICK PK', 'PA 194',
--     0.4589, 103, 5229, '08'
-- );

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON DATABASE road_dashboard TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
