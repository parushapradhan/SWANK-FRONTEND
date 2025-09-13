import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const RoadDataContext = createContext();

export const useRoadData = () => {
  const context = useContext(RoadDataContext);
  if (!context) {
    throw new Error('useRoadData must be used within a RoadDataProvider');
  }
  return context;
};

export const RoadDataProvider = ({ children }) => {
  const [roads, setRoads] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRoads = async () => {
    setLoading(true);
    try {
      // Fetch OSM data by default (Pennsylvania roads)
      const response = await axios.get('/api/osm-roads?state=PA&limit=10000');
      setRoads(response.data);
    } catch (error) {
      console.error('Error fetching roads:', error);
      // Fallback to CSV data if OSM fails
      try {
        const fallbackResponse = await axios.get('/api/roads?limit=10000');
        setRoads(fallbackResponse.data);
      } catch (fallbackError) {
        console.error('Error fetching fallback roads:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchHeatmapData = async (type = 'condition') => {
    try {
      // Use OSM data for heatmap by default
      const response = await axios.get(`/api/heatmap?data_source=osm&type=${type}`);
      setHeatmapData(response.data);
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      // Fallback to CSV data
      try {
        const fallbackResponse = await axios.get(`/api/heatmap?type=${type}`);
        setHeatmapData(fallbackResponse.data);
      } catch (fallbackError) {
        console.error('Error fetching fallback heatmap data:', fallbackError);
      }
    }
  };

  useEffect(() => {
    fetchRoads();
  }, []);

  const value = {
    roads,
    heatmapData,
    loading,
    fetchRoads,
    fetchHeatmapData
  };

  return (
    <RoadDataContext.Provider value={value}>
      {children}
    </RoadDataContext.Provider>
  );
};
