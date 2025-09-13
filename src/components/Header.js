import React, { useState } from 'react';
import styled from 'styled-components';
import { useRoadData } from '../context/RoadDataContext';

const HeaderContainer = styled.div`
  background: white;
  padding: 15px 30px;
  border-bottom: 1px solid #ddd;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h1`
  color: #333;
  font-size: 24px;
  margin: 0;
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 15px;
  align-items: center;
`;

const SearchContainer = styled.div`
  position: relative;
`;

const SearchInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  width: 250px;
  outline: none;
  
  &:focus {
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const Button = styled.button`
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;

  &:hover {
    background: #0056b3;
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled(Button)`
  background: #6c757d;
  
  &:hover {
    background: #545b62;
  }
`;

const Header = () => {
  const { fetchHeatmapData, loading } = useRoadData();
  const [searchQuery, setSearchQuery] = useState('');
  const [heatmapType, setHeatmapType] = useState('condition');
  const [showHeatmap, setShowHeatmap] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Dispatch custom event for map to handle search
      const event = new CustomEvent('searchLocation', { 
        detail: { query: searchQuery.trim() } 
      });
      window.dispatchEvent(event);
    }
  };

  const handleHeatmapToggle = async () => {
    if (!showHeatmap) {
      await fetchHeatmapData(heatmapType);
    }
    setShowHeatmap(!showHeatmap);
    
    // Dispatch custom event for map to handle heatmap toggle
    const event = new CustomEvent('toggleHeatmap', { 
      detail: { show: !showHeatmap, type: heatmapType } 
    });
    window.dispatchEvent(event);
  };

  const handleBackgroundToggle = () => {
    const event = new CustomEvent('toggleBackground');
    window.dispatchEvent(event);
  };

  return (
    <HeaderContainer>
      <Title>Road Classification Dashboard</Title>
      
      <ControlsContainer>
        <SearchContainer>
          <form onSubmit={handleSearch}>
            <SearchInput
              type="text"
              placeholder="Search location (e.g., Philadelphia, Pittsburgh)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
        </SearchContainer>
        
        <select 
          value={heatmapType} 
          onChange={(e) => setHeatmapType(e.target.value)}
          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
        >
          <option value="condition">Road Condition</option>
          <option value="traffic">Traffic Volume</option>
          <option value="age">Road Age</option>
        </select>
        
        <Button 
          onClick={handleHeatmapToggle}
          disabled={loading}
        >
          {showHeatmap ? 'Hide Heat Map' : 'Show Heat Map'}
        </Button>
        
        <SecondaryButton onClick={handleBackgroundToggle}>
          Toggle Background
        </SecondaryButton>
      </ControlsContainer>
    </HeaderContainer>
  );
};

export default Header;
