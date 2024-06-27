let darkMode = false;
let decalPattern = false;
let charts = [];
let filter = [];
let highlightedPoints = {};
let originalData = {};

$(document).ready(async function() {
    await loadChartsSequentially([
        { id: 'myChart1', tables: ['stores', 'stores', 'stores', 'orders'], columns: ['storeID', 'longitude', 'latitude', 'total'], type: 'heatmap', aggregations: ["", "X", "X", "Summe"], filters: filter },
        { id: 'myChart2', tables: ['stores', 'orders'], columns: ['storeID', 'orders_total-YYYY'], type: 'bar', aggregations: ['', 'Summe'], filters: [] },
    ]);
});

async function fetchData(requestData) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: "/getdata",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify(requestData),
            success: function(response) {
                resolve(response);
            },
            error: function(xhr, status, error) {
                console.error("Error: ", status, error);
                console.error("Response: ", xhr.responseText);
                reject(error);
            }
        });
    });
}

async function initializeChart(config) {
    console.log("Initializing chart with config:", config);

    if (config.type === 'heatmap') {
        initializeHeatmap(config);
        return;
    }

    const myChart = echarts.init(document.getElementById(config.id));
    const existingChart = charts.find(chartObj => chartObj.config.id === config.id);
    if (existingChart) {
        existingChart.chart.dispose();
        charts = charts.filter(chartObj => chartObj.config.id !== config.id);
    }
    charts.push({ chart: myChart, config: config });

    const requestData = {
        tables: config.tables,
        columns: config.columns,
        chartType: config.type,
        aggregations: config.aggregations,
        filters: config.filters
    };

    try {
        let response = await fetchData(requestData);
        console.log("Received response:", response);

        response.chartId = config.id;
        originalData[config.id] = response;

        let option = {};
        switch(config.type) {
            case 'bar':
                option = {
                    xAxis: {
                        type: 'category',
                        data: response.x // Assuming response.x contains categories (store IDs)
                    },
                    yAxis: {
                        type: 'value'
                    },
                    series: [{
                        data: response.y0, // Assuming response.y0 contains values (orders total-YYYY)
                        type: 'bar'
                    }]
                };
                break;
            default:
                console.error("Unknown chart type:", config.type);
        }

        myChart.setOption(option);
    } catch (error) {
        console.error("Failed to initialize chart:", error);
    }
}

async function initializeHeatmap(config) {
    const baseLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }
    );

    const cfg = {
        "radius": 1,
        "maxOpacity": .8,
        "scaleRadius": true,
        "useLocalExtrema": true,
        latField: 'lat',
        lngField: 'lng',
        valueField: 'count',
        gradient: {
            0.1: 'blue',
            0.2: 'lime',
            0.4: 'yellow',
            0.6: 'orange',
            0.8: 'red',
            1.0: 'purple'
        }
    };

    const heatmapLayer = new HeatmapOverlay(cfg);

    const map = new L.Map(config.id, {
        center: new L.LatLng(37.5, -117),
        zoom: 6,
        layers: [baseLayer]
    });

    const circleMarkerOptions = {
        radius: 3,
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.6
    };

    function createLegend(legendElement, gradient) {
        for (const key in gradient) {
            const color = gradient[key];
            const div = document.createElement('div');
            div.innerHTML = '<span style="background-color:' + color + ';"></span>' + key;
            legendElement.appendChild(div);
        }
    }

    const legendControl = L.control({ position: 'bottomright' });

    legendControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'legend');
        const gradient = cfg.gradient;
        createLegend(div, gradient);
        return div;
    };

    legendControl.addTo(map);

    const requestData = {
        tables: config.tables,
        columns: config.columns,
        chartType: 'heatmap',
        aggregations: config.aggregations,
        filters: config.filters
    };

    try {
        let response = await fetchData(requestData);
        console.log("Received response:", response);

        const data = [];
        for (let i = 0; i < response.x.length; i++) {
            data.push({
                id: response.x[i],
                longitude: parseFloat(response.y0[i]),
                latitude: parseFloat(response.y1[i]),
                Aggregation: parseFloat(response.y2[i])
            });
        }

        const bounds = [];
        const heatmapPoints = [];

        data.forEach(point => {
            const marker = L.circleMarker([point.latitude, point.longitude], circleMarkerOptions);
            marker.bindPopup(`<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}<br><b>Aggregation:</b> ${point.Aggregation}`);
            marker.on('click', () => handleMarkerClick(marker, point));
            map.addLayer(marker);
            bounds.push([point.latitude, point.longitude]);

            heatmapPoints.push({
                lat: point.latitude,
                lng: point.longitude,
                count: point.Aggregation
            });
        });

        if (bounds.length > 0) {
            map.fitBounds(bounds);
        }

        map.addLayer(heatmapLayer);
        heatmapLayer.setData({
            max: Math.max(...data.map(point => point.Aggregation)),
            data: heatmapPoints
        });

    } catch (error) {
        console.error("Failed to initialize heatmap:", error);
    }
}

async function loadChartsSequentially(chartConfigs) {
    charts = [];
    for (const config of chartConfigs) {
        await initializeChart(config);
    }
}

document.getElementById('exportJsonButton').addEventListener('click', exportJson);
document.getElementById('importJsonButton').addEventListener('click', openImportPopup);
document.querySelector('.schließen-button').addEventListener('click', closeImportPopup);
document.getElementById('dropArea').addEventListener('dragover', handleDragOver);
document.getElementById('dropArea').addEventListener('drop', handleFileSelect);
document.getElementById('fileSelectButton').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', handleFileUpload);

function exportJson() {
    if (charts.length === 0) {
        alert("No JSON Data available to export.");
        return;
    }
    const chartConfigs = charts.map(chartObj => chartObj.config);

    const jsonString = JSON.stringify(chartConfigs, null, 4);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'charts_config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function openImportPopup() {
    document.getElementById('importJsonPopup').style.display = 'block';
}

function closeImportPopup() {
    document.getElementById('importJsonPopup').style.display = 'none';
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
}

function handleFileSelect(event) {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (files.length === 1 && files[0].type === "application/json") {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                loadChartsSequentially(importedData);
                closeImportPopup();
            } catch (error) {
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    } else {
        alert("Please drop a valid JSON file.");
    }
}


function handleFileUpload(event) {
    const files = event.target.files;
    if (files.length === 1 && files[0].type === "application/json") {
        readFile(files[0]);
    } else {
        alert("Please select a valid JSON file.");
    }
}

function readFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            loadChartsSequentially(importedData);
            closeImportPopup();
        } catch (error) {
            alert("Invalid JSON file");
        }
    };
    reader.readAsText(file);
}