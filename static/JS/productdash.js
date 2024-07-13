let darkMode = false;
let decalPattern = false;
let charts = [];
let filter = [];
let highlightedPoints = {};
let originalData = {};
let kpiData = {};

$(document).ready(async function () {
  await loadChartsSequentially([
    {
      id: "myChart1",
      tables: ["products", "products", "products","orderitems"],
      columns: ["name", "size", "price","SKU"],
      type: "stackedBar",
      aggregations: ["", "", "","Count"],
      filters: [],
    },
    {
      id: "myChart2",
      tables: ["orders", "orders", "products"],
      columns: ["orderDate-YYYY", "total", "name"],
      type: "dynamicBar",
      aggregations: ["", "Sum", ""],
      filters: [],
    },
    {
      id: "myChart3",
      tables: ["products", "products", "products", "products"],
      columns: ["price", "ingredients", "size", "name"],
      type: "scatter",
      aggregations: ["", "", "", ""],
      filters: [],
    },
    {
      id: "myChart4",
      tables: ["products", "products", "orderitems","products"],
      columns: ["category", "name", "SKU","price"],
      type: "treemap",
      aggregations: ["", "","Count","Sum"],
      filters: []
    },
    {
      id: "myChart5",
      tables: ["products", "orders", "orders", "products"],
      columns: ["name", "nItems", "total", "size"],
      type: "kpi",
      aggregations: ["", "Sum", "Sum", ""],
      filters: [],
    },
    {
      id: "myChart6",
      tables: ["products", "products"],
      columns: ["launch", "name"],
      type: "bar",
      aggregations: ["", "Count"],
      filters: [],
    },
    {
      id: "myChart7",
      tables: ["products", "products"],
      columns: ["name", "price"],
      type: "boxplot",
      aggregations: ["", ""],
      filters: [],
    },
  ]);
});

function transformData(response) {
  if (
    !response ||
    !response.x ||
    !response.y0 ||
    !response.y1 ||
    !response.y2 ||
    !response.y3 ||
    !response.y4
  ) {
    console.error("Ungültiges Datenformat:", response);
    return [];
  }

  const transformedData = response.x.map((name, index) => ({
    name: response.x[index],
    category: response.y0[index],
    price: parseFloat(response.y1[index]),
    size: response.y2[index],
    ingredients: response.y3[index],
    launch: new Date(response.y4[index]),
  }));
  console.log("Transformed Data:", transformedData);
  return transformedData;
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
const sizeColors = {
  Small: "#1f78b4",
  Medium: "#33a02c",
  Large: "#e31a1c",
  "Extra Large": "#ff7f00",
};

function processScatterData(response) {
  const data = response.x.map((price, index) => ({
    value: [response.y0[index].split(",").length, parseFloat(price)],
    size: response.y1[index],
    name: response.y2[index],
  }));
  console.log("Processed Scatter Data: ", data);
  return data;
}

function processBoxplotData(response) {
  const dataMap = {};

  response.x.forEach((name, index) => {
    if (!dataMap[name]) {
      dataMap[name] = [];
    }
    dataMap[name].push(parseFloat(response.y0[index]));
  });

  console.log("Collected Data:", dataMap);

  const x = Object.keys(dataMap);
  const y = x.map((name) => {
    const values = dataMap[name];
    values.sort((a, b) => a - b);

    const min = values[0];
    const max = values[values.length - 1];

    const q1 = getPercentile(values, 0.25);
    const median = getPercentile(values, 0.5);
    const q3 = getPercentile(values, 0.75);

    console.log(
      `Pizza: ${name}, Min: ${min}, Q1: ${q1}, Median: ${median}, Q3: ${q3}, Max: ${max}`
    );

    const lowerWhisker = min;
    const upperWhisker = max;

    return [lowerWhisker, q1, median, q3, upperWhisker];
  });

  console.log("Processed Boxplot Data:", { x, y });
  return { x, y };
}

function getPercentile(arr, percentile) {
  const index = (arr.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = lower + 1;
  const weight = index % 1;

  if (upper >= arr.length) return arr[lower];
  return arr[lower] * (1 - weight) + arr[upper] * weight;
}

function processBarData(response) {
  const filteredData = response.x
    .map((name, index) => ({
      name: name,
      value: response.y0[index],
    }))
    .filter(
      (data) =>
        data.name !== null &&
        data.name !== undefined &&
        data.value !== null &&
        data.value !== undefined
    )
    .sort((a, b) => b.value - a.value);

  return {
    x: filteredData.map((data) => data.name),
    y: filteredData.map((data) => data.value),
  };
}

function processDynamicBarData(response) {
  const yearProductMap = {};

  response.x.forEach((year, index) => {
    const product = response.y1[index];
    const total = parseFloat(response.y0[index]);

    if (!yearProductMap[year]) {
      yearProductMap[year] = {};
    }

    if (!yearProductMap[year][product]) {
      yearProductMap[year][product] = 0;
    }

    yearProductMap[year][product] += total;
  });

  const years = Object.keys(yearProductMap).sort();
  const products = Array.from(new Set(response.y1));

  const seriesData = products.map((product) => {
    return {
      name: product,
      type: "bar",
      label: {
        show: true,
        position: "inside",
        formatter: "{c}",
        fontSize: 12,
        fontWeight: "bold",
      },
      data: years.map((year) => yearProductMap[year][product] || 0),
    };
  });

  return { years, seriesData, products };
}

function generateColorMap(data) {
  const colorMap = {};
  data.forEach((point) => {
    const size = point.size;
    if (sizeColors[size]) {
      colorMap[size] = sizeColors[size];
    } else {
      colorMap[size] = "#000000";
    }
  });
  return colorMap;
}

function processstackedBarData(response) {
  if (
    !response ||
    !response.x ||
    !response.y0 ||
    !response.y1 ||
    !response.y2
  ) {
    console.error("Ungültiges Datenformat:", response);
    return { names: [], processedData: [], sizes: [] };
  }

  console.log("Eingehende Daten:", response);

  const nameSizeMap = {};

  response.x.forEach((name, index) => {
    const size = response.y0[index];
    const price = parseFloat(response.y1[index]);
    const skuCount = parseInt(response.y2[index], 10);

    if (isNaN(price) || isNaN(skuCount)) {
      console.error("Ungültiger Preis oder SKU-Anzahl bei Index:", index, "Preis:", price, "SKU-Anzahl:", skuCount);
      return;
    }

    const total = price * skuCount;

    console.log(`Berechnung bei Index ${index}: Name=${name}, Größe=${size}, Preis=${price}, SKU-Anzahl=${skuCount}, Total=${total}`);

    if (!nameSizeMap[name]) {
      nameSizeMap[name] = {};
    }

    if (!nameSizeMap[name][size]) {
      nameSizeMap[name][size] = 0;
    }

    nameSizeMap[name][size] += total;
  });

  const names = Object.keys(nameSizeMap);
  const sizes = Array.from(new Set(response.y0));

  console.log("Verarbeitete Daten:", { names, nameSizeMap, sizes });

  const processedData = sizes.map((size) => ({
    name: size,
    type: "bar",
    stack: "total",
    data: names.map((name) => nameSizeMap[name][size] || 0),
    itemStyle: {
      color: sizeColors[size],
    },
  }));

  console.log("ProcessedData:", processedData);

  return { names, processedData, sizes };
}




function processTreemapData(response) {
  const categoryMap = {};

  response.x.forEach((category, index) => {
    const product = response.y0[index];
    const total = parseFloat(response.y2[index]);


    if (!categoryMap[category]) {
      categoryMap[category] = {
        name: category,
        children: [],
      };
    }

    categoryMap[category].children.push({
      name: product,
      value: total,
    });
  });

  return Object.values(categoryMap);
}

function getToolboxFeatures() {
  return {
    saveAsImage: {},
    restore: {},
    dataView: { readOnly: false },
    magicType: { type: ['line', 'bar', 'stack'] }
  };
}

function getToolboxFeaturesForRest() {
  return {
    saveAsImage: {},
    restore: {},
    dataView: { readOnly: false },
  };
}


function generateChartOptions(chartType, response, chart) {
  let option = {};
  switch (chartType) {
    case "treemap":
      const treemapData = processTreemapData(response);
      option = {
        title: {
          text: "Revenue Based on Product Category",
          left: "center",
          textStyle: {
            fontSize: 18,
            fontWeight: "bold",
            fontFamily: "Arial, sans-serif",
          },
        },
        tooltip: {
          trigger: "item",
          formatter: function (info) {
            const value = info.value;
            return `${info.name}All time total Revenue  $${value.toFixed(2)}`;
          },
        },
        toolbox: { feature: getToolboxFeaturesForRest() },
        series: [
          {
            type: "treemap",
            data: treemapData,
            label: {
              show: true,
              formatter: function (info) {
                const value = info.value;
                return `${info.name}$${value.toFixed(2)}`;
              },
              fontSize: 14,
              fontFamily: "Arial, sans-serif",
            },
            itemStyle: {
              borderColor: "#fff",
              borderWidth: 2,
              gapWidth: 2,
              shadowColor: "rgba(0, 0, 0, 0.3)",
              shadowBlur: 10,
              color: {
                type: "gradient",
                colorStops: [
                  { offset: 0, color: "#ff7f50" },
                  { offset: 0.2, color: "#87cefa" },
                  { offset: 0.4, color: "#da70d6" },
                  { offset: 0.6, color: "#32cd32" },
                  { offset: 0.8, color: "#6495ed" },
                  { offset: 1, color: "#ff69b4" },
                ],
              },
            },
            levels: [
              {
                itemStyle: {
                  borderColor: "#777",
                  borderWidth: 3,
                  gapWidth: 3,
                },
                upperLabel: {
                  show: true,
                  height: 30,
                  textStyle: {
                    fontSize: 18,
                    fontWeight: "bold",
                    fontFamily: "Arial, sans-serif",
                    color: "#333",
                  },
                },
              },
            ],
          },
        ],
      };
      break;
    case "stackedBar":
      const { names, processedData, sizes } = processstackedBarData(response);

      option = {
        title: {
          text: "Most popular Products/Sizes based on $",
          left: "center",
        },
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "shadow",
          },
          formatter: function (params) {
            let tooltipText = `<strong>${params[0].name}</strong><br/>`;

            const sizeOrder = ["Small", "Medium", "Large", "Extra Large"];
            let sortedParams = [];

            sizeOrder.forEach((size) => {
              params.forEach((param) => {
                if (param.seriesName === size) {
                  sortedParams.push(param);
                }
              });
            });

            sortedParams.forEach((param) => {
              tooltipText += `<span style="color:${param.color}; font-weight:bold;">${param.seriesName}:</span> $${param.value}<br/>`;
            });

            return tooltipText;
          },
        },
        legend: {
          data: sizes,
          top: 40,
          padding: [20, 5, 5, 5],
        },
        toolbox: { feature: getToolboxFeatures() },
        xAxis: {
          type: "category",
          data: names,
          axisLabel: {
            interval: 0,
            rotate: 45,
          },
        },
        yAxis: {
          type: "value",
        },
        series: processedData,
      };
      break;
    case "scatter":
      const scatterData = processScatterData(response);

      option = {
        title: {
          text: "Correlation between Number of Ingredients vs Price",
          left: "center",
        },
        tooltip: {
          trigger: "item",
          axisPointer: {
            type: "cross",
          },
          formatter: function (params) {
            return [
              "Product Name: " + params.data.name,
              "Number of Ingredients: " + params.value[0],
              "Price: $" + params.value[1],
              "Size: " + params.data.size,
            ].join("<br/>");
          },
        },
        toolbox: { feature: getToolboxFeaturesForRest() },
        xAxis: {
          type: "value",
          name: "Ingredients",
        },
        yAxis: {
          type: "value",
          name: "Price ($)",
        },
        series: [
          {
            name: "Pizzas",
            type: "scatter",
            data: scatterData,
            itemStyle: {
              color: function (params) {
                return sizeColors[params.data.size];
              },
            },
          },
        ],
      };
      break;
    case "boxplot":
      const boxplotData = processBoxplotData(response);
      console.log("Boxplot Data:", boxplotData);

      option = {
        title: {
          text: "Price distribution of the pizzas",
          left: "center",
        },
        tooltip: {
          trigger: "item",
          axisPointer: {
            type: "shadow",
          },
          formatter: function (params) {
            const value = params.data;
            return [
              "Pizza: " + params.name,
              "Minimum: " + value[1],
              "Q1: " + value[2],
              "Median: " + value[3],
              "Q3: " + value[4],
              "Maximum: " + value[5],
            ].join("<br/>");
          },
        },
        toolbox: { feature: getToolboxFeaturesForRest() },
        xAxis: {
          type: "category",
          data: boxplotData.x,
          axisLabel: {
            interval: 0,
            rotate: 45,
          },
        },
        yAxis: {
          type: "value",
        },
        series: [
          {
            name: "Preise",
            type: "boxplot",
            data: boxplotData.y,
            itemStyle: {
              borderColor: "#8A2BE2",
              color: "#FFD700",
            },
          },
        ],
      };
      break;
    case "bar":
      const barData = processBarData(response);

      option = {
        title: {
          text:
            response.chartId === "myChart6"
              ? "Launch Dates"
              : "Most Popular Products based on $",
          left: "center",
        },
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "cross",
            label: {
              backgroundColor: "#6a7985",
            },
          },
        },
        toolbox: { feature: getToolboxFeatures() },
        xAxis: {
          type: "category",
          data: barData.x,
          axisLabel: {
            interval: 0,
            rotate: 45,
          },
        },
        yAxis: {
          type: "value",
        },
        series: [
          {
            type: "bar",
            data: barData.y.map((y, index) => ({
              value: y,
              itemStyle: {
                color: response.colors ? response.colors[index] : null,
              },
            })),
          },
        ],
      };
      break;
    case "dynamicBar":
      const { years, seriesData, products } = processDynamicBarData(response);

      option = {
        title: {
          text: "Sales by Product and Year",
          left: "center",
        },
        tooltip: {
          trigger: "item",
          axisPointer: {
            type: "shadow",
          },
          formatter: function (params) {
            return `${params.seriesName}: ${params.value}`;
          },
        },
        legend: {
          top: "5%",
          data: products,
        },
        toolbox: { feature: getToolboxFeatures() },
        xAxis: {
          type: "category",
          axisTick: { show: false },
          data: years,
          axisLabel: {
            interval: 0,
            rotate: 45,
          },
        },
        yAxis: {
          type: "value",
        },
        series: seriesData.map((series) => ({
          ...series,
          barGap: "10%",
          label: {
            show: false,
          },
          itemStyle: {
            normal: {
              barBorderRadius: [5, 5, 0, 0],
            },
          },
        })),
      };
      break;
    default:
      console.error("Unsupported chart type:", chartType);
  }
  return option;
}

function updateChartAppearance(chart) {
  const option = chart.getOption();

  if (darkMode) {
    option.backgroundColor = "#333";
    option.title[0].textStyle.color = "#fff";
    option.xAxis[0].axisLabel.color = "#fff";
    option.yAxis[0].axisLabel.color = "#fff";
    option.legend[0].textStyle.color = "#fff";
  } else {
    option.backgroundColor = "#fff";
    option.title[0].textStyle.color = "#000";
    option.xAxis[0].axisLabel.color = "#000";
    option.yAxis[0].axisLabel.color = "#000";
    option.legend[0].textStyle.color = "#000";
  }

  option.series.forEach((serie) => {
    if (decalPattern) {
      serie.itemStyle = serie.itemStyle || {};
      serie.itemStyle.decal = {
        symbol: "rect",
        color: "rgba(0, 0, 0, 0.1)",
        dashArrayX: [1, 0],
        dashArrayY: [2, 5],
        rotation: Math.PI / 4,
        symbolSize: 1,
      };
    } else {
      if (serie.itemStyle && serie.itemStyle.decal) {
        delete serie.itemStyle.decal;
      }
    }
  });

  chart.setOption(option, { notMerge: true });
}

function initializeKPI(config, response) {
  const products = response.x.map((name, index) => ({
    name,
    quantity: parseFloat(response.y0[index]),
    revenue: parseFloat(response.y1[index]),
    size: response.y2[index],
  }));

  const sortedByQuantity = [...products].sort(
    (a, b) => b.quantity - a.quantity
  );
  const sortedByRevenue = [...products].sort((a, b) => b.revenue - a.revenue);

  const top3ByQuantity = sortedByQuantity.slice(0, 3);
  const bottom3ByQuantity = sortedByQuantity.slice(-3);
  const top3ByRevenue = sortedByRevenue.slice(0, 3);
  const bottom3ByRevenue = sortedByRevenue.slice(-3);

  const kpiContainer = document.getElementById(config.id);
  kpiContainer.innerHTML = `
        <div class="kpi-section">
            <h3>Top 3 Products by Quantity</h3>
            ${top3ByQuantity
              .map(
                (product) => `
                <p>Product: ${product.name}, Quantity: ${product.quantity}, Size: ${product.size}</p>
            `
              )
              .join("")}
        </div>
        <div class="kpi-section">
            <h3>Bottom 3 Products by Quantity</h3>
            ${bottom3ByQuantity
              .map(
                (product) => `
                <p>Product: ${product.name}, Quantity: ${product.quantity}, Size: ${product.size}</p>
            `
              )
              .join("")}
        </div>
        <div class="kpi-section">
            <h3>Top 3 Products by Revenue</h3>
            ${top3ByRevenue
              .map(
                (product) => `
                <p>Product: ${
                  product.name
                }, Revenue: $${product.revenue.toFixed(2)}, Size: ${
                  product.size
                }</p>
            `
              )
              .join("")}
        </div>
        <div class="kpi-section">
            <h3>Bottom 3 Products by Revenue</h3>
            ${bottom3ByRevenue
              .map(
                (product) => `
                <p>Product: ${
                  product.name
                }, Revenue: $${product.revenue.toFixed(2)}, Size: ${
                  product.size
                }</p>
            `
              )
              .join("")}
        </div>
    `;
}

async function initializeChart(config) {
  console.log("Initializing chart with config:", config);
  const chartElement = document.getElementById(config.id);
  if (!chartElement) {
    console.error("Chart element with ID " + config.id + " not found.");
    return;
  }

  const myChart = echarts.init(chartElement);
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
  };

  try {
    let response = await fetchData(requestData);
    console.log("Received response for chart ID " + config.id, response);

    response.chartId = config.id;

    if (response.y0.length < 2) {
      console.error("Nicht genügend Daten für Wachstumsraten");
      return;
    }

    originalData[config.id] = response;
    if (config.id === "myChart5") {
      kpiData = response;
      initializeKPI(config, response);
    } else {
      const option = generateChartOptions(config.type, response);
      console.log("Chart options generated:", option);
      myChart.setOption(option);
    }
  } catch (error) {
    console.error("Failed to initialize chart:", error);
  }
}

function handleMouseOver(chartInstance, config, params) {
  if (params.componentType === "series" && config.id === "myChart2") {
    const seriesName = params.seriesName;
    charts.forEach(({ chart, config }) => {
      if (config.id === "myChart2") {
        const option = chart.getOption();
        option.series.forEach((series) => {
          series.itemStyle = series.itemStyle || {};
          if (series.name === seriesName) {
            series.itemStyle.opacity = 1;
          } else {
            series.itemStyle.opacity = 0.3;
          }
        });
        chart.setOption(option);
      }
    });
  }
}

function handleMouseOut(chartInstance, config, params) {
  if (config.id === "myChart2") {
    charts.forEach(({ chart, config }) => {
      if (config.id === "myChart2") {
        const option = chart.getOption();
        option.series.forEach((series) => {
          series.itemStyle = series.itemStyle || {};
          series.itemStyle.opacity = 1;
        });
        chart.setOption(option);
      }
    });
  }
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

  const filteredData = { x: [], y0: [] };

  data.x.forEach((x, index) => {
    const match = applicableFilter.some((f) => f.filterValue === x);
    if (match) {
      filteredData.x.push(x);
      filteredData.y0.push(data.y0[index]);
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
