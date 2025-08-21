from django.urls import path
from . import views

urlpatterns = [
    path("admin-login/", views.admin_login, name="admin_login"),
    path("validate-admin/", views.validate_admin, name="validate_admin"),
    path("edit-route/", views.create_edit_route, name="edit_route"),
    path("route/<str:route_id>/", views.get_route_info, name="get_route_info"),
    path('bus-trip/', views.create_bus_trip_api,
         name='create-bus-trip'),
    path('routes/', views.route_search, name='route-search'),
    path('edit-boarding-point/', views.create_edit_boarding_point,
         name='edit_boarding_point'),
    path('add_bp_to_route/', views.add_boarding_point_to_route,
         name='add_boarding_point_to_route'),


    path('web/admin-login/', views.admin_login_form, name='admin_login_form'),
    path('web/edit-boarding-point/', views.edit_bp_form, name='edit_bp_form'),
    path('web/create-route-page/', views.show_create_route_page,
         name='show_create_route_page'),
    path("web/edit-routes/<str:route_id>/",
         views.route_detail, name="route_detail"),
    path('web/admin-dashboard/', views.show_admin_dashboard,
         name='show_admin_dashboard'),

]
