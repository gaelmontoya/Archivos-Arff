from django.urls import path
from . import views
from .api_views import ARFFUploadAPI  # ← Cambiado de views a api_views

urlpatterns = [
    # Frontend routes
    path('', views.upload_page, name='upload_page'),
    path('results/', views.result_page, name='result_page'),
    
    # API routes
    path('api/upload/', ARFFUploadAPI.as_view(), name='api_upload'),
]