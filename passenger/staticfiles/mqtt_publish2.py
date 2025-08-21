# mqtt_publish2.py
import time
from random import uniform
import paho.mqtt.client as mqtt

MqttBroker = "www.passenger.lk"

client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id="bus_2"
)
client.username_pw_set("user", "passengerbus")  # <-- your MQ user/pass
client.connect(MqttBroker, 1883)

topic = "vehicle/bus_2"

while True:
    # random coords (latitude, longitude)
    lat = uniform(-90.0, 90.0)
    lon = uniform(-180.0, 180.0)
    payload = f"{lat:.6f},{lon:.6f}"
    client.publish(topic, payload)
    print(f"[bus_2] Published {payload} to {topic}")
    time.sleep(2)
