from django.urls import path
from . import views


urlpatterns = [
    path("register-or-login/", views.register_or_login_owner, name="create_route"),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('owner-details/', views.owner_details, name='owner_details'),
    path('owner-buses/', views.get_owner_buses, name='get_owner_buses'),
    path('create-bus/', views.create_bus, name='create_bus'),
    path('update-bus/', views.update_bus, name='update_bus'),
    path('get-bus/', views.get_bus_by_id, name='get_bus'),
    path('bus-trip-details/', views.get_trips_by_bus, name='admin_home'),
    path('trips/add-ticket/', views.add_ticket, name='add-ticket'),
    path('trips/add-all-ticket/', views.add_all_tickets, name='add_all_tickets'),
    path('trips/view-tickets/', views.trip_tickets, name='trip_tickets'),
    path('machine-login/', views.machine_login, name='machine_login'),
    path('started-bus-trip/', views.get_started_bus_trip,
         name="get_started_bus_trip"),
    path('toggle-machine-button/', views.toggle_machine_button,
         name='toggle_machine_button'),
    path('routes/', views.get_route_info, name='get_route_info'),
    path('bus-fare/', views.get_bus_fare, name='get_bus_fare'),
    path('list-fare-types/', views.list_fare_types, name='list_fare_types'),
    path('verify-booking/', views.verify_booking, name='verify_booking'),
    path('complete-trip/', views.complete_bookings, name='complete-bookings'),
    path('off-machine/', views.turn_machine_off, name='turn_machine_off'),




    ###################### Web Urls ###############################################
    path('web/verify-otp/', views.verify_otp_form, name='verify_owner_otp_form'),
    path('web/login-or-register/', views.login_or_register_form,
         name='login_or_register_form'),
    path('web/index/', views.home_page_form, name='index'),
    path('web/privacy-policy/', views.privacy_policy_page,
         name='privacy_policy_page'),
    path('web/dashboard/', views.dashboard_page_form, name='dashboard'),
    path('web/ticket-graph/<str:trip_id>/',
         views.ticket_graph_view, name='ticket_graph'),
    path('web/owner-details/', views.owner_details_page_form, name='ownerDetails'),
    path('web/bookedSeat/', views.seatBook_page_form, name='bookedSeat'),
    path('web/manageBusTrip/', views.manage_bus_trip_form, name='manageBusTrip'),
    path('web/manageBusses/', views.manage_bus_form, name='manageBusses'),
    path('web/sidebar/', views.sidebar_form, name='sidebar')

]
