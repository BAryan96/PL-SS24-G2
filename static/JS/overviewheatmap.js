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
      checkbox.name = "marker";
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

    const mapContainer = document.createElement("div");
    mapContainer.className = "map-container";

    const mapDiv = document.createElement("div");
    mapDiv.id = `map${chartCount}`;
    mapDiv.className = "map";

    mapContainer.appendChild(mapDiv);

    newChartContainer.appendChild(selectContainer);
    newChartContainer.appendChild(mapContainer);

    document.getElementById("charts-container").appendChild(newChartContainer);

    const map = L.map(mapDiv).setView([37.5, -117], 6);
    const baseLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }
    ).addTo(map);

    const cfg = {
      radius: 0.5,
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

    const circleMarkerOptions = {
      radius: 3,
      fillColor: "#ff7800",
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.6,
    };

    function createLegend(legendElement, gradient) {
      for (var key in gradient) {
        var color = gradient[key];
        var div = document.createElement("div");
        div.innerHTML =
          '<span style="background-color:' + color + ';"></span>' + key;
        legendElement.appendChild(div);
      }
    }

    const legendControl = L.control({ position: "bottomright" });

    legendControl.onAdd = function (map) {
      var div = L.DomUtil.create("div", "legend");
      var gradient = cfg.gradient;
      createLegend(div, gradient);
      return div;
    };

    legendControl.addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 500);

    let markers = L.layerGroup().addTo(map);

    submitButton.addEventListener("click", (event) => {
      event.preventDefault();

      const markerTypes = Array.from(
        markerTypeContainer.querySelectorAll('input[name="marker"]:checked')
      ).map((checkbox) => checkbox.value);
      const table = tableSelect.value;
      const column = columnSelect.value;
      const aggregation = aggregationSelect.value;

      console.log("Selected Table:", table);
      console.log("Selected Column:", column);
      console.log("Selected Aggregation:", aggregation);

      markers.clearLayers();
      map.removeLayer(heatmapLayer);

      if (markerTypes.length && !table && !column && !aggregation) {
        const markerType = markerTypes[0];
        const tables =
          markerType === "stores"
            ? ["stores", "stores", "stores"]
            : ["customers", "customers", "customers"];
        const columns =
          markerType === "stores"
            ? ["storeID", "longitude", "latitude"]
            : ["customerID", "longitude", "latitude"];

        const requestData = {
          tables: tables,
          columns: columns,
          chartType: "markers",
          aggregations: ["", "", ""],
          filters: [],
        };

        $.ajax({
          url: "/getdata",
          method: "POST",
          contentType: "application/json",
          data: JSON.stringify(requestData),
          success: function (responseData) {
            console.log("Response Data:", responseData);
            if (
              !responseData.hasOwnProperty("x") ||
              !responseData.hasOwnProperty("y0") ||
              !responseData.hasOwnProperty("y1")
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
              });
            }

            showMarkersOnly(data);
          },
          error: function (error) {
            console.log("Error:", error);
          },
        });
      } else if (markerTypes.length && table && column && aggregation) {
        const markerType = markerTypes[0];
        const tables =
          markerType === "stores"
            ? ["stores", "stores", "stores"]
            : ["customers", "customers", "customers"];
        const columns =
          markerType === "stores"
            ? ["storeID", "longitude", "latitude"]
            : ["customerID", "longitude", "latitude"];
        tables.push(table);
        columns.push(column);

        const requestData = {
          tables: tables,
          columns: columns,
          chartType: "heatmap",
          aggregations: ["", "X", "X", aggregation],
          filters: [],
        };

        $.ajax({
          url: "/getdata",
          method: "POST",
          contentType: "application/json",
          data: JSON.stringify(requestData),
          success: function (responseData) {
            console.log("Response Data:", responseData);
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
          },
          error: function (error) {
            console.log("Error:", error);
          },
        });
      } else {
        alert("Please select all required fields.");
      }
    });

    function showMarkersOnly(data) {
      const bounds = [];

      data.forEach((point) => {
        const marker = L.circleMarker(
          [point.latitude, point.longitude],
          circleMarkerOptions
        );
        marker.bindPopup(
          `<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}`
        );
        map.addLayer(marker);
        bounds.push([point.latitude, point.longitude]);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds);
      }

      if (map.hasLayer(heatmapLayer)) {
        map.removeLayer(heatmapLayer);
      }
    }

    chartCount++;
    updateChartContainerWidth();
  }

  document
    .getElementById("add-chart-button")
    .addEventListener("click", addChartContainer);

  addChartContainer();

  function updateChartContainerWidth() {
    const chartContainers = document.querySelectorAll(".chart-container");
    if (chartContainers.length === 1) {
      chartContainers[0].classList.add("full-width");
    } else {
      chartContainers.forEach((container, index) => {
        container.classList.remove("full-width");
        container.style.width = "48%";
        if (index % 2 !== 0) {
          container.style.marginRight = "0";
        } else {
          container.style.marginRight = "2%";
        }
      });
    }
  }

  window.addEventListener("resize", updateChartContainerWidth);
});