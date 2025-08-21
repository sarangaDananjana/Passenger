#!/bin/bash
cron 
python manage.py collectstatic --noinput
crontab -l

exec su -s /bin/bash passengeradmin -c "\
    python manage.py collectstatic --noinput && \
    exec gunicorn --bind 0.0.0.0:8000 --workers 3 passenger.wsgi:application\
"