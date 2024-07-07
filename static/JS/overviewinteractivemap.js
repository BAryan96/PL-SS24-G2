document.addEventListener("DOMContentLoaded", () => {
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
    selectElement.innerHTML = '<option value="">None</option>';
    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option;
      opt.text = option;
      selectElement.appendChild(opt);
    });
  }

  async function addChartContainer() {
    if (chartCount >= maxCharts) {
      alert("Maximum number of charts reached.");
      return;
    }

    const tables = await fetchTables();

    const newChartContainer = document.createElement("div");
    newChartContainer.className = "chart-container";
    newChartContainer.style.display = "flex";
    newChartContainer.style.flexDirection = "row";
    newChartContainer.style.border = "1px solid #ccc";
    newChartContainer.style.marginBottom = "10px";
    newChartContainer.style.padding = "10px";
    newChartContainer.style.position = "relative";
    newChartContainer.style.borderRadius = "10px";
    newChartContainer.style.backgroundColor = "#f9f9f9";
    newChartContainer.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";

    const closeButton = document.createElement("button");
    closeButton.textContent = "X";
    closeButton.className = "close-button";
    closeButton.addEventListener("click", () => {
      newChartContainer.remove();
      chartCount--;
      updateChartContainerWidth();
    });
    newChartContainer.appendChild(closeButton);

    const selectContainer = document.createElement("div");
    selectContainer.className = "select-container";

    const markerTypeTitle = document.createElement("div");
    markerTypeTitle.innerHTML = "<b>Markers Based On:</b>";
    selectContainer.appendChild(markerTypeTitle);

    const markerTypeContainer = document.createElement("div");
    markerTypeContainer.className = "marker-type-container";

    const createLabeledCheckbox = (labelText, value) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;
      checkbox.name = "markerType";
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(labelText));
      markerTypeContainer.appendChild(label);
    };

    createLabeledCheckbox("Stores", "stores");
    createLabeledCheckbox("Customers", "customers");

    selectContainer.appendChild(markerTypeContainer);

    const createLabeledSelect = (labelText) => {
      const label = document.createElement("label");
      label.textContent = labelText;
      const select = document.createElement("select");
      selectContainer.appendChild(label);
      selectContainer.appendChild(select);
      return select;
    };

    const tableSelect = createLabeledSelect("Table");
    const columnSelect = createLabeledSelect("Column");
    const aggregationSelect = createLabeledSelect("Aggregation");

    await createSelectOptions(tableSelect, tables);

    tableSelect.addEventListener("change", async () => {
      const selectedTable = tableSelect.value;
      if (selectedTable) {
        const columns = await fetchColumns(selectedTable);
        await createSelectOptions(columnSelect, columns);
      } else {
        columnSelect.innerHTML = '<option value="">None</option>';
      }
    });

    const aggregations = [
      "Summe",
      "Max",
      "Min",
      "Anzahl",
      "Diskrete Anzahl",
      "Durchschnitt",
      "Varianz",
      "Standardabweichung",
    ];
    await createSelectOptions(aggregationSelect, aggregations);

    const submitButton = document.createElement("button");
    submitButton.className = "submit-button";
    submitButton.textContent = "Submit";
    selectContainer.appendChild(submitButton);

    const mapContainer = document.createElement("div");
    mapContainer.className = "map-container";

    const mapDiv = document.createElement("div");
    mapDiv.id = `map${chartCount}`;
    mapDiv.className = "map";

    mapContainer.appendChild(mapDiv);

    newChartContainer.appendChild(selectContainer);
    newChartContainer.appendChild(mapContainer);

    document
      .getElementById("charts-container")
      .appendChild(newChartContainer);

    const map = L.map(mapDiv).setView([37.5, -117], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 500);

    let markers = L.layerGroup().addTo(map);

    submitButton.addEventListener("click", async (event) => {
      event.preventDefault();

      const markerTypes = Array.from(
        markerTypeContainer.querySelectorAll(
          'input[name="markerType"]:checked'
        )
      ).map((checkbox) => checkbox.value);
      const table = tableSelect.value;
      const column = columnSelect.value;
      const aggregation = aggregationSelect.value;

      console.log("Selected Table:", table);
      console.log("Selected Column:", column);
      console.log("Selected Aggregation:", aggregation);

      markers.clearLayers();

      const loadMarkers = async (markerType, color) => {
        const baseTables = [markerType, markerType, markerType];
        const baseColumns = [
          markerType === "stores" ? "storeID" : "customerID",
          "longitude",
          "latitude",
        ];
        const baseAggregations = ["", "X", "X"];

        const tables = baseTables.concat(table ? [table] : []);
        const columns = baseColumns.concat(column ? [column] : []);
        const aggregations = baseAggregations.concat(
          aggregation ? [aggregation] : [""]
        );

        const requestData = {
          tables: tables.filter((value) => value !== ""),
          columns: columns.filter((value) => value !== ""),
          chartType: "dynamicMarkers",
          aggregations: aggregations,
          filters: [],
        };

        console.log("Request Data:", requestData);

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

          if (
            !responseData.hasOwnProperty("x") ||
            !responseData.hasOwnProperty("y0") ||
            !responseData.hasOwnProperty("y1") ||
            (aggregation && !responseData.hasOwnProperty("y2"))
          ) {
            console.error(
              "Data does not have the required properties:",
              responseData
            );
            return;
          }

          const data = responseData.x.map((id, i) => ({
            id,
            longitude: parseFloat(responseData.y0[i]),
            latitude: parseFloat(responseData.y1[i]),
            aggregation: aggregation
              ? parseFloat(responseData.y2[i])
              : null,
          }));

          const maxAggregation = aggregation
            ? Math.max(...data.map((point) => point.aggregation))
            : 1;

          data.forEach((point) => {
            const scale = aggregation
              ? point.aggregation / maxAggregation
              : 1;
            const markerOptions = {
              radius: 3 + scale * 17,
              fillColor: color,
              color: "#000",
              weight: 1,
              opacity: 1,
              fillOpacity: 0.6,
            };

            const marker = L.circleMarker(
              [point.latitude, point.longitude],
              markerOptions
            );
            let popupContent = `<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}`;
            if (aggregation) {
              popupContent += `<br><b>Aggregation:</b> ${point.aggregation}`;
            }
            marker.bindPopup(popupContent);
            markers.addLayer(marker);
          });
        } catch (error) {
          console.error("Error fetching or processing data:", error);
        }
      };

      const loadSequentially = async (markerTypes) => {
        if (markerTypes.length === 0) {
          return;
        }

        const markerType = markerTypes.shift();
        const color = markerType === "stores" ? "blue" : "pink";
        await loadMarkers(markerType, color);
        await loadSequentially(markerTypes);
      };

      await loadSequentially(markerTypes.slice());
    });

    chartCount++;
    updateChartContainerWidth();
  }

  document
    .getElementById("add-chart-button")
    .addEventListener("click", addChartContainer);

  addChartContainer();

  function updateChartContainerWidth() {
    const chartContainers = document.querySelectorAll(".chart-container");
    chartContainers.forEach((container, index) => {
      container.style.width = "48%";
      if (index % 2 !== 0) {
        container.style.marginRight = "0";
      } else {
        container.style.marginRight = "2%";
      }
    });
  }
});