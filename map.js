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
// 计算站点客流量
function computeStationTraffic(stations, trips) {
    const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id
    );

    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id
    );

    return stations.map((station) => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
}

// 计算从午夜到现在的分钟数
function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

// 过滤符合时间范围（±60分钟）的 trips
function filterTripsbyTime(trips, timeFilter) {
    return timeFilter === -1
        ? trips
        : trips.filter((trip) => {
            const startedMinutes = minutesSinceMidnight(trip.started_at);
            const endedMinutes = minutesSinceMidnight(trip.ended_at);
            return (
                Math.abs(startedMinutes - timeFilter) <= 60 ||
                Math.abs(endedMinutes - timeFilter) <= 60
            );
        });
}

// Import data
map.on('load', async () => { 
    console.log('begin to add data');

    // Import Boston bike lanes
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

    let stations = [];

    try {
        // Load bike stations
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
        const jsonData = await d3.json(jsonurl);
        console.log('Loaded JSON Data:', jsonData);
        
        stations = jsonData.data.stations;
        
    } catch (error) {
        console.error('Error loading JSON:', error);
        return;
    }

    let trips = [];

    try {
        // 加载并转换 trip 数据
        trips = await d3.csv(
            'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
            (trip) => {
                trip.started_at = new Date(trip.started_at);
                trip.ended_at = new Date(trip.ended_at);
                return trip;
            }
        );

        console.log('Loaded CSV Data:', trips);
    } catch (error) {
        console.log('Error loading CSV:', error);
        return;
    }

    // 计算初始站点客流量
    stations = computeStationTraffic(stations, trips);

    function getCoords(station) {
        const point = new mapboxgl.LngLat(+station.lon, +station.lat);  
        const { x, y } = map.project(point);  
        return { cx: x, cy: y };  
    }

    // 定义比例尺
    const radiusScale = d3.scaleSqrt().domain([0, d3.max(stations, (d) => d.totalTraffic)]).range([0, 25]);

    // 创建 SVG
    let svg = d3.select('#map').select('svg');
    if (svg.empty()) {
        svg = d3.select('#map').append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0');
    }

    let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);


    // 创建站点散点图
    const circles = svg
        .selectAll('circle')
        .data(stations, (d) => d.short_name)
        .enter()
        .append('circle')
        .attr('r', (d) => radiusScale(d.totalTraffic))
        .attr('fill', 'steelblue')
        .attr('fill-opacity', 0.6)
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic))  
        .each(function (d) {
            d3.select(this)
                .append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        });
                 

    function updatePositions() {
        circles.attr('cx', d => getCoords(d).cx).attr('cy', d => getCoords(d).cy);
    }

    updatePositions();
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);

    function updateScatterPlot(timeFilter) {
        const filteredTrips = filterTripsbyTime(trips, timeFilter);
        const filteredStations = computeStationTraffic(stations, filteredTrips);

        radiusScale.range(timeFilter === -1 ? [0, 25] : [3, 50]);

        circles
            .data(filteredStations, (d) => d.short_name)
            .join('circle')
            .attr('r', (d) => radiusScale(d.totalTraffic))
            .style('--departure-ratio', (d) => stationFlow(d.departures / d.totalTraffic)); // 更新颜色
    }

    const slider = document.getElementById("time-filter");
    const timeDisplay = document.getElementById("selected-time");
    const anyTimeDisplay = document.getElementById("any-time");

    function updateTimeDisplay() {
        let timeFilter = Number(slider.value);

        if (timeFilter === -1) {
            timeDisplay.style.display = "none";
            anyTimeDisplay.style.display = "block";
        } else {
            const hours = Math.floor(timeFilter / 60);
            const minutes = timeFilter % 60;
            const formattedTime = `${hours}:${minutes.toString().padStart(2, "0")}`;
        
            timeDisplay.textContent = formattedTime;
            timeDisplay.style.display = "block";
            anyTimeDisplay.style.display = "none";
        }

        updateScatterPlot(timeFilter);
    }

    slider.addEventListener("input", updateTimeDisplay);
    updateTimeDisplay();


    



















});

