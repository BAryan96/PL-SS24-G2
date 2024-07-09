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
      tables: ["orders", "stores", "orders"],
      columns: ["orderDate-YYYY.MM", "state", "total"],
      type: "stackedBar",
      aggregations: ["", "", "Sum"],
      filters: [],
      orderby: ["ASC", "", ""],
    },
    {
      id: "myChart2",
      tables: ["orders", "orders"],
      columns: ["orderDate-YYYY.MM", "total"],
      type: "negativBar",
      aggregations: ["", "Sum"],
      filters: [],
      orderby: ["ASC", ""],
    },
    {
      id: "myChart3",
      tables: ["orders", "orders", "orders"],
      columns: ["orderDate-YYYY", "orderDate-MM", "total"],
      type: "line",
      aggregations: ["", "", "Sum"],
      filters: [],
      orderby: ["ASC", "ASC", ""],
    },
    {
      id: "myChart4",
      tables: ["products", "orders"],
      columns: ["name", "orderID"],
      type: "pie",
      aggregations: ["", "Count"],
      filters: [],
    },
    {
      id: "myChart5",
      tables: ["stores", "stores", "stores", "orders"],
      columns: ["storeID", "longitude", "latitude", "total"],
      type: "heatmap",
      aggregations: ["", "", "", "Sum"],
      filters: [],
    },
    {
      id: "myChart6",
      tables: ["customers", "customers", "customers", "orders"],
      columns: ["customerID", "longitude", "latitude", "total"],
      type: "heatmap",
      aggregations: ["", "", "", "Sum"],
      filters: [],
    },
    {
      id: "myChart7",
      tables: ["orders", "orders", "orders"],
      columns: ["total", "nItems", "total"],
      type: "kpi",
      aggregations: ["Sum", "Sum", "Average"],
      filters: [],
    },
  ]);
});

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

function processStackedBarData(response) {
  const months2 = [...new Set(response.x)];
  const states = [...new Set(response.y0)];

  let processedData = states.map((state) => {
    return {
      name: state,
      type: "bar",
      stack: "total",
      data: months2.map((month) => {
        const totalSum = response.x.reduce((sum, val, index) => {
          if (val === month && response.y0[index] === state) {
            return sum + response.y1[index];
          }
          return sum;
        }, 0);
        return totalSum;
      }),
    };
  });

  return { months2, processedData, states };
}

function calculateGrowthRates(data) {
  let growthRates = [];
  const y0 = data.y0;
  for (let i = 0; i < y0.length; i++) {
    if (i === 0) {
      growthRates.push(0);
    } else {
      let previous = y0[i - 1];
      let current = y0[i];
      let growthRate = (current / previous - 1) * 100;
      growthRates.push(growthRate);
    }
  }
  return growthRates;
}

function sortDataByYearMonth(response, isChart2 = false) {
  let sortedIndices = [...Array(response.x.length).keys()].sort((a, b) => {
    const [monthA, yearA] = response.x[a].split(".").map(Number);
    const [monthB, yearB] = response.x[b].split(".").map(Number);
    return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
  });

  let sortedX = sortedIndices.map((i) => response.x[i]);
  let sortedY0 = sortedIndices.map((i) => response.y0[i]);
  let sortedY1 = isChart2
    ? response.y1
    : sortedIndices.map((i) => response.y1[i]);

  return {
    ...response,
    x: sortedX,
    y0: sortedY0,
    y1: sortedY1,
  };
}

function processPieChartData(response) {
  const productCount = {};
  for (let i = 0; i < response.x.length; i++) {
    const productName = response.x[i];
    const orderCount = response.y0[i];

    productCount[productName] = orderCount;
  }

  const totalOrders = Object.values(productCount).reduce(
    (sum, count) => sum + count,
    0
  );

  const pieData = Object.keys(productCount).map((productName) => ({
    name: productName,
    value: productCount[productName],
  }));

  return pieData;
}

function generateChartOptions(chartType, response, yColumns) {
  let option = {};
  switch (chartType) {
    case "line":
      const uniqueYears = [...new Set(response.x)];
      const monthsData = response.y0.slice(0, 12);

      const lineSeriesData = uniqueYears.map((year) => ({
        name: year,
        type: "line",
        data: response.y1.filter((_, index) => response.x[index] === year),
        itemStyle: {
          color: echarts.color.modifyHSL(
            "#c23531",
            (uniqueYears.indexOf(year) * 120) % 360
          ),
        },
      }));

      option = {
        title: { left: "center", text: "Total Revenue per Year" },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross", label: { backgroundColor: "#6a7985" } },
        },
        legend: { data: uniqueYears, top: "5%" },
        xAxis: { type: "category", boundaryGap: false, data: monthsData },
        yAxis: { type: "value" },
        series: lineSeriesData,
        backgroundColor: darkMode ? "#333" : "#fff",
        textStyle: { color: darkMode ? "#fff" : "#000" },
        toolbox: { feature: getToolboxFeatures() },
        dataZoom: [
          { type: "inside", start: 0, end: 100 },
          { start: 0, end: 100 },
        ],
      };
      break;
    case "boxplot":
      const groupedData = response.x.reduce((acc, year, index) => {
        const productName = response.y1[index];
        const total = response.y3[index];

        if (!acc[productName]) {
          acc[productName] = [];
        }

        acc[productName].push(total);
        return acc;
      }, {});

      const boxplotData = Object.entries(groupedData).map(
        ([productName, totals]) => {
          totals.sort((a, b) => a - b);

          const min = Math.min(...totals);
          const max = Math.max(...totals);
          const q1 = d3.quantile(totals, 0.25);
          const median = d3.quantile(totals, 0.5);
          const q3 = d3.quantile(totals, 0.75);

          return {
            name: productName,
            value: [min, q1, median, q3, max],
            category: response.y2[response.y1.indexOf(productName)],
          };
        }
      );

      option = {
        title: {
          text: "Boxplot of Product Sales by Year",
          left: "center",
        },
        tooltip: {
          trigger: "item",
          formatter: function (params) {
            return `
                    Product: ${params.name}<br/>
                    Category: ${params.data.category}<br/>
                    Min: ${params.value[1]}<br/>
                    Q1: ${params.value[2]}<br/>
                    Median: ${params.value[3]}<br/>
                    Q3: ${params.value[4]}<br/>
                    Max: ${params.value[5]}
                `;
          },
        },
        xAxis: {
          type: "category",
          data: boxplotData.map((item) => item.name),
          axisLabel: {
            interval: 0,
            rotate: 45,
          },
        },
        yAxis: {
          type: "value",
          name: "Total Sales",
        },
        series: [
          {
            name: "Boxplot",
            type: "boxplot",
            data: boxplotData.map((item) => item.value),
          },
        ],
        backgroundColor: darkMode ? "#333" : "#fff",
        textStyle: { color: darkMode ? "#fff" : "#000" },
        toolbox: { feature: getToolboxFeatures() },
      };
      break;

    case "stackedBar":
      const { months2, processedData, states } =
        processStackedBarData(response);

      option = {
        title: {
          text: "Monthly Sales by State",
          left: "center",
        },
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "shadow",
          },
        },
        legend: {
          data: states,
          top: 40,
          padding: [20, 5, 5, 5],
        },
        xAxis: {
          type: "category",
          data: months2,
          axisLabel: {
            interval: 0,
            rotate: 45,
          },
        },
        yAxis: {
          type: "value",
        },
        series: processedData,
        backgroundColor: darkMode ? "#333" : "#fff",
        textStyle: { color: darkMode ? "#fff" : "#000" },
        toolbox: { feature: getToolboxFeatures() },
      };
      break;

    case "negativBar":
      let growthRates = calculateGrowthRates(response);
      console.log(growthRates);
      option = {
        title: {
          left: "center",
          text: "Monthly Sales Growth Rate",
          textStyle: {
            fontFamily: "Arial, sans-serif",
            fontSize: 18,
            fontWeight: "bold",
          },
        },
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(50, 50, 50, 0.7)",
          textStyle: {
            color: "#fff",
          },
          formatter: function (params) {
            return `${params[0].name}: ${params[0].value.toFixed(2)}%`;
          },
        },
        xAxis: {
          type: "category",
          data: response.x,
          axisLine: {
            lineStyle: {
              color: "#ccc",
            },
          },
          axisLabel: {
            fontFamily: "Arial, sans-serif",
            fontSize: 12,
          },
        },
        yAxis: {
          type: "value",
          axisLabel: {
            formatter: "{value}%",
            fontFamily: "Arial, sans-serif",
            fontSize: 12,
          },
          splitLine: {
            lineStyle: {
              type: "dashed",
              color: "#ccc",
            },
          },
        },
        series: [
          {
            data: growthRates,
            type: "bar",
            barWidth: "60%",
            itemStyle: {
              normal: {
                color: function (params) {
                  return params.value < 0 ? "#ff6b6b" : "#1dd1a1";
                },
                barBorderRadius: [5, 5, 0, 0],
                shadowColor: "rgba(0, 0, 0, 0.1)",
                shadowBlur: 10,
              },
            },
            markLine: {
              data: [{ type: "average", name: "Average" }],
              lineStyle: {
                type: "dashed",
                color: "#576574",
              },
              label: {
                formatter: "{b}: {c}%",
                fontFamily: "Arial, sans-serif",
                fontSize: 12,
                color: "#576574",
              },
            },
          },
        ],
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true,
        },
        backgroundColor: "#f5f6fa",
        textStyle: {
          fontFamily: "Arial, sans-serif",
          color: "#2f3542",
        },
        toolbox: {
          feature: getToolboxFeatures(),
        },
      };
      break;

    case "pie":
      const pieData = processPieChartData(response);
      option = {
        title: {
          text: "Product Popularity",
          left: "center",
        },
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b} : {c} ({d}%)",
        },
        legend: {
          orient: "vertical",
          left: "right",
          top: "middle",
          data: response.x,
        },
        series: [
          {
            name: "Product Popularity",
            type: "pie",
            radius: "55%",
            center: ["50%", "60%"],
            data: pieData,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.5)",
              },
            },
            label: {
              show: true,
              formatter: "{b}: {d}%",
            },
            labelLine: {
              show: true,
            },
          },
        ],
        backgroundColor: darkMode ? "#333" : "#fff",
        textStyle: { color: darkMode ? "#fff" : "#000" },
        toolbox: { feature: getToolboxFeatures() },
      };
      break;
    case "donut":
      option = {
        title: { left: "center", text: "Donut Chart" },
        tooltip: {
          trigger: "item",
          formatter: function (params) {
            const dataIndex = params.dataIndex;
            const category = response.y1 ? response.y1[dataIndex] : "N/A";
            return `${params.name}: ${params.value}<br>Category: ${category}`;
          },
        },
        toolbox: { feature: getToolboxFeatures() },
        legend: { top: "5%", left: "center" },
        series: [
          {
            name: "Data",
            type: "pie",
            radius: ["40%", "70%"],
            avoidLabelOverlap: false,
            label: { show: false, position: "center" },
            emphasis: {
              label: { show: true, fontSize: "20", fontWeight: "bold" },
            },
            labelLine: { show: false },
            data: response.x.map((x, index) => ({
              value: response.y0[index],
              name: x,
              itemStyle: highlightedPoints[`${response.chartId}-${index}`]
                ? {
                    borderColor: "black",
                    borderWidth: 2,
                  }
                : {},
            })),
          },
        ],
      };
      break;
    case "area":
    case "line":
      option = {
        title: {
          left: "center",
          text: chartType === "area" ? "Large Scale Area Chart" : "Line Chart",
        },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross", label: { backgroundColor: "#6a7985" } },
        },
        legend: { data: yColumns, top: "5%" },
        xAxis: { type: "category", boundaryGap: false, data: response.x },
        yAxis: { type: "value" },
        series: yColumns.map((yColumn, seriesIndex) => ({
          name: yColumn,
          type: "line",
          stack: "total",
          areaStyle:
            chartType === "area"
              ? {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: "rgb(255, 158, 68)" },
                    { offset: 1, color: "rgb(255, 70, 131)" },
                  ]),
                }
              : undefined,
          emphasis: { focus: "series" },
          itemStyle: { color: "rgb(255, 70, 131)" },
          data: response[`y${seriesIndex}`].map((y, dataIndex) => ({
            value: y,
            itemStyle: highlightedPoints[
              `${response.chartId}-${seriesIndex}-${dataIndex}`
            ]
              ? {
                  borderColor: "black",
                  borderWidth: 2,
                }
              : {},
          })),
        })),
        backgroundColor: darkMode ? "#333" : "#fff",
        textStyle: { color: darkMode ? "#fff" : "#000" },
        toolbox: { feature: getToolboxFeatures() },
        dataZoom: [
          { type: "inside", start: 0, end: 100 },
          { start: 0, end: 100 },
        ],
      };
      break;
    case "scatter":
      option = {
        title: { left: "center", text: "Basic Scatter Chart" },
        tooltip: {
          trigger: "item",
          position: function (pt) {
            return [pt[0], "10%"];
          },
          formatter: function (params) {
            return `<strong>X:</strong> ${params.value[0]}<br><strong>Y:</strong> ${params.value[1]}`;
          },
        },
        toolbox: { feature: getToolboxFeatures() },
        xAxis: { type: "category" },
        yAxis: { type: "category" },
        series: [
          {
            symbolSize: 20,
            data: response.x.map((x, index) => ({
              value: [x, response.y0[index]],
              itemStyle: highlightedPoints[`${response.chartId}-${index}`]
                ? {
                    borderColor: "black",
                    borderWidth: 2,
                  }
                : {},
            })),
            type: "scatter",
            itemStyle: {
              color: response.colors ? response.colors[0] : "#c23531",
            },
          },
        ],
        backgroundColor: darkMode ? "#333" : "#fff",
        textStyle: { color: darkMode ? "#fff" : "#000" },
      };
      break;
    case "stacked":
      const years = [...new Set(response.x)];
      const months = response.y0.slice(0, 12);

      const seriesData = years.map((year) => ({
        name: year,
        type: "line",
        areaStyle: {},
        emphasis: { focus: "series" },
        data: response.y1.filter((_, index) => response.x[index] === year),
        itemStyle: {
          color: echarts.color.modifyHSL("#c23531", years.indexOf(year) * 120),
        },
      }));

      option = {
        title: { left: "center", text: "Stacked Area Chart" },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross", label: { backgroundColor: "#6a7985" } },
        },
        legend: { top: "5%", left: "center" },
        xAxis: { type: "category", data: months },
        yAxis: { type: "value" },
        series: seriesData,
        backgroundColor: darkMode ? "#333" : "#fff",
        textStyle: { color: darkMode ? "#fff" : "#000" },
        toolbox: { feature: getToolboxFeatures() },
        dataZoom: [
          { type: "inside", start: 0, end: 100 },
          { start: 0, end: 100 },
        ],
      };
      break;

    default:
      option = {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross", label: { backgroundColor: "#6a7985" } },
        },
        toolbox: { feature: getToolboxFeatures() },
        xAxis: { type: "category", data: response.x },
        yAxis: { type: "value" },
        series: [
          {
            type: chartType,
            data: response.y0.map((y, index) => ({
              value: y,
              itemStyle: highlightedPoints[`${response.chartId}-${index}`]
                ? {
                    borderColor: "black",
                    borderWidth: 2,
                  }
                : {},
            })),
          },
        ],
      };
  }
  return option;
}



function getToolboxFeatures() {
  return {
    saveAsImage: {},
    restore: {},
    dataView: { readOnly: false },
    magicType: { type: ['line', 'bar', 'stack'] }
  };
}


async function initializeHeatmap(chartId, table, column, aggregation) {
  return new Promise((resolve, reject) => {
    const baseLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }
    );

    const cfg = {
      radius: chartId === "myChart6" ? 0.3 : 0.5,
      maxOpacity: chartId === "myChart6" ? 0.5 : 0.8,
      scaleRadius: true,
      useLocalExtrema: true,
      latField: "lat",
      lngField: "lng",
      valueField: "value",
    };

    const heatmapLayer = new HeatmapOverlay(cfg);

    const map = new L.Map(chartId, {
      center: new L.LatLng(37.5, -117),
      zoom: 6,
      layers: [baseLayer],
    });

    const titleText =
      chartId === "myChart5"
        ? "Store Locations based on Total Revenue"
        : "Customer Locations based on Total Revenue";
    const title = L.control({ position: "topright" });

    title.onAdd = function (map) {
      const div = L.DomUtil.create("div", "map-title");
      div.innerHTML = `<h2>${titleText}</h2>`;
      div.style.backgroundColor = "transparent";
      div.style.padding = "10px";
      div.style.fontFamily = "Arial, sans-serif";
      div.style.fontSize = "12px";
      return div;
    };

    title.addTo(map);

    let tables, columns;
    if (chartId === "myChart5") {
      tables = ["stores", "stores", "stores", table];
      columns = ["storeID", "longitude", "latitude", column];
    } else if (chartId === "myChart6") {
      tables = ["customers", "customers", "customers", table];
      columns = ["customerID", "longitude", "latitude", column];
    }

    const requestData = {
      tables: tables,
      columns: columns,
      chartType: "heatmap",
      aggregations: ["", "", "", aggregation],
      filters: filter,
    };

    fetchData(requestData)
      .then((responseData) => {
        if (
          !responseData.hasOwnProperty("x") ||
          !responseData.hasOwnProperty("y0") ||
          !responseData.hasOwnProperty("y1") ||
          !responseData.hasOwnProperty("y2")
        ) {
          console.error(
            "Data does not have the required properties:",
            responseData
          );
          return;
        }

        const data = responseData.x.map((id, index) => ({
          id,
          lng: parseFloat(responseData.y0[index]),
          lat: parseFloat(responseData.y1[index]),
          value: parseFloat(responseData.y2[index]),
        }));

        const heatmapData = {
          max: Math.max(...data.map((point) => point.value)),
          data,
        };

        heatmapLayer.setData(heatmapData);
        map.addLayer(heatmapLayer);

        data.forEach((point) => {
          const marker = L.circleMarker([point.lat, point.lng], {
            radius: 3,
            fillColor: "#3388ff",
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8,
          });

          const popupContent = `
                    <b>ID:</b> ${point.id}<br>
                    <b>Longitude:</b> ${point.lng}<br>
                    <b>Latitude:</b> ${point.lat}<br>
                    <b>Total:</b> ${point.value}
                `;
          marker.bindPopup(popupContent);
          marker.addTo(map);
        });

        resolve();
      })
      .catch((error) => {
        console.log("Error:", error);
        reject(error);
      });
  });
}

async function initializeChart(config) {
  if (config.type === "heatmap") {
    await initializeHeatmap(
      config.id,
      config.tables[3],
      config.columns[3],
      config.aggregations[3]
    );
    charts.push({ chart: config.id, config: config });
  } else if (config.type === "kpi") {
    try {
      let response = await fetchData({
        tables: config.tables,
        columns: config.columns,
        chartType: config.type,
        aggregations: config.aggregations,
        filters: config.filters,
      });
      console.log(response);

      response.chartId = config.id;
      originalData[config.id] = response;

      initializeKPI(config, response);
      charts.push({ chart: config.id, config: config });
    } catch (error) {
      console.error("Failed to initialize KPI chart:", error);
    }
  } else {
    const myChart = echarts.init(document.getElementById(config.id));
    const existingChart = charts.find(
      (chartObj) => chartObj.config.id === config.id
    );
    if (existingChart) {
      existingChart.chart.dispose();
      charts = charts.filter((chartObj) => chartObj.config.id !== config.id);
    }
    charts.push({ chart: myChart, config: config });

    const requestData = {
      tables: config.tables,
      columns: config.columns,
      chartType: config.type,
      aggregations: config.aggregations,
      filters: config.filters,
      orderby: config.orderby,
    };

    try {
      let response = await fetchData(requestData);
      console.log(response);

      response.chartId = config.id;

      if (response.y0.length < 2) {
        console.error("Nicht genügend Daten für die Diagrammerstellung");
        return;
      }

      originalData[config.id] = response;
      const option = generateChartOptions(
        config.type,
        response,
        config.columns.slice(1)
      );
      myChart.setOption(option);
      myChart.on("click", (params) =>
        handleChartClick(myChart, config, params)
      );
    } catch (error) {
      console.error("Failed to initialize chart:", error);
    }
  }
}

function initializeKPI(config, response) {
  const totalRevenue = parseFloat(response.x[0]);
  const totalItemsSold = parseFloat(response.y0[0]);
  const averageOrderValue = parseFloat(response.y1[0]);

  const kpiContainer = document.getElementById(config.id);
  kpiContainer.innerHTML = `
        <div class="kpi-section" style="margin-bottom: 20px;">
            <h3 style="font-size: 24px;">Total Revenue</h3>
            <p style="font-size: 20px; font-weight: bold;">$${totalRevenue.toFixed(
              2
            )}</p>
        </div>
        <div class="kpi-section" style="margin-bottom: 20px;">
            <h3 style="font-size: 24px;">Total Sold Products</h3>
            <p style="font-size: 20px; font-weight: bold;">${totalItemsSold.toLocaleString()}</p>
        </div>
        <div class="kpi-section" style="margin-bottom: 20px;">
            <h3 style="font-size: 24px;">Average Order Value</h3>
            <p style="font-size: 20px; font-weight: bold;">$${averageOrderValue.toFixed(
              2
            )}</p>
        </div>
    `;
}


async function initializeGeoChart(
  chartId,
  markerType,
  table,
  column,
  aggregation
) {
  return new Promise((resolve, reject) => {
    const baseLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }
    );

    const cfg = {
      radius: 0.2,
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

    const map = new L.Map(chartId, {
      center: new L.LatLng(37.5, -117),
      zoom: 6,
      layers: [baseLayer],
    });

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
      tables: ["customers", "customers", "customers", table],
      columns: ["customerID", "longitude", "latitude", column],
      chartType: "heatmap",
      aggregations: ["", "X", "X", aggregation],
      filters: filter,
    };

    fetchData(requestData)
      .then((responseData) => {
        if (
          !responseData.hasOwnProperty("x") ||
          !responseData.hasOwnProperty("y0") ||
          !responseData.hasOwnProperty("y1") ||
          !responseData.hasOwnProperty("y2")
        ) {
          console.error(
            "Data does not have the required properties:",
            responseData
          );
          return;
        }

        const data = [];
        for (let i = 0; i < responseData.x.length; i++) {
          data.push({
            id: responseData.x[i],
            longitude: parseFloat(responseData.y0[i]),
            latitude: parseFloat(responseData.y1[i]),
            Aggregation: parseFloat(responseData.y2[i]),
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
            `<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}<br><b>Aggregation:</b> ${point.Aggregation}`
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

        resolve();
      })
      .catch((error) => {
        console.log("Error:", error);
        reject(error);
      });
  });
}

async function loadDynamicMarkers(
  chartId,
  markerType,
  table,
  column,
  aggregation
) {
  const requestData = {
    tables: ["stores", "stores", "stores", table],
    columns: ["storeID", "longitude", "latitude", column],
    chartType: "dynamicMarkers",
    aggregations: ["", "X", "X", aggregation],
    filters: filter,
  };
  if (markerType === "stores") {
    requestData.tables = ["stores", "stores", "stores", table];
    requestData.columns = ["storeID", "longitude", "latitude", column];
  } else if (markerType === "customers") {
    requestData.tables = ["customers", "customers", "customers", table];
    requestData.columns = ["customerID", "longitude", "latitude", column];
  }

  fetchData(requestData)
    .then((responseData) => {
      if (
        !responseData.hasOwnProperty("x") ||
        !responseData.hasOwnProperty("y0") ||
        !responseData.hasOwnProperty("y1") ||
        !responseData.hasOwnProperty("y2")
      ) {
        console.error(
          "Data does not have the required properties:",
          responseData
        );
        return;
      }

      const data = responseData.x.map((x, index) => ({
        id: x,
        longitude: parseFloat(responseData.y0[index]),
        latitude: parseFloat(responseData.y1[index]),
        Aggregation: parseFloat(responseData.y2[index]),
      }));

      const maxAggregation = Math.max(
        ...data.map((point) => point.Aggregation)
      );

      const map = new L.Map(chartId, {
        center: new L.LatLng(37.5, -117),
        zoom: 6,
        layers: [
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors",
            maxZoom: 18,
          }),
        ],
      });

      data.forEach((point) => {
        const scale = point.Aggregation / maxAggregation;
        const markerOptions = {
          radius: 3 + scale * 17,
          fillColor: markerType === "stores" ? "blue" : "pink",
          color: "#000",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.6,
        };

        const marker = L.circleMarker(
          [point.latitude, point.longitude],
          markerOptions
        );
        const popupContent = `<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}<br><b>Aggregation:</b> ${point.Aggregation}`;
        marker.bindPopup(popupContent);
        marker.on("click", () => handleMarkerClick(marker, point));
        map.addLayer(marker);
      });
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function handleChartClick(chartInstance, config, params) {
  if (params.componentType === "series") {
    const seriesIndex = params.seriesIndex;
    const dataIndex = params.dataIndex;
    const key = `${chartInstance.id}-${seriesIndex}-${dataIndex}`;
    let value;

    if (config.type === "scatter") {
      value = params.value[0];
    } else {
      value = params.name;
    }

    if (highlightedPoints[key]) {
      delete highlightedPoints[key];
      filter = filter.filter((item) => item.filterValue !== value);
      config.filters = config.filters.filter(
        (item) => item.filterValue !== value
      );
      if (Object.keys(highlightedPoints).length === 0) {
        resetAllCharts();
      } else {
        updateHighlighting(chartInstance);
        updateAllCharts(chartInstance.id);
      }
    } else {
      highlightedPoints[key] = true;
      const newFilter = {
        chartId: chartInstance.id,
        filterTable: config.tables[0],
        filterColumn: config.columns[0],
        filterValue: value,
      };
      filter.push(newFilter);
      config.filters.push(newFilter);
      updateHighlighting(chartInstance);
      updateAllCharts(chartInstance.id);
    }
  }
}

function handleMarkerClick(marker, point) {
  const key = `marker-${point.id}`;
  if (highlightedPoints[key]) {
    delete highlightedPoints[key];
    filter = filter.filter((item) => item.filterValue !== point.id);
    if (Object.keys(highlightedPoints).length === 0) {
      resetAllCharts();
    } else {
      updateAllCharts();
    }
    marker.setStyle({ color: "#000" });
  } else {
    highlightedPoints[key] = true;
    filter.push({
      chartId: marker.options.id,
      filterTable: "stores",
      filterColumn: "storeID",
      filterValue: point.id,
    });
    updateAllCharts();
    marker.setStyle({ color: "red" });
  }
}

function updateHighlighting(chartInstance) {
  const series = chartInstance.getOption().series;
  series.forEach((serie, seriesIndex) => {
    serie.data.forEach((dataPoint, dataIndex) => {
      const key = `${chartInstance.id}-${seriesIndex}-${dataIndex}`;
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

  chartInstance.setOption({ series: series });
}

function updateAllCharts(excludeChartId) {
  charts.forEach(({ chart, config }) => {
    if (chart.id !== excludeChartId) {
      const applicableFilter = filter.filter(
        (f) =>
          f.filterTable === config.tables[0] &&
          f.filterColumn === config.columns[0]
      );
      if (applicableFilter.length > 0) {
        const data = applyFilters(originalData[config.id], applicableFilter);
        const option = generateChartOptions(
          config.type,
          data,
          config.columns.slice(1)
        );
        chart.setOption(option);
      } else {
        const option = generateChartOptions(
          config.type,
          originalData[config.id],
          config.columns.slice(1)
        );
        chart.setOption(option);
      }
    }
  });
}

function applyFilters(data, applicableFilter) {
  if (applicableFilter.length === 0) {
    return data;
  }

  const filteredData = { x: [], y0: [], y1: [] };

  data.x.forEach((x, index) => {
    const match = applicableFilter.some((f) => f.filterValue === x);
    if (match) {
      filteredData.x.push(x);
      filteredData.y0.push(data.y0[index]);
      if (data.y1) {
        filteredData.y1.push(data.y1[index]);
      }
    }
  });

  return filteredData;
}

function resetAllCharts() {
  filter = [];
  highlightedPoints = {};
  charts.forEach(({ chart, config }) => {
    const option = generateChartOptions(
      config.type,
      originalData[config.id],
      config.columns.slice(1)
    );
    chart.setOption(option);
  });
}

async function loadChartsSequentially(chartConfigs) {
  charts = [];
  for (const config of chartConfigs) {
    await initializeChart(config);
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
