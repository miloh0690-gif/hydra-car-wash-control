/**
 * HYDRA CAR WASH - Sistema de Control de Personal
 * Backend Google Apps Script (Code.gs)
 * 
 * Web App: Ejecutar como: yo
 * Acceso: cualquiera con el enlace
 */

// ============================================
// CONFIGURACIÓN
// ============================================

const HOJA_PERSONAL = 'Personal';
const HOJA_ASISTENCIA = 'Asistencia';
const HOJA_PAGOS = 'Pagos_Planilla';
const HOJA_AJUSTES = 'Ajustes';
const HOJA_SERVICIOS = 'Servicios';
const HOJA_USUARIOS = 'Usuarios';
const HOJA_CONFIG = 'Config';

const TOKEN_EXPIRA_HORAS = 8;
const BLOQUEO_INTENTOS = 5;
const BLOQUEO_SEGUNDOS = 900; // 15 minutos

// ============================================
// UTILIDADES
// ============================================

function getSheet(hoja) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(hoja);
}

function escapeFormula(texto) {
  if (!texto) return texto;
  if (typeof texto !== 'string') texto = String(texto);
  if (texto.match(/^[=+\-@])) {
    texto = "'" + texto;
  }
  return texto;
}

function formatearFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return dia + '/' + mes + '/' + anio;
}

function parsearFecha(espa) {
  if (!espa) return null;
  const partes = espa.split('/');
  if (partes.length !== 3) return null;
  return new Date(partes[2], partes[1] - 1, partes[0]);
}

function generarId(tipo, fecha) {
  const fechaStr = Utilities.formatDate(new Date(fecha), Session.getScriptTimeZone(), 'yyyyMMdd');
  const numAleatorio = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return tipo + '-' + fechaStr + '-' + numAleatorio;
}

function hashConSalt(texto, salt) {
  const combinado = salt + texto;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combinado);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function generarSalt() {
  return Utilities.getUuid().substring(0, 16);
}

// ============================================
// TOKENS
// ============================================

function validarToken(token) {
  if (!token) return null;
  const usuario = CacheService.getScriptCache().get(token);
  if (!usuario) return null;
  return JSON.parse(usuario);
}

function crearToken(usuario, rol) {
  const token = Utilities.getUuid();
  const datos = JSON.stringify({ usuario, rol, creado: new Date().toISOString() });
  CacheService.getScriptCache().put(token, datos, TOKEN_EXPIRA_HORAS * 3600);
  return token;
}

function invalidarToken(token) {
  if (token) {
    CacheService.getScriptCache().remove(token);
  }
}

// ============================================
// BLOQUEO DE USUARIOS
// ============================================

function getBloqueoKey(usuario) {
  return 'bloqueo_' + usuario;
}

function intentosFallidos(usuario) {
  const key = getBloqueoKey(usuario);
  const data = PropertiesService.getScriptProperties().getProperty(key);
  return data ? parseInt(data, 10) : 0;
}

function registrarIntentoFallido(usuario) {
  const key = getBloqueoKey(usuario);
  const actuales = intentosFallidos(usuario);
  PropertiesService.getScriptProperties().setProperty(key, actuales + 1);
}

function reiniciarIntentos(usuario) {
  const key = getBloqueoKey(usuario);
  PropertiesService.getScriptProperties().deleteProperty(key);
}

function estaBloqueado(usuario) {
  const key = getBloqueoKey(usuario);
  const data = PropertiesService.getScriptProperties().getProperty(key + '_hasta');
  if (data) {
    const hasta = new Date(parseInt(data, 10));
    if (new Date() < hasta) return true;
    PropertiesService.getScriptProperties().deleteProperty(key + '_hasta');
    reiniciarIntentos(usuario);
  }
  return false;
}

// ============================================
// LOGIN
// ============================================

function doLogin(datos) {
  const { usuario, pin } = datos;
  
  if (!usuario || !pin) {
    return { ok: false, error: 'Usuario y PIN son obligatorios' };
  }
  
  if (estaBloqueado(usuario)) {
    return { ok: false, error: 'Usuario bloqueado temporalmente (5 intentos fallidos)' };
  }
  
  const hoja = getSheet(HOJA_USUARIOS);
  const filas = hoja.getDataRange().getValues();
  
  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    const user = fila[0]; // usuario
    const salt = fila[3]; // salt
    const hashAlmacenado = fila[4]; // pin_hash
    const activo = fila[5]; // activo
    
    if (user === usuario && activo === 'SI') {
      const hashCalculado = hashConSalt(pin, salt);
      
      if (hashCalculado === hashAlmacenado) {
        reiniciarIntentos(usuario);
        const rol = fila[2]; // rol
        return { ok: true, token: crearToken(usuario, rol) };
      } else {
        registrarIntentoFallido(usuario);
        return { ok: false, error: 'PIN incorrecto' };
      }
    }
  }
  
  return { ok: false, error: 'Usuario no encontrado' };
}

// ============================================
// PERSONAL
// ============================================

function listarPersonal(token) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  
  const hoja = getSheet(HOJA_PERSONAL);
  const filas = hoja.getDataRange().getValues();
  const encabezados = filas[0];
  const datos = [];
  
  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    const registro = {};
    encabezados.forEach((h, idx) => {
      registro[h] = fila[idx];
    });
    // Solo personal activo
    if (registro.estado === 'Activo') {
      datos.push(registro);
    }
  }
  
  return { ok: true, datos };
}

function crearPersonal(token, datos) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  if (usuario.rol !== 'admin') return { ok: false, error: 'Sin permiso (requiere admin)' };
  
  const hoja = getSheet(HOJA_PERSONAL);
  
  // Generar ID
  const id = datos.id_personal || generarId('PER', new Date());
  const fila = [
    id,
    datos.nombre || '',
    datos.cargo || 'Lavador',
    datos.jornal_bs || 0,
    datos.estado || 'Activo',
    datos.fecha_ingreso || '',
    datos.telefono || '',
    datos.notas || ''
  ];
  
  hoja.appendRow(fila);
  
  return { ok: true, id };
}

function editarPersonal(token, id_personal, campo, valor) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  if (usuario.rol !== 'admin') return { ok: false, error: 'Sin permiso (requiere admin)' };
  
  const hoja = getSheet(HOJA_PERSONAL);
  const datos = hoja.getDataRange().getValues();
  
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0] === id_personal) {
      const encabezados = datos[0];
      const colIdx = encabezados.indexOf(campo);
      if (colIdx === -1) return { ok: false, error: 'Campo no existe' };
      
      hoja.getRange(i + 1, colIdx + 1).setValue(valor);
      return { ok: true };
    }
  }
  
  return { ok: false, error: 'Personal no encontrado' };
}

// ============================================
// ASISTENCIA
// ============================================

function listarAsistencia(token, fecha) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  
  const hoja = getSheet(HOJA_ASISTENCIA);
  const filas = hoja.getDataRange().getValues();
  const encabezados = filas[0];
  const datos = [];
  
  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    const registro = {};
    encabezados.forEach((h, idx) => {
      registro[h] = fila[idx];
    });
    if (registro.fecha === fecha) {
      datos.push(registro);
    }
  }
  
  return { ok: true, datos };
}

function guardarAsistencia(token, fecha, lista) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  
  const hoja = getSheet(HOJA_ASISTENCIA);
  const datos = hoja.getDataRange().getValues();
  const encabezados = datos[0];
  
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    // Eliminar registros existentes del día
    for (let i = datos.length - 1; i > 0; i--) {
      if (datos[i][encabezados.indexOf('fecha')] === fecha) {
        hoja.deleteRow(i + 1);
        datos = hoja.getDataRange().getValues(); // refrescar
      }
    }
    
    // Agregar nuevos registros
    for (const item of lista) {
      const fila = [
        generarId('ASI', new Date()),
        fecha,
        item.id_personal,
        item.estado || 'Presente',
        item.jornada || 1,
        item.hora_entrada || '',
        item.hora_salida || '',
        item.observacion || '',
        usuario.usuario
      ];
      hoja.appendRow(fila);
    }
    
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ============================================
// PLANILLA
// ============================================

function obtenerPendientes(token, id_personal) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  
  const hojaAsistencia = getSheet(HOJA_ASISTENCIA);
  const hojaPagos = getSheet(HOJA_PAGOS);
  
  // Calcular días trabajados sin pagar
  const asistencia = hojaAsistencia.getDataRange().getValues();
  const encabezados = asistencia[0];
  
  let totalDias = 0;
  for (let i = 1; i < asistencia.length; i++) {
    const fila = asistencia[i];
    const reg = {};
    encabezados.forEach((h, idx) => reg[h] = fila[idx]);
    
    if (!id_personal || reg.id_personal === id_personal) {
      // Verificar que no tenga pago pendiente
      // (simplificado - en producción se verificaría el período)
      totalDias += parseFloat(reg.jornada) || 0;
    }
  }
  
  // Obtener jornal del personal
  const hojaPersonal = getSheet(HOJA_PERSONAL);
  const personal = hojaPersonal.getDataRange().getValues();
  let jornal = 0;
  for (let i = 1; i < personal.length; i++) {
    if (personal[i][0] === id_personal) {
      jornal = parseFloat(personal[i][3]);
      break;
    }
  }
  
  return { ok: true, total_dias: totalDias, jornal_bs: jornal, monto_por_pagar: totalDias * jornal };
}

function listarPagos(token, filtros) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  
  const hoja = getSheet(HOJA_PAGOS);
  const filas = hoja.getDataRange().getValues();
  const encabezados = filas[0];
  const datos = [];
  
  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    const reg = {};
    encabezados.forEach((h, idx) => reg[h] = fila[idx]);
    
    // Aplicar filtros si existen
    if (filtros?.id_personal && reg.id_personal !== filtros.id_personal) continue;
    if (filtros?.desde && reg.fecha < filtros.desde) continue;
    if (filtros?.hasta && reg.fecha > filtros.hasta) continue;
    
    datos.push(reg);
  }
  
  return { ok: true, datos };
}

function crearAjuste(token, datos) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  if (usuario.rol !== 'admin') return { ok: false, error: 'Sin permiso (requiere admin)' };
  
  const hoja = getSheet(HOJA_AJUSTES);
  const fila = [
    generarId('AJU', new Date()),
    datos.fecha || formatearFecha(new Date()),
    datos.id_personal,
    datos.tipo,
    datos.monto_bs,
    datos.motivo || '',
    datos.id_pago_aplicado || ''
  ];
  
  hoja.appendRow(fila);
  return { ok: true, id_ajuste: fila[0] };
}

function listarAjustes(token, filtros) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  
  const hoja = getSheet(HOJA_AJUSTES);
  const filas = hoja.getDataRange().getValues();
  const encabezados = filas[0];
  const datos = [];
  
  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    const reg = {};
    encabezados.forEach((h, idx) => reg[h] = fila[idx]);
    
    if (filtros?.id_personal && reg.id_personal !== filtros.id_personal) continue;
    if (filtros?.tipo && reg.tipo !== filtros.tipo) continue;
    
    datos.push(reg);
  }
  
  return { ok: true, datos };
}

function registrarPago(token, datos) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  if (usuario.rol !== 'admin') return { ok: false, error: 'Sin permiso (requiere admin)' };
  
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const total = datos.dias * datos.jornal_bs;
    
    // Verificar no doble pago
    const hojaPagos = getSheet(HOJA_PAGOS);
    const pagos = hojaPagos.getDataRange().getValues();
    const enc = pagos[0];
    
    for (let i = 1; i < pagos.length; i++) {
      const p = pagos[i];
      const reg = {};
      enc.forEach((h, idx) => reg[h] = p[idx]);
      if (reg.id_personal === datos.id_personal && reg.periodo_hasta === datos.periodo_hasta) {
        return { ok: false, error: 'Pago ya registrado para este período' };
      }
    }
    
    const fila = [
      generarId('PAG', new Date()),
      datos.fecha || formatearFecha(new Date()),
      datos.id_personal,
      datos.descripcion || 'Pago por Jornal trabajado',
      datos.dias,
      datos.jornal_bs,
      total,
      datos.periodo_desde,
      datos.periodo_hasta,
      usuario.usuario
    ];
    
    hojaPagos.appendRow(fila);
    
    return { ok: true, total_pagado: total };
  } finally {
    lock.releaseLock();
  }
}

// ============================================
// REPORTES
// ============================================

function obtenerDashboard(token, desde, hasta) {
  const usuario = validarToken(token);
  if (!usuario) return { ok: false, error: 'Sin permiso' };
  
  const respuesta = {
    personal: [],
    asistencia: [],
    pagos: [],
    servicios: [],
    resumen: {}
  };
  
  // TODO: Implementar agregaciones
  // Esta función devuelve todos los datos necesarios para los gráficos
  
  return { ok: true, datos: respuesta };
}

// ============================================
// UTILIDADES DE GOOGLE SHEETS
// ============================================

function crearHojasIniciales() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Personal
  if (!ss.getSheetByName(HOJA_PERSONAL)) {
    const hoja = ss.insertSheet(HOJA_PERSONAL);
    hoja.appendRow(['id_personal', 'nombre', 'cargo', 'jornal_bs', 'estado', 'fecha_ingreso', 'telefono', 'notas']);
  }
  
  // Asistencia
  if (!ss.getSheetByName(HOJA_ASISTENCIA)) {
    const hoja = ss.insertSheet(HOJA_ASISTENCIA);
    hoja.appendRow(['id_asistencia', 'fecha', 'id_personal', 'estado', 'jornada', 'hora_entrada', 'hora_salida', 'observacion', 'registrado_por']);
  }
  
  // Pagos
  if (!ss.getSheetByName(HOJA_PAGOS)) {
    const hoja = ss.insertSheet(HOJA_PAGOS);
    hoja.appendRow(['id_pago', 'fecha', 'id_personal', 'descripcion', 'dias', 'jornal_bs', 'total_pagado', 'periodo_desde', 'periodo_hasta', 'registrado_por']);
  }
  
  // Ajustes
  if (!ss.getSheetByName(HOJA_AJUSTES)) {
    const hoja = ss.insertSheet(HOJA_AJUSTES);
    hoja.appendRow(['id_ajuste', 'fecha', 'id_personal', 'tipo', 'monto_bs', 'motivo', 'id_pago_aplicado']);
  }
  
  // Servicios
  if (!ss.getSheetByName(HOJA_SERVICIOS)) {
    const hoja = ss.insertSheet(HOJA_SERVICIOS);
    hoja.appendRow(['id_servicio', 'fecha', 'cliente', 'placa', 'marca', 'tipo_vehiculo', 'actividad', 'total_servicio_bs', 'id_personal']);
  }
  
  // Usuarios
  if (!ss.getSheetByName(HOJA_USUARIOS)) {
    const hoja = ss.insertSheet(HOJA_USUARIOS);
    hoja.appendRow(['usuario', 'nombre', 'rol', 'salt', 'pin_hash', 'activo']);
    // Crear usuario admin por defecto (PIN: 1234, cambiar después)
    const salt = generarSalt();
    const hash = hashConSalt('1234', salt);
    hoja.appendRow(['admin', 'Administrador', 'admin', salt, hash, 'SI']);
  }
  
  // Config
  if (!ss.getSheetByName(HOJA_CONFIG)) {
    const hoja = ss.insertSheet(HOJA_CONFIG);
    hoja.appendRow(['clave', 'valor']);
    hoja.appendRow(['nombre_negocio', 'Hydra Car Wash']);
    hoja.appendRow(['version_esquema', '1.0']);
  }
}

// ============================================
// ENTRADA PRINCIPAL
// ============================================

function doPost(e) {
  try {
    const cuerpo = e.postData.contents;
    const datos = JSON.parse(cuerpo);
    
    const accion = datos.accion;
    const token = datos.token;
    const payload = datos.datos || datos;
    
    switch (accion) {
      case 'login':
        return JSON.stringify(doLogin(payload));
      
      case 'logout':
        invalidarToken(token);
        return JSON.stringify({ ok: true });
      
      case 'personal.listar':
        return JSON.stringify(listarPersonal(token));
      
      case 'personal.crear':
        return JSON.stringify(crearPersonal(token, payload));
      
      case 'personal.editar':
        return JSON.stringify(editarPersonal(token, payload.id_personal, payload.campo, payload.valor));
      
      case 'asistencia.listar':
        return JSON.stringify(listarAsistencia(token, payload.fecha));
      
      case 'asistencia.guardar':
        return JSON.stringify(guardarAsistencia(token, payload.fecha, payload.lista));
      
      case 'planilla.pendientes':
        return JSON.stringify(obtenerPendientes(token, payload.id_personal));
      
      case 'planilla.pagar':
        return JSON.stringify(registrarPago(token, payload));
      
      case 'planilla.listar':
        return JSON.stringify(listarPagos(token, payload));
      
      case 'ajustes.crear':
        return JSON.stringify(crearAjuste(token, payload));
      
      case 'ajustes.listar':
        return JSON.stringify(listarAjustes(token, payload));
      
      case 'reportes.dashboard':
        return JSON.stringify(obtenerDashboard(token, payload.desde, payload.hasta));
      
      default:
        return JSON.stringify({ ok: false, error: 'Acción no reconocida' });
    }
  } catch (error) {
    return JSON.stringify({ ok: false, error: error.toString() });
  }
}