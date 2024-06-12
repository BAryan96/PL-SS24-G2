async function initializeChart(chartId, xTable, xColumn, yTable, yColumn, chartType, aggregation, markerType, table, column) {
    return new Promise((resolve, reject) => {
        if (chartType === 'geo') {
            initializeGeoChart(chartId, markerType, table, column, aggregation)
                .then(resolve)
                .catch(reject);
        } else {
            const myChart = echarts.init(document.getElementById(chartId));

            function loadChartData() {
                const requestData = {
                    tables: [xTable, yTable],
                    columns: [xColumn, yColumn],
                    chartType: chartType,
                    aggregations: ["", aggregation],
                    filters: []
                };

                $.ajax({
                    url: "/getdata",
                    type: "POST",
                    contentType: "application/json",
                    data: JSON.stringify(requestData),
                    success: function(response) {
                        console.log(response.sql);

                        let option = {};

                        if (chartType === 'pie') {
                            option = {
                                tooltip: {
                                    trigger: 'item'
                                },
                                toolbox: {
                                    feature: {
                                        saveAsImage: {},
                                                                                restore: { show: true },
                                        dataView: { show: true, readOnly: false },
                                        myDarkMode: {
                                            show: true,
                                            title: 'Dark Mode',
                                            icon: 'path://M512 0C229.23072 0 0 229.23072 0 512s229.23072 512 512 512 512-229.23072 512-512S794.76928 0 512 0z m0 938.0864c-234.24 0-426.0864-191.8464-426.0864-426.0864S277.76 85.9136 512 85.9136c55.7312 0 111.4624 11.7248 163.6864 35.0208-32.768 56.32-87.04 94.72-151.0912 105.2672-78.4896 13.7216-147.2-12.288-199.7312-55.808 0 0-12.6976 80.9472-12.6976 119.296 0 136.3968 104.7552 247.9104 239.9232 261.8368 79.872 8.2944 152.576-24.7808 198.3488-80.64 28.2624 48.64 45.568 106.752 45.568 170.3424 0 234.24-191.8464 426.0864-426.0864 426.0864z',
                                            onclick: function () {
                                                darkMode = !darkMode;
                                                updateChartAppearance(myChart);
                                            }
                                        },
                                        myDecalPattern: {
                                            show: true,
                                            title: 'Decal Pattern',
                                            icon: 'path://M50 250 Q 150 50 250 250 T 450 250',
                                            onclick: function () {
                                                decalPattern = !decalPattern;
                                                updateChartAppearance(myChart);
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
                                        myCloseChart: {
                                            show: true,
                                            title: 'Close Chart',
                                            icon: 'path://M512 512l212.48-212.48a32 32 0 0 0-45.248-45.248L512 421.504 299.52 209.024a32 32 0 1 0-45.248 45.248L466.752 512 254.272 724.48a32 32 0 1 0 45.248 45.248L512 602.496l212.48 212.48a32 32 0 0 0-45.248-45.248L557.248 512z',
                                            onclick: function() {
                                                myChart.dispose();
                                            }
                                        }
                                    }
                                },
                                legend: {
                                    top: '5%',
                                    left: 'center'
                                },
                                series: [
                                    {
                                        name: 'Data',
                                        type: 'pie',
                                        radius: ['40%', '70%'],
                                        avoidLabelOverlap: false,
                                        label: {
                                            show: false,
                                            position: 'center'
                                        },
                                        emphasis: {
                                            label: {
                                                show: true,
                                                fontSize: '20',
                                                fontWeight: 'bold'
                                            }
                                        },
                                        labelLine: {
                                            show: false
                                        },
                                        data: response.x.map((x, index) => ({
                                            value: response.y0[index],
                                            name: x
                                        }))
                                    }
                                ]
                            };
                        } else {
                            option = {
                                tooltip: {
                                    trigger: 'axis',
                                    axisPointer: {
                                        type: 'cross',
                                        label: {
                                            backgroundColor: '#6a7985'
                                        }
                                    }
                                },
                                toolbox: {
                                    feature: {
                                        saveAsImage: { show: true },
                                        restore: { show: true },
                                        dataView: { show: true, readOnly: false },
                                        myDarkMode: {
                                            show: true,
                                            title: 'Dark Mode',
                                            icon: 'path://M512 0C229.23072 0 0 229.23072 0 512s229.23072 512 512 512 512-229.23072 512-512S794.76928 0 512 0z m0 938.0864c-234.24 0-426.0864-191.8464-426.0864-426.0864S277.76 85.9136 512 85.9136c55.7312 0 111.4624 11.7248 163.6864 35.0208-32.768 56.32-87.04 94.72-151.0912 105.2672-78.4896 13.7216-147.2-12.288-199.7312-55.808 0 0-12.6976 80.9472-12.6976 119.296 0 136.3968 104.7552 247.9104 239.9232 261.8368 79.872 8.2944 152.576-24.7808 198.3488-80.64 28.2624 48.64 45.568 106.752 45.568 170.3424 0 234.24-191.8464 426.0864-426.0864 426.0864z',
                                            onclick: function () {
                                                darkMode = !darkMode;
                                                updateChartAppearance(myChart);
                                            }
                                        },
                                        myDecalPattern: {
                                            show: true,
                                            title: 'Decal Pattern',
                                            icon: 'path://M50 250 Q 150 50 250 250 T 450 250',
                                            onclick: function () {
                                                decalPattern = !decalPattern;
                                                updateChartAppearance(myChart);
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
                                        myCloseChart: {
                                            show: true,
                                            title: 'Close Chart',
                                            icon: 'path://M512 512l212.48-212.48a32 32 0 0 0-45.248-45.248L512 421.504 299.52 209.024a32 32 0 1 0-45.248 45.248L466.752 512 254.272 724.48a32 32 0 1 0 45.248 45.248L512 602.496l212.48 212.48a32 32 0 0 0-45.248-45.248L557.248 512z',
                                            onclick: function() {
                                                myChart.dispose();
                                            }
                                        }
                                    }
                                },
                                xAxis: {
                                    type: 'category',
                                    data: response.x
                                },
                                yAxis: {
                                    type: 'value'
                                },
                                series: [
                                    {
                                        type: chartType,
                                        data: response.y0.map((y, index) => ({
                                            value: y,
                                            itemStyle: {
                                                color: response.colors ? response.colors[index] : null
                                            }
                                        }))
                                    }
                                ]
                            };
                        }

                        myChart.setOption(option);
                        resolve();
                    },
                    error: function(xhr, status, error) {
                        console.error("Error: ", status, error);
                        console.error("Response: ", xhr.responseText);
                        reject(error);
                    }
                });
            }

            function updateChartAppearance(chart) {
                const option = chart.getOption();
                if (darkMode) {
                    option.backgroundColor = '#333';
                    option.textStyle = {
                        color: '#fff'
                    };
                } else {
                    option.backgroundColor = '#fff';
                    option.textStyle = {
                        color: '#000'
                    };
                }
                if (decalPattern) {
                    option.series[0].itemStyle = {
                        decal: {
                            symbol: 'rect',
                            symbolSize: 1,
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    };
                } else {
                    option.series[0].itemStyle = {
                        decal: null
                    };
                }
                chart.setOption(option);
            }

            loadChartData();
        }
    });
}

function initializeGeoChart(chartId, markerType, table, column, aggregation) {
    return new Promise((resolve, reject) => {
        var baseLayer = L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }
        );

        var cfg = {
            "radius": 0.2, // Sehr kleiner Radius für feine Details
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
            center: new L.LatLng(37.5, -117), // Zentrum von Kalifornien, Nevada und Utah
            zoom: 6, // Angepasste Zoomstufe
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

        $.ajax({
            url: '/getdata',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(requestData),
            success: function(responseData) {
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
                        count: point.Aggregation // Aggregation from the data
                    });
                });

                map.addLayer(markers);
                if (bounds.length > 0) {
                    map.fitBounds(bounds); // Zoomt auf den Bereich, in dem sich die Punkte befinden
                }

                map.addLayer(heatmapLayer);
                heatmapLayer.setData({
                    max: Math.max(...data.map(point => point.Aggregation)), // Dynamische Anpassung des maximalen Werts
                    data: heatmapPoints
                });

                resolve();
            },
            error: function(error) {
                console.log('Error:', error);
                reject(error);
            }
        });
    });
}

async function loadChartsSequentially(chartConfigs) {
    for (const config of chartConfigs) {
        await initializeChart(config.id, config.xTable, config.xColumn, config.yTable, config.yColumn, config.type, config.aggregation, config.markerType, config.table, config.column);
    }
}
