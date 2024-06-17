document.getElementById('dataForm').addEventListener('submit', function (event) {
    event.preventDefault();
    document.getElementById('loading').style.display = 'block';

    const formData = new FormData(event.target);
    const data = {
        orders: formData.get('orders'),
        customers: formData.get('customers'),
        orderItems: formData.get('orderItems'),
        products: formData.get('products'),
        stores: formData.get('stores')
    };

    fetch('/get_heatmap_data', { 
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        document.getElementById('loading').style.display = 'none';

        console.log('Heatmap data received:', result);

        
        const map = L.map('chart').setView([37.550339, 104.114129], 5);

        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
        }).addTo(map);

        
        if (result && Array.isArray(result) && result.length > 0 && result[0].latitude && result[0].longitude && result[0].value) {
         
            const heatmapData = result.map(item => [item.latitude, item.longitude, item.value]); 

           
            L.heatLayer(heatmapData, {
                radius: 20,
                blur: 15,
                maxZoom: 17,
            }).addTo(map);
        } else {
            console.error('Invalid heatmap data format or no data available');
        }
    })
    .catch(error => {
        document.getElementById('loading').style.display = 'none';
        console.error('Error loading data:', error);
    });
});