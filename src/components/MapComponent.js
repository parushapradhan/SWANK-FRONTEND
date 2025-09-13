import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
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
  const getRoadClassificationColor = (facType, surfType, highway) => {
    // Handle OSM highway types first
    if (highway) {
      switch (highway) {
        case 'motorway':
        case 'motorway_link':
          return '#0066cc'; // Blue for interstates/motorways
        case 'trunk':
        case 'trunk_link':
          return '#00aa00'; // Green for US routes
        case 'primary':
        case 'primary_link':
          return '#ffaa00'; // Orange for state routes
        case 'secondary':
        case 'secondary_link':
          return '#9966cc'; // Purple for county routes
        case 'tertiary':
        case 'tertiary_link':
          return '#ff6666'; // Red for local roads
        case 'residential':
        case 'unclassified':
          return '#888888'; // Gray for residential/unclassified
        default:
          return '#666666'; // Dark gray for unknown
      }
    }
    
    // Fallback to CSV facility type classification
    switch (facType) {
      case '1': // Interstate
        return '#0066cc'; // Blue
      case '2': // US Route
        return '#00aa00'; // Green
      case '3': // State Route
        return '#ffaa00'; // Orange
      case '4': // County Route
        return '#9966cc'; // Purple
      case '5': // Local Road
        return '#ff6666'; // Red
      default:
        // Fallback to surface type if facility type not available
        switch (surfType) {
          case '52': // Asphalt
            return '#00aa00'; // Green
          case '61': // Concrete
            return '#0066cc'; // Blue
          case '62': // Composite
            return '#ffaa00'; // Orange
          default:
            return '#888888'; // Gray for unknown
        }
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

        const color = getRoadClassificationColor(road.fac_type, road.surf_type, road.highway);
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
                <p><strong>Route:</strong> {road.traf_rt_no || road.ref || 'N/A'}</p>
                <p><strong>Facility Type:</strong> {getFacilityTypeName(road.fac_type) || road.highway || 'N/A'}</p>
                <p><strong>Surface Type:</strong> {getSurfaceTypeName(road.surf_type) || road.surface || 'N/A'}</p>
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

const HeatmapLayer = ({ heatmapData }) => {
  const map = useMap();

  useEffect(() => {
    if (heatmapData.length > 0) {
      const heatmapPoints = heatmapData.map(point => [
        point.y_value_bgn,
        point.x_value_bgn,
        point.value
      ]);

      const heatmapLayer = L.heatLayer(heatmapPoints, {
        radius: 20,
        blur: 15,
        maxZoom: 17,
        gradient: {
          0.0: 'blue',
          0.5: 'yellow',
          1.0: 'red'
        }
      });

      heatmapLayer.addTo(map);

      return () => {
        map.removeLayer(heatmapLayer);
      };
    }
  }, [heatmapData, map]);

  return null;
};

const MapComponent = () => {
  const { roads, heatmapData, loading } = useRoadData();
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [map, setMap] = useState(null);

  const toggleBackground = useCallback(() => {
    setShowBackground(!showBackground);
  }, [showBackground]);

  const searchLocation = useCallback(async (query) => {
    try {
      // Use OpenStreetMap Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=us`
      );
      const data = await response.json();
      
      if (data.length > 0 && map) {
        const { lat, lon } = data[0];
        map.setView([parseFloat(lat), parseFloat(lon)], 12);
      }
    } catch (error) {
      console.error('Error searching location:', error);
    }
  }, [map]);

  useEffect(() => {
    const handleToggleBackground = () => {
      toggleBackground();
    };

    const handleToggleHeatmap = (event) => {
      const { show } = event.detail;
      setShowHeatmap(show);
    };

    const handleSearchLocation = (event) => {
      const { query } = event.detail;
      searchLocation(query);
    };

    window.addEventListener('toggleBackground', handleToggleBackground);
    window.addEventListener('toggleHeatmap', handleToggleHeatmap);
    window.addEventListener('searchLocation', handleSearchLocation);
    
    return () => {
      window.removeEventListener('toggleBackground', handleToggleBackground);
      window.removeEventListener('toggleHeatmap', handleToggleHeatmap);
      window.removeEventListener('searchLocation', handleSearchLocation);
    };
  }, [map, searchLocation, toggleBackground]);

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
        whenCreated={setMap}
      >
        {showBackground && (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© OpenStreetMap contributors'
            opacity={0.3}
          />
        )}
        
        <RoadLayer roads={roads} />
        
        {showHeatmap && <HeatmapLayer heatmapData={heatmapData} />}
      </MapContainer>

      <Legend>
        <h4>Pennsylvania Road Classification</h4>
        <LegendItem>
          <LegendColor style={{ background: '#0066cc' }} />
          <span>Motorway/Interstate</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#00aa00' }} />
          <span>Trunk/US Route</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#ffaa00' }} />
          <span>Primary/State Route</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#9966cc' }} />
          <span>Secondary/County Route</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#ff6666' }} />
          <span>Tertiary/Local Road</span>
        </LegendItem>
        <LegendItem>
          <LegendColor style={{ background: '#888888' }} />
          <span>Residential/Unclassified</span>
        </LegendItem>
      </Legend>
    </MapWrapper>
  );
};

export default MapComponent;
