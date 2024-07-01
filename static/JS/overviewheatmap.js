$(document).ready(function () {
    var baseLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }
    );

    var cfg = {
        "radius": 0.2,
        "maxOpacity": .8,
        "scaleRadius": true,
        "useLocalExtrema": true,
        latField: 'lat',
        lngField: 'lng',
        valueField: 'count',
        gradient: {
            0.1: 'blue',
            0.2: 'lime',
            0.4: 'yellow',
            0.6: 'orange',
            0.8: 'red',
            1.0: 'purple'
        }
    };

    var heatmapLayer = new HeatmapOverlay(cfg);

    var map = new L.Map('map', {
        center: new L.LatLng(37.5, -117),
        zoom: 6,
        layers: [baseLayer]
    });

    var markers = L.markerClusterGroup();
    var circleMarkerOptions = {
        radius: 3,
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.6
    };


    function createLegend(legendElement, gradient) {
        for (var key in gradient) {
            var color = gradient[key];
            var div = document.createElement('div');
            div.innerHTML = '<span style="background-color:' + color + ';"></span>' + key;
            legendElement.appendChild(div);
        }
    }

    
    var legendControl = L.control({ position: 'bottomright' });

    legendControl.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'legend');
        var gradient = cfg.gradient;
        createLegend(div, gradient);
        return div;
    };

    legendControl.addTo(map);

    
    $.get("/tables", function(data) {
        data.tables.forEach(table => {
            $('#tableSelect').append(`<option value="${table}">${table}</option>`);
        });
    });

    
    $('#tableSelect').change(function() {
        var table = $(this).val();
        if (table) {
            $.post("/columns", { table: table }, function(data) {
                $('#columnSelect').empty().append('<option value="">None</option>');
                data.columns.forEach(column => {
                    $('#columnSelect').append(`<option value="${column}">${column}</option>`);
                });
            });
        }
    });

    $('#dataForm').submit(function(event) {
        event.preventDefault();
        var markerType = $('#markerTypeSelect').val();
        var table = $('#tableSelect').val();
        var column = $('#columnSelect').val();
        var aggregation = $('#aggregationSelect').val();

        if (markerType && !table && !column && !aggregation) {
            
            var tables = (markerType === "stores") ? ["stores", "stores", "stores"] : ["customers", "customers", "customers"];
            var columns = (markerType === "stores") ? ["storeID", "longitude", "latitude"] : ["customerID", "longitude", "latitude"];

            var requestData = {
                tables: tables,
                columns: columns,
                chartType: 'markers',
                aggregations: ["", "", ""],
                filters: []
            };

            $.ajax({
                url: '/getdata',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(requestData),
                success: function(responseData) {
                    if (!responseData.hasOwnProperty('x') || !responseData.hasOwnProperty('y0') || !responseData.hasOwnProperty('y1')) {
                        console.error('Data does not have the required properties:', responseData);
                        return;
                    }

                    
                    var data = [];
                    for (var i = 0; i < responseData.x.length; i++) {
                        data.push({
                            id: responseData.x[i],
                            longitude: parseFloat(responseData.y0[i]),
                            latitude: parseFloat(responseData.y1[i])
                        });
                    }

                    showMarkersOnly(data);
                },
                error: function(error) {
                    console.log('Error:', error);
                }
            });
        } else if (markerType && table && column && aggregation) {
            
            var tables = (markerType === "stores") ? ["stores", "stores", "stores"] : ["customers", "customers", "customers"];
            var columns = (markerType === "stores") ? ["storeID", "longitude", "latitude"] : ["customerID", "longitude", "latitude"];
            tables.push(table);
            columns.push(column);

            var requestData = {
                tables: tables,
                columns: columns,
                chartType: 'heatmap',
                aggregations: ["", "X", "X", aggregation],
                filters: []
            };

            $.ajax({
                url: '/getdata',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(requestData),
                success: function(responseData) {
                    if (!responseData.hasOwnProperty('x') || !responseData.hasOwnProperty('y0') || !responseData.hasOwnProperty('y1') || !responseData.hasOwnProperty('y2')) {
                        console.error('Data does not have the required properties:', responseData);
                        return;
                    }

                    
                    var data = [];
                    for (var i = 0; i < responseData.x.length; i++) {
                        data.push({
                            id: responseData.x[i],
                            longitude: parseFloat(responseData.y0[i]),
                            latitude: parseFloat(responseData.y1[i]),
                            Aggregation: parseFloat(responseData.y2[i])
                        });
                    }

                    markers.clearLayers();
                    var bounds = [];
                    var heatmapPoints = [];

                    data.forEach(function(point) {
                        var marker = L.circleMarker([point.latitude, point.longitude], circleMarkerOptions);
                        marker.bindPopup(`<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}<br><b>Aggregation:</b> ${point.Aggregation}`);
                        markers.addLayer(marker);
                        bounds.push([point.latitude, point.longitude]);

                       
                        heatmapPoints.push({
                            lat: point.latitude,
                            lng: point.longitude,
                            count: point.Aggregation 
                        });
                    });

                    map.addLayer(markers);
                    if (bounds.length > 0) {
                        map.fitBounds(bounds); 
                    }

                    map.addLayer(heatmapLayer);
                    heatmapLayer.setData({
                        max: Math.max(...data.map(point => point.Aggregation)), 
                        data: heatmapPoints
                    });
                },
                error: function(error) {
                    console.log('Error:', error);
                }
            });
        } else {
            alert('Please select all required fields.');
        }
    });

    function showMarkersOnly(data) {
        markers.clearLayers();
        var bounds = [];

        data.forEach(function(point) {
            var marker = L.circleMarker([point.latitude, point.longitude], circleMarkerOptions);
            marker.bindPopup(`<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}`);
            markers.addLayer(marker);
            bounds.push([point.latitude, point.longitude]);
        });

        map.addLayer(markers);
        if (bounds.length > 0) {
            map.fitBounds(bounds); 
        }

        if (map.hasLayer(heatmapLayer)) {
            map.removeLayer(heatmapLayer);
        }
    }
});