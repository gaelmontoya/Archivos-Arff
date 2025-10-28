
class AppUtils {
   
    static showMessage(message, type = 'success') {
        const messageEl = document.getElementById('message');
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.className = `message ${type}`;
        messageEl.classList.remove('hidden');

        
        setTimeout(() => {
            messageEl.classList.add('hidden');
        }, 5000);
    }

    
    static formatNumber(num) {
        return new Intl.NumberFormat('es-ES').format(num);
    }

    static isValidARFFFile(file) {
        if (!file) return false;
        if (!file.name.toLowerCase().endsWith('.arff')) return false;
        if (file.size > 10 * 1024 * 1024) { // 10MB
            this.showMessage('El archivo es demasiado grande (máximo 10MB)', 'error');
            return false;
        }
        return true;
    }

   
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


window.addEventListener('error', (event) => {
    console.error('❌ ERROR GLOBAL:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
    });
    
   
    if (!event.filename.includes('.ico') && !event.filename.includes('.png')) {
        AppUtils.showMessage('Error en la aplicación. Revisa la consola para detalles.', 'error');
    }
});


window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ PROMISE REJECTION:', event.reason);
    AppUtils.showMessage('Error en la aplicación. Revisa la consola para detalles.', 'error');
});