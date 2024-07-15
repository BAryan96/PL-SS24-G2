let chartCount = 0;
const maxCharts = 16;
let draggedElement = null;
let offsetX, offsetY;
let charts = [];
let filter = [];
let highlightedPoints = {};
let updateQueue = [];
let updating = false;
let colorMapping = {};

function getRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

$(document).ready(function () {
  $.get("/tables", function (data) {
    window.availableTables = data.tables;
  });
});

document
  .getElementById("chartTypeSelect")
  .addEventListener("change", function () {
    const chartType = this.value;
    if (chartType) {
      if (chartCount < maxCharts) {
        addChart(chartType);
        this.value = "";
      } else {
        alert("Maximum number of charts reached.");
      }
    }
  });

function addChart(chartType) {
  const chartContainer = document.getElementById("chartContainer");

  const chartDiv = document.createElement("div");
  chartDiv.className = "chart";
  chartDiv.style.width = "600px";
  chartDiv.style.height = "400px";
  chartDiv.style.position = "absolute";
  chartDiv.style.top = "100px";
  chartDiv.style.left = "100px";

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  chartDiv.appendChild(overlay);

  chartContainer.appendChild(chartDiv);
  chartDiv.id = "chart-" + chartCount;
  chartCount++;

  const chartInstance = echarts.init(chartDiv);
  charts.push(chartInstance);

  const closeButton = document.createElement("button");
  closeButton.className = "close-btn";
  closeButton.innerText = "X";
  closeButton.addEventListener("click", function () {
    chartContainer.removeChild(chartDiv);
    chartInstance.dispose();
    charts = charts.filter((chart) => chart !== chartInstance);
    chartCount--;
  });
  chartDiv.appendChild(closeButton);

  const tableSelect1 = document.createElement("select");
  tableSelect1.className = "table-select";
  tableSelect1.innerHTML = `<option value="">Select Table for X Axis</option>`;
  availableTables.forEach((table) => {
    tableSelect1.innerHTML += `<option value="${table}">${table}</option>`;
  });
  chartDiv.appendChild(tableSelect1);

  const xAxisSelect = document.createElement("select");
  xAxisSelect.className = "chart-select";
  xAxisSelect.innerHTML = `<option value="">Select X Axis</option>`;
  chartDiv.appendChild(xAxisSelect);

  const tableSelect2 = document.createElement("select");
  tableSelect2.className = "table-select";
  tableSelect2.innerHTML = `<option value="">Select Table for Y Axis</option>`;
  availableTables.forEach((table) => {
    tableSelect2.innerHTML += `<option value="${table}">${table}</option>`;
  });
  chartDiv.appendChild(tableSelect2);

  const yAxisSelect = document.createElement("select");
  yAxisSelect.className = "chart-select";
  yAxisSelect.innerHTML = `<option value="">Select Y Axis</option>`;
  chartDiv.appendChild(yAxisSelect);

  const aggregationSelect = document.createElement("select");
  aggregationSelect.className = "aggregation-select";
  aggregationSelect.innerHTML = `
        <option value="">No Aggregation</option>
        <option value="Sum">Sum</option>
        <option value="Max">Max</option>
        <option value="Min">Min</option>
        <option value="Count">Count</option>
        <option value="Distinct Count">Distinct Count</option>
        <option value="Average">Average</option>
        <option value="Standard Deviation">Standard deviation</option>
        <option value="Variance">Variance</option>
    `;
  chartDiv.appendChild(aggregationSelect);

  const xAxisDateFormatSelect = document.createElement("select");
  xAxisDateFormatSelect.className = "date-format-select";
  xAxisDateFormatSelect.style.display = "none";
  chartDiv.appendChild(xAxisDateFormatSelect);

  const yAxisDateFormatSelect = document.createElement("select");
  yAxisDateFormatSelect.className = "date-format-select";
  yAxisDateFormatSelect.style.display = "none";
  chartDiv.appendChild(yAxisDateFormatSelect);

  const submitButton = document.createElement("button");
  submitButton.className = "submit-btn";
  submitButton.innerText = "Submit";
  chartDiv.appendChild(submitButton);

  function updateDateFormatSelect(selectElement, isDateTime) {
    selectElement.innerHTML = `
            <option value="DD.MM.YYYY">DD.MM.YYYY</option>
            <option value="MM.YYYY">MM.YYYY</option>
            <option value="YYYY.MM">YYYY.MM</option>
            <option value="YYYY">YYYY</option>
            <option value="MM">MM</option>
            <option value="DD">DD</option>
            <option value="W">Weekday Name</option>
        `;
    if (isDateTime) {
      selectElement.innerHTML += `
                <option value="HH24">Hours</option>
                <option value="MI">Minutes</option>
                <option value="SS">Seconds</option>
                <option value="HH24:MI">HH:MM</option>
                <option value="DD.MM.YYYY HH24:MI:SS">Full Date with Time</option>
            `;
    }
    selectElement.style.display = "block";
  }

  function updateChart(chartInstance) {
    let xAxisType = chartInstance.xAxisType;
    let yAxisType = chartInstance.yAxisType;
    const aggregationType = chartInstance.aggregationType;
    const xAxisDateFormat = chartInstance.xAxisDateFormat;
    const yAxisDateFormat = chartInstance.yAxisDateFormat;

    if (chartInstance.xAxisIsDate && xAxisDateFormat) {
        xAxisType = `${xAxisType}-${xAxisDateFormat}`;
    }

    if (chartInstance.yAxisIsDate && yAxisDateFormat) {
        yAxisType = `${yAxisType}-${yAxisDateFormat}`;
    }

    if (xAxisType && yAxisType) {
        let requestData = {
            tables: [chartInstance.table1, chartInstance.table2],
            columns: [xAxisType, yAxisType],
            chartType: chartInstance.chartType,
            aggregations: ["", aggregationType],
            filters: filter.filter((f) => f.chartId !== chartInstance.id),
        };
        $.ajax({
            url: "/getdata",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify(requestData),
            success: function (response) {
                const option = {
                    toolbox: {
                        feature: {
                            saveAsImage: {},
                            dataView: {
                                readOnly: true,
                                optionToContent: function (opt) {
                                    var axisData = opt.xAxis[0].data;
                                    var series = opt.series;
                                    var table =
                                        '<table style="width:100%;text-align:center"><tbody><tr>' +
                                        "<td>X Axis</td>";

                                    series.forEach(function (s) {
                                        table += "<td>" + s.name + "</td>";
                                    });

                                    table += "</tr>";

                                    for (var i = 0, l = axisData.length; i < l; i++) {
                                        table += "<tr>" + "<td>" + axisData[i] + "</td>";
                                        series.forEach(function (s) {
                                            table += "<td>" + s.data[i].value + "</td>"; // Hier wird der primitive Wert abgerufen
                                        });
                                        table += "</tr>";
                                    }

                                    table += "</tbody></table>";
                                    return table;
                                }
                            },
                            magicType: { type: ["line", "bar"] }
                        }
                    },
                    tooltip: {
                        trigger: "item",
                    },
                    xAxis: {
                        type: chartInstance.chartType === "scatter" ? "value" : "category",
                        data: chartInstance.chartType === "scatter" ? null : response.x,
                    },
                    yAxis: {
                        type: "value",
                    },
                    series: [
                        {
                            name: "Y Axis", // Passe den Namen an die tatsächliche Serie an
                            data: response.y0.map((y, index) => {
                                const xValue = chartInstance.chartType === "scatter" ? response.x[index] : index;
                                const key = `${response.x[index]}-${y}`;
                                if (!colorMapping[response.x[index]]) {
                                    colorMapping[response.x[index]] = getRandomColor();
                                }
                                const isHighlighted = highlightedPoints[key];
                                return {
                                    value: chartInstance.chartType === "scatter" ? [response.x[index], y] : y,
                                    itemStyle: {
                                        borderColor: isHighlighted ? "black" : null,
                                        borderWidth: isHighlighted ? 2 : 0,
                                        color: colorMapping[response.x[index]],
                                    },
                                };
                            }),
                            type: chartInstance.chartType,
                            stack: chartInstance.chartType === 'stacked' ? 'stack' : null, // Hinzufügen der Stack-Option
                            symbolSize: chartInstance.chartType === "scatter" ? 20 : null,
                        },
                    ],
                };

                if (chartInstance.chartType === "pie" || chartInstance.chartType === "doughnut") {
                    option.legend = {
                        top: "5%",
                        left: "center",
                    };
                    option.series = [
                        {
                            name: "Access From",
                            type: "pie",
                            radius: chartInstance.chartType === "doughnut" ? ["40%", "70%"] : "70%",
                            avoidLabelOverlap: false,
                            label: {
                                show: false,
                                position: "center",
                            },
                            emphasis: {
                                label: {
                                    show: true,
                                    fontSize: 40,
                                    fontWeight: "bold",
                                },
                            },
                            labelLine: {
                                show: false,
                            },
                            data: response.x.map((x, index) => {
                                const key = `${x}-${response.y0[index]}`;
                                if (!colorMapping[x]) {
                                    colorMapping[x] = getRandomColor();
                                }
                                return {
                                    value: response.y0[index],
                                    name: x,
                                    itemStyle: {
                                        borderColor: highlightedPoints[
                                            `${chartInstance.id}-${index}`
                                            ]
                                            ? "black"
                                            : null,
                                        borderWidth: highlightedPoints[
                                            `${chartInstance.id}-${index}`
                                            ]
                                            ? 2
                                            : 0,
                                        color: colorMapping[x],
                                    },
                                };
                            }),
                        },
                    ];
                }

                chartInstance.setOption(option);
                updateChartColors(chartInstance);
                processQueue();
            },
            error: function (xhr, status, error) {
                console.error("Error: ", status, error);
                processQueue();
            },
        });
    } else {
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
    charts.forEach((chart) => {
      if (chart.id !== excludeChartId) {
        queueUpdateChart(chart);
      }
    });
  }

  tableSelect1.addEventListener("change", function () {
    xAxisDateFormatSelect.style.display = "none";
    if (this.value) {
      $.post("/columns", { table: this.value }, function (data) {
        xAxisSelect.innerHTML = `<option value="">Select X Axis</option>`;
        data.columns.forEach((column) => {
          xAxisSelect.innerHTML += `<option value="${column}">${column}</option>`;
        });
      });
    }
  });

  tableSelect2.addEventListener("change", function () {
    yAxisDateFormatSelect.style.display = "none";
    if (this.value) {
      $.post("/columns", { table: this.value }, function (data) {
        yAxisSelect.innerHTML = `<option value="">Select Y Axis</option>`;
        data.columns.forEach((column) => {
          yAxisSelect.innerHTML += `<option value="${column}">${column}</option>`;
        });
      });
    }
  });

  xAxisSelect.addEventListener("change", function () {
    chartInstance.xAxisType = xAxisSelect.value;
    updateDateFormatForAxis(
      chartInstance,
      xAxisSelect.value,
      xAxisDateFormatSelect,
      tableSelect1.value,
      'x'
    );
  });
  yAxisSelect.addEventListener("change", function () {
    chartInstance.yAxisType = yAxisSelect.value;
    updateDateFormatForAxis(
      chartInstance,
      yAxisSelect.value,
      yAxisDateFormatSelect,
      tableSelect2.value,
      'y'
    );
  });
  xAxisDateFormatSelect.addEventListener("change", function () {
    chartInstance.xAxisDateFormat = xAxisDateFormatSelect.value;
  });
  yAxisDateFormatSelect.addEventListener("change", function () {
    chartInstance.yAxisDateFormat = yAxisDateFormatSelect.value;
  });

  submitButton.addEventListener("click", function () {
    queueUpdateChart(chartInstance);
  });

  aggregationSelect.addEventListener("change", function () {
    chartInstance.aggregationType = aggregationSelect.value;
  });

  tableSelect1.addEventListener("change", function () {
    chartInstance.table1 = tableSelect1.value;
  });

  tableSelect2.addEventListener("change", function () {
    chartInstance.table2 = tableSelect2.value;
  });

  chartInstance.table1 = tableSelect1.value;
  chartInstance.table2 = tableSelect2.value;
  chartInstance.xAxisType = xAxisSelect.value;
  chartInstance.yAxisType = yAxisSelect.value;
  chartInstance.aggregationType = aggregationSelect.value;
  chartInstance.xAxisDateFormat = xAxisDateFormatSelect.value;
  chartInstance.yAxisDateFormat = yAxisDateFormatSelect.value;
  chartInstance.chartType = chartType;

  chartDiv.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });

  chartInstance.on("contextmenu", function (params) {
    if (params.componentType === "series") {
      showColorPicker(
        params.event.event,
        chartInstance,
        params.dataIndex,
        params.value
      );
    }
  });

  chartDiv.addEventListener("mousedown", function (event) {
    draggedElement = chartDiv;
    offsetX = event.clientX - chartDiv.getBoundingClientRect().left;
    offsetY = event.clientY - chartDiv.getBoundingClientRect().top;
  });

  document.addEventListener("mousemove", function (event) {
    if (draggedElement) {
      draggedElement.style.left = `${event.clientX - offsetX}px`;
      draggedElement.style.top = `${event.clientY - offsetY}px`;
    }
  });

  document.addEventListener("mouseup", function () {
    draggedElement = null;
  });

  chartInstance.on("click", function (params) {
    if (params.componentType === "series") {
      const key = `${chartInstance.id}-${params.dataIndex}`;
      let value;

      if (chartInstance.chartType === "scatter") {
        value = params.value[0];
      } else {
        value = params.name;
      }

      if (highlightedPoints[key]) {
        delete highlightedPoints[key];
        filter = filter.filter((item) => item.filterValue !== value);
      } else {
        highlightedPoints[key] = true;
        filter.push({
          chartId: chartInstance.id,
          filterTable: chartInstance.table1,
          filterColumn: chartInstance.xAxisType,
          filterValue: value,
        });
      }
      console.log(filter);

      updateHighlighting(chartInstance);

      updateAllCharts(chartInstance.id);
    }
  });

  function updateHighlighting(chartInstance) {
    const series = chartInstance.getOption().series;
    series.forEach((serie) => {
      serie.data.forEach((dataPoint, index) => {
        const key = `${chartInstance.id}-${index}`;
        if (highlightedPoints[key]) {
          dataPoint.itemStyle = dataPoint.itemStyle || {};
          dataPoint.itemStyle.borderColor = "black";
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
      series: series,
    });
  }

  function updateDateFormatForAxis(
    chartInstance,
    columnName,
    dateFormatSelect,
    tableName,
    axis
  ) {
    $.ajax({
      url: "/columntype",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({ table: tableName, column: columnName }),
      success: function (data) {
        if (data.type) {
          console.log(`Column type for ${columnName}: ${data.type}`);
          const columnType = data.type.toLowerCase();
          if (columnType.includes("datetime") || columnType.includes("date")) {
            updateDateFormatSelect(dateFormatSelect, columnType.includes("datetime"));
            if (axis === 'x') {
              chartInstance.xAxisIsDate = true;
            } else {
              chartInstance.yAxisIsDate = true;
            }
          } else {
            dateFormatSelect.style.display = "none";
            if (axis === 'x') {
              chartInstance.xAxisIsDate = false;
            } else {
              chartInstance.yAxisIsDate = false;
            }
          }
        } else {
          dateFormatSelect.style.display = "none";
          if (axis === 'x') {
            chartInstance.xAxisIsDate = false;
          } else {
            chartInstance.yAxisIsDate = false;
          }
        }
      },
      error: function (xhr, status, error) {
        console.error("Error fetching column type: ", status, error);
        dateFormatSelect.style.display = "none";
        if (axis === 'x') {
          chartInstance.xAxisIsDate = false;
        } else {
          chartInstance.yAxisIsDate = false;
        }
      },
    });
  }
}

function showColorPicker(event, chartInstance, dataIndex, value) {
  const optionsMenu = document.createElement("div");
  optionsMenu.className = "options-menu";

  const colorPicker = document.createElement("input");
  colorPicker.type = "color";
  colorPicker.className = "color-picker";
  colorPicker.addEventListener("input", function () {
    const valueKey = chartInstance.getOption().xAxis[0].data[dataIndex];
    colorMapping[valueKey] = colorPicker.value;
    charts.forEach((chart) => updateChartColors(chart));
  });

  colorPicker.addEventListener("change", function () {
    document.body.removeChild(optionsMenu);
  });

  optionsMenu.appendChild(colorPicker);
  document.body.appendChild(optionsMenu);
  optionsMenu.style.position = "absolute";
  optionsMenu.style.left = `${event.pageX}px`;
  optionsMenu.style.top = `${event.pageY}px`;
  optionsMenu.style.zIndex = 1000;

  document.addEventListener(
    "click",
    function removeOptionsMenu(event) {
      if (!optionsMenu.contains(event.target)) {
        document.body.removeChild(optionsMenu);
        document.removeEventListener("click", removeOptionsMenu);
      }
    },
    { once: true }
  );
}

function updateChartColors(chartInstance) {
  const series = chartInstance.getOption().series;
  const xAxisData = chartInstance.getOption().xAxis[0].data;
  series.forEach((serie) => {
    serie.data.forEach((dataPoint, index) => {
      const valueKey = xAxisData[index];
      if (colorMapping[valueKey]) {
        dataPoint.itemStyle = dataPoint.itemStyle || {};
        dataPoint.itemStyle.color = colorMapping[valueKey];
      }
    });
  });

  chartInstance.setOption({
    series: series,
  });
}