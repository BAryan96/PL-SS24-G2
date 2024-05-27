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

    fetch('/get_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log("Fetched data:", result);  
        document.getElementById('loading').style.display = 'none';
        const chartDom = document.getElementById('chart');
        const myChart = echarts.init(chartDom);

        if (result.error) {
            console.error("Error from server:", result.error);  
            return;
        }

        const selectedFields = Object.entries(data)
            .filter(([key, value]) => value !== 'None')
            .map(([key, value]) => value);

        const dates = result.map(item => item.date);
        const seriesData = selectedFields.map(field => ({
            name: field,
            type: 'line',
            stack: 'Total',
            areaStyle: {},
            emphasis: {
                focus: 'series'
            },
            data: result.map(item => item.value)
        }));

        console.log("Series data:", seriesData);  

        const option = {
            title: {
                text: 'Large Area Chart'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    label: {
                        backgroundColor: '#6a7985'
                    }
                }
            },
            legend: {
                data: selectedFields
            },
            toolbox: {
                feature: {
                    saveAsImage: {}
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '10%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: dates
            },
            yAxis: {
                type: 'value'
            },
            dataZoom: [
                {
                    type: 'inside',
                    start: 0,
                    end: 10
                },
                {
                    start: 0,
                    end: 10,
                    bottom: '10%' 
                }
            ],
            series: seriesData
        };

        option && myChart.setOption(option);
    })
    .catch(error => {
        document.getElementById('loading').style.display = 'none';
        console.error('Error loading data:', error);
    });
});