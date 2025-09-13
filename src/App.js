import React from 'react';
import styled from 'styled-components';
import MapComponent from './components/MapComponent';
import Header from './components/Header';
import { RoadDataProvider } from './context/RoadDataContext';
import './App.css';

const AppContainer = styled.div`
  height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  display: flex;
  flex-direction: column;
`;

function App() {
  return (
    <RoadDataProvider>
      <AppContainer>
        <Header />
        <MapComponent />
      </AppContainer>
    </RoadDataProvider>
  );
}

export default App;
