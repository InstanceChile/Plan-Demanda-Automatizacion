'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';

// Tipos
interface ReportePlanRow {
  Nodo: string;
  Cuenta: string;
  Sku_Seller: string;
  Nombre: string | null;
  Portafolio: string | null;
  SegmentacionDe_Portafolio: string | null;
  Semana_VR_1: number;
  Semana_VR_2: number;
  Semana_VR_3: number;
  Semana_VR_4: number;
  Semana_VR_5: number;
  Venta_Real_1: number | null;
  Venta_Real_2: number | null;
  Venta_Real_3: number | null;
  Venta_Real_4: number | null;
  Venta_Real_5: number | null;
  Semana_PD_0: number;
  Semana_PD_1: number;
  Semana_PD_2: number;
  Semana_PD_3: number;
  Semana_PD_4: number;
  Plan_demanda_0: number | null;
  Plan_demanda_1: number | null;
  Plan_demanda_2: number | null;
  Plan_demanda_3: number | null;
  Plan_demanda_4: number | null;
  PVP_PD_2: number | null;
  Accion_2: string | null;
  PVP_PD_4: number | null;
  Accion_4: string | null;
}

interface EscenarioData {
  cantidad: number;
  precio: number;
}

interface EscenarioDisponible {
  value: string;
  label: string;
}

interface SelectedCell {
  sku: string | null;
  week: string | null;
  idx: number | null;
}

// Detalle de publicación desde f_plan_demanda_detalle
interface DetallePublicacion {
  Nodo: string;
  Cuenta: string;
  Sku_Seller: string;
  Semana: number;
  Dips: number | null;  // Nota: El campo se llama "Dips" en la tabla
  Stock_Inicio_Semana: number | null;
  Accion: string | null;
  Plan_demanda: number | null;
  Venta_Real: number | null;
  updated_at: string | null;
}

// Función para obtener las etiquetas de semana desde los datos
// Incluye Semana_PD_0 (semana actual/referencia)
const getWeekLabels = (row: ReportePlanRow | null) => {
  if (!row) {
    return ['S-5', 'S-4', 'S-3', 'S-2', 'S-1', 'S0', 'S+1', 'S+2', 'S+3', 'S+4'];
  }
  return [
    String(row.Semana_VR_1 || 'S-5'),
    String(row.Semana_VR_2 || 'S-4'),
    String(row.Semana_VR_3 || 'S-3'),
    String(row.Semana_VR_4 || 'S-2'),
    String(row.Semana_VR_5 || 'S-1'),
    String(row.Semana_PD_0 || 'S0'),   // Semana actual
    String(row.Semana_PD_1 || 'S+1'),
    String(row.Semana_PD_2 || 'S+2'),  // Semana modificable 1
    String(row.Semana_PD_3 || 'S+3'),
    String(row.Semana_PD_4 || 'S+4'),  // Semana modificable 2
  ];
};

export default function PlanDemandaPage() {
  const { user } = useAuth();
  
  // Estados principales
  const [data, setData] = useState<ReportePlanRow[]>([]);
  const [escenariosPorSku, setEscenariosPorSku] = useState<Record<string, Record<string, EscenarioData>>>({});
  const [escenariosDisponibles, setEscenariosDisponibles] = useState<EscenarioDisponible[]>([]);
  // Escenario por SKU y por semana: { skuKey: { weekIdx: 'escenario' } }
  const [escenarioSeleccionado, setEscenarioSeleccionado] = useState<Record<string, Record<number, string>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Filtros
  const [semana, setSemana] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNodo, setFilterNodo] = useState('Todos');
  const [filterCuenta, setFilterCuenta] = useState('Todos');
  const [filterPortafolio, setFilterPortafolio] = useState('Todos');
  const [filterSegmentacion, setFilterSegmentacion] = useState('Todos');
  
  // Listas de filtros disponibles
  const [nodosDisponibles, setNodosDisponibles] = useState<string[]>([]);
  const [cuentasDisponibles, setCuentasDisponibles] = useState<string[]>([]);
  const [portafoliosDisponibles, setPortafoliosDisponibles] = useState<string[]>([]);
  const [segmentacionesDisponibles, setSegmentacionesDisponibles] = useState<string[]>([]);
  
  // Escenario global
  const [escenarioGlobal, setEscenarioGlobal] = useState('Venta');
  const [aplicarA, setAplicarA] = useState<'all' | 'selected'>('all');
  
  // Semanas modificables: S+2 (idx 7), S+3 (idx 8), S+4 (idx 9)
  // S0 (idx 5) y S+1 (idx 6) son solo lectura
  // Formato: { skuKey: { weekIdx: true/false } } - true = usa escenario, false = usa Plan_Demanda
  const [semanasConEscenario, setSemanasConEscenario] = useState<Record<string, Record<number, boolean>>>({});
  
  // Semanas seleccionadas para aplicar escenario masivo (solo las modificables)
  const [semanasSeleccionadas, setSemanasSeleccionadas] = useState<Set<number>>(new Set([7, 8, 9])); // S+2, S+3, S+4
  
  // Selección
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [selectedCell, setSelectedCell] = useState<SelectedCell>({ sku: null, week: null, idx: null });
  
  // Valores manuales: { skuKey: { weekIdx: valor } }
  const [valoresManuales, setValoresManuales] = useState<Record<string, Record<number, number>>>({});
  
  // Detalle de publicación (cargado desde Plan_Demanda)
  const [detallePublicacion, setDetallePublicacion] = useState<DetallePublicacion | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  
  // Modales
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Cambios pendientes
  const [cambiosPendientes, setCambiosPendientes] = useState<Set<string>>(new Set());
  
  // Calcular semana actual
  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    setSemana(`${now.getFullYear()}${weekNumber.toString().padStart(2, '0')}`);
  }, []);
  
  // Toast helper
  const toast = useCallback((msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  }, []);
  
  // Cargar detalle de publicación usando f_plan_demanda_detalle
  const loadDetallePublicacion = useCallback(async (row: ReportePlanRow, semanaSeleccionada: number) => {
    setLoadingDetalle(true);
    try {
      const params = new URLSearchParams({
        nodo: row.Nodo,
        cuenta: row.Cuenta,
        sku_seller: row.Sku_Seller,
        semana: String(semanaSeleccionada)
      });
      
      const response = await fetch(`/api/plan-demanda/detalle?${params}`);
      const result = await response.json();
      
      if (result.success && result.detalle) {
        setDetallePublicacion(result.detalle);
      } else {
        setDetallePublicacion(null);
      }
    } catch (error) {
      console.error('Error cargando detalle:', error);
      setDetallePublicacion(null);
    } finally {
      setLoadingDetalle(false);
    }
  }, []);
  
  // Cargar datos
  const loadData = useCallback(async () => {
    if (!semana) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({ semana });
      if (filterNodo !== 'Todos') params.append('nodo', filterNodo);
      if (filterCuenta !== 'Todos') params.append('cuenta', filterCuenta);
      
      const response = await fetch(`/api/plan-demanda?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setNodosDisponibles(result.filtros?.nodos || []);
        setCuentasDisponibles(result.filtros?.cuentas || []);
        
        // Extraer portafolios y segmentaciones únicas de los datos
        const portafolios = new Set<string>();
        const segmentaciones = new Set<string>();
        result.data.forEach((row: ReportePlanRow) => {
          if (row.Portafolio) portafolios.add(row.Portafolio);
          if (row.SegmentacionDe_Portafolio) segmentaciones.add(row.SegmentacionDe_Portafolio);
        });
        setPortafoliosDisponibles(Array.from(portafolios).sort());
        setSegmentacionesDisponibles(Array.from(segmentaciones).sort());
        
        setEscenariosPorSku(result.escenarios_por_sku || {});
        // Agregar "Manual" a los escenarios disponibles
        const escenariosBase = result.escenarios_disponibles || [];
        const escenariosConManual = [...escenariosBase, { value: 'Manual', label: 'Manual' }];
        setEscenariosDisponibles(escenariosConManual);
        
        // Cargar escenarios aplicados previamente (ahora es por SKU y por semana)
        const aplicados: Record<string, Record<number, string>> = {};
        if (result.escenarios_aplicados) {
          Object.entries(result.escenarios_aplicados).forEach(([key, value]) => {
            const escenario = (value as { escenario: string }).escenario || 'Venta';
            // Inicializar como objeto vacío - los escenarios se aplicarán por semana cuando el usuario los seleccione
            aplicados[key] = {};
          });
        }
        setEscenarioSeleccionado(aplicados);
        setCambiosPendientes(new Set());
        
        toast(`Cargados ${result.data.length} registros, ${result.meta.totalEscenarios} escenarios`);
      } else {
        toast(`Error: ${result.error}`);
      }
    } catch (error) {
      toast(`Error cargando datos: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [semana, filterNodo, filterCuenta, toast]);
  
  // Cargar al cambiar semana
  useEffect(() => {
    if (semana) {
      loadData();
    }
  }, [semana, loadData]);
  
  // Datos filtrados
  const filteredData = useMemo(() => {
    let result = data;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row => 
        row.Sku_Seller?.toLowerCase().includes(q) ||
        row.Nombre?.toLowerCase().includes(q) ||
        row.Cuenta?.toLowerCase().includes(q)
      );
    }
    
    // Filtro por Portafolio
    if (filterPortafolio !== 'Todos') {
      result = result.filter(row => row.Portafolio === filterPortafolio);
    }
    
    // Filtro por Segmentación de Portafolio
    if (filterSegmentacion !== 'Todos') {
      result = result.filter(row => row.SegmentacionDe_Portafolio === filterSegmentacion);
    }
    
    return result;
  }, [data, searchQuery, filterPortafolio, filterSegmentacion]);
  
  // Obtener clave única para SKU
  const getSkuKey = useCallback((row: ReportePlanRow) => {
    return `${row.Nodo}|${row.Cuenta}|${row.Sku_Seller}`;
  }, []);
  
  // Obtener escenario seleccionado para un SKU en una semana específica
  const getEscenarioSemana = useCallback((row: ReportePlanRow, weekIdx: number): string => {
    const key = getSkuKey(row);
    return escenarioSeleccionado[key]?.[weekIdx] || 'Venta';
  }, [escenarioSeleccionado, getSkuKey]);
  
  // Obtener escenario "principal" para mostrar en dropdown de la fila (el primero que tenga)
  const getEscenarioSku = useCallback((row: ReportePlanRow): string => {
    const key = getSkuKey(row);
    const escenarios = escenarioSeleccionado[key];
    if (!escenarios) return 'Venta';
    // Retornar el escenario de la primera semana modificable que tenga uno
    for (const weekIdx of [7, 8, 9]) {
      if (escenarios[weekIdx]) return escenarios[weekIdx];
    }
    return 'Venta';
  }, [escenarioSeleccionado, getSkuKey]);
  
  // Obtener valores del escenario para un SKU
  const getValoresEscenario = useCallback((row: ReportePlanRow, escenario?: string): EscenarioData | null => {
    const key = getSkuKey(row);
    const esc = escenario || getEscenarioSku(row);
    return escenariosPorSku[key]?.[esc] || null;
  }, [escenariosPorSku, getSkuKey, getEscenarioSku]);
  
  // Verificar si un SKU tiene escenarios cargados
  const tieneEscenarios = useCallback((row: ReportePlanRow): boolean => {
    const key = getSkuKey(row);
    return !!escenariosPorSku[key] && Object.keys(escenariosPorSku[key]).length > 0;
  }, [escenariosPorSku, getSkuKey]);
  
  // Obtener proyección (del escenario, manual o del plan original)
  // weekIdx: 5=S0 (actual), 6=S+1, 7=S+2, 8=S+3, 9=S+4
  // S0 y S+1 son solo lectura, S+2, S+3 y S+4 son modificables
  // Prioridad: 1) Valor manual para esta semana, 2) Escenario aplicado, 3) Plan_Demanda
  const getProjectedValue = useCallback((row: ReportePlanRow, weekIdx: number): { val: number; fromEscenario: boolean; fromManual: boolean; editable: boolean } => {
    const key = getSkuKey(row);
    
    // Solo S+2 (7), S+3 (8) y S+4 (9) son editables
    const isEditable = weekIdx >= 7 && weekIdx <= 9;
    
    // 1) Prioridad: Verificar si tiene valor manual para ESTA semana específica
    const valorManual = valoresManuales[key]?.[weekIdx];
    if (valorManual !== undefined && isEditable) {
      return { val: Math.round(valorManual), fromEscenario: false, fromManual: true, editable: true };
    }
    
    // 2) Verificar si este SKU+semana tiene escenario aplicado (y no hay valor manual)
    const tieneEscenarioAplicado = semanasConEscenario[key]?.[weekIdx] === true;
    // Obtener escenario específico para ESTA semana
    const escenarioSemana = escenarioSeleccionado[key]?.[weekIdx];
    
    // Si tiene escenario aplicado y NO es "Manual", usar escenario de ESTA semana
    if (isEditable && tieneEscenarioAplicado && escenarioSemana && escenarioSemana !== 'Manual') {
      const valores = getValoresEscenario(row, escenarioSemana);
      if (valores) {
        return { val: Math.round(valores.cantidad), fromEscenario: true, fromManual: false, editable: true };
      }
    }
    
    // 3) Por defecto, usar valores originales del plan
    const planValues = [
      row.Plan_demanda_0 || 0,  // S0 - semana actual (solo lectura)
      row.Plan_demanda_1 || 0,  // S+1 (solo lectura)
      row.Plan_demanda_2 || 0,  // S+2 (modificable)
      row.Plan_demanda_3 || 0,  // S+3 (modificable)
      row.Plan_demanda_4 || 0   // S+4 (modificable)
    ];
    
    const projIdx = weekIdx - 5;
    if (projIdx >= 0 && projIdx < 5) {
      return { val: Math.round(planValues[projIdx]), fromEscenario: false, fromManual: false, editable: isEditable };
    }
    
    return { val: 0, fromEscenario: false, fromManual: false, editable: false };
  }, [getSkuKey, getValoresEscenario, semanasConEscenario, valoresManuales, escenarioSeleccionado]);
  
  // Heat class para colorear celdas
  const heatClass = useCallback((val: number): string => {
    if (val >= 18) return 'heat2';
    if (val >= 10) return 'heat1';
    return 'heat0';
  }, []);
  
  // Cambiar escenario de un SKU para UNA semana específica
  // Esta función se usa cuando hay una celda seleccionada
  const cambiarEscenarioSemana = useCallback((row: ReportePlanRow, weekIdx: number, nuevoEscenario: string) => {
    const key = getSkuKey(row);
    
    if (nuevoEscenario === 'Manual') {
      // Para manual, solo marcar la semana - el valor se ingresará después
      setSemanasConEscenario(prev => {
        const nuevo = { ...prev };
        if (!nuevo[key]) nuevo[key] = {};
        nuevo[key][weekIdx] = true;
        return nuevo;
      });
    } else {
      // Para escenarios, limpiar valor manual de esta semana y aplicar escenario
      setValoresManuales(prev => {
        const nuevo = { ...prev };
        if (nuevo[key]) {
          delete nuevo[key][weekIdx];
          if (Object.keys(nuevo[key]).length === 0) {
            delete nuevo[key];
          }
        }
        return nuevo;
      });
      
      // Marcar solo ESTA semana con escenario
      setSemanasConEscenario(prev => {
        const nuevo = { ...prev };
        if (!nuevo[key]) nuevo[key] = {};
        nuevo[key][weekIdx] = true;
        return nuevo;
      });
    }
    
    // Guardar el escenario seleccionado para ESTA semana específica del SKU
    setEscenarioSeleccionado(prev => {
      const nuevo = { ...prev };
      // Asegurar que sea un objeto, no un string (migración de estructura vieja)
      if (!nuevo[key] || typeof nuevo[key] === 'string') {
        nuevo[key] = {};
      }
      nuevo[key][weekIdx] = nuevoEscenario;
      return nuevo;
    });
    setCambiosPendientes(prev => new Set(prev).add(key));
  }, [getSkuKey]);
  
  // Cambiar escenario de un SKU y aplicarlo a TODAS las semanas seleccionadas (checkboxes)
  // Esta función se usa para aplicación masiva
  const cambiarEscenarioSku = useCallback((row: ReportePlanRow, nuevoEscenario: string) => {
    const key = getSkuKey(row);
    
    // Guardar el escenario para TODAS las semanas seleccionadas
    setEscenarioSeleccionado(prev => {
      const nuevo = { ...prev };
      // Asegurar que sea un objeto, no un string (migración de estructura vieja)
      if (!nuevo[key] || typeof nuevo[key] === 'string') {
        nuevo[key] = {};
      }
      semanasSeleccionadas.forEach(weekIdx => {
        nuevo[key][weekIdx] = nuevoEscenario;
      });
      return nuevo;
    });
    
    // Si NO es Manual, aplicar el escenario a las semanas seleccionadas
    // y limpiar los valores manuales de esas semanas
    if (nuevoEscenario !== 'Manual') {
      // Solo limpiar valores manuales de las semanas seleccionadas, no todas
      setValoresManuales(prev => {
        const nuevo = { ...prev };
        if (nuevo[key]) {
          semanasSeleccionadas.forEach(weekIdx => {
            delete nuevo[key][weekIdx];
          });
          // Si no quedan valores, eliminar la entrada
          if (Object.keys(nuevo[key]).length === 0) {
            delete nuevo[key];
          }
        }
        return nuevo;
      });
      
      // Marcar las semanas seleccionadas como "con escenario aplicado"
      setSemanasConEscenario(prev => {
        const nuevo = { ...prev };
        if (!nuevo[key]) nuevo[key] = {};
        semanasSeleccionadas.forEach(weekIdx => {
          nuevo[key][weekIdx] = true;
        });
        return nuevo;
      });
    }
    // Si es Manual, no marcar semanas automáticamente - se hará al ingresar el valor
    
    setCambiosPendientes(prev => new Set(prev).add(key));
  }, [getSkuKey, semanasSeleccionadas]);
  
  // Establecer valor manual para una celda específica
  // No afecta otras semanas del mismo SKU
  const setValorManual = useCallback((row: ReportePlanRow, weekIdx: number, valor: number) => {
    const key = getSkuKey(row);
    
    // Guardar el valor manual solo para esta semana
    setValoresManuales(prev => {
      const nuevo = { ...prev };
      if (!nuevo[key]) nuevo[key] = {};
      nuevo[key][weekIdx] = valor;
      return nuevo;
    });
    
    // Marcar la semana como con escenario aplicado (solo esta semana)
    setSemanasConEscenario(prev => {
      const nuevo = { ...prev };
      if (!nuevo[key]) nuevo[key] = {};
      nuevo[key][weekIdx] = true;
      return nuevo;
    });
    
    setCambiosPendientes(prev => new Set(prev).add(key));
  }, [getSkuKey]);
  
  // Quitar escenario de un SKU (volver a Plan_Demanda)
  const quitarEscenarioSku = useCallback((row: ReportePlanRow) => {
    const key = getSkuKey(row);
    
    // Quitar todas las semanas con escenario
    setSemanasConEscenario(prev => {
      const nuevo = { ...prev };
      delete nuevo[key];
      return nuevo;
    });
    
    // Quitar todos los escenarios seleccionados para este SKU
    setEscenarioSeleccionado(prev => {
      const nuevo = { ...prev };
      delete nuevo[key];
      return nuevo;
    });
    
    // Quitar todos los valores manuales para este SKU
    setValoresManuales(prev => {
      const nuevo = { ...prev };
      delete nuevo[key];
      return nuevo;
    });
    
    setCambiosPendientes(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
    
    toast('Escenario removido, mostrando Plan Demanda');
  }, [getSkuKey, toast]);
  
  // Toggle semana seleccionada para aplicar escenario
  const toggleSemanaSeleccionada = useCallback((weekIdx: number) => {
    setSemanasSeleccionadas(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(weekIdx)) {
        nuevo.delete(weekIdx);
      } else {
        nuevo.add(weekIdx);
      }
      return nuevo;
    });
  }, []);
  
  // Aplicar escenario global
  const applyGlobalScenario = useCallback(() => {
    if (semanasSeleccionadas.size === 0) {
      toast('Selecciona al menos una semana para aplicar el escenario');
      return;
    }
    
    const targetSkus = aplicarA === 'selected' ? selectedSkus : new Set(filteredData.map(r => getSkuKey(r)));
    const nuevoSeleccionado: Record<string, Record<number, string>> = { ...escenarioSeleccionado };
    const nuevosPendientes = new Set(cambiosPendientes);
    const nuevasSemanasConEscenario = { ...semanasConEscenario };
    
    filteredData.forEach(row => {
      const key = getSkuKey(row);
      if (!targetSkus.has(key) && aplicarA === 'selected') {
        if (!selectedSkus.has(row.Sku_Seller)) return;
      }
      
      // Solo aplicar si tiene escenarios cargados
      if (tieneEscenarios(row)) {
        // Aplicar escenario a CADA semana seleccionada independientemente
        // Asegurar que sea un objeto, no un string (migración de estructura vieja)
        if (!nuevoSeleccionado[key] || typeof nuevoSeleccionado[key] === 'string') {
          nuevoSeleccionado[key] = {};
        }
        semanasSeleccionadas.forEach(weekIdx => {
          nuevoSeleccionado[key][weekIdx] = escenarioGlobal;
        });
        nuevosPendientes.add(key);
        
        // Marcar las semanas seleccionadas
        if (!nuevasSemanasConEscenario[key]) nuevasSemanasConEscenario[key] = {};
        semanasSeleccionadas.forEach(weekIdx => {
          nuevasSemanasConEscenario[key][weekIdx] = true;
        });
      }
    });
    
    setEscenarioSeleccionado(nuevoSeleccionado);
    setCambiosPendientes(nuevosPendientes);
    setSemanasConEscenario(nuevasSemanasConEscenario);
    
    const semanasTexto = Array.from(semanasSeleccionadas).map(w => `S+${w - 5}`).join(', ');
    toast(`Escenario "${escenarioGlobal}" aplicado a ${semanasTexto}`);
  }, [aplicarA, selectedSkus, filteredData, getSkuKey, escenarioSeleccionado, cambiosPendientes, escenarioGlobal, tieneEscenarios, toast, semanasSeleccionadas, semanasConEscenario]);
  
  // Guardar cambios
  const saveChanges = useCallback(async () => {
    if (cambiosPendientes.size === 0) {
      toast('No hay cambios pendientes');
      return;
    }
    
    setSaving(true);
    try {
      // Generar un cambio por cada semana modificada de cada SKU
      const cambios: Array<{
        Nodo: string;
        Cuenta: string;
        Sku_Seller: string;
        Semana: number;
        Plan_demanda: number;
        PVP_PD: number;
        Accion: string;
        Escenario_Aplicado: string;
      }> = [];
      
      Array.from(cambiosPendientes).forEach(key => {
        const [Nodo, Cuenta, Sku_Seller] = key.split('|');
        const row = data.find(r => getSkuKey(r) === key);
        if (!row) return;
        
        // Semanas modificables: S+2 (weekIdx 7), S+3 (8), S+4 (9)
        const weekToSemana: Record<number, number> = {
          7: row.Semana_PD_2 || 0,
          8: row.Semana_PD_3 || 0,
          9: row.Semana_PD_4 || 0
        };
        
        // Revisar cada semana modificable
        [7, 8, 9].forEach(weekIdx => {
          const semanaCambio = weekToSemana[weekIdx];
          if (!semanaCambio) return;
          
          // Verificar si esta semana tiene cambios
          const tieneValorManual = valoresManuales[key]?.[weekIdx] !== undefined;
          const tieneEscenarioSemana = semanasConEscenario[key]?.[weekIdx] === true;
          
          if (!tieneValorManual && !tieneEscenarioSemana) return;
          
          // Obtener escenario de ESTA semana
          const escenarioSemana = escenarioSeleccionado[key]?.[weekIdx] || 'Venta';
          
          let planDemanda: number;
          let pvpPd: number;
          let accion: string;
          
          if (tieneValorManual) {
            // Valor manual
            planDemanda = valoresManuales[key][weekIdx];
            pvpPd = 0; // No tenemos precio manual por ahora
            accion = 'Carga_Manual';
          } else {
            // Escenario
            const valores = escenariosPorSku[key]?.[escenarioSemana];
            planDemanda = valores?.cantidad || 0;
            pvpPd = valores?.precio || 0;
            accion = escenarioSemana;
          }
          
          cambios.push({
            Nodo,
            Cuenta,
            Sku_Seller,
            Semana: semanaCambio,
            Plan_demanda: planDemanda,
            PVP_PD: pvpPd,
            Accion: accion,
            Escenario_Aplicado: escenarioSemana
          });
        });
      });
      
      const response = await fetch('/api/plan-demanda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cambios,
          usuario: user?.username || 'Desconocido',
          userAgent: navigator.userAgent
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast(result.message);
        setCambiosPendientes(new Set());
      } else {
        toast(`Error: ${result.error}`);
      }
    } catch (error) {
      toast(`Error guardando: ${error}`);
    } finally {
      setSaving(false);
    }
  }, [cambiosPendientes, escenarioSeleccionado, escenariosPorSku, data, getSkuKey, valoresManuales, semanasConEscenario, user, toast]);
  
  // Toggle selección
  const toggleSelect = useCallback((sku: string) => {
    setSelectedSkus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sku)) {
        newSet.delete(sku);
      } else {
        newSet.add(sku);
      }
      return newSet;
    });
  }, []);
  
  // Seleccionar/deseleccionar todo
  const toggleSelectAll = useCallback(() => {
    if (selectedSkus.size === filteredData.length) {
      setSelectedSkus(new Set());
    } else {
      setSelectedSkus(new Set(filteredData.map(r => r.Sku_Seller)));
    }
  }, [selectedSkus.size, filteredData]);
  
  // Click en celda - activa automáticamente esa semana para modificar
  const handleCellClick = useCallback((row: ReportePlanRow, week: string, idx: number) => {
    setSelectedCell({ sku: row.Sku_Seller, week, idx });
    
    // Si es una celda editable (S+2, S+3, S+4), marcarla automáticamente
    if (idx >= 7 && idx <= 9) {
      const key = getSkuKey(row);
      setSemanasConEscenario(prev => {
        const nuevo = { ...prev };
        if (!nuevo[key]) nuevo[key] = {};
        nuevo[key][idx] = true;
        return nuevo;
      });
      setCambiosPendientes(prev => new Set(prev).add(key));
    }
  }, [getSkuKey]);
  
  // Obtener fila seleccionada
  const selectedRow = useMemo(() => {
    if (!selectedCell.sku) return null;
    return filteredData.find(r => r.Sku_Seller === selectedCell.sku);
  }, [selectedCell.sku, filteredData]);
  
  // Cargar detalle cuando cambia la fila o semana seleccionada
  useEffect(() => {
    if (selectedRow && selectedCell.week) {
      const semanaNum = parseInt(selectedCell.week);
      if (!isNaN(semanaNum)) {
        loadDetallePublicacion(selectedRow, semanaNum);
      }
    } else {
      setDetallePublicacion(null);
    }
  }, [selectedRow, selectedCell.week, loadDetallePublicacion]);
  
  // Calcular regresión lineal para tendencia
  const linearRegression = useCallback((values: number[]) => {
    const n = values.length;
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * values[i], 0);
    const sumX2 = xs.reduce((a, x) => a + x * x, 0);
    const denom = (n * sumX2 - sumX * sumX) || 1;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }, []);
  
  // Generar SVG del gráfico (ahora con 10 puntos: 5 históricos + 5 proyección)
  const renderChart = useCallback((row: ReportePlanRow) => {
    const hist = [
      row.Venta_Real_1 || 0,
      row.Venta_Real_2 || 0,
      row.Venta_Real_3 || 0,
      row.Venta_Real_4 || 0,
      row.Venta_Real_5 || 0
    ];
    
    // 5 semanas de proyección: S0, S+1, S+2, S+3, S+4
    const forecast = [
      getProjectedValue(row, 5).val,
      getProjectedValue(row, 6).val,
      getProjectedValue(row, 7).val,
      getProjectedValue(row, 8).val,
      getProjectedValue(row, 9).val
    ];
    
    const all = [...hist, ...forecast];
    const { slope, intercept } = linearRegression(hist);
    
    // 10 puntos para la tendencia
    const trend = Array.from({ length: 10 }, (_, i) => {
      const x = i + 1;
      return Math.max(0, Math.round(intercept + slope * x));
    });
    
    const W = 300, H = 110, pad = 14;
    const maxV = Math.max(...all, ...trend, 1);
    
    const xScale = (i: number) => pad + (i / 9) * (W - 2 * pad);
    const yScale = (v: number) => (H - pad) - ((v) / maxV) * (H - 2 * pad);
    
    const actualPath = hist.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
    const trendPath = trend.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
    
    const forecastDots = forecast.map((v, k) => {
      const i = 5 + k;
      return `<circle cx="${xScale(i)}" cy="${yScale(v)}" r="3" fill="#00b8a9" />`;
    }).join('');
    
    const gridLines = [0.25, 0.5, 0.75].map(fr => {
      const y = pad + fr * (H - 2 * pad);
      return `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="rgba(0,0,0,.08)" stroke-width="1" />`;
    }).join('');
    
    // Usar semanas reales para las etiquetas del gráfico (primera, mitad, última)
    const weekLabels = getWeekLabels(row);
    const xLabels = [0, 4, 9].map((i) => {
      const label = weekLabels[i];
      return `<text x="${xScale(i)}" y="${H - 2}" font-size="9" fill="#718096" text-anchor="middle">${label}</text>`;
    }).join('');
    
    return `
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0;">
        ${gridLines}
        <path d="${trendPath}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4 4" />
        <path d="${actualPath}" fill="none" stroke="#0d2b4a" stroke-width="2" />
        ${forecastDots}
        ${xLabels}
      </svg>
    `;
  }, [getProjectedValue, linearRegression]);
  
  // Exportar a CSV
  const exportCSV = useCallback(() => {
    // Usar semanas reales si hay datos (incluyendo Semana_PD_0)
    const firstRow = filteredData[0];
    const weekHeaders = firstRow ? [
      String(firstRow.Semana_VR_1),
      String(firstRow.Semana_VR_2),
      String(firstRow.Semana_VR_3),
      String(firstRow.Semana_VR_4),
      String(firstRow.Semana_VR_5),
      String(firstRow.Semana_PD_0),
      String(firstRow.Semana_PD_1),
      String(firstRow.Semana_PD_2),
      String(firstRow.Semana_PD_3),
      String(firstRow.Semana_PD_4),
    ] : ['S-5', 'S-4', 'S-3', 'S-2', 'S-1', 'S0', 'S+1', 'S+2', 'S+3', 'S+4'];
    
    const headers = [
      'Nodo', 'Cuenta', 'Sku_Seller', 'Nombre',
      ...weekHeaders,
      'Escenario', 'Precio_Escenario'
    ];
    
    const rows = filteredData.map(row => {
      const esc = getEscenarioSku(row);
      const valores = getValoresEscenario(row);
      return [
        row.Nodo,
        row.Cuenta,
        row.Sku_Seller,
        row.Nombre || '',
        row.Venta_Real_1 || 0,
        row.Venta_Real_2 || 0,
        row.Venta_Real_3 || 0,
        row.Venta_Real_4 || 0,
        row.Venta_Real_5 || 0,
        getProjectedValue(row, 5).val,
        getProjectedValue(row, 6).val,
        getProjectedValue(row, 7).val,
        getProjectedValue(row, 8).val,
        getProjectedValue(row, 9).val,
        esc,
        valores?.precio || 0
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan_demanda_${semana}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Tabla descargada');
  }, [filteredData, semana, getEscenarioSku, getValoresEscenario, getProjectedValue, toast]);

  return (
    <div className="plan-demanda-container">
      {/* Header */}
      <div className="pd-card">
        {/* Contenedor sticky para filtros */}
        <div className="pd-sticky-header">
        <div className="pd-header">
          <div className="pd-title">
            <h1>📈 Proyección por Publicación</h1>
            <p>Aplicar escenarios de precio/demanda desde tabla de escenarios</p>
          </div>
          <div className="pd-controls">
            <input
              type="text"
              className="pd-input"
              placeholder="Buscar SKU o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="pd-select"
              value={filterNodo}
              onChange={(e) => setFilterNodo(e.target.value)}
            >
              <option value="Todos">Marketplace: Todos</option>
              {nodosDisponibles.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <select
              className="pd-select"
              value={filterCuenta}
              onChange={(e) => setFilterCuenta(e.target.value)}
            >
              <option value="Todos">Cliente: Todos</option>
              {cuentasDisponibles.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              className="pd-select"
              value={filterPortafolio}
              onChange={(e) => setFilterPortafolio(e.target.value)}
            >
              <option value="Todos">Portafolio: Todos</option>
              {portafoliosDisponibles.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              className="pd-select"
              value={filterSegmentacion}
              onChange={(e) => setFilterSegmentacion(e.target.value)}
            >
              <option value="Todos">Segmentación: Todos</option>
              {segmentacionesDisponibles.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button className="pd-btn" onClick={exportCSV}>
              Descargar CSV
            </button>
            <button 
              className="pd-btn primary" 
              onClick={saveChanges} 
              disabled={saving || cambiosPendientes.size === 0}
            >
              {saving ? 'Guardando...' : `Guardar Cambios (${cambiosPendientes.size})`}
            </button>
          </div>
        </div>
        
        {/* Filtros y Semana */}
        <div className="pd-filters-row">
          <div className="pd-week-selector">
            <span className="pd-label">Semana Referencia:</span>
            <input
              type="text"
              className="pd-input"
              value={semana}
              onChange={(e) => setSemana(e.target.value)}
              placeholder="202601"
              style={{ width: '120px' }}
            />
            <button className="pd-btn" onClick={loadData} disabled={loading}>
              {loading ? 'Cargando...' : 'Cargar'}
            </button>
          </div>
          <span className="pd-badge">
            {filteredData.length} publicaciones
          </span>
          {cambiosPendientes.size > 0 && (
            <span className="pd-badge" style={{ background: 'rgba(255,120,190,0.2)', borderColor: 'rgba(255,120,190,0.4)' }}>
              ⚠️ {cambiosPendientes.size} cambios sin guardar
            </span>
          )}
        </div>
        
        {/* Barra de simulación */}
        <div className="pd-simbar">
          <div className="pd-kv" style={{ minWidth: '280px' }}>
            <label>Escenario a aplicar</label>
            <div className="pd-seg">
              {escenariosDisponibles.map(esc => (
                <button
                  key={esc.value}
                  className={escenarioGlobal === esc.value ? 'active' : ''}
                  onClick={() => setEscenarioGlobal(esc.value)}
                >
                  {esc.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="pd-kv">
            <label>Semanas a modificar (S+2, S+3, S+4)</label>
            <div className="pd-row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
              <label className="pd-checkbox-label">
                <input
                  type="checkbox"
                  checked={semanasSeleccionadas.has(7)}
                  onChange={() => toggleSemanaSeleccionada(7)}
                />
                <span>S+2 {filteredData.length > 0 ? `(${filteredData[0].Semana_PD_2})` : ''}</span>
              </label>
              <label className="pd-checkbox-label">
                <input
                  type="checkbox"
                  checked={semanasSeleccionadas.has(8)}
                  onChange={() => toggleSemanaSeleccionada(8)}
                />
                <span>S+3 {filteredData.length > 0 ? `(${filteredData[0].Semana_PD_3})` : ''}</span>
              </label>
              <label className="pd-checkbox-label">
                <input
                  type="checkbox"
                  checked={semanasSeleccionadas.has(9)}
                  onChange={() => toggleSemanaSeleccionada(9)}
                />
                <span>S+4 {filteredData.length > 0 ? `(${filteredData[0].Semana_PD_4})` : ''}</span>
              </label>
            </div>
          </div>
          
          <div className="pd-kv">
            <label>Aplicar a</label>
            <div className="pd-row">
              <select
                className="pd-select"
                value={aplicarA}
                onChange={(e) => setAplicarA(e.target.value as 'all' | 'selected')}
              >
                <option value="all">Todas las publicaciones</option>
                <option value="selected">Solo seleccionadas</option>
              </select>
              <button className="pd-btn pink" onClick={applyGlobalScenario}>
                Aplicar Escenario
              </button>
            </div>
          </div>
        </div>
        </div>{/* Fin pd-sticky-header */}
        
        {/* Barra de selección bulk */}
        {selectedSkus.size > 0 && (
          <div className="pd-bulk-bar">
            <div className="pd-bulk-left">
              <span className="pd-pill"><b>{selectedSkus.size}</b> seleccionadas</span>
              <button className="pd-btn" onClick={() => setSelectedSkus(new Set())}>
                Limpiar selección
              </button>
            </div>
          </div>
        )}
        
        {/* Tabla */}
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr className="group">
                <th className="col0 sticky0" rowSpan={2}>
                  <input
                    type="checkbox"
                    className="pd-check"
                    checked={selectedSkus.size === filteredData.length && filteredData.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="col1 sticky1" rowSpan={2}>Código</th>
                <th className="col2 sticky2" rowSpan={2}>Nombre</th>
                <th colSpan={5}>Últimas 5 semanas (Venta Real)</th>
                <th colSpan={5}>Proyección</th>
                <th rowSpan={2}>Escenario</th>
              </tr>
              <tr>
                {filteredData.length > 0 ? (
                  <>
                    {/* Semanas históricas */}
                    <th>{filteredData[0].Semana_VR_1}</th>
                    <th>{filteredData[0].Semana_VR_2}</th>
                    <th>{filteredData[0].Semana_VR_3}</th>
                    <th>{filteredData[0].Semana_VR_4}</th>
                    <th>{filteredData[0].Semana_VR_5}</th>
                    {/* Semanas proyección - S0 y S+1 solo lectura */}
                    <th className="th-readonly">{filteredData[0].Semana_PD_0}</th>
                    <th className="th-readonly">{filteredData[0].Semana_PD_1}</th>
                    {/* S+2, S+3, S+4 editables */}
                    <th className="th-editable">{filteredData[0].Semana_PD_2}*</th>
                    <th className="th-editable">{filteredData[0].Semana_PD_3}*</th>
                    <th className="th-editable">{filteredData[0].Semana_PD_4}*</th>
                  </>
                ) : (
                  <>
                    <th>S-5</th>
                    <th>S-4</th>
                    <th>S-3</th>
                    <th>S-2</th>
                    <th>S-1</th>
                    <th className="th-readonly">S0</th>
                    <th className="th-readonly">S+1</th>
                    <th className="th-editable">S+2*</th>
                    <th className="th-editable">S+3*</th>
                    <th className="th-editable">S+4*</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Cargando datos...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No hay datos. Ingresa una semana y presiona "Cargar".
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => {
                  const key = getSkuKey(row);
                  const escActual = getEscenarioSku(row);
                  const tieneEsc = tieneEscenarios(row);
                  const tieneCambio = cambiosPendientes.has(key);
                  
                  const ventasHist = [
                    row.Venta_Real_1 || 0,
                    row.Venta_Real_2 || 0,
                    row.Venta_Real_3 || 0,
                    row.Venta_Real_4 || 0,
                    row.Venta_Real_5 || 0
                  ];
                  
                  return (
                    <tr key={key} style={tieneCambio ? { background: 'rgba(255,120,190,0.05)' } : undefined}>
                      <td className="sticky0 col0">
                        <input
                          type="checkbox"
                          className="pd-check"
                          checked={selectedSkus.has(row.Sku_Seller)}
                          onChange={() => toggleSelect(row.Sku_Seller)}
                        />
                      </td>
                      <td className="sticky1 col1" style={{ fontFamily: 'var(--mono)' }}>
                        {row.Sku_Seller}
                      </td>
                      <td className="sticky2 col2">
                        <div className="pd-name">
                          <div className="mainName">{row.Nombre || row.Sku_Seller}</div>
                          <div className="sub">
                            {row.Nodo} • {row.Cuenta}
                            {!tieneEsc && (
                              <span className="pd-tag">Sin escenarios</span>
                            )}
                            {tieneCambio && (
                              <span className="pd-tag warn">Modificado</span>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      {/* Ventas históricas */}
                      {ventasHist.map((v, i) => {
                        const weekLabels = getWeekLabels(row);
                        return (
                          <td key={`hist-${i}`}>
                            <div
                              className={`pd-cell-btn ${heatClass(v)} ${selectedCell.sku === row.Sku_Seller && selectedCell.idx === i ? 'selected' : ''}`}
                              onClick={() => handleCellClick(row, weekLabels[i], i)}
                            >
                              <span>{Math.round(v)}</span>
                            </div>
                          </td>
                        );
                      })}
                      
                      {/* Proyecciones: S0, S+1, S+2*, S+3, S+4* */}
                      {[5, 6, 7, 8, 9].map((weekIdx) => {
                        const proj = getProjectedValue(row, weekIdx);
                        const weekLabels = getWeekLabels(row);
                        return (
                          <td key={`proj-${weekIdx}`}>
                            <div
                              className={`pd-cell-btn ${heatClass(proj.val)} ${selectedCell.sku === row.Sku_Seller && selectedCell.idx === weekIdx ? 'selected' : ''} ${proj.fromEscenario ? 'from-scenario' : ''} ${proj.fromManual ? 'from-manual' : ''} ${proj.editable ? 'editable-week' : ''}`}
                              onClick={() => handleCellClick(row, weekLabels[weekIdx], weekIdx)}
                              style={proj.fromEscenario ? { borderColor: 'rgba(255,120,190,0.4)' } : proj.fromManual ? { borderColor: 'rgba(100,200,255,0.4)' } : undefined}
                            >
                              <span>{proj.val}</span>
                              {proj.fromEscenario && <span className="delta" style={{ background: 'rgba(255,120,190,0.2)' }}>📊</span>}
                              {proj.fromManual && <span className="delta" style={{ background: 'rgba(100,200,255,0.2)' }}>✏️</span>}
                            </div>
                          </td>
                        );
                      })}
                      
                      {/* Selector de escenario */}
                      <td>
                        <div className="pd-escenario-cell">
                          <select
                            className="pd-select"
                            style={{ minWidth: '100px', fontSize: '11px' }}
                            value={escActual}
                            onChange={(e) => {
                              // Si este SKU tiene una celda seleccionada, aplicar solo a esa semana
                              if (selectedCell.sku === row.Sku_Seller && selectedCell.idx !== null && selectedCell.idx >= 7 && selectedCell.idx <= 9) {
                                cambiarEscenarioSemana(row, selectedCell.idx, e.target.value);
                              } else {
                                // Si no, aplicar a todas las semanas seleccionadas en checkboxes
                                cambiarEscenarioSku(row, e.target.value);
                              }
                            }}
                          >
                            {escenariosDisponibles.map(esc => {
                              const valores = escenariosPorSku[key]?.[esc.value];
                              const isManual = esc.value === 'Manual';
                              return (
                                <option key={esc.value} value={esc.value} disabled={!isManual && !valores && tieneEsc}>
                                  {esc.label} {valores ? `(${valores.cantidad}u)` : ''}
                                </option>
                              );
                            })}
                          </select>
                          {tieneCambio && (
                            <button
                              className="pd-btn-mini"
                              onClick={() => quitarEscenarioSku(row)}
                              title="Quitar escenario y volver a Plan Demanda"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Panel lateral */}
      <aside className="pd-aside">
        <div className="pd-aside-header">
          <h2>Detalle publicación</h2>
        </div>
        <div className="pd-aside-body">
          {!selectedRow ? (
            <div className="pd-muted">
              Selecciona una celda para ver el detalle y gráfico de ventas.
            </div>
          ) : (
            <>
              {/* 1. Características del producto */}
              <div className="pd-kpi-grid">
                <div className="pd-kpi">
                  <div className="k">SKU</div>
                  <div className="v mono">{selectedRow.Sku_Seller}</div>
                </div>
                <div className="pd-kpi">
                  <div className="k">Cliente</div>
                  <div className="v">{selectedRow.Cuenta}</div>
                </div>
                <div className="pd-kpi">
                  <div className="k">Semana</div>
                  <div className="v">{selectedCell.week}</div>
                </div>
                <div className="pd-kpi">
                  <div className="k">Marketplace</div>
                  <div className="v">{selectedRow.Nodo}</div>
                </div>
              </div>
              
              {/* 2. Escenario para semana */}
              {(tieneEscenarios(selectedRow) || selectedCell.idx !== null) && (
                <div className="pd-panel">
                  <div className="pd-panel-title">
                    Escenario para semana {selectedCell.week || 'seleccionada'}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      className="pd-select"
                      style={{ flex: 1 }}
                      value={selectedCell.idx !== null && selectedCell.idx >= 7 
                        ? getEscenarioSemana(selectedRow, selectedCell.idx)
                        : getEscenarioSku(selectedRow)}
                      onChange={(e) => {
                        // Si hay una celda seleccionada y es editable, aplicar solo a esa semana
                        if (selectedCell.idx !== null && selectedCell.idx >= 7 && selectedCell.idx <= 9) {
                          cambiarEscenarioSemana(selectedRow, selectedCell.idx, e.target.value);
                        } else {
                          // Si no hay celda seleccionada, aplicar a todas las seleccionadas
                          cambiarEscenarioSku(selectedRow, e.target.value);
                        }
                      }}
                    >
                      {escenariosDisponibles.map(esc => {
                        const key = getSkuKey(selectedRow);
                        const valores = escenariosPorSku[key]?.[esc.value];
                        // Manual siempre está habilitado
                        const isManual = esc.value === 'Manual';
                        return (
                          <option key={esc.value} value={esc.value} disabled={!isManual && !valores}>
                            {esc.label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  
                  {/* Input para valor manual - solo si la semana seleccionada tiene escenario Manual */}
                  {selectedCell.idx !== null && selectedCell.idx >= 7 && 
                   getEscenarioSemana(selectedRow, selectedCell.idx) === 'Manual' && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                        Valor manual para semana {selectedCell.week}
                      </label>
                      <input
                        type="number"
                        className="pd-input"
                        style={{ width: '100%' }}
                        placeholder="Ingresa cantidad..."
                        value={valoresManuales[getSkuKey(selectedRow)]?.[selectedCell.idx] ?? ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            setValorManual(selectedRow, selectedCell.idx!, val);
                          }
                        }}
                        min="0"
                      />
                    </div>
                  )}
                  
                  {/* Mostrar valores del escenario si no es Manual */}
                  {(() => {
                    if (selectedCell.idx === null || selectedCell.idx < 7) return null;
                    const escenarioActual = getEscenarioSemana(selectedRow, selectedCell.idx);
                    if (escenarioActual === 'Manual') return null;
                    
                    const valores = getValoresEscenario(selectedRow, escenarioActual);
                    if (!valores) return null;
                    
                    return (
                      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem' }}>
                        <div className="pd-kpi" style={{ flex: 1 }}>
                          <div className="k">Cantidad</div>
                          <div className="v">{Math.round(valores.cantidad)} u</div>
                        </div>
                        <div className="pd-kpi" style={{ flex: 1 }}>
                          <div className="k">Precio</div>
                          <div className="v">${valores.precio.toLocaleString('es-CL')}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {/* 3. Gráfico */}
              <div className="pd-panel">
                <div className="pd-panel-title">
                  <span>Ventas (real + tendencia + proyección)</span>
                </div>
                <div className="pd-legend">
                  <span><span className="pd-dot actual"></span>Real</span>
                  <span><span className="pd-dot trend"></span>Tendencia</span>
                  <span><span className="pd-dot forecast"></span>Proyección</span>
                </div>
                <div 
                  style={{ marginTop: '0.5rem' }}
                  dangerouslySetInnerHTML={{ __html: renderChart(selectedRow) }} 
                />
              </div>
              
              {/* 4. Detalle Semana (Stock, Disponibilidad, Último Escenario) */}
              <div className="pd-panel">
                <div className="pd-panel-title">Detalle Semana {selectedCell.week}</div>
                {loadingDetalle ? (
                  <div className="pd-muted">Cargando...</div>
                ) : detallePublicacion ? (
                  <div className="pd-kpi-grid">
                    <div className="pd-kpi">
                      <div className="k">Stock Inicio Semana</div>
                      <div className="v">{detallePublicacion.Stock_Inicio_Semana ?? '-'}</div>
                    </div>
                    <div className="pd-kpi">
                      <div className="k">Disponibilidad</div>
                      <div className="v">{detallePublicacion.Dips ?? '-'}</div>
                    </div>
                    <div className="pd-kpi">
                      <div className="k">Último Escenario</div>
                      <div className="v" style={{ 
                        color: detallePublicacion.Accion ? 'var(--accent-secondary)' : 'var(--text-muted)',
                        fontWeight: detallePublicacion.Accion ? 600 : 400
                      }}>
                        {detallePublicacion.Accion || 'Sin escenario'}
                      </div>
                    </div>
                    <div className="pd-kpi">
                      <div className="k">Plan Demanda</div>
                      <div className="v">{detallePublicacion.Plan_demanda ?? '-'}</div>
                    </div>
                    <div className="pd-kpi">
                      <div className="k">Venta Real</div>
                      <div className="v">{detallePublicacion.Venta_Real ?? '-'}</div>
                    </div>
                    {detallePublicacion.updated_at && (
                      <div className="pd-kpi">
                        <div className="k">Última Actualización</div>
                        <div className="v" style={{ fontSize: '10px' }}>
                          {new Date(detallePublicacion.updated_at).toLocaleString('es-CL')}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pd-muted">Sin datos para esta semana</div>
                )}
              </div>
              
              <div className="pd-insight">
                {tieneEscenarios(selectedRow) ? (
                  <>
                    Escenario <strong>{getEscenarioSku(selectedRow)}</strong> aplicado.
                    Las columnas S+2, S+3 y S+4 muestran valores del escenario.
                    Guarda los cambios para actualizar Plan_Demanda.
                  </>
                ) : (
                  <>
                    Este SKU no tiene escenarios cargados.
                    Importa escenarios desde el módulo Análisis Semanal.
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
      
      {/* Toast */}
      <div className={`pd-toast ${showToast ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
}
