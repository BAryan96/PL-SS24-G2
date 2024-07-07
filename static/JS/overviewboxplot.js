let chartCount = 0;
const maxCharts = 6;

async function fetchTables() {
  const response = await fetch("/tables");
  const data = await response.json();
  return data.tables;
}

async function fetchColumns(table) {
  const response = await fetch("/columns", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `table=${encodeURIComponent(table)}`,
  });
  const data = await response.json();
  return data.columns;
}

async function createSelectOptions(selectElement, options) {
  selectElement.innerHTML = '<option value="none">None</option>';
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.text = option;
    selectElement.appendChild(opt);
  });
}

function resizeCharts() {
  const chartContainers = document.querySelectorAll(".echarts-chart");
  chartContainers.forEach((container) => {
    const chartInstance = echarts.getInstanceByDom(container);
    if (chartInstance) {
      chartInstance.resize();
    }
  });
}

function updateChartContainerWidth() {
  const chartContainers = document.querySelectorAll(".chart-container");
  if (chartContainers.length > 1) {
    chartContainers.forEach((container) => {
      container.classList.add("half-width");
    });
  } else {
    chartContainers.forEach((container) => {
      container.classList.remove("half-width");
    });
  }
  resizeCharts();
}

async function addChartContainer() {
  if (chartCount >= maxCharts) {
    alert("Maximum number of charts reached.");
    return;
  }

  const tables = await fetchTables();

  const newChartContainer = document.createElement("div");
  newChartContainer.className = "chart-container";
  newChartContainer.style.position = "relative";

  const closeButton = document.createElement("button");
  closeButton.textContent = "X";
  closeButton.style.position = "absolute";
  closeButton.style.top = "5px";
  closeButton.style.right = "5px";
  closeButton.style.background = "grey";
  closeButton.style.color = "white";
  closeButton.style.border = "none";
  closeButton.style.borderRadius = "50%";
  closeButton.style.width = "20px";
  closeButton.style.height = "20px";
  closeButton.style.display = "flex";
  closeButton.style.alignItems = "center";
  closeButton.style.justifyContent = "center";
  closeButton.style.padding = "0";
  closeButton.style.cursor = "pointer";
  closeButton.addEventListener("click", () => {
    newChartContainer.remove();
    chartCount--;
    updateChartContainerWidth();
  });
  newChartContainer.appendChild(closeButton);

  const selectContainer = document.createElement("div");
  selectContainer.className = "select-container";

  const createLabeledSelect = (labelText) => {
    const label = document.createElement("label");
    label.textContent = labelText;
    const select = document.createElement("select");
    selectContainer.appendChild(label);
    selectContainer.appendChild(select);
    return select;
  };

  const tableSelectX = createLabeledSelect("Table for X-Axis");
  const columnSelectX = createLabeledSelect("Column for X-Axis");
  const tableSelectY = createLabeledSelect("Table for Y-Axis");
  const columnSelectY = createLabeledSelect("Column for Y-Axis");

  const dateGranularityLabelX = document.createElement("label");
  dateGranularityLabelX.textContent = "Date Granularity for X-Axis";
  dateGranularityLabelX.style.display = "none";
  selectContainer.appendChild(dateGranularityLabelX);

  const dateGranularitySelectX = document.createElement("select");
  dateGranularitySelectX.style.display = "none";
  selectContainer.appendChild(dateGranularitySelectX);

  await createSelectOptions(tableSelectX, tables);
  await createSelectOptions(tableSelectY, tables);

  const dateGranularityOptions = ["Days", "Months", "Years"];

  tableSelectX.addEventListener("change", async () => {
    if (tableSelectX.value !== "none") {
      const columns = await fetchColumns(tableSelectX.value);
      await createSelectOptions(columnSelectX, columns);
    } else {
      columnSelectX.innerHTML = '<option value="none">None</option>';
    }
  });

  tableSelectY.addEventListener("change", async () => {
    if (tableSelectY.value !== "none") {
      const columns = await fetchColumns(tableSelectY.value);
      await createSelectOptions(columnSelectY, columns);
    } else {
      columnSelectY.innerHTML = '<option value="none">None</option>';
    }
  });

  columnSelectX.addEventListener("change", () => {
    if (["orderDate", "Launch"].includes(columnSelectX.value)) {
      dateGranularityLabelX.style.display = "block";
      dateGranularitySelectX.style.display = "block";
      createSelectOptions(dateGranularitySelectX, dateGranularityOptions);

      selectContainer.insertBefore(
        dateGranularityLabelX,
        columnSelectX.nextSibling
      );
      selectContainer.insertBefore(
        dateGranularitySelectX,
        dateGranularityLabelX.nextSibling
      );
    } else {
      dateGranularityLabelX.style.display = "none";
      dateGranularitySelectX.style.display = "none";
    }
  });

  const submitButton = document.createElement("button");
  submitButton.className = "submit-button";
  submitButton.textContent = "Submit";
  selectContainer.appendChild(submitButton);

  const chartDiv = document.createElement("div");
  chartDiv.className = "echarts-chart";

  newChartContainer.appendChild(selectContainer);
  newChartContainer.appendChild(chartDiv);

  submitButton.addEventListener("click", async (event) => {
    event.preventDefault();

    const xTable = tableSelectX.value;
    let xColumn = columnSelectX.value;
    const yTable = tableSelectY.value;
    const yColumn = columnSelectY.value;

    if (
      xTable !== "none" &&
      xColumn !== "none" &&
      yTable !== "none" &&
      yColumn !== "none"
    ) {
      if (
        ["orderDate", "Launch"].includes(xColumn) &&
        dateGranularitySelectX.value !== "none"
      ) {
        const granularity = dateGranularitySelectX.value;
        if (granularity === "Days") {
          xColumn += "-DD";
        } else if (granularity === "Months") {
          xColumn += "-MM";
        } else if (granularity === "Years") {
          xColumn += "-YYYY";
        }
      }

      const requestData = {
        tables: [xTable, yTable],
        columns: [xColumn, yColumn],
        chartType: "boxplot",
        aggregations: ["", ""],
        filters: [],
      };

      try {
        const response = await fetch("/getdata", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const responseData = await response.json();
        const dataX = responseData.x;
        const dataY = responseData.y0.map((value) => parseFloat(value));

        const groupedData = {};

        dataX.forEach((key, index) => {
          if (!groupedData[key]) {
            groupedData[key] = [];
          }
          groupedData[key].push(dataY[index]);
        });

        function getPercentile(data, percentile) {
          data.sort((a, b) => a - b);
          const index = (percentile / 100) * (data.length - 1);
          const lower = Math.floor(index);
          const upper = lower + 1;
          const weight = index % 1;

          if (upper >= data.length) return data[lower];
          return data[lower] * (1 - weight) + data[upper] * weight;
        }

        function getBoxValues(data) {
          var boxValues = {};
          boxValues.low = Math.min.apply(Math, data);
          boxValues.q1 = getPercentile(data, 25);
          boxValues.median = getPercentile(data, 50);
          boxValues.q3 = getPercentile(data, 75);
          boxValues.high = Math.max.apply(Math, data);
          return boxValues;
        }

        const seriesData = Object.keys(groupedData).map((key) => {
          const values = groupedData[key];
          const boxValues = getBoxValues(values);

          const iqr = boxValues.q3 - boxValues.q1;
          const lowerWhisker = Math.max(
            boxValues.low,
            boxValues.q1 - 1.5 * iqr
          );
          const upperWhisker = Math.min(
            boxValues.high,
            boxValues.q3 + 1.5 * iqr
          );

          return [
            lowerWhisker,
            boxValues.q1,
            boxValues.median,
            boxValues.q3,
            upperWhisker,
          ];
        });

        const outliers = Object.keys(groupedData).reduce((result, key) => {
          const values = groupedData[key];
          const boxValues = getBoxValues(values);

          const iqr = boxValues.q3 - boxValues.q1;
          const lowerWhisker = Math.max(
            boxValues.low,
            boxValues.q1 - 1.5 * iqr
          );
          const upperWhisker = Math.min(
            boxValues.high,
            boxValues.q3 + 1.5 * iqr
          );

          values.forEach((value, index) => {
            if (value < lowerWhisker || value > upperWhisker) {
              result.push([key, value]);
            }
          });

          return result;
        }, []);

        const option = {
          tooltip: {
            trigger: "item",
            axisPointer: {
              type: "shadow",
            },
          },
          grid: {
            left: "10%",
            right: "10%",
            bottom: "15%",
          },
          toolbox: {
            feature: {
              dataZoom: {
                yAxisIndex: "none",
              },
              restore: {},
              saveAsImage: {},
            },
          },
          xAxis: {
            type: "category",
            data: Object.keys(groupedData),
            boundaryGap: true,
            nameGap: 30,
            splitArea: {
              show: false,
            },
            splitLine: {
              show: false,
            },
          },
          yAxis: {
            type: "value",
            name: "Value",
            splitArea: {
              show: true,
            },
            axisLabel: {
              formatter: function (value) {
                return value < 1e4 ? value : value.toExponential(2);
              },
            },
            max: function (value) {
              return value.max * 1.1;
            },
            axisLine: {
              show: true,
            },
            axisTick: {
              show: true,
            },
            axisLabel: {
              showMaxLabel: false,
            },
          },
          dataZoom: [
            {
              type: "slider",
              show: true,
              xAxisIndex: [0],
              start: 0,
              end: 100,
            },
            {
              type: "inside",
              xAxisIndex: [0],
              start: 0,
              end: 100,
            },
          ],
          series: [
            {
              name: "boxplot",
              type: "boxplot",
              data: seriesData,
            },
            {
              name: "outlier",
              type: "scatter",
              data: outliers.map((outlier) => [
                Object.keys(groupedData).indexOf(outlier[0]),
                outlier[1],
              ]),
              itemStyle: {
                color: "red",
              },
            },
          ],
        };

        const chartInstance = echarts.init(chartDiv);
        chartInstance.setOption(option);
      } catch (error) {
        console.error("Error fetching or processing data:", error);
      }
    } else {
      console.error(
        "Missing input values for xTable, xColumn, yTable, or yColumn"
      );
    }
  });

  document.getElementById("charts-container").appendChild(newChartContainer);
  chartCount++;
  updateChartContainerWidth();
  resizeCharts();
}

document
  .getElementById("add-chart-button")
  .addEventListener("click", addChartContainer);

addChartContainer();
