let darkMode = false;
let decalPattern = false;
let charts = [];
let filter = [];
let highlightedPoints = {};
let originalData = {};

$(document).ready(async function() {
    await loadChartsSequentially([
        { id: 'myChart1', tables: ['stores', 'stores', 'stores', 'orders'], columns: ['storeID', 'longitude', 'latitude', 'total'], type: 'heatmap', aggregations: ["", "X", "X", "Summe"], filters: filter },
        { id: 'storeChartsContainer', tables: ['stores', 'orders', 'orders'], columns: ['storeID', 'total', 'orderDate-YYYY'], type: 'storeCharts', aggregations: ['', 'Summe', ''], filters: [] },
        { id: 'myChart3', tables: ['orders', 'orders'], columns: ['orderDate-DD.MM.YYYY', 'orderID'], type: 'dayWiseHeatmap', aggregations: ['', 'Anzahl'], filters: [] },
        { id: 'myChart4', tables: ['orders', 'orders'], columns: ['orderDate-DD.MM.YYYY HH24:MI', 'orderID'], type: 'bar', aggregations: ['', 'Anzahl'], filters: [] }
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

function generateChartOptions(response, storeData) {
    storeData.sort((a, b) => a.year - b.year); // Sort by year

    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        xAxis: {
            type: 'category',
            data: storeData.map(data => data.year),
            axisPointer: {
                type: 'shadow'
            }
        },
        yAxis: {
            type: 'value'
        },
        series: [{
            name: 'Total Revenue per Year',
            data: storeData.map(data => data.total),
            type: 'line',
            smooth: true,
            areaStyle: {}
        }]
    };
}
function initializeBarChart(config, response) {
    const myChart = echarts.init(document.getElementById(config.id));

    const timeData = response.x.map(item => item.split(' ')[1]); // Extract HH24:MI part
    const orderCounts = response.y0;

    const ordersPerHour = Array.from({ length: 24 }, () => 0);

    timeData.forEach((time, index) => {
        const hour = parseInt(time.split(':')[0], 10);
        ordersPerHour[hour] += orderCounts[index];
    });

    const option = {
        title: {
            text: 'Orders Per Hour',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: '{b}: {c} orders'
        },
        xAxis: {
            type: 'category',
            data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            axisLabel: {
                interval: 0,
                rotate: 45
            }
        },
        yAxis: {
            type: 'value',
            minInterval: 1
        },
        series: [{
            name: 'Orders',
            type: 'bar',
            data: ordersPerHour,
            itemStyle: {
                color: '#73c0de'
            }
        }]
    };

    myChart.setOption(option);
    charts.push({ chart: myChart, config: config });
}
async function initializeChart(config) {
    console.log("Initializing chart with config:", config);

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

        if (config.type === 'storeCharts') {
            const storeChartsContainer = document.getElementById('storeChartsContainer');
            storeChartsContainer.innerHTML = '';

            const storeIDs = [...new Set(response.x)];

            storeIDs.forEach(storeID => {
                const storeData = response.x.map((id, index) => ({
                    storeID: id,
                    total: response.y0[index],
                    year: response.y1[index]
                })).filter(data => data.storeID === storeID);

                storeData.sort((a, b) => a.year - b.year); // Sort by year

                const total = storeData.reduce((sum, data) => sum + parseFloat(data.total), 0);
                let changePercentage = 0;
                if (storeData.length > 1) {
                    const previousTotal = storeData[storeData.length - 2].total;
                    const currentTotal = storeData[storeData.length - 1].total;
                    changePercentage = ((currentTotal - previousTotal) / previousTotal) * 100;
                }

                const performanceClass = changePercentage > 0 ? 'positive-change' : 'negative-change';

                const chartContainer = document.createElement('div');
                chartContainer.className = 'store-chart-container';
                chartContainer.innerHTML = `
                    <div class="store-title">Store ID ${storeID}</div>
                    <div class="store-performance">$${(total / 1e6).toFixed(2)}M</div>
                    <div class="store-change ${performanceClass}">${changePercentage.toFixed(1)}%</div>
                    <div id="storeChart_${storeID}" class="store-chart"></div>
                `;
                storeChartsContainer.appendChild(chartContainer);

                const myChart = echarts.init(document.getElementById(`storeChart_${storeID}`));
                charts.push({ chart: myChart, config: config });

                let option = generateChartOptions(response, storeData);
                myChart.setOption(option);
            });
        } else if (config.type === 'dayWiseHeatmap') {
            initializeDayWiseHeatmap(config, response);
        }
        else if (config.type === 'bar') {
            initializeBarChart(config, response);
        }
        
    } catch (error) {
        console.error("Failed to initialize chart:", error);
    }
}

async function initializeHeatmap(config) {
    return new Promise(async (resolve, reject) => {
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

        // Titel hinzufügen
        const title = L.control({ position: 'topright' });
        title.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'map-title');
            div.innerHTML = '<h3>Stores Locations based on Total Revenue</h3>';
            return div;
        };
        title.addTo(map);

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
                marker.bindPopup(`<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}<br><b>Total Revenue:</b> ${point.Aggregation}`);
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

            resolve();
        } catch (error) {
            console.error("Failed to initialize heatmap:", error);
            reject(error);
        }
    });
}

function initializeDayWiseHeatmap(config, response) {
    const myChart = echarts.init(document.getElementById(config.id));

    const daysOfWeek = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

    const data = response.x.map((date, index) => {
        const [day, month, year] = date.split('.');
        const dateObj = new Date(`${year}-${month}-${day}`);
        return [
            `${year}-${month}`,
            daysOfWeek[dateObj.getDay() - 1],
            response.y0[index]
        ];
    });

    // Sort data by month and day of week
    data.sort((a, b) => a[0].localeCompare(b[0]) || daysOfWeek.indexOf(a[1]) - daysOfWeek.indexOf(b[1]));

    const uniqueMonths = [...new Set(data.map(item => item[0]))];
    const formattedData = data.map(item => [uniqueMonths.indexOf(item[0]), daysOfWeek.indexOf(item[1]), item[2]]);

    const option = {
        title: {
            text: 'Heatmap for Orders per Weekday',
            left: 'center'
        },
        tooltip: {
            position: 'top'
        },
        grid: {
            height: '50%',
            top: '10%'
        },
        xAxis: {
            type: 'category',
            data: uniqueMonths.filter((_, i) => i % Math.ceil(uniqueMonths.length / 10) === 0), // Display fewer x-axis labels
            splitArea: {
                show: true
            }
        },
        yAxis: {
            type: 'category',
            data: daysOfWeek,
            splitArea: {
                show: true
            }
        },
        visualMap: {
            min: 0,
            max: Math.max(...response.y0),
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '15%'
        },
        series: [{
            name: 'Order Count',
            type: 'heatmap',
            data: formattedData,
            label: {
                show: false // Hide the labels on the heatmap cells
            },
            itemStyle: {
                borderColor: '#fff', // Add border color to cells
                borderWidth: 1
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };

    myChart.setOption(option);
    charts.push({ chart: myChart, config: config });
}





async function loadChartsSequentially(chartConfigs) {
    charts = [];
    for (const config of chartConfigs) {
        if (config.type === 'heatmap') {
            await initializeHeatmap(config);
        } else {
            await initializeChart(config);
        }
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
