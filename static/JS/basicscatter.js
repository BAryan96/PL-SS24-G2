document.getElementById('dataForm').addEventListener('submit', function (event) {
    event.preventDefault();
    document.getElementById('loading').style.display = 'block';

    const formData = new FormData(event.target);
    const data = {
        xField: formData.get('xField'),
        yField: formData.get('yField')
    };

    fetch('/get_scatter_data', {
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

        const option = {
            title: {
                text: 'Basic Scatter Chart'
            },
            tooltip: {
                trigger: 'axis',
                showDelay: 0,
                axisPointer: {
                    type: 'cross',
                    lineStyle: {
                        type: 'dashed'
                    }
                }
            },
            xAxis: {
                type: 'value',
                scale: true
            },
            yAxis: {
                type: 'value',
                scale: true
            },
            series: [{
                name: 'Scatter Data',
                type: 'scatter',
                data: result.map(item => [item[data.xField], item[data.yField]])
            }]
        };

        option && myChart.setOption(option);
    })
    .catch(error => {
        document.getElementById('loading').style.display = 'none';
        console.error('Error loading data:', error);
    });
});