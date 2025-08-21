FROM eclipse-mosquitto:latest

# Accept credentials via build args
ARG MQTT_USER
ARG MQTT_PASS

# Copy your config
COPY mosquitto.conf /mosquitto/config/mosquitto.conf

# Bootstrap password file with the provided user/pass
RUN touch /mosquitto/config/pwfile \
    && chmod 600 /mosquitto/config/pwfile \
    && mosquitto_passwd -b /mosquitto/config/pwfile "$MQTT_USER" "$MQTT_PASS"

CMD ["mosquitto", "-c", "/mosquitto/config/mosquitto.conf"]
