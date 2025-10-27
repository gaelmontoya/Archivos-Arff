from django.shortcuts import render 

def upload_page(request):
    return render(request, 'app_arff/upload.html')


def result_page(request):
    return render(request, 'app_arff/result.html')