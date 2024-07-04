let charts = [];
let darkMode = false;
let decalPattern = false;
let currentChartIndex = 0;

$(document).ready(function () {
  initializeForm(0);

  $("#dataForm0").submit(function (event) {
    event.preventDefault();
    let xTable = $("#xTable0").val();
    let xColumn = $("#xColumn0").val();
    let yTable = $("#yTable0").val();
    let yColumn = $("#yColumn0").val();
    let aggregation = $("#aggregationSelect0").val();

    let requestData = {
      tables: [xTable, yTable].filter((value) => value !== ""),
      columns: [xColumn, yColumn].filter((value) => value !== ""),
      chartType: "area",
      aggregations: [aggregation].filter((value, index) => value !== ""),
      filters: [],
    };

    requestData.aggregations.unshift("");

    $.ajax({
      url: "/getdata",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify(requestData),
      success: function (response) {
        const areaData = {
          categories: response.x,
          series: [{ name: "Series 1", data: response.y0 }],
        };
        renderChart(areaData, charts[0]);
      },
      error: function (xhr, status, error) {
        console.error("Error: ", status, error);
      },
    });
  });

  charts.push(echarts.init(document.getElementById("chart0")));
});

function initializeForm(index) {
  $.get("/tables", function (data) {
    if (data.tables) {
      const tableOptions = data.tables
        .map((table) => `<option value="${table}">${table}</option>`)
        .join("");
      $(`#xTable${index}, #yTable${index}`).append(tableOptions);
    }
  });

  $(`#xTable${index}`).change(function () {
    loadColumns($(this).val(), `#xColumn${index}`);
  });

  $(`#yTable${index}`).change(function () {
    loadColumns($(this).val(), `#yColumn${index}`);
  });
}

function loadColumns(table, columnSelectId) {
  if (table) {
    $.post("/columns", { table: table }, function (data) {
      const columnOptions = data.columns
        .map((column) => `<option value="${column}">${column}</option>`)
        .join("");
      $(columnSelectId)
        .empty()
        .append(`<option value="">None</option>${columnOptions}`);
    });
  }
}

function renderChart(areaData, instance) {
  let option = {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
        label: { backgroundColor: "#6a7985" },
      },
    },
    legend: { data: areaData.series.map((series) => series.name) },
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
            instance.dispose();
          },
        },
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: areaData.categories,
    },
    yAxis: {
      type: "value",
    },
    series: areaData.series.map((series) => ({
      name: series.name,
      type: "line",
      areaStyle: {},
      emphasis: { focus: "series" },
      data: series.data,
    })),
    dataZoom: [
      {
        type: "inside",
        start: 0,
        end: 100,
      },
      {
        start: 0,
        end: 100,
      },
    ],
  };

  instance.setOption(option);
}


function togglePopup(index) {
  currentChartIndex = index;

  // Reset the popup form
  $("#popupForm")[0].reset();

  // Load tables and columns for the current chart index
  initializePopupForm();

  const popup = document.getElementById("popup");
  const overlay = document.getElementById("overlay");
  popup.classList.toggle("visible");
  overlay.classList.toggle("visible");
}


function initializePopupForm() {
  $.get("/tables", function (data) {
    if (data.tables) {
      const tableOptions = data.tables
        .map((table) => `<option value="${table}">${table}</option>`)
        .join("");
      $("#yTable2, #yTable3").empty().append('<option value="">None</option>' + tableOptions);
    }
  });

  $("#yTable2").change(function () {
    loadColumns($(this).val(), "#yColumn2");
  });

  $("#yTable3").change(function () {
    loadColumns($(this).val(), "#yColumn3");
  });
}


function addLines() {
  let chartIndex = currentChartIndex;
  let xTable = $(`#xTable${chartIndex}`).val();
  let xColumn = $(`#xColumn${chartIndex}`).val();

  // Main Y-axis selection
  let yTable1 = $(`#yTable${chartIndex}`).val();
  let yColumn1 = $(`#yColumn${chartIndex}`).val();
  let aggregation1 = $(`#aggregationSelect${chartIndex}`).val();

  // Additional Y-axis selections from popup
  let yTable2 = $("#yTable2").val();
  let yColumn2 = $("#yColumn2").val();
  let aggregation2 = $("#aggregationSelect2").val();

  let yTable3 = $("#yTable3").val();
  let yColumn3 = $("#yColumn3").val();
  let aggregation3 = $("#aggregationSelect3").val();

  // Filter out empty values
  let yTables = [yTable1, yTable2, yTable3].filter(value => value);
  let yColumns = [yColumn1, yColumn2, yColumn3].filter(value => value);
  let yAggregations = [aggregation1, aggregation2, aggregation3].filter(value => value);

  // Prepare the data for request
  let tables = [xTable, yTable1, yTable2, yTable3].filter(value => value);
  let columns = [xColumn, yColumn1, yColumn2, yColumn3].filter(value => value);
  let aggregations = [aggregation1, aggregation2, aggregation3].filter(value => value);

  let requestData = {
    tables: tables,
    columns: columns,
    chartType: "area",
    aggregations: aggregations,
    filters: [],
  };

  requestData.aggregations.unshift(""); // Ensure the first aggregation is an empty string for X axis

  $.ajax({
    url: "/getdata",
    type: "POST",
    contentType: "application/json",
    data: JSON.stringify(requestData),
    success: function (response) {
      let existingOption = charts[chartIndex].getOption();
      let newSeries = [];
      if (response.y1) newSeries.push({ name: "Series 2", data: response.y1 });
      if (response.y2) newSeries.push({ name: "Series 3", data: response.y2 });
      if (response.y3) newSeries.push({ name: "Series 4", data: response.y3 });

      existingOption.series = existingOption.series.concat(newSeries);
      existingOption.xAxis[0].data = response.x;

      charts[chartIndex].setOption(existingOption);
      togglePopup(chartIndex);
    },
    error: function (xhr, status, error) {
      console.error("Error: ", status, error);
    },
  });
}





function addAnotherChart() {
  if (charts.length >= 5) {
    alert("Maximum of 5 charts reached.");
    return;
  }

  const index = charts.length;

  const chartWrapper = document.createElement('div');
  chartWrapper.className = 'chart-container';
  chartWrapper.id = `chartContainer${index}`;

  chartWrapper.innerHTML = `
    <form id="dataForm${index}" class="form-container">
      <h2>Please Choose your Data</h2>
      <label for="xTable${index}">Table for X-Axis</label>
      <select id="xTable${index}" name="xTable${index}">
        <option value="">None</option>
      </select>

      <label for="xColumn${index}">Column for X-Axis</label>
      <select id="xColumn${index}" name="xColumn${index}">
        <option value="">None</option>
      </select>

      <label for="yTable${index}">Table for Y-Axis</label>
      <select id="yTable${index}" name="yTable${index}">
        <option value="">None</option>
      </select>

      <label for="yColumn${index}">Column for Y-Axis</label>
      <select id="yColumn${index}" name="yColumn${index}">
        <option value="">None</option>
      </select>

      <label for="aggregationSelect${index}">Aggregation</label>
      <select id="aggregationSelect${index}" name="aggregationSelect${index}">
        <option value="">No Aggregation</option>
        <option value="Summe">Sum</option>
        <option value="Max">Max</option>
        <option value="Min">Min</option>
        <option value="Anzahl">Count</option>
        <option value="Diskrete Anzahl">Distinct Count</option>
        <option value="Durchschnitt">Average</option>
        <option value="Standardabweichung">Standard deviation</option>
        <option value="Varianz">Variance</option>
      </select>

      <button type="submit" id="submitButton${index}">Submit</button>
      <button type="button" id="addGraphButton${index}" onclick="togglePopup(${index})">Add Lines</button>
    </form>
    <div id="chart${index}" class="chart"></div>
  `;

  document.querySelector('.charts-wrapper').appendChild(chartWrapper);

  const newChartInstance = echarts.init(document.getElementById(`chart${index}`));
  charts.push(newChartInstance);

  initializeForm(index);

  $(`#dataForm${index}`).submit(function (event) {
    event.preventDefault();
    let xTable = $(`#xTable${index}`).val();
    let xColumn = $(`#xColumn${index}`).val();
    let yTable = $(`#yTable${index}`).val();
    let yColumn = $(`#yColumn${index}`).val();
    let aggregation = $(`#aggregationSelect${index}`).val();

    let requestData = {
      tables: [xTable, yTable].filter((value) => value !== ""),
      columns: [xColumn, yColumn].filter((value) => value !== ""),
      chartType: "area",
      aggregations: [aggregation].filter((value, index) => value !== ""),
      filters: [],
    };

    requestData.aggregations.unshift("");

    $.ajax({
      url: "/getdata",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify(requestData),
      success: function (response) {
        const areaData = {
          categories: response.x,
          series: [{ name: "Series 1", data: response.y0 }],
        };
        renderChart(areaData, newChartInstance);
      },
      error: function (xhr, status, error) {
        console.error("Error: ", status, error);
      },
    });
  });

  updateChartsLayout();
}

function updateChartsLayout() {
  const chartContainers = document.querySelectorAll('.chart-container');
  chartContainers.forEach(container => {
    container.classList.toggle('half-width', charts.length > 1);
  });
}

function updateChartAppearance() {
  charts.forEach(chart => {
    chart.setOption({
      backgroundColor: darkMode ? "#333" : "#fff",
      series: chart.getOption().series.map((series) => ({
        ...series,
        label: { color: darkMode ? "#fff" : "#000" },
        itemStyle: {
          decal: decalPattern
            ? { symbol: "rect", color: "rgba(0,0,0,0.1)" }
            : null,
        },
      })),
    });
  });
}
