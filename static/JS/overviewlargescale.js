let chartCount = 0;
const maxCharts = 16;
let charts = [];
let availableTables = [];
let darkMode = false;
let decalPattern = false;

$(document).ready(function() {
    $.get("/tables", function(data) {
        availableTables = data.tables;
        populateTableOptions();
    });
});

function populateTableOptions() {
    const xTable = document.getElementById('xTable');
    const yTable = document.getElementById('yTable');
    availableTables.forEach(table => {
        xTable.innerHTML += `<option value="${table}">${table}</option>`;
        yTable.innerHTML += `<option value="${table}">${table}</option>`;
    });
}

document.getElementById('dataForm').addEventListener('submit', function(event) {
    event.preventDefault();
    if (chartCount < maxCharts) {
        addChart('line');
    } else {
        alert('Maximum number of charts reached.');
    }
});

function addChart(chartType) {
    const chartDiv = document.getElementById('chart');

    const chartInstance = echarts.init(chartDiv);
    charts.push(chartInstance);
    chartCount++;

    updateChart(chartInstance, chartType);
}

function updateChart(chartInstance, chartType) {
    const xTable = document.getElementById('xTable').value;
    const xColumn = document.getElementById('xColumn').value;
    const yTable = document.getElementById('yTable').value;
    const yColumn = document.getElementById('yColumn').value;
    const aggregation = document.getElementById('aggregationSelect').value;

    if (xTable && xColumn && yTable && yColumn) {
        let requestData = { 
            tables: [xTable, yTable],
            columns: [xColumn, yColumn],
            chartType: chartType,
            aggregations: ["", aggregation]
        };

        console.log("Sending request data:", requestData);

        $.ajax({
            url: "/getdata",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify(requestData),
            success: function(response) {
                console.log("Received response:", response);
                const dataX = response.x;
                const dataY = response.y0;

                const series = [{
                    name: yColumn,
                    type: 'line',
                    stack: 'total',
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            {
                                offset: 0,
                                color: 'rgb(255, 158, 68)'
                            },
                            {
                                offset: 1,
                                color: 'rgb(255, 70, 131)'
                            }
                        ])
                    },
                    emphasis: {
                        focus: 'series'
                    },
                    itemStyle: {
                        color: 'rgb(255, 70, 131)'
                    },
                    data: dataY
                }];

                const option = {
                    title: { 
                        left: 'center',
                        text: 'Scale Area Chart' 
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
                        data: [yColumn], 
                        top: '5%' 
                    },
                    xAxis: { 
                        type: 'category', 
                        boundaryGap: false, 
                        data: dataX 
                    },
                    yAxis: { 
                        type: 'value' 
                    },
                    series: series,
                    backgroundColor: darkMode ? '#333' : '#fff',
                    textStyle: { color: darkMode ? '#fff' : '#000' },
                    toolbox: {
                        feature: {
                            saveAsImage: {},
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
                            myCloseChart: {
                                show: true,
                                title: 'Close Chart',
                                icon: 'path://M512 512l212.48-212.48a32 32 0 0 0-45.248-45.248L512 421.504 299.52 209.024a32 32 0 1 0-45.248 45.248L466.752 512 254.272 724.48a32 32 0 1 0 45.248 45.248L512 602.496l212.48 212.48a32 32 0 0 0 45.248-45.248L557.248 512z',
                                onclick: function() {
                                    chartInstance.dispose();
                                    charts = charts.filter(chart => chart !== chartInstance);
                                    chartCount--;
                                }
                            }
                        }
                    },
                    dataZoom: [
                        {
                            type: 'inside',
                            start: 0,
                            end: 100
                        },
                        {
                            start: 0,
                            end: 100
                        }
                    ]
                };

                chartInstance.setOption(option);
            },
            error: function(xhr, status, error) {
                console.error("Error: ", status, error);
            }
        });
    } else {
        console.error("Missing input values for xTable, xColumn, yTable, or yColumn");
    }
}

document.getElementById('xTable').addEventListener('change', function() {
    const xTable = this.value;
    if (xTable) {
        $.post("/columns", { table: xTable }, function(data) {
            const xColumn = document.getElementById('xColumn');
            xColumn.innerHTML = `<option value="">None</option>`;
            data.columns.forEach(column => {
                xColumn.innerHTML += `<option value="${column}">${column}</option>`;
            });
        });
    }
});

document.getElementById('yTable').addEventListener('change', function() {
    const yTable = this.value;
    if (yTable) {
        $.post("/columns", { table: yTable }, function(data) {
            const yColumn = document.getElementById('yColumn');
            yColumn.innerHTML = `<option value="">None</option>`;
            data.columns.forEach(column => {
                yColumn.innerHTML += `<option value="${column}">${column}</option>`;
            });
        });
    }
});

function updateChartAppearance() {
    charts.forEach(chartInstance => {
        const option = chartInstance.getOption();
        option.backgroundColor = darkMode ? '#333' : '#fff';
        option.textStyle = { color: darkMode ? '#fff' : '#000' };
        option.series.forEach(series => {
            series.areaStyle.decal = decalPattern ? {
                symbol: 'circle',
                symbolSize: 4,
                color: 'rgba(0, 0, 0, 0.2)'
            } : null;
        });
        chartInstance.setOption(option);
    });
}