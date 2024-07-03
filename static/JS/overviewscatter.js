let charts = [];
let filter = [];
let highlightedPoints = {};
let updateQueue = [];
let updating = false;
let darkMode = false;
let decalPattern = false;
let chartInstance;

$(document).ready(function () {
  $.get("/tables", function (data) {
    if (data.tables) {
      const xTableSelect = $("#xTable");
      const yTableSelect = $("#yTable");
      data.tables.forEach((table) => {
        xTableSelect.append(new Option(table, table));
        yTableSelect.append(new Option(table, table));
      });
    }
  });

  $("#xTable").change(function () {
    loadColumns($(this).val(), "#xColumn");
  });

  $("#yTable").change(function () {
    loadColumns($(this).val(), "#yColumn");
  });

  $("#dataForm").submit(function (event) {
    event.preventDefault();
    addChart();
  });
});

function loadColumns(table, columnSelectId) {
  if (table) {
    $.post("/columns", { table: table }, function (data) {
      const columnSelect = $(columnSelectId);
      columnSelect.empty().append(new Option("None", ""));
      if (data.columns) {
        data.columns.forEach((column) => {
          columnSelect.append(new Option(column, column));
        });
      }
    });
  }
}

function addChart() {
  const xAxisType = document.getElementById("xColumn").value;
  const yAxisType = document.getElementById("yColumn").value;
  const table1 = document.getElementById("xTable").value;
  const table2 = document.getElementById("yTable").value;
  const aggregationType = document.getElementById("aggregationSelect").value;

  chartInstance = echarts.init(document.getElementById("chart"));

  chartInstance.xAxisType = xAxisType;
  chartInstance.yAxisType = yAxisType;
  chartInstance.table1 = table1;
  chartInstance.table2 = table2;
  chartInstance.aggregationType = aggregationType;
  chartInstance.chartType = "scatter";

  updateChart(chartInstance);
}

function renderChart(scatterData, seriesOptions) {
  const option = {
    title: {
      left: "center",
      text: "Scatter Chart",
    },
    tooltip: {
      trigger: "item",
      position: function (pt) {
        return [pt[0], "10%"];
      },
      formatter: function (params) {
        return `
                    <strong>X:</strong> ${params.value[0]}<br>
                    <strong>Y:</strong> ${params.value[1]}
                `;
      },
    },
    toolbox: {
      feature: {
        saveAsImage: {},
        myDarkMode: {
          show: true,
          title: "Dark Mode",
          icon: "path://M512 0C229.23072 0 0 229.23072 0 512s229.23072 512 512 512 512-229.23072 512-512S794.76928 0 512 0z m0 938.0864c-234.24 0-426.0864-191.8464-426.0864-426.0864S277.76 85.9136 512 85.9136c55.7312 0 111.4624 11.7248 163.6864 35.0208-32.768 56.32-87.04 94.72-151.0912 105.2672-78.4896 13.7216-147.2-12.288-199.7312-55.808 0 0-12.6976 80.9472-12.6976 119.296 0 136.3968 104.7552 247.9104 239.9232 261.8368 79.872 8.2944 152.576-24.7808 198.3488-80.64 28.2624 48.64 45.568 106.752 45.568 170.3424 0 234.24-191.8464 426.0864-426.0864 426.0864z",
          onclick: function () {
            darkMode = !darkMode;
            updateChartAppearance();
          },
        },
        myDecalPattern: {
          show: true,
          title: "Decal Pattern",
          icon: "path://M50 250 Q 150 50 250 250 T 450 250",
          onclick: function () {
            decalPattern = !decalPattern;
            updateChartAppearance();
          },
        },
        myShare: {
          show: true,
          title: "Share",
          icon: "path://M864 160h-192V96H352v64H160c-35.328 0-64 28.672-64 64v576c0 35.328 28.672 64 64 64h704c35.328 0 64-28.672 64-64V224c0-35.328-28.672-64-64-64z m0 640H160V224h192v64h320v-64h192v576z m-320-320h-64v192h-192V480h-64l160-160 160 160z",
          onclick: function () {
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(
              function () {
                alert("URL copied to clipboard");
              },
              function (err) {
                console.error("Could not copy URL: ", err);
              }
            );
          },
        },
        myCloseChart: {
          show: true,
          title: "Close Chart",
          icon: "path://M512 512l212.48-212.48a32 32 0 0 0-45.248-45.248L512 421.504 299.52 209.024a32 32 0 1 0-45.248 45.248L466.752 512 254.272 724.48a32 32 0 1 0 45.248 45.248L512 602.496l212.48 212.48a32 32 0 0 0 45.248-45.248L557.248 512z",
          onclick: function () {
            chartInstance.dispose();
          },
        },
      },
    },
    xAxis: {
      type: "category",
    },
    yAxis: {
      type: "category",
    },
    series: [
      {
        symbolSize: 20,
        data: scatterData,
        type: "scatter",
        itemStyle: {
          color: seriesOptions.color,
        },
      },
    ],
    backgroundColor: darkMode ? "#333" : "#fff",
    textStyle: { color: darkMode ? "#fff" : "#000" },
  };

  chartInstance.setOption(option);
}

function updateChart(chartInstance) {
  const xAxisType = chartInstance.xAxisType;
  const yAxisType = chartInstance.yAxisType;
  const aggregationType = chartInstance.aggregationType;

  if (xAxisType && yAxisType) {
    let requestData = {
      tables: [chartInstance.table1, chartInstance.table2],
      columns: [xAxisType, yAxisType],
      chartType: "scatter",
      aggregations: ["", aggregationType],
      filters: filter.filter((f) => f.chartId !== chartInstance.id),
    };

    $.ajax({
      url: "/getdata",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify(requestData),
      success: function (response) {
        const scatterData = response.y0.map((y, index) => [
          response.x[index],
          y,
        ]);
        renderChart(scatterData, chartInstance);
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

function updateChartAppearance() {
  const option = chartInstance.getOption();
  option.backgroundColor = darkMode ? "#333" : "#fff";
  option.textStyle.color = darkMode ? "#fff" : "#000";
  if (decalPattern) {
    option.series.forEach((series) => {
      series.itemStyle = { decal: { symbol: "rect", color: "#ccc" } };
    });
  } else {
    option.series.forEach((series) => {
      series.itemStyle = { decal: null };
    });
  }
  chartInstance.setOption(option);
}
