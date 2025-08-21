import pytz
import re
from datetime import timezone
from dateutil import parser
import bcrypt
from django.shortcuts import render, redirect
from django.conf import settings
from bson import ObjectId
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from pymongo import MongoClient
from passenger.settings import get_access_token_from_request, validate_token, create_admin_access_token, create_admin_refresh_token, validate_admin_token


mongodb_uri = settings.DATABASE

# MongoDB client setup using the URI
client = MongoClient(mongodb_uri)
# Access your database (assuming the name is 'Passenger')
db = client['Passenger']
# Access the 'users' collection (or your actual collection name)
user_collection = db['Users']
bus_collection = db['Buses']
bus_owner_collection = db['BusOwners']
bus_trip_collection = db['BusTrips']
routes_collection = db['Routes']
# Adjust collection name if needed
boarding_points_collection = db['BoardingPoints']
admin_collection = db['Admin']


def edit_bp_form(request):
    # simply render the HTML template
    return render(request, 'edit_bp.html')


def admin_login_form(request):
    # simply render the HTML template
    return render(request, 'admin_login.html')


@api_view(["POST"])
def validate_admin(request):
    # 1. Check for access token
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response(
            {"error": "Access token missing or malformed."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # 2. Validate token
    user_id_str = validate_admin_token(access_token)
    if not user_id_str:
        return Response(
            {"error": "Invalid or expired token."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # 3. Fetch the admin user
    try:
        admin_user = admin_collection.find_one({"_id": ObjectId(user_id_str)})
    except Exception:
        return Response(
            {"error": "Invalid user ID format."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not admin_user:
        return Response(
            {"error": "Admin user not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    # 4. Return the username
    username = admin_user.get("username")
    return Response(
        {"username": username},
        status=status.HTTP_200_OK
    )


@api_view(["POST"])
def admin_login(request):
    """
    POST body: { "username": "pamod", "password": "#Ssassin@3" }
    """
    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response(
            {"detail": "username and password are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # find_one in MongoDB

    user_doc = admin_collection.find_one({"username": username})
    stored_hash = user_doc.get("password")

    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode('utf-8')

    if not user_doc or not bcrypt.checkpw(password.encode('utf-8'), stored_hash):
        return Response(
            {"detail": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # generate tokens
    access = create_admin_access_token(username, role="ADMIN")
    refresh = create_admin_refresh_token(username, role="ADMIN")

    return Response(
        {"access": access, "refresh": refresh},
        status=status.HTTP_200_OK
    )


def show_admin_dashboard(request):
    """
    GET /core/web/create-routes/
    Renders the create-route.html template, passing in all existing routes
    so that the admin can choose to Edit one.
    """

    return render(request, "admin-dashboard.html")


@api_view(["GET"])
def show_create_route_page(request):
    """
    GET /core/web/create-routes/
    Renders the create-route.html template, passing in all existing routes
    so that the admin can choose to Edit one.
    """

    return render(request, "create_route.html")


@api_view(["POST"])
def create_edit_route(request):
    """
    Expects JSON body with any of these fields (at least one required):
      _id, route_name, route_number, number_of_sections, sections, image_1, image_2

    - If `_id` is provided and valid, updates that document with any of the other fields.
    - If no `_id` is provided, creates a new document with the provided fields,
      and automatically generates `sections` based on `number_of_sections`.
    """

    # 1. Auth / Admin check
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token missing."}, status=status.HTTP_401_UNAUTHORIZED)

    user_id_str = validate_admin_token(access_token)
    if not user_id_str:
        return Response({"error": "Invalid or expired token."}, status=status.HTTP_401_UNAUTHORIZED)

    admin_user = admin_collection.find_one({"_id": ObjectId(user_id_str)})
    if not admin_user:
        return Response({"error": "Admin user not found."}, status=status.HTTP_401_UNAUTHORIZED)

    data = request.data
    route_id = data.get("_id")

    # 2. UPDATE existing route
    if route_id:
        # Build payload from allowed updatable fields
        allowed = ["route_name", "route_number",
                   "number_of_sections", "sections", "image_1", "image_2"]
        payload = {k: data[k] for k in allowed if k in data}

        if not payload:
            return Response(
                {"error": "At least one updatable field must be provided."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            oid = ObjectId(route_id)
        except Exception:
            return Response({"error": "Invalid _id format."}, status=status.HTTP_400_BAD_REQUEST)

        result = routes_collection.update_one({"_id": oid}, {"$set": payload})
        if result.matched_count == 0:
            return Response({"error": "Route not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"status": "updated", "modified_count": result.modified_count}, status=status.HTTP_200_OK)

    # 3. CREATE new route
    # Ensure required creation fields are present
    route_name = data.get("route_name")
    route_number = data.get("route_number")
    ns = data.get("number_of_sections")
    if not route_name or not route_number or ns is None:
        return Response(
            {"error": "route_name, route_number and number_of_sections are required for creation."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        number_of_sections = int(ns)
    except (TypeError, ValueError):
        return Response({"error": "number_of_sections must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

    if number_of_sections < 1:
        return Response({"error": "number_of_sections must be at least 1."}, status=status.HTTP_400_BAD_REQUEST)

    # Generate sections array
    sections = [
        {"section_name": f"section {i:02d}", "boarding_points": []}
        for i in range(1, number_of_sections + 1)
    ]

    new_doc = {
        "route_name": route_name,
        "route_number": route_number,
        "number_of_sections": number_of_sections,
        "sections": sections,
        "image_1": data.get("image_1"),
        "image_2": data.get("image_2"),
    }

    inserted = routes_collection.insert_one(new_doc)
    return Response(
        {"status": "created", "_id": str(inserted.inserted_id)},
        status=status.HTTP_201_CREATED
    )


def route_detail(request, route_id):
    """
    URL: /routes/<route_id>/
    Just extracts the route_id from the URL and renders it into the template.
    """

    return render(request, "edit_route.html", {"route_id": route_id})


@api_view(['GET'])
def get_route_info(request, route_id):
    """
    GET /routes/<route_id>/
    Returns the full route document (with sections & boarding_points) as JSON.
    """
    # 1) validate & convert the route_id
    try:
        rid = ObjectId(route_id)
    except Exception:
        return Response(
            {"error": "Invalid route_id format"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 2) fetch from Mongo
    route = routes_collection.find_one({"_id": rid})
    if not route:
        return Response(
            {"error": "Route not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # 3) convert ObjectId to string for JSON serialization
    route["_id"] = str(route["_id"])
    return Response(route, status=status.HTTP_200_OK)


@api_view(['POST'])
def add_boarding_point_to_route(request):
    """
    Expects JSON body with:
      route_id       — string ObjectId of the route document
      section_name   — e.g. "section 01"
      boarding_id    — string
      point_name     — string
      city           — string
      province       — string
      latitude       — number
      longitude      — number

    Finds the route by _id and the given section_name,
    then pushes the new boarding point into sections.$.boarding_points.
    """

    access_token = get_access_token_from_request(request)
    if not access_token:
        return redirect("/core/web/admin-login/")

    user_id_str = validate_admin_token(access_token)
    if not user_id_str:
        return redirect("/core/web/admin-login/")

    # 2. Fetch the admin user from the DB
    admin_user = admin_collection.find_one({"_id": ObjectId(user_id_str)})
    if not admin_user:
        return redirect("/core/web/admin-login/")

    data = request.data

    # 1) Validate & convert route_id
    route_id = data.get("route_id")
    if not route_id:
        return Response({"error": "route_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        rid = ObjectId(route_id)
    except Exception:
        return Response({"error": "Invalid route_id format"}, status=status.HTTP_400_BAD_REQUEST)

    # 2) Validate section_name and boarding-point fields
    section = data.get("section_name")
    bp_fields = ["boarding_id", "point_name",
                 "city", "province", "latitude", "longitude", "si_name"]
    if not section or not all(f in data for f in bp_fields):
        return Response(
            {"error": "section_name and all boarding point fields are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # build the subdocument to push
    new_bp = {f: data[f] for f in bp_fields}

    # 3) Perform the update
    result = routes_collection.update_one(
        {"_id": rid, "sections.section_name": section},
        {"$push": {"sections.$.boarding_points": new_bp}}
    )

    if result.matched_count == 0:
        # either wrong route_id or no such section_name
        return Response(
            {"error": "Route or section not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    return Response(
        {
            "status": "success",
            "modified_count": result.modified_count
        },
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
def create_edit_boarding_point(request):
    """
    Expects JSON body with keys (all optional except at least one field):
      _id, name, city, province, latitude, longitude, si_name, ta_name

    - If `_id` is provided and valid, updates that document with any of the other fields.
    - If no `_id` is provided, creates a new document with the provided fields.
    """

    access_token = get_access_token_from_request(request)
    if not access_token:
        return redirect("/core/web/admin-login/")

    user_id_str = validate_admin_token(access_token)
    if not user_id_str:
        return redirect("/core/web/admin-login/")

    # 2. Fetch the admin user from the DB
    admin_user = admin_collection.find_one({"_id": ObjectId(user_id_str)})
    if not admin_user:
        return redirect("/core/web/admin-login/")

    data = request.data
    bp_id = data.get('_id')

    # Build the payload from allowed fields
    allowed = ['name', 'city', 'province',
               'latitude', 'longitude', 'si_name', 'ta_name']
    payload = {field: data[field] for field in allowed if field in data}

    if not payload:
        return Response(
            {"error": "At least one of name, city, province, latitude, longitude, si_name or ta_name must be provided"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # UPDATE existing document
    if bp_id:
        try:
            oid = ObjectId(bp_id)
        except Exception:
            return Response({"error": "Invalid _id format"}, status=status.HTTP_400_BAD_REQUEST)

        result = boarding_points_collection.update_one(
            {'_id': oid},
            {'$set': payload}
        )
        if result.matched_count == 0:
            return Response({"error": "Boarding point not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {"status": "updated", "modified_count": result.modified_count},
            status=status.HTTP_200_OK
        )

    # CREATE new document
    inserted = boarding_points_collection.insert_one(payload)
    return Response(
        {"status": "created", "_id": str(inserted.inserted_id)},
        status=status.HTTP_201_CREATED
    )

####################################################################### Main APIs ##############################################################################


@api_view(['POST'])
def create_bus_trip_api(request):
    """
    Create a new BusTrip document in MongoDB.
    Requires JWT auth; only the bus's owner may create trips for that bus.
    Expects JSON:
    {
      "route_id": "6829d958447b7d16f0de53ae",
      "route_name": "Sample Route",
      "bus_id": "60a2c1f3810c19729de860eb",
      "bus_number": "X Bus",
      "bus_name": "X Bus",
      "trip_start_time": "20250525T055100",
      seat_type : 55 Seater,
      "number_of_seats": 17,
      "booking_price": 1200
      "fare_type_id": ,
      "fare_type_name": 
    }
    """

    ### 1) Authenticate & get owner_id ###
    access_token = get_access_token_from_request(request)
    if not access_token:
        return Response({"error": "Access token required"}, status=status.HTTP_401_UNAUTHORIZED)

    owner_id = validate_token(access_token)
    # owner_id = "682ded79908b017a067fe9a9"
    if owner_id is None:
        return Response({"error": "Invalid or expired access token"}, status=status.HTTP_401_UNAUTHORIZED)

    ### 2) Load owner and verify they exist ###
    owner = bus_owner_collection.find_one({"_id": ObjectId(owner_id)})
    if not owner:
        return Response({"error": "Bus owner not found"}, status=status.HTTP_404_NOT_FOUND)

    data = request.data

    ### 3) Ownership check: is this bus in their `buses` list? ###
    bus_id_str = data.get("bus_id")
    if not bus_id_str:
        return Response({"error": "Missing field: bus_id"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        bus_obj_id = ObjectId(bus_id_str)
    except Exception:
        return Response({"error": "Invalid bus_id format"}, status=status.HTTP_400_BAD_REQUEST)

    bus = bus_collection.find_one({"_id": bus_obj_id})
    if not bus:
        return Response({"error": "Bus not found"}, status=status.HTTP_404_NOT_FOUND)

    # Check that this bus actually belongs to the owner
    if str(bus.get("owner_id")) != owner_id:
        return Response({"error": "You do not own this bus"}, status=status.HTTP_403_FORBIDDEN)

    # Now check the is_approved flag
    if not bus.get("is_approved", False):
        return Response({"error": "Your bus is not approved yet."},
                        status=status.HTTP_400_BAD_REQUEST)

    # Compare as strings to be safe
    owner_bus_ids = [bus["bus_id"] for bus in owner.get("buses", [])
                     if "bus_id" in bus]

    ### 4) Validate the rest of the payload ###
    required_fields = [
        "route_id", "route_name", "bus_number",
        "bus_name", "trip_start_time", "number_of_seats", "booking_price", "fare_type_id", "fare_type_name", "seat_type"
    ]
    missing = [f for f in required_fields if f not in data]
    if missing:
        return Response({"error": f"Missing fields: {', '.join(missing)}"}, status=400)

    try:
        number_of_seats = int(data["number_of_seats"])
    except (ValueError, TypeError):
        return Response({"error": "number_of_seats must be an integer"}, status=400)

    dt = parser.isoparse(data['trip_start_time'])

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(pytz.UTC)

    ### 5) Build the seats array ###
    seats = []
    for i in range(1, number_of_seats + 1):
        seats.append({
            "seat_number": i,
            "booked": False,
            "start_point": None,
            "end_point": None
        })

    ### 6) Construct and insert the trip document ###
    bus_trip_doc = {
        "route_id":           data["route_id"],
        "route_name":         data["route_name"],
        "bus_id":             bus_id_str,
        "bus_number":         data["bus_number"],
        "bus_name":           data["bus_name"],
        "seat_type": data["seat_type"],
        "fare_type_id": data["fare_type_id"],
        "fare_type_name": data["fare_type_name"],
        "trip_start_time":    dt,
        "booking_price": data["booking_price"],
        "booked_revenue":     0,
        "booked_seats":       0,
        "company_3_percent_cut": 0,
        "is_revenue_released":   False,
        "tickets_revenue":      0,
        "number_of_tickets":    0,
        "is_bus_trip_cancelled": False,
        "cancellation_fee_resolved": False,
        "completed": False,
        "bookings": seats,
    }

    result = bus_trip_collection.insert_one(bus_trip_doc)
    bus_trip_doc["_id"] = str(result.inserted_id)

    return Response(bus_trip_doc, status=status.HTTP_201_CREATED)


################################################################################## API Related to Buses ##############################################################


@api_view(['GET'])
def route_search(request):
    """
    GET /api/routes/?route_name=<name>
    Returns [{ route_id, route_name }] sorted so that
    exact‐prefix matches come first, then substring matches.
    """
    name = request.GET.get('route_name', '').strip()
    if not name:
        return Response(
            {'error': 'route_name query parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    query_lower = name.lower()

    # 1) fetch all case-insensitive substring matches
    docs = list(routes_collection.find(
        {'route_name': {'$regex': name, '$options': 'i'}},
        {'route_name': 1}
    ))

    # 2) sort them in‐Python:
    #    prefix matches first (key[0]=False), then by index of match
    docs.sort(key=lambda d: (
        not d['route_name'].lower().startswith(query_lower),
        d['route_name'].lower().find(query_lower)
    ))

    # 3) build your response
    results = [
        {
            'route_id':   str(d['_id']),
            'route_name': d['route_name']
        }
        for d in docs
    ]
    return Response(results, status=status.HTTP_200_OK)
