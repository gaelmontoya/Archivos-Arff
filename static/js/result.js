class ARFFResults {
    constructor() {
        this.metadata = null;
        this.allData = [];
        this.filteredData = null;
        this.currentSearch = '';
        this.currentPage = 1;
        this.rowsPerPage = 100;
        this.totalRows = 0;
        this.cacheKey = null;
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        const storedData = sessionStorage.getItem('arffData');
        
        if (!storedData) {
            this.showError('No se encontraron datos. Por favor sube un archivo ARFF primero.');
            return;
        }

        try {
            this.metadata = JSON.parse(storedData);
            this.allData = this.metadata.data;
            this.filteredData = [...this.allData];
            this.totalRows = this.metadata.shape.rows;
            this.cacheKey = this.metadata.cache_key;
            
            console.log(`📊 Datos iniciales: ${this.allData.length} de ${this.totalRows} filas`);
            
            this.render();
            
            if (this.metadata.has_more) {
                this.loadAllDataInBackground();
            }
        } catch (error) {
            console.error('Error parsing stored data:', error);
            this.showError('Error al cargar los datos almacenados.');
        }
    }

    async loadAllDataInBackground() {
        console.log('🔄 Cargando datos completos en background...');
        
        let currentPage = 2;
        const pageSize = 5000;
        
        while (this.allData.length < this.totalRows && !this.isLoading) {
            try {
                const response = await fetch(
                    `/api/data/?cache_key=${this.cacheKey}&page=${currentPage}&page_size=${pageSize}`
                );
                
                if (!response.ok) {
                    console.error('Error cargando datos adicionales');
                    break;
                }
                
                const result = await response.json();
                
                if (result.success && result.data.length > 0) {
                    this.allData.push(...result.data);
                    console.log(`📥 Cargados ${this.allData.length} de ${this.totalRows} filas`);
                    
                    if (!this.currentSearch) {
                        this.filteredData = [...this.allData];
                        this.renderPagination();
                    }
                    
                    this.updateLoadedCount();
                    currentPage++;
                    
                    if (!result.has_next) break;
                } else {
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error('Error en carga background:', error);
                break;
            }
        }
        
        console.log(`✅ Carga completa: ${this.allData.length} filas`);
    }

    async loadPageData(page) {
        if (this.isLoading) return;
        
        const startIdx = (page - 1) * this.rowsPerPage;
        const endIdx = startIdx + this.rowsPerPage;
        
        if (this.filteredData.length > endIdx || this.allData.length >= this.totalRows) {
            return;
        }
        
        this.isLoading = true;
        this.showLoadingIndicator(true);
        
        try {
            const serverPage = Math.ceil(endIdx / 1000);
            
            const response = await fetch(
                `/api/data/?cache_key=${this.cacheKey}&page=${serverPage}&page_size=1000&search=${this.currentSearch}`
            );
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.success) {
                    const newData = result.data;
                    this.allData.push(...newData);
                    
                    if (!this.currentSearch) {
                        this.filteredData = [...this.allData];
                    }
                    
                    console.log(`📥 Página ${serverPage} cargada: +${newData.length} filas`);
                }
            }
        } catch (error) {
            console.error('Error cargando página:', error);
        } finally {
            this.isLoading = false;
            this.showLoadingIndicator(false);
        }
    }

    showLoadingIndicator(show) {
        let indicator = document.getElementById('loadingIndicator');
        
        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'loadingIndicator';
                indicator.innerHTML = `
                    <div style="text-align: center; padding: 1rem; color: #667eea;">
                        <div class="loading-spinner" style="margin: 0 auto;"></div>
                        <p style="margin-top: 0.5rem;">Cargando más datos...</p>
                    </div>
                `;
                document.querySelector('.table-footer').prepend(indicator);
            }
        } else {
            if (indicator) {
                indicator.remove();
            }
        }
    }

    render() {
        this.renderDatasetInfo();
        this.renderTable();
        this.renderPagination();
        this.initEventListeners();
    }

    renderDatasetInfo() {
        const infoContainer = document.getElementById('datasetInfo');
        
        infoContainer.innerHTML = `
            <div class="info-item">
                <span class="info-label">Archivo</span>
                <span class="info-value">${this.metadata.filename}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Filas Totales</span>
                <span class="info-value">${AppUtils.formatNumber(this.totalRows)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Columnas</span>
                <span class="info-value">${AppUtils.formatNumber(this.metadata.shape.columns)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Filas Cargadas</span>
                <span class="info-value" id="loadedRowsCount">${AppUtils.formatNumber(this.allData.length)}</span>
            </div>
        `;
    }

    updateLoadedCount() {
        const loadedCount = document.getElementById('loadedRowsCount');
        if (loadedCount) {
            loadedCount.textContent = AppUtils.formatNumber(this.allData.length);
        }
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
                <th style="width: 60px;">#</th>
                ${this.metadata.columns.map(col => 
                    `<th>${this.escapeHTML(col)}</th>`
                ).join('')}
            </tr>
        `;
    }

    renderTableBody() {
        const bodyContainer = document.getElementById('tableBody');
        
        const startIdx = (this.currentPage - 1) * this.rowsPerPage;
        const endIdx = startIdx + this.rowsPerPage;
        const dataToShow = this.filteredData.slice(startIdx, endIdx);

        if (dataToShow.length === 0) {
            bodyContainer.innerHTML = `
                <tr>
                    <td colspan="${this.metadata.columns.length + 1}" class="no-data">
                        ${this.currentSearch ? 'No se encontraron datos que coincidan con la búsqueda' : 'No hay datos para mostrar'}
                    </td>
                </tr>
            `;
            return;
        }

        bodyContainer.innerHTML = dataToShow.map((row, idx) => `
            <tr>
                <td class="row-number">${startIdx + idx + 1}</td>
                ${this.metadata.columns.map(col => 
                    `<td>${this.formatCellValue(row[col])}</td>`
                ).join('')}
            </tr>
        `).join('');
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.rowsPerPage);
        const paginationContainer = document.getElementById('pagination');
        
        if (totalPages <= 1 && this.allData.length >= this.totalRows) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        let html = '<div class="pagination-controls">';
        
        html += `
            <button class="page-btn" onclick="arffResults.goToPage(${this.currentPage - 1})" 
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                ← Anterior
            </button>
        `;
        
        const maxButtons = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
        
        if (startPage > 1) {
            html += `<button class="page-btn" onclick="arffResults.goToPage(1)">1</button>`;
            if (startPage > 2) html += `<span class="page-dots">...</span>`;
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                        onclick="arffResults.goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="page-dots">...</span>`;
            html += `<button class="page-btn" onclick="arffResults.goToPage(${totalPages})">${totalPages}</button>`;
        }
        
        if (this.allData.length < this.totalRows) {
            html += `<span class="page-dots" style="color: #667eea;"> cargando...</span>`;
        }
        
        html += `
            <button class="page-btn" onclick="arffResults.goToPage(${this.currentPage + 1})" 
                    ${this.currentPage === totalPages && this.allData.length >= this.totalRows ? 'disabled' : ''}>
                Siguiente →
            </button>
        `;
        
        html += '</div>';
        
        html += `
            <div class="rows-per-page">
                <label>Filas por página:</label>
                <select id="rowsPerPageSelect" onchange="arffResults.changeRowsPerPage(this.value)">
                    <option value="50" ${this.rowsPerPage === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${this.rowsPerPage === 100 ? 'selected' : ''}>100</option>
                    <option value="250" ${this.rowsPerPage === 250 ? 'selected' : ''}>250</option>
                    <option value="500" ${this.rowsPerPage === 500 ? 'selected' : ''}>500</option>
                    <option value="1000" ${this.rowsPerPage === 1000 ? 'selected' : ''}>1000</option>
                </select>
            </div>
        `;
        
        paginationContainer.innerHTML = html;
    }

    async goToPage(page) {
        const totalPages = Math.ceil(this.filteredData.length / this.rowsPerPage);
        if (page < 1 || (page > totalPages && this.allData.length >= this.totalRows)) return;
        
        this.currentPage = page;
        
        await this.loadPageData(page);
        
        this.renderTableBody();
        this.renderPagination();
        this.updateRowCount();
        
        document.querySelector('.data-table-container').scrollIntoView({ behavior: 'smooth' });
    }

    changeRowsPerPage(value) {
        this.rowsPerPage = parseInt(value);
        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
    }

    formatCellValue(value) {
        if (value === null || value === undefined) {
            return '<span class="null-value">NULL</span>';
        }
        
        const strValue = String(value);
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
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.currentSearch = e.target.value.toLowerCase();
                this.currentPage = 1;
                this.filterData();
                this.renderTable();
                this.renderPagination();
            }, 300);
        });

        window.addEventListener('beforeunload', () => {
            sessionStorage.removeItem('arffData');
        });
    }

    filterData() {
        if (!this.currentSearch.trim()) {
            this.filteredData = [...this.allData];
            return;
        }

        this.filteredData = this.allData.filter(row => {
            return Object.values(row).some(value => 
                String(value).toLowerCase().includes(this.currentSearch)
            );
        });
    }

    updateRowCount() {
        const startIdx = (this.currentPage - 1) * this.rowsPerPage + 1;
        const endIdx = Math.min(this.currentPage * this.rowsPerPage, this.filteredData.length);
        
        document.getElementById('shownRows').textContent = 
            `${AppUtils.formatNumber(startIdx)}-${AppUtils.formatNumber(endIdx)}`;
        document.getElementById('totalRows').textContent = 
            AppUtils.formatNumber(this.filteredData.length);
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


const styles = `
    .pagination-wrapper {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 1.5rem;
        gap: 1rem;
        flex-wrap: wrap;
    }
    
    .pagination-controls {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
    }
    
    .page-btn {
        padding: 0.5rem 1rem;
        border: 1px solid #e2e8f0;
        background: white;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
        min-width: 40px;
    }
    
    .page-btn:hover:not(:disabled) {
        background: #667eea;
        color: white;
        border-color: #667eea;
        transform: translateY(-1px);
    }
    
    .page-btn.active {
        background: #667eea;
        color: white;
        border-color: #667eea;
    }
    
    .page-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .page-dots {
        padding: 0.5rem;
        color: #718096;
        font-size: 0.9rem;
    }
    
    .rows-per-page {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .rows-per-page label {
        color: #718096;
        font-size: 0.9rem;
        font-weight: 500;
    }
    
    .rows-per-page select {
        padding: 0.5rem 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-size: 0.9rem;
    }
    
    .rows-per-page select:focus {
        outline: none;
        border-color: #667eea;
    }
    
    .row-number {
        color: #a0aec0;
        font-weight: 600;
        text-align: center;
        font-size: 0.85rem;
        background: rgba(102, 126, 234, 0.05);
    }
    
    .no-data {
        text-align: center;
        color: #718096;
        font-style: italic;
        padding: 3rem !important;
    }
    
    .null-value {
        color: #cbd5e0;
        font-style: italic;
        font-size: 0.85rem;
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
        font-size: 1.5rem;
    }
    
    .error-state p {
        color: #718096;
        margin-bottom: 2rem;
    }
    
    .data-table td span[title] {
        cursor: help;
        border-bottom: 1px dotted #cbd5e0;
    }
    
    .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #f3f4f6;
        border-top: 2px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        display: inline-block;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @media (max-width: 768px) {
        .pagination-wrapper {
            flex-direction: column;
            align-items: stretch;
        }
        
        .pagination-controls {
            justify-content: center;
        }
        
        .rows-per-page {
            justify-content: center;
        }
        
        .page-btn {
            padding: 0.4rem 0.8rem;
            font-size: 0.85rem;
        }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

let arffResults;

document.addEventListener('DOMContentLoaded', () => {
    arffResults = new ARFFResults();
});