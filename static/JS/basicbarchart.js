let chartCount = 0;
const maxCharts = 16;
let draggedElement = null;
let offsetX, offsetY;
let charts = [];

$(document).ready(function() {
    $.get("/tables", function(data) {
        window.availableTables = data.tables;
    });
});

document.getElementById('chartTypeSelect').addEventListener('change', function() {
    const chartType = this.value;
    if (chartType) {
        if (chartCount < maxCharts) {
            addChart(chartType);
            this.value = ""; // Reset the select box
        } else {
            alert('Maximum number of charts reached.');
        }
    }
});

function addChart(chartType) {
    const chartContainer = document.getElementById('chartContainer');
    
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart';
    chartDiv.style.width = '600px';
    chartDiv.style.height = '400px';
    chartDiv.style.position = 'absolute';
    chartDiv.style.top = '100px';
    chartDiv.style.left = '100px';
    chartContainer.appendChild(chartDiv);
    chartCount++;

    const chartInstance = echarts.init(chartDiv);
    charts.push(chartInstance);

    const closeButton = document.createElement('button');
    closeButton.className = 'close-btn';
    closeButton.innerText = 'X';
    closeButton.onclick = () => {
        chartContainer.removeChild(chartDiv);
        chartCount--;
        charts = charts.filter(chart => chart !== chartInstance);
    };
    chartDiv.appendChild(closeButton);

    const tableSelect1 = document.createElement('select');
    tableSelect1.className = 'table-select';
    tableSelect1.innerHTML = `<option value="">Select Table for X Axis</option>`;
    availableTables.forEach(table => {
        tableSelect1.innerHTML += `<option value="${table}">${table}</option>`;
    });
    chartDiv.appendChild(tableSelect1);

    const xAxisSelect = document.createElement('select');
    xAxisSelect.className = 'chart-select';
    xAxisSelect.innerHTML = `<option value="">Select X Axis</option>`;
    chartDiv.appendChild(xAxisSelect);

    const tableSelect2 = document.createElement('select');
    tableSelect2.className = 'table-select';
    tableSelect2.innerHTML = `<option value="">Select Table for Y Axis</option>`;
    availableTables.forEach(table => {
        tableSelect2.innerHTML += `<option value="${table}">${table}</option>`;
    });
    chartDiv.appendChild(tableSelect2);

    const yAxisSelect = document.createElement('select');
    yAxisSelect.className = 'chart-select';
    yAxisSelect.innerHTML = `<option value="">Select Y Axis</option>`;
    chartDiv.appendChild(yAxisSelect);

    let seriesData = [];

    function updateChart() {
        const xAxisType = xAxisSelect.value;
        const yAxisType = yAxisSelect.value;

        if (xAxisType && yAxisType) {
            $.post("/getdata", { table: tableSelect1.value, column: xAxisType }, function(dataX) {
                $.post("/getdata", { table: tableSelect2.value, column: yAxisType }, function(dataY) {
                    seriesData = dataX.data.map((x, index) => ({
                        value: [x, dataY.data[index]],
                        itemStyle: { color: '#5470c6' }
                    }));

                    let option = {
                        xAxis: {
                            type: 'category',
                            data: dataX.data,
                        },
                        yAxis: {
                            type: 'value'
                        },
                        series: [{
                            data: seriesData,
                            type: chartType
                        }]
                    };

                    if (chartType === 'bar') {
                        option = {
                            series: [{
                                type: 'bar',
                                data: seriesData.map(data => ({
                                    value: data.value[1],
                                    name: data.value[0],
                                    itemStyle: data.itemStyle
                                }))
                            }]
                        };
                    }

                    chartInstance.setOption(option);
                });
            });
        }
    }

    tableSelect1.addEventListener('change', function() {
        if (this.value) {
            $.post("/columns", { table: this.value }, function(data) {
                xAxisSelect.innerHTML = `<option value="">Select X Axis</option>`;
                data.columns.forEach(column => {
                    xAxisSelect.innerHTML += `<option value="${column}">${column}</option>`;
                });
            });
        }
    });

    tableSelect2.addEventListener('change', function() {
        if (this.value) {
            $.post("/columns", { table: this.value }, function(data) {
                yAxisSelect.innerHTML = `<option value="">Select Y Axis</option>`;
                data.columns.forEach(column => {
                    yAxisSelect.innerHTML += `<option value="${column}">${column}</option>`;
                });
            });
        }
    });

    xAxisSelect.addEventListener('change', updateChart);
    yAxisSelect.addEventListener('change', updateChart);

    chartDiv.addEventListener('contextmenu', function(event) {
        event.preventDefault();
    });

    chartInstance.on('contextmenu', function(params) {
        if (params.componentType === 'series') {
            showColorPicker(params.event.event, chartInstance, params.dataIndex);
        }
    });

    chartInstance.on('click', function(params) {
        if (params.componentType === 'series') {
            handleFilter(params.data);
        }
    });

    chartDiv.addEventListener('mousedown', function(event) {
        draggedElement = chartDiv;
        offsetX = event.clientX - chartDiv.getBoundingClientRect().left;
        offsetY = event.clientY - chartDiv.getBoundingClientRect().top;
    });

    document.addEventListener('mousemove', function(event) {
        if (draggedElement) {
            draggedElement.style.left = `${event.clientX - offsetX}px`;
            draggedElement.style.top = `${event.clientY - offsetY}px`;
        }
    });

    document.addEventListener('mouseup', function() {
        draggedElement = null;
    });
}

function showColorPicker(event, chartInstance, dataIndex) {
    const optionsMenu = document.createElement('div');
    optionsMenu.className = 'options-menu';

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'color-picker';
    colorPicker.addEventListener('input', function () {
        const option = chartInstance.getOption();
        option.series[0].data[dataIndex].itemStyle = { color: colorPicker.value };
        chartInstance.setOption(option);
    });

    colorPicker.addEventListener('change', function () {
        document.body.removeChild(optionsMenu);
    });

    optionsMenu.appendChild(colorPicker);
    document.body.appendChild(optionsMenu);
    optionsMenu.style.position = 'absolute';
    optionsMenu.style.left = `${event.pageX}px`;
    optionsMenu.style.top = `${event.pageY}px`;
    optionsMenu.style.zIndex = 1000; // Ensure it's in the foreground

    document.addEventListener('click', function removeOptionsMenu(event) {
        if (!optionsMenu.contains(event.target)) {
            document.body.removeChild(optionsMenu);
            document.removeEventListener('click', removeOptionsMenu);
        }
    }, { once: true });
}

function handleFilter(data) {
    const [xValue] = data.value;
    charts.forEach(chart => {
        const options = chart.getOption();
        const series = options.series[0];
        const newData = series.data.filter(item => item.value[0] === xValue);
        series.data = newData;
        chart.setOption(options);

        //anpassen
    });
}