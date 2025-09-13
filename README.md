# Road Classification Dashboard

A dynamic React-based dashboard for visualizing road classifications, conditions, and traffic patterns with interactive maps and heat map analysis.

## Features

- 🗺️ **Interactive Map Visualization** - Color-coded road segments by condition
- 🔥 **Heat Map Analysis** - Multiple analysis types (condition, traffic, age)
- 📊 **Real-time Statistics** - Live updates of road network metrics
- 🔍 **Advanced Filtering** - Filter by facility type, surface, district, etc.
- 📁 **CSV Upload** - Dynamic data updates through web interface
- 📱 **Responsive Design** - Works on all device sizes
- ⚡ **Real-time Updates** - Monitors CSV file changes automatically

## Technology Stack

- **Frontend**: React 18, Styled Components, React Leaflet
- **Backend**: Node.js, Express, SQLite
- **Maps**: Leaflet with OpenStreetMap tiles
- **Data**: CSV processing with automatic database import

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Install backend dependencies:**
```bash
npm install express csv-parser sqlite3 cors multer chokidar
```

3. **Start the backend server:**
```bash
npm run server
```

4. **Start the React development server:**
```bash
npm start
```

5. **Access the dashboard:**
Open `http://localhost:3000` in your browser

## Project Structure

```
SwankFrontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── MapComponent.js
│   │   ├── Sidebar.js
│   │   ├── Header.js
│   │   ├── StatisticsCards.js
│   │   └── FilterControls.js
│   ├── context/
│   │   └── RoadDataContext.js
│   ├── App.js
│   ├── App.css
│   └── index.js
├── server.js
├── package.json
└── RMSSEG_(State_Roads).csv
```

## Usage

### Map Visualization
- Roads are color-coded by condition:
  - 🔵 Blue: Excellent condition
  - 🟢 Green: Good condition
  - 🟡 Yellow: Fair condition
  - 🔴 Red: Poor condition

### Heat Map Analysis
- **Road Condition**: Shows areas with poor road conditions
- **Traffic Volume**: Displays high-traffic areas
- **Road Age**: Highlights older road segments

### Filtering
- Filter by facility type, surface type, district, or urban/rural classification
- Adjust condition range to focus on specific road conditions
- Real-time updates as you change filters

### Data Management
- Upload new CSV files to update the database
- Automatic data reloading when CSV files change
- Refresh data manually if needed

## API Endpoints

- `GET /api/roads` - Get road segments with optional filtering
- `GET /api/statistics` - Get road network statistics
- `GET /api/heatmap` - Get heat map data for visualization
- `POST /api/upload` - Upload new CSV file

## Data Format

The dashboard expects CSV files with the following key columns:
- `OBJECTID` - Unique identifier
- `X_VALUE_BGN`, `Y_VALUE_BGN` - Start coordinates
- `X_VALUE_END`, `Y_VALUE_END` - End coordinates
- `FAC_TYPE` - Facility type
- `SURF_TYPE` - Surface type
- `ROUGH_INDX` - Condition index
- `CUR_AADT` - Traffic volume
- `STREET_NAME` - Road name
- `DISTRICT_NO` - District number

## Development

### Running in Development Mode
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm start
```

### Building for Production
```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
