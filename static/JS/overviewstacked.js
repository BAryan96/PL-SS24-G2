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

function getToolboxFeatures() {
  return {
    feature: {
      saveAsImage: {},
      restore: {},
      dataView: { readOnly: false },
      magicType: { type: ['line', 'bar', 'stack'] }
    }
  };
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
                restore: {},
      dataView: { readOnly: false },
      magicType: { type: ['line', 'bar', 'stack'] }
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