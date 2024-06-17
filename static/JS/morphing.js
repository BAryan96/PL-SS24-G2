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

        // Assuming result is an array of objects with name and value properties
        const geoCoordMap = {
            'Beijing': [116.405285,39.904989],
            'Tianjin': [117.190182,39.125596],
            'Shanghai': [121.472644,31.231706],
            'Chongqing': [106.504962,29.533155],
            // Add more cities with their coordinates as needed
        };

        const data = result.map(item => ({
            name: item.name,
            value: item.value
        }));

        const convertData = function (data) {
            const res = [];
            for (let i = 0; i < data.length; i++) {
                const geoCoord = geoCoordMap[data[i].name];
                if (geoCoord) {
                    res.push({
                        name: data[i].name,
                        value: geoCoord.concat(data[i].value)
                    });
                }
            }
            return res;
        };

        const option = {
            timeline: {
                data: ['Map', 'Bar'],
                axisType: 'category',
                autoPlay: true,
                playInterval: 3000
            },
            options: [
                {
                    title: {
                        text: 'Morphing Map-Bar Chart',
                        subtext: 'From Map to Bar Chart',
                        left: 'center'
                    },
                    tooltip: {
                        trigger: 'item'
                    },
                    visualMap: {
                        min: 0,
                        max: 1000,
                        left: 'left',
                        top: 'bottom',
                        text: ['High', 'Low'],
                        calculable: true
                    },
                    geo: {
                        map: 'china',
                        roam: true,
                        label: {
                            emphasis: {
                                show: false
                            }
                        },
                        itemStyle: {
                            normal: {
                                areaColor: '#323c48',
                                borderColor: '#111'
                            },
                            emphasis: {
                                areaColor: '#2a333d'
                            }
                        }
                    },
                    series: [
                        {
                            name: 'Value',
                            type: 'scatter',
                            coordinateSystem: 'geo',
                            data: convertData(data),
                            symbolSize: 12,
                            label: {
                                normal: {
                                    formatter: '{b}',
                                    position: 'right',
                                    show: false
                                },
                                emphasis: {
                                    show: true
                                }
                            },
                            itemStyle: {
                                normal: {
                                    color: '#ddb926'
                                }
                            }
                        }
                    ]
                },
                {
                    title: {
                        text: 'Morphing Map-Bar Chart',
                        subtext: 'From Map to Bar Chart',
                        left: 'center'
                    },
                    tooltip: {
                        trigger: 'axis',
                        axisPointer: {
                            type: 'shadow'
                        }
                    },
                    xAxis: {
                        type: 'category',
                        data: data.map(item => item.name)
                    },
                    yAxis: {
                        type: 'value'
                    },
                    series: [
                        {
                            name: 'Value',
                            type: 'bar',
                            data: data.map(item => item.value)
                        }
                    ]
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