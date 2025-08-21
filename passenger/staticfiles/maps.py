import googlemaps
import polyline
import math
import json


def haversine(pt1, pt2):
    # earth radius in meters
    R = 6371000
    lat1, lon1 = math.radians(pt1[0]), math.radians(pt1[1])
    lat2, lon2 = math.radians(pt2[0]), math.radians(pt2[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def generate_evenly_spaced_points(points, api_key, num_points=500, mode='driving'):
    """
    points: list of dicts with 'latitude' and 'longitude'.
            First is origin, last is destination; the rest are optimized waypoints.
    api_key: your Google Maps API key
    num_points: how many sample points to output (default 500)
    mode: travel mode (driving, walking, etc.)
    """
    # 1) call Directions API with optimize_waypoints
    gmaps = googlemaps.Client(key=api_key)
    origin = (points[0]['latitude'], points[0]['longitude'])
    destination = (points[-1]['latitude'], points[-1]['longitude'])
    intermediate = [(p['latitude'], p['longitude']) for p in points[1:-1]]

    resp = gmaps.directions(
        origin,
        destination,
        waypoints=intermediate,
        optimize_waypoints=True,
        mode=mode
    )
    if not resp:
        raise RuntimeError("No route found.")

    # take the overview polyline for the full route
    overview = resp[0]['overview_polyline']['points']
    path = polyline.decode(overview)  # list of (lat, lng)

    # 2) build cumulative distances
    dists = [0.0]
    for prev, curr in zip(path, path[1:]):
        dists.append(dists[-1] + haversine(prev, curr))

    total_length = dists[-1]
    if total_length == 0:
        raise RuntimeError("Route length is zero.")

    # 3) sample at equal intervals
    interval = total_length / (num_points - 1)
    sampled = []
    target_d = 0.0
    seg_idx = 0

    for i in range(num_points):
        # advance to the segment containing target_d
        while seg_idx < len(dists)-1 and dists[seg_idx+1] < target_d:
            seg_idx += 1

        if seg_idx == len(dists)-1:
            # at or beyond end, just snap to last point
            lat, lng = path[-1]
        else:
            # linear interpolate between path[seg_idx] and path[seg_idx+1]
            d0, d1 = dists[seg_idx], dists[seg_idx+1]
            frac = (target_d - d0) / (d1 - d0)
            lat0, lon0 = path[seg_idx]
            lat1, lon1 = path[seg_idx+1]
            lat = lat0 + (lat1 - lat0) * frac
            lng = lon0 + (lon1 - lon0) * frac

        sampled.append({
            'index': i+1,
            'latitude': lat,
            'longitude': lng
        })
        target_d += interval

    return sampled

# --- example usage --------------------------------------------------


if __name__ == "__main__":
    API_KEY = "AIzaSyAuSdF4DFlKpLLDuSglXN72KOS6yeQfUvk"
    pts = [
        {"point_id": "682976dbc9866445485a8c62",
            "latitude": 6.933778, "longitude": 79.855969},
        {"point_id": "682976dbc9866445485a8c68",
            "latitude": 6.976287, "longitude": 79.925336},
        {"point_id": "682976dbc9866445485a8c69",
            "latitude": 7.08716, "longitude": 80.034598},
        {"point_id": "682976dbc9866445485a8c65",
            "latitude": 7.141228, "longitude": 80.094103},
        {"point_id": "682976dbc9866445485a8c67",
            "latitude": 7.224596, "longitude": 80.195496},
        {"point_id": "682976dbc9866445485a8c63",
            "latitude": 7.253298, "longitude": 80.448365},
        {"point_id": "682976dbc9866445485a8cbf",
            "latitude": 7.264106, "longitude": 80.592937},
        {"point_id": "682976dbc9866445485a8c64",
            "latitude": 7.291609, "longitude": 80.634713}
    ]
    path500 = generate_evenly_spaced_points(pts, API_KEY, num_points=1000)
    # now `path500` is a list of 500 dicts numbered 1→500
    with open("path500.json", "w", encoding="utf-8") as f:
        json.dump(path500, f, ensure_ascii=False, indent=2)
