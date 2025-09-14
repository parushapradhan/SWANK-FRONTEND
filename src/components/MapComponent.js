import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import 'leaflet-control-geocoder';
import { useRoadData } from '../context/RoadDataContext';
import styled from 'styled-components';

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const MapWrapper = styled.div`
  height: 100%;
  width: 100%;
  position: relative;
`;

const Legend = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  z-index: 1000;
  min-width: 200px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
`;

const LegendColor = styled.div`
  width: 20px;
  height: 20px;
  margin-right: 10px;
  border-radius: 3px;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  font-size: 18px;
  color: #333;
`;

const RoadLayer = ({ roads }) => {
  const getPavementTypeColor = (surfType, surface) => {
    // Handle OSM surface types first
    if (surface) {
      switch (surface.toLowerCase()) {
        case 'asphalt':
        case 'paved':
          return '#2E8B57'; // Sea Green for asphalt
        case 'concrete':
          return '#708090'; // Slate Gray for concrete
        case 'gravel':
        case 'unpaved':
          return '#CD853F'; // Peru for gravel/unpaved
        case 'dirt':
          return '#8B4513'; // Saddle Brown for dirt
        case 'paving_stones':
        case 'cobblestone':
          return '#A0522D'; // Sienna for stone
        case 'grass':
          return '#228B22'; // Forest Green for grass
        default:
          return '#696969'; // Dim Gray for unknown
      }
    }
    
    // Fallback to CSV surface type classification
    switch (surfType) {
      case '52': // Asphalt
        return '#2E8B57'; // Sea Green
      case '61': // Concrete
        return '#708090'; // Slate Gray
      case '62': // Composite
        return '#FF6347'; // Tomato
      case '63': // Gravel
        return '#CD853F'; // Peru
      case '64': // Dirt
        return '#8B4513'; // Saddle Brown
      default:
        return '#696969'; // Dim Gray for unknown
    }
  };

  const getRoadWeight = (facType, laneCnt, highway, lanes) => {
    // Handle OSM highway types first
    if (highway) {
      const laneCount = lanes || laneCnt || 1;
      switch (highway) {
        case 'motorway':
        case 'motorway_link':
          return Math.max(4, laneCount * 0.8); // Thickest for interstates
        case 'trunk':
        case 'trunk_link':
          return Math.max(3.5, laneCount * 0.7); // Thick for US routes
        case 'primary':
        case 'primary_link':
          return Math.max(3, laneCount * 0.6); // Medium-thick for state routes
        case 'secondary':
        case 'secondary_link':
          return Math.max(2.5, laneCount * 0.5); // Medium for county routes
        case 'tertiary':
        case 'tertiary_link':
          return Math.max(2, laneCount * 0.4); // Thin for local roads
        case 'residential':
        case 'unclassified':
          return Math.max(1.5, laneCount * 0.3); // Thinnest for residential
        default:
          return Math.max(1, laneCount * 0.2);
      }
    }
    
    // Fallback to CSV facility type classification
    switch (facType) {
      case '1': // Interstate
        return Math.max(3, laneCnt * 0.8);
      case '2': // US Route
        return Math.max(2.5, laneCnt * 0.7);
      case '3': // State Route
        return Math.max(2, laneCnt * 0.6);
      case '4': // County Route
        return Math.max(1.5, laneCnt * 0.5);
      case '5': // Local Road
        return Math.max(1, laneCnt * 0.4);
      default:
        return Math.max(1, laneCnt * 0.3);
    }
  };

  return (
    <>
      {roads.map((road, index) => {
        if (!road.x_value_bgn || !road.y_value_bgn || !road.x_value_end || !road.y_value_end) {
          return null;
        }

        const color = getPavementTypeColor(road.surf_type, road.surface);
        const weight = getRoadWeight(road.fac_type, road.lane_cnt, road.highway, road.lanes);

        return (
          <Polyline
            key={index}
            positions={[
              [road.y_value_bgn, road.x_value_bgn],
              [road.y_value_end, road.x_value_end]
            ]}
            color={color}
            weight={weight}
            opacity={0.9}
            lineCap="round"
            lineJoin="round"
          >
            <Popup>
              <div>
                <h3>{road.street_name || road.name || 'Unnamed Road'}</h3>
                <p><strong>Surface Type:</strong> {getSurfaceTypeName(road.surf_type) || road.surface || 'N/A'}</p>
                <p><strong>Route:</strong> {road.traf_rt_no || road.ref || 'N/A'}</p>
                <p><strong>Facility Type:</strong> {getFacilityTypeName(road.fac_type) || road.highway || 'N/A'}</p>
                <p><strong>Condition Index:</strong> {road.rough_indx || 'N/A'}</p>
                <p><strong>Traffic (AADT):</strong> {road.cur_aadt || 'N/A'}</p>
                <p><strong>Length:</strong> {
                  road.segment_miles ? 
                    (typeof road.segment_miles === 'number' ? road.segment_miles.toFixed(2) : road.segment_miles) + ' miles' :
                  road.length_meters ? 
                    (typeof road.length_meters === 'number' ? (road.length_meters * 0.000621371).toFixed(2) : road.length_meters) + ' miles' :
                  'N/A'
                }</p>
                <p><strong>Lanes:</strong> {road.lane_cnt || road.lanes || 'N/A'}</p>
                <p><strong>District:</strong> {road.district_no || road.county || 'N/A'}</p>
                {road.state && <p><strong>State:</strong> {road.state}</p>}
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </>
  );
};

// Helper functions for display names
const getFacilityTypeName = (facType) => {
  const types = {
    '1': 'Interstate',
    '2': 'US Route',
    '3': 'State Route',
    '4': 'County Route',
    '5': 'Local Road'
  };
  return types[facType] || 'Unknown';
};

const getSurfaceTypeName = (surfType) => {
  const types = {
    '52': 'Asphalt',
    '61': 'Concrete',
    '62': 'Composite',
    '63': 'Gravel',
    '64': 'Dirt'
  };
  return types[surfType] || 'Unknown';
};


// Geocoder Control Component
const GeocoderControl = () => {
  const map = useMap();

  useEffect(() => {
    const geocoder = new L.Control.Geocoder({
      geocoder: L.Control.Geocoder.nominatim({
        geocodingQueryParams: {
          countrycodes: 'us',
          limit: 5
        }
      }),
      position: 'topright',
      placeholder: 'Search location...',
      errorMessage: 'Nothing found.'
    });

    geocoder.addTo(map);

    // Handle geocoding results
    geocoder.on('markgeocode', (e) => {
      const { center, name } = e.geocode;
      console.log('Geocoded location:', name, 'at', center);
      
      // Add a marker for the searched location
      const marker = L.marker(center).addTo(map);
      marker.bindPopup(`<b>Searched Location:</b><br/>${name}`).openPopup();
      
      // Center and zoom to the location
      map.setView(center, 12);
      
      // Remove marker after 5 seconds
      setTimeout(() => {
        map.removeLayer(marker);
      }, 5000);
    });

    return () => {
      map.removeControl(geocoder);
    };
  }, [map]);

  return null;
};

const MapComponent = () => {
  const { roads, loading } = useRoadData();

  return (
    <MapWrapper>
      {loading && <LoadingOverlay>Loading road data...</LoadingOverlay>}
      
      <MapContainer
        center={[40.5, -77.5]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap contributors'
          opacity={0.3}
        />
        
        <GeocoderControl />
        <RoadLayer roads={roads} />
      </MapContainer>

      <Legend>
        <h4>Pavement Types</h4>
        <LegendItem>
          <LegendColor style={{ background: '#2E8B57' }} />
          <span>Asphalt/Paved</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#708090' }} />
          <span>Concrete</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#FF6347' }} />
          <span>Composite</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#CD853F' }} />
          <span>Gravel/Unpaved</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#8B4513' }} />
          <span>Dirt</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#A0522D' }} />
          <span>Stone/Cobblestone</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#696969' }} />
          <span>Unknown/Other</span>
        </LegendItem>
      </Legend>
    </MapWrapper>
  );
};

export default MapComponent;
