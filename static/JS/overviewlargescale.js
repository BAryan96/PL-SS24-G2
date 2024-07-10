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

function createContextMenu() {
  const contextMenu = document.createElement("div");
  contextMenu.style.position = "absolute";
  contextMenu.style.display = "none";
  contextMenu.style.backgroundColor = "#fff";
  contextMenu.style.border = "1px solid #ccc";
  contextMenu.style.padding = "10px";
  contextMenu.style.zIndex = "1000";

  const colorPicker = document.createElement("input");
  colorPicker.type = "color";

  contextMenu.appendChild(colorPicker);
  document.body.appendChild(contextMenu);

  return { contextMenu, colorPicker };
}

function setupContextMenu(chartInstance, series) {
  const { contextMenu, colorPicker } = createContextMenu();

  chartInstance.getZr().on("contextmenu", function (params) {
    const pointInPixel = [params.offsetX, params.offsetY];
    if (chartInstance.containPixel("grid", pointInPixel)) {
      params.event.preventDefault();

      const xIndex = chartInstance.convertFromPixel({ seriesIndex: 0 }, [
        params.offsetX,
      ])[0];
      const dataIndex = Math.round(xIndex);

      const dataItem = series[0].data[dataIndex];

      contextMenu.style.left = `${params.event.pageX}px`;
      contextMenu.style.top = `${params.event.pageY}px`;
      contextMenu.style.display = "block";

      colorPicker.onchange = function () {
        if (dataItem) {
          dataItem.itemStyle = { color: colorPicker.value };
          series[0].data[dataIndex] = dataItem;
          chartInstance.setOption({ series });
          contextMenu.style.display = "none";
        }
      };

      const closeContextMenu = function (event) {
        if (!contextMenu.contains(event.target)) {
          contextMenu.style.display = "none";
          document.removeEventListener("click", closeContextMenu);
        }
      };

      setTimeout(() => {
        document.addEventListener("click", closeContextMenu);
      }, 0);
    }
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
  const aggregationSelect = createLabeledSelect("Aggregation");

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

  const aggregations = [
    "Sum",
    "Max",
    "Min",
    "Count",
    "Distinct Count",
    "Average",
    "Variance",
    "Standard Deviation",
  ];
  await createSelectOptions(aggregationSelect, aggregations);

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
    const aggregation = aggregationSelect.value;

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
        chartType: "line",
        aggregations: ["", aggregation],
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
        const dataY = responseData.y0;

        const uniqueXValues = [...new Set(dataX)];
        const uniqueYValues = [...new Set(dataY)];

        const filterContent = document.createElement("div");
        filterContent.className = "filter-content";
        filterContent.style.display = "none";
        filterContent.style.position = "absolute";
        filterContent.style.backgroundColor = "#f9f9f9";
        filterContent.style.minWidth = "160px";
        filterContent.style.boxShadow = "0px 8px 16px 0px rgba(0,0,0,0.2)";
        filterContent.style.zIndex = "1";
        filterContent.style.right = "0";
        filterContent.style.maxHeight = "400px";
        filterContent.style.overflowY = "auto";
        filterContent.style.padding = "10px";
        filterContent.innerHTML = `
    <input type="text" class="filter-search" placeholder="Search..." style="width: 100%; padding: 8px; margin-bottom: 10px;">
    <div>
      <strong>X-Axis Values</strong>
      <div class="filter-options" style="display: flex; flex-wrap: wrap;">
        ${uniqueXValues
          .map(
            (value) => `
          <label style="flex: 1 0 30%; display: flex; align-items: center;">
            <input type="checkbox" value="${value}" class="filter-checkbox-x">
            ${value}
          </label>
        `
          )
          .join("")}
      </div>
    </div>
    <div>
      <strong>Y-Axis Values</strong>
      <div class="filter-options" style="display: flex; flex-wrap: wrap;">
        ${uniqueYValues
          .map(
            (value) => `
          <label style="flex: 1 0 30%; display: flex; align-items: center;">
            <input type="checkbox" value="${value}" class="filter-checkbox-y">
            ${value}
          </label>
        `
          )
          .join("")}
      </div>
    </div>
  `;

        const closeButton = document.createElement("button");
        closeButton.textContent = "Close";
        closeButton.style.display = "block";
        closeButton.style.margin = "10px auto";
        closeButton.addEventListener("click", () => {
          filterContent.style.display = "none";
        });
        filterContent.appendChild(closeButton);

        newChartContainer.appendChild(filterContent);

        const searchInput = filterContent.querySelector(".filter-search");
        searchInput.addEventListener("input", () => {
          const filter = searchInput.value.toLowerCase();
          const options = filterContent.querySelectorAll(
            ".filter-options label"
          );
          options.forEach((option) => {
            const text = option.textContent.toLowerCase();
            if (text.includes(filter)) {
              option.style.display = "";
            } else {
              option.style.display = "none";
            }
          });
        });

        filterContent.addEventListener("change", () => {
          const checkedXValues = Array.from(
            filterContent.querySelectorAll(".filter-checkbox-x:checked")
          ).map((checkbox) => checkbox.value);

          const checkedYValues = Array.from(
            filterContent.querySelectorAll(".filter-checkbox-y:checked")
          ).map((checkbox) => checkbox.value);

          const filteredDataX = [];
          const filteredDataY = [];

          dataX.forEach((value, index) => {
            if (
              (checkedXValues.length === 0 || checkedXValues.includes(value)) &&
              (checkedYValues.length === 0 ||
                checkedYValues.includes(dataY[index].toString()))
            ) {
              filteredDataX.push(value);
              filteredDataY.push(dataY[index]);
            }
          });

          series[0].data = filteredDataY;
          option.xAxis.data = filteredDataX;
          chartInstance.setOption(option);
        });

        const series = [
          {
            name: yColumn,
            type: "line",
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: "rgb(255, 158, 68)",
                },
                {
                  offset: 1,
                  color: "rgb(255, 70, 131)",
                },
              ]),
            },
            emphasis: {
              focus: "series",
            },
            itemStyle: {
              color: "rgb(255, 70, 131)",
            },
            data: dataY.map((value) => ({ value })),
          },
        ];

        const option = {
          title: {
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
          legend: {
            data: [yColumn],
            top: "5%",
          },
          xAxis: {
            type: "category",
            boundaryGap: false,
            data: dataX,
          },
          yAxis: {
            type: "value",
          },
          series: series,
          toolbox: {
            feature: {
              myFilter: {
                show: true,
                title: "Filter",
                icon: "path://M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13h-3v3h-4v-3H7v-4h3V8h4v3h3v4z",
                onclick: function () {
                  filterContent.style.display =
                    filterContent.style.display === "none" ? "block" : "none";
                },
              },
              saveAsImage: {},
              restore: {},
              dataView: { readOnly: true },
              magicType: { type: ["line", "bar", "stack"] },
            },
          },
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

        const chartInstance = echarts.init(chartDiv);
        chartInstance.setOption(option);

        setupContextMenu(chartInstance, series);
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
