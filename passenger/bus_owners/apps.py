from django.apps import AppConfig


class BusOwnersConfig(AppConfig):
    default_auto_field = 'django_mongodb_backend.fields.ObjectIdAutoField'
    name = 'bus_owners'
