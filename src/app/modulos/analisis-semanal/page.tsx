'use client';

import { useState, useEffect } from 'react';

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ConnectionStatus {
  supabase: boolean;
  mysql: boolean;
}

interface ProcessingDetail {
  sku: string;
  cuenta: string;
  action: string;
}

interface UploadResult {
  success: boolean;
  updated?: number;
  inserted?: number;
  noSales?: number;
  total?: number;
  message?: string;
  error?: string;
  errorType?: 'invalid_file_type' | 'empty_file' | 'invalid_structure' | 'general';
  headers?: string[];
  missing?: string[];
  details?: ProcessingDetail[];
}

// Nodos disponibles
const NODOS = [
  { value: 'Mercadolibre_Chile', label: '🇨🇱 Mercado Libre Chile' },
  { value: 'Falabella_Chile', label: '🏬 Falabella Chile' },
  { value: 'Paris_Chile', label: '🛍️ Paris Chile' },
  { value: 'Ripley_Chile', label: '🏪 Ripley Chile' },
];

export default function AnalisisSemanalPage() {
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedNodo, setSelectedNodo] = useState<string>('Mercadolibre_Chile');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    supabase: false,
    mysql: false
  });
  const [showResultModal, setShowResultModal] = useState(false);
  const [lastResult, setLastResult] = useState<UploadResult | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // Obtener semana actual en formato YYYYWW
  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    setSelectedWeek(`${now.getFullYear()}${weekNumber.toString().padStart(2, '0')}`);
    
    // Verificar conexiones al cargar
    checkConnections();
  }, []);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const now = new Date();
    const time = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      time,
      message,
      type
    };
    setLogs(prev => [entry, ...prev]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const checkConnections = async () => {
    try {
      const response = await fetch('/api/check-connections');
      const data = await response.json();
      setConnectionStatus(data);
      
      if (data.supabase) {
        addLog('Conexión a Supabase establecida', 'success');
      }
      if (data.mysql) {
        addLog('Conexión a MySQL establecida', 'success');
      }
      if (!data.mysql) {
        addLog('MySQL no disponible - Se requiere carga manual de datos', 'warning');
      }
    } catch {
      addLog('Error verificando conexiones', 'error');
    }
  };

  const handleLoadDemandPlan = async () => {
    setLoading(prev => ({ ...prev, loadPlan: true }));
    addLog(`Iniciando carga de Plan de Demanda para semana ${selectedWeek} - Nodo: ${selectedNodo}...`, 'info');
    
    // Crear input de archivo temporal
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        addLog(`Procesando archivo: ${file.name}`, 'info');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('week', selectedWeek);
        formData.append('nodo', selectedNodo);
        formData.append('type', 'plan'); // Indicar que es carga de plan
        
        try {
          const response = await fetch('/api/upload-plan-csv', {
            method: 'POST',
            body: formData
          });
          
          const data = await response.json();
          
          if (data.success) {
            addLog(`Plan cargado: ${data.inserted} registros insertados`, 'success');
            setLastResult(data);
            setShowResultModal(true);
          } else {
            addLog(`Error: ${data.error}`, 'error');
          }
        } catch (error) {
          addLog(`Error al cargar plan: ${error}`, 'error');
        }
      }
      setLoading(prev => ({ ...prev, loadPlan: false }));
    };
    input.oncancel = () => {
      setLoading(prev => ({ ...prev, loadPlan: false }));
    };
    input.click();
  };

  const handleUpdateRealSales = async () => {
    setLoading(prev => ({ ...prev, updateSales: true }));
    addLog(`Consultando ventas reales para semana ${selectedWeek}...`, 'info');
    
    try {
      const response = await fetch('/api/update-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: selectedWeek, nodo: selectedNodo })
      });
      
      const data = await response.json();
      
      if (data.success) {
        addLog(`Ventas actualizadas: ${data.updated} registros modificados`, 'success');
      } else {
        addLog(`Error: ${data.error}`, 'error');
      }
    } catch (error) {
      addLog(`Error al actualizar ventas: ${error}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, updateSales: false }));
    }
  };

  const handleUpdateStock = async () => {
    setLoading(prev => ({ ...prev, updateStock: true }));
    addLog(`Actualizando disponibilidad/stock para semana ${selectedWeek} - Nodo: ${selectedNodo}...`, 'info');
    
    try {
      const response = await fetch('/api/update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: selectedWeek, nodo: selectedNodo })
      });
      
      const data = await response.json();
      
      if (data.success) {
        addLog(`✅ ${data.message}`, 'success');
        addLog(`   📅 Fecha de stock: ${data.mondayDate}`, 'info');
        addLog(`   📦 Registros de stock encontrados: ${data.totalStock}`, 'info');
        if (data.updated > 0) addLog(`   📝 Con stock actualizado: ${data.updated}`, 'info');
        if (data.inserted > 0) addLog(`   ➕ Nuevos insertados (stock sin plan): ${data.inserted}`, 'info');
        if (data.notFound > 0) addLog(`   ⭕ Sin stock (→0): ${data.notFound}`, 'warning');
        
        // Mostrar modal de éxito
        setLastResult({
          success: true,
          updated: data.updated,
          inserted: data.inserted,
          noSales: data.notFound, // Reutilizamos noSales para "sin stock"
          message: data.message,
          // Agregar info extra para el modal
          ...data
        });
        setShowResultModal(true);
      } else {
        // Mostrar error en el modal para mejor visibilidad
        setLastResult({
          success: false,
          error: data.error,
          errorType: data.errorType
        });
        setShowResultModal(true);
        addLog(`❌ Error actualizando stock`, 'error');
        if (data.mondayDate) {
          addLog(`   📅 Fecha buscada: ${data.mondayDate}`, 'info');
        }
        if (data.availableDates && data.availableDates.length > 0) {
          addLog(`   📅 Fechas disponibles: ${data.availableDates.join(', ')}`, 'warning');
        }
      }
    } catch (error) {
      addLog(`Error al actualizar stock: ${error}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, updateStock: false }));
    }
  };

  const handleViewReport = async () => {
    setLoading(prev => ({ ...prev, viewReport: true }));
    addLog(`Generando reporte para semana ${selectedWeek} - Nodo: ${selectedNodo}...`, 'info');
    
    try {
      const response = await fetch(`/api/report?week=${selectedWeek}&nodo=${selectedNodo}`);
      const data = await response.json();
      
      if (data.success) {
        addLog(`Reporte generado: ${data.totalRecords} registros`, 'success');
        // TODO: Mostrar modal con reporte
      } else {
        addLog(`Error: ${data.error}`, 'error');
      }
    } catch (error) {
      addLog(`Error al generar reporte: ${error}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, viewReport: false }));
    }
  };

  const handleUploadCSV = async () => {
    setLoading(prev => ({ ...prev, uploadCSV: true }));
    setProcessingStatus('Seleccionando archivo...');
    addLog(`Abriendo selector de archivo CSV para ventas...`, 'info');
    
    // Crear input de archivo temporal
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        setProcessingStatus(`Subiendo archivo: ${file.name} (${fileSizeMB} MB)...`);
        addLog(`Procesando archivo de ventas: ${file.name} (${fileSizeMB} MB)`, 'info');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('week', selectedWeek);
        formData.append('nodo', selectedNodo);
        
        // Mostrar progreso estimado
        const startTime = Date.now();
        const progressInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setProcessingStatus(`Procesando... ${elapsed}s transcurridos`);
        }, 1000);
        
        try {
          const response = await fetch('/api/upload-sales-csv', {
            method: 'POST',
            body: formData
          });
          
          clearInterval(progressInterval);
          
          const data: UploadResult = await response.json();
          
          if (data.success) {
            setProcessingStatus('');
            addLog(`✅ ${data.message}`, 'success');
            if (data.updated) addLog(`   📝 Actualizados: ${data.updated}`, 'info');
            if (data.inserted) addLog(`   ➕ Nuevos insertados: ${data.inserted}`, 'info');
            if (data.noSales) addLog(`   ⭕ Sin venta (→0): ${data.noSales}`, 'info');
            
            setLastResult(data);
            setShowResultModal(true);
          } else {
            setProcessingStatus('');
            addLog(`Error procesando CSV: ${data.error}`, 'error');
            setLastResult(data);
            setShowResultModal(true);
          }
        } catch (error) {
          clearInterval(progressInterval);
          setProcessingStatus('');
          addLog(`Error al subir CSV: ${error}`, 'error');
        }
      }
      setLoading(prev => ({ ...prev, uploadCSV: false }));
    };
    input.oncancel = () => {
      setLoading(prev => ({ ...prev, uploadCSV: false }));
      setProcessingStatus('');
    };
    input.click();
  };

  const handleUploadEscenarios = async () => {
    setLoading(prev => ({ ...prev, uploadEscenarios: true }));
    addLog(`Abriendo selector de archivo CSV para escenarios...`, 'info');
    
    // Crear input de archivo temporal
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        addLog(`Procesando archivo de escenarios: ${file.name}`, 'info');
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const response = await fetch('/api/upload-escenarios-csv', {
            method: 'POST',
            body: formData
          });
          
          const data = await response.json();
          
          if (data.success) {
            addLog(`✅ ${data.message}`, 'success');
            addLog(`   📊 Escenarios procesados: ${data.totalProcesados}`, 'info');
            if (data.inserted) addLog(`   ➕ Registros cargados: ${data.inserted}`, 'info');
            if (data.erroresLinea > 0) addLog(`   ⚠️ Errores en líneas: ${data.erroresLinea}`, 'warning');
            
            setLastResult({
              success: true,
              inserted: data.inserted,
              message: data.message,
              details: data.details
            });
            setShowResultModal(true);
          } else {
            addLog(`Error procesando escenarios: ${data.error}`, 'error');
            setLastResult({
              success: false,
              error: data.error,
              errorType: data.errorType,
              headers: data.headers,
              missing: data.missing
            });
            setShowResultModal(true);
          }
        } catch (error) {
          addLog(`Error al subir escenarios: ${error}`, 'error');
        }
      }
      setLoading(prev => ({ ...prev, uploadEscenarios: false }));
    };
    input.oncancel = () => {
      setLoading(prev => ({ ...prev, uploadEscenarios: false }));
    };
    input.click();
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getNodoLabel = (value: string) => {
    return NODOS.find(n => n.value === value)?.label || value;
  };

  return (
    <div className="module-container">
      {/* Header del módulo */}
      <header className="module-header">
        <h1 className="module-title">📊 Análisis Semanal</h1>
        <p className="module-subtitle">Control y análisis de demanda por semana</p>
      </header>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-item">
          <span className={`status-dot ${connectionStatus.supabase ? 'connected' : 'disconnected'}`}></span>
          <span>Supabase</span>
        </div>
        <div className="status-item">
          <span className={`status-dot ${connectionStatus.mysql ? 'connected' : 'disconnected'}`}></span>
          <span>MySQL</span>
        </div>
        <div className="status-item">
          <span style={{ fontSize: '1.1rem' }}>📅</span>
          <span>Semana: {selectedWeek}</span>
        </div>
        <div className="status-item" style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(139, 92, 246, 0.2))' }}>
          <span style={{ fontSize: '1.1rem' }}>🏪</span>
          <span>{getNodoLabel(selectedNodo)}</span>
        </div>
      </div>

      {/* Selector de Nodo Global */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '1rem', 
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        {NODOS.map(nodo => (
          <button
            key={nodo.value}
            onClick={() => {
              setSelectedNodo(nodo.value);
              addLog(`Nodo cambiado a: ${nodo.label}`, 'info');
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: selectedNodo === nodo.value 
                ? 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)' 
                : 'var(--bg-card)',
              border: selectedNodo === nodo.value 
                ? 'none' 
                : '1px solid var(--border-color)',
              borderRadius: '50px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '0.9rem',
              fontWeight: selectedNodo === nodo.value ? '600' : '400',
              transition: 'all 0.2s ease',
              boxShadow: selectedNodo === nodo.value 
                ? '0 4px 15px rgba(6, 182, 212, 0.3)' 
                : 'none'
            }}
          >
            {nodo.label}
          </button>
        ))}
      </div>

      {/* Grid de Procesos */}
      <div className="processes-grid">
        {/* Card 1: Cargar Plan de Demanda */}
        <div className="process-card">
          <div className="process-icon">📥</div>
          <h3 className="process-title">Cargar Plan de Demanda</h3>
          <p className="process-description">
            Carga los datos iniciales del plan de demanda semanal desde un archivo CSV.
          </p>
          <div className="week-selector">
            <label>Semana:</label>
            <input
              type="text"
              className="week-input"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              placeholder="202549"
            />
          </div>
          <button 
            className={`action-button ${loading.loadPlan ? 'loading' : ''}`}
            onClick={handleLoadDemandPlan}
            disabled={loading.loadPlan}
          >
            {loading.loadPlan ? <span className="spinner"></span> : '📤'} 
            {loading.loadPlan ? 'Cargando...' : 'Cargar Plan CSV'}
          </button>
        </div>

        {/* Card 2: Actualizar Venta Real */}
        <div className="process-card">
          <div className="process-icon">🔄</div>
          <h3 className="process-title">Actualizar Venta Real</h3>
          <p className="process-description">
            Carga las ventas reales desde CSV y actualiza la tabla. SKUs nuevos se insertan automáticamente.
          </p>
          <div className="week-selector">
            <label>Semana:</label>
            <input
              type="text"
              className="week-input"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              placeholder="202549"
            />
          </div>
          {connectionStatus.mysql ? (
            <button 
              className={`action-button ${loading.updateSales ? 'loading' : ''}`}
              onClick={handleUpdateRealSales}
              disabled={loading.updateSales}
            >
              {loading.updateSales ? <span className="spinner"></span> : '🔄'} 
              {loading.updateSales ? 'Actualizando...' : 'Actualizar Ventas'}
            </button>
          ) : (
            <>
              <button 
                className={`action-button ${loading.uploadCSV ? 'loading' : ''}`}
                onClick={handleUploadCSV}
                disabled={loading.uploadCSV}
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              >
                {loading.uploadCSV ? <span className="spinner"></span> : '📁'} 
                {loading.uploadCSV ? 'Procesando...' : 'Cargar CSV de Ventas'}
              </button>
              {processingStatus && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(245, 158, 11, 0.15)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: '#fbbf24',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></span>
                  {processingStatus}
                </div>
              )}
            </>
          )}
        </div>

        {/* Card 3: Actualizar Disponibilidad/Stock */}
        <div className="process-card">
          <div className="process-icon">📦</div>
          <h3 className="process-title">Actualizar Disponibilidad Semana</h3>
          <p className="process-description">
            Cruza el stock del lunes de la semana (StockMeli) con el plan. Inserta SKUs con stock que no tengan plan.
          </p>
          <div className="week-selector">
            <label>Semana:</label>
            <input
              type="text"
              className="week-input"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              placeholder="202549"
            />
          </div>
          <button 
            className={`action-button ${loading.updateStock ? 'loading' : ''}`}
            onClick={handleUpdateStock}
            disabled={loading.updateStock}
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          >
            {loading.updateStock ? <span className="spinner"></span> : '📦'} 
            {loading.updateStock ? 'Actualizando...' : 'Actualizar Stock'}
          </button>
        </div>

        {/* Card 4: Ver Reporte */}
        <div className="process-card">
          <div className="process-icon">📋</div>
          <h3 className="process-title">Ver Reporte Semanal</h3>
          <p className="process-description">
            Visualiza un resumen del desempeño del pronóstico con métricas clave y análisis de errores.
          </p>
          <div className="week-selector">
            <label>Semana:</label>
            <input
              type="text"
              className="week-input"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              placeholder="202549"
            />
          </div>
          <button 
            className={`action-button ${loading.viewReport ? 'loading' : ''}`}
            onClick={handleViewReport}
            disabled={loading.viewReport}
          >
            {loading.viewReport ? <span className="spinner"></span> : '📈'} 
            {loading.viewReport ? 'Generando...' : 'Ver Reporte'}
          </button>
        </div>

        {/* Card 5: Cargar Escenarios */}
        <div className="process-card">
          <div className="process-icon">🎯</div>
          <h3 className="process-title">Cargar Escenarios</h3>
          <p className="process-description">
            Importa escenarios de proyección (Venta, Sobreprecio, Descuento) con cantidad y precio por SKU.
          </p>
          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-muted)', 
            marginBottom: '1rem',
            padding: '0.5rem',
            background: 'rgba(139, 92, 246, 0.1)',
            borderRadius: '8px'
          }}>
            <strong>Columnas CSV:</strong><br/>
            Nodo, Cuenta, Sku_Seller, Escenario, Cantidad_Venta, Precio_Venta
          </div>
          <button 
            className={`action-button ${loading.uploadEscenarios ? 'loading' : ''}`}
            onClick={handleUploadEscenarios}
            disabled={loading.uploadEscenarios}
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}
          >
            {loading.uploadEscenarios ? <span className="spinner"></span> : '🎯'} 
            {loading.uploadEscenarios ? 'Importando...' : 'Importar Escenarios CSV'}
          </button>
        </div>
      </div>

      {/* Log de Actividad */}
      <div className="activity-log">
        <div className="log-header">
          <h3 className="log-title">
            📝 Log de Actividad
          </h3>
          <button className="log-clear" onClick={clearLogs}>
            Limpiar
          </button>
        </div>
        <div className="log-entries">
          {logs.length === 0 ? (
            <div className="log-empty">
              No hay actividad registrada. Ejecuta algún proceso para ver los logs.
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`log-entry ${log.type}`}>
                <span className="log-icon">{getLogIcon(log.type)}</span>
                <span className="log-time">{log.time}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Resultados */}
      {showResultModal && lastResult && (
        <div className="modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h2 className="modal-title">
              {lastResult.success ? '✅ Procesamiento Completado' : '❌ Error en Procesamiento'}
            </h2>
            
            {lastResult.success && (
              <>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '1rem', 
                  marginBottom: '1.5rem' 
                }}>
                  <div style={{ 
                    background: 'rgba(16, 185, 129, 0.1)', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>
                      {lastResult.updated || 0}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {(lastResult as Record<string, unknown>).totalStock !== undefined ? 'Con Stock' : 'Actualizados'}
                    </div>
                  </div>
                  <div style={{ 
                    background: 'rgba(6, 182, 212, 0.1)', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#06b6d4' }}>
                      {lastResult.inserted || 0}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Nuevos Insertados
                    </div>
                  </div>
                  <div style={{ 
                    background: 'rgba(245, 158, 11, 0.1)', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b' }}>
                      {lastResult.noSales || 0}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {(lastResult as Record<string, unknown>).totalStock !== undefined ? 'Sin Stock (→0)' : 'Sin Venta (→0)'}
                    </div>
                  </div>
                </div>

                {/* Mostrar info adicional para stock */}
                {(lastResult as Record<string, unknown>).mondayDate && (
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>📅</span>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        Fecha de Stock: {(lastResult as Record<string, unknown>).mondayDate as string}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Total registros en StockMeli: {(lastResult as Record<string, unknown>).totalStock as number || 0}
                      </div>
                    </div>
                  </div>
                )}

                {lastResult.details && lastResult.details.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                      Detalle (primeros 50):
                    </h4>
                    <div style={{ 
                      maxHeight: '200px', 
                      overflowY: 'auto', 
                      background: 'var(--bg-input)',
                      borderRadius: '8px',
                      padding: '0.5rem'
                    }}>
                      <table style={{ width: '100%', fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: '#06b6d4' }}>SKU</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: '#06b6d4' }}>Cuenta</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: '#06b6d4' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lastResult.details.map((d, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{d.sku}</td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{d.cuenta}</td>
                              <td style={{ 
                                padding: '0.4rem 0.5rem',
                                color: d.action.includes('nuevo') ? '#06b6d4' : 
                                       d.action.includes('sin') ? '#f59e0b' : '#10b981'
                              }}>
                                {d.action}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {lastResult.error && (
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                padding: '1.5rem', 
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                marginBottom: '1rem'
              }}>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.85rem',
                  color: '#fca5a5',
                  margin: 0,
                  lineHeight: '1.6'
                }}>
                  {lastResult.error}
                </pre>
                
                {lastResult.headers && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Columnas detectadas en tu archivo:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {lastResult.headers.map((h, i) => (
                        <span key={i} style={{
                          background: 'rgba(255,255,255,0.1)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontFamily: 'JetBrains Mono, monospace'
                        }}>
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowResultModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

