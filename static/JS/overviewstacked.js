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
    const chartContainers = document.querySelectorAll('.echarts-chart');
    chartContainers.forEach(container => {
        const chartInstance = echarts.getInstanceByDom(container);
        if (chartInstance) {
            chartInstance.resize();
        }
    });
}

function updateChartContainerWidth() {
    const chartContainers = document.querySelectorAll('.chart-container');
    if (chartContainers.length > 1) {
        chartContainers.forEach(container => {
            container.classList.add('half-width');
        });
    } else {
        chartContainers.forEach(container => {
            container.classList.remove('half-width');
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

    await createSelectOptions(tableSelectX, tables);
    await createSelectOptions(tableSelectY, tables);

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

    const addLinesButton = document.createElement("button");
    addLinesButton.textContent = "Add Lines";
    addLinesButton.className = "submit-button";
    selectContainer.appendChild(addLinesButton);

    const chartDiv = document.createElement("div");
    chartDiv.className = "echarts-chart";
    newChartContainer.appendChild(selectContainer);
    newChartContainer.appendChild(chartDiv);

    let chartInstance;
    let requestData = {
        tables: [],
        columns: [],
        chartType: "stacked_area",
        aggregations: [],
        filters: []
    };

    submitButton.addEventListener("click", async (event) => {
        event.preventDefault();

        const xTable = tableSelectX.value;
        const xColumn = columnSelectX.value;
        const yTable = tableSelectY.value;
        const yColumn = columnSelectY.value;
        const aggregation = aggregationSelect.value;

        if (xTable !== "none" && xColumn !== "none" && yTable !== "none" && yColumn !== "none") {
            requestData.tables = [xTable, yTable];
            requestData.columns = [xColumn, yColumn];
            requestData.aggregations = ["", aggregation];

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
                const dataY = responseData.y0.map(value => parseFloat(value));

                const option = {
                    tooltip: {
                        trigger: "axis",
                        axisPointer: {
                            type: "cross",
                            label: { backgroundColor: "#6a7985" },
                        },
                        formatter: function (params) {
                            let tooltipText = params[0].name;
                            params.forEach((item) => {
                                let seriesIndex = item.seriesIndex; // adjust index for correct Y-Axis column and aggregation
                                let column = requestData.columns[seriesIndex + 1]; // adjust index for correct Y-Axis column
                                let aggregation = requestData.aggregations[seriesIndex + 1]; // adjust index for correct Y-Axis aggregation
                                tooltipText += `<strong>${item.value}<br/></strong> <strong>(${column} - ${aggregation}</strong> )`;
                            });
                            return tooltipText;
                        }
                    },
                    legend: { data: ["Series 1"] },
                    toolbox: {
                        feature: {
                            saveAsImage: {},
                            // restore: {},
                            dataView: { readOnly: true },
                            magicType: { type: ["line", "bar"] },
                        }
                    },
                    xAxis: {
                        type: "category",
                        boundaryGap: false,
                        data: dataX,
                    },
                    yAxis: {
                        type: "value",
                    },
                    series: [{
                        name: `(${requestData.columns[1]} - ${requestData.aggregations[1]})`,
                        type: "line",
                        stack: null,
                        areaStyle: {},
                        emphasis: { focus: "series" },
                        data: dataY,
                        tooltip: {
                        }
                    }],
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

                chartInstance = echarts.init(chartDiv);
                chartInstance.setOption(option);

                addLinesButton.addEventListener("click", () => {
                    openPopup(chartInstance, requestData);
                });

            } catch (error) {
                console.error("Error fetching or processing data:", error);
            }
        } else {
            console.error("Missing input values for xTable, xColumn, yTable, or yColumn");
        }
    });

    document.getElementById("charts-container").appendChild(newChartContainer);
    chartCount++;
    updateChartContainerWidth();
    resizeCharts();
}

function openPopup(chartInstance, requestData) {
    const popup = document.createElement("div");
    popup.className = "popup open";

    const closeButton = document.createElement("button");
    closeButton.className = "close-button";
    closeButton.textContent = "Close";
    popup.appendChild(closeButton);

    const selectContainer = document.createElement("div");
    selectContainer.className = "select-container";
    popup.appendChild(selectContainer);

    const createLabeledSelect = (labelText, id) => {
        const label = document.createElement("label");
        label.textContent = labelText;
        const select = document.createElement("select");
        select.id = id;
        selectContainer.appendChild(label);
        selectContainer.appendChild(select);
        return select;
    };

    const tableSelectY2 = createLabeledSelect("Table for Y-Axis 2", "tableSelectY2");
    const columnSelectY2 = createLabeledSelect("Column for Y-Axis 2", "columnSelectY2");
    const aggregationSelect2 = createLabeledSelect("Aggregation 2", "aggregationSelect2");
    const tableSelectY3 = createLabeledSelect("Table for Y-Axis 3", "tableSelectY3");
    const columnSelectY3 = createLabeledSelect("Column for Y-Axis 3", "columnSelectY3");
    const aggregationSelect3 = createLabeledSelect("Aggregation 3", "aggregationSelect3");

    const addLinesButton = document.createElement("button");
    addLinesButton.className = "submit-button";
    addLinesButton.textContent = "Add Lines";
    selectContainer.appendChild(addLinesButton);

    document.body.appendChild(popup);

    fetchTables().then(tables => {
        createSelectOptions(tableSelectY2, tables);
        createSelectOptions(tableSelectY3, tables);
    });

    tableSelectY2.addEventListener("change", async () => {
        if (tableSelectY2.value !== "none") {
            const columns = await fetchColumns(tableSelectY2.value);
            await createSelectOptions(columnSelectY2, columns);
        } else {
            columnSelectY2.innerHTML = '<option value="none">None</option>';
        }
    });

    tableSelectY3.addEventListener("change", async () => {
        if (tableSelectY3.value !== "none") {
            const columns = await fetchColumns(tableSelectY3.value);
            await createSelectOptions(columnSelectY3, columns);
        } else {
            columnSelectY3.innerHTML = '<option value="none">None</option>';
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
    createSelectOptions(aggregationSelect2, aggregations);
    createSelectOptions(aggregationSelect3, aggregations);

    addLinesButton.addEventListener("click", async () => {
        const yTable2 = tableSelectY2.value;
        const yColumn2 = columnSelectY2.value;
        const aggregation2 = aggregationSelect2.value;
        const yTable3 = tableSelectY3.value;
        const yColumn3 = columnSelectY3.value;
        const aggregation3 = aggregationSelect3.value;

        let additionalRequestData = {
            tables: [],
            columns: [],
            chartType: "stacked_area",
            aggregations: [],
            filters: []
        };

        if (yTable2 !== "none" && yColumn2 !== "none") {
            additionalRequestData.tables.push(yTable2);
            additionalRequestData.columns.push(yColumn2);
            additionalRequestData.aggregations.push(aggregation2);
        }

        if (yTable3 !== "none" && yColumn3 !== "none") {
            additionalRequestData.tables.push(yTable3);
            additionalRequestData.columns.push(yColumn3);
            additionalRequestData.aggregations.push(aggregation3);
        }

        if (additionalRequestData.tables.length > 0) {
            requestData.tables.push(...additionalRequestData.tables);
            requestData.columns.push(...additionalRequestData.columns);
            requestData.aggregations.push(...additionalRequestData.aggregations);

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
                const newSeries = [];

                if (responseData.y1) {
                    const dataY2 = responseData.y1.map(value => parseFloat(value));
                    newSeries.push({
                        name: `Series 2 (${requestData.columns[2]} - ${requestData.aggregations[2]})`,
                        type: "line",
                        stack: null,
                        areaStyle: {},
                        emphasis: { focus: "series" },
                        data: dataY2,
                        tooltip: {
                            valueFormatter: (value) => `<strong>${value}</strong> (${requestData.columns[2]} - ${requestData.aggregations[2]})`
                        }
                    });
                }

                if (responseData.y2) {
                    const dataY3 = responseData.y2.map(value => parseFloat(value));
                    newSeries.push({
                        name: `Series 3 (${requestData.columns[3]} - ${requestData.aggregations[3]})`,
                        type: "line",
                        stack: null,
                        areaStyle: {},
                        emphasis: { focus: "series" },
                        data: dataY3,
                        tooltip: {
                            valueFormatter: (value) => `<strong>${value}</strong> (${requestData.columns[3]} - ${requestData.aggregations[3]})`
                        }
                    });
                }

                const updatedOption = chartInstance.getOption();
                updatedOption.tooltip.formatter = function (params) {
                    let tooltipText = params[0].name;
                    params.forEach((item) => {
                        let seriesIndex = item.seriesIndex; // adjust index for correct Y-Axis column and aggregation
                        let column = requestData.columns[seriesIndex + 1]; // adjust index for correct Y-Axis column
                        let aggregation = requestData.aggregations[seriesIndex + 1]; // adjust index for correct Y-Axis aggregation
                        tooltipText += `<br/>${item.marker}<strong>${item.seriesName}</strong>: <strong>${item.value}</strong> (${column} - ${aggregation})`;
                    });
                    return tooltipText;
                };

                newSeries.forEach((series, index) => {
                    series.name = `Series ${index + 2} (${requestData.columns[index + 1]} - ${requestData.aggregations[index + 1]})`;
                    series.tooltip = {
                        valueFormatter: (value) => `<strong>${value}</strong> (${requestData.columns[index + 1]} - ${requestData.aggregations[index + 1]})`
                    };
                });

                updatedOption.series = updatedOption.series.concat(newSeries);
                chartInstance.setOption(updatedOption);

            } catch (error) {
                console.error("Error fetching or processing data:", error);
            }
        }
    });

    closeButton.addEventListener("click", () => {
        popup.classList.remove("open");
        popup.remove();
    });
}

document.getElementById("add-chart-button").addEventListener("click", addChartContainer);

addChartContainer();
