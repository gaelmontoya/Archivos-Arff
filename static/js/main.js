// Utilidades generales para toda la aplicación
class AppUtils {
    // Mostrar notificación
    static showMessage(message, type = 'success') {
        const messageEl = document.getElementById('message');
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.className = `message ${type}`;
        messageEl.classList.remove('hidden');

        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            messageEl.classList.add('hidden');
        }, 5000);
    }

    // Formatear números grandes
    static formatNumber(num) {
        return new Intl.NumberFormat('es-ES').format(num);
    }

    // Validar archivo ARFF
    static isValidARFFFile(file) {
        if (!file) return false;
        if (!file.name.toLowerCase().endsWith('.arff')) return false;
        if (file.size > 10 * 1024 * 1024) { // 10MB
            this.showMessage('El archivo es demasiado grande (máximo 10MB)', 'error');
            return false;
        }
        return true;
    }

    // Mostrar/ocultar loading
    static setLoading(button, isLoading) {
        const btnText = button.querySelector('.btn-text');
        const spinner = button.querySelector('.loading-spinner');
        
        if (isLoading) {
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
            button.disabled = true;
        } else {
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
            button.disabled = false;
        }
    }
}

// Manejo de errores global - MÁS INFORMATIVO
window.addEventListener('error', (event) => {
    console.error('❌ ERROR GLOBAL:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
    });
    
    // Solo mostrar mensaje si no es un error de recurso (imágenes, etc.)
    if (!event.filename.includes('.ico') && !event.filename.includes('.png')) {
        AppUtils.showMessage('Error en la aplicación. Revisa la consola para detalles.', 'error');
    }
});

// También capturar errores de promesas no manejadas
window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ PROMISE REJECTION:', event.reason);
    AppUtils.showMessage('Error en la aplicación. Revisa la consola para detalles.', 'error');
});