from django.apps import AppConfig
import os
import json
import boto3
import firebase_admin
from firebase_admin import credentials
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class MembersConfig(AppConfig):
    default_auto_field = 'django_mongodb_backend.fields.ObjectIdAutoField'
    name = 'members'

    def ready(self):
        # only initialize once
        if firebase_admin._apps:
            return

        if settings.DEBUG:
            # Development: load local Firebase service account JSON
            local_path = os.path.join(
                settings.BASE_DIR, 'passenger-firebase.json')
            if not os.path.exists(local_path):
                raise ImproperlyConfigured(
                    f"DEBUG mode: expected Firebase JSON at {local_path}, but file was not found."
                )
            cred = credentials.Certificate(local_path)

            firebase_admin.initialize_app(cred)
        else:
            # pull from settings
            cred_json = settings.FIREBASE_CREDENTIALS_JSON
            if not cred_json:
                raise ImproperlyConfigured(
                    "FIREBASE_CREDENTIALS_JSON is not set in settings"
                )
            key_dict = json.loads(cred_json)
            cred = credentials.Certificate(key_dict)
            firebase_admin.initialize_app(cred)
