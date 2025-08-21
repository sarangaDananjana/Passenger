# myproject/metrics.py

from prometheus_client import Counter, Histogram

# Define your metrics
REQUEST_COUNT = Counter(
    'django_http_requests_total',
    'Total Django HTTP requests',
    ['method', 'endpoint', 'status']
)
REQUEST_LATENCY = Histogram(
    'django_http_request_latency_seconds',
    'Latency of Django HTTP requests',
    ['method', 'endpoint']
)


class PrometheusMiddleware:
    """
    New-style Django middleware that uses the Histogram.time()
    context-manager to record request latency automatically.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        method = request.method
        endpoint = request.path

        # Start timer context
        timer = REQUEST_LATENCY.labels(method, endpoint).time()
        timer.__enter__()

        # Dispatch request
        response = self.get_response(request)

        # Stop timer & record duration
        timer.__exit__(None, None, None)

        # Increment request counter with status code
        REQUEST_COUNT.labels(method, endpoint, response.status_code).inc()

        return response
