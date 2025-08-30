import random
import math
import datetime
import re
import hmac
import hashlib
import json
import requests
import pytz
from dateutil import parser
from firebase_admin import messaging
from bson.objectid import ObjectId
from bson import ObjectId
from bson.errors import InvalidId
from packaging.version import Version, InvalidVersion
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden, HttpResponseBadRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from passenger.settings import create_access_token, create_refresh_token, get_access_token_from_request, validate_token, generate_qr_code_base64

tz = pytz.timezone("Asia/Colombo")
utc_timezone = pytz.utc
# Access MongoDB URI from settings
# Access the URI from settings
mongodb_uri = settings.DATABASE

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


@api_view(['POST'])
def register_or_login_user(request):
    """
    Registers or logs in a user. If the user exists, generate OTP and send SMS, else create a new user.

        {
"role": "USER",
"phone_number": "0774610536"
}

    """
    role = request.data.get('role')
    phone_number = request.data.get('phone_number')

    # Validate phone number
    if not phone_number:
        return Response({"error": "Phone number is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Validate role
    # Adjust based on your User model
    valid_roles = ["USER"]
    if not role or role not in valid_roles:
        return Response({"error": "Invalid role specified."}, status=status.HTTP_400_BAD_REQUEST)

    # Check if user exists in MongoDB
    user = user_collection.find_one({"phone_number": phone_number})

    def send_otp_sms(phone, otp_code):
        message = f"Your OTP code is: {otp_code}"
        response = requests.post(
            "https://app.text.lk/api/v3/sms/send",
            headers={
                "Authorization": "Bearer 319|OAWuEVQ24CJPu7oprqZiplNyErfta1oB5aFvhhiU37ced9f0",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            json={
                "recipient": phone,
                "sender_id": "TextLKDemo",
                "type": "plain",
                "message": message
            }, timeout=5
        )
        return response.status_code == 200

    if user:
        # User exists, generate OTP and send SMS
        otp_code = str(random.randint(100000, 999999))
        local_time = datetime.datetime.now(tz)
        now = local_time.astimezone(utc_timezone)
        otp_expiry = now + datetime.timedelta(minutes=10)

        # Update the existing user with OTP
        update_result = user_collection.update_one(
            {"phone_number": phone_number},
            {
                "$set": {
                    "otp_code": otp_code,
                    "otp_expires_at": otp_expiry
                }
            }
        )

        if update_result.modified_count == 0:
            return Response({"error": "Failed to update OTP for existing user."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if send_otp_sms(user['phone_number'], otp_code):
            return Response({"message": "OTP sent successfully! Please verify."}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Failed to send OTP via SMS."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    else:
        # User does not exist, create a new user
        otp_code = str(random.randint(100000, 999999))
        local_time = datetime.datetime.now(tz)
        now = local_time.astimezone(utc_timezone)
        otp_expiry = now + datetime.timedelta(minutes=10)
        initTokenVersion = 1.0
        # Insert new user into the MongoDB collection
        user_data = {
            "phone_number": phone_number,
            "tokenVersion": initTokenVersion,
            "otp_code": otp_code,
            "otp_expires_at": otp_expiry,
            "is_verified": False,
            "first_name": None,
            "last_name": None,
            "lane_1": None,
            "lane_2": None,
            "city": None,
            "postal_code": None,
            "email": None,
            "email_otp_code": None,
            "birthday": None,
            "gender": None,
            "is_email_verified": False,


        }

        role = "USER"
        user_collection.insert_one(user_data)
        access_token = create_access_token(phone_number, role)

        return Response({
            "message": "New User Created",
            "token": access_token
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def verify_otp(request):
    """
    Verifies the OTP entered by the user and issues JWT on successful authentication using MongoDB operations.

    Example POST request

    {
        "phone_number": "0774610536",
        "otp_code": "123456"
    }
    """
    phone_number = request.data.get("phone_number")
    otp_code = request.data.get("otp_code")
    local_time = datetime.datetime.now(tz)
    now = local_time.astimezone(utc_timezone)

    if not phone_number or not otp_code:
        return Response({"error": "Phone number and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)

    user = user_collection.find_one({"phone_number": phone_number})

    otp_expiry = user.get('otp_expires_at')

    if not user:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    if user.get('otp_code') != otp_code:
        return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

    if now.replace(tzinfo=None) > otp_expiry.replace(tzinfo=None):
        return Response({"error": "OTP expired."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Mark user as verified (no transaction/session)
        update_result = user_collection.update_one(
            {"phone_number": phone_number},
            {
                "$set": {
                    "is_verified": True,
                    "otp_code": None,
                    "otp_expires_at": None
                }
            }
        )

        if update_result.modified_count == 0:
            return Response({"error": "Failed to update user verification status."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        role = 'USER'
        # Generate JWT tokens using custom functions
        access_token = create_access_token(phone_number, role)
        refresh_token = create_refresh_token(phone_number, role)

        return Response({
            "message": "OTP verified successfully! User is now active.",
            "access": access_token,
            "refresh": refresh_token
        }, status=status.HTTP_200_OK)

    except PyMongoError as e:
        print(f"Error updating user verification status: {e}")
        return Response({"error": "Internal server error during verification."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'PUT'])
def user_details(request):
    """
    API to get or update user details after validating JWT tokens.
    """

    access_token = get_access_token_from_request(request)

    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)

    # Call validate_token with only the access token (no refresh token)
    validation_result = validate_token(access_token)

    if validation_result is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    # validation_result is the decoded payload (or user details, if your validate_token returns that)
    # Assuming it returns payload with 'user_id' or 'phone_number'
    # Adjust this depending on what validate_token returns

    user_id = validation_result
    if not user_id:
        return Response({"error": "Invalid token payload"}, status=status.HTTP_401_UNAUTHORIZED)

    user = user_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        user_data = {
            "email": user.get("email"),
            "is_email_verified": user.get("is_email_verified", False),
            "phone_number": user.get("phone_number"),
            "gender": user.get("gender"),
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
            "birthday": user.get("birthday"),
            "customer_id": user.get("customer_id"),
            "lane_1": user.get("lane_1"),
            "lane_2": user.get("lane_2"),
            "city": user.get("city"),
            "postal_code": user.get("postal_code"),
        }
        return Response(user_data, status=status.HTTP_200_OK)

    elif request.method == 'PUT':
        data = request.data
        update_fields = {}

        if "email" in data and data["email"] != user.get("email"):
            otp_code = str(random.randint(100000, 999999))
            local_time = datetime.datetime.now(tz)
            now = local_time.astimezone(utc_timezone)
            otp_expiry = now + datetime.timedelta(minutes=10)

            update_fields["email"] = data["email"]
            update_fields["email_otp_code"] = otp_code
            update_fields["email_otp_expires_at"] = otp_expiry
            update_fields["is_email_verified"] = False
            # Trigger email OTP externally if needed

        for field in ["first_name", "last_name", "gender", "birthday", "customer_id", "lane_1", "lane_2", "city", "postal_code"]:
            if field in data:
                update_fields[field] = data[field]

        if update_fields:
            user_collection.update_one({"_id": ObjectId(user_id)}, {
                                       "$set": update_fields}, upsert=True)

        return Response({"message": "User details updated successfully!"}, status=status.HTTP_200_OK)


ALLOWED_PATCH_FIELDS = {
    "first_name", "last_name", "gender", "birthday", "customer_id",
    "lane_1", "lane_2", "city", "postal_code", "phone_number", "email"
}
BLOCKED_FIELDS = {
    "_id", "password", "is_admin", "roles", "permissions",
    "is_email_verified", "email_otp_code", "email_otp_expires_at"
}


@api_view(["PATCH"])
def user_partial_update(request):
    """
    Partially update user profile fields.

    Request JSON (any subset):
    {
      "email": "new@mail.com",
      "first_name": "Alice",
      "last_name": "Doe",
      "gender": "female",
      "birthday": "1992-05-17",
      "customer_id": "cus_123",
      "lane_1": "123 Main",
      "lane_2": "Apt 4",
      "city": "Colombo",
      "postal_code": "10000",
      "phone_number": "+94123456789"
    }

    Response: 200 + updated fields snapshot
    """
    # — Auth —
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)

    validation_result = validate_token(access_token)
    if validation_result is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    user_id = validation_result
    user = user_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    data = request.data or {}
    if not isinstance(data, dict) or not data:
        return Response({"detail": "Provide at least one field to update"}, status=status.HTTP_400_BAD_REQUEST)

    # — Guard against forbidden fields —
    forbidden = [k for k in data.keys() if k in BLOCKED_FIELDS]
    if forbidden:
        return Response(
            {"detail": f"These fields cannot be modified: {', '.join(forbidden)}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # — Keep only allowed fields —
    unknown = [k for k in data.keys() if k not in ALLOWED_PATCH_FIELDS]
    if unknown:
        return Response(
            {"detail": f"Unknown/unsupported fields: {', '.join(unknown)}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # — Build update payload —
    update_fields = {}
    tz_local = pytz.timezone("Asia/Colombo")
    now_utc = datetime.datetime.now(tz_local).astimezone(pytz.UTC)

    # Email flow (OTP + reset verification) if changed
    if "email" in data:
        new_email = data["email"]
        if new_email != user.get("email"):
            otp_code = str(random.randint(100000, 999999))
            otp_expiry = now_utc + datetime.timedelta(minutes=10)
            update_fields.update({
                "email": new_email,
                "email_otp_code": otp_code,
                "email_otp_expires_at": otp_expiry,
                "is_email_verified": False
            })
        # if same email as current, ignore silently

    # Other fields (partial)
    for field in ALLOWED_PATCH_FIELDS - {"email"}:
        if field in data:
            update_fields[field] = data[field]

    if not update_fields:
        return Response({"detail": "No changes detected"}, status=status.HTTP_200_OK)

    # — Persist —
    user_collection.update_one({"_id": ObjectId(user_id)}, {
                               "$set": update_fields}, upsert=False)

    # — Return fresh snapshot (omit sensitive/OTP fields) —
    updated = user_collection.find_one({"_id": ObjectId(user_id)})
    resp = {
        "email": updated.get("email"),
        "is_email_verified": updated.get("is_email_verified", False),
        "phone_number": updated.get("phone_number"),
        "gender": updated.get("gender"),
        "first_name": updated.get("first_name"),
        "last_name": updated.get("last_name"),
        "birthday": updated.get("birthday"),
        "customer_id": updated.get("customer_id"),
        "lane_1": updated.get("lane_1"),
        "lane_2": updated.get("lane_2"),
        "city": updated.get("city"),
        "postal_code": updated.get("postal_code"),
        # Optionally include a hint if an email OTP was issued
        "email_verification_pending": (
            ("email" in data) and (data.get("email") != user.get("email"))
        )
    }
    return Response(resp, status=status.HTTP_200_OK)


@api_view(['POST'])
def verify_email_otp(request):
    """
    Verify the email using OTP sent to the user's email.
    """

    # Extract the access token from request
    access_token = get_access_token_from_request(request)

    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)

    # Validate the access token
    validation_result = validate_token(access_token)

    if validation_result is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    # Extract the user data from the validated token
    user_id = validation_result
    local_time = datetime.datetime.now(tz)
    now = local_time.astimezone(utc_timezone)

    if not user_id:
        return Response({"error": "Invalid token payload"}, status=status.HTTP_401_UNAUTHORIZED)

    # Lookup the user by phone number in MongoDB
    user = user_collection.find_one({"_id": ObjectId(user_id)})

    if not user:
        return Response({"error": "User with this phone number not found."}, status=status.HTTP_404_NOT_FOUND)

    # Check if OTP is valid
    otp_code = request.data.get("otp_code")
    if not otp_code:
        return Response({"error": "OTP is required."}, status=status.HTTP_400_BAD_REQUEST)

    if user.get('email_otp_code') != otp_code:
        return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

    # Check if the OTP has expired
    if now.replace(tzinfo=None) > user.get('email_otp_expires_at').replace(tzinfo=None):
        return Response({"error": "OTP expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)

    # Update the user's email verification status and clear OTP fields

    with client.start_session() as session:
        try:
            with session.start_transaction():

                update_result = user_collection.update_one(
                    {"_id": ObjectId(user_id)},
                    {
                        "$set": {
                            "is_email_verified": True,
                            "email_otp_code": None,  # Clear the OTP after successful verification
                            "email_otp_expires_at": None  # Clear the expiration time
                        }
                    }, session=session
                )

            if update_result.modified_count == 0:
                return Response({"error": "Failed to update email verification status."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({"message": "Email verified successfully!"}, status=status.HTTP_200_OK)

        except PyMongoError as e:
            print(f"Transaction aborted due to error: {e}")


def _is_empty(v):
    """True if value is None or an empty/whitespace-only string."""
    return v is None or (isinstance(v, str) and v.strip() == "")


@api_view(["POST"])
def validate_seats_empty_points(request):
    """
    Input JSON:
    {
      "trip_id": "<mongo_id>",
      "seat_numbers": [1,2,3]  # REQUIRED: JSON array of integers
    }

    Rule:
      - Respond "ok" only if, for ALL requested seats, BOTH start_point and end_point are empty/null.
      - If ANY requested seat has a value in start_point or end_point, respond "seats are booked".
    """
    data = request.data or {}
    trip_id = data.get("trip_id")
    seat_numbers = data.get("seat_numbers")

    if not trip_id:
        return Response({"detail": "trip_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Strictly require a JSON array like [1,2,3]
    if not isinstance(seat_numbers, list) or not seat_numbers:
        return Response(
            {"detail": "seat_numbers must be a non-empty JSON array, e.g. [1,2,3]"},
            status=status.HTTP_400_BAD_REQUEST
        )
    try:
        seat_numbers = [int(x) for x in seat_numbers]
    except (TypeError, ValueError):
        return Response(
            {"detail": "seat_numbers must contain only integers"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Fetch trip with bookings
    try:
        trip = bustrips_collection.find_one(
            {"_id": ObjectId(trip_id)}, {"bookings": 1, "_id": 0})
    except Exception as e:
        return Response({"detail": f"Invalid trip_id format: {e}"}, status=status.HTTP_400_BAD_REQUEST)

    if not trip:
        return Response({"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

    bookings = trip.get("bookings") or []
    seat_map = {b.get("seat_number")                : b for b in bookings if "seat_number" in b}

    # Ensure all seats exist for the trip
    missing = [s for s in seat_numbers if s not in seat_map]
    if missing:
        return Response(
            {"detail": "One or more seats not found on this trip",
                "missing_seats": missing},
            status=status.HTTP_404_NOT_FOUND
        )

    # Any seat with a value in start_point OR end_point counts as "booked"
    booked_seats = []
    for s in seat_numbers:
        seat_doc = seat_map[s]
        sp = seat_doc.get("start_point")
        ep = seat_doc.get("end_point")
        if not (_is_empty(sp) and _is_empty(ep)):
            booked_seats.append(s)

    if booked_seats:
        return Response(
            {"detail": "seats are booked", "booked_seats": booked_seats},
            status=status.HTTP_409_CONFLICT
        )

    return Response({"detail": "ok"}, status=status.HTTP_200_OK)


@api_view(["POST"])
def initialize_booking(request):
    """
    1) Inserts the booking doc into bookings_collection (with qr_code_base64=None)
    2) Generates a QR code and updates that same booking doc
    """
    data = request.data
    required_fields = [
        "trip_id", "trip_start_time", "start_point_id", "end_point_id",
        "bus_name", "bus_number", "bus_id", "fee", "seat_number", "transaction_id"
    ]
    missing = [f for f in required_fields if f not in data]
    if missing:
        return Response(
            {"detail": f"Missing required fields: {', '.join(missing)}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # — Authenticate & resolve user —
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)
    user_id = validate_token(access_token)
    if not user_id:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    user = user_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    # — Parse & validate numeric and point IDs —
    try:
        fee = float(data["fee"])
    except ValueError:
        return Response({"detail": "Fee must be a number"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        start_pt = boarding_points_collection.find_one(
            {"_id": ObjectId(data["start_point_id"])})
        end_pt = boarding_points_collection.find_one(
            {"_id": ObjectId(data["end_point_id"])})
    except Exception as e:
        return Response({"error": f"Invalid ID format: {e}"}, status=status.HTTP_400_BAD_REQUEST)

    if not start_pt or not end_pt:
        return Response({"error": "One or both boarding points not found."}, status=status.HTTP_404_NOT_FOUND)

    # — Build booking document —
    tz_colombo = pytz.timezone("Asia/Colombo")
    now_utc = datetime.datetime.now(tz_colombo).astimezone(pytz.UTC)
    commission = round(fee * 0.07, 2)
    total_price = round(fee + commission, 2)

    dt = parser.isoparse(data["trip_start_time"])
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    dt = dt.astimezone(pytz.UTC)

    booking_doc = {
        "trip_id": data["trip_id"],
        "trip_start_time": dt,
        "start_point_id": data["start_point_id"],
        "start_point": start_pt["name"],
        "end_point_id": data["end_point_id"],
        "end_point": end_pt["name"],
        "bus_name": data["bus_name"],
        "bus_number": data["bus_number"],
        "user_name": user.get("first_name"),
        "bus_id": data["bus_id"],
        "transaction_id": data["transaction_id"],
        "fee": fee,
        "commission": commission,
        "total_price": total_price,
        "seat_number": data["seat_number"],
        "user_id": user_id,
        "status": "Pending",
        "booked_at": now_utc,
        "qr_code_base64": None,  # placeholder
    }

    # — 1) Insert booking doc —
    try:
        res = bookings_collection.insert_one(booking_doc)
        booking_id = res.inserted_id
    except Exception as e:
        return Response({"detail": f"DB insert error: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        trip_update = bustrips_collection.update_one(
            {
                "_id": ObjectId(data["trip_id"]),
                "bookings.seat_number": int(data["seat_number"])
            },
            {
                "$set": {
                    "bookings.$.start_point": start_pt["name"],
                    "bookings.$.end_point": end_pt["name"]
                }
            }
        )
        if trip_update.matched_count == 0:
            return Response(
                {"detail": "Trip or seat not found (or already booked)"},
                status=status.HTTP_404_NOT_FOUND
            )
    except Exception as e:
        return Response(
            {"detail": f"Failed to update bus trip: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    # — 2) Generate & save QR code in the same booking —
    qr_payload = {
        "booking_id": str(booking_id),
        "user_id": user_id
    }
    qr_data = json.dumps(qr_payload)
    qr_b64 = generate_qr_code_base64(qr_data)

    try:
        bookings_collection.update_one(
            {"_id": booking_id},
            {"$set": {"qr_code_base64": qr_b64}}
        )
    except Exception as e:
        return Response({"detail": f"Failed to save QR code: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # — Prepare response —
    booking_doc["_id"] = str(booking_id)
    booking_doc["qr_code_base64"] = qr_b64
    booking_doc["booked_at"] = booking_doc["booked_at"].isoformat() + "Z"
    return Response(booking_doc, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def create_booking(request):
    """
    Confirms a booking by transaction_id:
      - Finds the pre-initialized booking in bookings_collection
      - Updates bus_trips_collection (increments seats & revenue, marks seat booked)
      - Updates user_collection (adds booking to user.bookings)
    Sample POST:
    {
        "transaction_id": "abc123xyz",
        "customer_id": "ef47ffbeufjeeif9gguefue"
    }
    """
    data = request.data
    if "transaction_id" not in data:
        return Response(
            {"detail": "Missing required field: transaction_id"},
            status=status.HTTP_400_BAD_REQUEST
        )
    txn_id = data["transaction_id"]

    if "customer_id" not in data:
        return Response(
            {"detail": "Missing required field: customer_id"},
            status=status.HTTP_400_BAD_REQUEST
        )
    customer_id = str(data["customer_id"])

    # 1) Look up the booking
    booking = bookings_collection.find_one({"transaction_id": txn_id})
    if not booking:
        print(txn_id)
        return Response(
            {"detail": "Booking not found for transaction_id"},
            status=status.HTTP_404_NOT_FOUND
        )
    if booking.get("status") != "Pending":
        return Response(
            {"detail": "Booking already confirmed"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Extract needed fields
    try:
        trip_id = booking["trip_id"]
        seat_num = int(booking["seat_number"])
        fee = float(booking["fee"])
        user_id = booking["user_id"]
        start_pt = booking.get("start_point")
        end_pt = booking.get("end_point")
    except (KeyError, ValueError) as e:
        return Response(
            {"detail": f"Malformed booking document: {e}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # 2) Update the bus_trips_collection
    try:
        trip_update = bustrips_collection.update_one(
            {
                "_id": ObjectId(trip_id),
                "bookings.seat_number": seat_num,
                "bookings.booked": False  # prevent double-booking
            },
            {
                "$inc": {"booked_seats": 1, "booked_revenue": fee},
                "$set": {
                    "bookings.$.booked": True,
                    "bookings.$.start_point": start_pt,
                    "bookings.$.end_point": end_pt
                }
            }
        )
        if trip_update.matched_count == 0:
            # send ERROR notification for booked/invalid seat
            try:
                requests.post(
                    NOTIFICATION_URL,
                    json={"user_id": str(user_id),
                          "notification_category": "ERROR"},
                    timeout=5
                )
            except Exception as ex:
                print(f"Error sending ERROR notification: {ex}")
            return Response(
                {"detail": "Trip or seat not found (or already booked)"},
                status=status.HTTP_404_NOT_FOUND
            )
    except Exception as e:
        # send ERROR notification on failure
        try:
            requests.post(
                NOTIFICATION_URL,
                json={"user_id": str(user_id),
                      "notification_category": "ERROR"},
                timeout=5
            )
        except Exception as ex:
            print(f"Error sending ERROR notification: {ex}")
        return Response(
            {"detail": f"Failed to update bus trip: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # 3) Update the user_collection and booking status
    user_doc = user_collection.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        return Response(
            {"detail": "User not found."},
            status=status.HTTP_404_NOT_FOUND
        )
    if "customer_id" in user_doc and user_doc["customer_id"] != customer_id:
        return Response(
            {"detail": "Customer ID does not match."},
            status=status.HTTP_400_BAD_REQUEST
        )

    update_ops = {"$addToSet": {"bookings": booking["_id"]}}
    if "customer_id" not in user_doc:
        update_ops["$set"] = {"customer_id": customer_id}
    try:
        user_collection.update_one({"_id": ObjectId(user_id)}, update_ops)
        bookings_collection.update_one(
            {"_id": booking["_id"]},
            {"$set": {"status": "Booked"}}
        )
    except Exception as e:
        return Response(
            {"detail": f"Failed to update user document: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # 4) Signal success and send BOOKED notification
    print("Transaction successful")
    try:
        requests.post(
            NOTIFICATION_URL,
            json={"user_id": str(user_id), "notification_category": "BOOKED"},
            timeout=5
        )
    except Exception as e:
        print(f"Error sending booking notification: {e}")

    return Response(
        {"detail": "Transaction successful"},
        status=status.HTTP_200_OK
    )


@api_view(["POST"])
def reschedule_booking(request):
    """
    Reschedules an existing booking by reversing its effects and creating a new one.

    Expected POST data:
    {
      "old_booking_id": "<existing_booking_id>",
      "trip_id": "...",
      "trip_start_time": "2025-06-12T01:17",
      "start_point_id": "6831f26c680ae286f254ce03",
      "end_point_id": "6831f26c680ae286f254ce03",
      "bus_name": "Dumindu Express",
      "bus_number": "NB - 842B",
      "bus_id" : "6831f26c680ae286f254ce03",
      "fee": 724,
      "seat_number": "4"
    }
    """
    data = request.data
    required_fields = [
        "old_booking_id", "trip_id", "trip_start_time", "start_point_id", "end_point_id",
        "bus_name", "bus_number", "bus_id", "fee", "seat_number"
    ]
    missing = [f for f in required_fields if f not in data]
    if missing:
        return Response({"detail": f"Missing required fields: {', '.join(missing)}"},
                        status=status.HTTP_400_BAD_REQUEST)

    # Authenticate user
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)
    validation = validate_token(access_token)
    if validation is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)
    user_id = validation

    user = user_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    # Reverse old booking
    try:
        old_booking = bookings_collection.find_one({
            "_id": ObjectId(data["old_booking_id"]),
            "user_id": user_id
        })
        if not old_booking:
            return Response({"detail": "Original booking not found."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"detail": f"Error fetching old booking: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    start_point_id = data["start_point_id"]
    end_point_id = data["end_point_id"]

    try:
        start_point_obj = boarding_points_collection.find_one(
            {'_id': ObjectId(start_point_id)})
        end_point_obj = boarding_points_collection.find_one(
            {'_id': ObjectId(end_point_id)})
    except Exception as e:
        return Response(
            {'error': f'Invalid ID format: {e}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not start_point_obj or not end_point_obj:
        return Response(
            {'error': 'One or both points not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if old_booking["user_id"] != user_id:
        return Response(
            {"detail": "You can only reschedule your own bookings."},
            status=status.HTTP_403_FORBIDDEN
        )

    # Revert bus trip seat and revenue
    try:
        old_trip_id = old_booking["trip_id"]
        old_seat = int(old_booking["seat_number"])
        old_fee = float(old_booking["fee"])

        reverse_update = bustrips_collection.update_one(
            {"_id": ObjectId(old_trip_id), "bookings.seat_number": old_seat},
            {
                "$inc": {"booked_seats": -1, "booked_revenue": -old_fee},
                "$set": {"bookings.$.booked": False,
                         "bookings.$.start_point": "",
                         "bookings.$.end_point": ""}
            }
        )
        if reverse_update.matched_count == 0:
            return Response({"detail": "Failed to revert bus trip booking info."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"detail": f"Error updating bus trip: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Remove booking reference from user
    try:
        user_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$pull": {"bookings": ObjectId(data["old_booking_id"])}}
        )
    except Exception as e:
        return Response({"detail": f"Error updating user bookings: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Delete old booking document
    try:
        bookings_collection.delete_one(
            {"_id": ObjectId(data["old_booking_id"])})
    except Exception as e:
        return Response({"detail": f"Error deleting old booking: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Now proceed to create the new booking (same as create_booking)
    try:
        fee = float(data["fee"])
    except ValueError:
        return Response({"detail": "Fee must be a number"}, status=status.HTTP_400_BAD_REQUEST)

    now_local = datetime.datetime.now(tz)
    now_utc = now_local.astimezone(utc_timezone)
    commission = round(fee * 0.07, 2)
    total_price = round(fee + commission, 2)

    # Parse trip_start_time
    dt = parser.isoparse(data['trip_start_time'])
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=utc_timezone)
    else:
        dt = dt.astimezone(utc_timezone)

    new_booking = {
        "trip_id": data["trip_id"],
        "trip_start_time": dt,
        "start_point_id": data["start_point_id"],
        "start_point": start_point_obj.get('name'),
        "end_point_id": data["end_point_id"],
        "end_point": end_point_obj.get('name'),
        "bus_name": data["bus_name"],
        "bus_number": data["bus_number"],
        "bus_id": data["bus_id"],
        "user_name": user.get("first_name"),
        "fee": fee,
        "commission": commission,
        "total_price": total_price,
        "seat_number": data["seat_number"],
        "user_id": user_id,
        "status": "Rescedule_1",
        "booked_at": now_utc,
        "qr_code_base64": None,
    }

    try:
        insert_res = bookings_collection.insert_one(new_booking)
        new_id = insert_res.inserted_id
    except Exception as e:
        return Response({"detail": f"Error creating new booking: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Generate and save QR code
    qr_content = f'{{"booking_id":"{str(new_id)}","user_id":"{user_id}"}}'
    qr_b64 = generate_qr_code_base64(qr_content)
    bookings_collection.update_one(
        {"_id": new_id}, {"$set": {"qr_code_base64": qr_b64}})

    # Update new trip info
    try:
        seat_num = int(data["seat_number"])
        trip_update = bustrips_collection.update_one(
            {"_id": ObjectId(data["trip_id"]),
             "bookings.seat_number": seat_num},
            {
                "$inc": {"booked_seats": 1, "booked_revenue": fee},
                "$set": {"bookings.$.booked": True,
                         "bookings.$.start_point": start_point_obj.get('name'),
                         "bookings.$.end_point": end_point_obj.get('name')}
            }
        )
        if trip_update.matched_count == 0:
            return Response({"detail": "Failed to book seat on new trip."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"detail": f"Error updating new trip: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Update user bookings
    try:
        user_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$addToSet": {"bookings": new_id}}
        )
    except Exception as e:
        return Response({"detail": f"Error adding new booking to user: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Prepare response
    new_booking["_id"] = str(new_id)
    new_booking["qr_code_base64"] = qr_b64
    new_booking["booked_at"] = now_utc.isoformat() + "Z"

    return Response(new_booking, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def cancel_booking(request):
    """
    Cancels an existing booking by reverting its effects on the bus trip
    and updating the booking status to 'Booking_canceled'.

    Expected POST data:
    {
        "booking_id": "<existing_booking_id>"
    }
    """
    data = request.data
    if "booking_id" not in data:
        return Response({"detail": "Missing required field: booking_id"}, status=status.HTTP_400_BAD_REQUEST)

    # Authenticate user
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)
    validation = validate_token(access_token)
    if validation is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)
    user_id = validation

    # Fetch booking
    try:
        booking = bookings_collection.find_one({
            "_id": ObjectId(data["booking_id"]),
            "user_id": user_id
        })
        if not booking:
            return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"detail": f"Error fetching booking: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Revert bus trip seat and revenue
    try:
        trip_id = booking["trip_id"]
        seat_num = int(booking["seat_number"])
        fee = float(booking["fee"])
        revert_result = bustrips_collection.update_one(
            {"_id": ObjectId(trip_id), "bookings.seat_number": seat_num},
            {
                "$inc": {"booked_seats": -1, "booked_revenue": -fee},
                "$set": {
                    "bookings.$.booked": False,
                    "bookings.$.start_point": "",
                    "bookings.$.end_point": ""
                }
            }
        )
        if revert_result.matched_count == 0:
            return Response({"detail": "Failed to revert bus trip booking info."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"detail": f"Error updating bus trip: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    refund_amount = round(fee * 0.85, 2)

    # Update booking status
    try:
        bookings_collection.update_one(
            {"_id": ObjectId(data["booking_id"])},
            {"$set": {
                "status":         "Canceled_by_user",
                "refund_amount": refund_amount,
                "refund_resolved": False
            }}
        )
    except Exception as e:
        return Response({"detail": f"Error updating booking status: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"booking_id": data["booking_id"], "status": "Booking_canceled"}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_card_info(request):

    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)
    validation = validate_token(access_token)
    if validation is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)
    user_id = validation

    # 3) Look up the user document
    try:
        user_doc = user_collection.find_one({'_id': ObjectId(user_id)})
    except Exception:
        return Response(
            {'detail': 'Error querying user.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    if not user_doc:
        return Response(
            {'detail': 'User not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # 4) Return the payments array
    payments = user_doc.get('payments', [])
    return Response(payments, status=status.HTTP_200_OK)


@api_view(['GET'])
def find_route_by_points(request):
    start_point_id = request.GET.get('start_point_id')
    end_point_id = request.GET.get('end_point_id')

    start_point_doc = boarding_points_collection.find_one(
        {"_id": ObjectId(start_point_id)})
    end_point_doc = boarding_points_collection.find_one(
        {"_id": ObjectId(end_point_id)})

    start_point = start_point_doc.get('name')
    end_point = end_point_doc.get('name')

    if not start_point_id or not end_point_id:
        return Response(
            {"error": "start_point_id and end_point_id are required"},
            status=400
        )

    # 1) Gather ALL matching route_ids first
    matching_route_ids = []
    for route in routes_collection.find({}):
        sections = route.get('sections', [])
        start_sec = end_sec = None

        for section in sections:
            try:
                sec_num = int(section.get('section_name', '').split()[-1])
            except ValueError:
                continue

            for bp in section.get('boarding_points', []):
                if bp.get('boarding_id') == start_point_id:
                    start_sec = sec_num
                if bp.get('boarding_id') == end_point_id:
                    end_sec = sec_num

        if start_sec is not None and end_sec is not None and start_sec < end_sec:
            matching_route_ids.append(str(route['_id']))

    if not matching_route_ids:
        return Response(
            {"error": "No route found matching the criteria"},
            status=404
        )

    # 2) Compute the “now  30 minutes” threshold
    local_time = datetime.datetime.now(tz)
    now_utc = local_time.astimezone(utc_timezone)

    threshold = now_utc + datetime.timedelta(minutes=30)

    # 3) Query for any upcoming trips on **any** of those routes
    cursor = bustrips_collection.find({
        "route_id":      {"$in": matching_route_ids},
        "trip_start_time": {"$gt": threshold}
    })

    # 4) Serialize results
    upcoming_trips = []
    for trip in cursor:
        trip['_id'] = str(trip['_id'])
        upcoming_trips.append(trip)

    return Response({"start_point": start_point,
                     "end_point": end_point,
                     "trips": upcoming_trips,
                     "routes": matching_route_ids})


@api_view(['GET'])
def list_routes(request, page):
    # 1) Validate page
    try:
        page = int(page)
        if page < 1:
            raise ValueError
    except (ValueError, TypeError):
        return Response(
            {"error": "Invalid page number"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 2) Count & compute total pages
    PAGE_SIZE = 5
    total_routes = routes_collection.count_documents({})
    total_pages = math.ceil(total_routes / PAGE_SIZE) if total_routes else 0

    # 3) Out-of-range?
    if page > total_pages and total_pages != 0:
        return Response(
            {"error": "Page out of range", "total_pages": total_pages},
            status=status.HTTP_404_NOT_FOUND
        )

    # 4) Fetch this page’s slice
    skip = (page - 1) * PAGE_SIZE
    cursor = routes_collection.find().skip(skip).limit(PAGE_SIZE)

    # 5) Clean & serialize
    routes = []
    for doc in cursor:
        # convert ObjectId to string
        doc['id'] = str(doc['_id'])
        doc.pop('_id', None)

        # strip unwanted fields from each boarding point
        for section in doc.get('sections', []):
            cleaned_bps = []
            for bp in section.get('boarding_points', []):
                cleaned_bps.append({
                    "boarding_id": bp.get("boarding_id"),
                    "point_name": bp.get("point_name")
                })
            section['boarding_points'] = cleaned_bps

        routes.append(doc)

    # 6) Return paginated response
    return Response({
        "routes":       routes,
        "total_pages":  total_pages,
        "current_page": page
    })


@api_view(['GET'])
def get_bus_trip(request):
    trip_id = request.GET.get('id')
    if not trip_id:
        return Response({"error": "id query parameter is required"}, status=400)

    try:
        obj_id = ObjectId(trip_id)
    except Exception:
        return Response({"error": "Invalid trip id"}, status=400)

    trip = bustrips_collection.find_one({"_id": obj_id})
    if not trip:
        return Response({"error": "Bus trip not found"}, status=404)

    # Convert ObjectId to string for JSON serialization
    trip['_id'] = str(trip['_id'])

    return Response(trip)


@api_view(['GET'])
def passenger_update(request):
    """
    URL: /api/check_update/<app_id>/?current_app_version=1.2.3
    """

    app_id = "6845824ec19319db58d72fd4"
    user_version_str = request.GET.get('current_app_version')
    if not user_version_str:
        return Response(
            {"error": "current_app_version parameter is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Parse ObjectId
    try:
        obj_id = ObjectId(app_id)
    except InvalidId:
        return Response(
            {"error": "Invalid app_id format"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Fetch from Mongo
    app_doc = app_version_collection.find_one({"_id": obj_id})
    if not app_doc:
        return Response(
            {"error": "App version info not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    db_version_str = app_doc.get("app_version")
    update_url = app_doc.get("update_url")
    if not db_version_str:
        return Response(
            {"error": "No app_version field in document"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Use a robust semver parser
    try:
        user_version = Version(user_version_str)
        db_version = Version(db_version_str)
    except InvalidVersion:
        return Response(
            {"error": "Version strings must be valid semantic versions"},
            status=status.HTTP_400_BAD_REQUEST
        )

    update_required = user_version < db_version

    return Response({
        "update_required": update_required,
        "latest_version": str(db_version),
        "update_url": update_url
    })


@api_view(['GET'])
def search_boarding_points(request):
    q = request.GET.get('q', '').strip()
    if not q:
        return Response({"error": "q (query) parameter is required"}, status=400)

    # build our two regexes
    prefix_re = re.compile(rf'^{re.escape(q)}', re.IGNORECASE)
    contains_re = re.compile(re.escape(q),      re.IGNORECASE)

    # 1) prefix matches
    prefix_cursor = boarding_points_collection.find({
        'name': {'$regex': prefix_re}
    })

    # collect prefix docs and track their IDs
    results = []
    seen_ids = set()
    for doc in prefix_cursor:
        doc['_id'] = str(doc['_id'])
        results.append(doc)
        seen_ids.add(doc['_id'])

    # 2) all‐over substring matches
    substr_cursor = boarding_points_collection.find({
        'name': {'$regex': contains_re}
    })

    # only keep those we didn’t already add
    for doc in substr_cursor:
        sid = str(doc['_id'])
        if sid in seen_ids:
            continue
        doc['_id'] = sid
        results.append(doc)

    return Response(results)


@api_view(['GET'])
def get_ongoing_bookings(request):
    access_token = get_access_token_from_request(request)

    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)

    # Validate the access token
    validation_result = validate_token(access_token)

    if validation_result is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    # Extract the user data from the validated token
    user_id = validation_result
    if not user_id:
        return Response({'error': 'user_id is required'}, status=400)
    try:
        uid = ObjectId(user_id)
    except Exception:
        return Response({'error': 'invalid user_id'}, status=400)

    # 2) Pull the user's bookings array (only that field)
    user_doc = user_collection.find_one({'_id': uid}, {'bookings': 1})
    bookings_list = user_doc.get('bookings', [])
    if not user_doc or not user_doc.get('bookings'):
        return Response({'bookings': []})

    # 3) Slice off the last five booking‐IDs
    last_five_ids = user_doc['bookings'][-5:]
    if not last_five_ids:
        return Response({'bookings': []})

    # 4) Fetch those five booking documents in one go
    raw_cursor = bookings_collection.find(
        {'_id': {'$in': last_five_ids}})
    # build a map so we can re-order them
    bookings_map = {b['_id']: b for b in raw_cursor}

    local_time = datetime.datetime.now(tz)
    now = local_time.astimezone(utc_timezone)
    out = []

    # 5) Re-iterate in the original order, filter by trip_start_time < now
    for bid in last_five_ids:
        b = bookings_map.get(bid)
        if not b:
            continue
        if b.get('status') != 'Booked':
            continue

        # trip_start_time is a Python datetime (BSON Date) with tzinfo
        trip_dt = b.get('trip_start_time')

        if trip_dt.replace(tzinfo=None) > now.replace(tzinfo=None):
            # convert any ObjectIds to strings before sending JSON
            b['_id'] = str(b['_id'])
            b['user_id'] = str(b['user_id'])
            b['trip_id'] = str(b['trip_id'])
            b['trip_start_time'] = trip_dt.isoformat()
            out.append(b)

    debug = {
        'all_bookings_from_user_doc': [str(x) for x in bookings_list],
        'last_five_ids': [str(x) for x in last_five_ids],
        'bookings_map_keys': [str(x) for x in bookings_map.keys()],
        'now_utc': now.isoformat(),
        'final_output_count': len(out),
    }

    return Response({'bookings': out,
                     'debug': debug})


@api_view(['GET'])
def booking_history(request):
    """
    GET params:
        user_id=<the user’s ObjectId string>
    Returns JSON with three lists: upcoming, completed, failed.
    """
    # 1) Validate user_id
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"},
                        status=status.HTTP_401_UNAUTHORIZED)

    # Validate the access token
    validation_result = validate_token(access_token)

    if validation_result is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    # Extract the user data from the validated token
    user_id = validation_result

    if not user_id:
        return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        uid = ObjectId(user_id)
    except Exception:
        return Response({'error': 'invalid user_id format'}, status=status.HTTP_400_BAD_REQUEST)

    # 2) Get the user’s bookings array
    user = user_collection.find_one({'_id': uid}, {'bookings': 1})
    if not user or not user.get('bookings'):
        return Response({'upcoming': [], 'completed': [], 'failed': []})

    booking_ids = user['bookings']  # assume these are ObjectId instances

    # 3) Fetch all those booking docs at once
    raw = bookings_collection.find({'_id': {'$in': booking_ids}})
    now_utc = datetime.datetime.now(pytz.UTC)
    cutoff = now_utc - datetime.timedelta(days=1)

    upcoming, completed, failed = [], [], []

    # 4) Categorize
    for b in raw:
        booking_status = b.get('status', '')
        trip_dt = b.get('trip_start_time')

        # ensure we have a datetime with tzinfo
        if isinstance(trip_dt, str):
            # e.g. "2025-06-08T14:15:46.73200:00"
            trip_dt = datetime.datetime.fromisoformat(trip_dt)

        # Completed
        if booking_status in ("Completed", "Verified"):
            completed.append(b)

        # Booked / Rescheduled_1 / Bus_trip_canceled
        elif booking_status in ("Booked", "Rescheduled_1", "Bus_trip_canceled"):
            if trip_dt.replace(tzinfo=None) < cutoff.replace(tzinfo=None):
                # it “should have left” more than a day ago → mark failed
                failed.append(b)
            else:
                upcoming.append(b)

        # Explicitly canceled bookings always go straight to failed
        elif booking_status == "Canceled_by_user":
            failed.append(b)

        # (Optional) any other statuses you might put in upcoming by default
        else:
            upcoming.append(b)

    # 5) Stringify ObjectIds & return
    def serialize(doc):
        doc['_id'] = str(doc['_id'])
        doc['user_id'] = str(doc.get('user_id', ''))
        doc['trip_id'] = str(doc.get('trip_id', ''))
        return doc

    return Response({
        'upcoming': [serialize(x) for x in upcoming],
        'completed': [serialize(x) for x in completed],
        'failed':    [serialize(x) for x in failed],
    })

################## Notifications ####################################################################################################################################################


@api_view(['POST'])
def register_FCM_token(request):
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"},
                        status=status.HTTP_401_UNAUTHORIZED)

    # Validate the access token
    validation_result = validate_token(access_token)
    if validation_result is None:
        return Response({"error": "Invalid or expired access token"},
                        status=status.HTTP_401_UNAUTHORIZED)

    # Use the validated user_id as the document _id
    user_id = validation_result

    token = request.data.get('token')
    local_time = datetime.datetime.now(tz)
    now_utc = local_time.astimezone(utc_timezone)

    if not token:
        return Response({'error': 'no token provided'}, status=400)

    # Upsert by _id: this makes user_id the primary key
    FCM_TOKEN_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {
            'fcm_token': token,
            'last_seen': now_utc
        }},
        upsert=True
    )
    return Response({'status': 'ok'})


@csrf_exempt
def genie_webhook(request):
    # 1) Only accept POST
    if request.method != "POST":
        return HttpResponse(status=405)  # Method Not Allowed

    # 2) Read raw body
    raw_body = request.body
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    # 3) Signature headers
    nonce = request.META.get("HTTP_X_SIGNATURE_NONCE", "")
    timestamp = request.META.get("HTTP_X_SIGNATURE_TIMESTAMP", "")
    signature = request.META.get("HTTP_X_SIGNATURE", "")

    # 4) Recompute signature and compare
    sign_string = f"{nonce}{timestamp}{settings.GENIE_API_KEY}".encode()
    computed_sig = hashlib.sha256(sign_string).hexdigest()
    if not hmac.compare_digest(computed_sig, signature):
        return HttpResponseForbidden("Invalid signature")

    # 5) PRINT the incoming webhook payload
    print("🔔 Received Genie webhook payload:")

    # ====== Begin additional logic ======

    event_type = payload.get("eventType")

    # Ignore if eventType is NOTIFY_TOKENISATION_STATUS
    if event_type == "NOTIFY_TOKENISATION_STATUS":
        if payload.get("tokenisationStatus") == "TOKENISATION_SUCCESS":
            customer_id = payload.get("customerId")
            if not customer_id:
                return HttpResponseBadRequest("Missing customerId")

            # 1) fetch all tokens for this customer
            token_url = f"https://api.geniebiz.lk/public-customers/{customer_id}/tokens"
            headers = {
                "Authorization": f"{settings.GENIE_API_KEY}"
            }
            try:
                resp = requests.get(token_url, headers=headers, timeout=10)
                resp.raise_for_status()
            except requests.RequestException as e:
                print("❌ Failed to fetch tokens:", e)
                return HttpResponse(status=502)

            data = resp.json()
            items = data.get("items", [])
            total_count = data.get("count", len(items))

            # 2) upsert into Mongo
            user = user_collection.find_one({"customer_id": customer_id})
            if not user:
                return HttpResponseBadRequest("User not found")

            # collect existing token IDs
            existing = {p["id"] for p in user.get("payments", [])}
            new_cards = []
            for itm in items:
                if itm["id"] in existing:
                    continue
                new_cards.append({
                    "authenticated":     itm["authenticated"],
                    "id":                itm["id"],
                    "token":             itm["token"],
                    "tokenType":         itm["tokenType"],
                    "provider":          itm["provider"],
                    "brand":             itm["brand"],
                    "paddedCardNumber":  itm["paddedCardNumber"],
                    "tokenExpiryMonth":  itm["tokenExpiryMonth"],
                    "tokenExpiryYear":   itm["tokenExpiryYear"],
                    "fundingType":       itm["fundingType"],
                })

            if new_cards:
                user_collection.update_one(
                    {"customer_id": customer_id},
                    {
                        "$push": {"payments": {"$each": new_cards}},
                        "$set":  {"number_of_cards": total_count}
                    }
                )
                return JsonResponse({
                    "status": f"Added {len(new_cards)} new card(s), total now {total_count}."
                }, status=200)
            else:
                # nothing new
                return JsonResponse({
                    "status": "All cards already saved.",
                    "total_cards": total_count
                }, status=200)

        # if status ≠ SUCCESS, just ignore
        print(payload)
        return JsonResponse({"status": "ignored tokenisation event"}, status=200)

    # Handle NOTIFY_TRANSACTION_CHANGE with state CONFIRMED
    if event_type == "NOTIFY_TRANSACTION_CHANGE":
        state = payload.get("state")
        if state == "CONFIRMED":
            transaction_id = payload.get("transactionId")
            customer_id = payload.get("customerId")

            if transaction_id and customer_id:
                post_url = "https://www.passenger.lk/members/create-booking/"
                post_data = {
                    "transaction_id": str(transaction_id),
                    "customer_id": str(customer_id)
                }
                try:
                    response = requests.post(
                        post_url, json=post_data, timeout=10)
                    print(f"✅ Booking POST status: {response.status_code}")
                    print(f"Response: {response.text}")
                    print(payload)
                    print(str(transaction_id), customer_id)
                except requests.RequestException as e:
                    print(f"❌ Failed to post booking: {e}")
                    print(str(transaction_id), customer_id)
                    print(payload)

    # ====== End additional logic ======

    # 6) Respond with the exact webhook body
    return JsonResponse(payload, status=200)


@api_view(['GET'])
def map_data(request, booking_id):
    """
    GET /api/bookings/<booking_id>/
    Headers: Authorization: Bearer <jwt>
    """

    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"},
                        status=status.HTTP_401_UNAUTHORIZED)

    # Validate the access token
    validation_result = validate_token(access_token)

    if validation_result is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    # Extract the user data from the validated token
    auth_user_id = validation_result

    if not auth_user_id:
        return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        uid = ObjectId(auth_user_id)
    except Exception:
        return Response({'error': 'invalid user_id format'}, status=status.HTTP_400_BAD_REQUEST)

    # —– fetch booking —–
    booking = bookings_collection.find_one({'_id': ObjectId(booking_id)})
    if not booking:
        return Response({'detail': 'Booking not found.'}, status=404)

    trip_id = booking.get('trip_id')
    start_point_id = booking.get('start_point_id')
    end_point_id = booking.get('end_point_id')
    seat_number = booking.get('seat_number')
    user_id = booking.get('user_id')

    if not auth_user_id:
        return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        auth_user_id = user_id
    except Exception:
        return Response({'error': "what the fuck are you doing here"}, status=status.HTTP_401_UNAUTHORIZED)

    # —– fetch trip —–
    trip = bustrips_collection.find_one({'_id': ObjectId(trip_id)})
    if not trip:
        return Response({'detail': 'Trip not found.'}, status=404)

    route_id = trip.get('route_id')
    route_name = trip.get('route_name')
    bus_name = trip.get('bus_name')
    bus_number = trip.get('bus_number')

    # —– fetch route —–
    route = routes_collection.find_one({'_id': ObjectId(route_id)})
    if not route:
        return Response({'detail': 'Route not found.'}, status=404)

    # —– pull out all the valid boarding-point coords, and locate start/end —–
    boarding_points = []
    start_coords = end_coords = None
    start_point_name = end_point_name = None

    for section in route.get('sections', []):
        for bp in section.get('boarding_points', []):
            lat, lon = bp.get('latitude'), bp.get('longitude')
            # drop placeholders
            if lat == 1 and lon == 1:
                continue

            pt = {
                'point_id':   bp.get('boarding_id'),
                'latitude':   lat,
                'longitude':  lon,
            }

            boarding_points.append(pt)

            if bp.get('boarding_id') == start_point_id:
                start_coords = {'latitude': lat, 'longitude': lon}
                start_point_name = bp.get('point_name')
            if bp.get('boarding_id') == end_point_id:
                end_coords = {'latitude': lat, 'longitude': lon}
                end_point_name = bp.get('point_name')

    # —– build response —–
    data = {
        'booking_id': booking_id,
        'user_id':    user_id,
        'seat_number': seat_number,
        'start_point': {
            'id':        start_point_id,
            'latitude':  start_coords and start_coords['latitude'],
            'longitude': start_coords and start_coords['longitude'],
            'name':      start_point_name,
        },
        'end_point': {
            'id':        end_point_id,
            'latitude':  end_coords and end_coords['latitude'],
            'longitude': end_coords and end_coords['longitude'],
            'name':      end_point_name,
        },
        'trip': {
            'trip_id':   trip_id,
            'route_id':  route_id,
            'route_name': route_name,
            'bus_name':  bus_name,
            'bus_number': bus_number,
        },
        'boarding_points': boarding_points,
    }

    return Response(data)


@api_view(['POST'])
def send_departure_alerts(request):
    # 1. Extract user_id and remaining_minutes from request data
    user_id = request.data.get('user_id')
    remaining_minutes = request.data.get('remaining_minutes')

    # 2. Both user_id and remaining_minutes are required
    if not user_id or remaining_minutes is None:
        return Response({'error': 'user_id and remaining_minutes are required'},
                        status=status.HTTP_400_BAD_REQUEST)

    # 3. Convert to ObjectId
    try:
        uid = ObjectId(user_id)
    except Exception:
        return Response({'error': 'invalid user_id format'}, status=status.HTTP_400_BAD_REQUEST)

    # 4. Lookup the FCM token document
    token_doc = FCM_TOKEN_collection.find_one({'_id': uid})
    if not token_doc or 'fcm_token' not in token_doc:
        return Response({'error': 'FCM token not found for this user'},
                        status=status.HTTP_404_NOT_FOUND)

    fcm_token = token_doc['fcm_token']
    print(fcm_token)

    # 5. Parse and validate remaining_minutes
    try:
        minutes = int(remaining_minutes)
    except (ValueError, TypeError):
        return Response({'error': 'remaining_minutes must be an integer'},
                        status=status.HTTP_400_BAD_REQUEST)

    # 6. Prepare departure reminder notification
    title = 'Bus Departure Reminder'
    body = f'In {minutes} minutes your bus will be departing. Please be ready at your start point.'

    # 7. Send notification via FCM
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        token=fcm_token,
    )

    try:
        response = messaging.send(message)
        print('Successfully sent message:', response)
        return JsonResponse({"status": "success"})
    except Exception as e:
        print('Error sending message:', e)
        return JsonResponse({"status": "error", "message": str(e)})


@api_view(['POST'])
def send_notification(request):
    # 1. Extract user_id and notification_category from request data
    user_id = request.data.get('user_id')
    category = request.data.get('notification_category')

    # 2. Both user_id and notification_category are required
    if not user_id or not category:
        return Response({'error': 'user_id and notification_category are required'},
                        status=status.HTTP_400_BAD_REQUEST)

    # 3. Validate category value
    if category not in ('BOOKED', 'RESCHEDULED', 'CANCELED', 'ERROR'):
        return Response({'error': 'invalid notification_category'}, status=status.HTTP_400_BAD_REQUEST)

    # 4. Convert to ObjectId
    try:
        uid = ObjectId(user_id)
    except Exception:
        return Response({'error': 'invalid user_id format'}, status=status.HTTP_400_BAD_REQUEST)

    # 5. Lookup the FCM token document
    token_doc = FCM_TOKEN_collection.find_one({'_id': uid})
    if not token_doc or 'fcm_token' not in token_doc:
        return Response({'error': 'FCM token not found for this user'},
                        status=status.HTTP_404_NOT_FOUND)
    fcm_token = token_doc['fcm_token']
    print(fcm_token)

    # 6. Prepare notification content based on category
    if category == 'BOOKED':
        title = 'Booking Confirmed'
        body = 'Your booking was successful.'
    elif category == 'RESCHEDULED':
        title = 'Booking Rescheduled'
        body = 'Your booking has been rescheduled. Please check the new time.'
    elif category == 'CANCELED':
        title = 'Booking Canceled'
        body = 'Your booking has been canceled. We apologize for the inconvenience.'
    else:  # ERROR
        title = 'Booking Error'
        body = 'There was an error occurred when booking your seat. Please contact us on the 0122345566.'

    # 7. Send notification via FCM
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        token=fcm_token,
    )

    try:
        response = messaging.send(message)
        print('Successfully sent message:', response)
        return JsonResponse({
            'status': 'success',
            'user_id': user_id,
            'notification_category': category
        })
    except Exception as e:
        print('Error sending message:', e)
        return JsonResponse({
            'status': 'error',
            'user_id': user_id,
            'notification_category': category,
            'message': str(e)
        })
