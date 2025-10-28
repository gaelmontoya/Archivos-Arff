class ARFFUploader {
    constructor() {
        this.fileInput = document.getElementById('arffFile');
        this.uploadForm = document.getElementById('uploadForm');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.removeBtn = document.getElementById('removeFile');
        this.messageEl = document.getElementById('message');

        this.initEventListeners();
    }

    initEventListeners() {
        // Cambio en selección de archivo
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // Drag and drop
        const fileLabel = document.querySelector('.file-label');
        fileLabel.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = '#667eea';
            fileLabel.style.background = 'rgba(102, 126, 234, 0.1)';
        });

        fileLabel.addEventListener('dragleave', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = '#cbd5e0';
            fileLabel.style.background = 'rgba(255, 255, 255, 0.8)';
        });

        fileLabel.addEventListener('drop', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = '#cbd5e0';
            fileLabel.style.background = 'rgba(255, 255, 255, 0.8)';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        // Remover archivo
        this.removeBtn.addEventListener('click', () => {
            this.clearFileSelection();
        });

        // Envío del formulario
        this.uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUpload();
        });
    }

    handleFileSelect(file) {
        if (!AppUtils.isValidARFFFile(file)) {
            this.clearFileSelection();
            return;
        }

        // Mostrar información del archivo
        this.fileName.textContent = file.name;
        this.fileInfo.classList.remove('hidden');
        this.uploadBtn.disabled = false;

        AppUtils.showMessage(`Archivo "${file.name}" seleccionado correctamente`, 'success');
    }

    clearFileSelection() {
        this.fileInput.value = '';
        this.fileInfo.classList.add('hidden');
        this.uploadBtn.disabled = true;
        this.messageEl.classList.add('hidden');
    }

    async handleUpload() {
    const file = this.fileInput.files[0];
    console.log('🔍 DEBUG - Archivo a subir:', file);
    
    if (!file) {
        AppUtils.showMessage('Por favor selecciona un archivo', 'error');
        return;
    }

    AppUtils.setLoading(this.uploadBtn, true);

    try {
        const formData = new FormData();
        formData.append('file', file);
        
        console.log('📤 DEBUG - FormData contenido:');
        for (let pair of formData.entries()) {
            console.log('   ', pair[0] + ':', pair[1]);
        }

        const response = await fetch('/api/upload/', {
            method: 'POST',
            body: formData
        });

        console.log(' DEBUG - Respuesta del servidor:', response.status, response.statusText);
        
        // OBTENER EL TEXTO DEL ERROR
        const responseText = await response.text();
        console.log(' DEBUG - Respuesta completa:', responseText);
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error(' DEBUG - Error parseando JSON:', e);
            this.handleError('Respuesta inválida del servidor: ' + responseText);
            return;
        }

        console.log(' DEBUG - Resultado parseado:', result);

        if (response.ok && result.success) {
            this.handleSuccess(result);
        } else {
            this.handleError(result.error || 'Error al procesar el archivo');
        }
    } catch (error) {
        console.error(' DEBUG - Error de red:', error);
        this.handleError('Error de conexión. Intenta nuevamente.');
    } finally {
        AppUtils.setLoading(this.uploadBtn, false);
    }
}
    handleSuccess(data) {
        console.log('DEBUG - Éxito, datos recibidos:', data);  
        // Guardar datos en sessionStorage para la página de resultados
        sessionStorage.setItem('arffData', JSON.stringify(data));
        
        // Redirigir a la página de resultados
        window.location.href = '/results/';
    }

    handleError(errorMessage) {
        console.error('❌ DEBUG - Error:', errorMessage); 
        AppUtils.showMessage(errorMessage, 'error');
        this.clearFileSelection();
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new ARFFUploader();
});