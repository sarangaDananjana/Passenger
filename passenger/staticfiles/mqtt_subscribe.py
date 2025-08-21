# mqtt_subscribe.py
import paho.mqtt.client as mqtt


def on_connect(client, userdata, flags, rc, properties=None):
    print("Connected with result code", rc)
    client.subscribe(topic_to_follow)
    print(f"Now following {topic_to_follow}...")


def on_message(client, userdata, message):
    coords = message.payload.decode("utf-8")
    lat, lon = coords.split(",")
    print(f"[{message.topic}] Latitude={lat}, Longitude={lon}")


MqttBroker = "www.passenger.lk"
client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id="Tracker"
)
client.username_pw_set("user", "passengerbus")  # <-- your MQ user/pass
client.on_connect = on_connect
client.on_message = on_message

# Ask which vehicle
vehicle_id = input(
    "Enter vehicle to follow (bus_1 or bus_2): ").strip()
topic_to_follow = f"vehicle/{vehicle_id}"

client.loop_start()
client.connect(MqttBroker, 1883)

try:
    while True:
        pass
except KeyboardInterrupt:
    pass

client.loop_stop()
client.disconnect()
