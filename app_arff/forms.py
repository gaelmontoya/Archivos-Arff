from django import forms 

class ARFFUploadForm(forms.Form):
    arff_file = forms.FileField(
        label='subir archivo ARFF',
        help_text='Formatos aceptados: .arff',
        widget=forms.FileInput(attrs={
            'accept': '.arff',
            'class': 'form-control'
            
            })
    )
    

