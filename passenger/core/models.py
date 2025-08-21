from django.db import models
from django.conf import settings
from django_mongodb_backend.fields import EmbeddedModelField, ArrayField
from django_mongodb_backend.models import EmbeddedModel
from django.core.exceptions import ValidationError


CITY_TO_PROVINCE_MAP = {
    "Ampara District": "Eastern Province",
    "Anuradhapura District": "North Central Province",
    "Badulla District": "Uva Province",
    "Batticaloa District": "Eastern Province",
    "Colombo District": "Western Province",
    "Galle District": "Southern Province",
    "Gampaha District": "Western Province",
    "Hambantota District": "Southern Province",
    "Jaffna District": "Northern Province",
    "Kalutara District": "Western Province",
    "Kandy District": "Central Province",
    "Kegalle District": "Sabaragamuwa Province",
    "Kilinochchi District": "Northern Province",
    "Kurunegala District": "North Western Province",
    "Mannar District": "Northern Province",
    "Matale District": "Central Province",
    "Matara District": "Southern Province",
    "Monaragala District": "Uva Province",
    "Mullaitivu District": "Northern Province",
    "Nuwara Eliya District": "Central Province",
    "Polonnaruwa District": "North Central Province",
    "Puttalam District": "North Western Province",
    "Ratnapura District": "Sabaragamuwa Province",
    "Trincomalee District": "Eastern Province",
    "Vavuniya District": "Northern Province"
}


CENTRAL_PROVINCE = "Central Province"
EASTERN_PROVINCE = "Eastern Province"
NORTH_CENTRAL_PROVINCE = "North Central Province"
NORTHERN_PROVINCE = "Northern Province"
NORTH_WESTERN_PROVINCE = "North Western Province"
SABARAGAMUWA_PROVINCE = "Sabaragamuwa Province"
SOUTHERN_PROVINCE = "Southern Province"
UVA_PROVINCE = "Uva Province"
WESTERN_PROVINCE = "Western Province"

PROVINCES_IN_SRI_LANKA = [
    (CENTRAL_PROVINCE, "Central Province"),
    (EASTERN_PROVINCE, "Eastern Province"),
    (NORTH_CENTRAL_PROVINCE, "North Central Province"),
    (NORTHERN_PROVINCE, "Northern Province"),
    (NORTH_WESTERN_PROVINCE, "North Western Province"),
    (SABARAGAMUWA_PROVINCE, "Sabaragamuwa Province"),
    (SOUTHERN_PROVINCE, "Southern Province"),
    (UVA_PROVINCE, "Uva Province"),
    (WESTERN_PROVINCE, "Western Province")
]


AMPARA_DISTRICT = "Ampara District"
ANURADHAPURA_DISTRICT = "Anuradhapura District"
BADULLA_DISTRICT = "Badulla District"
BATTICALOA_DISTRICT = "Batticaloa District"
COLOMBO_DISTRICT = "Colombo District"
GALLE_DISTRICT = "Galle District"
GAMPAHA_DISTRICT = "Gampaha District"
HAMBANTOTA_DISTRICT = "Hambantota District"
JAFFNA_DISTRICT = "Jaffna District"
KALUTARA_DISTRICT = "Kalutara District"
KANDY_DISTRICT = "Kandy District"
KEGALLE_DISTRICT = "Kegalle District"
KILINOCHCHI_DISTRICT = "Kilinochchi District"
KURUNEGALA_DISTRICT = "Kurunegala District"
MANNAR_DISTRICT = "Mannar District"
MATALE_DISTRICT = "Matale District"
MATARA_DISTRICT = "Matara District"
MONARAGALA_DISTRICT = "Monaragala District"
MULLAITIVU_DISTRICT = "Mullaitivu District"
NUWARA_ELIYA_DISTRICT = "Nuwara Eliya District"
POLONNARUWA_DISTRICT = "Polonnaruwa District"
PUTTALAM_DISTRICT = "Puttalam District"
RATNAPURA_DISTRICT = "Ratnapura District"
TRINCOMALEE_DISTRICT = "Trincomalee District"
VAVUNIYA_DISTRICT = "Vavuniya District"


DISTRICTS_IN_SRI_LANKA = [
    (AMPARA_DISTRICT, "Ampara District"),
    (ANURADHAPURA_DISTRICT, "Anuradhapura District"),
    (BADULLA_DISTRICT, "Badulla District"),
    (BATTICALOA_DISTRICT, "Batticaloa District"),
    (COLOMBO_DISTRICT, "Colombo District"),
    (GALLE_DISTRICT, "Galle District"),
    (GAMPAHA_DISTRICT, "Gampaha District"),
    (HAMBANTOTA_DISTRICT, "Hambantota District"),
    (JAFFNA_DISTRICT, "Jaffna District"),
    (KALUTARA_DISTRICT, "Kalutara District"),
    (KANDY_DISTRICT, "Kandy District"),
    (KEGALLE_DISTRICT, "Kegalle District"),
    (KILINOCHCHI_DISTRICT, "Kilinochchi District"),
    (KURUNEGALA_DISTRICT, "Kurunegala District"),
    (MANNAR_DISTRICT, "Mannar District"),
    (MATALE_DISTRICT, "Matale District"),
    (MATARA_DISTRICT, "Matara District"),
    (MONARAGALA_DISTRICT, "Monaragala District"),
    (MULLAITIVU_DISTRICT, "Mullaitivu District"),
    (NUWARA_ELIYA_DISTRICT, "Nuwara Eliya District"),
    (POLONNARUWA_DISTRICT, "Polonnaruwa District"),
    (PUTTALAM_DISTRICT, "Puttalam District"),
    (RATNAPURA_DISTRICT, "Ratnapura District"),
    (TRINCOMALEE_DISTRICT, "Trincomalee District"),
    (VAVUNIYA_DISTRICT, "Vavuniya District")
]
