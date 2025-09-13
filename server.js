const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const chokidar = require('chokidar');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'road_dashboard',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
};

const pool = new Pool(dbConfig);

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

// CSV processing function
function processCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        const cleanData = {
          objectid: parseInt(data.OBJECTID) || null,
          st_rt_no: data.ST_RT_NO || '',
          cty_code: data.CTY_CODE || '',
          district_no: data.DISTRICT_NO || '',
          seg_no: data.SEG_NO || '',
          seg_lngth_feet: parseFloat(data.SEG_LNGTH_FEET) || 0,
          fac_type: data.FAC_TYPE || '',
          surf_type: data.SURF_TYPE || '',
          lane_cnt: parseInt(data.LANE_CNT) || 0,
          total_width: parseFloat(data.TOTAL_WIDTH) || 0,
          rough_indx: parseFloat(data.ROUGH_INDX) || 0,
          frictn_coeff: parseFloat(data.FRICTN_COEFF) || 0,
          pvmnt_cond_rate: data.PVMNT_COND_RATE || '',
          cur_aadt: parseInt(data.CUR_AADT) || 0,
          street_name: data.STREET_NAME || '',
          traf_rt_no: data.TRAF_RT_NO || '',
          x_value_bgn: parseFloat(data.X_VALUE_BGN) || 0,
          y_value_bgn: parseFloat(data.Y_VALUE_BGN) || 0,
          x_value_end: parseFloat(data.X_VALUE_END) || 0,
          y_value_end: parseFloat(data.Y_VALUE_END) || 0,
          segment_miles: parseFloat(data.SEGMENT_MILES) || 0,
          lane_miles: parseFloat(data.LANE_MILES) || 0,
          iri_rating_text: data.IRI_RATING_TEXT || '',
          opi_rating_text: data.OPI_RATING_TEXT || '',
          surface_year: parseInt(data.SURFACE_YEAR) || 0,
          urban_rural: data.URBAN_RURAL || '',
          nhs_ind: data.NHS_IND || ''
        };
        
        if (cleanData.x_value_bgn && cleanData.y_value_bgn) {
          results.push(cleanData);
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', reject);
  });
}

// Load initial CSV data
async function loadCSVData() {
  try {
    const csvPath = './RMSSEG_(State_Roads).csv';
    if (fs.existsSync(csvPath)) {
      console.log('Loading CSV data...');
      const data = await processCSV(csvPath);
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Clear existing data
        await client.query('DELETE FROM road_segments');
        
        // Insert new data
        const insertQuery = `
          INSERT INTO road_segments (
            objectid, st_rt_no, cty_code, district_no, seg_no, seg_lngth_feet,
            fac_type, surf_type, lane_cnt, total_width, rough_indx, frictn_coeff,
            pvmnt_cond_rate, cur_aadt, street_name, traf_rt_no, 
            start_point, end_point,
            segment_miles, lane_miles, iri_rating_text, opi_rating_text, 
            surface_year, urban_rural, nhs_ind
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            ST_SetSRID(ST_MakePoint($17, $18), 4326),
            ST_SetSRID(ST_MakePoint($19, $20), 4326),
            $21, $22, $23, $24, $25, $26, $27
          )
        `;
        
        const batchSize = 1000;
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          
          for (const row of batch) {
            await client.query(insertQuery, [
              row.objectid, row.st_rt_no, row.cty_code, row.district_no, row.seg_no,
              row.seg_lngth_feet, row.fac_type, row.surf_type, row.lane_cnt, row.total_width,
              row.rough_indx, row.frictn_coeff, row.pvmnt_cond_rate, row.cur_aadt,
              row.street_name, row.traf_rt_no,
              row.x_value_bgn, row.y_value_bgn, row.x_value_end, row.y_value_end,
              row.segment_miles, row.lane_miles, row.iri_rating_text, row.opi_rating_text,
              row.surface_year, row.urban_rural, row.nhs_ind
            ]);
          }
          
          console.log(`Processed ${Math.min(i + batchSize, data.length)} of ${data.length} records`);
        }
        
        await client.query('COMMIT');
        console.log(`Loaded ${data.length} road segments into database`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error('Error loading CSV data:', error);
  }
}

// Watch for CSV file changes
chokidar.watch('./RMSSEG_(State_Roads).csv').on('change', () => {
  console.log('CSV file changed, reloading data...');
  loadCSVData();
});

// API Routes
app.get('/api/roads', async (req, res) => {
  const { 
    fac_type, 
    surf_type, 
    district_no, 
    urban_rural,
    min_condition,
    max_condition,
    limit = 10000,
    offset = 0
  } = req.query;
  
  let query = `
    SELECT 
      id, objectid, st_rt_no, cty_code, district_no, seg_no, seg_lngth_feet,
      fac_type, surf_type, lane_cnt, total_width, rough_indx, frictn_coeff,
      pvmnt_cond_rate, cur_aadt, street_name, traf_rt_no,
      ST_X(start_point) as x_value_bgn, ST_Y(start_point) as y_value_bgn,
      ST_X(end_point) as x_value_end, ST_Y(end_point) as y_value_end,
      segment_miles, lane_miles, iri_rating_text, opi_rating_text,
      surface_year, urban_rural, nhs_ind
    FROM road_segments 
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 0;
  
  if (fac_type) {
    query += ` AND fac_type = $${++paramCount}`;
    params.push(fac_type);
  }
  
  if (surf_type) {
    query += ` AND surf_type = $${++paramCount}`;
    params.push(surf_type);
  }
  
  if (district_no) {
    query += ` AND district_no = $${++paramCount}`;
    params.push(district_no);
  }
  
  if (urban_rural) {
    query += ` AND urban_rural = $${++paramCount}`;
    params.push(urban_rural);
  }
  
  if (min_condition) {
    query += ` AND rough_indx >= $${++paramCount}`;
    params.push(min_condition);
  }
  
  if (max_condition) {
    query += ` AND rough_indx <= $${++paramCount}`;
    params.push(max_condition);
  }
  
  query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
  params.push(parseInt(limit), parseInt(offset));
  
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching roads:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/statistics', async (req, res) => {
  try {
    const queries = {
      total_segments: 'SELECT COUNT(*) as count FROM road_segments',
      total_miles: 'SELECT SUM(segment_miles) as total FROM road_segments',
      by_fac_type: 'SELECT fac_type, COUNT(*) as count FROM road_segments GROUP BY fac_type',
      by_surf_type: 'SELECT surf_type, COUNT(*) as count FROM road_segments GROUP BY surf_type',
      by_condition: 'SELECT iri_rating_text, COUNT(*) as count FROM road_segments WHERE iri_rating_text != \'\' GROUP BY iri_rating_text',
      by_district: 'SELECT district_no, COUNT(*) as count FROM road_segments GROUP BY district_no'
    };
    
    const results = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await pool.query(query);
        results[key] = result.rows;
      } catch (error) {
        console.error(`Error in ${key}:`, error);
        results[key] = [];
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get OSM roads data
app.get('/api/osm-roads', async (req, res) => {
  const { 
    highway, 
    state = 'PA',
    limit = 10000,
    offset = 0
  } = req.query;
  
  let query = `
    SELECT 
      id, osm_id, name, highway, surface, maxspeed, lanes, width,
      oneway, bridge, tunnel, access, ref, operator, network,
      state, county, city, length_meters,
      ST_X(ST_StartPoint(geom)) as x_value_bgn, ST_Y(ST_StartPoint(geom)) as y_value_bgn,
      ST_X(ST_EndPoint(geom)) as x_value_end, ST_Y(ST_EndPoint(geom)) as y_value_end,
      geom
    FROM osm_roads 
    WHERE state = $1
  `;
  const params = [state];
  let paramCount = 1;
  
  if (highway) {
    query += ` AND highway = $${++paramCount}`;
    params.push(highway);
  }
  
  query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
  params.push(parseInt(limit), parseInt(offset));
  
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching OSM roads:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/heatmap', async (req, res) => {
  const { type = 'condition', data_source = 'csv' } = req.query;
  
  let query;
  
  if (data_source === 'osm') {
    switch (type) {
      case 'condition':
        query = 'SELECT ST_X(ST_StartPoint(geom)) as x_value_bgn, ST_Y(ST_StartPoint(geom)) as y_value_bgn, length_meters as value FROM osm_roads WHERE length_meters > 0 AND state = \'PA\'';
        break;
      case 'traffic':
        query = 'SELECT ST_X(ST_StartPoint(geom)) as x_value_bgn, ST_Y(ST_StartPoint(geom)) as y_value_bgn, COALESCE(lanes, 1) as value FROM osm_roads WHERE state = \'PA\'';
        break;
      case 'age':
        query = 'SELECT ST_X(ST_StartPoint(geom)) as x_value_bgn, ST_Y(ST_StartPoint(geom)) as y_value_bgn, length_meters as value FROM osm_roads WHERE state = \'PA\'';
        break;
      default:
        query = 'SELECT ST_X(ST_StartPoint(geom)) as x_value_bgn, ST_Y(ST_StartPoint(geom)) as y_value_bgn, length_meters as value FROM osm_roads WHERE length_meters > 0 AND state = \'PA\'';
    }
  } else {
    switch (type) {
      case 'condition':
        query = 'SELECT ST_X(start_point) as x_value_bgn, ST_Y(start_point) as y_value_bgn, rough_indx as value FROM road_segments WHERE rough_indx > 0';
        break;
      case 'traffic':
        query = 'SELECT ST_X(start_point) as x_value_bgn, ST_Y(start_point) as y_value_bgn, cur_aadt as value FROM road_segments WHERE cur_aadt > 0';
        break;
      case 'age':
        query = 'SELECT ST_X(start_point) as x_value_bgn, ST_Y(start_point) as y_value_bgn, (EXTRACT(YEAR FROM CURRENT_DATE) - surface_year) as value FROM road_segments WHERE surface_year > 0';
        break;
      default:
        query = 'SELECT ST_X(start_point) as x_value_bgn, ST_Y(start_point) as y_value_bgn, rough_indx as value FROM road_segments WHERE rough_indx > 0';
    }
  }
  
  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload new CSV file
const upload = multer({ dest: 'uploads/' });

app.post('/api/upload', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const data = await processCSV(req.file.path);
    
    // Clear existing data
    db.run('DELETE FROM road_segments');
    
    // Insert new data
    const stmt = db.prepare(`
      INSERT INTO road_segments (
        objectid, st_rt_no, cty_code, district_no, seg_no, seg_lngth_feet,
        fac_type, surf_type, lane_cnt, total_width, rough_indx, frictn_coeff,
        pvmnt_cond_rate, cur_aadt, street_name, traf_rt_no, x_value_bgn,
        y_value_bgn, x_value_end, y_value_end, segment_miles, lane_miles,
        iri_rating_text, opi_rating_text, surface_year, urban_rural, nhs_ind
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    data.forEach(row => {
      stmt.run([
        row.objectid, row.st_rt_no, row.cty_code, row.district_no, row.seg_no,
        row.seg_lngth_feet, row.fac_type, row.surf_type, row.lane_cnt, row.total_width,
        row.rough_indx, row.frictn_coeff, row.pvmnt_cond_rate, row.cur_aadt,
        row.street_name, row.traf_rt_no, row.x_value_bgn, row.y_value_bgn,
        row.x_value_end, row.y_value_end, row.segment_miles, row.lane_miles,
        row.iri_rating_text, row.opi_rating_text, row.surface_year, row.urban_rural, row.nhs_ind
      ]);
    });
    
    stmt.finalize();
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ message: `Successfully loaded ${data.length} road segments` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize data on startup
loadCSVData();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
