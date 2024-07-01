let chartCount = 0;
    const maxCharts = 16;
    let draggedElement = null;
    let offsetX, offsetY;
    let charts = [];
    let filter = [];
    let highlightedPoints = {};
    let updateQueue = [];
    let updating = false;
    let darkMode = false;
    let decalPattern = false;

    $(document).ready(function() {
        $.get("/tables", function(data) {
            window.availableTables = data.tables;
            const xTableSelect = $('#xTable');
            const yTableSelect = $('#yTable1');
            data.tables.forEach(table => {
                xTableSelect.append(new Option(table, table));
                yTableSelect.append(new Option(table, table));
            });
        });

        $('#xTable').change(function() {
            const table = $(this).val();
            if (table) {
                $.post("/columns", { table: table }, function(data) {
                    const xColumnSelect = $('#xColumn');
                    xColumnSelect.empty().append(new Option('None', ''));
                    data.columns.forEach(column => {
                        xColumnSelect.append(new Option(column, column));
                    });
                });
            }
        });

        $('#yTable1').change(function() {
            const table = $(this).val();
            if (table) {
                $.post("/columns", { table: table }, function(data) {
                    const yColumnSelect = $('#yColumn1');
                    yColumnSelect.empty().append(new Option('None', ''));
                    data.columns.forEach(column => {
                        yColumnSelect.append(new Option(column, column));
                    });
                });
            }
        });

        $('#dataForm').submit(function(event) {
            event.preventDefault();
            const xTable = $('#xTable').val();
            const xColumn = $('#xColumn').val();
            const yTable = $('#yTable1').val();
            const yColumn = $('#yColumn1').val();
            const aggregation = $('#aggregationSelect').val();

            if (xTable && xColumn && yTable && yColumn) {
                const requestData = {
                    tables: [xTable, yTable],
                    columns: [xColumn, yColumn],
                    chartType: 'bar',
                    aggregations: ["", aggregation],
                    filters: filter
                };

                $.ajax({
                    url: "/getdata",
                    type: "POST",
                    contentType: "application/json",
                    data: JSON.stringify(requestData),
                    success: function(response) {
                        const chart = echarts.init(document.getElementById('chart'));
                        const option = {
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
                                data: response.x
                            },
                            yAxis: {
                                type: 'value'
                            },
                            series: [
                                {
                                    type: 'bar',
                                    data: response.y0.map((y, index) => ({
                                        value: y,
                                        itemStyle: {
                                            color: response.colors ? response.colors[index] : null
                                        }
                                    }))
                                }
                            ]
                        };
                        chart.setOption(option);
                    },
                    error: function(xhr, status, error) {
                        console.error("Error: ", status, error);
                        console.error("Response: ", xhr.responseText);
                    }
                });
            } else {
                alert('Please select all required fields.');
            }
        });
    });

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