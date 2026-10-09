from math import asin, cos, radians, sin, sqrt


def haversine_m(lat1, lon1, lat2, lon2):
    """Vzdálenost dvou bodů WGS84 v metrech."""
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * 6371000 * asin(sqrt(a))
