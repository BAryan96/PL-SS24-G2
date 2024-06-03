let chartCount = 0;
const maxCharts = 16;
let draggedElement = null;
let offsetX, offsetY;
let charts = [];
let filter = []; // Aktualisieren Sie den Filter als Array
let highlightedPoints = {};  // Globale Datenstruktur zum Speichern der hervorgehobenen Datenpunkte
let updateQueue = [];  // Warteschlange für die Diagrammaktualisierungen
let updating = false;  // Flag, um anzuzeigen, ob eine Aktualisierung gerade durchgeführt wird

// um tabellennamen rauszubekommen 
$(document).ready(function() {
    // Lädt die verfügbaren Tabellen vom Backend beim Laden der Seite
    $.get("/tables", function(data) {
        window.availableTables = data.tables;
    });
});

document.getElementById('chartTypeSelect').addEventListener('change', function() {
    // Fügt ein neues Diagramm hinzu, wenn ein Diagrammtyp ausgewählt wird
    const chartType = this.value;
    if (chartType) {
        if (chartCount < maxCharts) {
            addChart(chartType);
            this.value = ""; // Setzt das Auswahlfeld zurück
        } else {
            alert('Maximum number of charts reached.');
        }
    }
});

function addChart(chartType) {
    // Erstellt ein neues Diagramm und fügt es zur Seite hinzu
    const chartContainer = document.getElementById('chartContainer');
    
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart';
    chartDiv.style.width = '600px';
    chartDiv.style.height = '400px';
    chartDiv.style.position = 'absolute';
    chartDiv.style.top = '100px';
    chartDiv.style.left = '100px';
    chartContainer.appendChild(chartDiv);
    chartDiv.id = 'chart-' + chartCount;
    chartCount++;

    const chartInstance = echarts.init(chartDiv);
    charts.push(chartInstance);

    const closeButton = document.createElement('button');
    closeButton.className = 'close-btn';
    closeButton.innerText = 'X';
    closeButton.addEventListener('click', function() {
        // Entfernt das Diagramm und verringert die Anzahl der Diagramme
        chartContainer.removeChild(chartDiv);
        chartInstance.dispose();
        charts = charts.filter(chart => chart !== chartInstance);
        chartCount--;
    });
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

    const aggregationSelect = document.createElement('select');
    aggregationSelect.className = 'aggregation-select';
    aggregationSelect.innerHTML = `
        <option value="">Select for Y Axis Aggregation</option>
        <option value="">No Aggregation</option>
        <option value="Summe">Sum</option>
        <option value="Max">Max</option>
        <option value="Min">Min</option>
        <option value="Anzahl">Count</option>
        <option value="Diskrete Anzahl">Distinct Count</option>
    `;
    chartDiv.appendChild(aggregationSelect);

    function updateChart(chartInstance) {
        // Aktualisiert die Daten des Diagramms basierend auf den gewählten Einstellungen und Filter
        const xAxisType = chartInstance.xAxisType;
        const yAxisType = chartInstance.yAxisType;
        const aggregationType = chartInstance.aggregationType;
    
        if (xAxisType && yAxisType) {
            let requestData = { 
                tables: [chartInstance.table1, chartInstance.table2], 
                columns: [xAxisType, yAxisType],
                chartType: chartInstance.chartType,
                aggregationType: aggregationType,
                filters: filter.filter(f => f.chartId !== chartInstance.id) // Exkludiere den Filter des aktuellen Diagramms
            };
    
            $.ajax({
                url: "/getdata",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(requestData),
                success: function(response) {
                    const option = {
                        tooltip: {
                            trigger: 'item'
                        },
                        xAxis: {
                            type: chartInstance.chartType === "scatter" ? 'value' : 'category',
                            data: chartInstance.chartType === "scatter" ? null : response.dataX
                        },
                        yAxis: {
                            type: 'value'
                        },
                        series: [
                            {
                                data: response.dataY.map((y, index) => {
                                    const xValue = chartInstance.chartType === "scatter" ? response.dataX[index] : index;
                                    const key = `${chartInstance.id}-${xValue}`;
                                    const isHighlighted = highlightedPoints[key];
                                    return {
                                        value: chartInstance.chartType === "scatter" ? [response.dataX[index], y] : y,
                                        itemStyle: {
                                            borderColor: isHighlighted ? 'black' : null,
                                            borderWidth: isHighlighted ? 2 : 0,
                                            color: response.colors ? response.colors[index] : null
                                        }
                                    };
                                }),
                                type: response.chartType,
                                symbolSize: chartInstance.chartType === "scatter" ? 20 : null
                            }
                        ]
                    };
    
                    if (chartInstance.chartType === "pie") {
                        option.legend = {
                            top: '5%',
                            left: 'center'
                        };
                        option.series = [
                            {
                                name: 'Access From',
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
                                        fontSize: 40,
                                        fontWeight: 'bold'
                                    }
                                },
                                labelLine: {
                                    show: false
                                },
                                data: response.dataX.map((x, index) => ({
                                    value: response.dataY[index],
                                    name: x,
                                    itemStyle: {
                                        borderColor: highlightedPoints[`${chartInstance.id}-${index}`] ? 'black' : null,
                                        borderWidth: highlightedPoints[`${chartInstance.id}-${index}`] ? 2 : 0
                                    }
                                }))
                            }
                        ];
                    }
                    
                    chartInstance.setOption(option);
                    // Nächste Aktualisierung aus der Warteschlange durchführen
                    processQueue();
                },
                error: function(xhr, status, error) {
                    console.error("Error: ", status, error);
                    // Nächste Aktualisierung aus der Warteschlange durchführen, auch wenn ein Fehler auftritt
                    processQueue();
                }
            });
        } else {
            // Nächste Aktualisierung aus der Warteschlange durchführen, wenn die Achsentypen nicht gesetzt sind
            processQueue();
        }
    }

    function processQueue() {
        if (updateQueue.length > 0) {
            const nextChart = updateQueue.shift();
            updateChart(nextChart);
        } else {
            updating = false;
        }
    }

    function queueUpdateChart(chartInstance) {
        updateQueue.push(chartInstance);
        if (!updating) {
            updating = true;
            processQueue();
        }
    }

    function updateAllCharts(excludeChartId) {
        charts.forEach(chart => {
            if (chart.id !== excludeChartId) {
                queueUpdateChart(chart);
            }
        });
    }

    tableSelect1.addEventListener('change', function() {
        // Lädt die Spalten für die X-Achse basierend auf der ausgewählten Tabelle
        if (this.value) {
            $.post("/columns", { table: this.value }, function(data) {
                xAxisSelect.innerHTML = `<option value="">Select X Axis</option>`;
                data.columns.forEach(column => {
                    xAxisSelect.innerHTML += `<option value="${column}">${column}</option>`;
                });
            });
        }
    });
//und hier auch
    tableSelect2.addEventListener('change', function() {
        // Lädt die Spalten für die Y-Achse basierend auf der ausgewählten Tabelle
        if (this.value) {
            $.post("/columns", { table: this.value }, function(data) {
                yAxisSelect.innerHTML = `<option value="">Select Y Axis</option>`;
                data.columns.forEach(column => {
                    yAxisSelect.innerHTML += `<option value="${column}">${column}</option>`;
                });
            });
        }
    });

    // Aktualisiert das Diagramm, wenn sich die X-Achse, Y-Achse oder die Aggregation ändert
    xAxisSelect.addEventListener('change', function() {
        chartInstance.xAxisType = xAxisSelect.value;
        queueUpdateChart(chartInstance);
    });
    yAxisSelect.addEventListener('change', function() {
        chartInstance.yAxisType = yAxisSelect.value;
        queueUpdateChart(chartInstance);
    });
    aggregationSelect.addEventListener('change', function() {
        chartInstance.aggregationType = aggregationSelect.value;
        queueUpdateChart(chartInstance);
    });

    tableSelect1.addEventListener('change', function() {
        chartInstance.table1 = tableSelect1.value;
    });

    tableSelect2.addEventListener('change', function() {
        chartInstance.table2 = tableSelect2.value;
    });

    chartInstance.table1 = tableSelect1.value;
    chartInstance.table2 = tableSelect2.value;
    chartInstance.xAxisType = xAxisSelect.value;
    chartInstance.yAxisType = yAxisSelect.value;
    chartInstance.aggregationType = aggregationSelect.value;
    chartInstance.chartType = chartType;

    chartDiv.addEventListener('contextmenu', function(event) {
        // Verhindert das Standard-Kontextmenü
        event.preventDefault();
    });

    chartInstance.on('contextmenu', function(params) {
        // Zeigt den Farbwähler für das angeklickte Diagramm an
        if (params.componentType === 'series') {
            showColorPicker(params.event.event, chartInstance, params.dataIndex);
        }
    });

    chartDiv.addEventListener('mousedown', function(event) {
        // Ermöglicht das Ziehen des Diagramms
        draggedElement = chartDiv;
        offsetX = event.clientX - chartDiv.getBoundingClientRect().left;
        offsetY = event.clientY - chartDiv.getBoundingClientRect().top;
    });

    document.addEventListener('mousemove', function(event) {
        // Bewegt das Diagramm, wenn es gezogen wird
        if (draggedElement) {
            draggedElement.style.left = `${event.clientX - offsetX}px`;
            draggedElement.style.top = `${event.clientY - offsetY}px`;
        }
    });

    document.addEventListener('mouseup', function() {
        // Setzt das Ziehen zurück
        draggedElement = null;
    });

    chartInstance.on('click', function(params) {
        // Handhabung des Linksklicks, um die Hervorhebung des Datenpunkts zu ändern und Filter anzuwenden
        if (params.componentType === 'series') {
            const key = `${chartInstance.id}-${params.dataIndex}`;
            const value = params.value[0] || params.name;

            if (highlightedPoints[key]) {
                delete highlightedPoints[key];
                // Entfernen Sie den Wert aus dem Filter
                filter = filter.filter(item => item.filterValue !== value);
            } else {
                highlightedPoints[key] = true;
                // Fügen Sie den Wert dem Filter hinzu
                filter.push({
                    chartId: chartInstance.id,
                    filterTable: chartInstance.table1,
                    filterColumn: chartInstance.xAxisType,
                    filterValue: value
                });
            }

            // Aktualisieren Sie das Diagramm, um die Hervorhebung anzuzeigen
            updateHighlighting(chartInstance);

            // Aktualisieren Sie alle anderen Diagramme
            updateAllCharts(chartInstance.id);

            // Debugging-Ausgabe
            console.log(filter);
        }
    });

    function updateHighlighting(chartInstance) {
        // Aktualisieren Sie die Hervorhebung im Diagramm
        const series = chartInstance.getOption().series;
        series.forEach(serie => {
            serie.data.forEach((dataPoint, index) => {
                const key = `${chartInstance.id}-${index}`;
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

        chartInstance.setOption({
            series: series
        });
    }
}

function showColorPicker(event, chartInstance, dataIndex) {
    // Zeigt einen Farbwähler an, um die Farbe eines Datenpunkts im Diagramm zu ändern
    const optionsMenu = document.createElement('div');
    optionsMenu.className = 'options-menu';

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'color-picker';
    colorPicker.addEventListener('input', function () {
        const option = chartInstance.getOption();
        option.series[0].data[dataIndex].itemStyle = { 
            color: colorPicker.value,
            borderColor: option.series[0].data[dataIndex].itemStyle.borderColor,
            borderWidth: option.series[0].data[dataIndex].itemStyle.borderWidth
        };
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
    optionsMenu.style.zIndex = 1000; // Stellt sicher, dass es im Vordergrund ist

    document.addEventListener('click', function removeOptionsMenu(event) {
        // Entfernt das Farbauswahlmenü, wenn außerhalb geklickt wird
        if (!optionsMenu.contains(event.target)) {
            document.body.removeChild(optionsMenu);
            document.removeEventListener('click', removeOptionsMenu);
        }
    }, { once: true });
}
