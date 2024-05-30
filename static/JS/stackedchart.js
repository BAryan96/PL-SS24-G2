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
    .then(response => {
        const reader = response.body.getReader();
        const contentLength = response.headers.get('Content-Length');
        let receivedLength = 0;

        return new Response(
            new ReadableStream({
                start(controller) {
                    function push() {
                        reader.read().then(({ done, value }) => {
                            if (done) {
                                controller.close();
                                return;
                            }
                            receivedLength += value.length;
                            const progress = Math.floor((receivedLength / contentLength) * 100);
                            document.getElementById('progress').textContent = `Loading: ${progress}%`;
                            controller.enqueue(value);
                            push();
                        });
                    }
                    push();
                }
            })
        );
    })
    .then(response => response.json())
    .then(result => {
        document.getElementById('loading').style.display = 'none';
        const chartDom = document.getElementById('chart');
        const myChart = echarts.init(chartDom);

        const selectedFields = Object.entries(data)
            .filter(([key, value]) => value !== 'None')
            .map(([key, value]) => value);

        const option = {
            title: {
                text: 'Stacked Area Chart'
            },
            tooltip: {
                trigger: 'axis'
            },
            legend: {
                data: selectedFields
            },
            toolbox: {
                feature: {
                    saveAsImage: {}
                }
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: result.map((_, index) => index)
            },
            yAxis: {
                type: 'value'
            },
            series: selectedFields.map(field => ({
                name: field,
                type: 'line',
                stack: 'Total',
                areaStyle: {},
                data: result.map(row => row[selectedFields.indexOf(field)])
            }))
        };
        option && myChart.setOption(option);
    })
    .catch(error => {
        document.getElementById('loading').style.display = 'none';
        console.error('Error loading data:', error);
    });
});