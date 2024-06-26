let darkMode = false;
let decalPattern = false;
let charts = [];
let filter = [];
let highlightedPoints = {};
let originalData = {};

$(document).ready(async function() {
    await loadChartsSequentially([
        { id: 'myChart1', tables: ['products', 'orders'], columns: ['name', 'total'], type: 'bar', aggregations: ['','Summe'], filters: [] },
        { id: 'myChart2', tables: ['orders', 'orders', 'products'], columns: ['orderDate-YYYY', 'total', 'name'], type: 'dynamicBar', aggregations: ['', 'Summe',''], filters: [] },
        { id: 'myChart3', tables: ['products', 'products'], columns: ['price', 'ingredients'], type: 'scatter', aggregations: ['', ''], filters: [] },
        { id: 'myChart7', tables: ['products', 'products'], columns: ['name', 'price'], type: 'boxplot', aggregations: ['',''], filters: [] },

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

function processScatterData(response) {
    const data = response.x.map((price, index) => ({
        value: [parseFloat(price), response.y0[index].split(',').length]
        
    }));

    return data;
}


function processBoxplotData(response) {
    const dataMap = {};

    // Collect prices per name
    response.x.forEach((name, index) => {
        if (!dataMap[name]) {
            dataMap[name] = [];
        }
        dataMap[name].push(parseFloat(response.y0[index]));
    });

    console.log('Collected Data:', dataMap); // Debugging line

    const x = Object.keys(dataMap);
    const y = x.map(name => {
        const values = dataMap[name];
        values.sort((a, b) => a - b);

        const min = values[0];
        const max = values[values.length - 1];

        const q1 = getPercentile(values, 0.25);
        const median = getPercentile(values, 0.5);
        const q3 = getPercentile(values, 0.75);

        console.log(`Pizza: ${name}, Min: ${min}, Q1: ${q1}, Median: ${median}, Q3: ${q3}, Max: ${max}`); // Debugging line

        const lowerWhisker = min;
        const upperWhisker = max;

        return [lowerWhisker, q1, median, q3, upperWhisker];
    });

    console.log('Processed Boxplot Data:', { x, y }); // Debugging line
    return { x, y };
}

function getPercentile(arr, percentile) {
    const index = (arr.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = lower + 1;
    const weight = index % 1;

    if (upper >= arr.length) return arr[lower];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
}

function processBarData(response) {
    // Daten sortieren
    const sortedData = response.x.map((name, index) => ({
        name: name,
        value: response.y0[index]
    })).sort((a, b) => b.value - a.value); // Sortieren in absteigender Reihenfolge

    return {
        x: sortedData.map(data => data.name),
        y: sortedData.map(data => data.value)
    };
}

function processDynamicBarData(response) {
    const yearProductMap = {};

    response.x.forEach((year, index) => {
        const product = response.y1[index];
        const total = parseFloat(response.y0[index]);

        if (!yearProductMap[year]) {
            yearProductMap[year] = {};
        }

        if (!yearProductMap[year][product]) {
            yearProductMap[year][product] = 0;
        }

        yearProductMap[year][product] += total;
    });

    const years = Object.keys(yearProductMap).sort();
    const products = Array.from(new Set(response.y1));

    const seriesData = products.map(product => {
        return {
            name: product,
            type: 'bar',
            label: {
                show: true,
                position: 'inside',
                formatter: '{c}',
                fontSize: 12,
                fontWeight: 'bold'
            },
            data: years.map(year => yearProductMap[year][product] || 0)
        };
    });

    return { years, seriesData, products };
}


// Hilfsfunktion zur Generierung der Farbskala basierend auf der Anzahl der Zutaten
function generateColorMap(data) {
    const uniqueCounts = [...new Set(data.map(point => point.value[1]))];
    const colorPalette = ['#1f78b4', '#33a02c', '#e31a1c', '#ff7f00', '#6a3d9a', '#b15928'];
    const colorMap = {};

    uniqueCounts.forEach((count, index) => {
        colorMap[count] = colorPalette[index % colorPalette.length];
    });

    return colorMap;
}
function generateChartOptions(chartType, response) {
    let option = {};
    switch (chartType) {
        case 'scatter':
            const scatterData = processScatterData(response);
            const colorMap = generateColorMap(scatterData);

            option = {
                title: {
                    text: ' Correlation between Price vs Number of Ingredients',
                    left: 'center'
                },
                tooltip: {
                    trigger: 'item',
                    axisPointer: {
                        type: 'cross'
                    },
                    formatter: function (params) {
                        return [
                            'Price: $' + params.value[0],
                            'Number of Ingredients: ' + params.value[1]
                        ].join('<br/>');
                    }
                },
                xAxis: {
                    type: 'value',
                    name: 'Price ($)'
                },
                yAxis: {
                    type: 'value',
                    name: 'Number of Ingredients'
                },
                series: [
                    {
                        name: 'Pizzas',
                        type: 'scatter',
                        data: scatterData,
                        itemStyle: {
                            color: function(params) {
                                return colorMap[params.value[1]];
                            }
                        }
                    },
                ]
            };
            break;
        case 'boxplot':
            const boxplotData = processBoxplotData(response);
            console.log('Boxplot Data:', boxplotData); // Debugging line to ensure data is correct

            option = {
                title: {
                    text: 'Price distribution of the pizzas',
                    left: 'center'
                },
                tooltip: {
                    trigger: 'item',
                    axisPointer: {
                        type: 'shadow'
                    },
                    formatter: function (params) {
                        const value = params.data; // Correct reference to the data
                        return [
                            'Pizza: ' + params.name,
                            'Minimum: ' + value[1],
                            'Q1: ' + value[2],
                            'Median: ' + value[3],
                            'Q3: ' + value[4],
                            'Maximum: ' + value[5]
                        ].join('<br/>');
                    }
                },
                xAxis: {
                    type: 'category',
                    data: boxplotData.x,
                    axisLabel: {
                        interval: 0,
                        rotate: 45
                    }
                },
                yAxis: {
                    type: 'value'
                },
                series: [{
                    name: 'Preise',
                    type: 'boxplot',
                    data: boxplotData.y,
                    itemStyle: {
                        borderColor: '#8A2BE2',
                        color: '#FFD700'
                    }
                }]
            };
            break;
        case 'bar':
            const barData = processBarData(response);

            option = {
                title: {
                    text: 'Most Popular Products based on $',
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
                toolbox: {
                    feature: {
                        saveAsImage: {},
                        myDarkMode: {
                            show: true,
                            title: 'Dark Mode',
                            icon: 'path://M512 0C229.23072 0 0 229.23072 0 512s229.23072 512 512 512 512-229.23072 512-512S794.76928 0 512 0z m0 938.0864c-234.24 0-426.0864-191.8464-426.0864-426.0864S277.76 85.9136 512 85.9136c55.7312 0 111.4624 11.7248 163.6864 35.0208-32.768 56.32-87.04 94.72-151.0912 105.2672-78.4896 13.7216-147.2-12.288-199.7312-55.808 0 0-12.6976 80.9472-12.6976 119.296 0 136.3968 104.7552 247.9104 239.9232 261.8368 79.872 8.2944 152.576-24.7808 198.3488-80.64 28.2624 48.64 45.568 106.752 45.568 170.3424 0 234.24-191.8464 426.0864-426.0864 426.0864z',
                            onclick: function () {
                                darkMode = !darkMode;
                                updateChartAppearance(chart);
                            }
                        },
                        myDecalPattern: {
                            show: true,
                            title: 'Decal Pattern',
                            icon: 'path://M50 250 Q 150 50 250 250 T 450 250',
                            onclick: function () {
                                decalPattern = !decalPattern;
                                updateChartAppearance(chart);
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
                            icon: 'path://M512 512l212.48-212.48a32 32 0 0 0-45.248-45.248L512 421.504 299.52 209.024a32 32 0 1 0-45.248 45.248L466.752 512 254.272 724.48a32 32 0 1 0 45.248 45.248L512 602.496l212.48 212.48a32 32 0 0 0 45.248-45.248L557.248 512z',
                            onclick: function() {
                                chart.dispose();
                            }
                        }
                    }
                },
                xAxis: {
                    type: 'category',
                    data: barData.x,
                    axisLabel: {
                        interval: 0,
                        rotate: 45
                    }
                },
                yAxis: {
                    type: 'value'
                },
                series: [{
                    type: 'bar',
                    data: barData.y.map((y, index) => ({
                        value: y,
                        itemStyle: {
                            color: response.colors ? response.colors[index] : null
                        }
                    }))
                }]
            };
            break;
        case 'dynamicBar':
            const { years, seriesData, products } = processDynamicBarData(response);

            option = {
                title: {
                    text: 'Sales by Product and Year',
                    left: 'center'
                },
                tooltip: {
                    trigger: 'item',
                    axisPointer: {
                        type: 'shadow'
                    },
                    formatter: function(params) {
                        return `${params.seriesName}: ${params.value}`;
                    }
                },
                legend: {
                    top: '5%',
                    data: products
                },
                toolbox: {
                    show: true,
                    orient: 'vertical',
                    left: 'right',
                    top: 'center',
                    feature: {
                        mark: { show: true },
                        dataView: { show: true, readOnly: false },
                        magicType: { show: true, type: ['line', 'bar', 'stack'] },
                        restore: { show: true },
                        saveAsImage: { show: true }
                    }
                },
                xAxis: {
                    type: 'category',
                    axisTick: { show: false },
                    data: years,
                    axisLabel: {
                        interval: 0,
                        rotate: 45
                    }
                },
                yAxis: {
                    type: 'value'
                },
                series: seriesData.map(series => ({
                    ...series,
                    barGap: '10%',
                    label: {
                        show: false
                    },
                    itemStyle: {
                        normal: {
                            barBorderRadius: [5, 5, 0, 0],
                        }
                    }
                }))
            };
            break;
        default:
            console.error("Unsupported chart type:", chartType);
    }
    return option;
}

// Function call to initialize chart
async function initializeChart(config) {
    console.log("Initializing chart with config:", config);
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

        if (response.y0.length < 2) {
            console.error("Nicht genügend Daten für Wachstumsraten");
            return;
        }

        originalData[config.id] = response;
        const option = generateChartOptions(config.type, response);
        console.log("Chart options generated:", option);
        myChart.setOption(option);

    } catch (error) {
        console.error("Failed to initialize chart:", error);
    }
}

function handleMouseOver(chartInstance, config, params) {
    if (params.componentType === 'series') {
        const seriesName = params.seriesName;
        charts.forEach(({ chart }) => {
            const option = chart.getOption();
            option.series.forEach((series, index) => {
                if (series.name === seriesName) {
                    series.itemStyle = series.itemStyle || {};
                    series.itemStyle.opacity = 1;
                } else {
                    series.itemStyle = series.itemStyle || {};
                    series.itemStyle.opacity = 0.3;
                }
            });
            chart.setOption(option);
        });
    }
}

function handleMouseOut(chartInstance, config, params) {
    charts.forEach(({ chart }) => {
        const option = chart.getOption();
        option.series.forEach((series) => {
            series.itemStyle = series.itemStyle || {};
            series.itemStyle.opacity = 1;
        });
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
