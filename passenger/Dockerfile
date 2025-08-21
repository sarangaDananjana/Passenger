FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y dos2unix \
    && rm -rf /var/lib/apt/lists/*
# Create the app directory
RUN mkdir /app

# Set the working directory
WORKDIR /app

# Set environment variables to optimize Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1 

# Install dependencies first for caching benefit
RUN pip install --upgrade pip 
COPY requirements.txt /app/ 
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Production stage
FROM python:3.12-slim

RUN apt-get update && apt-get install -y dos2unix && apt-get install -y --no-install-recommends cron \
    && rm -rf /var/lib/apt/lists/*

COPY process_trips.sh entrypoint.prod.sh /app/
RUN dos2unix /app/entrypoint.prod.sh /app/process_trips.sh \
    && chmod +x /app/entrypoint.prod.sh /app/process_trips.sh

# 8. Add your cron job (runs as root by default)
RUN echo "*/5 * * * * root /app/process_trips.sh >> /var/log/process_trips.log 2>&1" \
    > /etc/cron.d/process_trips \
    && chmod 0644 /etc/cron.d/process_trips \
    && crontab /etc/cron.d/process_trips

RUN useradd -m -r passengeradmin && \
    chown -R passengeradmin /app

RUN mkdir -p /var/run \
    && touch /var/run/crond.pid \
    && chown passengeradmin:passengeradmin /var/run/crond.pid

# 9. Prepare log file
RUN touch /var/log/process_trips.log \
    && chown passengeradmin:passengeradmin /var/log/process_trips.log \
    && chown -R passengeradmin:passengeradmin /app



# Copy the Python dependencies from the builder stage
COPY --from=builder /usr/local/lib/python3.12/site-packages/ /usr/local/lib/python3.12/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/

# Set the working directory
WORKDIR /app

# Copy application code
COPY --chown=passengeradmin:passengeradmin . .

# Set environment variables to optimize Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1 

# Switch to non-root user

# Expose the application port
EXPOSE 8000 

RUN dos2unix /app/entrypoint.prod.sh
# Make entry file executable
RUN chmod +x  /app/entrypoint.prod.sh


# Start the application using Gunicorn
CMD ["/app/entrypoint.prod.sh"]
