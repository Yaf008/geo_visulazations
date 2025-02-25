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
    console.log('begin to add data')

    //import bike lanes
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
    });

    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': '#32D400',  // A bright green using hex code
            'line-width': 5,          // Thicker lines
            'line-opacity': 0.6       // Slightly less transparent
          }
    });



    //import cambridge bike lanes dats
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': '#32D400',  // A bright green using hex code
            'line-width': 5,          // Thicker lines
            'line-opacity': 0.6       // Slightly less transparent
          }
      });


    // bike stations

    try {
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
        const jsonData = await d3.json(jsonurl);

        console.log('Loaded JSON Data:', jsonData);
        
        let stations = jsonData.data.stations;
        console.log('Stations Array:', stations);

        const svg = d3.select('#map').select('svg');

        const circles = svg.selectAll('circle')
            .data(stations)
            .enter()
            .append('circle')
            .attr('r', 5)  
            .attr('fill', 'steelblue') 
            .attr('stroke', 'white') 
            .attr('stroke-width', 1)  
            .attr('opacity', 0.8);  
        function updatePositions() {
            circles
                .attr('cx', d => getCoords(d).cx)  
                .attr('cy', d => getCoords(d).cy); 
        }
    
        updatePositions();

        map.on('move', updatePositions);
        map.on('zoom', updatePositions);
        map.on('resize', updatePositions);
        map.on('moveend', updatePositions);

    } catch (error) {
        console.error('Error loading JSON:', error);
    }

});

  