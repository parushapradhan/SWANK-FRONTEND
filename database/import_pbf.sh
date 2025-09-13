#!/bin/bash

# PBF Import Script for Road Classification Dashboard
# This script imports PBF files into PostgreSQL using osm2pgsql

set -e

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-road_dashboard}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}
PBF_FILE=${1:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PBF file is provided
if [ -z "$PBF_FILE" ]; then
    print_error "Usage: $0 <path_to_pbf_file>"
    print_error "Example: $0 data/pennsylvania-latest.osm.pbf"
    exit 1
fi

# Check if PBF file exists
if [ ! -f "$PBF_FILE" ]; then
    print_error "PBF file not found: $PBF_FILE"
    exit 1
fi

# Check if osm2pgsql is installed
if ! command -v osm2pgsql &> /dev/null; then
    print_error "osm2pgsql is not installed. Please install it first:"
    print_error "Ubuntu/Debian: sudo apt install osm2pgsql"
    print_error "macOS: brew install osm2pgsql"
    print_error "Windows: Download from https://osm2pgsql.org/"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME &> /dev/null; then
    print_error "Cannot connect to PostgreSQL database"
    print_error "Please ensure PostgreSQL is running and accessible"
    exit 1
fi

print_status "Starting PBF import process..."
print_status "Database: $DB_NAME@$DB_HOST:$DB_PORT"
print_status "PBF File: $PBF_FILE"

# Create custom style file for road-focused import
cat > osm2pgsql_road_style.lua << 'EOF'
-- Custom osm2pgsql style for road classification dashboard
-- This style focuses on road-related data

-- Node styles
local node_keys = {
    'highway',
    'junction',
    'traffic_signals',
    'stop',
    'give_way',
    'mini_roundabout',
    'turning_circle',
    'crossing',
    'name',
    'ref'
}

-- Way styles
local way_keys = {
    'highway',
    'surface',
    'maxspeed',
    'lanes',
    'width',
    'oneway',
    'bridge',
    'tunnel',
    'access',
    'ref',
    'operator',
    'network',
    'name',
    'boundary',
    'admin_level',
    'place',
    'population'
}

-- Relation styles
local relation_keys = {
    'boundary',
    'admin_level',
    'place',
    'population',
    'name',
    'type'
}

-- Function to check if a key should be included
function should_include_key(key, keys_list)
    for _, k in ipairs(keys_list) do
        if key == k then
            return true
        end
    end
    return false
end

-- Process nodes
function node_function(node)
    local tags = {}
    local include_node = false
    
    for k, v in pairs(node.tags) do
        if should_include_key(k, node_keys) then
            tags[k] = v
            include_node = true
        end
    end
    
    if include_node then
        return {
            tags = tags
        }
    end
end

-- Process ways
function way_function(way)
    local tags = {}
    local include_way = false
    
    for k, v in pairs(way.tags) do
        if should_include_key(k, way_keys) then
            tags[k] = v
            include_way = true
        end
    end
    
    if include_way then
        return {
            tags = tags
        }
    end
end

-- Process relations
function relation_function(relation)
    local tags = {}
    local include_relation = false
    
    for k, v in pairs(relation.tags) do
        if should_include_key(k, relation_keys) then
            tags[k] = v
            include_relation = true
        end
    end
    
    if include_relation then
        return {
            tags = tags
        }
    end
end
EOF

# Set password environment variable
export PGPASSWORD=$DB_PASSWORD

# Create tables if they don't exist
print_status "Creating OSM tables..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f pbf_import.sql

# Import PBF file using osm2pgsql
print_status "Importing PBF file using osm2pgsql..."

osm2pgsql \
    --host $DB_HOST \
    --port $DB_PORT \
    --username $DB_USER \
    --database $DB_NAME \
    --create \
    --slim \
    --drop \
    --cache 2048 \
    --number-processes 4 \
    --style osm2pgsql_road_style.lua \
    --output-pgsql-schema public \
    --multi-geometry \
    --hstore \
    --hstore-all \
    --verbose \
    "$PBF_FILE"

if [ $? -eq 0 ]; then
    print_status "PBF import completed successfully!"
else
    print_error "PBF import failed!"
    exit 1
fi

# Extract roads from imported data
print_status "Extracting roads from OSM data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT extract_roads_from_ways();"

# Extract intersections
print_status "Extracting intersections..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT extract_intersections_from_nodes();"

# Extract administrative boundaries
print_status "Extracting administrative boundaries..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT extract_admin_boundaries_from_ways();"

# Refresh materialized views
print_status "Refreshing materialized views..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT refresh_osm_statistics();"

# Show statistics
print_status "Import completed! Here are the statistics:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT * FROM get_road_statistics();"

# Clean up
rm -f osm2pgsql_road_style.lua

print_status "PBF import process completed successfully!"
print_status "You can now use the OSM data in your road classification dashboard."
