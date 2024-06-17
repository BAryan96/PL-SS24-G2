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

        const seriesData = selectedFields.map(field => ({
            name: field,
            value: result.reduce((acc, item) => acc + item[field], 0) // Summing up the values for the selected field
        }));

        const option = {
            title: {
                text: 'Donut Chart',
                left: 'center'
            },
            tooltip: {
                trigger: 'item'
            },
            legend: {
                orient: 'vertical',
                left: 'left',
                data: selectedFields
            },
            series: [
                {
                    name: 'Data',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    avoidLabelOverlap: false,
                    label: {
                        show: false,
                        position: 'center'
                    },
                    emphasis: {
                        label: {
                            show: true,
                            fontSize: '40',
                            fontWeight: 'bold'
                        }
                    },
                    labelLine: {
                        show: false
                    },
                    data: seriesData
                }
            ]
        };

        option && myChart.setOption(option);
    })
    .catch(error => {
        document.getElementById('loading').style.display = 'none';
        console.error('Error loading data:', error);
    });
});