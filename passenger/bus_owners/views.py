import random
import requests
import jwt
import pytz
import datetime
from bson.objectid import ObjectId
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.shortcuts import render
from django.core.files.storage import FileSystemStorage
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from passenger.settings import create_access_token, create_refresh_token, get_access_token_from_request, validate_token


tz = pytz.timezone("Asia/Colombo")
utc_timezone = pytz.utc


# Access MongoDB URI from settings
# Access the URI from settings
mongodb_uri = settings.DATABASE
SECRET_KEY = settings.SECRET_KEY

# MongoDB client setup using the URI
client = MongoClient(mongodb_uri)
# Access your database (assuming the name is 'Passenger')
db = client['Passenger']
# Access the 'users' collection (or your actual collection name)
bus_owner_collection = db['BusOwners']
bus_collection = db['Buses']
bus_trip_collection = db['BusTrips']
routes_collection = db['Routes']
bus_fare_collection = db["BusFare"]
bookings_collection = db['Bookings']
fare_types_collection = db['BusFare']


@api_view(['POST'])
def register_or_login_owner(request):
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
    valid_roles = ["OWNER"]
    if not role or role not in valid_roles:
        return Response({"error": "Invalid role specified."}, status=status.HTTP_400_BAD_REQUEST)

    # Check if user exists in MongoDB
    user = bus_owner_collection.find_one({"phone_number": phone_number})

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
        update_result = bus_owner_collection.update_one(
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
        return Response({"error": "User Not Found"}, status=status.HTTP_404_NOT_FOUND)

##################################### Website Urls API #################################################################################################################


def verify_otp_form(request):
    # simply render the HTML template
    return render(request, 'website/verify_otp.html')


def login_or_register_form(request):
    # simply render the HTML template
    return render(request, 'website/login_or_register.html')


def home_page_form(request):
    # simply render the HTML template
    return render(request, 'website/index.html')


def dashboard_page_form(request):
    # simply render the HTML template
    return render(request, 'website/dashboard.html')


def owner_details_page_form(request):
    # simply render the HTML template
    return render(request, 'website/owner_details.html')


def seatBook_page_form(request):
    # simply render the HTML template
    return render(request, 'website/bookedSeat.html')


def manage_bus_trip_form(request):
    # simply render the HTML template
    return render(request, 'website/manageBusTrip.html')


def manage_bus_form(request):
    # simply render the HTML template
    return render(request, 'website/manageBusses.html')


def sidebar_form(request):
    # simply render the HTML template
    return render(request, 'website/sidebar.html')


def privacy_policy_page(request):
    # simply render the HTML template
    return render(request, 'website/privacy_policy.html')

##################################### Website Urls API #################################################################################################################


@api_view(['POST'])
def verify_otp(request):
    """
    Verifies the OTP entered by the user and issues JWT on successful authentication using MongoDB operations.


Verifies the OTP entered by the user and issues JWT on successful authentication.

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

    user = bus_owner_collection.find_one({"phone_number": phone_number})

    if not user:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    if user.get('otp_code') != otp_code:
        return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

    if now.replace(tzinfo=None) > user.get('otp_expires_at').replace(tzinfo=None):
        return Response({"error": "OTP expired."}, status=status.HTTP_400_BAD_REQUEST)

    with client.start_session() as session:
        try:
            with session.start_transaction():
                # Mark user as verified
                update_result = bus_owner_collection.update_one(
                    {"phone_number": phone_number},
                    {
                        "$set": {
                            "is_verified": True,
                            "otp_code": None,
                            "otp_expires_at": None
                        }
                    }, session=session
                )

                if update_result.modified_count == 0:
                    return Response({"error": "Failed to update user verification status."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

                # Generate JWT tokens using custom functions
                role = "OWNER"
                access_token = create_access_token(phone_number, role)
                refresh_token = create_refresh_token(phone_number, role)

                return Response({
                    "message": "OTP verified successfully! User is now active.",
                    "access": access_token,
                    "refresh": refresh_token
                }, status=status.HTTP_200_OK)

        except PyMongoError as e:
            print(f"Transaction aborted due to error: {e}")
        # Handle rollback/cleanup if needed


@api_view(['GET', 'PUT'])
def owner_details(request):
    """
    {
            "company_name" : "A Company" ,
            "company_address" : "23/ b road",
            "company_number" : "07746737373",
            "company_registration_number": "3734832478347834",
            "company_owner_name" : "Syril Saman"

        }
    """

    access_token = get_access_token_from_request(request)

    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)

    owner_id = validate_token(access_token)
    if not owner_id:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    owner = bus_owner_collection.find_one({"_id": ObjectId(owner_id)})
    if not owner:
        return Response({"error": "Owner not found"}, status=status.HTTP_404_NOT_FOUND)

    buses = owner.get("buses", [])
    cleaned_buses = []
    for bus in buses:
        cleaned_buses.append({
            "bus_id": str(bus["bus_id"]) if isinstance(bus.get("bus_id"), ObjectId) else bus.get("bus_id"),
            "bus_name": bus.get("bus_name"),
            "bus_number": bus.get("bus_number")
        })

    if request.method == 'GET':
        # Return bus owner fields except email (as per your request)
        owner_data = {
            "phone_number": owner.get("phone_number"),
            "is_verified": owner.get("is_verified", False),
            "company_name": owner.get("company_name"),
            "company_address": owner.get("company_address"),
            "company_number": owner.get("company_number"),
            "company_registration_number": owner.get("company_registration_number"),
            "company_owner_name": owner.get("company_owner_name"),
            "buses": cleaned_buses
            # add more fields if needed
        }
        return Response(owner_data, status=status.HTTP_200_OK)

    elif request.method == 'PUT':
        data = request.data
        update_fields = {}

        # Allowed fields to update for bus owner
        allowed_fields = [
            "company_name",
            "company_address",
            "company_number",
            "company_registration_number",
            "company_owner_name"
        ]

        for field in allowed_fields:
            if field in data:
                update_fields[field] = data[field]

        if update_fields:
            bus_owner_collection.update_one(
                {"_id": ObjectId(owner_id)}, {"$set": update_fields})

        return Response({"message": "Bus owner details updated successfully!"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_bus(request):
    '''
    {
    "bus_name": "Green City Express",
    "bus_number": "GCE-2025",
    "route_permit_number": "RP-123456",
    "route_permit_image": "https://cdn.example.com/permits/rp-123456.png",
    "bus_type": "AC Sleeper",
    "seat_type": "Recliner"
    "fare_type_id": g565ghryrtg5y65y7u6u,
    "fare_type_name: g565ghryrtg5y65y7u6u"
}
   '''
    data = request.data

    # 1) Authenticate
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)

    owner_id = validate_token(access_token)
    if owner_id is None:
        return Response({"error": "Invalid or expired token"}, status=status.HTTP_401_UNAUTHORIZED)

    # 2) Verify owner exists
    owner = bus_owner_collection.find_one({"_id": ObjectId(owner_id)})
    if not owner:
        return Response({"error": "Owner not found"}, status=status.HTTP_404_NOT_FOUND)

    # 3) Check required fields
    required = [
        "bus_name",
        "bus_number",
        "route_permit_number",
        "route_permit_image",
        "bus_type",
        "seat_type",
        "fare_type_id",
        "fare_type_name"
    ]
    missing = [f for f in required if f not in data]
    if missing:
        return Response(
            {"error": f"Missing fields: {', '.join(missing)}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 4) Build the document
    bus_doc = {
        "owner_id": owner_id,
        "bus_name": data["bus_name"],
        "bus_number": data["bus_number"],
        "route_permit_number": data["route_permit_number"],
        "route_permit_image": data["route_permit_image"],
        "bus_type": data["bus_type"],
        "seat_type": data["seat_type"],
        "fare_type_id": data["fare_type_id"],
        "fare_type_name": data["fare_type_name"],
        # these two will be set via separate APIs later
        "is_approved": False,
        "machine": False,
        "is_machine_connected": False,
        "tokenVersion": 1
    }

    # 5) Insert into Buses
    result = bus_collection.insert_one(bus_doc)
    new_id = result.inserted_id
    bus_doc["_id"] = str(new_id)

    # 6) Add this bus to the owner's list
    bus_owner_collection.update_one(
        {"_id": ObjectId(owner_id)},
        {"$push": {
            "buses": {
                "bus_id": new_id,
                "bus_name": data["bus_name"],
                "bus_number": data["bus_number"]
            }
        }},
        upsert=True
    )

    return Response({
        "message": "Bus created successfully",
        "bus": bus_doc
    }, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@parser_classes([MultiPartParser, FormParser])
def update_bus(request):
    """
    {
        "bus_id":            "6831f26c680ae286f254ce03",
        "bus_name":            "Green City Express",
        "bus_number":          "GC-2025",
        "bus_type":            "Coach",
        "seat_type":           "Recliner",
        "route_permit_number": "RP-12345",
        "route_permit_image":  "http://…/permits/rp-12345.png",
        "fare_type_id": "683ec3f3db5a803c5d6d5305",
        "fare_type_name":  "Luxury Fare",
        }

    """
    data = request.data
    # Extract the access token from the request

    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)

    # validate the token and extract the user id from the access token
    owner_id = validate_token(access_token)
    if owner_id is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    # Check owner exists in DB
    owner = bus_owner_collection.find_one({"_id": ObjectId(owner_id)})
    if not owner:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    # get bus id from the put request

    bus_id = data.get('bus_id')

    if not bus_id:
        return Response({"error": "bus_id is required for update"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        object_id = ObjectId(bus_id)
    except Exception:
        return Response({"error": "Invalid bus_id format"}, status=status.HTTP_400_BAD_REQUEST)

    # Find the bus and verify ownership
    bus = bus_collection.find_one({"_id": object_id})
    if not bus:
        return Response({"error": "Bus not found"}, status=status.HTTP_404_NOT_FOUND)

    if bus.get("owner_id") != owner_id:
        Response({"error": "Unauthorized: You do not own this bus"},
                 status=status.HTTP_403_FORBIDDEN)

        # Fields allowed to update
    allowed_fields = [
        "bus_name", "bus_number", "bus_type",
        "seat_type", "route_permit_number", "fare_type_id", "fare_type_name"
    ]

    update_fields = {}
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]

    image = request.FILES.get('route_permit_image')
    if image:
        # save under MEDIA_ROOT/permits/, serve at MEDIA_URL/permits/
        permits_storage = FileSystemStorage(
            location=settings.MEDIA_ROOT + '/permits/',
            base_url=settings.MEDIA_URL + 'permits/'
        )
        filename = permits_storage.save(image.name, image)
        # e.g. "/media/permits/rp-12345.png"
        relative_url = permits_storage.url(filename)
        # build absolute URL so client can fetch it
        absolute_url = request.build_absolute_uri(relative_url)
        update_fields['route_permit_image'] = absolute_url

    # Perform the update
    result = bus_collection.update_one(
        {"_id": object_id},
        {"$set": update_fields}, upsert=True
    )
    updated_bus = bus_collection.find_one({"_id": object_id})

    updated_bus['_id'] = str(updated_bus['_id'])
    return Response({
        "results": updated_bus,
        "message": "Bus updated successfully"
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def get_owner_buses(request):
    """
    POST payload: { "ids": ["<mongo_id_str1>", "<mongo_id_str2>", ...] }
    Returns: [ { ...full document... }, ... ]
    """

    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)

    # validate the token and extract the user id from the access token
    owner_id = validate_token(access_token)
    if owner_id is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    ids = request.data.get('ids')
    if not isinstance(ids, list):
        return Response(
            {'error': '`ids` must be a list of ObjectId strings.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    results = []
    for id_str in ids:
        # validate ObjectId
        try:
            obj_id = ObjectId(id_str)
        except Exception:
            return Response(
                {'error': f'Invalid ObjectId string: {id_str}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # fetch document
        doc = bus_collection.find_one({'_id': obj_id})
        if not doc:
            # you can choose to skip or treat missing docs differently
            continue

        # ownership check
        if doc.get('owner_id') != owner_id:
            return Response(
                {'error': 'Unauthorized: owner_id mismatch'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # convert ObjectId to str for JSON
        doc['_id'] = str(doc['_id'])
        results.append(doc)

    return Response(results)


@api_view(['GET'])
def get_bus_by_id(request):
    """
    bus-owners/get-bus/?bus_id=68357fb6a133ec69d66d4ee4
    """

    bus_id = request.GET.get('bus_id')

    try:
        bus = bus_collection.find_one({"_id": ObjectId(bus_id)})
    except Exception:
        return Response({"error": "Invalid bus ID format"}, status=status.HTTP_400_BAD_REQUEST)

    if not bus:
        return Response({"message": "Bus not found"}, status=status.HTTP_404_NOT_FOUND)

    bus['_id'] = str(bus['_id'])  # Convert ObjectId to string

    return Response(bus, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_trips_by_bus(request):
    """
    GET /api/trips/?bus_id=<bus_id>
    Returns all BusTrip documents whose `bus_id` field matches the given value.
    """
    bus_id = request.GET.get('bus_id')
    if not bus_id:
        return Response({"error": "bus_id query parameter is required"},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        # Try to convert the bus_id into ObjectId
        bus_obj_id = ObjectId(bus_id)
    except Exception:
        return Response({"error": "Invalid bus_id format"}, status=status.HTTP_400_BAD_REQUEST)

    # 2) fetch the bus details
    bus = bus_collection.find_one({"_id": bus_obj_id})
    if not bus:
        return Response({"error": "Bus not found"}, status=status.HTTP_404_NOT_FOUND)

    # Convert the bus's _id field to string to avoid issues when returning as JSON
    bus["_id"] = str(bus["_id"])

    # Fetch bus trips sorted by the `trip_start_time` in ascending order (oldest to newest)
    trips_cursor = bus_trip_collection.find({"bus_id": bus_id}).sort(
        "trip_start_time", 1)  # 1 for ascending order
    trips = []
    for doc in trips_cursor:
        # Convert each trip's _id to string
        doc["_id"] = str(doc["_id"])
        trips.append(doc)

    # Return the response with the bus details and sorted trips
    return Response({"bus": bus, "trips": trips}, status=status.HTTP_200_OK)


@api_view(['POST'])
def add_ticket(request):
    """
    {
        "trip_id": "6833f416d1a78ca68eaffe44",
        "start_point": "Colombo",
        "end_point": "Kandy",
        "ticket_price": 1200
    }
    """
    data = request.data
    trip_id = data.get('trip_id')
    local_time = datetime.datetime.now(tz)
    now = local_time.astimezone(utc_timezone)
    # Validate required fields
    required_fields = ["trip_id",
                       "start_point", "end_point", "ticket_price"]
    missing = [f for f in required_fields if f not in data]
    if missing:
        return Response(
            {"error": f"Missing fields: {', '.join(missing)}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    ticket = {
        "ticket_date_time": now,
        "start_point":       data["start_point"],
        "end_point":         data["end_point"],
        "ticket_price":      data["ticket_price"],
    }

    # Update the document by pushing ticket into tickets array
    try:
        obj_id = ObjectId(trip_id)
    except Exception:
        return Response({"error": "Invalid trip_id"}, status=status.HTTP_400_BAD_REQUEST)

    result = bus_trip_collection.update_one(
        {"_id": obj_id},
        {
            "$push": {"tickets": ticket},
            "$inc": {
                "tickets_revenue": data.get('ticket_price'),
                "number_of_tickets": 1
            }
        }
    )

    if result.matched_count == 0:
        return Response({"error": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

    return Response({"message": "Ticket added successfully"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def verify_booking(request):
    """
    Verifies that a given booking belongs to the given user and bus.

    POST body:
    {
      "booking_id": "<booking_id>",
      "user_id": "<user_id>",
      "bus_id": "<bus_id>"
    }
    """
    data = request.data

    # 1. Validate required fields
    for field in ("booking_id", "user_id", "bus_id"):
        if not data.get(field):
            return Response(
                {"error": f"{field} is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

    # 2. Parse booking_id
    try:
        booking_obj_id = ObjectId(data["booking_id"])
    except Exception:
        return Response(
            {"error": "Invalid booking_id format"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 3. Fetch booking
    booking = bookings_collection.find_one({"_id": booking_obj_id})
    if not booking:
        return Response(
            {"error": "Booking not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # 4. Check user_id
    #    (booking['user_id'] should be stored as a string)
    if booking.get("user_id") != data["user_id"]:
        return Response(
            {"error": "user invalid"},
            status=status.HTTP_403_FORBIDDEN
        )

    # 5. Check bus_id
    #    (booking['bus_id'] should be stored as a string)
    if booking.get("bus_id") != data["bus_id"]:
        return Response(
            {"error": "this ticket is not issued for this bus."},
            status=status.HTTP_403_FORBIDDEN
        )

    if booking.get("status") not in ("Booked", "Rescheduled_1"):
        return Response(
            {"error": f"Cannot verify booking with status '{booking.get('status')}'."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 6. All good
    result = bookings_collection.update_one(
        {"_id": booking_obj_id},
        {"$set": {"status": "Verified"}}
    )
    if result.modified_count != 1:
        # something odd happened: either it was already "Completed" or the update failed
        return Response(
            {"error": "Could not update booking status"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response(
        {"message": "Ticket is valid and status set to Completed"},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
def machine_login(request):
    """
    {
    "bus_number": "LB - 4698"
    }
    """
    bus_number = request.data.get('bus_number')
    if not bus_number:
        return Response({"error": "Bus number is required"}, status=400)

    # Find bus by bus_number
    bus = bus_collection.find_one({"bus_number": bus_number})
    if not bus:
        return Response({"error": "Bus not found"}, status=404)

    # Check machine attribute
    if not bus.get('machine', False):
        return Response({"error": "Contact your operator"}, status=403)

    # Check if machine is already connected
    if bus.get('is_machine_connected', False):
        return Response({"error": "A machine is already logged"}, status=403)

    # Update the machine connection status by the bus_id
    result = bus_collection.update_one(
        {"_id": bus['_id']},  # Use the bus_id for the update
        {"$set": {"is_machine_connected": True}}
    )

    if result.modified_count == 1:
        # Prepare the payload with bus_id and tokenVersion
        bus_id = str(bus['_id'])
        # Use a default if tokenVersion is not found
        token_version = bus.get('tokenVersion')
        payload = {
            "bus_id": bus_id,
            "tokenVersion": token_version
        }

        # Encode the payload to create a JWT token
        token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')

        # Return the JWT token in the response
        return Response({
            "message": "Login successful",
            "token": token  # Send the token in the response
        })
    else:
        return Response({"error": "Failed to update machine status"}, status=500)


@api_view(['POST'])
def toggle_machine_button(request):
    """
    {
        "bus_id": "some_bus_id",
        "status": "on"  # or "off"
    }
    """
    data = request.data

    # Extract the access token from the request
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)

    # Validate the token and extract the user id from the access token
    owner_id = validate_token(access_token)
    if owner_id is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    # Check if the owner exists in DB
    owner = bus_owner_collection.find_one({"_id": ObjectId(owner_id)})
    if not owner:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    # Get bus id and status from the request
    bus_id = data.get('bus_id')
    status_value = data.get('status')

    if not bus_id:
        return Response({"error": "bus_id is required for update"}, status=status.HTTP_400_BAD_REQUEST)

    if status_value not in ['on', 'off']:
        return Response({"error": "Invalid status value. It must be 'on' or 'off'"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        object_id = ObjectId(bus_id)
    except Exception:
        return Response({"error": "Invalid bus_id format"}, status=status.HTTP_400_BAD_REQUEST)

    # Find the bus and verify ownership
    bus = bus_collection.find_one({"_id": object_id})
    if not bus:
        return Response({"error": "Bus not found"}, status=status.HTTP_404_NOT_FOUND)

    if bus.get("owner_id") != owner_id:
        return Response({"error": "Unauthorized: You do not own this bus"},
                        status=status.HTTP_403_FORBIDDEN)

    # Update the bus based on the status
    if status_value == 'on':
        result = bus_collection.update_one(
            {"_id": object_id},
            {"$set": {"machine": True, "is_machine_connected": False}}
        )
    elif status_value == 'off':
        result = bus_collection.update_one(
            {"_id": object_id},
            {"$set": {"machine": False, "is_machine_connected": False},
                "$inc": {"tokenVersion": 1}}
        )
    else:
        return Response({"error": "Invalid status value"}, status=status.HTTP_400_BAD_REQUEST)

    if result.modified_count == 1:
        return Response({"message": "Bus machine status updated successfully"})
    else:
        return Response({"error": "Failed to update bus machine status"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_route_info(request):
    route_id = request.GET.get('route_id')
    if not route_id:
        return Response({"error": "route_id query parameter is required"}, status=400)

    try:
        obj_id = ObjectId(route_id)
    except Exception:
        return Response({"error": "Invalid route ID"}, status=400)

    route = routes_collection.find_one({"_id": obj_id})
    if not route:
        return Response({"error": "Route not found"}, status=404)

    route['_id'] = str(route['_id'])

    for section in route.get('sections', []):
        for point in section.get('boarding_points', []):
            if '_id' in point:
                point['_id'] = str(point['_id'])

    return Response(route)


@api_view(['GET'])
def get_bus_fare(request):
    """
    bus-owners//bus_fare/?id=683ec3f3db5a803c5d6d5305
    """
    bus_fare_id = request.GET.get('fare_id')
    if not bus_fare_id:
        return Response({"error": "id query parameter is required"}, status=400)

    try:
        obj_id = ObjectId(bus_fare_id)
    except Exception:
        return Response({"error": "Invalid bus_fare id"}, status=400)

    bus_fare_doc = bus_fare_collection.find_one({"_id": obj_id})

    if not bus_fare_doc:
        return Response({"error": "Bus fare document not found"}, status=404)

    # Convert ObjectId to string for JSON serialization
    bus_fare_doc['_id'] = str(bus_fare_doc['_id'])

    return Response(bus_fare_doc)


@api_view(['GET'])
def list_fare_types(request):
    """
    Returns a list of all fare types in the DB, each with its id and name.
    """
    cursor = fare_types_collection.find(
        {},
        {'bus_fare_name': 1}  # only fetch the name (and _id by default)
    )

    fares = []
    for doc in cursor:
        fares.append({
            'id':   str(doc['_id']),
            'name': doc.get('bus_fare_name', '')
        })

    return Response(fares)


@api_view(['GET'])
def trip_tickets(request):
    """
    GET /bus-owners/tickets/?trip_id=<ObjectId or hex string>
    returns: [
      {
        start_point, end_point, ticket_price, ticket_date_time,
        booking_price, route_id
      }, ...
    ]
    """
    trip_id = request.GET.get('trip_id')
    if not trip_id:
        return Response({'detail': 'Missing trip_id.'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate ObjectId
    try:
        _id = ObjectId(trip_id)
    except Exception:
        return Response({'detail': 'Invalid trip ID.'}, status=status.HTTP_400_BAD_REQUEST)

    # Fetch tickets + trip-level route_id and booking_price
    trip = bus_trip_collection.find_one(
        {'_id': _id},
        {'_id': 0, 'tickets': 1, 'route_id': 1, 'booking_price': 1}
    )
    if not trip:
        return Response({'detail': 'Trip not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Trip-level values (used as defaults for each ticket)
    trip_route_id = trip.get('route_id')
    if isinstance(trip_route_id, ObjectId):
        trip_route_id = str(trip_route_id)
    trip_booking_price = trip.get('booking_price')

    # Build response with new attributes appended at the end
    out = []
    for t in trip.get('tickets', []):
        item = {
            'start_point': t.get('start_point'),
            'end_point': t.get('end_point'),
            'ticket_price': t.get('ticket_price'),
            'ticket_date_time': t.get('ticket_date_time'),
            'booking_price': t.get('booking_price', trip_booking_price),
            'route_id': t.get('route_id', trip_route_id),
        }
        # If any ticket stores route_id as an ObjectId, stringify it
        if isinstance(item['route_id'], ObjectId):
            item['route_id'] = str(item['route_id'])
        out.append(item)

    return Response(out)


def ticket_graph_view(request, trip_id):
    """
    This view renders the bus ticket visualization page.
    It passes the trip_id from the URL to the template's context.
    """
    # The context dictionary is used to pass data to the template.
    # The key 'trip_id' will be available as a variable in the HTML.
    context = {
        'trip_id': trip_id
    }
    # Renders the 'ticket_visualization.html' template.
    # Make sure you have a template with this name in your templates directory.
    return render(request, 'website/ticketsDetails.html', context)


@api_view(['GET'])
def get_started_bus_trip(request):
    bus_id = request.GET.get('bus_id')
    if not bus_id:
        return Response({"error": "Bus ID is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        ObjectId(bus_id)
    except Exception:
        return Response({"error": "Invalid bus_id format"}, status=status.HTTP_400_BAD_REQUEST)

    # current time in UTC
    now = datetime.datetime.now(tz).astimezone(utc_timezone)

    # 1) fetch the “just-started” (most recent past) trip
    just_started = bus_trip_collection.find_one(
        {"bus_id": bus_id, "trip_start_time": {"$lte": now}},
        sort=[("trip_start_time", -1)]
    )

    # 2) fetch all future trips, sorted descending
    upcoming_cursor = bus_trip_collection.find(
        {"bus_id": bus_id, "trip_start_time": {"$gt": now}}
    ).sort("trip_start_time", -1)

    # build a single list
    trips = []
    if just_started:
        trips.append(just_started)
    trips.extend(list(upcoming_cursor))

    # helper to stringify ObjectIds etc.
    def convert_objectid_to_str(obj):
        if isinstance(obj, dict):
            return {k: convert_objectid_to_str(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [convert_objectid_to_str(x) for x in obj]
        if isinstance(obj, ObjectId):
            return str(obj)
        return obj

    trips_serialized = [convert_objectid_to_str(t) for t in trips]

    return Response({
        "trips": trips_serialized,
        "current_time": now.isoformat()
    }, status=status.HTTP_200_OK)


VALIDATE_URL = "https://www.passenger.lk/validate-machine/"


@api_view(['POST'])
def add_all_tickets(request):
    # Step 1: Get JWT token from request headers
    jwt_token = get_access_token_from_request(request)

    if not jwt_token:
        return Response({"error": "JWT token missing in header"}, status=status.HTTP_400_BAD_REQUEST)

    # Authenticate and get bus_id

    try:
        auth_response = requests.post(
            # 10 seconds timeout
            VALIDATE_URL, json={"token": jwt_token}, timeout=10)
        auth_response.raise_for_status()

        # Printing the full response in the terminal
        print(f"Response Status Code: {auth_response.status_code}")
        print("Response JSON:")
        print(auth_response.json())

        auth_data = auth_response.json()
        bus_id = auth_data.get("bus_id")
    except requests.exceptions.RequestException as e:
        print(f"Authentication failed: {str(e)}")

    if not bus_id:
        return Response({"error": "No bus_id found in authentication response"}, status=status.HTTP_400_BAD_REQUEST)

    # Step 2: Validate ticket data from the request
    tickets = request.data.get("tickets", [])

    if not tickets:
        return Response({"error": "No tickets provided"}, status=status.HTTP_400_BAD_REQUEST)

    trip_id = tickets[0].get("trip_id")

    try:
        _id = ObjectId(trip_id)
    except Exception:
        return Response({'detail': 'Invalid trip ID.'}, status=status.HTTP_400_BAD_REQUEST)

    # Ensure all trip_ids are the same
    if any(ticket.get("trip_id") != trip_id for ticket in tickets):
        return Response({"error": "Mismatched trip_id across tickets"}, status=status.HTTP_400_BAD_REQUEST)

    # Step 3: Check that bus_id and trip_id match the MongoDB trip document
    # Use find_one to search in the MongoDB collection
    trip = bus_trip_collection.find_one({
        "_id": _id,
        "bus_id": bus_id,

    })

    if not trip:
        return Response({"error": "Bus ID and Trip ID mismatch or no trip found"}, status=status.HTTP_400_BAD_REQUEST)

    # Step 4: Update the trip with new ticket information (push new tickets into the tickets array)
    for ticket in tickets:
        ticket_data = {
            "start_point": ticket["start_point"],
            "end_point": ticket["end_point"],
            "ticket_price": ticket["ticket_price"],
            "ticket_date_time": ticket["issued_at"]
        }

        # Update the trip document by pushing the new ticket into the tickets array and incrementing ticket counts
        result = bus_trip_collection.update_one(
            {"_id": ObjectId(trip["_id"])},
            {
                "$push": {"tickets": ticket_data},
                "$inc": {
                    "tickets_revenue": ticket["ticket_price"],
                    "number_of_tickets": 1
                }
            }
        )

        if result.matched_count == 0:
            return Response({"error": "Failed to update the trip document"}, status=status.HTTP_400_BAD_REQUEST)

    # Step 5: Filter out and return only the necessary ticket details
    filtered_tickets = [{
        "start_point": ticket["start_point"],
        "end_point": ticket["end_point"],
        "ticket_price": ticket["ticket_price"],
        "ticket_date_time": ticket["issued_at"]
    } for ticket in tickets]

    return Response({"tickets": filtered_tickets})


@api_view(['POST'])
def complete_bookings(request):
    """
    POST payload: { "trip_id": "<trip_id>" }
    Only updates bookings for that trip_id **and** for the bus_id
    extracted from the validated JWT.
    """
    # --- 1) extract & validate token ---
    jwt_token = get_access_token_from_request(request)
    if not jwt_token:
        return Response(
            {"error": "Authorization header missing or malformed."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # --- 2) call auth service to get bus_id ---
    try:
        auth_resp = requests.post(
            VALIDATE_URL,
            json={"token": jwt_token},
            timeout=10
        )
        auth_resp.raise_for_status()
        bus_id = auth_resp.json().get("bus_id")
        if not bus_id:
            return Response(
                {"error": "bus_id not returned by auth service."},
                status=status.HTTP_403_FORBIDDEN
            )
    except requests.RequestException as exc:
        return Response(
            {"error": f"Authentication failed: {exc}"},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # --- 3) validate payload ---
    trip_id = request.data.get('trip_id')
    if not trip_id:
        return Response(
            {"detail": "You must provide a trip_id in the request body."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        trip_obj_id = ObjectId(trip_id)
    except Exception:
        return Response({"detail": "Invalid trip_id format."}, status=400)

    # --- 4) perform conditional update ---
    try:
        # 1) Complete all VERIFIED bookings
        result_verified = bookings_collection.update_many(
            {
                'trip_id': trip_id,
                'bus_id':   bus_id,
                'status':  'Verified'
            },
            {'$set': {'status': 'Completed'}}
        )

        # 2) Fail all BOOKED bookings
        result_booked = bookings_collection.update_many(
            {
                'trip_id': trip_id,
                'bus_id':   bus_id,
                'status':  'Booked'
            },
            {'$set': {'status': 'Failed'}}
        )

        result_trip = bus_trip_collection.update_one(
            {'_id': trip_obj_id, 'bus_id': bus_id},
            {'$set': {'Completed': True}}
        )

        # Optionally combine counts for your response
        matched_count = result_verified.matched_count + \
            result_booked.matched_count + result_trip.matched_count
        modified_count = result_verified.modified_count + \
            result_booked.modified_count + result_trip.modified_count
    except PyMongoError as e:
        return Response(
            {"detail": f"Database error: {e}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response({
        "matched_count":  matched_count,
        "modified_count": modified_count,
    }, status=status.HTTP_200_OK)


@api_view(["POST"])
def turn_machine_off(request):
    # 1) Extract JWT
    jwt_token = get_access_token_from_request(request)

    if not jwt_token:
        return Response({"error": "JWT token missing in header"}, status=status.HTTP_400_BAD_REQUEST)

    # Authenticate and get bus_id

    try:
        auth_response = requests.post(
            # 10 seconds timeout
            VALIDATE_URL, json={"token": jwt_token}, timeout=10)
        auth_response.raise_for_status()

        # Printing the full response in the terminal
        print(f"Response Status Code: {auth_response.status_code}")
        print("Response JSON:")
        print(auth_response.json())

        auth_data = auth_response.json()
        bus_id = auth_data.get("bus_id")
    except requests.exceptions.RequestException as e:
        print(f"Authentication failed: {str(e)}")

    if not bus_id:
        return Response({"error": "No bus_id found in authentication response"}, status=status.HTTP_400_BAD_REQUEST)

    # 3) Perform the “off” update
    try:
        object_id = ObjectId(bus_id)
    except Exception:
        return Response({"error": "Invalid bus_id from token"}, status=status.HTTP_400_BAD_REQUEST)

    result = bus_collection.update_one(
        {"_id": object_id},
        {
            "$set": {
                "machine": False,
                "is_machine_connected": False
            },
            "$inc": {
                "tokenVersion": 1
            }
        }
    )

    if result.modified_count == 1:
        return Response({"message": "Bus machine turned off successfully"})
    else:
        return Response({"error": "Failed to update bus machine status"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
