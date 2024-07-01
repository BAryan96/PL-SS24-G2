$(document).ready(function() {
    var baseLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }
    );

    var map = new L.Map('map', {
        center: new L.LatLng(37.5, -117),
        zoom: 6, 
        layers: [baseLayer]
    });

    var markers = L.layerGroup();


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
        var markerTypes = $('input[name="markerType"]:checked').map(function() {
            return $(this).val();
        }).get();
        var table = $('#tableSelect').val();
        var column = $('#columnSelect').val();
        var aggregation = $('#aggregationSelect').val();

  
        markers.clearLayers();
        map.removeLayer(markers);
        markers = L.layerGroup();


        function loadMarkers(markerType, color, callback) {
            var tables = [];
            var columns = [];
            var aggregations = [];
            var filters = [];

            if (markerType === "stores") {
                tables = ["stores", "stores", "stores"];
                columns = ["storeID", "longitude", "latitude"];
            } else if (markerType === "customers") {
                tables = ["customers", "customers", "customers"];
                columns = ["customerID", "longitude", "latitude"];
            }

            if (table && column && aggregation) {
                tables.push(table);
                columns.push(column);
                aggregations = ["", "X", "X", aggregation];
            } else {
                tables.push("");
                columns.push("");
                aggregations = ["", "X", "X", ""];
            }

            var requestData = {
                tables: tables.filter(value => value !== ""),
                columns: columns.filter(value => value !== ""),
                chartType: 'dynamicMarkers',
                aggregations: aggregations.filter(value => value !== ""),
                filters: filters
            };
            requestData.aggregations.unshift("");

            $.ajax({
                url: '/getdata',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(requestData),
                success: function(responseData) {
                    if (!responseData.hasOwnProperty('x') || !responseData.hasOwnProperty('y0') || !responseData.hasOwnProperty('y1') || (aggregation && !responseData.hasOwnProperty('y2'))) {
                        console.error('Data does not have the required properties:', responseData);
                        return;
                    }

                    var data = [];
                    for (var i = 0; i < responseData.x.length; i++) {
                        var point = {
                            id: responseData.x[i],
                            longitude: parseFloat(responseData.y0[i]),
                            latitude: parseFloat(responseData.y1[i]),
                        };
                        if (aggregation) {
                            point.Aggregation = parseFloat(responseData.y2[i]);
                        }
                        data.push(point);
                    }

                    var maxAggregation = aggregation ? Math.max(...data.map(point => point.Aggregation)) : 1;

                    data.forEach(function(point) {
                        var scale = aggregation ? point.Aggregation / maxAggregation : 1;
                        var markerOptions = {
                            radius: 3 + scale * 17,
                            fillColor: color,
                            color: "#000",
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.6
                        };

                        var marker = L.circleMarker([point.latitude, point.longitude], markerOptions);
                        var popupContent = `<b>ID:</b> ${point.id}<br><b>Longitude:</b> ${point.longitude}<br><b>Latitude:</b> ${point.latitude}`;
                        if (aggregation) {
                            popupContent += `<br><b>Aggregation:</b> ${point.Aggregation}`;
                        }
                        marker.bindPopup(popupContent);
                        markers.addLayer(marker);
                    });

                    if (callback) {
                        callback();
                    }
                },
                error: function(error) {
                    console.log('Error:', error);
                }
            });
        }

        
        function loadSequentially(markerTypes) {
            if (markerTypes.length === 0) {
                map.addLayer(markers);
                return;
            }

            var markerType = markerTypes.shift();
            var color = markerType === "stores" ? "blue" : "pink";
            loadMarkers(markerType, color, function() {
                loadSequentially(markerTypes);
            });
        }

        loadSequentially(markerTypes.slice());
    });
});