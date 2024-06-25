let darkMode = false;
let decalPattern = false;
let charts = [];
let filter = [];
let highlightedPoints = {};
let originalData = {};

$(document).ready(async function() {
    await loadChartsSequentially([
        { id: 'myChart1', tables: ['products','orders'], columns: ['name', 'total'], type: 'bar', aggregations: ['', 'Summe'] , filters: [] },
        { id: 'myChart2', tables: ['products','orders'], columns: ['category', 'total'], type: 'pie', aggregations: ['', 'Summe'] , filters: [] },

        // { id: 'myChart2', xTable: 'stores', xColumn: 'storeID', yTable: 'orders', yColumns: ['total'], type: 'bar', aggregations: ['Summe'] },
        // { id: 'myChart3', xTable: 'products', xColumn: 'Name', yTable: 'orders', yColumns: ['total'], type: 'pie', aggregations: ['Summe'] },
        // { id: 'myChart4', xTable: 'products', xColumn: 'Name', yTable: 'orders', yColumns: ['total'], type: 'bar', aggregations: ['Summe'] },
        // { id: 'map', markerType: 'stores', table: 'orders', column: 'total', aggregation: 'Summe', type: 'geo' },
        // { id: 'myStackedChart', xTable: 'orders', xColumn: 'nItems', yTable: 'orders', yColumns: ['total', 'total', 'total'], type: 'stacked', aggregations: ['Min', 'Max', 'Durchschnitt'] },
        // { id: 'chart7', markerType: 'stores', table: 'orders', column: 'total', aggregation: 'Anzahl', type: 'dynamicMarkers' }, // Neue Chart-Konfiguration

        // { id: 'myChart2', xTable: 'customers', xColumn: 'customerID', yTable: 'orders', yColumns: ['orderID'], type: 'bar', aggregations: ['Anzahl'] },


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

function sortDataByDate(response) {
    let sortedIndices = [...Array(response.x.length).keys()].sort((a, b) => {
        const [monthA, yearA] = response.x[a].split('.').map(Number);
        const [monthB, yearB] = response.x[b].split('.').map(Number);
        return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
    });

    let sortedX = sortedIndices.map(i => response.x[i]);
    let sortedY0 = sortedIndices.map(i => response.y0[i]);

    return {
        ...response,
        x: sortedX,
        y0: sortedY0
    };
}

function calculateGrowthRates(data) {
    let growthRates = [];
    const y0 = data.y0;
    for (let i = 0; i < y0.length; i++) {
        if (i === 0) {
            growthRates.push(0); // Die erste Wachstumsrate ist 0%
        } else {
            let previous = y0[i - 1];
            let current = y0[i];
            let growthRate = ((current / previous) - 1) * 100;
            growthRates.push(growthRate);
        }
    }
    return growthRates;
}

function generateChartOptions(chartType, response, yColumns) {
    let option = {};
    switch (chartType) {
        case 'negativBar':
            // Sortiere die Daten nach Datum
            response = sortDataByDate(response);
            let growthRates = calculateGrowthRates(response);
            console.log(growthRates); // Debugging-Ausgabe
            option = {
                title: { 
                    left: 'center', 
                    text: 'Monthly Sales Growth Rate',
                    textStyle: {
                        fontFamily: 'Arial, sans-serif',
                        fontSize: 18,
                        fontWeight: 'bold'
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(50, 50, 50, 0.7)',
                    textStyle: {
                        color: '#fff'
                    },
                    formatter: function(params) {
                        return `${params[0].name}: ${params[0].value.toFixed(2)}%`;
                    }
                },
                xAxis: {
                    type: 'category',
                    data: response.x,  // Alle Monate werden angezeigt
                    axisLine: {
                        lineStyle: {
                            color: '#ccc'
                        }
                    },
                    axisLabel: {
                        fontFamily: 'Arial, sans-serif',
                        fontSize: 12
                    }
                },
                yAxis: {
                    type: 'value',
                    axisLabel: {
                        formatter: '{value}%',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: 12
                    },
                    splitLine: {
                        lineStyle: {
                            type: 'dashed',
                            color: '#ccc'
                        }
                    }
                },
                series: [{
                    data: growthRates,
                    type: 'bar',
                    barWidth: '60%',
                    itemStyle: {
                        normal: {
                            color: function(params) {
                                return params.value < 0 ? '#ff6b6b' : '#1dd1a1'; // Modernere Farben: Rot für negative Werte, Grün für positive Werte
                            },
                            barBorderRadius: [5, 5, 0, 0],
                            shadowColor: 'rgba(0, 0, 0, 0.1)',
                            shadowBlur: 10
                        }
                    },
                    markLine: {
                        data: [{ type: 'average', name: 'Average' }],
                        lineStyle: {
                            type: 'dashed',
                            color: '#576574'
                        },
                        label: {
                            formatter: '{b}: {c}%',
                            fontFamily: 'Arial, sans-serif',
                            fontSize: 12,
                            color: '#576574'
                        }
                    }
                }],
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '3%',
                    containLabel: true
                },
                backgroundColor: '#f5f6fa',
                textStyle: {
                    fontFamily: 'Arial, sans-serif',
                    color: '#2f3542'
                },
                 toolbox: { 
                    feature: getToolboxFeatures() 
                },
            };
    break;

        case 'pie':
            option = {
                title: { left: 'center', text: 'Donut Chart' },
                tooltip: { 
                    trigger: 'item',
                    formatter: function(params) {
                        const dataIndex = params.dataIndex;
                        const y1Value = response.y1 ? response.y1[dataIndex] : 'N/A';
                        return `${params.name}: ${params.value}<br>Number of Stores in State: ${y1Value}`;
                    }
                },
                toolbox: { feature: getToolboxFeatures() },
                legend: { top: '5%', left: 'center' },
                series: [{
                    name: 'Data',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    center: ['50%', '70%'],
                    startAngle: 180,
                    endAngle: 360,
                    avoidLabelOverlap: false,
                    label: { show: false, position: 'center' },
                    emphasis: { label: { show: true, fontSize: '20', fontWeight: 'bold' } },
                    labelLine: { show: false },
                    data: response.x.map((x, index) => ({
                        value: response.y0[index],
                        name: x,
                        itemStyle: highlightedPoints[`${response.chartId}-${index}`] ? {
                            borderColor: 'black',
                            borderWidth: 2
                        } : {}
                    }))
                }]
            };
            break;
            case 'donut':
            option = {
                title: { left: 'center', text: 'Donut Chart' },
                tooltip: {
                    trigger: 'item',
                    formatter: function(params) {
                        const dataIndex = params.dataIndex;
                        const category = response.y1 ? response.y1[dataIndex] : 'N/A';
                        return `${params.name}: ${params.value}<br>Category: ${category}`;
                    }
                },
                toolbox: { feature: getToolboxFeatures() },
                legend: { top: '5%', left: 'center' },
                series: [{
                    name: 'Data',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    avoidLabelOverlap: false,
                    label: { show: false, position: 'center' },
                    emphasis: { label: { show: true, fontSize: '20', fontWeight: 'bold' } },
                    labelLine: { show: false },
                    data: response.x.map((x, index) => ({
                        value: response.y0[index],
                        name: x,
                        itemStyle: highlightedPoints[`${response.chartId}-${index}`] ? {
                            borderColor: 'black',
                            borderWidth: 2
                        } : {}
                    }))
                }]
            };
            break;
        case 'area':
        case 'line':
            option = {
                title: { left: 'center', text: chartType === 'area' ? 'Large Scale Area Chart' : 'Line Chart' },
                tooltip: { trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } } },
                legend: { data: yColumns, top: '5%' },
                xAxis: { type: 'category', boundaryGap: false, data: response.x },
                yAxis: { type: 'value' },
                series: yColumns.map((yColumn, seriesIndex) => ({
                    name: yColumn,
                    type: 'line',
                    stack: 'total',
                    areaStyle: chartType === 'area' ? {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgb(255, 158, 68)' },
                            { offset: 1, color: 'rgb(255, 70, 131)' }
                        ])
                    } : undefined,
                    emphasis: { focus: 'series' },
                    itemStyle: { color: 'rgb(255, 70, 131)' },
                    data: response[`y${seriesIndex}`].map((y, dataIndex) => ({
                        value: y,
                        itemStyle: highlightedPoints[`${response.chartId}-${seriesIndex}-${dataIndex}`] ? {
                            borderColor: 'black',
                            borderWidth: 2
                        } : {}
                    }))
                })),
                backgroundColor: darkMode ? '#333' : '#fff',
                textStyle: { color: darkMode ? '#fff' : '#000' },
                toolbox: { feature: getToolboxFeatures() },
                dataZoom: [{ type: 'inside', start: 0, end: 100 }, { start: 0, end: 100 }]
            };
            break;
        case 'scatter':
            option = {
                title: { left: 'center', text: 'Basic Scatter Chart' },
                tooltip: {
                    trigger: 'item',
                    position: function(pt) { return [pt[0], '10%']; },
                    formatter: function(params) {
                        return `<strong>X:</strong> ${params.value[0]}<br><strong>Y:</strong> ${params.value[1]}`;
                    }
                },
                toolbox: { feature: getToolboxFeatures() },
                xAxis: { type: 'category' },
                yAxis: { type: 'category' },
                series: [{
                    symbolSize: 20,
                    data: response.x.map((x, index) => ({
                        value: [x, response.y0[index]],
                        itemStyle: highlightedPoints[`${response.chartId}-${index}`] ? {
                            borderColor: 'black',
                            borderWidth: 2
                        } : {}
                    })),
                    type: 'scatter',
                    itemStyle: { color: response.colors ? response.colors[0] : '#c23531' }
                }],
                backgroundColor: darkMode ? '#333' : '#fff',
                textStyle: { color: darkMode ? '#fff' : '#000' }
            };
            break;
        case 'stacked':
            option = {
                title: { left: 'center', text: 'Stacked Area Chart' },
                tooltip: { trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } } },
                legend: { top: '5%', left: 'center' },
                xAxis: { type: 'category', data: response.x },
                yAxis: { type: 'value' },
                series: yColumns.map((yColumn, seriesIndex) => ({
                    name: yColumn,
                    type: 'line',
                    areaStyle: {},
                    emphasis: { focus: 'series' },
                    data: response[`y${seriesIndex}`].map((y, dataIndex) => ({
                        value: y,
                        itemStyle: highlightedPoints[`${response.chartId}-${seriesIndex}-${dataIndex}`] ? {
                            borderColor: 'black',
                            borderWidth: 2
                        } : {}
                    })),
                    itemStyle: { color: echarts.color.modifyHSL('#c23531', seriesIndex * 120) }
                })),
                backgroundColor: darkMode ? '#333' : '#fff',
                textStyle: { color: darkMode ? '#fff' : '#000' },
                toolbox: { feature: getToolboxFeatures() },
                dataZoom: [{ type: 'inside', start: 0, end: 100 }, { start: 0, end: 100 }]
            };
            break;
        default:
            option = {
                tooltip: { trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } } },
                toolbox: { feature: getToolboxFeatures() },
                xAxis: { type: 'category', data: response.x },
                yAxis: { type: 'value' },
                series: [{
                    type: chartType,
                    data: response.y0.map((y, index) => ({
                        value: y,
                        itemStyle: highlightedPoints[`${response.chartId}-${index}`] ? {
                            borderColor: 'black',
                            borderWidth: 2
                        } : {}
                    }))
                }]
            };
    }
    return option;
}

function getToolboxFeatures() {
    return {
        saveAsImage: { show: true },
        restore: { show: true },
        dataView: { show: true, readOnly: false },
        myDarkMode: {
            show: true,
            title: 'Dark Mode',
            icon: 'path://M512 0C229.23072 0 0 229.23072 0 512s229.23072 512 512 512 512-229.23072 512-512S794.76928 0 512 0z m0 938.0864c-234.24 0-426.0864-191.8464-426.0864-426.0864S277.76 85.9136 512 85.9136c55.7312 0 111.4624 11.7248 163.6864 35.0208-32.768 56.32-87.04 94.72-151.0912 105.2672-78.4896 13.7216-147.2-12.288-199.7312-55.808 0 0-12.6976 80.9472-12.6976 119.296 0 136.3968 104.7552 247.9104 239.9232 261.8368 79.872 8.2944 152.576-24.7808 198.3488-80.64 28.2624 48.64 45.568 106.752 45.568 170.3424 0 234.24-191.8464 426.0864-426.0864 426.0864z',
            onclick: function() {
                darkMode = !darkMode;
                updateChartAppearance();
            }
        },
        myDecalPattern: {
            show: true,
            title: 'Decal Pattern',
            icon: 'path://M50 250 Q 150 50 250 250 T 450 250',
            onclick: function() {
                decalPattern = !decalPattern;
                updateChartAppearance();
            }
        },
        myShare: {
            show: true,
            title: 'Share',
            icon: 'path://M864 160h-192V96H352v64H160c-35.328 0-64 28.672-64 64v576c0 35.328 28.672 64 64 64h704c35.328 0 64-28.672 64-64V224c0-35.328-28.672-64-64-64z m0 640H160V224h192v64h320v-64h192v576z m-320-320h-64v192h-192V480h-64l160-160 160 160z',
            onclick: function() {
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(function() {
                    alert('URL copied to clipboard');
                }, function(err) {
                    console.error('Could not copy URL: ', err);
                });
            }
        },
    };
}

async function initializeChart(config) {
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
        console.log(response);  // Debugging-Ausgabe

        if (config.id === 'myChart1' || config.type === 'negativBar') {
            response = sortDataByDate(response); // Sortiere die Daten nur für myChart1 und negativBar
        }

        response.chartId = config.id;

        // Überprüfe, ob genügend Daten vorhanden sind
        if (response.y0.length < 2) {
            console.error("Nicht genügend Daten für Wachstumsraten");
            return;
        }

        originalData[config.id] = response;
        const option = generateChartOptions(config.type, response, config.columns.slice(1));
        myChart.setOption(option);
        myChart.on('click', params => handleChartClick(myChart, config, params));
    } catch (error) {
        console.error("Failed to initialize chart:", error);
    }
}


function updateChartAppearance() {
    charts.forEach(({ chart }) => {
        const option = chart.getOption();
        if (darkMode) {
            option.backgroundColor = '#333';
            option.textStyle = { color: '#fff' };
        } else {
            option.backgroundColor = '#fff';
            option.textStyle = { color: '#000' };
        }
        if (decalPattern) {
            option.series.forEach(series => {
                series.itemStyle = series.itemStyle || {};
                series.itemStyle.decal = { symbol: 'rect', symbolSize: 1, color: 'rgba(0, 0, 0, 0.1)' };
            });
        } else {
            option.series.forEach(series => {
                if (series.itemStyle) {
                    series.itemStyle.decal = null;
                }
            });
        }
        chart.setOption(option);
    });
}

async function initializeGeoChart(chartId, markerType, table, column, aggregation) {
    return new Promise((resolve, reject) => {
        const baseLayer = L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }
        );

        const cfg = {
            "radius": 0.2,
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

        const map = new L.Map(chartId, {
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
            tables: ['stores', 'stores', 'stores', table],
            columns: ['storeID', 'longitude', 'latitude', column],
            chartType: 'heatmap',
            aggregations: ["", "X", "X", aggregation],
            filters: filter
        };

        fetchData(requestData).then(responseData => {
            if (!responseData.hasOwnProperty('x') || !responseData.hasOwnProperty('y0') || !responseData.hasOwnProperty('y1') || !responseData.hasOwnProperty('y2')) {
                console.error('Data does not have the required properties:', responseData);
                return;
            }

            const data = [];
            for (let i = 0; i < responseData.x.length; i++) {
                data.push({
                    id: responseData.x[i],
                    longitude: parseFloat(responseData.y0[i]),
                    latitude: parseFloat(responseData.y1[i]),
                    Aggregation: parseFloat(responseData.y2[i])
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

            resolve();
        }).catch(error => {
            console.log('Error:', error);
            reject(error);
        });
    });
}

async function loadDynamicMarkers(chartId, markerType, table, column, aggregation) {
    const requestData = {
        tables: ['stores', 'stores', 'stores', table],
        columns: ['storeID', 'longitude', 'latitude', column],
        chartType: 'dynamicMarkers',
        aggregations: ['', 'X', 'X', aggregation],
        filters: filter
    };
    if (markerType === 'stores') {
        requestData.tables = ['stores', 'stores', 'stores', table];
        requestData.columns = ['storeID', 'longitude', 'latitude', column];
    } else if (markerType === 'customers') {
        requestData.tables = ['customers', 'customers', 'customers', table];
        requestData.columns = ['customerID', 'longitude', 'latitude', column];
    }

    fetchData(requestData).then(responseData => {
        if (!responseData.hasOwnProperty('x') || !responseData.hasOwnProperty('y0') || !responseData.hasOwnProperty('y1') || !responseData.hasOwnProperty('y2')) {
            console.error('Data does not have the required properties:', responseData);
            return;
        }

        const data = responseData.x.map((x, index) => ({
            id: x,
            longitude: parseFloat(responseData.y0[index]),
            latitude: parseFloat(responseData.y1[index]),
            Aggregation: parseFloat(responseData.y2[index])
        }));

        const maxAggregation = Math.max(...data.map(point => point.Aggregation));

        const map = new L.Map(chartId, {
            center: new L.LatLng(37.5, -117),
            zoom: 6,
            layers: [L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            })]
        });

        data.forEach(point => {
            const scale = point.Aggregation / maxAggregation;
            const markerOptions = {
                radius: 3 + scale * 17,
                fillColor: markerType === 'stores' ? 'blue' : 'pink',
                color: "#000",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.6
            };

            const marker = L.circleMarker([point.latitude, point.longitude], markerOptions);
            const popupContent = `<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}<br><b>Aggregation:</b> ${point.Aggregation}`;
            marker.bindPopup(popupContent);
            marker.on('click', () => handleMarkerClick(marker, point));
            map.addLayer(marker);
        });
    }).catch(error => {
        console.error('Error:', error);
    });
}

function handleChartClick(chartInstance, config, params) {
    if (params.componentType === 'series') {
        const seriesIndex = params.seriesIndex;
        const dataIndex = params.dataIndex;
        const key = `${chartInstance.id}-${seriesIndex}-${dataIndex}`;
        let value;

        if (config.type === "scatter") {
            value = params.value[0];
        } else {
            value = params.name;
        }

        if (highlightedPoints[key]) {
            delete highlightedPoints[key];
            filter = filter.filter(item => item.filterValue !== value);
            config.filters = config.filters.filter(item => item.filterValue !== value);
            if (Object.keys(highlightedPoints).length === 0) {
                resetAllCharts();
            } else {
                updateHighlighting(chartInstance);
                updateAllCharts(chartInstance.id);
            }
        } else {
            highlightedPoints[key] = true;
            const newFilter = {
                chartId: chartInstance.id,
                filterTable: config.tables[0],
                filterColumn: config.columns[0],
                filterValue: value
            };
            filter.push(newFilter);
            config.filters.push(newFilter);
            updateHighlighting(chartInstance);
            updateAllCharts(chartInstance.id);
        }
    }
}


function handleMarkerClick(marker, point) {
    const key = `marker-${point.id}`;
    if (highlightedPoints[key]) {
        delete highlightedPoints[key];
        filter = filter.filter(item => item.filterValue !== point.id);
        if (Object.keys(highlightedPoints).length === 0) {
            resetAllCharts();
        } else {
            updateAllCharts();
        }
        marker.setStyle({ color: '#000' });
    } else {
        highlightedPoints[key] = true;
        filter.push({
            chartId: marker.options.id,
            filterTable: 'stores',
            filterColumn: 'storeID',
            filterValue: point.id
        });
        updateAllCharts();
        marker.setStyle({ color: 'red' });
    }
}

function updateHighlighting(chartInstance) {
    const series = chartInstance.getOption().series;
    series.forEach((serie, seriesIndex) => {
        serie.data.forEach((dataPoint, dataIndex) => {
            const key = `${chartInstance.id}-${seriesIndex}-${dataIndex}`;
            if (highlightedPoints[key]) {
                dataPoint.itemStyle = dataPoint.itemStyle || {};
                dataPoint.itemStyle.borderColor = 'black';
                dataPoint.itemStyle.borderWidth = 2;
            } else {
                if (dataPoint.itemStyle) {
                    delete dataPoint.itemStyle.borderColor;
                    delete dataPoint.itemStyle.borderWidth;
                }
            }
        });
    });

    chartInstance.setOption({ series: series });
}

function updateAllCharts(excludeChartId) {
    charts.forEach(({ chart, config }) => {
        if (chart.id !== excludeChartId) {
            const applicableFilter = filter.filter(f => f.filterTable === config.tables[0] && f.filterColumn === config.columns[0]);
            if (applicableFilter.length > 0) {
                const data = applyFilters(originalData[config.id], applicableFilter);
                const option = generateChartOptions(config.type, data, config.columns.slice(1));
                chart.setOption(option);
            } else {
                // No applicable filters, keep the chart unchanged
                const option = generateChartOptions(config.type, originalData[config.id], config.columns.slice(1));
                chart.setOption(option);
            }
        }
    });
}


function applyFilters(data, applicableFilter) {
    if (applicableFilter.length === 0) {
        return data;
    }

    const filteredData = { x: [], y0: [] };

    data.x.forEach((x, index) => {
        const match = applicableFilter.some(f => f.filterValue === x);
        if (match) {
            filteredData.x.push(x);
            filteredData.y0.push(data.y0[index]);
        }
    });

    return filteredData;
}

function resetAllCharts() {
    filter = [];
    highlightedPoints = {};
    charts.forEach(({ chart, config }) => {
        const option = generateChartOptions(config.type, originalData[config.id], config.columns.slice(1));
        chart.setOption(option);
    });
}

async function loadChartsSequentially(chartConfigs) {
    charts = [];  // Clear existing charts
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
    // Aktuelle Diagrammkonfigurationen sammeln
    const chartConfigs = charts.map(chartObj => chartObj.config);

    const jsonString = JSON.stringify(chartConfigs, null, 4); // 4 for proper formatting
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