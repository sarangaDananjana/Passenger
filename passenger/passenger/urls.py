"""
URL configuration for passenger project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings  # new
from django.conf.urls.static import static  # new
from bus_owners.views import home_page_form
from .settings import refresh_tokens, logout, validate_machine

urlpatterns = [
    path('', home_page_form),
    path('admin/', admin.site.urls),
    path('refresh/', refresh_tokens),
    path('validate-machine/', validate_machine),
    path('logout/', logout),
    path('core/', include('core.urls')),
    path('members/', include('members.urls')),
    path('bus-owners/', include('bus_owners.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL,
                          document_root=settings.STATIC_URL)
