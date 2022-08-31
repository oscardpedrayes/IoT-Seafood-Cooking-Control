 //Client-side Javascript code
 
 function padWithZero(num, targetLength){
    return String(num).padStart(targetLength, '0')
 }

 function openMonthDialog(){
    document.getElementById('month_download').showPicker();
 }

 function openDayDialog(){
    document.getElementById('day_download').showPicker();
 }

 function openDateDialog(){
    document.getElementById('day_chart').showPicker();
 }

 function refreshDateChart(){
    document.getElementById('day_chart').onchange();    
 }

 function padto10(num){
    if (parseInt(num)<10)
        return "0" + num
    else return num
 }

 function updateDateChart(chart, date_value){
    $.ajax({
        url: "/day",
        data: { 
            "date": date_value.replaceAll('-','_'), 
        },
        type: "GET",
        success: function (results){            
            arrOfNum = [];
            results.temps.forEach(str => {
                arrOfNum.push(Number(str.replace(',','.')));
              });
            temps_date = arrOfNum;
            times_date = results.times;
            cook_date = results.cook;

            cook_temps = [];
            cook_times = [];

            dict_temps_d = [];
            dict_cooktemps_d = [];


            for(var i = 0; i < temps_date.length; i++){
                tmp = {}
                tmp['x'] = parseInt(times_date[i])
                tmp['y'] = temps_date[i]
                dict_temps_d.push(tmp)
            }

            for(var i = 0; i < cook_date.length; i++){
                if (cook_date[i] === "Cociendo"){
                    tmp = {}
                    tmp['x'] = parseInt(times_date[i])
                    tmp['y'] = temps_date[i]
                    dict_cooktemps_d.push(tmp)
                }
                else if (cook_date[i] === "Esperando"){
                    tmp = {}
                    tmp['x'] = parseInt(times_date[i])
                    tmp['y'] = null
                    dict_cooktemps_d.push(tmp)
                }
            }

            console.log(temps_date);
            console.log(times_date);
            console.log(cook_date);

            var chartDataDate = {
                datasets: [{
                    borderColor: "rgba(255,127,127,1)",
                    borderWidth: 3,
                    radius: 0,
                    label: "Temperatura cocción (ºC)",
                    data: dict_cooktemps_d, //cook_temps,
                    fill: {
                        target: 'origin',
                        above: 'rgb(255, 0, 0, 0.1)',   // Area will be red above the origin
                        below: 'rgb(0, 0, 255)'    // And blue below the origin
                      },
                    spanGaps: false
                },
                {
                    borderColor: "rgba(127,127,255,1)",
                    borderWidth: 3,
                    radius: 0,
                    label: "Temperatura (ºC)",
                    data: dict_temps_d,//temps_date,
                    fill: false,
                    spanGaps: false
                },
            ]
            };

            var chartDateOptions = {   
                plugins: {
                    legend: {
                        display: true,
                    }
                },           
                scales: {
                    x: {    
                        type: 'time',
                        time: {
                          unit: 'hour',  // <-- that does the trick here
                          displayFormats: {
                            hour: 'HH:mm'
                          },
                          tooltipFormat: 'HH:mm:ss'  // <-- same format for tooltip
                        }                       
                    },
                    y: {
                        max: 120,
                        min: 0,
                        ticks: {
                            stepSize: 10,
                        },
                    },                
                },
                responsive: true,
                maintainAspectRatio:false,
                    animation: {
                        duration: 100,
                        easing: 'linear'
                    },
                };

            chart.options = chartDateOptions;
            chart.data = chartDataDate;
            
            chart.update();

            if (results.times.length <= 0)
                alert('No se han encontrado datos para la fecha seleccionada.')           
        },
        error: function(error){       
            alert('No se han encontrado datos para la fecha seleccionada.')
        }
     })
 }


 function download(){
    var download_date = document.getElementById('month_download').value.replaceAll('-','_');
    console.log(download_date);

    $.ajax({
        url: "/exists",
        data: { 
            "filename": download_date, 

        },
        type: "GET",
        success: function (results){     
            var link=document.createElement('a');
            filePath= "/download?filename=" + download_date
            link.href = filePath;
            link.download = filePath.substr(filePath.lastIndexOf('/') + 1);
            link.click();
        },
        error: function(error){
            alert('No se han encontrado datos para la fecha seleccionada.')
        }
    })
}

function day_download(){
    var download_date = document.getElementById('day_download').value.replaceAll('-','_');
    console.log(download_date);
    var month_date = download_date.split('_')[0] + '_' + download_date.split('_')[1]

    $.ajax({
        url: "/exists",
        data: { 
            "filename": month_date, 

        },
        type: "GET",
        success: function (results){     
            var link=document.createElement('a');
            filePath= "/day_download?date=" + download_date
            link.href = filePath;
            link.download = filePath.substr(filePath.lastIndexOf('/') + 1);
            link.click();
        },
        error: function(error){
            alert('No se han encontrado datos para la fecha seleccionada.')
        }
    })
}

// READY
$( document ).ready(function() {
    // Initialize variables
    var dict_temps_rt = [];
    var dict_cooktemps_rt = [];

    // Initialize month
    var monthControl = document.getElementById('month_download');
    actual_date = new Date();
    actual_year =  actual_date.getFullYear();
    actual_month = actual_date.getMonth() + 1;
    actual_day = actual_date.getDate();

    if (actual_month < 10){
        actual_month = '0' + actual_month
    }
    monthControl.value = actual_year + '-' + actual_month

    // Initialize date
    var dateControl = document.getElementById('day_chart')
    var day_download_date = document.getElementById('day_download')


    if (actual_day < 10){
        actual_day = '0' + actual_day
    }
    actual_date_string = actual_year  + '-' + actual_month + '-' + actual_day
    console.log(actual_date_string)
    dateControl.value = actual_date_string
    day_download_date.value = actual_date_string


    // Charts options
    var chartOptions = {   
        plugins: {
            legend: {
                display: true,
            }
        },
        scales: {
            x: {    
                type: "time",  // <-- "time" instead of "timeseries"   
                time: {
                    unit: 'minute',  // <-- that does the trick here
                    displayFormats: {
                      minute: 'HH:mm'
                    },
                    tooltipFormat: 'HH:mm:ss'  // <-- same format for tooltip
                  }
            },
            y: {
                max: 120,
                min: 0,
                ticks: {
                    stepSize: 10,
                },
            },
        },
        responsive: true,
        maintainAspectRatio:false,
            animation: {
                duration: 200,
                easing: 'linear'
            },
        };

        var chartDataRealTime = {
            datasets: [{
                borderColor: "rgba(255,127,127,1)",
                borderWidth: 3,
                radius: 3,
                label: "Temperatura cocción (ºC)",
                data: dict_cooktemps_rt,
                fill: {
                    target: 'origin',
                    above: 'rgb(255, 0, 0, 0.1)',   // Area will be red above the origin
                    below: 'rgb(0, 0, 255)'    // And blue below the origin
                  },
                spanGaps: false
            },
            {
                borderColor: "rgba(127,127,255,1)",
                borderWidth: 3,
                radius: 3,
                label: "Temperatura (ºC)",
                data: dict_temps_rt,
                fill: false,
                spanGaps: false
            }]
        };


    // Real time canvas
    const realtimecanvas = document.getElementById('realtimechart').getContext('2d');
    var realtimechart = new Chart(realtimecanvas, {
        type: 'line',
        data: chartDataRealTime,
        options: chartOptions,
        });  


    $.ajax({
        url: "/realtimechart",
        data: { 
            "date": actual_date_string.replaceAll('-','_'), 
        },
        type: "GET",
        success: function (results){ 
            temps = [];
            times = [];           
            results.temps.forEach(str => {
                temps.push(Number(str.replace(',','.')));
                });
            results.times.forEach(str => {
                times.push(str);
                });
            
            for(var i = 0; i < temps.length; i++){
                tmp = {}
                tmp['x'] = parseInt(times[i])
                tmp['y'] = temps[i]
                dict_temps_rt.push(tmp)
            }
                     
            
            cook_type = [];
            results.cook.forEach(str => {
                cook_type.push(str);
                });
            for(var i = 0; i < cook_type.length; i++){
                if (cook_type[i] === "Cociendo"){
                    tmp = {}
                    tmp['x'] = parseInt(times[i])
                    tmp['y'] = temps[i]
                    dict_cooktemps_rt.push(tmp)
                }
                else if (cook_type[i] === "Esperando"){
                    tmp = {}
                    tmp['x'] = parseInt(times[i])
                    tmp['y'] = null
                    dict_cooktemps_rt.push(tmp)
                }     
            }
            realtimechart.update();
            console.log(dict_temps_rt)        
        },
        error: function(error){       
            console.log('No hay datos recientes para la gráfica en tiempo real.')
        }
        })
    


    const datecanvas = document.getElementById('datechart').getContext('2d');
    var datechart = new Chart(datecanvas, {
        type: 'line',
        data: chartDataRealTime,
        options: chartOptions,
        });
        
    // Update DateChart data
    dateControl.onchange = function(){
        updateDateChart(datechart, this.value);
        };   
    dateControl.onchange();  
    

    console.log("Start")
    // connect to the socket server for real time data.
    var socket_realtime = io.connect('http://' + document.domain + ':' + location.port + '/realtime', {wsEngine: 'ws' });
    // receive realtime data from server
    socket_realtime.on('realtime_temp', function(msg) {
        string_date = new Date(msg.timestamp)
        string_date = padto10(string_date.getHours()) + ":" + padto10(string_date.getMinutes()) + ":" + padto10(string_date.getSeconds());
        if (msg.cook === "Esperando")
            $('#log').html(padWithZero(msg.temp + ' ºC') + "<h1 style='font-size:10px'> Última actualización a las " + string_date + "</h1>");
        else if (msg.cook === "Cociendo")
            $('#log').html("<span style=color:red;>" + padWithZero(msg.temp + ' ºC') + "</span><h1 style='font-size:10px'> Última actualización a las " + string_date + "</h1>");
    });

    // connect to the socket server for 30 sec data.
    var socket = io.connect('http://' + document.domain + ':' + location.port + '/update_temp'); 
    // receive 30 sec data from server
    socket.on('new_temp', function(msg) {
        console.log("Received number: " + msg.temp, "Timestamp: " + msg.timestamp); 
        tmp = {}
        tmp['x'] = msg.timestamp
        tmp['y'] = msg.temp
        dict_temps_rt.push(tmp)

        if (msg.cook === "Cociendo"){
            tmp = {}
            tmp['x'] = parseInt(msg.timestamp)
            tmp['y'] = msg.temp
            dict_cooktemps_rt.push(tmp)
        }                
        else if (msg.cook === "Esperando"){
            tmp = {}
            tmp['x'] = parseInt(msg.timestamp)
            tmp['y'] = null
            dict_cooktemps_rt.push(tmp)
        }
          
        // maintain a list of ten numbers
        if (dict_temps_rt.length > 60){
            dict_cooktemps_rt.shift();
            dict_temps_rt.shift();
        }
        realtimechart.update();

        string_date = new Date(msg.timestamp)
        string_date = padto10(string_date.getHours()) + ":" + padto10(string_date.getMinutes()) + ":" + padto10(string_date.getSeconds());
        $('#timelog_chart').html("Última actualización a las " + string_date);
    });


  

});



