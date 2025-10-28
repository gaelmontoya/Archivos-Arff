from django.urls import path
from . import views
from .api_views import ARFFUploadAPI, ARFFDataAPI

urlpatterns = [
   
    path('', views.upload_page, name='upload_page'),
    path('results/', views.result_page, name='result_page'),
    
    
    path('api/upload/', ARFFUploadAPI.as_view(), name='api_upload'),
    path('api/data/', ARFFDataAPI.as_view(), name='api_data'),
]