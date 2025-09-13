const { Pool } = require('pg');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'road_dashboard',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
};

const pool = new Pool(dbConfig);

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
        
        if (cleanData.x_value_bgn && cleanData.y_value_bgn && cleanData.x_value_end && cleanData.y_value_end) {
          results.push(cleanData);
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', reject);
  });
}

// Insert data into PostgreSQL
async function insertRoadData(data) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Clear existing data
    await client.query('DELETE FROM road_segments');
    
    // Prepare insert statement
    const insertQuery = `
      INSERT INTO road_segments (
        objectid, st_rt_no, cty_code, district_no, seg_no, seg_lngth_feet,
        fac_type, surf_type, lane_cnt, total_width, rough_indx, frictn_coeff,
        pvmnt_cond_rate, cur_aadt, street_name, traf_rt_no, 
        start_point, end_point,
        segment_miles, lane_miles, iri_rating_text, opi_rating_text, 
        surface_year, urban_rural, nhs_ind, additional_attrs
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        ST_SetSRID(ST_MakePoint($17, $18), 4326),
        ST_SetSRID(ST_MakePoint($19, $20), 4326),
        $21, $22, $23, $24, $25, $26, $27, $28
      )
    `;
    
    // Insert data in batches
    const batchSize = 1000;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      for (const row of batch) {
        const values = [
          row.objectid, row.st_rt_no, row.cty_code, row.district_no, row.seg_no,
          row.seg_lngth_feet, row.fac_type, row.surf_type, row.lane_cnt, row.total_width,
          row.rough_indx, row.frictn_coeff, row.pvmnt_cond_rate, row.cur_aadt,
          row.street_name, row.traf_rt_no,
          row.x_value_bgn, row.y_value_bgn, row.x_value_end, row.y_value_end,
          row.segment_miles, row.lane_miles, row.iri_rating_text, row.opi_rating_text,
          row.surface_year, row.urban_rural, row.nhs_ind,
          // Additional attributes as HStore
          JSON.stringify({
            bike_lane: row.bike_lane || '',
            yr_built: row.yr_built || '',
            yr_resurf: row.yr_resurf || '',
            dir_ind: row.dir_ind || '',
            park_lane: row.park_lane || '',
            divsr_type: row.divsr_type || '',
            divsr_width: row.divsr_width || '',
            cond_date: row.cond_date || '',
            frictn_indx: row.frictn_indx || '',
            frictn_date: row.frictn_date || '',
            access_ctrl: row.access_ctrl || '',
            toll_code: row.toll_code || '',
            traf_rt_no_prefix: row.traf_rt_no_prefix || '',
            traf_rt_no_suf: row.traf_rt_no_suf || '',
            bgn_desc: row.bgn_desc || '',
            end_desc: row.end_desc || '',
            maint_respon_ind: row.maint_respon_ind || '',
            nhs_ind: row.nhs_ind || '',
            tandem_trlr_trk: row.tandem_trlr_trk || '',
            access_tandem_trlr: row.access_tandem_trlr || '',
            interst_netwrk_ind: row.interst_netwrk_ind || '',
            nhpn_ind: row.nhpn_ind || '',
            norm_admin_bgn: row.norm_admin_bgn || '',
            norm_traff_bgn: row.norm_traff_bgn || '',
            norm_shld_bgn: row.norm_shld_bgn || '',
            mapid: row.mapid || '',
            nlf_id: row.nlf_id || '',
            side_ind: row.side_ind || '',
            nlf_cntl_bgn: row.nlf_cntl_bgn || '',
            nlf_cntl_end: row.nlf_cntl_end || '',
            cum_offset_bgn_t1: row.cum_offset_bgn_t1 || '',
            cum_offset_end_t1: row.cum_offset_end_t1 || '',
            graphic_length: row.graphic_length || '',
            key_update: row.key_update || '',
            attr_update: row.attr_update || '',
            overall_pvmnt_idx: row.overall_pvmnt_idx || '',
            seg_status: row.seg_status || '',
            pavmt_cycle: row.pavmt_cycle || '',
            drain_cycle: row.drain_cycle || '',
            gdrail_cycle: row.gdrail_cycle || '',
            district_special: row.district_special || '',
            trt_type_netwrk: row.trt_type_netwrk || '',
            pa_byway_ind: row.pa_byway_ind || '',
            street_name2: row.street_name2 || '',
            traf_rt_no_prefix2: row.traf_rt_no_prefix2 || '',
            traf_rt_no2: row.traf_rt_no2 || '',
            traf_rt_no_suf2: row.traf_rt_no_suf2 || '',
            street_name3: row.street_name3 || '',
            traf_rt_no_prefix3: row.traf_rt_no_prefix3 || '',
            traf_rt_no3: row.traf_rt_no3 || '',
            traf_rt_no_suf3: row.traf_rt_no_suf3 || '',
            trxn_flag: row.trxn_flag || '',
            route_dir: row.route_dir || '',
            bus_plan_netwrk: row.bus_plan_netwrk || '',
            exp_way_netwrk: row.exp_way_netwrk || '',
            hpms_samp_cnt: row.hpms_samp_cnt || '',
            mile_point: row.mile_point || '',
            is_structure: row.is_structure || '',
            govt_lvl_ctrl: row.govt_lvl_ctrl || '',
            hov_type: row.hov_type || '',
            hov_lanes: row.hov_lanes || '',
            par_seg_ind: row.par_seg_ind || '',
            hpms_divsr_type: row.hpms_divsr_type || '',
            iri_cur_flag: row.iri_cur_flag || '',
            drain_swt: row.drain_swt || '',
            gdrail_swt: row.gdrail_swt || '',
            pavmt_swt: row.pavmt_swt || '',
            shld_cond_status: row.shld_cond_status || '',
            fed_aid_prim_ind: row.fed_aid_prim_ind || '',
            drain_cnt: row.drain_cnt || '',
            gdrail_cnt: row.gdrail_cnt || '',
            pvmnt_trtmt_data: row.pvmnt_trtmt_data || '',
            pvmnt_ind: row.pvmnt_ind || '',
            iri_year: row.iri_year || '',
            opi_year: row.opi_year || '',
            surface_year: row.surface_year || '',
            cycle_maint_section: row.cycle_maint_section || '',
            gis_update_date: row.gis_update_date || '',
            gis_geometry_update_date: row.gis_geometry_update_date || '',
            se_anno_cad_data: row.se_anno_cad_data || '',
            geometry: row.geometry || '',
            gpid: row.gpid || '',
            geometrylen: row.geometrylen || ''
          })
        ];
        
        await client.query(insertQuery, values);
      }
      
      console.log(`Processed ${Math.min(i + batchSize, data.length)} of ${data.length} records`);
    }
    
    await client.query('COMMIT');
    console.log(`Successfully inserted ${data.length} road segments`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Main migration function
async function migrateData() {
  try {
    console.log('Starting data migration...');
    
    // Check if CSV file exists
    const csvPath = path.join(__dirname, '..', 'RMSSEG_(State_Roads).csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at ${csvPath}`);
    }
    
    // Process CSV data
    console.log('Processing CSV data...');
    const data = await processCSV(csvPath);
    console.log(`Found ${data.length} valid road segments`);
    
    // Insert into PostgreSQL
    console.log('Inserting data into PostgreSQL...');
    await insertRoadData(data);
    
    // Refresh materialized view
    console.log('Refreshing materialized views...');
    const client = await pool.connect();
    await client.query('SELECT refresh_road_statistics()');
    client.release();
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateData();
}

module.exports = { migrateData, processCSV, insertRoadData };
