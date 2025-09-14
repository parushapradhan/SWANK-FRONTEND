import React from 'react';
import styled from 'styled-components';

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


const Header = () => {
  return (
    <HeaderContainer>
      <Title>Pavement Type Dashboard</Title>
      
      <ControlsContainer>
        <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
          Use the search control on the map to find locations
        </div>
      </ControlsContainer>
    </HeaderContainer>
  );
};

export default Header;
