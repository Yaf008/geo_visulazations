import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';


// Check that Mapbox GL JS is loaded
console.log("Mapbox GL JS Loaded:", mapboxgl);


mapboxgl.accessToken = 'pk.eyJ1IjoieWFmMDA4IiwiYSI6ImNtN2sxZnp3eTBhdzIybHB4aG9ham1kNTAifQ.2KaXfmlELN30b4tiR51eHw';

// Initialize the map
const map = new mapboxgl.Map({
     container: 'map', // ID of the div where the map will render
     style: 'mapbox://styles/mapbox/streets-v12', // Map style
     center: [-71.09415, 42.36027], // [longitude, latitude]
     zoom: 12, // Initial zoom level
     minZoom: 5, // Minimum allowed zoom
     maxZoom: 18 // Maximum allowed zoom
});


//function
function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  
    const { x, y } = map.project(point);  
    return { cx: x, cy: y };  
}


//import data
map.on('load', async () => { 
    console.log('begin to add data');

    // Import bike lanes
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
    });

    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': '#32D400',
            'line-width': 5,
            'line-opacity': 0.6
        }
    });

    // Import Cambridge bike lanes
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': '#32D400',
            'line-width': 5,
            'line-opacity': 0.6
        }
    });

    // **Initialize empty stations array**
    let stations = [];

    try {
        // **Load station data (JSON)**
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
        const jsonData = await d3.json(jsonurl);
        stations = jsonData.data.stations;

        console.log('✅ Loaded JSON Data:', stations);
    } catch (error) {
        console.error('❌ Error loading JSON:', error);
    }

    try {
        // **Load traffic data (CSV)**
        const trafficUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
        const traData = await d3.csv(trafficUrl);
        console.log('✅ Loaded CSV Data:', traData);

        // **Compute departures**
        const departures = d3.rollup(
            traData,
            (v) => v.length,
            (d) => d.start_station_id
        );

        // **Compute arrivals**
        const arrivals = d3.rollup(
            traData,
            (v) => v.length,
            (d) => d.end_station_id
        );

        // **Update stations with traffic data**
        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        });

        console.log('🚲 Calculated site data:', stations);
    } catch (error) {
        console.log('❌ Error loading CSV:', error);
    }

    // **Check if stations data is available**
    if (!stations || stations.length === 0) {
        console.error('🚨 No station data found!');
        return;
    }

    // **Compute max traffic and create scale**
    const maxTraffic = stations.length > 0 ? d3.max(stations, d => d.totalTraffic) : 1;
    const radiusScale = d3
        .scaleSqrt()
        .domain([0, maxTraffic])
        .range([2, 25]);  // **确保最小半径不为 0**

    // **Add station markers**
    const svg = d3.select('#map').select('svg');

    const circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', d => radiusScale(d.totalTraffic))  // **Apply traffic-based size**
        .attr('fill', 'steelblue')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', 0.6)
        .attr('pointer-events', 'auto');

    // **Check if circles were created**
    if (circles.empty()) {
        console.error('🚨 No circles found! Check if station data was loaded correctly.');
    } else {
        console.log('✅ Circles created successfully!');
    }

    // **Add tooltips**
    circles.each(function(d) {
        let title = d3.select(this).append('title')
            .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        
        console.log('Tooltip added:', title.node());  // **检查 `<title>` 是否正确附加**
    });

    

    // **Update positions function**
    function updatePositions() {
        circles
            .attr('cx', d => getCoords(d).cx)
            .attr('cy', d => getCoords(d).cy);
    }

    // **Initial update**
    updatePositions();

    // **Listen for map interactions**
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);
});



