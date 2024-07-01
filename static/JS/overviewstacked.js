let charts = [];
let chartInstance = echarts.init(document.getElementById('chart'));
let darkMode = false;
let decalPattern = false;

$(document).ready(function() {
    $.get("/tables", function(data) {
        if (data.tables) {
            const tableOptions = data.tables.map(table => `<option value="${table}">${table}</option>`).join('');
            $('#xTable, #yTable, #yTable2, #yTable3').append(tableOptions);
        }
    });

    $('#xTable').change(function() {
        loadColumns($(this).val(), '#xColumn');
    });

    $('#yTable').change(function() {
        loadColumns($(this).val(), '#yColumn');
    });

    $('#yTable2').change(function() {
        loadColumns($(this).val(), '#yColumn2');
    });

    $('#yTable3').change(function() {
        loadColumns($(this).val(), '#yColumn3');
    });

    $('#dataForm').submit(function(event) {
        event.preventDefault();
        let xTable = $('#xTable').val();
        let xColumn = $('#xColumn').val();
        let yTable = $('#yTable').val();
        let yColumn = $('#yColumn').val();
        let aggregation = $('#aggregationSelect').val();

        let requestData = {
            tables: [xTable, yTable].filter(value => value !== ""),
            columns: [xColumn, yColumn].filter(value => value !== ""),
            chartType: 'area',
            aggregations: [aggregation].filter((value, index) => (value !== "")),
            filters: []
        };

        requestData.aggregations.unshift("");

        $.ajax({
            url: "/getdata",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify(requestData),
            success: function(response) {
                const areaData = {
                    categories: response.x,
                    series: [{ name: 'Series 1', data: response.y0 }]
                };
                renderChart(areaData);
            },
            error: function(xhr, status, error) {
                console.error("Error: ", status, error);
            }
        });
    });
});

function loadColumns(table, columnSelectId) {
    if (table) {
        $.post("/columns", { table: table }, function(data) {
            const columnOptions = data.columns.map(column => `<option value="${column}">${column}</option>`).join('');
            $(columnSelectId).empty().append(`<option value="">None</option>${columnOptions}`);
        });
    }
}

function renderChart(areaData) {
    let option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross',
                label: { backgroundColor: '#6a7985' }
            }
        },
        legend: { data: areaData.series.map(series => series.name) },
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
                    }
                }
            }
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: areaData.categories
        },
        yAxis: {
            type: 'value'
        },
        series: areaData.series.map(series => ({
            name: series.name,
            type: 'line',
            areaStyle: {},
            emphasis: { focus: 'series' },
            data: series.data
        })),
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
}

function togglePopup() {
    const popup = document.getElementById('popup');
    popup.classList.toggle('hidden');
}

function addLines() {
    let xTable = $('#xTable').val();
    let xColumn = $('#xColumn').val();
    let yTable = $('#yTable').val();
    let yColumn = $('#yColumn').val();
    let aggregation = $('#aggregationSelect').val();

    let yTable2 = $('#yTable2').val();
    let yColumn2 = $('#yColumn2').val();
    let aggregation2 = $('#aggregationSelect2').val();

    let yTable3 = $('#yTable3').val();
    let yColumn3 = $('#yColumn3').val();
    let aggregation3 = $('#aggregationSelect3').val();

    let tables = [xTable, yTable, yTable2, yTable3].filter(value => value !== "");
    let columns = [xColumn, yColumn, yColumn2, yColumn3].filter(value => value !== "");
    let aggregations = [aggregation, aggregation2, aggregation3].filter(value => value !== "");


    let requestData = {
        tables: tables,
        columns: columns,
        chartType: 'area',
        aggregations: aggregations,
        filters: []
    };

    requestData.aggregations.unshift("");

    $.ajax({
        url: "/getdata",
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify(requestData),
        success: function(response) {
            const newSeries = [
                { name: 'Series 1', data: response.y0 },
                { name: 'Series 2', data: response.y1 },
                { name: 'Series 3', data: response.y2 }
            ].filter(series => series.data);

            const areaData = {
                categories: response.x,
                series: newSeries
            };

            renderChart(areaData);
            togglePopup();
        },
        error: function(xhr, status, error) {
            console.error("Error: ", status, error);
        }
    });
}

function updateChartAppearance() {
    chartInstance.setOption({
        backgroundColor: darkMode ? '#333' : '#fff',
        series: chartInstance.getOption().series.map(series => ({
            ...series,
            label: { color: darkMode ? '#fff' : '#000' },
            itemStyle: {
                decal: decalPattern ? { symbol: 'rect', color: 'rgba(0,0,0,0.1)' } : null
            }
        }))
    });
}