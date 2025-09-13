# Step-by-Step Database Setup Instructions

## Prerequisites Check

First, let's check what you have installed:

```bash
# Check if PostgreSQL is installed
psql --version

# Check if Docker is installed (optional)
docker --version

# Check if osm2pgsql is installed
osm2pgsql --version
```

## Option 1: Docker Setup (Recommended - Easiest)

### Step 1: Install Docker
If you don't have Docker installed:

**macOS:**
```bash
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Or using Homebrew:
brew install --cask docker
```

**Windows:**
- Download Docker Desktop from https://www.docker.com/products/docker-desktop

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
```

### Step 2: Start PostgreSQL with PostGIS
```bash
# Navigate to your project directory
cd /Users/parusha/Documents/SwankFrontend

# Start the database
cd database
docker-compose up -d

# Check if it's running
docker ps
```

You should see containers for `postgres` and `pgadmin` running.

### Step 3: Access PgAdmin (Database Management Tool)
- Open your browser and go to: http://localhost:8080
- Login with:
  - Email: `admin@roaddashboard.com`
  - Password: `admin`

### Step 4: Connect to Database in PgAdmin
1. Right-click "Servers" → "Create" → "Server"
2. General tab:
   - Name: `Road Dashboard DB`
3. Connection tab:
   - Host: `postgres` (or `localhost` if accessing from outside Docker)
   - Port: `5432`
   - Database: `road_dashboard`
   - Username: `postgres`
   - Password: `password`
4. Click "Save"

## Option 2: Local PostgreSQL Installation

### Step 1: Install PostgreSQL with PostGIS

**macOS (using Homebrew):**
```bash
brew install postgresql postgis osm2pgsql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgis postgresql-15-postgis-3 osm2pgsql
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. During installation, make sure to install PostGIS extension
3. Download osm2pgsql from https://osm2pgsql.org/

### Step 2: Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE road_dashboard;

# Create user (optional)
CREATE USER roaduser WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE road_dashboard TO roaduser;

# Exit psql
\q
```

### Step 3: Enable Extensions
```bash
# Connect to your database
psql -U postgres -d road_dashboard

# Enable required extensions
CREATE EXTENSION postgis;
CREATE EXTENSION hstore;
CREATE EXTENSION "uuid-ossp";

# Exit psql
\q
```

## Step 4: Set Up Database Schema

### Create Tables and Functions
```bash
# Navigate to database directory
cd /Users/parusha/Documents/SwankFrontend/database

# Run the setup script
psql -U postgres -d road_dashboard -f setup.sql

# Run the PBF import schema
psql -U postgres -d road_dashboard -f pbf_import.sql
```

## Step 5: Install Backend Dependencies

```bash
# Navigate to project root
cd /Users/parusha/Documents/SwankFrontend

# Install Node.js dependencies
npm install
```

## Step 6: Import Your Data

### Import CSV Data (Your existing road data)
```bash
# Start the backend server (it will automatically import CSV data)
npm run server
```

The server will automatically:
1. Connect to PostgreSQL
2. Import your `RMSSEG_(State_Roads).csv` file
3. Create spatial geometries
4. Set up indexes

### Import PBF Data (Your us-osm.pbf file)

**Option A: Using the automated script**
```bash
# Make the script executable
chmod +x database/import_us_osm.sh

# Run the import (this will take a while for the full US dataset)
./database/import_us_osm.sh ../us-osm.pbf
```

**Option B: Manual import**
```bash
# Install osm2pgsql if not already installed
# macOS: brew install osm2pgsql
# Ubuntu: sudo apt install osm2pgsql

# Import the PBF file
osm2pgsql \
  --host localhost \
  --port 5432 \
  --username postgres \
  --database road_dashboard \
  --create \
  --slim \
  --drop \
  --cache 4096 \
  --number-processes 8 \
  --multi-geometry \
  --hstore \
  --hstore-all \
  --verbose \
  ../us-osm.pbf

# Extract roads from OSM data
psql -U postgres -d road_dashboard -c "SELECT extract_roads_from_ways();"

# Update Pennsylvania state field
psql -U postgres -d road_dashboard -c "
UPDATE osm_roads 
SET state = 'PA' 
WHERE ST_Intersects(geom, ST_MakeEnvelope(-80.5, 39.7, -74.7, 42.3, 4326));
"
```

## Step 7: Verify Installation

### Check Database Connection
```bash
# Test connection
psql -U postgres -d road_dashboard -c "SELECT version();"
psql -U postgres -d road_dashboard -c "SELECT PostGIS_Version();"
```

### Check Data Import
```bash
# Check CSV data
psql -U postgres -d road_dashboard -c "SELECT COUNT(*) FROM road_segments;"

# Check OSM data
psql -U postgres -d road_dashboard -c "SELECT COUNT(*) FROM osm_roads WHERE state = 'PA';"

# Check road statistics
psql -U postgres -d road_dashboard -c "SELECT * FROM get_road_statistics();"
```

## Step 8: Start the Application

### Start Backend Server
```bash
# In one terminal
npm run server
```

### Start Frontend (in another terminal)
```bash
# In another terminal
npm start
```

### Access the Dashboard
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PgAdmin: http://localhost:8080 (if using Docker)

## Troubleshooting

### Common Issues

#### 1. PostgreSQL Connection Error
```bash
# Check if PostgreSQL is running
# macOS: brew services list | grep postgresql
# Ubuntu: sudo systemctl status postgresql

# Start PostgreSQL if not running
# macOS: brew services start postgresql
# Ubuntu: sudo systemctl start postgresql
```

#### 2. Permission Denied
```bash
# Fix file permissions
chmod +x database/import_us_osm.sh
chmod +x database/import_pbf.sh
```

#### 3. osm2pgsql Not Found
```bash
# Install osm2pgsql
# macOS: brew install osm2pgsql
# Ubuntu: sudo apt install osm2pgsql
```

#### 4. Memory Issues During Import
```bash
# For large PBF files, reduce cache size
osm2pgsql --cache 2048 --number-processes 4 ../us-osm.pbf
```

#### 5. Database Connection Issues
```bash
# Check PostgreSQL configuration
sudo -u postgres psql -c "SHOW listen_addresses;"

# If using Docker, check container status
docker ps
docker logs road_dashboard_db
```

### Environment Variables
Create a `.env` file in your project root:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=road_dashboard
DB_USER=postgres
DB_PASSWORD=password
```

## Verification Checklist

- [ ] PostgreSQL is running
- [ ] PostGIS extension is enabled
- [ ] Database `road_dashboard` exists
- [ ] Tables are created (road_segments, osm_roads, etc.)
- [ ] CSV data is imported
- [ ] PBF data is imported (optional)
- [ ] Backend server starts without errors
- [ ] Frontend loads at http://localhost:3000
- [ ] Map displays road data
- [ ] Search functionality works
- [ ] Heat map toggle works

## Next Steps

Once everything is set up:

1. **Test the dashboard** - Navigate to http://localhost:3000
2. **Search for locations** - Try searching for "Philadelphia" or "Pittsburgh"
3. **Toggle heat maps** - Test different heat map types
4. **Explore the data** - Use PgAdmin to query the database
5. **Customize the visualization** - Modify colors and filters as needed

## Getting Help

If you encounter issues:

1. **Check the logs** - Look at terminal output for error messages
2. **Verify prerequisites** - Make sure all software is installed correctly
3. **Check database connection** - Ensure PostgreSQL is running and accessible
4. **Review the documentation** - Check `database/DATABASE_DOCUMENTATION.md` for detailed info

The setup process should take about 30-60 minutes depending on your system and the size of your PBF file. The US OSM PBF file is quite large, so the import may take several hours to complete.
