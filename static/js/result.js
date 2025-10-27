class ARFFResults {
    constructor() {
        this.data = null;
        this.filteredData = null;
        this.currentSearch = '';
        
        this.init();
    }

    init() {
        // Cargar datos desde sessionStorage
        const storedData = sessionStorage.getItem('arffData');
        
        if (!storedData) {
            this.showError('No se encontraron datos. Por favor sube un archivo ARFF primero.');
            return;
        }

        try {
            this.data = JSON.parse(storedData);
            this.filteredData = [...this.data.data];
            this.render();
        } catch (error) {
            console.error('Error parsing stored data:', error);
            this.showError('Error al cargar los datos almacenados.');
        }
    }

    render() {
        this.renderDatasetInfo();
        this.renderTable();
        this.initEventListeners();
    }

    renderDatasetInfo() {
        const infoContainer = document.getElementById('datasetInfo');
        
        infoContainer.innerHTML = `
            <div class="info-item">
                <span class="info-label">Archivo</span>
                <span class="info-value">${this.data.filename}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Filas</span>
                <span class="info-value">${AppUtils.formatNumber(this.data.shape.rows)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Columnas</span>
                <span class="info-value">${AppUtils.formatNumber(this.data.shape.columns)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Relación</span>
                <span class="info-value">${this.data.relation || 'N/A'}</span>
            </div>
        `;
    }

    renderTable() {
        this.renderTableHeader();
        this.renderTableBody();
        this.updateRowCount();
    }

    renderTableHeader() {
        const headerContainer = document.getElementById('tableHeader');
        
        headerContainer.innerHTML = `
            <tr>
                ${this.data.columns.map(col => 
                    `<th>${this.escapeHTML(col)}</th>`
                ).join('')}
            </tr>
        `;
    }

    renderTableBody() {
        const bodyContainer = document.getElementById('tableBody');
        const dataToShow = this.filteredData.slice(0, 100); // Mostrar primeras 100 filas

        if (dataToShow.length === 0) {
            bodyContainer.innerHTML = `
                <tr>
                    <td colspan="${this.data.columns.length}" class="no-data">
                        No se encontraron datos que coincidan con la búsqueda
                    </td>
                </tr>
            `;
            return;
        }

        bodyContainer.innerHTML = dataToShow.map(row => `
            <tr>
                ${this.data.columns.map(col => 
                    `<td>${this.formatCellValue(row[col])}</td>`
                ).join('')}
            </tr>
        `).join('');

        // Actualizar contadores
        document.getElementById('shownRows').textContent = 
            AppUtils.formatNumber(Math.min(this.filteredData.length, 100));
        document.getElementById('totalRows').textContent = 
            AppUtils.formatNumber(this.filteredData.length);
    }

    formatCellValue(value) {
        if (value === null || value === undefined) {
            return '<span class="null-value">NULL</span>';
        }
        
        const strValue = String(value);
        
        // Escapar HTML y truncar strings muy largos
        const escapedValue = this.escapeHTML(strValue);
        
        if (strValue.length > 50) {
            return `<span title="${escapedValue}">${escapedValue.substring(0, 47)}...</span>`;
        }
        
        return escapedValue;
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    initEventListeners() {
        // Búsqueda en tiempo real
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.currentSearch = e.target.value.toLowerCase();
            this.filterData();
            this.renderTableBody();
        });

        // Limpiar datos al salir de la página
        window.addEventListener('beforeunload', () => {
            sessionStorage.removeItem('arffData');
        });
    }

    filterData() {
        if (!this.currentSearch.trim()) {
            this.filteredData = [...this.data.data];
            return;
        }

        this.filteredData = this.data.data.filter(row => {
            return Object.values(row).some(value => 
                String(value).toLowerCase().includes(this.currentSearch)
            );
        });
    }

    updateRowCount() {
        const rowCountEl = document.getElementById('rowCount');
        if (rowCountEl) {
            rowCountEl.textContent = `${AppUtils.formatNumber(this.filteredData.length)} filas`;
        }
    }

    showError(message) {
        const container = document.querySelector('.results-container');
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3>Error</h3>
                <p>${message}</p>
                <a href="/" class="back-btn">Volver a subir archivo</a>
            </div>
        `;
    }
}

// Estilos adicionales para la tabla
const additionalStyles = `
    .no-data {
        text-align: center;
        color: #718096;
        font-style: italic;
        padding: 2rem !important;
    }
    
    .null-value {
        color: #cbd5e0;
        font-style: italic;
    }
    
    .error-state {
        text-align: center;
        padding: 4rem 2rem;
    }
    
    .error-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
    }
    
    .error-state h3 {
        color: #e53e3e;
        margin-bottom: 1rem;
    }
    
    .data-table td span[title] {
        cursor: help;
        border-bottom: 1px dotted #cbd5e0;
    }
`;

// Agregar estilos adicionales
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new ARFFResults();
});