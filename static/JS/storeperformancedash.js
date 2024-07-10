let darkMode = false;
let decalPattern = false;
let charts = [];
let filter = [];
let highlightedPoints = {};
let originalData = {};

$(document).ready(async function () {
  await loadChartsSequentially([
    {
      id: "myChart1",
      tables: ["stores", "stores", "stores", "orders"],
      columns: ["storeID", "longitude", "latitude", "total"],
      type: "heatmap",
      aggregations: ["", "X", "X", "Sum"],
      filters: filter,
    },
    {
      id: "storeChartsContainer",
      tables: ["stores", "orders", "orders"],
      columns: ["storeID", "total", "orderDate-YYYY"],
      type: "storeCharts",
      aggregations: ["", "Sum", ""],
      filters: filter,
    },
    {
      id: "myChart3",
      tables: ["orders", "orders"],
      columns: ["orderDate-W.MM.YYYY", "orderID"],
      type: "dayWiseHeatmap",
      aggregations: ["", "Count"],
      filters: filter,
    },
    {
      id: "myChart4",
      tables: ["orders", "orders"],
      columns: ["orderDate-DD.MM.YYYY HH24:MI", "orderID"],
      type: "bar",
      aggregations: ["", "Count"],
      filters: filter,
    },
    {
      id: "myChart6",
      tables: ["stores", "orders", "orders", "stores", "stores"],
      columns: ["storeID", "orderID", "total", "state", "city"],
      type: "kpi",
      aggregations: ["", "Count", "Sum", "", ""],
      filters: filter,
    },
  ]);
});

function getToolboxFeatures() {
  return {
    feature: {
      saveAsImage: {},
      restore: {},
      dataView: { readOnly: false },
      magicType: { type: ["line", "bar", "stack"] },
    },
  };
}

function getDayWiseHeatmapToolboxFeatures() {
  return {
    feature: {
      saveAsImage: {},
    },
  };
}
async function fetchData(requestData) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "/getdata",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify(requestData),
      success: function (response) {
        resolve(response);
      },
      error: function (xhr, status, error) {
        console.error("Error: ", status, error);
        console.error("Response: ", xhr.responseText);
        reject(error);
      },
    });
  });
}

function generateChartOptions(response, storeData) {
  storeData.sort((a, b) => a.year - b.year);

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
    },
    xAxis: {
      type: "category",
      data: storeData.map((data) => data.year),
      axisPointer: {
        type: "shadow",
      },
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: "Total Revenue per Year",
        data: storeData.map((data) => data.total),
        type: "line",
        smooth: true,
        areaStyle: {},
      },
    ],
  };
}
function initializeBarChart(config, response) {
  const myChart = echarts.init(document.getElementById(config.id));

  const timeData = response.x.map((item) => item.split(" ")[1]);
  const orderCounts = response.y0;

  const ordersPerHour = Array.from({ length: 24 }, () => 0);

  timeData.forEach((time, index) => {
    const hour = parseInt(time.split(":")[0], 10);
    ordersPerHour[hour] += orderCounts[index];
  });

  const option = {
    title: {
      text: "Orders Per Hour",
      left: "center",
    },
    toolbox: getToolboxFeatures(), // Toolbox hinzugefügt
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter: "{b}: {c} orders",
    },
    xAxis: {
      type: "category",
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLabel: {
        interval: 0,
        rotate: 45,
      },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
    },
    series: [
      {
        name: "Orders",
        type: "bar",
        data: ordersPerHour,
        itemStyle: {
          color: "#73c0de",
        },
      },
    ],
  };

  myChart.setOption(option);
  charts.push({ chart: myChart, config: config });
}

async function initializeChart(config) {
  console.log("Initializing chart with config:", config);

  const requestData = {
    tables: config.tables,
    columns: config.columns,
    chartType: config.type,
    aggregations: config.aggregations,
    filters: config.filters,
  };

  try {
    let response = await fetchData(requestData);
    console.log("Received response:", response);

    response.chartId = config.id;
    originalData[config.id] = response;

    if (config.type === "kpi") {
      initializeKPI(config, response);
    } else if (config.type === "storeCharts") {
      const storeChartsContainer = document.getElementById(
        "storeChartsContainer"
      );
      storeChartsContainer.innerHTML = "";

      const titleDiv = document.createElement("div");
      titleDiv.className = "store-charts-title";
      titleDiv.textContent = "Store Wise Performance";

      const sortDropdown = document.createElement("select");
      sortDropdown.id = "sortDropdown";

      const options = [
        { value: "none", text: "None" },
        { value: "performance-asc", text: "Store Performance (Asc)" },
        { value: "performance-desc", text: "Store Performance (Desc)" },
        { value: "change-asc", text: "Store Change (Asc)" },
        { value: "change-desc", text: "Store Change (Desc)" },
      ];

      options.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.text;
        sortDropdown.appendChild(opt);
      });

      sortDropdown.value = "none";

      const container = document.createElement("div");
      container.className = "title-and-dropdown";
      container.appendChild(titleDiv);
      container.appendChild(sortDropdown);

      storeChartsContainer.parentNode.insertBefore(
        container,
        storeChartsContainer
      );

      sortDropdown.addEventListener("change", () =>
        sortStoreCharts(response, sortDropdown.value)
      );

      sortStoreCharts(response, "none");

      if (!charts.some((chart) => chart.config.id === config.id)) {
        charts.push({ chart: null, config: config });
      }
    } else if (config.type === "dayWiseHeatmap") {
      initializeDayWiseHeatmap(config, response);
    } else if (config.type === "bar") {
      initializeBarChart(config, response);
    } else if (config.type === "stackedBar") {
      initializeStackedBarChart(config);
    } else if (config.type === "heatmap") {
      initializeHeatmap(config);
    }

    if (
      config.type !== "storeCharts" &&
      !charts.some((chart) => chart.config.id === config.id)
    ) {
      charts.push({ chart: null, config: config });
    }
  } catch (error) {
    console.error("Failed to initialize chart:", error);
  }
}

function sortStoreCharts(response, sortBy) {
  const storeChartsContainer = document.getElementById("storeChartsContainer");
  storeChartsContainer.innerHTML = "";

  const storeIDs = [...new Set(response.x)];
  let storeData = storeIDs.map((storeID) => {
    const data = response.x
      .map((id, index) => ({
        storeID: id,
        total: response.y0[index],
        year: response.y1[index],
      }))
      .filter((data) => data.storeID === storeID);

    data.sort((a, b) => a.year - b.year);

    const total = data.reduce((sum, data) => sum + parseFloat(data.total), 0);
    let changePercentage = 0;
    if (data.length > 1) {
      const previousTotal = data[data.length - 2].total;
      const currentTotal = data[data.length - 1].total;
      changePercentage = ((currentTotal - previousTotal) / previousTotal) * 100;
    }

    return {
      storeID,
      total,
      changePercentage,
      data,
    };
  });

  if (sortBy === "performance-asc") {
    storeData.sort((a, b) => a.total - b.total);
  } else if (sortBy === "performance-desc") {
    storeData.sort((a, b) => b.total - a.total);
  } else if (sortBy === "change-asc") {
    storeData.sort((a, b) => a.changePercentage - b.changePercentage);
  } else if (sortBy === "change-desc") {
    storeData.sort((a, b) => b.changePercentage - a.changePercentage);
  }

  storeData.forEach(({ storeID, total, changePercentage, data }) => {
    const performanceClass =
      changePercentage > 0 ? "positive-change" : "negative-change";

    const chartContainer = document.createElement("div");
    chartContainer.className = "store-chart-container";
    chartContainer.innerHTML = `
            <div class="store-title">Store ID ${storeID}</div>
            <div class="store-performance">$${(total / 1e6).toFixed(2)}M</div>
            <div class="store-change ${performanceClass}">Change: ${changePercentage.toFixed(
      1
    )}%</div>
            <div id="storeChart_${storeID}" class="store-chart"></div>
        `;
    storeChartsContainer.appendChild(chartContainer);

    const myChart = echarts.init(
      document.getElementById(`storeChart_${storeID}`)
    );
    charts.push({ chart: myChart, config: response.chartId });

    let option = generateChartOptions(response, data);
    myChart.setOption(option);
  });
}

async function initializeHeatmap(config) {
  return new Promise(async (resolve, reject) => {
    const baseLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }
    );

    const cfg = {
      radius: 1,
      maxOpacity: 0.8,
      scaleRadius: true,
      useLocalExtrema: true,
      latField: "lat",
      lngField: "lng",
      valueField: "count",
      gradient: {
        0.1: "blue",
        0.2: "lime",
        0.4: "yellow",
        0.6: "orange",
        0.8: "red",
        1.0: "purple",
      },
    };

    const heatmapLayer = new HeatmapOverlay(cfg);

    const map = new L.Map(config.id, {
      center: new L.LatLng(37.5, -117),
      zoom: 6,
      layers: [baseLayer],
    });

    const title = L.control({ position: "topright" });
    title.onAdd = function (map) {
      const div = L.DomUtil.create("div", "map-title");
      div.innerHTML = "<h3>Stores Locations based on Total Revenue</h3>";
      return div;
    };
    title.addTo(map);

    const circleMarkerOptions = {
      radius: 3,
      fillColor: "#ff7800",
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.6,
    };

    function createLegend(legendElement, gradient) {
      for (const key in gradient) {
        const color = gradient[key];
        const div = document.createElement("div");
        div.innerHTML =
          '<span style="background-color:' + color + ';"></span>' + key;
        legendElement.appendChild(div);
      }
    }

    const legendControl = L.control({ position: "bottomright" });

    legendControl.onAdd = function (map) {
      const div = L.DomUtil.create("div", "legend");
      const gradient = cfg.gradient;
      createLegend(div, gradient);
      return div;
    };

    legendControl.addTo(map);

    const requestData = {
      tables: config.tables,
      columns: config.columns,
      chartType: "heatmap",
      aggregations: config.aggregations,
      filters: config.filters,
    };

    try {
      let response = await fetchData(requestData);
      console.log("Received response:", response);

      const data = [];
      for (let i = 0; i < response.x.length; i++) {
        data.push({
          id: response.x[i],
          longitude: parseFloat(response.y0[i]),
          latitude: parseFloat(response.y1[i]),
          Aggregation: parseFloat(response.y2[i]),
        });
      }

      const bounds = [];
      const heatmapPoints = [];

      data.forEach((point) => {
        const marker = L.circleMarker(
          [point.latitude, point.longitude],
          circleMarkerOptions
        );
        marker.bindPopup(
          `<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}<br><b>Total Revenue:</b> ${point.Aggregation}`
        );
        marker.on("click", () => handleMarkerClick(marker, point));
        map.addLayer(marker);
        bounds.push([point.latitude, point.longitude]);

        heatmapPoints.push({
          lat: point.latitude,
          lng: point.longitude,
          count: point.Aggregation,
        });
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds);
      }

      map.addLayer(heatmapLayer);
      heatmapLayer.setData({
        max: Math.max(...data.map((point) => point.Aggregation)),
        data: heatmapPoints,
      });

      charts.push({ chart: heatmapLayer, config: config });

      resolve();
    } catch (error) {
      console.error("Failed to initialize heatmap:", error);
      reject(error);
    }
  });
}

function initializeDayWiseHeatmap(config, response) {
  const myChart = echarts.init(document.getElementById(config.id));

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const daysOfWeekShort = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const orderCounts = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
  };

  const data = response.x.map((date, index) => {
    const [weekday, month, year] = date.split(".");
    const dayOfWeekIndex = (parseInt(weekday, 10) - 1 + 6) % 7;
    const dayOfWeek = daysOfWeek[dayOfWeekIndex];

    orderCounts[dayOfWeek] += response.y0[index];

    return [
      `${year}-${month}`,
      daysOfWeekShort[dayOfWeekIndex],
      response.y0[index],
    ];
  });

  const uniqueMonths = [...new Set(data.map((item) => item[0]))].sort(
    (a, b) => new Date(a) - new Date(b)
  );

  const formattedData = data.map((item) => {
    const monthIndex = uniqueMonths.indexOf(item[0]);
    const dayIndex = daysOfWeekShort.indexOf(item[1]);
    return [monthIndex, dayIndex, item[2]];
  });

  console.log("Total orders per weekday:", orderCounts);

  const option = {
    title: {
      text: "Heatmap for Orders per Weekday",
      left: "center",
    },
    toolbox: getDayWiseHeatmapToolboxFeatures(),
    tooltip: {
      position: "top",
    },
    grid: {
      height: "50%",
      top: "10%",
    },
    xAxis: {
      type: "category",
      data: uniqueMonths,
      splitArea: {
        show: true,
      },
    },
    yAxis: {
      type: "category",
      data: daysOfWeekShort,
      splitArea: {
        show: true,
      },
    },
    visualMap: {
      min: 0,
      max: Math.max(...response.y0),
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: "15%",
    },
    series: [
      {
        name: "Order Count",
        type: "heatmap",
        data: formattedData,
        label: {
          show: false,
        },
        itemStyle: {
          borderColor: "#fff",
          borderWidth: 1,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  };

  myChart.setOption(option);
  charts.push({ chart: myChart, config: config });
}

async function initializeStackedBarChart(config) {
  const myChart = echarts.init(document.getElementById(config.id));

  const requestData = {
    tables: config.tables,
    columns: config.columns,
    chartType: config.type,
    aggregations: config.aggregations,
    filters: config.filters,
  };

  try {
    let response = await fetchData(requestData);
    console.log("Received response:", response);

    const storeIDs = [...new Set(response.x)];
    const productNames = [...new Set(response.y1)];

    const seriesData = productNames.map((product) => {
      return {
        name: product,
        type: "bar",
        stack: "total",
        data: storeIDs.map((storeID) => {
          const index = response.x.findIndex(
            (id, idx) => id === storeID && response.y1[idx] === product
          );
          return index !== -1 ? response.y1[index] : 0;
        }),
      };
    });

    const option = {
      title: {
        text: "Total Revenue by Store and Product",
        left: "center",
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
      },
      legend: {
        data: productNames,
        bottom: 0,
      },
      xAxis: {
        type: "category",
        data: storeIDs,
        axisPointer: {
          type: "shadow",
        },
      },
      yAxis: {
        type: "value",
      },
      series: seriesData,
    };

    myChart.setOption(option);
    charts.push({ chart: myChart, config: config });
  } catch (error) {
    console.error("Failed to initialize stacked bar chart:", error);
  }
}

function initializeKPI(config, response) {
  const storeData = response.x.map((storeID, index) => ({
    storeID: storeID,
    orderCount: response.y0[index],
    totalRevenue: parseFloat(response.y1[index]),
    state: response.y2[index],
    city: response.y3[index],
  }));

  storeData.sort((a, b) => b.orderCount - a.orderCount);
  const top3StoresByOrders = storeData.slice(0, 3);
  const bottom3StoresByOrders = storeData.slice(-3);

  storeData.sort((a, b) => b.totalRevenue - a.totalRevenue);
  const top3StoresByRevenue = storeData.slice(0, 3);
  const bottom3StoresByRevenue = storeData.slice(-3);

  const kpiContainer = document.getElementById(config.id);
  kpiContainer.innerHTML = `
        <div class="kpi-section">
            <h3>Top 3 Stores by Orders</h3>
            <ul>${top3StoresByOrders
              .map(
                (store) =>
                  `<li><span>${store.storeID}</span>${store.city}, ${store.state}: ${store.orderCount} orders</li>`
              )
              .join("")}</ul>
        </div>
        <div class="kpi-section">
            <h3>Top 3 Stores by Revenue</h3>
            <ul>${top3StoresByRevenue
              .map(
                (store) =>
                  `<li><span>${store.storeID}</span>${store.city}, ${
                    store.state
                  }: $${store.totalRevenue.toFixed(2)}</li>`
              )
              .join("")}</ul>
        </div>
        <div class="kpi-section">
            <h3>Bottom 3 Stores by Orders</h3>
            <ul>${bottom3StoresByOrders
              .map(
                (store) =>
                  `<li><span>${store.storeID}</span>${store.city}, ${store.state}: ${store.orderCount} orders</li>`
              )
              .join("")}</ul>
        </div>
        <div class="kpi-section">
            <h3>Bottom 3 Stores by Revenue</h3>
            <ul>${bottom3StoresByRevenue
              .map(
                (store) =>
                  `<li><span>${store.storeID}</span>${store.city}, ${
                    store.state
                  }: $${store.totalRevenue.toFixed(2)}</li>`
              )
              .join("")}</ul>
        </div>
    `;

  if (!charts.some((chart) => chart.config.id === config.id)) {
    charts.push({ chart: null, config: config });
  }
}

async function loadChartsSequentially(chartConfigs) {
  charts = [];
  for (const config of chartConfigs) {
    if (config.type === "heatmap") {
      await initializeHeatmap(config);
    } else {
      await initializeChart(config);
    }
  }
}

document
  .getElementById("exportJsonButton")
  .addEventListener("click", exportJson);
document
  .getElementById("importJsonButton")
  .addEventListener("click", openImportPopup);
document
  .querySelector(".schließen-button")
  .addEventListener("click", closeImportPopup);
document
  .getElementById("dropArea")
  .addEventListener("dragover", handleDragOver);
document.getElementById("dropArea").addEventListener("drop", handleFileSelect);
document
  .getElementById("fileSelectButton")
  .addEventListener("click", () =>
    document.getElementById("fileInput").click()
  );
document
  .getElementById("fileInput")
  .addEventListener("change", handleFileUpload);

function exportJson() {
  if (charts.length === 0) {
    alert("No JSON Data available to export.");
    return;
  }
  const chartConfigs = charts.map((chartObj) => chartObj.config);

  const jsonString = JSON.stringify(chartConfigs, null, 4);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "charts_config.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openImportPopup() {
  document.getElementById("importJsonPopup").style.display = "block";
}

function closeImportPopup() {
  document.getElementById("importJsonPopup").style.display = "none";
}

function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = "copy";
}

function handleFileSelect(event) {
  event.preventDefault();
  event.stopPropagation();

  const files = event.dataTransfer.files;
  if (files.length === 1 && files[0].type === "application/json") {
    const file = files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const importedData = JSON.parse(e.target.result);
        loadChartsSequentially(importedData);
        closeImportPopup();
      } catch (error) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  } else {
    alert("Please drop a valid JSON file.");
  }
}

function handleFileUpload(event) {
  const files = event.target.files;
  if (files.length === 1 && files[0].type === "application/json") {
    readFile(files[0]);
  } else {
    alert("Please select a valid JSON file.");
  }
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const importedData = JSON.parse(e.target.result);
      loadChartsSequentially(importedData);
      closeImportPopup();
    } catch (error) {
      alert("Invalid JSON file");
    }
  };
  reader.readAsText(file);
}
