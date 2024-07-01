let darkMode = false;
let decalPattern = false;
let charts = [];
let filter = [];
let highlightedPoints = {};
let originalData = {};
let chartConfigs = [];


$(document).ready(async function() {
    await loadChartsSequentially([
        { id: 'myChart1', tables: ['stores','customers'], columns: ['state', 'customerID'], type: 'basicRadar', aggregations: ['', 'Anzahl'], filters: []}, // in Prozent umrechnen.
        { id: 'myChart2', tables: ['orders','customers'], columns: ['orderDate-MM.YYYY','customerID'], type: 'line', aggregations: ['','Anzahl'], filters: [], orderby: ['ASC',''] },
        { id: 'myChart3', tables: ['orders','customers'], columns: ['orderDate-YYYY','customerID'], type: 'treemap', aggregations: ['','Anzahl'], filters: []},
        { id: 'myChart4', tables: ['orders','customers-Right'], columns: ['customerID','customerID'], type: 'pie', aggregations: ['','Anzahl'], filters: []},
        { id: 'myChart5', tables: ['customers','customers','stores','stores'], columns: ['latitude','longitude','latitude','longitude'], type: 'kpi', aggregations: ['','','',''], filters: []},
        { id: 'myChart7', tables: ['customers','customser','customers'], columns: ['customerID', 'longitude', 'latitude'], type: 'dynamicMarkers', aggregations: ['', 'X', 'X'], filters: [] },

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
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function categorizeCustomers(response) {
    let categories = {
        'Customers without Orders (0)': 0,
        'One-Time-Buyers(1)': 0,
        'Occasional Buyers(2-20)': 0,
        'Frequent Buyers (>20)': 0
    };

    response.x.forEach((customerID, index) => {
        const count = response.y0[index];
        if (customerID === null || customerID === 'NULL') {
            categories['Customers without Orders (0)'] += count;
        } else if (count === 1) {
            categories['One-Time-Buyers(1)']++;
        } else if (count <= 20) {
            categories['Occasional Buyers(2-20)']++;
        } else {
            categories['Frequent Buyers (>20)']++;
        }
    });

    return categories;
}



function generateChartOptions(chartType, response, yColumns) {
    let option = {};
    switch (chartType) {
        case 'treemap':
            // Add y0 values to get the total amount
            const totalAmount = response.y0.reduce((sum, value) => sum + value, 0);
        
            // Build treemap data format
            const treemapData = response.x.map((year, index) => ({
                name: year || 'Customers without Orders',  // 'null' in 'x' array handled as 'Customers without Orders'
                value: response.y0[index]
            }));
        
            option = {
                title: {
                    top: 5,
                    left: 'center',
                    text: 'Yearly Order Amounts by Customers'
                },
                tooltip: {
                    formatter: function (info) {
                        let value = info.value;
                        let amount = echarts.format.addCommas(value);
                        return [
                            '<div class="tooltip-title">' +
                            echarts.format.encodeHTML(info.name) +
                            '</div>',
                            'Orders Placed: &nbsp;&nbsp;' + amount
                        ].join('');
                    }
                },
                series: [{
                    type: 'treemap',
                    label: {
                        position: 'insideTopLeft',
                        formatter: function (params) {
                            let arr = [
                                '{name|' + params.name + '}',
                                '{hr|}',
                                '{amount|Orders Placed: ' + echarts.format.addCommas(params.value) + '}'
                            ];
                            return arr.join('\n');
                        },
                        rich: {
                            amount: {
                                fontSize: 22,
                                lineHeight: 30,
                                color: 'yellow'
                            },
                            label: {
                                fontSize: 9,
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: '#fff',
                                borderRadius: 2,
                                padding: [2, 4],
                                lineHeight: 25,
                                align: 'right'
                            },
                            name: {
                                fontSize: 12,
                                color: '#fff'
                            },
                            hr: {
                                width: '100%',
                                borderColor: 'rgba(255,255,255,0.2)',
                                borderWidth: 0.5,
                                height: 0,
                                lineHeight: 10
                            }
                        }
                    },
                    itemStyle: {
                        borderColor: 'black'
                    },
                    data: treemapData
                }]
            };
            break;
        
        
        
        case 'line':
            // Funktion zum Konvertieren von Datumsstring in ein Date-Objekt
            function parseDate(dateString) {
                const [month, year] = dateString.split('.').map(Number);
                return new Date(year, month - 1);
            }
        
            // Daten nach Datum sortieren
            const sortedData = response.x.map((date, index) => ({
                date,
                value: response.y0[index]
            })).sort((a, b) => parseDate(a.date) - parseDate(b.date));
        
            // Getrennte Arrays für sortierte Daten
            const sortedX = sortedData.map(data => data.date);
            const sortedY0 = sortedData.map(data => data.value);
        
            option = {
                title: {
                    text: 'Customer Development',
                    left: 'center'
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross',
                        label: {
                            backgroundColor: '#6a7985'
                        }
                    }
                },
                legend: {
                    data: ['Sales'],
                    top: '5%'
                },
                toolbox: {
                    feature: {
                        saveAsImage: {},
                        restore: {},
                        dataView: {}
                    }
                },
                xAxis: {
                    type: 'category',
                    boundaryGap: false,
                    data: sortedX
                },
                yAxis: {
                    type: 'value'
                },
                series: [
                    {
                        name: 'Customer Orders Per Month',
                        type: 'line',
                        data: sortedY0,
                        itemStyle: {
                            color: '#c23531'  // Rot
                        }
                    }
                ],
                backgroundColor: darkMode ? '#333' : '#fff',
                textStyle: {
                    color: darkMode ? '#fff' : '#000'
                }
            };
            break;
        
        case 'bar':
            const customers = response.x; // Kunden
            const orderCounts = response.y0; // Anzahl der Bestellungen

            option = {
                title: { text: 'Top 20 Customers by Orders', left: 'center' },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'shadow'
                    }
                },
                xAxis: {
                    type: 'category',
                    data: customers,
                    axisLabel: {
                        interval: 0,
                        rotate: 45
                    }
                },
                yAxis: {
                    type: 'value'
                },
                series: [{
                    name: 'Order Count',
                    type: 'bar',
                    data: orderCounts,
                    itemStyle: {
                        color: darkMode ? '#c23531' : '#2f4554'
                    }
                }],
                backgroundColor: darkMode ? '#333' : '#fff',
                textStyle: { color: darkMode ? '#fff' : '#000' },
                toolbox: { feature: getToolboxFeatures() }
            };
            break;
        case 'basicRadar':
            const regions = response.x; // Regionen (States)
            const customerCounts = response.y0; // Anzahl der Kunden

            const totalCustomers = customerCounts.reduce((a, b) => a + b, 0);
            const indicators = regions.map((region, index) => ({
                name: `${region} (${formatNumber(customerCounts[index])})`,
                max: Math.max(...customerCounts) // Maximalwert für das Radar-Diagramm
            }));

            const seriesDatabasicRadar = [{
                value: customerCounts,
                name: 'Customer Count'
            }];

            option = {
                title: { text: 'Customers per Region', left: 'center' },
                radar: {
                    indicator: indicators,
                    shape: 'circle',
                    splitNumber: 5 // Anzahl der Schichten im Radar
                },
                tooltip: {
                    show: false // Tooltip deaktiviert
                },
                series: [{
                    name: 'Customers per Region',
                    type: 'radar',
                    data: seriesDatabasicRadar,
                    symbol: 'circle',
                    symbolSize: 10,
                    itemStyle: {
                        emphasis: {
                            borderColor: '#333',
                            borderWidth: 2
                        }
                    }
                }],
                backgroundColor: darkMode ? '#333' : '#fff',
                textStyle: { color: darkMode ? '#fff' : '#000' },
                toolbox: { feature: getToolboxFeatures() }
            };
            break;
            
case 'boxplot':
    // Group data by product name
    const groupedData = response.x.reduce((acc, year, index) => {
        const productName = response.y1[index];
        const total = response.y3[index];

        if (!acc[productName]) {
            acc[productName] = [];
        }

        acc[productName].push(total);
        return acc;
    }, {});

    // Format data for boxplot
    const boxplotData = Object.entries(groupedData).map(([productName, totals]) => {
        totals.sort((a, b) => a - b);

        const min = Math.min(...totals);
        const max = Math.max(...totals);
        const q1 = d3.quantile(totals, 0.25);
        const median = d3.quantile(totals, 0.5);
        const q3 = d3.quantile(totals, 0.75);

        return {
            name: productName,
            value: [min, q1, median, q3, max],
            category: response.y2[response.y1.indexOf(productName)]
        };
    });

    option = {
        title: {
            text: 'Boxplot of Product Sales by Year',
            left: 'center'
        },
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                return `
                    Product: ${params.name}<br/>
                    Category: ${params.data.category}<br/>
                    Min: ${params.value[1]}<br/>
                    Q1: ${params.value[2]}<br/>
                    Median: ${params.value[3]}<br/>
                    Q3: ${params.value[4]}<br/>
                    Max: ${params.value[5]}
                `;
            }
        },
        xAxis: {
            type: 'category',
            data: boxplotData.map(item => item.name),
            axisLabel: {
                interval: 0,
                rotate: 45
            }
        },
        yAxis: {
            type: 'value',
            name: 'Total Sales'
        },
        series: [{
            name: 'Boxplot',
            type: 'boxplot',
            data: boxplotData.map(item => item.value)
        }],
        backgroundColor: darkMode ? '#333' : '#fff',
        textStyle: { color: darkMode ? '#fff' : '#000' },
        toolbox: { feature: getToolboxFeatures() }
    };
    break;


        case 'stackedBar':
            const { months2, processedData, states } = processStackedBarData(response);

            option = {
                title: {
                    text: 'Monthly Sales by State',
                    left: 'center'
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'shadow'
                    },
                },
                legend: {
                    data: states,
                    top: 40,
                    padding: [20, 5, 5, 5]
                },
                xAxis: {
                    type: 'category',
                    data: months2,
                    axisLabel: {
                        interval: 0,
                        rotate: 45
                    }
                },
                yAxis: {
                    type: 'value'
                },
                series: processedData,
                backgroundColor: darkMode ? '#333' : '#fff',
                textStyle: { color: darkMode ? '#fff' : '#000' },
                toolbox: { feature: getToolboxFeatures() },
            };
            break;

            case 'negativBar':
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
                        data: response.x, // Alle Monate werden angezeigt
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
    const categories = categorizeCustomers(response);
    const pieData = Object.keys(categories).map(key => {
        return { value: categories[key], name: key };
    });

    option = {
        title: {
            text: 'Customer Purchase Categories',
            left: 'center'
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b} : {c} ({d}%)'
        },
        legend: {
            orient: 'horizontal',
            top: '10%',
            left: 'center',
            data: Object.keys(categories)
        },
        series: [
            {
                name: 'Customers',
                type: 'pie',
                radius: '55%',
                center: ['50%', '60%'],
                data: pieData,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
                label: {
                    show: true,
                    formatter: '{b}: {d}%'
                },
                labelLine: {
                    show: true
                }
            }
        ],
        backgroundColor: darkMode ? '#333' : '#fff',
        textStyle: { color: darkMode ? '#fff' : '#000' },
        toolbox: { feature: getToolboxFeatures() }
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
                // Extrahiere die verschiedenen Jahre und Monate aus den Daten
                const years = [...new Set(response.x)];
                const months = response.y0.slice(0, 12); // Da jeder Monat einmal pro Jahr vorkommt
            
                // Erstelle die Datenstruktur für die einzelnen Jahre
                const seriesData = years.map(year => ({
                    name: year,
                    type: 'line',
                    areaStyle: {},
                    emphasis: { focus: 'series' },
                    data: response.y1.filter((_, index) => response.x[index] === year),
                    itemStyle: { color: echarts.color.modifyHSL('#c23531', years.indexOf(year) * 120) }
                }));
            
                option = {
                    title: { left: 'center', text: 'Stacked Area Chart' },
                    tooltip: { trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } } },
                    legend: { top: '5%', left: 'center' },
                    xAxis: { type: 'category', data: months },
                    yAxis: { type: 'value' },
                    series: seriesData,
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
async function loadDynamicMarkers(chartId) {
    const requestData = {
        tables: ['customers','customers','customers'],
        columns: ['customerID', 'longitude', 'latitude'],
        chartType: 'dynamicMarkers',
        aggregations: ['', 'X', 'X'],
        filters: filter
    };

    fetchData(requestData).then(responseData => {
        if (!responseData.hasOwnProperty('x') || !responseData.hasOwnProperty('y0') || !responseData.hasOwnProperty('y1')) {
            console.error('Data does not have the required properties:', responseData);
            return;
        }

        const data = responseData.x.map((x, index) => ({
            id: x,
            longitude: parseFloat(responseData.y0[index]),
            latitude: parseFloat(responseData.y1[index]),
        }));

        const map = new L.Map(chartId, {
            center: new L.LatLng(37.5, -117),
            zoom: 6,
            layers: [L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            })]
        });

        // Create a custom control for the title
        const titleControl = L.control({ position: 'topright' });

        titleControl.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'map-title');
            div.innerHTML = '<h2>Customer Locations</h2>'; // Customize the title as needed
            div.style.backgroundColor = 'transparent';
            div.style.padding = '10px';
            div.style.fontFamily = 'Arial, sans-serif';
            div.style.fontSize = '12px';
            return div;
        };

        titleControl.addTo(map);

        // Create a marker cluster group
        const markers = L.markerClusterGroup();

        data.forEach(point => {
            const markerOptions = {
                radius: 3,
                fillColor: 'pink',
                color: "#000",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.6
            };

            const marker = L.circleMarker([point.latitude, point.longitude], markerOptions);
            const popupContent = `<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}`;
            marker.bindPopup(popupContent);
            marker.on('click', () => handleMarkerClick(marker, point));

            // Add marker to cluster group
            markers.addLayer(marker);
        });

        // Add the marker cluster group to the map
        map.addLayer(markers);
    }).catch(error => {
        console.error('Error:', error);
    });
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    const R = 6371; // Radius of the Earth in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
}

function initializeKPI(config, averageDistanceKm, averageDistanceMiles) {
    const kpiContainer = document.getElementById(config.id);
    kpiContainer.innerHTML = `
        <div class="kpi-section" style="margin-bottom: 20px;">
            <h3 style="font-size: 24px;">Durchschnittliche Entfernung</h3>
            <p style="font-size: 20px; font-weight: bold;">
                ${averageDistanceKm.toFixed(2)} km / ${averageDistanceMiles.toFixed(2)} miles
            </p>
        </div>
    `;
}

async function initializeChart(config) {
    if (config.type === 'dynamicMarkers') {
        await loadDynamicMarkers(config.id);
    } else if (config.type === 'kpi') {
        try {
            let response = await fetchData({
                tables: config.tables,
                columns: config.columns,
                chartType: config.type,
                aggregations: config.aggregations,
                filters: config.filters
            });

            const customerLatitudes = response.x.map(parseFloat);
            const customerLongitudes = response.y0.map(parseFloat);
            const storeLatitudes = response.y1.map(parseFloat);
            const storeLongitudes = response.y2.map(parseFloat);

            let totalDistanceKm = 0;
            let count = 0;

            customerLatitudes.forEach((custLat, index) => {
                const custLon = customerLongitudes[index];
                let minDistanceKm = Infinity;

                storeLatitudes.forEach((storeLat, sIndex) => {
                    const storeLon = storeLongitudes[sIndex];
                    const distanceKm = haversineDistance(custLat, custLon, storeLat, storeLon);
                    if (distanceKm < minDistanceKm) {
                        minDistanceKm = distanceKm;
                    }
                });

                if (minDistanceKm !== Infinity) {
                    totalDistanceKm += minDistanceKm;
                    count++;
                }
            });

            const averageDistanceKm = totalDistanceKm / count;
            const averageDistanceMiles = averageDistanceKm * 0.621371;

            response.chartId = config.id;
            originalData[config.id] = response;

            initializeKPI(config, averageDistanceKm, averageDistanceMiles);
        } catch (error) {
            console.error("Failed to initialize KPI chart:", error);
        }
    } else {
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
            filters: config.filters,
            orderby: config.orderby
        };

        try {
            let response = await fetchData(requestData);
            response.chartId = config.id;

            originalData[config.id] = response;
            const option = generateChartOptions(config.type, response, config.columns.slice(2));
            myChart.setOption(option);
            myChart.on('click', params => handleChartClick(myChart, config, params));
        } catch (error) {
            console.error("Failed to initialize chart:", error);
        }
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

    const filteredData = { x: [], y0: [], y1: [] };

    data.x.forEach((x, index) => {
        const match = applicableFilter.some(f => f.filterValue === x);
        if (match) {
            filteredData.x.push(x);
            filteredData.y0.push(data.y0[index]);
            if (data.y1) {
                filteredData.y1.push(data.y1[index]);
            }
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

async function loadChartsSequentially(configs) {
    charts = []; // Clear existing charts
    chartConfigs = configs; // Store the configurations for export
    for (const config of configs) {
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
    if (chartConfigs.length === 0) {
        alert("No JSON Data available to export.");
        return;
    }
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
