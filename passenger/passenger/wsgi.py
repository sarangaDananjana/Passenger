# wsgi.py

import os
from django.core.wsgi import get_wsgi_application
from prometheus_client import make_wsgi_app
from werkzeug.middleware.dispatcher import DispatcherMiddleware

from base64 import b64decode

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'passenger.settings')
django_app = get_wsgi_application()

# 1. Define Basic-Auth middleware


class BasicAuthMiddleware:
    def __init__(self, app, username, password):
        self.app = app
        self.username = username
        self.password = password

    def __call__(self, environ, start_response):
        auth = environ.get('HTTP_AUTHORIZATION', '')
        if auth.startswith('Basic '):
            creds = b64decode(auth.split(' ', 1)[1]).decode()
            user, pw = creds.split(':', 1)
            if user == self.username and pw == self.password:
                return self.app(environ, start_response)

        # challenge
        start_response('401 Unauthorized', [
            ('WWW-Authenticate', 'Basic realm="Metrics"'),
            ('Content-Type', 'text/plain'),
        ])
        return [b'Unauthorized']


# 2. Wrap make_wsgi_app
metrics_app = make_wsgi_app()
metrics_app = BasicAuthMiddleware(metrics_app, 'metrics_user', 's3cr3t')

# 3. Mount both apps
application = DispatcherMiddleware(
    django_app,
    {'/metrics': metrics_app}
)
