import time
import json
import paho.mqtt.client as mqtt

# MQTT setup
MQTT_BROKER = "www.passenger.lk"
CLIENT_ID = "6870c4c70c3a861560238224"
USERNAME = "user"
PASSWORD = "passengerbus"
TOPIC = "vehicle/6870c4c70c3a861560238224"


def load_points(json_file):
    """
    Load a list of points from a JSON file.
    Expects [{"index":1,"latitude":..., "longitude":...}, …]
    """
    with open(json_file, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    # 1) connect
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=CLIENT_ID
    )
    client.username_pw_set(USERNAME, PASSWORD)
    client.connect(MQTT_BROKER, 1883)

    # 2) load your generated points
    points = load_points("path500.json")  # or "path1000.json"

    # 3) publish in order, indefinitely
    while True:
        for pt in points:
            lat = pt["latitude"]
            lon = pt["longitude"]
            payload = f"{lat:.6f},{lon:.6f}"
            client.publish(TOPIC, payload)
            print(f"[{CLIENT_ID}] Published {payload} (point {pt['index']})")
            time.sleep(3)   # adjust rate as needed


if __name__ == "__main__":
    main()
