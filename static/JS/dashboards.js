
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

function generateChartOptions(chartType, response, yColumns) {
    let option = {};
    switch(chartType) {
        case 'pie':
            option = {
                title: { left: 'center', text: 'Donut Chart' },
                tooltip: { trigger: 'item' },
                toolbox: {
                    feature: getToolboxFeatures()
                },
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
                        name: x
                    }))
                }]
            };
            break;
        case 'area':
            option = {
                title: { left: 'center', text: 'Large Scale Area Chart' },
                tooltip: { trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } } },
                legend: { data: yColumns, top: '5%' },
                xAxis: { type: 'category', boundaryGap: false, data: response.x },
                yAxis: { type: 'value' },
                series: yColumns.map((yColumn, index) => ({
                    name: yColumn,
                    type: 'line',
                    stack: 'total',
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgb(255, 158, 68)' },
                            { offset: 1, color: 'rgb(255, 70, 131)' }
                        ])
                    },
                    emphasis: { focus: 'series' },
                    itemStyle: { color: 'rgb(255, 70, 131)' },
                    data: response[`y${index}`]
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
                    data: response.x.map((x, index) => [x, response.y0[index]]),
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
                series: yColumns.map((yColumn, index) => ({
                    name: yColumn,
                    type: 'line',
                    areaStyle: {},
                    emphasis: { focus: 'series' },
                    data: response[`y${index}`],
                    itemStyle: { color: echarts.color.modifyHSL('#c23531', index * 120) } // Definieren Sie eine eindeutige Farbe

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
                        itemStyle: { color: response.colors ? response.colors[index] : null }
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
            onclick: function () {
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(function () {
                    alert('URL copied to clipboard');
                }, function (err) {
                    console.error('Could not copy URL: ', err);
                });
            }
        },
    };
}

async function initializeChart(config) {
    if (config.type === 'geo') {
        await initializeGeoChart(config.id, config.markerType, config.table, config.column, config.aggregation);
    } else if (config.type === 'dynamicMarkers') {
        await loadDynamicMarkers(config.id, config.markerType, config.table, config.column, config.aggregation);
    } else {
        const myChart = echarts.init(document.getElementById(config.id));
        const requestData = {
            tables: [config.xTable, ...Array(config.yColumns.length).fill(config.yTable)],
            columns: [config.xColumn, ...config.yColumns],
            chartType: config.type,
            aggregations: ["", ...config.aggregations],
            filters: []
        };

        try {
            const response = await fetchData(requestData);
            console.log(response.sql);
            let parsedResponse = response;
            if (config.type === 'stacked') {
                parsedResponse = {
                    x: response.x,
                    y0: response.y0,
                    y1: response.y1,
                    y2: response.y2
                };
            }
            const option = generateChartOptions(config.type, parsedResponse, config.yColumns);
            myChart.setOption(option);
        } catch (error) {
            console.error("Failed to initialize chart:", error);
        }
    }
}

function updateChartAppearance() {
    const charts = echarts.getInstanceByDom(document.querySelectorAll('.chart'));
    charts.forEach(chart => {
        const option = chart.getOption();
        if (darkMode) {
            option.backgroundColor = '#333';
            option.textStyle = { color: '#fff' };
        } else {
            option.backgroundColor = '#fff';
            option.textStyle = { color: '#000' };
        }
        if (decalPattern) {
            option.series[0].itemStyle = {
                decal: { symbol: 'rect', symbolSize: 1, color: 'rgba(0, 0, 0, 0.1)' }
            };
        } else {
            option.series[0].itemStyle = { decal: null };
        }
        chart.setOption(option);
    });
}

async function initializeGeoChart(chartId, markerType, table, column, aggregation) {
    return new Promise((resolve, reject) => {
        var baseLayer = L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }
        );

        var cfg = {
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

        var heatmapLayer = new HeatmapOverlay(cfg);

        var map = new L.Map(chartId, {
            center: new L.LatLng(37.5, -117),
            zoom: 6,
            layers: [baseLayer]
        });

        var markers = L.markerClusterGroup();
        var circleMarkerOptions = {
            radius: 3,
            fillColor: "#ff7800",
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.6
        };

        function createLegend(legendElement, gradient) {
            for (var key in gradient) {
                var color = gradient[key];
                var div = document.createElement('div');
                div.innerHTML = '<span style="background-color:' + color + ';"></span>' + key;
                legendElement.appendChild(div);
            }
        }

        var legendControl = L.control({ position: 'bottomright' });

        legendControl.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'legend');
            var gradient = cfg.gradient;
            createLegend(div, gradient);
            return div;
        };

        legendControl.addTo(map);

        const requestData = {
            tables: ['stores', 'stores', 'stores', table],
            columns: ['storeID', 'longitude', 'latitude', column],
            chartType: 'heatmap',
            aggregations: ["", "X", "X", aggregation],
            filters: []
        };

        fetchData(requestData).then(responseData => {
            if (!responseData.hasOwnProperty('x') || !responseData.hasOwnProperty('y0') || !responseData.hasOwnProperty('y1') || !responseData.hasOwnProperty('y2')) {
                console.error('Data does not have the required properties:', responseData);
                return;
            }

            var data = [];
            for (var i = 0; i < responseData.x.length; i++) {
                data.push({
                    id: responseData.x[i],
                    longitude: parseFloat(responseData.y0[i]),
                    latitude: parseFloat(responseData.y1[i]),
                    Aggregation: parseFloat(responseData.y2[i])
                });
            }

            markers.clearLayers();
            var bounds = [];
            var heatmapPoints = [];

            data.forEach(function(point) {
                var marker = L.circleMarker([point.latitude, point.longitude], circleMarkerOptions);
                marker.bindPopup(`<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}<br><b>Aggregation:</b> ${point.Aggregation}`);
                markers.addLayer(marker);
                bounds.push([point.latitude, point.longitude]);

                heatmapPoints.push({
                    lat: point.latitude,
                    lng: point.longitude,
                    count: point.Aggregation
                });
            });

            map.addLayer(markers);
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

async function loadChartsSequentially(chartConfigs) {
    for (const config of chartConfigs) {
        await initializeChart(config);
    }
}

async function loadDynamicMarkers(chartId, markerType, table, column, aggregation) {
    const requestData = {
        tables: ['stores', 'stores', 'stores', table],
        columns: ['storeID', 'longitude', 'latitude', column],
        chartType: 'dynamicMarkers',
        aggregations: ['', 'X', 'X', aggregation],
        filters: []
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

        const markers = L.markerClusterGroup();

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
            markers.addLayer(marker);
        });

        map.addLayer(markers);
    }).catch(error => {
        console.error('Error:', error);
    });
}