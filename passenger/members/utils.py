import datetime
import requests
import pytz
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from pymongo import MongoClient


tz = pytz.timezone("Asia/Colombo")
utc_timezone = pytz.utc
# Access MongoDB URI from settings
# Access the URI from settings
mongodb_uri = settings.DATABASE
DEBUG = settings.DEBUG
# MongoDB client setup using the URI
client = MongoClient(mongodb_uri)
# Access your database (assuming the name is 'Passenger')
db = client['Passenger']
# Access the 'users' collection (or your actual collection name)
user_collection = db['Users']
bookings_collection = db['Bookings']
bustrips_collection = db['BusTrips']
routes_collection = db['Routes']
app_version_collection = db["AppVersion"]
boarding_points_collection = db["BoardingPoints"]
FCM_TOKEN_collection = db["FCMTokens"]

NOTIFICATION_URL = "https://www.passenger.lk/members/send-notification/"


def process_trips():
    logs = []
    logs.append("Entered process_trips")

    # Bail out immediately if in DEBUG mode
    if not DEBUG:
        logs.append("DEBUG mode - skipping notifications")
        return Response({'detail': 'DEBUG mode - skipping.', 'logs': logs}, status=status.HTTP_200_OK)
    logs.append("DEBUG is False, proceeding with notification process")

    # Count completed vs active trips
    try:
        completed_count = bustrips_collection.count_documents(
            {'completed': True})
        active_count = bustrips_collection.count_documents(
            {'completed': False})
        logs.append(f"Completed trips found: {completed_count}")
        logs.append(f"Active trips found: {active_count}")
    except Exception as e:
        logs.append(f"Error counting trips: {e}")

    # Current time (naive, no timezone)
    now = datetime.datetime.now()
    logs.append(f"Current time (naive): {now}")

    to_notify = []
    logs.append("Scanning for active trips (completed == False)")

    # 2) Scan every trip where completed == False
    for trip in bustrips_collection.find({'completed': False}):
        trip_id = trip.get('_id')
        logs.append(f"Processing trip {trip_id}")

        orig = trip.get('bookings', [])
        logs.append(f"Original bookings for {trip_id}: {len(orig)} entries")

        # Sanitize unbooked booking entries by wiping their start/end points
        unbooked_count = sum(1 for b in orig if not b.get('booked'))
        logs.append(f"Unbooked bookings to sanitize: {unbooked_count}")

        if unbooked_count:
            try:
                update_result = bustrips_collection.update_one(
                    {'_id': trip_id},
                    {'$set': {
                        'bookings.$[elem].start_point': None,
                        'bookings.$[elem].end_point': None,
                    }},
                    array_filters=[{'elem.booked': False}]
                )
                logs.append(
                    f"Sanitized {update_result.modified_count} unbooked booking(s) for trip {trip_id}")
            except Exception as e:
                logs.append(
                    f"Error sanitizing unbooked bookings for trip {trip_id}: {e}")

        # 3) Check if trip_start_time is 0–30 min from now without timezone data
        ts = trip.get('trip_start_time')
        if isinstance(ts, datetime.datetime):
            # drop tzinfo if present
            ts_naive = ts.replace(tzinfo=None)
            mins_left = (ts_naive - now).total_seconds() / 60
            logs.append(
                f"Trip {trip_id} start time (naive): {ts_naive}, minutes left: {mins_left:.2f}")
            if 0 < mins_left <= 30:
                to_notify.append((str(trip_id), int(mins_left)))
                logs.append(
                    f"Added trip {trip_id} to notification list with {int(mins_left)} minutes left")

    logs.append(f"Total trips queued for notification: {len(to_notify)}")

    # 4) For each trip hitting the 30-min window, find its bookings and notify
    for trip_id, minutes in to_notify:
        logs.append(f"Notifying users for trip {trip_id}")
        for bk in bookings_collection.find({'trip_id': trip_id}):
            uid = bk.get('user_id')
            payload = {'remaining_minutes': minutes, 'user_id': uid}
            logs.append(
                f"Sending POST to {NOTIFICATION_URL} with payload {payload}")
            try:
                resp = requests.post(
                    NOTIFICATION_URL,
                    json=payload,
                    timeout=5
                )
                logs.append(
                    f"Received status {resp.status_code} for user {uid}")
            except Exception as ex:
                logs.append(f"Error sending notification for user {uid}: {ex}")

    logs.append("Finished processing all trips")
    return Response({
        'detail': 'Done',
        'trips_notified': len(to_notify),
        'logs': logs
    }, status=status.HTTP_200_OK)
