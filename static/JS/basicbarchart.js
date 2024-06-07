let chartCount = 0;
        const maxCharts = 16;
        let charts = [];
        let darkMode = false;
        let decalPattern = false;
    
        $(document).ready(function() {
            $.get("/tables", function(data) {
                window.availableTables = data.tables;
                populateTableSelect('xTable2');
                populateTableSelect('yTable2');
                console.log("Available tables loaded:", data.tables);
            });
    
            $('#xTable2').on('change', function() {
                updateColumns('xTable2', 'xColumn2');
            });
    
            $('#yTable2').on('change', function() {
                updateColumns('yTable2', 'yColumn2');
            });
    
            $('#dataForm2').on('submit', function(event) {
                event.preventDefault();
                if (chartCount < maxCharts) {
                    addChart('line'); // Assuming the type of chart to add is 'line'
                } else {
                    alert('Maximum number of charts reached.');
                }
            });
        });
    
        function populateTableSelect(tableSelectId) {
            const tableSelect = document.getElementById(tableSelectId);
            window.availableTables.forEach(table => {
                const option = document.createElement('option');
                option.value = table;
                option.textContent = table;
                tableSelect.appendChild(option);
            });
        }
    
        function updateColumns(tableSelectId, columnSelectId) {
            const tableSelect = document.getElementById(tableSelectId);
            const columnSelect = document.getElementById(columnSelectId);
            const selectedTable = tableSelect.value;
    
            if (selectedTable === "None") {
                columnSelect.innerHTML = '<option value="None">None</option>';
                return;
            }
    
            $.ajax({
                url: '/columns',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ table: selectedTable }),
                success: function(response) {
                    columnSelect.innerHTML = '<option value="None">None</option>';
                    response.columns.forEach(column => {
                        const option = document.createElement('option');
                        option.value = column;
                        option.textContent = column;
                        columnSelect.appendChild(option);
                    });
                    console.log(`Columns for table ${selectedTable} loaded:`, response.columns);
                }
            });
        }
    
        function addChart(chartType) {
            const chartContainer = document.getElementById('chart2Content');
            const chartDiv = document.createElement('div');
            chartDiv.className = 'chart';
            chartContainer.appendChild(chartDiv);
            chartCount++;
    
            const chartInstance = echarts.init(chartDiv);
            charts.push(chartInstance);
    
            const xAxisTable = document.getElementById('xTable2').value;
            const xAxisColumn = document.getElementById('xColumn2').value;
            const yAxisTable = document.getElementById('yTable2').value;
            const yAxisColumn = document.getElementById('yColumn2').value;
            const aggregation = document.getElementById('aggregationSelect2').value;
    
            if (xAxisTable !== "None" && xAxisColumn !== "None" && yAxisTable !== "None" && yAxisColumn !== "None") {
                $.post("/getdata", { table: xAxisTable, column: xAxisColumn }, function(dataX) {
                    console.log(`Data loaded for X-Axis (${xAxisTable} - ${xAxisColumn}):`, dataX);
                    $.post("/getdata", { table: yAxisTable, column: yAxisColumn, aggregation: aggregation }, function(dataY) {
                        console.log(`Data loaded for Y-Axis (${yAxisTable} - ${yAxisColumn}):`, dataY);
                        if (dataX.data && dataY.data) {
                            const option = {
                                xAxis: {
                                    type: 'category',
                                    data: dataX.data,
                                },
                                yAxis: {
                                    type: 'value'
                                },
                                series: [{
                                    data: dataY.data,
                                    type: chartType,
                                    itemStyle: { color: '#5470c6' }
                                }],
                                backgroundColor: darkMode ? '#333' : '#fff',
                                textStyle: { color: darkMode ? '#fff' : '#000' },
                                tooltip: { 
                                    trigger: 'axis',
                                    axisPointer: {
                                        type: 'cross',
                                        label:{
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
                                                updateChartAppearance();
                                            }
                                        },
                                        myDecalPattern: {
                                            show: true,
                                            title: 'Decal Pattern',
                                            icon: 'path://M50 250 Q 150 50 250 250 T 450 250',
                                            onclick: function () {
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
                                        }
                                    }
                                }
                            };
                            chartInstance.setOption(option);
                            chartInstance.on('contextmenu', function(params) {
                                if (params.componentType === 'series') {
                                    showColorPicker(params.event.event, chartInstance, params.dataIndex);
                                }
                            });
                        } else {
                            console.error("Data loading error: ", dataX, dataY);
                        }
                    });
                });
            }
        }
    
        function updateChartAppearance() {
            charts.forEach(chartInstance => {
                const option = chartInstance.getOption();
                option.backgroundColor = darkMode ? '#333' : '#fff';
                option.textStyle = { color: darkMode ? '#fff' : '#000' };
                option.series.forEach(series => {
                    series.itemStyle = series.itemStyle || {};
                    series.itemStyle.decal = decalPattern ? { symbol: 'path://M50 250 Q 150 50 250 250 T 450 250' } : null;
                });
                chartInstance.setOption(option);
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
            optionsMenu.style.zIndex = 1000; 
    
            document.addEventListener('click', function removeOptionsMenu(event) {
                if (!optionsMenu.contains(event.target)) {
                    document.body.removeChild(optionsMenu);
                    document.removeEventListener('click', removeOptionsMenu);
                }
            }, { once: true });
        }