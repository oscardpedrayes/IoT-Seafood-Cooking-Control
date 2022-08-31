import asyncio
import os
from flask import Flask, render_template, request, send_file, jsonify
from flask_socketio import SocketIO
from time import sleep
#import random
from threading import Thread, Event
import datetime
# Sensor Imports
import board
import digitalio
import adafruit_max31865
import gevent
import RPi._GPIO as GPIO
import io
import csv

# Config
__autor__ = 'oscardpedrayes'
APP_ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FOLDER = os.path.join(APP_ROOT, 'data')
MAX_MONTHS = 12
TIME_INTERVAL = 30 # in seconds
BUTTON_PIN= 6
GPIO.setmode(GPIO.BCM)
GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

#Initialize
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')
thread = Thread()
realtime_thread = Thread()
thread_stop_event = Event()
realtime_thread_stop_event = Event()

# Create sensor object, communicating over the board's default SPI bus
spi =  board.SPI()
cs = digitalio.DigitalInOut(board.D5)  # Chip select of the MAX31865 board.
sensor = adafruit_max31865.MAX31865(spi, cs, rtd_nominal=100, ref_resistor=430.0, wires=4)

def getData():
    temp = round(sensor.temperature, 1) # Get temp
    cooking_pin = cooking_pin_state(GPIO.input(BUTTON_PIN))   # Get cook status
    now = datetime.datetime.now() # Get time
    hour = str(now.hour).zfill(2) + ':' + str(now.minute).zfill(2) + ':' + str(now.second).zfill(2)
    day = str(now.year).zfill(4) + '/' + str(now.month).zfill(2) + '/' + str(now.day).zfill(2)
    timestamp = int((datetime.datetime.utcnow() - datetime.datetime(1970, 1, 1)).total_seconds() * 1000)

    return temp, cooking_pin, now, hour, day, timestamp


def button_callback(channel):
    temp, cooking_pin, now, hour, day, timestamp = getData()
    # Send data 
    socketio.emit('realtime_temp', {'temp': temp, 'timestamp':timestamp, 'cook':str(cooking_pin)}, namespace='/realtime')
    socketio.emit('new_temp', {'temp': temp, 'timestamp':timestamp, 'cook':str(cooking_pin)}, namespace='/update_temp')
    # Append data to file
    print('update data')
    with open(os.path.join(DATA_FOLDER, str(now.year).zfill(4) + '_' + str(now.month).zfill(2) + '.csv'), 'a') as f:
        f.write(day + ';' + hour + ';' + str(temp).replace(',','').replace('.',',') + ';' + str(cooking_pin) + ";" + str(timestamp) + '\n')
    # Delete files if necessary
    for root, _, files in os.walk(DATA_FOLDER, topdown=True):
        if len(files) > MAX_MONTHS:
            print( str(len(files)) + ' files. Older files will be eliminated (<' + str(MAX_MONTHS) + ' months) ')
            files = files[0:MAX_MONTHS]
            print('BORRAR : ' + str(len(files)))
            for file in files:
                filename = os.path.join(root, file)
                print('\tRemoved: ' + filename)
                os.remove(filename)


def cooking_pin_state(state):
    if state == GPIO.HIGH:
        return 'Esperando'
    else: return 'Cociendo'

class UpdateThread(gevent.Greenlet):
    def __init__(self):
        self.delay = TIME_INTERVAL
        super(UpdateThread, self).__init__()
    def readTemps(self):
        """
        Read the temperature from the sensor every delay of second and emit to a socketio instance (broadcast)
        Ideally to be run in a separate thread
        """
        # Infinite loop for reading temp every sec
        print("Reading sensor...")
        while not thread_stop_event.is_set():
            temp, cooking_pin, now, hour, day, timestamp = getData()
            # Send data
            socketio.emit('new_temp', {'temp': temp, 'timestamp':timestamp, 'cook':str(cooking_pin)}, namespace='/update_temp')
            # Append data to file
            print('update data')
            with open(os.path.join(DATA_FOLDER, str(now.year).zfill(4) + '_' + str(now.month).zfill(2) + '.csv'), 'a') as f:
                f.write(day + ';' + hour + ';' + str(temp).replace(',','').replace('.',',') + ';' + str(cooking_pin) + ';' + str(timestamp) + '\n')
            # Delete files if necessary
            for root, _, files in os.walk(DATA_FOLDER, topdown=True):
                if len(files) > MAX_MONTHS:
                    print( str(len(files)) + ' files. Older files will be eliminated (<' + str(MAX_MONTHS) + ' months) ')
                    files = files[0:MAX_MONTHS]
                    print('BORRAR : ' + str(len(files)))
                    for file in files:
                        filename = os.path.join(root, file)
                        print('\tRemoved: ' + filename)
                        os.remove(filename)
            gevent.sleep(self.delay)

    def run(self):
        self.readTemps()  

class RealTimeThread(gevent.Greenlet):
    def __init__(self):
        self.delay = 1
        super(RealTimeThread, self).__init__()
    def readTemps(self):
        """
        Read the temperature from the sensor every 1 second and emit to a socketio instance (broadcast)
        Ideally to be run in a separate thread
        """
        # Infinite loop for reading temp every sec
        print("Reading sensor...")
        while not realtime_thread_stop_event.is_set():
            temp, cooking_pin, _, _, _, timestamp = getData()
            socketio.emit('realtime_temp', {'temp': temp, 'timestamp':timestamp, 'cook':str(cooking_pin)}, namespace='/realtime')
            gevent.sleep(self.delay)

    def run(self):
        self.readTemps()  

# Serve index.html
@app.route('/')
def index():
    return render_template('index.html')

# Start thread on connect
@socketio.on('connect', namespace='/update_temp')
def update_temp():
    print('Client connected')

# Start thread on connect
@socketio.on('connect', namespace='/realtime')
def realtime():
    print('Client connected')

# Download CSV with all historic temps
@app.route('/exists', methods=['GET'])
def exists():
    filename = request.args.get('filename', default = '*', type=str)
    filename = os.path.join(DATA_FOLDER, filename + '.csv')   
    print('Serving:  ' + filename)

    if os.path.exists(filename): 
        return "El fichero existe", 200
    else:
        return 'Fichero no encontrado', 404

@app.route('/download', methods=['GET'])
def download():
    filename = request.args.get('filename', default = '*', type=str)
    filename_path = os.path.join(DATA_FOLDER, filename + '.csv')   
    print('Serving:  ' + filename)

    if os.path.exists(filename_path): 
        lines_csv = []
        with open(filename_path, 'r') as f:
            lines  = f.readlines()

        for line in lines:
            lines_csv.append(line.replace('\n',''))

        proxy = io.StringIO()
        writer = csv.writer(proxy, delimiter=';')
        for line in lines_csv:
            writer.writerow(line.split(';')[0:-1])
        
        # Creating the byteIO object from the StringIO Object
        mem = io.BytesIO()
        mem.write(proxy.getvalue().encode())
        mem.seek(0)
        proxy.close()    
        return send_file(
            mem,
            as_attachment=True,
            download_name= filename + '.csv',
            mimetype='text/csv'
        )

@app.route('/day', methods=['GET'])
def day():
    response_temps = []
    response_times = []
    response_cook = []
    date_string = request.args.get('date', default = '*', type=str)
    filename_path = date_string.split('_')[0] + '_' + date_string.split('_')[1] 
    filename_path = os.path.join(DATA_FOLDER, filename_path + '.csv')   
    print('Serving:  ' + date_string)

    if os.path.exists(filename_path): 
        with open(filename_path, 'r') as f:
            lines  = f.readlines()

        for line in lines:
            line = line.split(';')
            if line[0].replace('/', '_') == date_string:
                response_temps.append(line[2].replace('\n',''))
                response_times.append(line[4].replace('\n',''))
                response_cook.append(line[3].replace('\n',''))

        
        return jsonify(
            temps= response_temps,
            times= response_times,
            cook=response_cook
        )
       
@app.route('/day_download', methods=['GET'])
def day_download():
    date_string = request.args.get('date', default = '*', type=str)
    filename_path = date_string.split('_')[0] + '_' + date_string.split('_')[1] 
    filename_path = os.path.join(DATA_FOLDER, filename_path + '.csv')   
    print('Serving:  ' + date_string)
    lines_csv = []

    if os.path.exists(filename_path): 
        with open(filename_path, 'r') as f:
            lines  = f.readlines()

        for line in lines:
            splitline = line.replace('\n','').split(';')
            if splitline[0].replace('/', '_') == date_string:
                lines_csv.append(line.replace('\n',''))

        proxy = io.StringIO()
        writer = csv.writer(proxy, delimiter=';')
        for line in lines_csv:
            writer.writerow(line.split(';')[1:-1])
        
        # Creating the byteIO object from the StringIO Object
        mem = io.BytesIO()
        mem.write(proxy.getvalue().encode())
        mem.seek(0)
        proxy.close()    
        return send_file(
            mem,
            as_attachment=True,
            download_name= date_string + '.csv',
            mimetype='text/csv'
        )

@app.route('/realtimechart', methods=['GET'])
def realtimechart():
    response_temps = []
    response_times = []
    response_cook = []
    date_string = request.args.get('date', default = '*', type=str)
    filename_path = date_string.split('_')[0] + '_' + date_string.split('_')[1] 
    filename_path = os.path.join(DATA_FOLDER, filename_path + '.csv')   
    print('Serving:  ' + date_string)

    if os.path.exists(filename_path): 
        with open(filename_path, 'r') as f:
            lines  = f.readlines()

        if len(lines) > 60:
            lines = lines[-60:]

        for line in lines:
            line = line.split(';')
            if line[0].replace('/', '_') == date_string:
                response_temps.append(line[2].replace('\n',''))
                response_times.append(line[4].replace('\n',''))
                response_cook.append(line[3].replace('\n',''))

        return jsonify(
            temps= response_temps,
            times= response_times,
            cook=response_cook
        )


### MAIN ###
if __name__ == "__main__":
    # Start updating
    GPIO.add_event_detect(BUTTON_PIN, GPIO.BOTH, callback=button_callback, bouncetime=200)
    if not thread.is_alive():
        print("Starting UpdateThread")
        thread = UpdateThread()
        thread.start()
    if not realtime_thread.is_alive():
        print("Starting RealTimeThread")
        realtime_thread = RealTimeThread()
        realtime_thread.start()
    # Start server
    socketio.run(app, host='0.0.0.0', port=80, debug=False)
    
