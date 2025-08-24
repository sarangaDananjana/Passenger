from django.urls import path
from . import views


urlpatterns = [
    path("register-or-login/", views.register_or_login_user,
         name="register_or_login_user"),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('user-details/', views.user_details, name='user_details'),
    path('user-update', views.user_partial_update, name='user_partial_update'),
    path('verify-email-otp/', views.verify_email_otp, name='verify_email_otp'),
    path("check-seats/", views.validate_seats_empty_points,
         name="validate_seats_empty_points"),
    path("initialize-booking/", views.initialize_booking,
         name="initialize_booking"),
    path("create-booking/", views.create_booking, name="create-booking"),
    path("reschedule-booking/", views.reschedule_booking,
         name="reschedule_booking"),
    path("cancel-booking/", views.cancel_booking, name="cancel_booking"),
    path("get-payment-info/", views.get_card_info, name="get_card_info"),
    path('search/', views.find_route_by_points, name='find_route_by_points'),
    path('routes/<int:page>/', views.list_routes, name='list_routes'),
    path('suggest-boarding-points/', views.search_boarding_points,
         name='find_route_by_points'),
    path('bus-trip/', views.get_bus_trip, name='get_bus_trip'),
    path('ongoing-bookings/', views.get_ongoing_bookings,
         name='get_ongoing_bookings'),
    path('booking-history/', views.booking_history,
         name='booking_history'),
    path('app-update/', views.passenger_update, name='passenger_update'),
    path('register-FCM-token/', views.register_FCM_token,
         name='register_FCM_token'),
    path('webhooks/payments/', views.genie_webhook, name='payment-webhook'),
    path('map-data/<str:booking_id>/', views.map_data,  name='map_data'),
    path('send-departure-alerts/', views.send_departure_alerts,
         name='send_departure_alerts'),
    path('send-notification/', views.send_notification, name='send_notification'),




]
