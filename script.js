// ============================================================
// APPS SCRIPT UNIFICADO — RPM Construcciones
// v1.0 — Primera versión con estructura estandarizada
// Un solo script maneja TODOS los formularios de depósito y traslados.
// Cada formulario manda el campo "zona" para identificarse.
// ============================================================

// ⬇️ NUEVO ─────────────────────────────────────────────────
// SEGURIDAD — Firebase Auth
// Mientras sea false, el script acepta pedidos sin login (para ir probando).
// Cuando todos los HTML tengan login, cambiarlo a true.
const AUTH_OBLIGATORIA = false;

const FB_ROLES = {
  'deposito@rpm.local': 'escritura',
  'gerencia@rpm.local': 'escritura'
  // más adelante: 'jefe@rpm.local': 'escritura', 'dev@rpm.local': 'escritura'
};

function autenticar_(idToken) {
  if (!idToken) return { ok: false };
  const cache = CacheService.getScriptCache();
  const key = 'tk_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  let email = cache.get(key);
  if (!email) {
    try {
      const apiKey = PropertiesService.getScriptProperties().getProperty('FB_API_KEY');
      const res = UrlFetchApp.fetch(
        'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + apiKey,
        { method: 'post', contentType: 'application/json',
          payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) return { ok: false };
      const u = (JSON.parse(res.getContentText()).users || [])[0];
      if (!u || !u.email) return { ok: false };
      email = String(u.email).toLowerCase();
      cache.put(key, email, 300); // 5 min: evita consultar a Firebase en cada polling
    } catch (err) { return { ok: false }; }
  }
  const rol = FB_ROLES[email];
  return rol ? { ok: true, email: email, rol: rol } : { ok: false };
}

function forzarAutorizacionExterna() { UrlFetchApp.fetch('https://www.google.com'); }
// ⬆️ FIN NUEVO ─────────────────────────────────────────────

// ============================================================
// 1. CONFIG Y CONSTANTES
// ============================================================

// ============================================================
// 1.1 Familias y orden de descripción
// ============================================================
const ORDEN_DESCRIPCION = {
  termicas:      ['amperaje', 'polos', 'curva', 'tension'],
  disyuntores:   ['polos', 'amperaje', 'sensibilidad', 'tipo', 'tension'],
  guardamotores: ['rango', 'tension', 'montaje'],
  alta_potencia: ['material', 'configuracion', 'seccion', 'presentacion', 'nro_bobina', 'codigo_bobina', 'peso_bobina'],
  borneras:      ['tipo', 'corriente'],
  borneras_barra:['tipo', 'puntos', 'corriente'],
  fusibles:      ['tipo', 'amperaje', 'tension'],
  portafusibles: ['fusible', 'amperaje_max', 'montaje'],
  fuentes:       ['tipo', 'tension_salida', 'potencia', 'corriente', 'ip', 'tension_entrada'],
  fuentes_led:   ['tipo', 'tension_salida', 'potencia', 'corriente', 'ip', 'tension_entrada'],
  dmx:           ['tension', 'corriente', 'potencia'],
  lamparas:      ['tipo', 'marca', 'potencia', 'base', 'voltaje', 'color_luz', 'modelo'],
  contactores:   ['polos', 'bobina', 'corriente'],
  pulsadores:    ['tipo', 'color', 'contacto'],
  ojosbuey:      ['color', 'tension', 'diametro'],
  bloqueaux:     ['tipo'],
  terminales:    ['material', 'medida', 'ojal'],
  gabinetes: ['tipo', 'dimensiones', 'soporte', 'rieldim', 'ip'],
  cajas:     ['tipo', 'maxmodulos', 'dimensiones', 'ip'],
  filtros:              ['maquina', 'tipo'],
  aceites:              ['tipo', 'viscosidad', 'marca', 'presentacion'],
  grasas:               ['codigo'],
  refrigerantes:        ['codigo'],
  liquido_freno:        ['tipo', 'codigo'],
  combustibles:         ['tipo_combustible'],
  pinturas:             ['tipo', 'color', 'presentacion', 'marca'],
  selladores:           ['tipo', 'variante', 'marca'],
  aerosoles:            ['tipo', 'marca', 'tamano'],
  cintas:               ['tipo', 'marca'],
  abrasivos:            ['tipo', 'medida', 'marca'],
  mechas:               ['tipo', 'medida', 'marca'],
  electrodos:           ['tipo', 'diametro', 'marca'],
  precintos:            ['medida', 'color', 'marca'],
  herramientas_pintura: ['tipo', 'medida', 'marca'],
  varios:               ['tipo', 'presentacion', 'marca'],
  aplique_ext:       ['subtipo', 'direccion', 'zocalo', 'potencia', 'color_luz', 'marca', 'condicion'],
  empotrable:        ['subtipo', 'forma', 'potencia', 'color_luz', 'alimentacion', 'ip', 'condicion'],
  aplique_int:       ['forma', 'direccion', 'color_estructura', 'condicion'],
  colgante:          ['modelo', 'config', 'potencia_lampara', 'condicion'],
  proyector_hid:     ['tipo_lampara', 'potencia', 'componentes', 'condicion'],
  reflector_led:     ['subtipo', 'potencia', 'color_luz', 'linea', 'marca', 'condicion'],
  reflector_rgb:     ['leds', 'control', 'condicion'],
  banador:           ['formato', 'longitud', 'voltaje', 'potencia', 'leds_config', 'color_luz', 'control', 'ip', 'condicion'],
  tira_led:          ['voltaje', 'chip', 'densidad', 'color_luz', 'formato_venta', 'ip', 'condicion', 'marca'],
  led_e27:           ['subtipo', 'potencia', 'color_luz', 'formato', 'marca', 'condicion'],
  dicroica_led:      ['zocalo', 'potencia', 'color_luz', 'angulo', 'marca', 'condicion'],
  tubo_fluor:        ['tipo', 'potencia', 'color_luz', 'marca', 'condicion'],
  bajo_consumo:      ['subtipo', 'zocalo', 'potencia', 'color_luz', 'modelo', 'marca', 'condicion'],
  sodio:             ['tecnologia', 'potencia', 'zocalo', 'formato', 'marca', 'condicion'],
  dicroica_halogena: ['subtipo', 'potencia', 'voltaje', 'marca', 'condicion'],
  guantes:     ['tipo', 'talle', 'estado'],
  anteojos:    ['tipo', 'lente', 'estado'],
  protectores: ['tipo', 'estado'],
  cascos:      ['color', 'equipamiento', 'estado'],
  botas:       ['talle', 'tipo', 'estado'],
  botines:     ['tipo', 'talle', 'color', 'estado'],
  botines_mujer: ['tipo', 'talle', 'color', 'estado'],
  bolsos:      ['tipo', 'estado'],
  arneses:     ['tipo', 'color', 'estado', 'accesorios'],
  eslingas:    ['longitud', 'color_faja', 'ancho', 'norma', 'estado'],
  criquets:    ['tipo', 'capacidad', 'longitud', 'estado'],
  camisas:     ['tejido', 'talle', 'color', 'tipo', 'estado'],
  pantalones:  ['tejido', 'talle', 'color', 'tipo', 'estado'],
  camperas:    ['talle', 'color', 'tipo', 'estado'],
  mamelucos:   ['tipo', 'talle', 'estado'],
  chalecos:    ['color', 'talle', 'estado'],
  delantales:  ['tipo', 'talle', 'color', 'estado'],
  capas:       ['color', 'tipo', 'talle', 'estado'],
  canopvc:    ['tipo_estructura', 'diametro', 'presentacion', 'color_norma', 'marca'],
  canohierro: ['material', 'diametro', 'longitud', 'aplicacion', 'terminacion'],
  canosanit:  ['diametro', 'servicio', 'longitud', 'tipo_union', 'uso', 'marca'],
  gabmetalico:   ['modelo', 'dimensiones', 'config_interna'],
  gabestanco:    ['marca', 'modelo', 'tapa'],
  gabmedidor:    ['tipo_aplicacion', 'config_conexion'],
  cajapaso:      ['dimensiones', 'marca', 'hermeticidad'],
  cajaembutir:   ['modelo', 'instalacion', 'marca'],
  conectores:    ['material', 'diametro', 'marca'],
  curvas:        ['material', 'diametro', 'marca'],
  uniones:       ['material', 'diametro', 'tipo_ajuste'],
  prensas:       ['tipo', 'material', 'diametro', 'marca'],
  mecanismos:    ['tipo_componente', 'linea', 'color'],
  pat:           ['tipo_equipo', 'estado'],
  unipolar:  ['seccion', 'version', 'color', 'presentacion', 'nro_bobina', 'codigo_bobina', 'peso_bobina'],
  ttr:       ['conductores', 'seccion', 'presentacion', 'nro_bobina', 'codigo_bobina', 'peso_bobina'],
  subterraneo: ['material', 'configuracion', 'seccion', 'presentacion', 'nro_bobina', 'codigo_bobina', 'peso_bobina'],
  preen:     ['config', 'seccion', 'presentacion', 'nro_bobina', 'codigo_bobina', 'peso_bobina'],
  conc:      ['material', 'config', 'presentacion', 'nro_bobina', 'codigo_bobina', 'peso_bobina'],
  desnudo:   ['material', 'seccion', 'presentacion', 'nro_bobina', 'codigo_bobina', 'peso_bobina'],
  especial:  ['tipo', 'presentacion', 'nro_bobina', 'codigo_bobina', 'peso_bobina'],
  termcu:    ['seccion', 'subtipo'],
  termal:    ['seccion', 'ojal'],
  puntera:   ['seccion'],
  empalme:   ['tipo', 'seccion'],
  herraje:   ['tipo', 'modelo'],
  prensa:    ['diametro', 'material'],
  herr_portatiles: ['tipo', 'alimentacion', 'capacidad', 'marca'],
  maq_banco:       ['tipo', 'capacidad', 'alimentacion', 'marca'],
  corte_manual:    ['tipo', 'configuracion', 'marca'],
  maq_pesada:      ['tipo', 'tambor', 'encastre', 'marca'],
  generadores:     ['potencia', 'combustible', 'arranque', 'marca'],
  compresores:     ['capacidad_tanque', 'potencia', 'transmision', 'marca'],
  mano:         ['tipo', 'medida', 'marca'],
  llaves:       ['tipo', 'medida', 'formato', 'marca'],
  medicion:     ['tipo', 'medida', 'marca'],
  albanileria:  ['tipo', 'marca'],
  escaleras:    ['tipo', 'material', 'peldanos'],
  excavacion:   ['tipo', 'medida', 'material'],
  varios_panol: ['tipo', 'especificacion', 'marca'],
  adhesivos:    ['tipo', 'variante', 'marca'],
  senalizacion: ['tipo', 'medida', 'color'],
  embutidos:   ['tipo', 'potencia', 'tension', 'dimensiones'],
  alumbrado:   ['tipo', 'modelo', 'potencia', 'temperatura', 'dimensiones'],
  reflectores: ['tipo', 'potencia', 'temperatura'],
  proyectores: ['tipo', 'potencia', 'temperatura'],
  apliques:    ['tipo', 'potencia', 'ip', 'temperatura', 'dimensiones'],
  especiales:  ['tipo', 'dimensiones'],
  rotos:       ['tipo', 'marca', 'potencia', 'base', 'problema', 'problema_detalle', 'dimensiones'],
  // ── Instalación Eléctrica (formulario nuevo) ──
  modulos:     ['tipo', 'subtipo', 'color'],
  cajas_ie:    ['formato', 'material', 'medida'],
  canieria:    ['tipo', 'tuerca', 'material', 'diametro_medida', 'color'],
  // ── Insumos libres (texto libre + marca) ──
  grampas:            ['descripcion'],
  mordaza_jabalina:   ['descripcion'],
  bornera_bpn:        ['descripcion'],
  separador_bornera:  ['descripcion'],
  arandela:           ['descripcion'],
  prensa_cable:       ['descripcion'],
  cinta_aisladora:    ['descripcion'],
  cinta_autosoldable: ['descripcion'],
  precinto_plastico:  ['descripcion'],
  prolongador:        ['descripcion']
};

const FAMILIAS = {
  termicas:      'TÉRMICA',
  disyuntores:   'DISYUNTOR DIFERENCIAL',
  guardamotores: 'GUARDAMOTOR',
  borneras:      'BORNERA FIJA',
  borneras_barra:'BORNERA DE BARRA',
  fusibles:      'FUSIBLE',
  portafusibles: 'PORTAFUSIBLE',
  fuentes:       'FUENTE DE ALIMENTACIÓN',
  fuentes_led:   'FUENTE ESPECIAL LED LINEAL',
  dmx:           'DECODIFICADOR DMX',
  lamparas:      'LÁMPARA / FOCO',
  contactores:   'CONTACTOR',
  pulsadores:    'PULSADOR',
  ojosbuey:      'OJO DE BUEY',
  bloqueaux:     'BLOQUE DE CONTACTO AUXILIAR',
  terminales:    'TERMINAL',
  filtros:       'FILTRO',
  aceites:       'ACEITE / LUBRICANTE',
  grasas:        'GRASA',
  refrigerantes: 'LÍQUIDO REFRIGERANTE',
  liquido_freno: 'LÍQUIDO DE FRENO',
  combustibles:  'COMBUSTIBLE',
  pinturas:      'PINTURA / RECUBRIMIENTO',
  selladores:    'SELLADOR / ADHESIVO',
  aerosoles:     'AEROSOL TÉCNICO',
  cintas:        'CINTA',
  abrasivos:     'ABRASIVO (DISCO/LIJA)',
  mechas:        'MECHA / ACCESORIO',
  electrodos:    'ELECTRODO',
  precintos:     'PRECINTO',
  herramientas_pintura: 'HERRAMIENTAS DE PINTURA',
  varios:        'VARIOS / FERRETERÍA',
  aplique_ext:   'APLIQUE EXTERIOR',
  empotrable:    'EMPOTRABLE / ESTACA',
  aplique_int:   'APLIQUE INTERIOR',
  colgante:      'COLGANTE INDUSTRIAL',
  proyector_hid: 'PROYECTOR HID',
  reflector_led: 'REFLECTOR LED',
  reflector_rgb: 'REFLECTOR RGB DMX',
  banador:       'BAÑADOR / WALLWASHER',
  tira_led:      'TIRA LED',
  led_e27:       'LÁMPARA LED E27',
  dicroica_led:  'DICROICA LED',
  tubo_fluor:    'TUBO FLUORESCENTE',
  bajo_consumo:  'BAJO CONSUMO / PLC',
  sodio:         'SODIO / MERCURIO',
  dicroica_halogena: 'DICROICA / HALÓGENA',
  guantes:       'GUANTES',
  anteojos:      'ANTEOJOS / ANTIPARRAS',
  protectores:   'PROTECTOR FACIAL / AUDITIVO',
  cascos:        'CASCO DE SEGURIDAD',
  botas:         'BOTAS DE GOMA',
  botines:       'BOTINES DE SEGURIDAD',
  botines_mujer: 'BOTÍN CAPRI GRAY PU (MUJER)',
  bolsos:        'BOLSO / PORTA HERRAMIENTA',
  arneses:       'EQUIPOS DE ALTURA Y SUJECIÓN',
  eslingas:      'ESLINGA DE FAJA',
  criquets:      'CRIQUET TENSOR',
  camisas:       'CAMISA DE TRABAJO',
  pantalones:    'PANTALÓN DE TRABAJO',
  camperas:      'CAMPERA DE TRABAJO',
  mamelucos:     'MAMELUCO',
  chalecos:      'CHALECO FLUORESCENTE',
  delantales:    'DELANTAL / SACO SOLDADOR',
  capas:         'CAPA DE LLUVIA',
  canopvc:       'CAÑO ELÉCTRICO PVC',
  canohierro:    'CAÑO HIERRO / CHAPA',
  canosanit:     'CAÑO PVC SANITARIO',
  gabmetalico:   'GABINETE METÁLICO',
  gabestanco:    'GABINETE ESTANCO',
  gabmedidor:    'GABINETE DE MEDIDOR',
  cajapaso:      'CAJA DE PASO',
  cajaembutir:   'CAJA DE EMBUTIR',
  conectores:    'CONECTOR DE CAÑERÍA',
  curvas:        'CURVA 90°',
  uniones:       'UNIÓN / CUPLA',
  prensas:       'PRENSA CABLE / PIPETA',
  mecanismos:    'LLAVE / TOMA / BASTIDOR',
  pat:           'EQUIPO PAT',
  unipolar:      'CABLE UNIPOLAR',
  ttr:           'CABLE TTR',
  subterraneo:   'CABLE SUBTERRÁNEO',
  alta_potencia: 'CABLE DE ALTA POTENCIA MORADO',
  preen:         'CABLE PREENSAMBLADO',
  conc:          'CABLE CONCÉNTRICO',
  desnudo:       'CABLE DESNUDO',
  especial:      'CABLE ESPECIAL',
  termcu:        'TERMINAL DE COBRE',
  termal:        'TERMINAL DE ALUMINIO',
  puntera:       'PUNTERA AISLADA',
  empalme:       'EMPALME',
  herraje:       'HERRAJE DE LÍNEA',
  prensa:        'PRENSACABLE',
  herr_portatiles: 'HERRAMIENTA PORTÁTIL',
  maq_banco:     'MAQUINARIA DE BANCO',
  corte_manual:  'HERRAMIENTA DE CORTE MANUAL',
  maq_pesada:    'MAQUINARIA DE OBRA PESADA',
  generadores:   'GRUPO ELECTRÓGENO',
  compresores:   'COMPRESOR DE AIRE',
  mano:          'HERRAMIENTA DE MANO',
  llaves:        'LLAVE',
  medicion:      'INSTRUMENTO DE MEDICIÓN',
  albanileria:   'HERRAMIENTA DE ALBAÑILERÍA',
  escaleras:     'ESCALERA',
  excavacion:    'HERRAMIENTA DE EXCAVACIÓN',
  varios_panol:  'VARIOS DE PAÑOL',
  adhesivos:     'ADHESIVO / ALAMBRE',
  senalizacion:  'SEÑALIZACIÓN',
  gabinetes:     'GABINETE',
  cajas:         'CAJA',
  embutidos:     'ARTEFACTOS PARA EMBUTIR',
  alumbrado:     'ALUMBRADO PÚBLICO',
  reflectores:   'REFLECTORES',
  proyectores:   'PROYECTORES',
  apliques:      'APLIQUES / PARED / PISO',
  especiales:    'ESPECIALES / COLGANTES',
  rotos:         'ROTOS / PARA REVISIÓN',
  // ── Instalación Eléctrica (formulario nuevo) ──
  modulos:       'MÓDULO PARA EMBUTIR',
  cajas_ie:      'CAJA PARA EMBUTIR (MÓDULOS)',
  canieria:      'ACCESORIO DE CAÑERÍA',
  // ── Insumos libres ──
  grampas:            'GRAMPA',   // se reemplaza por el tipo elegido (ver A-4)
  mordaza_jabalina:   'MORDAZA PARA JABALINA',
  bornera_bpn:        'BORNERA PASO BPN',
  separador_bornera:  'SEPARADOR PARA BORNERA',
  arandela:           'ARANDELA',
  prensa_cable:       'PRENSA CABLE',
  cinta_aisladora:    'CINTA AISLADORA PVC',
  cinta_autosoldable: 'CINTA AUTOSOLDABLE',
  precinto_plastico:  'PRECINTO PLASTICO',
  prolongador:        'PROLONGADOR'
};
const ZONA_LUBRICANTES = 'LUBRICANTES Y FLUIDOS';
const FAM_LUBRICANTES  = ['aceites', 'grasas', 'refrigerantes', 'liquido_freno'];
function R2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function familiaAceite(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (/transm/.test(t))           return 'ACEITE DE TRANSMISIÓN HIDRÁULICA';
  if (/hidr/.test(t))             return 'ACEITE HIDRÁULICO';
  if (/motor/.test(t))            return 'ACEITE MOTOR';
  if (/diferencial|ejes/.test(t)) return 'ACEITE DE DIFERENCIAL DE EJES';
  return 'ACEITE / LUBRICANTE';
}

// ============================================================
// 1.2 Columnas — Depósito
// ============================================================
const DEP_COL_MOV = {
  ID_PEDIDO:    1,
  FECHA:        2,
  TIPO:         3,
  RESPONSABLE:  4,
  OBRA:         5,
  ZONA:         6,
  FAMILIA:      7,
  MARCA:        8,
  DESCRIPCION:  9,
  CANTIDAD:     10,
  UNIDAD:       11,
  OBS_ITEM:     12,
  OBS_GENERAL:  13,
  NRO_ENVIO:    14,
  UBIC_DEPOSITO: 15,
  UBIC_ESTANTE:  16,
  UBIC_COLUMNA:  17,
  UBIC_FILA:     18,
  NRO_FACTURA:   19,
  TOTAL:         19 // ✅ Mantiene explícito el conteo total de columnas mapeadas,
};

const DEP_COL_STOCK = {
  ID:             1,
  ZONA:           2,
  FAMILIA:        3,
  MARCA:          4,
  DESCRIPCION:    5,
  IMAGEN:         6,   
  UNIDAD:         7,   
  ENTRADAS:       8,
  SALIDAS:        9,
  DEVOLUCIONES:   10,
  STOCK_ACTUAL:   11,
  STOCK_MINIMO:   12,
  ESTADO:         13,
  ULT_MOVIMIENTO: 14,
  ULT_OBS:        15,  
  ULT_FECHA:      16,
  ULT_HORA:       17,
  UBIC_DEPOSITO:  18,
  UBIC_ESTANTE:   19,
  UBIC_COLUMNA:   20,
  UBIC_FILA:      21,
  ULT_MOV_OBS:    22,  
  TOTAL:          22,
};

// ============================================================
// 1.3 Columnas — Traslados
// ============================================================
const TRA_COL_MOV = {
  ID:           1,
  FECHA:        2,
  RESPONSABLE:  3,
  RUTA:         4,
  CATEGORIA:    5,
  DESCRIPCION:  6,
  DETALLE:      7,
  SERIE:        8,
  CANTIDAD:     9,
  ESTADO:       10,
  EQUIPO:       11,
  OBS_ITEM:     12,
  OBS_GENERAL:  13,
  NRO_TRASLADO: 14,
  TOTAL:        14,
};

const TRA_COL_STOCK = {
  ID:           1,
  DEPOSITO:     2,
  CATEGORIA:    3,
  DESCRIPCION:  4,
  DETALLE:      5,
  ENTRADAS:     6,
  SALIDAS:      7,
  STOCK_ACTUAL: 8,
  ESTADO_ITEM:  9,
  ULT_MOV:      10,
  ULT_FECHA:    11,
  ULT_HORA:     12,
  TOTAL:        12,
};

// ============================================================
// 2. UTILIDADES COMUNES
// ============================================================

// ============================================================
// 2.1 Respuestas JSON
// ============================================================
function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 2.2 Formateo de fecha/hora de celdas
// ============================================================
function formatearFechaCelda(valor) {
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return String(valor || '');
}

function formatearHoraCelda(valor) {
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(valor || '');
}

function dep_normalizarFecha(f, timezone) {
  if (!f) return Utilities.formatDate(new Date(), timezone || Session.getScriptTimeZone(), 'd/M/yyyy, HH:mm:ss');
  var str = String(f).trim();
  if (str.indexOf('T') !== -1 && str.indexOf('Z') !== -1) {
    try {
      var d = new Date(str);
      if (!isNaN(d.getTime())) {
        var day = d.getDate();
        var month = d.getMonth() + 1;
        var year = d.getFullYear();
        var hours = String(d.getHours()).padStart(2, '0');
        var mins = String(d.getMinutes()).padStart(2, '0');
        var secs = String(d.getSeconds()).padStart(2, '0');
        return day + '/' + month + '/' + year + ', ' + hours + ':' + mins + ':' + secs;
      }
    } catch (e) {}
  }
  return str;
}

// ============================================================
// 2.3 Conversión de fila a objeto
// ============================================================
function _filaAObjeto(row) {
  const stockActual = Number(row[DEP_COL_STOCK.STOCK_ACTUAL - 1]) || 0;
  const stockMinimo = Number(row[DEP_COL_STOCK.STOCK_MINIMO - 1]) || 0;
  const estadoRaw   = String(row[DEP_COL_STOCK.ESTADO - 1] || '').trim();
  const estado      = estadoRaw || (stockActual <= stockMinimo ? 'REPONER' : 'OK');

  return {
    id:           String(row[DEP_COL_STOCK.ID           - 1] || ''),
    zona:         String(row[DEP_COL_STOCK.ZONA         - 1] || ''),
    familia:      String(row[DEP_COL_STOCK.FAMILIA      - 1] || ''),
    marca:        String(row[DEP_COL_STOCK.MARCA        - 1] || ''),
    descripcion:  String(row[DEP_COL_STOCK.DESCRIPCION  - 1] || ''),
    entradas:     Number(row[DEP_COL_STOCK.ENTRADAS     - 1]) || 0,
    salidas:      Number(row[DEP_COL_STOCK.SALIDAS      - 1]) || 0,
    devoluciones: Number(row[DEP_COL_STOCK.DEVOLUCIONES - 1]) || 0,
    stock_actual: stockActual,
    stock_minimo: stockMinimo,
    estado:       estado,
    ult_mov:      String(row[DEP_COL_STOCK.ULT_MOVIMIENTO - 1] || ''),
    ult_fecha:    formatearFechaCelda(row[DEP_COL_STOCK.ULT_FECHA - 1]),
    ult_hora:     formatearHoraCelda(row[DEP_COL_STOCK.ULT_HORA  - 1]),
    ubicacion_deposito: String(row[DEP_COL_STOCK.UBIC_DEPOSITO - 1] || ''),
    ubicacion_estante:  String(row[DEP_COL_STOCK.UBIC_ESTANTE  - 1] || ''),
    ubicacion_columna:  String(row[DEP_COL_STOCK.UBIC_COLUMNA  - 1] || ''),
    ubicacion_fila:     String(row[DEP_COL_STOCK.UBIC_FILA     - 1] || ''),
    imagen:  String(row[DEP_COL_STOCK.IMAGEN  - 1] || ''),
    unidad:  String(row[DEP_COL_STOCK.UNIDAD  - 1] || ''),
    ult_obs: String(row[DEP_COL_STOCK.ULT_OBS - 1] || ''),
    ult_mov_obs: String(row[DEP_COL_STOCK.ULT_MOV_OBS - 1] || ''),
  };
}

// ============================================================
// 2.4 Validación de consistencia
// ============================================================
function validarConsistenciaFamilias() {
  const faltanEnOrden = Object.keys(FAMILIAS).filter(k => !(k in ORDEN_DESCRIPCION));
  const faltanEnFamilias = Object.keys(ORDEN_DESCRIPCION).filter(k => !(k in FAMILIAS));
  if (faltanEnOrden.length || faltanEnFamilias.length) {
    Logger.log('⚠ Inconsistencia FAMILIAS/ORDEN_DESCRIPCION: ' +
      JSON.stringify({ faltanEnOrden, faltanEnFamilias }));
  }
}

// ============================================================
// 3. GESTIÓN DE FOTOS EN DRIVE
// ============================================================
const CARPETA_FOTOS_STOCK_ID = '1GmRJIr7yEUb5-fbqfrJQGZd8uSKad0jz'; // ← reemplazar por el ID real de tu carpeta de Drive

function subirImagenDrive(base64Data, nombreArchivo) {
  const carpeta = DriveApp.getFolderById(CARPETA_FOTOS_STOCK_ID);
  const bytes   = Utilities.base64Decode(base64Data);
  const blob    = Utilities.newBlob(bytes, 'image/jpeg', nombreArchivo);
  const archivo = carpeta.createFile(blob);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return `https://drive.google.com/thumbnail?id=${archivo.getId()}&sz=w1000`;
}

function carpetaParaEliminar() {
  const carpetaPrincipal = DriveApp.getFolderById(CARPETA_FOTOS_STOCK_ID);
  const existentes = carpetaPrincipal.getFoldersByName('Para eliminar');
  if (existentes.hasNext()) return existentes.next();
  return carpetaPrincipal.createFolder('Para eliminar');
}

function moverImagenAPapeleraInterna(idArchivo) {
  try {
    const archivo = DriveApp.getFileById(idArchivo);
    const destino = carpetaParaEliminar();
    const timezone = Session.getScriptTimeZone();
    const fechaTag = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');

    archivo.setName(fechaTag + '__' + archivo.getName());

    const padres = archivo.getParents();
    while (padres.hasNext()) {
      padres.next().removeFile(archivo);
    }
    destino.addFile(archivo);
  } catch (err) {
    Logger.log('No se pudo mover a "Para eliminar": ' + err.message);
  }
}

function limpiarImagenesVencidas() {
  const LIMITE_DIAS = 14;
  const carpeta = carpetaParaEliminar();
  const archivos = carpeta.getFiles();
  const ahora = new Date();

  while (archivos.hasNext()) {
    const archivo = archivos.next();
    const nombre = archivo.getName();
    const match = nombre.match(/^(\d{4}-\d{2}-\d{2})__/);
    if (!match) continue;

    const fechaMovido = new Date(match[1] + 'T00:00:00');
    const diasPasados = (ahora - fechaMovido) / (1000 * 60 * 60 * 24);

    if (diasPasados >= LIMITE_DIAS) {
      archivo.setTrashed(true);
      Logger.log('Eliminado definitivamente (venció el plazo): ' + nombre);
    }
  }
}

// ============================================================
// 4. PUNTOS DE ENTRADA
// ============================================================
function doGet(e) {
  const params = e.parameter || {};

  // ⬇️ NUEVO
  if (params.action && AUTH_OBLIGATORIA) {
    const auth = autenticar_(params.token);
    if (!auth.ok) return jsonResp({ ok: false, auth: false, error: 'No autorizado' });
  }
  // ⬆️ FIN NUEVO

  if (params.action === 'herr-datos') return herr_doGet(params);
  if (params.action === 'firmas') return firmas_doGet(params);
  if (params.action === 'ficha-salida') return fichaSalida_doGet(params);   // ⬅️ NUEVO

  if (params.action === 'json') {
    try {
      const ss        = SpreadsheetApp.getActiveSpreadsheet();
      const hojaStock = ss.getSheetByName('Stock');

      if (!hojaStock) {
        return jsonResp({ ok: false, error: 'Hoja Stock no encontrada.' });
      }

      const ultimaFila = hojaStock.getLastRow();
      if (ultimaFila <= 1) {
        return jsonResp({ ok: true, productos: [] });
      }

      const datos       = hojaStock.getRange(2, 1, ultimaFila - 1, DEP_COL_STOCK.TOTAL).getValues();
      const zonaBuscada = (params.zona || '').trim().toLowerCase();

      const productos = datos
        .filter(r => {
          if (!zonaBuscada) return true;
          return String(r[DEP_COL_STOCK.ZONA - 1]).trim().toLowerCase() === zonaBuscada;
        })
        .map(_filaAObjeto);

      return jsonResp({ ok: true, productos });

    } catch (err) {
      Logger.log('ERROR doGet json: ' + err.message);
      return jsonResp({ ok: false, error: err.message });
    }
  }

  if (params.action === 'lookup-ubicacion') {
    try {
      const ss        = SpreadsheetApp.getActiveSpreadsheet();
      const hojaStock = ss.getSheetByName('Stock');

      if (!hojaStock) {
        return jsonResp({ ok: false, error: 'Hoja Stock no encontrada.' });
      }

      const ultimaFila = hojaStock.getLastRow();
      if (ultimaFila <= 1) {
        return jsonResp({ ok: true, encontrada: false });
      }

      const datos       = hojaStock.getRange(2, 1, ultimaFila - 1, DEP_COL_STOCK.TOTAL).getValues();
      const zonaBuscada = (params.zona || '').trim().toLowerCase();
      const textoBusq   = (params.descripcion || params.marca || '').trim().toLowerCase();
      const tokens      = textoBusq.split('|').map(t => t.trim()).filter(Boolean);

      const fila = datos.find(r => {
        const zonaRow = String(r[DEP_COL_STOCK.ZONA - 1] || '').trim().toLowerCase();
        if (zonaBuscada && zonaRow !== zonaBuscada) return false;

        const campo = (
          String(r[DEP_COL_STOCK.DESCRIPCION - 1] || '') + ' ' +
          String(r[DEP_COL_STOCK.MARCA       - 1] || '')
        ).toLowerCase();

        return tokens.length > 0 && tokens.every(t => campo.includes(t));
      });

      if (!fila) {
        return jsonResp({ ok: true, encontrada: false });
      }

      const obj = _filaAObjeto(fila);
      return jsonResp({
        ok: true,
        encontrada: true,
        ubicacion: {
          deposito: obj.ubicacion_deposito,
          estante:  obj.ubicacion_estante,
          columna:  obj.ubicacion_columna,
          fila:     obj.ubicacion_fila
        }
      });

    } catch (err) {
      Logger.log('ERROR doGet lookup-ubicacion: ' + err.message);
      return jsonResp({ ok: false, error: err.message });
    }
  }

  if (params.action === 'historial') {
    try {
      const ss        = SpreadsheetApp.getActiveSpreadsheet();
      const hojaStock = ss.getSheetByName('Stock');
      const hojaMov   = ss.getSheetByName('Movimientos');
      if (!hojaStock) return jsonResp({ ok: false, error: 'Hoja Stock no encontrada.' });
      if (!hojaMov || hojaMov.getLastRow() <= 1) return jsonResp({ ok: true, movimientos: [] });

      const norm = v => String(v || '').trim();
      const idBuscado = norm(params.id).toUpperCase();
      const datosStock = hojaStock.getRange(2, 1, hojaStock.getLastRow() - 1, DEP_COL_STOCK.TOTAL).getValues();
      const filaStock = datosStock.find(r => norm(r[DEP_COL_STOCK.ID - 1]).toUpperCase() === idBuscado);
      if (!filaStock) return jsonResp({ ok: false, error: 'Producto no encontrado.' });

      const zona    = norm(filaStock[DEP_COL_STOCK.ZONA        - 1]);
      const familia = norm(filaStock[DEP_COL_STOCK.FAMILIA     - 1]);
      const marca   = norm(filaStock[DEP_COL_STOCK.MARCA       - 1]);
      const desc    = norm(filaStock[DEP_COL_STOCK.DESCRIPCION - 1]);

      const tz = Session.getScriptTimeZone();
      const datosMov = hojaMov.getRange(2, 1, hojaMov.getLastRow() - 1, DEP_COL_MOV.TOTAL).getValues();
      const movimientos = datosMov
        .filter(r =>
          norm(r[DEP_COL_MOV.ZONA        - 1]) === zona    &&
          norm(r[DEP_COL_MOV.FAMILIA     - 1]) === familia &&
          norm(r[DEP_COL_MOV.MARCA       - 1]) === marca   &&
          norm(r[DEP_COL_MOV.DESCRIPCION - 1]) === desc
        )
        .map(r => {
          const f = r[DEP_COL_MOV.FECHA - 1];
          return {
            fecha:       (f instanceof Date) ? Utilities.formatDate(f, tz, 'dd/MM/yyyy HH:mm') : String(f || ''),
            tipo:        String(r[DEP_COL_MOV.TIPO        - 1] || ''),
            cantidad:    Number(r[DEP_COL_MOV.CANTIDAD    - 1]) || 0,
            unidad:      String(r[DEP_COL_MOV.UNIDAD      - 1] || ''),
            responsable: String(r[DEP_COL_MOV.RESPONSABLE - 1] || ''),
            obra:        String(r[DEP_COL_MOV.OBRA        - 1] || ''),
            obs_item:    String(r[DEP_COL_MOV.OBS_ITEM    - 1] || ''),
            obs_general: String(r[DEP_COL_MOV.OBS_GENERAL - 1] || '')
          };
        })
        .reverse()
        .slice(0, 50);

      return jsonResp({ ok: true, movimientos });

    } catch (err) {
      Logger.log('ERROR doGet historial: ' + err.message);
      return jsonResp({ ok: false, error: err.message });
    }
  }

if (params.action === 'movimientos') {
  try {
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const hojaMov = ss.getSheetByName('Movimientos');

    if (!hojaMov) {
      return jsonResp({ ok: true, movimientos: [] });
    }

    const ultimaFila = hojaMov.getLastRow();
    if (ultimaFila <= 1) {
      return jsonResp({ ok: true, movimientos: [] });
    }

    const limite = Number(params.limit) || 1500;
    const datos = hojaMov.getRange(2, 1, ultimaFila - 1, DEP_COL_MOV.TOTAL).getValues();

    const movimientos = datos.slice(-limite).map(r => ({
      fecha:        formatearFechaCelda(r[DEP_COL_MOV.FECHA - 1]) + ' ' + formatearHoraCelda(r[DEP_COL_MOV.FECHA - 1]),
      tipo:         String(r[DEP_COL_MOV.TIPO - 1] || ''),
      zona:         String(r[DEP_COL_MOV.ZONA - 1] || ''),
      descripcion:  String(r[DEP_COL_MOV.DESCRIPCION - 1] || ''),
      cantidad:     Number(r[DEP_COL_MOV.CANTIDAD - 1]) || 0,
      responsable:  String(r[DEP_COL_MOV.RESPONSABLE - 1] || ''),
      obra:         String(r[DEP_COL_MOV.OBRA - 1] || ''),
      factura:      String(r[DEP_COL_MOV.NRO_FACTURA - 1] || ''),
      familia:      String(r[DEP_COL_MOV.FAMILIA - 1] || ''),
      marca:        String(r[DEP_COL_MOV.MARCA - 1] || ''),
      obs_item:     String(r[DEP_COL_MOV.OBS_ITEM - 1] || ''),
      // ⬇️ NUEVO
      id_pedido:    String(r[DEP_COL_MOV.ID_PEDIDO - 1] || ''),
      envio:        String(r[DEP_COL_MOV.NRO_ENVIO - 1] || ''),
      unidad:       String(r[DEP_COL_MOV.UNIDAD - 1] || ''),
      obs_general:  String(r[DEP_COL_MOV.OBS_GENERAL - 1] || ''),
      // ⬆️ FIN NUEVO
    }));

    return jsonResp({ ok: true, movimientos });

  } catch (err) {
    Logger.log('ERROR doGet movimientos: ' + err.message);
    return jsonResp({ ok: false, error: err.message });
  }
}
// FIX búsqueda servidor: búsqueda completa de movimientos, independiente del límite del listado normal.
if (params.action === 'movimientos-buscar') {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaMov = ss.getSheetByName('Movimientos');

    if (!hojaMov || hojaMov.getLastRow() <= 1) {
      return jsonResp({
        ok: true,
        movimientos: [],
        total: 0,
        truncado: false
      });
    }

    const normalizar = valor => String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const distancia = (a, b) => {
      const fila = Array.from({ length: b.length + 1 }, (_, i) => i);

      for (let i = 1; i <= a.length; i++) {
        let diagonal = fila[0];
        fila[0] = i;

        for (let j = 1; j <= b.length; j++) {
          const anterior = fila[j];
          fila[j] = Math.min(
            fila[j] + 1,
            fila[j - 1] + 1,
            diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
          );
          diagonal = anterior;
        }
      }

      return fila[b.length];
    };

    const coincidePalabra = (buscada, palabra) => {
      if (palabra.includes(buscada)) return true;
      if (buscada.length < 4 || palabra.length < 4) return false;

      const maxErrores = buscada.length >= 8 ? 2 : 1;
      return distancia(buscada, palabra) <= maxErrores;
    };

    const consulta = normalizar(params.q || '');
    const tokens = consulta.split(/\s+/).filter(Boolean);
    const tipoBuscado = normalizar(params.tipo || '');

    const ultimaFila = hojaMov.getLastRow();
    const datos = hojaMov
      .getRange(2, 1, ultimaFila - 1, DEP_COL_MOV.TOTAL)
      .getValues();

    const tz = Session.getScriptTimeZone();

    const encontrados = datos.filter(r => {
      const texto = normalizar([
        r[DEP_COL_MOV.TIPO - 1],
        r[DEP_COL_MOV.ZONA - 1],
        r[DEP_COL_MOV.DESCRIPCION - 1],
        r[DEP_COL_MOV.RESPONSABLE - 1],
        r[DEP_COL_MOV.OBRA - 1],
        r[DEP_COL_MOV.NRO_FACTURA - 1],
        r[DEP_COL_MOV.FAMILIA - 1],
        r[DEP_COL_MOV.MARCA - 1],
        r[DEP_COL_MOV.OBS_ITEM - 1],
        r[DEP_COL_MOV.ID_PEDIDO - 1],
        r[DEP_COL_MOV.NRO_ENVIO - 1],
        r[DEP_COL_MOV.UNIDAD - 1],
        r[DEP_COL_MOV.OBS_GENERAL - 1]
      ].join(' '));

      const palabras = texto.split(/\s+/).filter(Boolean);

      const coincideTexto = tokens.every(token =>
        palabras.some(palabra => coincidePalabra(token, palabra))
      );

      const tipoFila = normalizar(r[DEP_COL_MOV.TIPO - 1]);
      const coincideTipo = !tipoBuscado || tipoFila.startsWith(tipoBuscado);

      return coincideTexto && coincideTipo;
    });

    const total = encontrados.length;
    const limite = 5000;
    const movimientos = encontrados.slice(-limite).map(r => {
      const fechaCelda = r[DEP_COL_MOV.FECHA - 1];

      return {
        fecha: formatearFechaCelda(fechaCelda) + ' ' + formatearHoraCelda(fechaCelda),
        tipo: String(r[DEP_COL_MOV.TIPO - 1] || ''),
        zona: String(r[DEP_COL_MOV.ZONA - 1] || ''),
        descripcion: String(r[DEP_COL_MOV.DESCRIPCION - 1] || ''),
        cantidad: Number(r[DEP_COL_MOV.CANTIDAD - 1]) || 0,
        responsable: String(r[DEP_COL_MOV.RESPONSABLE - 1] || ''),
        obra: String(r[DEP_COL_MOV.OBRA - 1] || ''),
        factura: String(r[DEP_COL_MOV.NRO_FACTURA - 1] || ''),
        familia: String(r[DEP_COL_MOV.FAMILIA - 1] || ''),
        marca: String(r[DEP_COL_MOV.MARCA - 1] || ''),
        obs_item: String(r[DEP_COL_MOV.OBS_ITEM - 1] || ''),
        id_pedido: String(r[DEP_COL_MOV.ID_PEDIDO - 1] || ''),
        envio: String(r[DEP_COL_MOV.NRO_ENVIO - 1] || ''),
        unidad: String(r[DEP_COL_MOV.UNIDAD - 1] || ''),
        obs_general: String(r[DEP_COL_MOV.OBS_GENERAL - 1] || '')
      };
    });

    return jsonResp({
      ok: true,
      movimientos,
      total,
      truncado: total > limite
    });

  } catch (err) {
    Logger.log('ERROR doGet movimientos-buscar: ' + err.message);
    return jsonResp({ ok: false, error: err.message });
  }
}
// FIN FIX búsqueda servidor
  try {
    const ss        = SpreadsheetApp.getActiveSpreadsheet();
    const hojaStock = ss.getSheetByName('Stock');

    if (!hojaStock) {
      return _htmlError('No se encontró la hoja Stock.');
    }

    const ultimaFila = hojaStock.getLastRow();
    if (ultimaFila <= 1) {
      return _htmlError('La hoja Stock está vacía.');
    }

    const datos = hojaStock
      .getRange(2, 1, ultimaFila - 1, DEP_COL_STOCK.TOTAL)
      .getValues();

    if (params.id) {
      const idBuscado = params.id.trim().toUpperCase();
      const fila = datos.find(r =>
        String(r[DEP_COL_STOCK.ID - 1]).trim().toUpperCase() === idBuscado
      );

      if (!fila) {
        return _htmlError(`Producto "${params.id}" no encontrado en Stock.`);
      }

      return _htmlProducto(_filaAObjeto(fila));
    }

    if (params.zona) {
      const zonaBuscada = params.zona.trim().toLowerCase();
      const productos = datos
        .filter(r => String(r[DEP_COL_STOCK.ZONA - 1]).trim().toLowerCase() === zonaBuscada)
        .map(_filaAObjeto);

      if (productos.length === 0) {
        return _htmlError(`No hay productos registrados para la zona "${params.zona}".`);
      }

      return _htmlZona(params.zona, productos);
    }

    return _htmlError('Parámetro requerido: action=json&zona=..., id=PROD-001, o zona=Nombre.');

  } catch (err) {
    Logger.log('ERROR doGet html: ' + err.message);
    return _htmlError('Error interno: ' + err.message);
  }
}

// ============================================================
// NORMALIZACIÓN A MAYÚSCULAS DE DATOS ENTRANTES
// ============================================================
function sanitizarPayloadMayusculas(obj, clavePadre) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;

  const CLAVES_IGNORAR = {
    'token': true,
    'idtoken': true,
    'accion': true,
    'action': true,
    '_txid': true,
    'firma_base64': true,
    'foto_base64': true,
    'fotos_base64': true,
    'imagen_base64': true,
    'imagen': true,
    'foto': true,
    'base64': true,
    'email': true,
    'url': true
  };

  if (Array.isArray(obj)) {
    if (clavePadre && CLAVES_IGNORAR[String(clavePadre).toLowerCase()]) {
      return obj;
    }
    return obj.map(function(item) {
      if (typeof item === 'string') return item.trim().toUpperCase();
      if (typeof item === 'object' && item !== null) return sanitizarPayloadMayusculas(item, clavePadre);
      return item;
    });
  }

  if (typeof obj === 'object') {
    const res = {};
    for (const k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      const kLower = String(k).toLowerCase();
      if (CLAVES_IGNORAR[kLower]) {
        res[k] = obj[k];
      } else if (typeof obj[k] === 'string') {
        res[k] = obj[k].trim().toUpperCase();
      } else if (typeof obj[k] === 'object' && obj[k] !== null) {
        res[k] = sanitizarPayloadMayusculas(obj[k], k);
      } else {
        res[k] = obj[k];
      }
    }
    return res;
  }

  return obj;
}

// ============================================================
// CONVERSIÓN OBLIGATORIA A MAYÚSCULAS PARA ESCRITURA EN HOJAS
// ============================================================
function limpiarFilaMayusculas_(fila, esHojaStock) {
  if (!Array.isArray(fila)) return fila;
  return fila.map(function(val, idx) {
    if (val === null || val === undefined) return '';
    if (typeof val !== 'string') return val;
    var s = val.trim();
    if (!s) return '';
    if (s.charAt(0) === '=') return val;
    if (/^https?:\/\//i.test(s)) return val;
    if (esHojaStock && (idx + 1) === DEP_COL_STOCK.IMAGEN) return val;
    return s.toUpperCase();
  });
}

function limpiarMatrizMayusculas_(matriz, esHojaStock) {
  if (!Array.isArray(matriz)) return matriz;
  return matriz.map(function(f) {
    return limpiarFilaMayusculas_(f, esHojaStock);
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (_) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Sistema ocupado, intentá en unos segundos.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    let data = JSON.parse(e.postData.contents);

    // ⬇️ NUEVO
    if (AUTH_OBLIGATORIA) {
      const auth = autenticar_(data.token);
      if (!auth.ok) return jsonResp({ ok: false, auth: false, error: 'No autorizado' });
      if (auth.rol === 'lectura') return jsonResp({ ok: false, permiso: false, error: 'Tu usuario es de solo lectura.' });
    }
    delete data.token;
    // ⬆️ FIN NUEVO

    // ⬇️ NORMALIZACIÓN A MAYÚSCULAS PARA ALMACENAMIENTO (MOVIMIENTOS, STOCK, FIRMAS SALIDAS)
    data = sanitizarPayloadMayusculas(data);
    // ⬆️ FIN NORMALIZACIÓN A MAYÚSCULAS

     Logger.log('Payload recibido: ' + JSON.stringify(Object.assign({}, data, { firma_base64: data.firma_base64 ? '[firma]' : undefined })));

    const ss = SpreadsheetApp.openById('1PWCKGAQgZfBEWPwqWppsbylLdJLxJe3I6XWrEAhBwQk');

    // ── PROTECCIÓN CONTRA DUPLICADOS (_txid) ──────────────────
    // Si el HTML manda un _txid y ya lo procesamos antes (por ejemplo,
    // el navegador reintenta porque no le llegó la respuesta la primera
    // vez), devolvemos la MISMA respuesta guardada sin volver a escribir
    // nada en Movimientos/Stock.
    const txid  = data._txid;
    const cache = CacheService.getScriptCache();
    if (txid) {
      const guardada = cache.get('tx_' + txid);
      if (guardada) {
        Logger.log('Txid repetido, devolviendo respuesta guardada: ' + txid);
        return ContentService
          .createTextOutput(guardada)
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    let respuesta;
    if (data.accion === 'actualizar-imagen') {
      respuesta = actualizarImagenProducto(data, ss);
    } else if (data.accion === 'eliminar-imagen') {
      respuesta = eliminarImagenProducto(data, ss);
    } else if (data.accion === 'ajuste-rapido') {
      respuesta = ajusteRapidoStockOpcionB(data, ss);
    } else if (data.accion === 'actualizar-observacion') {
      respuesta = actualizarObservacionProducto(data, ss);
    } else if (data.accion === 'actualizar-ubicacion') {
      respuesta = actualizarUbicacionProducto(data, ss);
    } else if (data.accion === 'actualizar-datos') {
      respuesta = actualizarDatosProducto(data, ss);
    } else if (data.accion === 'crear-producto') {
      respuesta = crearProductoNuevo(data, ss);
    } else if (data.accion === 'herr-movimiento') {
      respuesta = herr_procesarMovimiento(data, ss);
    } else if (String(data.tipo || '').trim().toUpperCase() === 'TRASLADO') {
      respuesta = procesarTraslado(data, ss);
    } else {
      respuesta = procesarDeposito(data, ss);
    }

    // Guardar el txid junto con la respuesta, para poder devolverla
    // igual si este mismo pedido se reintenta más adelante.
    if (txid) {
      try {
        const contenido = respuesta.getContent();
        if (JSON.parse(contenido).ok) cache.put('tx_' + txid, contenido, 21600);
      } catch (_) {}
    }

    return respuesta;

  } catch (err) {
    Logger.log('ERROR doPost: ' + err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// 5. MÓDULO DEPÓSITO
// ============================================================

// ============================================================
// 5.1 Procesamiento principal
// ============================================================
function procesarDeposito(data, ss) {
  let hojaMov   = ss.getSheetByName('Movimientos') || ss.insertSheet('Movimientos');
  let hojaStock = ss.getSheetByName('Stock')       || ss.insertSheet('Stock');

  dep_inicializarHojaMovimientos(hojaMov);
  dep_inicializarHojaStock(hojaStock);

  const tipo         = String(data.tipo_movimiento || '').trim().toUpperCase();
  const fecha        = dep_normalizarFecha(data.fecha);
  const responsable  = String(data.responsable     || '').trim().toUpperCase();
  const obra         = String(data.obra            || '').trim().toUpperCase();
  const zona         = String(data.zona            || 'SIN ZONA').trim().toUpperCase();
  const obsGenerales = String(data.observaciones   || '').trim().toUpperCase();
  const factura      = String(data.factura || '').trim().toUpperCase();

  const idPedido = dep_generarIdPedido(hojaMov, tipo);
  const nroEnvio = dep_generarNroEnvio();

  const ahora     = new Date();
  const timezone  = Session.getScriptTimeZone();
  const fechaHoy  = Utilities.formatDate(ahora, timezone, 'dd/MM/yyyy');
  const horaAhora = Utilities.formatDate(ahora, timezone, 'HH:mm');

  for (const [key, nombreFamilia] of Object.entries(FAMILIAS)) {
    const items = data[key] || [];
    items.forEach(item => {
      
      for (let prop in item) {
        if (String(item[prop]).trim().toUpperCase() === 'OTRO' && item[prop + '_otro']) {
          item[prop] = item[prop + '_otro'];
        }
      }
      if (item.marca_sel) {
        item.marca = item.marca_sel;
      }
      if (item.marca_tipo && !item.marca) {
        item.marca = item.marca_tipo;
      }
      if (item.soporte === 'RIEL_DIN') {
        item.soporte = 'RIEL DIN';
      }
      if (item.rieldim && String(item.rieldim).trim() !== '') {
        item.rieldim = String(item.rieldim).trim().toUpperCase() + ' MÓDULOS';
      }
       const FAMILIAS_CABLE = ['unipolar','ttr','subterraneo','preen','conc','desnudo','especial','alta_potencia'];
      if (FAMILIAS_CABLE.includes(key) && item.presentacion && String(item.presentacion).trim() !== '') {
        item.presentacion = 'PRESENTACIÓN ' + String(item.presentacion).trim().toUpperCase();
      }
      if ((key === 'alumbrado' || key === 'gabinetes' || key === 'cajas') && (item.largo || item.ancho || item.alto)) {
        const partes = [item.largo, item.ancho, item.alto].filter(v => v && String(v).trim() !== '');
        if (partes.length > 0) {
          item.dimensiones = partes.join('X').toUpperCase() + ' MM';
        }
      }
      if (key === 'embutidos' || key === 'apliques' || key === 'especiales' || key === 'rotos') {
        if (item.diametro || item.diametro_alto) {
          const partes = [item.diametro, item.diametro_alto].filter(v => v && String(v).trim() !== '');
          if (partes.length > 0) item.dimensiones = 'Ø' + partes.join(' X ').toUpperCase() + ' MM';
        } else if (item.lado || item.lado_alto) {
          const partes = [item.lado, item.lado_alto].filter(v => v && String(v).trim() !== '');
          if (partes.length > 0) item.dimensiones = partes.join('X').toUpperCase() + ' MM';
        } else if (item.largo || item.ancho || item.alto) {
          const partes = [item.largo, item.ancho, item.alto].filter(v => v && String(v).trim() !== '');
          if (partes.length > 0) item.dimensiones = partes.join('X').toUpperCase() + ' MM';
        }
      }
      let familiaFinal = String(nombreFamilia || '').trim().toUpperCase();
      if (key === 'grampas' && item.tipo) familiaFinal = String(item.tipo).trim().toUpperCase();
      if (key === 'terminales' && item.tipo_terminal) familiaFinal = String(item.tipo_terminal).trim().toUpperCase();
      if (key === 'filtros') familiaFinal = String(familiaFiltro(item.tipo)).trim().toUpperCase();
      if (key === 'lamparas') familiaFinal = String(familiaLampara(item)).trim().toUpperCase();
      if (key === 'aceites') familiaFinal = String(familiaAceite(item.tipo_aceite)).trim().toUpperCase();
      let marca = String(item.marca || 'NO ESPECIFICADO').trim().toUpperCase();
      if (key === 'filtros' && item.codigo) {
        marca = marca + ' | ' + String(item.codigo).trim().toUpperCase();
      }
      const cantidad     = Number(item.cantidad) || 0;
      const unidad       = String(item.unidad || 'UN').trim().toUpperCase();
      const obs          = String(item.observaciones || '').trim().toUpperCase();

      if (item.nro_bobina && String(item.nro_bobina).trim() !== '') {
        item.nro_bobina = 'N° BOBINA ' + String(item.nro_bobina).trim().toUpperCase();
      }
      if (item.codigo_bobina && String(item.codigo_bobina).trim() !== '') {
        item.codigo_bobina = 'CÓD. ' + String(item.codigo_bobina).trim().toUpperCase();
      }
      if (item.peso_bobina && String(item.peso_bobina).trim() !== '') {
        item.peso_bobina = String(item.peso_bobina).trim().toUpperCase() + 'KG';
      }

      const descripcion  = String(armarDescripcion(key, item) || '').toUpperCase();
      let imagenUrl = '';
      if (item.fotos_base64 && Array.isArray(item.fotos_base64) && item.fotos_base64.length > 0) {
        const urls = item.fotos_base64.map((b64, idx) => {
          return subirImagenDrive(b64, `${key}_${Date.now()}_${idx}.jpg`);
        });
        imagenUrl = urls.join('||');
      } else if (item.foto_base64) {
        imagenUrl = subirImagenDrive(item.foto_base64, `${key}_${Date.now()}.jpg`);
      }

      const ubicacion = {
        deposito: String(item.deposito || '').trim().toUpperCase(),
        estante:  String(item.estante  || '').trim().toUpperCase(),
        columna:  String(item.columna  || '').trim().toUpperCase(),
        fila:     String(item.fila     || '').trim().toUpperCase()
      };

      hojaMov.appendRow(limpiarFilaMayusculas_([
        idPedido, fecha, tipo, responsable, obra, zona,
        familiaFinal, marca, descripcion,
        cantidad, unidad, obs, obsGenerales, nroEnvio,
        ubicacion.deposito, ubicacion.estante, ubicacion.columna, ubicacion.fila,
        factura
      ], false));
      if (factura) {
        const celdaFactura = hojaMov.getRange(hojaMov.getLastRow(), DEP_COL_MOV.NRO_FACTURA);
        celdaFactura.setNumberFormat('@');
        celdaFactura.setValue(factura);
      }

      dep_actualizarStock(hojaStock, zona, familiaFinal, marca, descripcion, tipo, cantidad, fechaHoy, horaAhora, ubicacion, unidad, obs, obsGenerales, imagenUrl);
    });
  }

  if (data.producto_nuevo && data.producto_nuevo.descripcion && data.producto_nuevo.descripcion.trim() !== '') {
    const pn       = data.producto_nuevo;
    const cantidad = Number(pn.cantidad) || 0;
    const pnMarca  = String(pn.marca || 'NO ESPECIFICADO').trim().toUpperCase();
    const unidad   = String(pn.unidad || 'UN').trim().toUpperCase();

    let pnDimensiones = '';
    if (pn.diametro || pn.diametro_alto) {
      const partes = [pn.diametro, pn.diametro_alto].filter(v => v && String(v).trim() !== '');
      if (partes.length > 0) pnDimensiones = 'Ø' + partes.join(' X ').toUpperCase() + ' MM';
    } else if (pn.lado || pn.lado_alto) {
      const partes = [pn.lado, pn.lado_alto].filter(v => v && String(v).trim() !== '');
      if (partes.length > 0) pnDimensiones = partes.join('X').toUpperCase() + ' MM';
    } else if (pn.largo || pn.ancho || pn.alto) {
      const partes = [pn.largo, pn.ancho, pn.alto].filter(v => v && String(v).trim() !== '');
      if (partes.length > 0) pnDimensiones = partes.join('X').toUpperCase() + ' MM';
    }
    const pnDescripcionFinal = String(pn.descripcion || '').trim().toUpperCase()
      + (pn.presentacion ? ' | PRESENTACIÓN ' + String(pn.presentacion).trim().toUpperCase() : '')
      + (pnDimensiones ? ' | ' + pnDimensiones : '')
      + (pn.nro_bobina ? ' | N° BOBINA ' + String(pn.nro_bobina).trim().toUpperCase() : '')
      + (pn.codigo_bobina ? ' | CÓD. ' + String(pn.codigo_bobina).trim().toUpperCase() : '')
      + (pn.peso_bobina ? ' | ' + String(pn.peso_bobina).trim().toUpperCase() + 'KG' : '');

    hojaMov.appendRow(limpiarFilaMayusculas_([
      idPedido, fecha, tipo, responsable, obra, zona,
      'PRODUCTO NUEVO', pnMarca, pnDescripcionFinal,
      cantidad, unidad, String(pn.observacion || '').toUpperCase(), obsGenerales, nroEnvio,
      String(pn.deposito || '').toUpperCase(), String(pn.estante || '').toUpperCase(), String(pn.columna || '').toUpperCase(), String(pn.fila || '').toUpperCase(),
      ''   // N° Factura — no aplica a este tipo de movimiento
    ], false));
    const ubicacionNuevo = {
      deposito: String(pn.deposito || '').toUpperCase(),
      estante:  String(pn.estante  || '').toUpperCase(),
      columna:  String(pn.columna  || '').toUpperCase(),
      fila:     String(pn.fila     || '').toUpperCase()
    };

    let imagenNuevoUrl = '';
    if (pn.fotos_base64 && Array.isArray(pn.fotos_base64) && pn.fotos_base64.length > 0) {
      const urls = pn.fotos_base64.map((b64, idx) => {
        return subirImagenDrive(b64, `nuevo_${Date.now()}_${idx}.jpg`);
      });
      imagenNuevoUrl = urls.join('||');
    }

    dep_actualizarStock(hojaStock, zona, 'PRODUCTO NUEVO', pnMarca, pnDescripcionFinal, tipo, cantidad, fechaHoy, horaAhora, ubicacionNuevo, unidad, pn.observacion, obsGenerales, imagenNuevoUrl);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, id: idPedido, envio: nroEnvio }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Familia del stock según el tipo de filtro elegido en el formulario de Filtros
function familiaFiltro(tipo) {
  const t = String(tipo || '').trim().toLowerCase();
  if (/aceite/.test(t))                        return 'FILTRO DE ACEITE';
  if (/^filtro de aire/.test(t))               return 'FILTRO DE AIRE';
  if (/gasoil/.test(t))                        return 'FILTRO DE GASOIL';
  if (/^filtro refrigerante/.test(t))          return 'FILTRO REFRIGERANTE';
  if (/^acoples/.test(t))                      return 'ACOPLES';
  if (/^filtro urea/.test(t))                  return 'FILTRO DE UREA';
  if (/^filtro tipo vasito/.test(t))           return 'FILTRO TIPO VASITO';
  if (/^c[aá]mara para gomas/.test(t))         return 'CÁMARA PARA GOMAS';
  return 'FILTRO';
}

// Familia del stock según la tecnología de la lámpara (teoría de 4 familias)
function familiaLampara(item) {
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clasificar = t => {
    if (!t) return '';
    // 1° Descarga: va primero para que "halogenuro / mercurio halogenado" no caigan en Halógena
    if (/sodio|vapor|mercurio|halogenuro|halogenad|metalic|metal halide|\bmh\b|descarga|mezcladora|mixta|lucalox|vialox/.test(t)) return 'LÁMPARA DE DESCARGA (SODIO/MERCURIO/MH)';
    // 2° LED
    if (/\bled\b|smd/.test(t)) return 'LÁMPARA LED';
    // 3° Halógena / Incandescente: va antes que Fluorescente para ignorar el "Bajo Consumo" de marketing
    if (/incandescente|halogen|reflectora/.test(t)) return 'LÁMPARA HALÓGENA / INCANDESCENTE';
    // 4° Fluorescente / Bajo Consumo
    if (/fluorescente|\bcfl\b|bajo consumo|dulux|longlast|\besl\b/.test(t)) return 'LÁMPARA FLUORESCENTE / BAJO CONSUMO';
    return '';
  };
  // Primero el tipo; si no alcanza, el modelo (ej. VIALOX, LUCALOX). Si nada coincide, queda la familia genérica de siempre.
  return clasificar(norm(item.tipo)) || clasificar(norm(item.modelo)) || 'LÁMPARA / FOCO';
}

function armarDescripcion(familiaKey, item) {
  const camposOrden = ORDEN_DESCRIPCION[familiaKey] || [];

  if (FAM_LUBRICANTES.includes(familiaKey)) {
    return [item.codigo, familiaKey === 'liquido_freno' ? item.tipo : '', item.producto,
            item.presentacion, item.lote ? 'LOTE ' + item.lote : '']
      .map(v => String(v || '').trim().toUpperCase()).filter(Boolean).join(' | ');
  }

  if (camposOrden.length === 0) {
    return Object.keys(item).sort()
      .filter(k => !['marca', 'cantidad', 'unidad', 'observaciones', 'deposito', 'estante', 'columna', 'fila', 'fotos_base64', 'foto_base64', 'presentacion', 'presentacion_otro', 'peso_bobina'].includes(k) && item[k] && item[k] !== '')
      .map(k => String(item[k]).trim().toUpperCase())
      .join(' | ');
  }

  let descripcion = camposOrden
    .filter(k => item[k] && item[k] !== '')
    .map(k => String(item[k]).trim().toUpperCase())
    .join(' | ');

  if (familiaKey === 'filtros') {
    const compat = item.compatibilidad;
    if (compat && compat.trim() !== '' && compat.trim().toUpperCase() !== 'NO ESPECIFICADO') {
      descripcion += ' | ' + compat.trim().toUpperCase();
    }
  }

  return String(descripcion || '').toUpperCase();
}

// ============================================================
// 5.2 Actualización de stock
// ============================================================
function dep_actualizarStock(hojaStock, zona, familia, marca, descripcion, tipo, cantidad, fechaHoy, horaAhora, ubicacion, unidad, obsItem, obsGeneral, imagenUrl) {
  zona = String(zona || '').trim().toUpperCase();
  familia = String(familia || '').trim().toUpperCase();
  marca = String(marca || '').trim().toUpperCase();
  descripcion = String(descripcion || '').trim().toUpperCase();
  tipo = String(tipo || '').trim().toUpperCase();
  unidad = String(unidad || '').trim().toUpperCase();
  obsItem = String(obsItem || '').trim().toUpperCase();
  obsGeneral = String(obsGeneral || '').trim().toUpperCase();
  if (ubicacion) {
    ubicacion.deposito = String(ubicacion.deposito || '').trim().toUpperCase();
    ubicacion.estante = String(ubicacion.estante || '').trim().toUpperCase();
    ubicacion.columna = String(ubicacion.columna || '').trim().toUpperCase();
    ubicacion.fila = String(ubicacion.fila || '').trim().toUpperCase();
  }

  const ultimaFila = hojaStock.getLastRow();
  let filaNum = -1;

  if (ultimaFila > 1) {
    const datos = hojaStock.getRange(2, 1, ultimaFila - 1, DEP_COL_STOCK.TOTAL).getValues();
    for (let i = 0; i < datos.length; i++) {
      if (
        String(datos[i][DEP_COL_STOCK.ZONA        - 1] || '').trim().toUpperCase() === zona        &&
        String(datos[i][DEP_COL_STOCK.FAMILIA     - 1] || '').trim().toUpperCase() === familia     &&
        String(datos[i][DEP_COL_STOCK.MARCA       - 1] || '').trim().toUpperCase() === marca       &&
        String(datos[i][DEP_COL_STOCK.DESCRIPCION - 1] || '').trim().toUpperCase() === descripcion
      ) {
        filaNum = i + 2;
        break;
      }
    }
  }

  if (filaNum === -1) {
    const nuevoId = dep_generarIdProducto(hojaStock);
    hojaStock.appendRow(limpiarFilaMayusculas_([
      nuevoId, zona, familia, marca, descripcion,
      imagenUrl || '', unidad || '',
      0, 0, 0, 0,
      '', '',
      '', '', '', '',
      '', '', '', '',
      ''
    ], true));
    filaNum = hojaStock.getLastRow();
  }

  const valoresActuales = hojaStock
    .getRange(filaNum, DEP_COL_STOCK.ENTRADAS, 1, 3)
    .getValues()[0];

  let entradas     = valoresActuales[0] || 0;
  let salidas      = valoresActuales[1] || 0;
  let devoluciones = valoresActuales[2] || 0;

  if      (tipo === 'ENTRADA')    entradas     += cantidad;
  else if (tipo === 'SALIDA')     salidas      += cantidad;
  else if (tipo === 'DEVOLUCIÓN') devoluciones += cantidad;

  entradas = R2(entradas); salidas = R2(salidas); devoluciones = R2(devoluciones);
  const stockActual = R2(entradas - salidas + devoluciones);

  hojaStock.getRange(filaNum, DEP_COL_STOCK.ENTRADAS, 1, 4)
    .setValues([[entradas, salidas, devoluciones, stockActual]]);

  hojaStock.getRange(filaNum, DEP_COL_STOCK.ESTADO)
    .setFormula(`=IF(K${filaNum}<=L${filaNum},"REPONER","OK")`);

  const celdaEstado = hojaStock.getRange(filaNum, DEP_COL_STOCK.ESTADO);
  if (stockActual <= 0) {
    celdaEstado.setBackground('#fee2e2').setFontColor('#dc2626').setFontWeight('bold');
  } else {
    celdaEstado.setBackground('#dcfce7').setFontColor('#15803d').setFontWeight('bold');
  }

  const celdaStock = hojaStock.getRange(filaNum, DEP_COL_STOCK.STOCK_ACTUAL);
  if (stockActual <= 0) {
    celdaStock.setBackground('#fee2e2').setFontColor('#dc2626').setFontWeight('bold');
  } else {
    celdaStock.setBackground('#dcfce7').setFontColor('#15803d').setFontWeight('bold');
  }

  hojaStock.getRange(filaNum, DEP_COL_STOCK.ULT_MOVIMIENTO).setValue(tipo);
  hojaStock.getRange(filaNum, DEP_COL_STOCK.ULT_FECHA).setValue(fechaHoy);
  hojaStock.getRange(filaNum, DEP_COL_STOCK.ULT_HORA).setValue(horaAhora);

  if (obsItem && String(obsItem).trim() !== '') {
    hojaStock.getRange(filaNum, DEP_COL_STOCK.ULT_OBS).setValue(String(obsItem).trim().toUpperCase());
  }

  if (obsGeneral && String(obsGeneral).trim() !== '') {
    hojaStock.getRange(filaNum, DEP_COL_STOCK.ULT_MOV_OBS).setValue(String(obsGeneral).trim().toUpperCase());
  }

  if (unidad) {
    hojaStock.getRange(filaNum, DEP_COL_STOCK.UNIDAD).setValue(String(unidad).trim().toUpperCase());
  }

  if (imagenUrl) {
    hojaStock.getRange(filaNum, DEP_COL_STOCK.IMAGEN).setValue(imagenUrl);
  }

  if (ubicacion && (ubicacion.deposito || ubicacion.estante || ubicacion.columna || ubicacion.fila)) {
    hojaStock.getRange(filaNum, DEP_COL_STOCK.UBIC_DEPOSITO, 1, 4)
      .setValues(limpiarMatrizMayusculas_([[ubicacion.deposito || '', ubicacion.estante || '', ubicacion.columna || '', ubicacion.fila || '']], true));
  }
}

// ============================================================
// 5.3 Generadores de ID
// ============================================================
function dep_generarNroEnvio() {
  const props    = PropertiesService.getScriptProperties();
  const timezone = Session.getScriptTimeZone();
  const hoy      = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');

  const ultimaFecha = props.getProperty('ENV_FECHA') || '';
  let   ultimoNum   = parseInt(props.getProperty('ENV_NUM') || '0', 10);

  if (ultimaFecha !== hoy) {
    ultimoNum = 0;
    props.setProperty('ENV_FECHA', hoy);
  }

  const nuevoNum = ultimoNum + 1;
  props.setProperty('ENV_NUM', String(nuevoNum));
  return 'ENV-' + String(nuevoNum).padStart(3, '0');
}

function dep_generarIdPedido(hojaMov, tipo) {
  const prefijos = { 'ENTRADA': 'ING', 'SALIDA': 'SAL', 'DEVOLUCIÓN': 'DEV' };
  const prefijo  = prefijos[tipo] || 'MOV';

  const ultimaFila = hojaMov.getLastRow();
  let maxNum = 0;

  if (ultimaFila > 1) {
    const ids = hojaMov.getRange(2, DEP_COL_MOV.ID_PEDIDO, ultimaFila - 1, 1).getValues();
    ids.forEach(([id]) => {
      const s = String(id || '');
      if (s.startsWith(prefijo + '-')) {
        const num = parseInt(s.replace(prefijo + '-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return prefijo + '-' + String(maxNum + 1).padStart(3, '0');
}

function dep_generarIdProducto(hojaStock) {
  const ultimaFila = hojaStock.getLastRow();
  if (ultimaFila <= 1) return 'PROD-001';

  const ids = hojaStock.getRange(2, DEP_COL_STOCK.ID, ultimaFila - 1, 1).getValues();
  let maxNum = 0;
  ids.forEach(([id]) => {
    const s = String(id || '');
    if (s.startsWith('PROD-')) {
      const num = parseInt(s.replace('PROD-', ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return 'PROD-' + String(maxNum + 1).padStart(3, '0');
}

// ============================================================
// 5.4 Inicialización de hojas
// ============================================================
function dep_inicializarHojaMovimientos(hojaMov) {
  if (hojaMov.getLastRow() > 0) return;

  hojaMov.appendRow([
    'ID Pedido', 'Fecha', 'Tipo', 'Responsable', 'Obra', 'Zona',
    'Familia', 'Marca', 'Descripción', 'Cantidad', 'Unidad',
    'Obs. ítem', 'Obs. generales', 'N° Envío',
    'Depósito', 'Estante', 'Columna', 'Fila',
    'N° Factura'
  ]);

  const header = hojaMov.getRange(1, 1, 1, DEP_COL_MOV.TOTAL);
  header.setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
  hojaMov.setFrozenRows(1);

  const anchos = [90, 150, 90, 130, 150, 160, 160, 110, 280, 80, 70, 180, 200, 110, 90, 70, 70, 60, 100];
  anchos.forEach((w, i) => hojaMov.setColumnWidth(i + 1, w));
}

function dep_inicializarHojaStock(hojaStock) {
  if (hojaStock.getLastRow() > 0) return;

  hojaStock.appendRow([
    'ID Producto', 'Zona', 'Familia', 'Marca', 'Descripción',
    'Imagen', 'Unidad',
    'Entradas', 'Salidas', 'Devoluciones', 'Stock actual',
    '',            
    'Estado',
    'Último mov.', 'Última obs.', 'Fecha', 'Hora',
    'Depósito', 'Estante', 'Columna', 'Fila',
    'Obs. Envío'
  ]);

  const header = hojaStock.getRange(1, 1, 1, DEP_COL_STOCK.TOTAL);
  header.setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
  hojaStock.setFrozenRows(1);

  hojaStock.getRange(1, DEP_COL_STOCK.STOCK_MINIMO)
    .setValue('Stock mínimo')
    .setNote('Editable a mano en la planilla o desde el panel (Editar ficha). El Estado se recalcula solo con la fórmula.');

  const anchos = [100, 160, 160, 110, 280, 220, 70, 80, 80, 110, 100, 110, 110, 140, 200, 120, 90, 90, 70, 70, 60, 220];
  anchos.forEach((w, i) => hojaStock.setColumnWidth(i + 1, w));
}

// ============================================================
// 5.5 Acciones rápidas desde el HTML
// ============================================================
function ajusteRapidoStockOpcionB(data, ss) {
  const hojaStock = ss.getSheetByName('Stock');
  const hojaMov   = ss.getSheetByName('Movimientos') || ss.insertSheet('Movimientos');
  if (!hojaStock) return jsonResp({ ok: false, error: 'Hoja Stock no encontrada.' });

  dep_inicializarHojaMovimientos(hojaMov);

  const tipoRaw   = data.tipo_movimiento || '';
  const tipo      = tipoRaw === 'DEVOLUCION' ? 'DEVOLUCIÓN' : tipoRaw;
  const timezone  = Session.getScriptTimeZone();
  const ahora     = new Date();
  const fechaHoy  = Utilities.formatDate(ahora, timezone, 'dd/MM/yyyy');
  const horaAhora = Utilities.formatDate(ahora, timezone, 'HH:mm');

  const ultimaFila = hojaStock.getLastRow();
  const datos = ultimaFila > 1
    ? hojaStock.getRange(2, 1, ultimaFila - 1, DEP_COL_STOCK.TOTAL).getValues()
    : [];
  const indicePorId = {};
  datos.forEach((r, i) => {
    indicePorId[String(r[DEP_COL_STOCK.ID - 1]).trim().toUpperCase()] = i;
  });

  // 1) VALIDAR TODO ANTES DE ESCRIBIR
  const items = data.items || [];
  const noEncontrados = items
    .map(it => String(it.id || '').trim().toUpperCase())
    .filter(id => indicePorId[id] === undefined);
  if (noEncontrados.length > 0) {
    return jsonResp({ ok: false, error: `No se encontraron estos productos: ${noEncontrados.join(', ')}` });
  }
  if (tipo === 'SALIDA') {
    const pedido = {};
    items.forEach(it => {
      const k = String(it.id || '').trim().toUpperCase();
      pedido[k] = (pedido[k] || 0) + (Number(it.cantidad) || 0);
    });
    const sinStock = Object.keys(pedido).filter(k => {
      const f = datos[indicePorId[k]];
      return String(f[DEP_COL_STOCK.ZONA - 1]).trim().toUpperCase() === ZONA_LUBRICANTES &&
             pedido[k] > (Number(f[DEP_COL_STOCK.STOCK_ACTUAL - 1]) || 0) + 0.0001;
    });
    if (sinStock.length) return jsonResp({ ok: false, error: 'Stock insuficiente en: ' + sinStock.join(', ') });
  }

  const nroEnvio = dep_generarNroEnvio();
  const idPedido = dep_generarIdPedido(hojaMov, tipo);

  const partesObsMov = [];
  if (data.solicitante)   partesObsMov.push('SOLICITANTE: ' + String(data.solicitante).trim().toUpperCase());
  if (data.equipo)        partesObsMov.push('EQUIPO: ' + String(data.equipo).trim().toUpperCase());
  if (data.tipo_servicio) partesObsMov.push('SERVICIO: ' + String(data.tipo_servicio).trim().toUpperCase());
  if (data.km_hs)         partesObsMov.push('KM/HS: ' + String(data.km_hs).trim().toUpperCase());
  const obsMov     = partesObsMov.join(' | ').toUpperCase();
  const factura    = String(data.factura || '').trim().toUpperCase();
  const obsGeneral = String(data.obs_general || '').trim().toUpperCase();
  const fechaMov   = dep_normalizarFecha(data.fecha, timezone);

  const filasMov = [];

  // 2) STOCK: por número de fila, sin releer la hoja
  items.forEach(item => {
    const i       = indicePorId[String(item.id || '').trim().toUpperCase()];
    const fila    = datos[i];
    const filaNum = i + 2;
    const cantidad = Number(item.cantidad) || 0;

    const zonaItem    = String(fila[DEP_COL_STOCK.ZONA        - 1] || data.zona || '').trim().toUpperCase();
    const familia     = String(fila[DEP_COL_STOCK.FAMILIA     - 1] || '').trim().toUpperCase();
    const marca       = String(fila[DEP_COL_STOCK.MARCA       - 1] || '').trim().toUpperCase();
    const descripcion = String(fila[DEP_COL_STOCK.DESCRIPCION - 1] || '').trim().toUpperCase();
    const unidad      = String(fila[DEP_COL_STOCK.UNIDAD      - 1] || item.unidad || '').trim().toUpperCase();
    const ub = {
      deposito: String(fila[DEP_COL_STOCK.UBIC_DEPOSITO - 1] || '').trim().toUpperCase(),
      estante:  String(fila[DEP_COL_STOCK.UBIC_ESTANTE  - 1] || '').trim().toUpperCase(),
      columna:  String(fila[DEP_COL_STOCK.UBIC_COLUMNA  - 1] || '').trim().toUpperCase(),
      fila:     String(fila[DEP_COL_STOCK.UBIC_FILA     - 1] || '').trim().toUpperCase()
    };

    filasMov.push(limpiarFilaMayusculas_([
      idPedido, fechaMov, tipo, String(data.responsable || '').trim().toUpperCase(), String(data.obra || '').trim().toUpperCase(), zonaItem,
      familia, marca, descripcion,
      cantidad, unidad, obsMov, obsGeneral, nroEnvio,
      ub.deposito, ub.estante, ub.columna, ub.fila,
      factura
    ], false));

    let entradas     = Number(fila[DEP_COL_STOCK.ENTRADAS     - 1]) || 0;
    let salidas      = Number(fila[DEP_COL_STOCK.SALIDAS      - 1]) || 0;
    let devoluciones = Number(fila[DEP_COL_STOCK.DEVOLUCIONES - 1]) || 0;
    if      (tipo === 'ENTRADA')    entradas     += cantidad;
    else if (tipo === 'SALIDA')     salidas      += cantidad;
    else if (tipo === 'DEVOLUCIÓN') devoluciones += cantidad;
    entradas = R2(entradas); salidas = R2(salidas); devoluciones = R2(devoluciones);
    const stockActual = R2(entradas - salidas + devoluciones);

    fila[DEP_COL_STOCK.ENTRADAS     - 1] = entradas;
    fila[DEP_COL_STOCK.SALIDAS      - 1] = salidas;
    fila[DEP_COL_STOCK.DEVOLUCIONES - 1] = devoluciones;

    hojaStock.getRange(filaNum, DEP_COL_STOCK.ENTRADAS, 1, 4)
      .setValues([[entradas, salidas, devoluciones, stockActual]]);
    hojaStock.getRange(filaNum, DEP_COL_STOCK.ESTADO)
      .setFormula(`=IF(K${filaNum}<=L${filaNum},"REPONER","OK")`);
    hojaStock.getRange(filaNum, DEP_COL_STOCK.ULT_MOVIMIENTO).setValue(tipo.toUpperCase());
    hojaStock.getRange(filaNum, DEP_COL_STOCK.ULT_FECHA, 1, 2).setValues([[fechaHoy, horaAhora]]);
    if (obsGeneral) {
      hojaStock.getRange(filaNum, DEP_COL_STOCK.ULT_MOV_OBS).setValue(obsGeneral.toUpperCase());
    }

    const sinStock = stockActual <= 0;
    hojaStock.getRangeList(['K' + filaNum, 'M' + filaNum])
      .setBackground(sinStock ? '#fee2e2' : '#dcfce7')
      .setFontColor(sinStock ? '#dc2626' : '#15803d')
      .setFontWeight('bold');
  });

  // 3) MOVIMIENTOS: una sola escritura para todo el lote
  if (filasMov.length > 0) {
    const primera = hojaMov.getLastRow() + 1;
    const faltan  = primera + filasMov.length - 1 - hojaMov.getMaxRows();
    if (faltan > 0) hojaMov.insertRowsAfter(hojaMov.getMaxRows(), faltan);
    if (factura) {
      hojaMov.getRange(primera, DEP_COL_MOV.NRO_FACTURA, filasMov.length, 1).setNumberFormat('@');
    }
    hojaMov.getRange(primera, 1, filasMov.length, DEP_COL_MOV.TOTAL).setValues(limpiarMatrizMayusculas_(filasMov, false));
  }

  // 4) FIRMA: solo si es SALIDA y vino con firma (las demás pantallas no se ven afectadas)
  let errorFirma = null;
  if (tipo === 'SALIDA' && data.firma_base64) {
    try {
      guardarFirmaSalida_(data, ss, idPedido, nroEnvio, fechaMov, filasMov);
    } catch (errF) {
      Logger.log('ERROR guardando firma: ' + errF.message);
      errorFirma = errF.message;
    }
  }

  return jsonResp({ ok: true, id: idPedido, envio: nroEnvio, error_firma: errorFirma });
}

function crearProductoNuevo(data, ss) {
  const hojaStock = ss.getSheetByName('Stock');
  const hojaMov   = ss.getSheetByName('Movimientos') || ss.insertSheet('Movimientos');
  if (!hojaStock) return jsonResp({ ok: false, error: 'Hoja Stock no encontrada.' });

  dep_inicializarHojaMovimientos(hojaMov);
  dep_inicializarHojaStock(hojaStock);

  const nuevoId = dep_generarIdProducto(hojaStock);

  const tipoAltaRaw = String(data.tipo_alta || '').trim().toUpperCase();
  const esRetiro     = tipoAltaRaw === 'RETIRO';
  const obraLabel     = esRetiro
    ? 'INGRESO INICIAL / ALTA - RETIRO'
    : 'INGRESO INICIAL / ALTA - DEPÓSITO';

  const zona        = esRetiro ? '' : String(data.zona || '').trim().toUpperCase();
  const familia      = String(data.familia || 'VARIOS').trim().toUpperCase();
  const marca        = String(data.marca || '—').trim().toUpperCase();
  const descripcion  = String(data.descripcion || '').trim().toUpperCase();
  const unidad       = String(data.unidad || 'UN').trim().toUpperCase();
  const stockInicial = Number(data.stock_inicial !== undefined ? data.stock_inicial : data.stock_actual) || 0;
  const stockMinimo  = Number(data.stock_minimo) || 0;
  const responsable  = String(data.responsable || 'ALTA DE PRODUCTO').trim().toUpperCase();

  const ubicDeposito = esRetiro ? '' : String(data.deposito || '').trim().toUpperCase();
  const ubicEstante  = esRetiro ? '' : String(data.estante  || '').trim().toUpperCase();
  const ubicColumna  = esRetiro ? '' : String(data.columna  || '').trim().toUpperCase();
  const ubicFila     = esRetiro ? '' : String(data.fila     || '').trim().toUpperCase();

  const factura = String(data.factura || '').trim().toUpperCase();

  const lugarRetiro   = String(data.lugar_retiro || '').trim().toUpperCase();
  const aclaracionUbi = String(data.ubicacion_aclaracion || '').trim().toUpperCase();
  const obsUsuario    = String(data.observaciones || '').trim().toUpperCase();

  let obsItemParts = [];
  if (esRetiro && lugarRetiro) obsItemParts.push('RETIRO: ' + lugarRetiro);
  if (!esRetiro && aclaracionUbi) obsItemParts.push(aclaracionUbi);
  if (obsUsuario) obsItemParts.push(obsUsuario);
  const obsItem = obsItemParts.join(' | ').toUpperCase();

  // ── EVITAR DUPLICADOS: si el producto ya existe en Stock, NO se crea otra fila.
  // Solo se registra la ENTRADA (con su factura) sobre el producto existente. ──
  const normK = v => String(v || '').trim().toUpperCase();
  const ultFilaStockChk = hojaStock.getLastRow();
  if (ultFilaStockChk > 1) {
    const datosStockChk = hojaStock.getRange(2, 1, ultFilaStockChk - 1, DEP_COL_STOCK.TOTAL).getValues();
    const filaExistente = datosStockChk.find(r =>
      normK(r[DEP_COL_STOCK.ZONA        - 1]) === normK(zona)        &&
      normK(r[DEP_COL_STOCK.FAMILIA     - 1]) === normK(familia)     &&
      normK(r[DEP_COL_STOCK.MARCA       - 1]) === normK(marca)       &&
      normK(r[DEP_COL_STOCK.DESCRIPCION - 1]) === normK(descripcion)
    );

    if (filaExistente) {
      const tzE      = Session.getScriptTimeZone();
      const ahoraE   = new Date();
      const fechaE   = Utilities.formatDate(ahoraE, tzE, 'dd/MM/yyyy');
      const horaE    = Utilities.formatDate(ahoraE, tzE, 'HH:mm');
      const idExist  = String(filaExistente[DEP_COL_STOCK.ID - 1] || '');
      const unidadE  = String(filaExistente[DEP_COL_STOCK.UNIDAD - 1] || '') || unidad;
      const ubicE = {
        deposito: String(filaExistente[DEP_COL_STOCK.UBIC_DEPOSITO - 1] || ''),
        estante:  String(filaExistente[DEP_COL_STOCK.UBIC_ESTANTE  - 1] || ''),
        columna:  String(filaExistente[DEP_COL_STOCK.UBIC_COLUMNA  - 1] || ''),
        fila:     String(filaExistente[DEP_COL_STOCK.UBIC_FILA     - 1] || '')
      };

      if (stockInicial > 0) {
        const idPedidoE = dep_generarIdPedido(hojaMov, 'ENTRADA');
        const nroEnvioE = dep_generarNroEnvio();
        hojaMov.appendRow(limpiarFilaMayusculas_([
          idPedidoE, dep_normalizarFecha(null, tzE), 'ENTRADA', responsable, obraLabel,
          filaExistente[DEP_COL_STOCK.ZONA        - 1],
          filaExistente[DEP_COL_STOCK.FAMILIA     - 1],
          filaExistente[DEP_COL_STOCK.MARCA       - 1],
          filaExistente[DEP_COL_STOCK.DESCRIPCION - 1],
          stockInicial, unidadE, obsItem, String(data.obs_general || '').trim().toUpperCase(), nroEnvioE,
          ubicE.deposito, ubicE.estante, ubicE.columna, ubicE.fila,
          factura
        ], false));

        if (factura) {
          const celdaFacturaE = hojaMov.getRange(hojaMov.getLastRow(), DEP_COL_MOV.NRO_FACTURA);
          celdaFacturaE.setNumberFormat('@');
          celdaFacturaE.setValue(factura);
        }

        dep_actualizarStock(
          hojaStock,
          filaExistente[DEP_COL_STOCK.ZONA        - 1],
          filaExistente[DEP_COL_STOCK.FAMILIA     - 1],
          filaExistente[DEP_COL_STOCK.MARCA       - 1],
          filaExistente[DEP_COL_STOCK.DESCRIPCION - 1],
          'ENTRADA', stockInicial, fechaE, horaE,
          ubicE, unidadE, '', String(data.obs_general || '').trim().toUpperCase(), ''
        );
      }

      return jsonResp({ ok: true, id: idExist, zona: zona, imagen: '', existente: true, error_fotos: null });
    }
  }

  let imagenUrl = '';
  let errorFotos = '';
  if (data.fotos_base64 && Array.isArray(data.fotos_base64) && data.fotos_base64.length > 0) {
    try {
      const urls = data.fotos_base64.filter(Boolean).map((b64, idx) => {
        return subirImagenDrive(b64, `prod_${nuevoId}_${Date.now()}_${idx}.jpg`);
      });
      imagenUrl = urls.join('||');
    } catch (errFoto) {
      Logger.log('ERROR subiendo fotos en crearProductoNuevo: ' + errFoto.message);
      errorFotos = errFoto.message;
    }
  } else if (data.foto_base64) {
    try {
      imagenUrl = subirImagenDrive(data.foto_base64, `prod_${nuevoId}_${Date.now()}.jpg`);
    } catch (errFoto) {
      Logger.log('ERROR subiendo foto en crearProductoNuevo: ' + errFoto.message);
      errorFotos = errFoto.message;
    }
  }

  const ahora = new Date();
  const timezone = Session.getScriptTimeZone();
  const fechaHoy = Utilities.formatDate(ahora, timezone, 'dd/MM/yyyy');
  const horaAhora = Utilities.formatDate(ahora, timezone, 'HH:mm');

  const entradas = stockInicial > 0 ? stockInicial : 0;
  const salidas = 0;
  const devoluciones = 0;
  const stockActual = stockInicial;

  hojaStock.appendRow(limpiarFilaMayusculas_([
    nuevoId, zona, familia, marca, descripcion,
    imagenUrl, unidad,
    entradas, salidas, devoluciones, stockActual,
    stockMinimo,
    '',
    stockInicial > 0 ? 'ENTRADA' : 'ALTA', obsItem, fechaHoy, horaAhora,
    ubicDeposito, ubicEstante, ubicColumna, ubicFila,
    'ALTA DE PRODUCTO NUEVO'
  ], true));

  const filaNum = hojaStock.getLastRow();
  hojaStock.getRange(filaNum, DEP_COL_STOCK.ESTADO).setFormula(`=IF(K${filaNum}<=L${filaNum},"REPONER","OK")`);

  // ── Refuerzo: escribir la imagen explícitamente por columna,          ──
  // ── sin depender de la posición dentro del appendRow.                  ──
  if (imagenUrl) {
    hojaStock.getRange(filaNum, DEP_COL_STOCK.IMAGEN).setValue(imagenUrl);
  }

  const celdaEstado = hojaStock.getRange(filaNum, DEP_COL_STOCK.ESTADO);
  const celdaStock = hojaStock.getRange(filaNum, DEP_COL_STOCK.STOCK_ACTUAL);
  if (stockActual <= stockMinimo) {
    celdaEstado.setBackground('#fee2e2').setFontColor('#dc2626').setFontWeight('bold');
    celdaStock.setBackground('#fee2e2').setFontColor('#dc2626').setFontWeight('bold');
  } else {
    celdaEstado.setBackground('#dcfce7').setFontColor('#15803d').setFontWeight('bold');
    celdaStock.setBackground('#dcfce7').setFontColor('#15803d').setFontWeight('bold');
  }

  const obsGeneralEnvio = String(data.obs_general || '').trim().toUpperCase();

  if (stockInicial > 0) {
    const idPedido = dep_generarIdPedido(hojaMov, 'ENTRADA');
    const nroEnvio = dep_generarNroEnvio();
    hojaMov.appendRow(limpiarFilaMayusculas_([
      idPedido, dep_normalizarFecha(null, timezone), 'ENTRADA', responsable, obraLabel, zona,
      familia, marca, descripcion,
      stockInicial, unidad, obsItem, obsGeneralEnvio, nroEnvio,
      ubicDeposito, ubicEstante, ubicColumna, ubicFila,
      factura
    ], false));

    if (factura) {
      const filaMovNueva = hojaMov.getLastRow();
      const celdaFactura = hojaMov.getRange(filaMovNueva, DEP_COL_MOV.NRO_FACTURA);
      celdaFactura.setNumberFormat('@');
      celdaFactura.setValue(factura);
    }
  }

  return jsonResp({ ok: true, id: nuevoId, zona: zona, imagen: imagenUrl, error_fotos: errorFotos || null });
}

function actualizarObservacionProducto(data, ss) {
  const hojaStock = ss.getSheetByName('Stock');
  if (!hojaStock) return jsonResp({ ok: false, error: 'Hoja Stock no encontrada.' });

  const idBuscado = String(data.id || '').trim().toUpperCase();
  if (!idBuscado) return jsonResp({ ok: false, error: 'Falta el ID del producto.' });

  const ultimaFila = hojaStock.getLastRow();
  if (ultimaFila <= 1) return jsonResp({ ok: false, error: 'Stock vacío.' });

  const datos = hojaStock.getRange(2, 1, ultimaFila - 1, DEP_COL_STOCK.TOTAL).getValues();
  let filaNum = -1;
  for (let i = 0; i < datos.length; i++) {
    if (String(datos[i][DEP_COL_STOCK.ID - 1]).trim().toUpperCase() === idBuscado) {
      filaNum = i + 2;
      break;
    }
  }
  if (filaNum === -1) return jsonResp({ ok: false, error: 'Producto no encontrado.' });

  hojaStock.getRange(filaNum, DEP_COL_STOCK.ULT_OBS).setValue(String(data.observacion || '').trim().toUpperCase());

  return jsonResp({ ok: true });
}

function actualizarUbicacionProducto(data, ss) {
  const hojaStock = ss.getSheetByName('Stock');
  if (!hojaStock) return jsonResp({ ok: false, error: 'Hoja Stock no encontrada.' });

  const idBuscado = String(data.id || '').trim().toUpperCase();
  if (!idBuscado) return jsonResp({ ok: false, error: 'Falta el ID del producto.' });

  const ultimaFila = hojaStock.getLastRow();
  if (ultimaFila <= 1) return jsonResp({ ok: false, error: 'Stock vacío.' });

  const datos = hojaStock.getRange(2, 1, ultimaFila - 1, DEP_COL_STOCK.TOTAL).getValues();
  let filaNum = -1;
  for (let i = 0; i < datos.length; i++) {
    if (String(datos[i][DEP_COL_STOCK.ID - 1]).trim().toUpperCase() === idBuscado) {
      filaNum = i + 2;
      break;
    }
  }
  if (filaNum === -1) return jsonResp({ ok: false, error: 'Producto no encontrado.' });

  hojaStock.getRange(filaNum, DEP_COL_STOCK.UBIC_DEPOSITO, 1, 4).setValues(limpiarMatrizMayusculas_([[
    data.deposito || '', data.estante || '', data.columna || '', data.fila || ''
  ]], true));

  return jsonResp({ ok: true });
}

function actualizarDatosProducto(data, ss) {
  const hojaStock = ss.getSheetByName('Stock');
  if (!hojaStock) return jsonResp({ ok: false, error: 'Hoja Stock no encontrada.' });

  const idBuscado = String(data.id || '').trim().toUpperCase();
  if (!idBuscado) return jsonResp({ ok: false, error: 'Falta el ID del producto.' });

  const ultimaFila = hojaStock.getLastRow();
  if (ultimaFila <= 1) return jsonResp({ ok: false, error: 'Stock vacío.' });

  const datos = hojaStock.getRange(2, 1, ultimaFila - 1, DEP_COL_STOCK.TOTAL).getValues();
  let filaNum = -1;
  for (let i = 0; i < datos.length; i++) {
    if (String(datos[i][DEP_COL_STOCK.ID - 1]).trim().toUpperCase() === idBuscado) {
      filaNum = i + 2;
      break;
    }
  }
  if (filaNum === -1) return jsonResp({ ok: false, error: 'Producto no encontrado.' });

  const norm = v => String(v || '').trim().toUpperCase();
  const viejo = {
    zona:    norm(datos[filaNum - 2][DEP_COL_STOCK.ZONA        - 1]),
    familia: norm(datos[filaNum - 2][DEP_COL_STOCK.FAMILIA     - 1]),
    marca:   norm(datos[filaNum - 2][DEP_COL_STOCK.MARCA       - 1]),
    desc:    norm(datos[filaNum - 2][DEP_COL_STOCK.DESCRIPCION - 1])
  };

  if (data.descripcion !== undefined) {
    hojaStock.getRange(filaNum, DEP_COL_STOCK.DESCRIPCION).setValue(String(data.descripcion || '').trim().toUpperCase());
  }
  if (data.marca !== undefined) {
    hojaStock.getRange(filaNum, DEP_COL_STOCK.MARCA).setValue(String(data.marca || '').trim().toUpperCase());
  }
  if (data.familia !== undefined) {
    hojaStock.getRange(filaNum, DEP_COL_STOCK.FAMILIA).setValue(String(data.familia || '').trim().toUpperCase());
  }
  if (data.stock_minimo !== undefined) {
    const nuevoMinimo = Number(data.stock_minimo);
    if (!isNaN(nuevoMinimo) && nuevoMinimo >= 0) {
      hojaStock.getRange(filaNum, DEP_COL_STOCK.STOCK_MINIMO).setValue(nuevoMinimo);
    }
  }

  const nuevo = {
    familia: norm(hojaStock.getRange(filaNum, DEP_COL_STOCK.FAMILIA).getValue()),
    marca:   norm(hojaStock.getRange(filaNum, DEP_COL_STOCK.MARCA).getValue()),
    desc:    norm(hojaStock.getRange(filaNum, DEP_COL_STOCK.DESCRIPCION).getValue())
  };

  if (nuevo.familia !== viejo.familia || nuevo.marca !== viejo.marca || nuevo.desc !== viejo.desc) {
    const hojaMov = ss.getSheetByName('Movimientos');
    if (hojaMov && hojaMov.getLastRow() > 1) {
      // Columnas contiguas: ZONA, FAMILIA, MARCA, DESCRIPCION
      const rango = hojaMov.getRange(2, DEP_COL_MOV.ZONA, hojaMov.getLastRow() - 1, 4);
      const vals = rango.getValues();
      let cambios = 0;
      vals.forEach(r => {
        if (norm(r[0]) === viejo.zona && norm(r[1]) === viejo.familia &&
            norm(r[2]) === viejo.marca && norm(r[3]) === viejo.desc) {
          r[1] = nuevo.familia;
          r[2] = nuevo.marca;
          r[3] = nuevo.desc;
          cambios++;
        }
      });
      if (cambios > 0) rango.setValues(limpiarMatrizMayusculas_(vals, false));
    }
  }

  return jsonResp({ ok: true });
}

function actualizarImagenProducto(data, ss) {
  const hojaStock = ss.getSheetByName('Stock');
  if (!hojaStock) return jsonResp({ ok: false, error: 'Hoja Stock no encontrada.' });

  const idBuscado = String(data.id || '').trim().toUpperCase();
  if (!idBuscado) return jsonResp({ ok: false, error: 'Falta el ID del producto.' });
  if (!data.foto_base64) return jsonResp({ ok: false, error: 'Falta la foto.' });

  const ultimaFila = hojaStock.getLastRow();
  if (ultimaFila <= 1) return jsonResp({ ok: false, error: 'Stock vacío.' });

  const datos = hojaStock.getRange(2, 1, ultimaFila - 1, DEP_COL_STOCK.TOTAL).getValues();
  let filaNum = -1;
  for (let i = 0; i < datos.length; i++) {
    if (String(datos[i][DEP_COL_STOCK.ID - 1]).trim().toUpperCase() === idBuscado) {
      filaNum = i + 2;
      break;
    }
  }
  if (filaNum === -1) return jsonResp({ ok: false, error: 'Producto no encontrado.' });

  const nuevoLink = subirImagenDrive(data.foto_base64, `stock_${idBuscado}_${Date.now()}.jpg`);

  const celdaImagen = hojaStock.getRange(filaNum, DEP_COL_STOCK.IMAGEN);
  const actual = String(celdaImagen.getValue() || '').trim();
  const links = actual ? actual.split('||').map(s => s.trim()).filter(Boolean) : [];

  const modo = data.modo || 'reemplazar';
  let nuevosLinks;
  if (links.length === 0 || modo === 'reemplazar') {
    nuevosLinks = [nuevoLink];
  } else if (modo === 'agregar') {
    nuevosLinks = [...links, nuevoLink].slice(0, 2);
  } else if (modo === 'reemplazar_1') {
    nuevosLinks = [nuevoLink, links[1]].filter(Boolean);
  } else if (modo === 'reemplazar_2') {
    nuevosLinks = [links[0], nuevoLink].filter(Boolean);
  } else {
    nuevosLinks = [nuevoLink];
  }

  celdaImagen.setValue(nuevosLinks.join('||'));

  return jsonResp({ ok: true, imagen: nuevosLinks.join('||') });
}

function eliminarImagenProducto(data, ss) {
  const hojaStock = ss.getSheetByName('Stock');
  if (!hojaStock) return jsonResp({ ok: false, error: 'Hoja Stock no encontrada.' });

  const idBuscado = String(data.id || '').trim().toUpperCase();
  if (!idBuscado) return jsonResp({ ok: false, error: 'Falta el ID del producto.' });

  const ultimaFila = hojaStock.getLastRow();
  if (ultimaFila <= 1) return jsonResp({ ok: false, error: 'Stock vacío.' });

  const datos = hojaStock.getRange(2, 1, ultimaFila - 1, DEP_COL_STOCK.TOTAL).getValues();
  let filaNum = -1;
  for (let i = 0; i < datos.length; i++) {
    if (String(datos[i][DEP_COL_STOCK.ID - 1]).trim().toUpperCase() === idBuscado) {
      filaNum = i + 2;
      break;
    }
  }
  if (filaNum === -1) return jsonResp({ ok: false, error: 'Producto no encontrado.' });

  const celdaImagen = hojaStock.getRange(filaNum, DEP_COL_STOCK.IMAGEN);
  const actual = String(celdaImagen.getValue() || '').trim();
  const links = actual ? actual.split('||').map(s => s.trim()).filter(Boolean) : [];
  if (links.length === 0) return jsonResp({ ok: false, error: 'Este producto no tiene fotos.' });

  const slot = data.slot; 
  let linksABorrar = [];
  let linksQueQuedan = [];

  if (slot === 'todas') {
    linksABorrar = links;
    linksQueQuedan = [];
  } else {
    const idx = Number(slot) - 1; 
    if (idx < 0 || idx >= links.length) return jsonResp({ ok: false, error: 'Foto no encontrada en esa posición.' });
    linksABorrar = [links[idx]];
    linksQueQuedan = links.filter((_, i) => i !== idx);
  }

  linksABorrar.forEach(link => {
    const match = link.match(/[?&]id=([a-zA-Z0-9_-]+)/) || link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) moverImagenAPapeleraInterna(match[1]);
  });

  celdaImagen.setValue(linksQueQuedan.join('||'));
  return jsonResp({ ok: true, imagen: linksQueQuedan.join('||') });
}


// ============================================================
// 6. MÓDULO TRASLADOS
// ============================================================
function procesarTraslado(data, ss) {
  const hojaMov   = ss.getSheetByName('Movimientos Traslados') || ss.insertSheet('Movimientos Traslados');
  const hojaStock = ss.getSheetByName('Stock Traslados')       || ss.insertSheet('Stock Traslados');

  tra_inicializarHojaMovimientos(hojaMov);
  tra_inicializarHojaStock(hojaStock);

  const fecha       = data.fecha       || '';
  const responsable = data.responsable || '';
  const origen      = data.origen      || '';
  const destino     = data.destino     || '';
  const obsGeneral  = data.obs_general || '';

  const nroTraslado = tra_generarNroTraslado();
  const idBase      = tra_generarIdMovimiento(hojaMov);

  const ahora     = new Date();
  const timezone  = Session.getScriptTimeZone();
  const fechaHoy  = Utilities.formatDate(ahora, timezone, 'dd/MM/yyyy');
  const horaAhora = Utilities.formatDate(ahora, timezone, 'HH:mm');

  const base = { idBase, fecha, responsable, origen, destino, obsGeneral, nroTraslado };

  (data.escaleras_dielectricas || []).forEach(item => {
    const descripcion = `ESCALERA DIELÉCTRICA ${String(item.tipo || '').toUpperCase()} ${String(item.peldanos || '').toUpperCase()}`.trim();
    tra_procesarItem(hojaMov, hojaStock, base,
      'ESCALERA DIELÉCTRICA', descripcion, String(item.tipo || '').toUpperCase(), item.serie || '',
      Number(item.cant) || 0, String(item.estado || '').toUpperCase(), '', item.obs || '',
      fechaHoy, horaAhora);
  });

  (data.escaleras_madera || []).forEach(item => {
    const descripcion = `ESCALERA DE MADERA ${String(item.tipo || '').toUpperCase()} ${String(item.peldanos || '').toUpperCase()}`.trim();
    tra_procesarItem(hojaMov, hojaStock, base,
      'ESCALERA DE MADERA', descripcion, String(item.tipo || '').toUpperCase(), item.serie || '',
      Number(item.cant) || 0, String(item.estado || '').toUpperCase(), '', item.obs || '',
      fechaHoy, horaAhora);
  });

  (data.ruedas || []).forEach(item => {
    const descripcion = `RUEDA ${String(item.medida || '').toUpperCase()}`.trim();
    tra_procesarItem(hojaMov, hojaStock, base,
      'RUEDA DE CAMIÓN', descripcion, String(item.tipo || 'SIN TIPO').toUpperCase(), '',
      Number(item.cant) || 0, String(item.estado || '').toUpperCase(), String(item.equipo || '').toUpperCase(), item.obs || '',
      fechaHoy, horaAhora);
  });

  (data.nuevos || []).forEach(item => {
    tra_procesarItem(hojaMov, hojaStock, base,
      'MATERIAL NUEVO', String(item.nombre || '').trim().toUpperCase(), String(item.unidad || '').toUpperCase(), String(item.desc || '').toUpperCase(),
      Number(item.cant) || 0, String(item.estado || '').toUpperCase(), '', item.obs || '',
      fechaHoy, horaAhora);
  });

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, id: idBase, traslado: nroTraslado }))
    .setMimeType(ContentService.MimeType.JSON);
}

function tra_generarNroTraslado() {
  const props    = PropertiesService.getScriptProperties();
  const timezone = Session.getScriptTimeZone();
  const hoy      = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');

  const ultimaFecha = props.getProperty('TRD_FECHA') || '';
  let   ultimoNum   = parseInt(props.getProperty('TRD_NUM') || '0', 10);

  if (ultimaFecha !== hoy) {
    ultimoNum = 0;
    props.setProperty('TRD_FECHA', hoy);
  }

  const nuevoNum = ultimoNum + 1;
  props.setProperty('TRD_NUM', String(nuevoNum));
  return 'TRD-' + String(nuevoNum).padStart(3, '0');
}

function tra_generarIdMovimiento(hojaMov) {
  const ultimaFila = hojaMov.getLastRow();
  let maxNum = 0;

  if (ultimaFila > 1) {
    const ids = hojaMov.getRange(2, TRA_COL_MOV.ID, ultimaFila - 1, 1).getValues();
    ids.forEach(([id]) => {
      const s = String(id || '');
      if (s.startsWith('TRA-')) {
        const num = parseInt(s.replace('TRA-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return 'TRA-' + String(maxNum + 1).padStart(3, '0');
}

function tra_generarIdStock(hojaStock) {
  const ultimaFila = hojaStock.getLastRow();
  if (ultimaFila <= 1) return 'ITEM-001';

  const ids = hojaStock.getRange(2, TRA_COL_STOCK.ID, ultimaFila - 1, 1).getValues();
  let maxNum = 0;
  ids.forEach(([id]) => {
    const s = String(id || '');
    if (s.startsWith('ITEM-')) {
      const num = parseInt(s.replace('ITEM-', ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return 'ITEM-' + String(maxNum + 1).padStart(3, '0');
}

function tra_inicializarHojaMovimientos(hoja) {
  if (hoja.getLastRow() > 0) return;

  hoja.appendRow([
    'ID Traslado', 'Fecha', 'Responsable', 'Origen → Destino',
    'Categoría', 'Descripción', 'Detalle', 'N° Serie / ID',
    'Cantidad', 'Estado', 'Camión / Equipo',
    'Obs. ítem', 'Obs. generales', 'N° Traslado',
  ]);

  const header = hoja.getRange(1, 1, 1, TRA_COL_MOV.TOTAL);
  header.setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
  hoja.setFrozenRows(1);

  const anchos = [90, 100, 130, 220, 160, 260, 160, 110, 80, 100, 140, 200, 220, 100];
  anchos.forEach((w, i) => hoja.setColumnWidth(i + 1, w));
}

function tra_inicializarHojaStock(hoja) {
  if (hoja.getLastRow() > 0) return;

  hoja.appendRow([
    'ID Ítem', 'Depósito', 'Categoría', 'Descripción', 'Detalle',
    'Entradas', 'Salidas', 'Stock actual',
    'Último estado', 'Último mov.', 'Fecha', 'Hora',
  ]);

  const header = hoja.getRange(1, 1, 1, TRA_COL_STOCK.TOTAL);
  header.setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
  hoja.setFrozenRows(1);

  const anchos = [90, 160, 160, 260, 160, 80, 80, 100, 110, 110, 110, 90];
  anchos.forEach((w, i) => hoja.setColumnWidth(i + 1, w));
}

function tra_actualizarStock(hojaStock, deposito, categoria, descripcion, detalle, tipoMov, cantidad, estadoItem, fechaHoy, horaAhora) {
  const ultimaFila = hojaStock.getLastRow();
  let filaNum = -1;

  if (ultimaFila > 1) {
    const datos = hojaStock.getRange(2, 1, ultimaFila - 1, TRA_COL_STOCK.TOTAL).getValues();
    for (let i = 0; i < datos.length; i++) {
      if (
        String(datos[i][TRA_COL_STOCK.DEPOSITO    - 1]) === deposito    &&
        String(datos[i][TRA_COL_STOCK.CATEGORIA   - 1]) === categoria   &&
        String(datos[i][TRA_COL_STOCK.DESCRIPCION - 1]) === descripcion &&
        String(datos[i][TRA_COL_STOCK.DETALLE     - 1]) === detalle
      ) {
        filaNum = i + 2;
        break;
      }
    }
  }

  if (filaNum === -1) {
    const nuevoId = tra_generarIdStock(hojaStock);
    hojaStock.appendRow(limpiarFilaMayusculas_([
      nuevoId, deposito, categoria, descripcion, detalle,
      0, 0, 0,
      estadoItem, tipoMov, fechaHoy, horaAhora
    ], false));
    filaNum = hojaStock.getLastRow();
  }

  const vals = hojaStock.getRange(filaNum, TRA_COL_STOCK.ENTRADAS, 1, 2).getValues()[0];
  let entradas = Number(vals[0]) || 0;
  let salidas  = Number(vals[1]) || 0;

  if (tipoMov === 'ENTRADA') entradas += cantidad;
  if (tipoMov === 'SALIDA')  salidas  += cantidad;

  const stockActual = entradas - salidas;

  hojaStock.getRange(filaNum, TRA_COL_STOCK.ENTRADAS, 1, 3)
    .setValues([[entradas, salidas, stockActual]]);

  const celdaStock = hojaStock.getRange(filaNum, TRA_COL_STOCK.STOCK_ACTUAL);
  if (stockActual <= 0) {
    celdaStock.setBackground('#fee2e2').setFontColor('#dc2626').setFontWeight('bold');
  } else {
    celdaStock.setBackground('#dcfce7').setFontColor('#15803d').setFontWeight('bold');
  }

  hojaStock.getRange(filaNum, TRA_COL_STOCK.ESTADO_ITEM, 1, 4)
    .setValues([[String(estadoItem || '').trim().toUpperCase(), String(tipoMov || '').trim().toUpperCase(), fechaHoy, horaAhora]]);
}

function tra_colorearEstadoMov(hoja, fila) {
  const celda = hoja.getRange(fila, TRA_COL_MOV.ESTADO);
  const val   = celda.getValue();
  if (val === 'Bueno')   { celda.setBackground('#dcfce7').setFontColor('#15803d').setFontWeight('bold'); }
  if (val === 'Regular') { celda.setBackground('#ffedd5').setFontColor('#ea580c').setFontWeight('bold'); }
  if (val === 'Malo')    { celda.setBackground('#fee2e2').setFontColor('#dc2626').setFontWeight('bold'); }
}

function tra_procesarItem(hojaMov, hojaStock, base, categoria, descripcion, detalle, serie, cantidad, estado, equipo, obsItem, fechaHoy, horaAhora) {
  const { idBase, fecha, responsable, origen, destino, obsGeneral, nroTraslado } = base;
  const ruta = origen + ' → ' + destino;

  hojaMov.appendRow(limpiarFilaMayusculas_([
    idBase, fecha, responsable, ruta,
    categoria, descripcion, detalle, serie,
    cantidad, estado, equipo,
    obsItem, obsGeneral, nroTraslado
  ], false));

  tra_colorearEstadoMov(hojaMov, hojaMov.getLastRow());

  tra_actualizarStock(hojaStock, origen,  categoria, descripcion, detalle, 'SALIDA',  cantidad, estado, fechaHoy, horaAhora);
  tra_actualizarStock(hojaStock, destino, categoria, descripcion, detalle, 'ENTRADA', cantidad, estado, fechaHoy, horaAhora);
}

// ============================================================
// 7. VISTAS HTML (QR)
// ============================================================
function _htmlProducto(p) {
  const esReponer  = p.estado === 'REPONER';
  const colorBadge = esReponer ? '#dc2626' : '#16a34a';
  const bgBadge    = esReponer ? '#fee2e2'  : '#dcfce7';
  const colorStock = p.stock_actual <= 0 ? '#dc2626' : (esReponer ? '#ea580c' : '#16a34a');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${p.descripcion} — RPM Stock</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      min-height: 100vh;
      padding: 16px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
    }
    .logo {
      font-size: 13px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .id-badge {
      margin-left: auto;
      font-size: 11px;
      background: #1e293b;
      color: #64748b;
      padding: 3px 8px;
      border-radius: 20px;
      font-weight: 600;
    }
    .card {
      background: #1e293b;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 12px;
    }
    .familia-tag {
      font-size: 11px;
      font-weight: 600;
      color: #60a5fa;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .descripcion {
      font-size: 17px;
      font-weight: 700;
      color: #f8fafc;
      line-height: 1.3;
      margin-bottom: 4px;
    }
    .marca {
      font-size: 13px;
      color: #94a3b8;
    }
    .zona-chip {
      display: inline-block;
      margin-top: 10px;
      background: #0f172a;
      color: #7dd3fc;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
    }
    .stock-card {
      background: #1e293b;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 12px;
      text-align: center;
    }
    .stock-label {
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .stock-numero {
      font-size: 64px;
      font-weight: 800;
      line-height: 1;
      color: ${colorStock};
    }
    .stock-unidad {
      font-size: 14px;
      color: #64748b;
      margin-top: 4px;
    }
    .estado-badge {
      display: inline-block;
      margin-top: 14px;
      background: ${bgBadge};
      color: ${colorBadge};
      font-size: 14px;
      font-weight: 800;
      padding: 6px 20px;
      border-radius: 30px;
      letter-spacing: 1px;
    }
    .minimo-row {
      margin-top: 12px;
      font-size: 12px;
      color: #64748b;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }
    .stat-box {
      background: #1e293b;
      border-radius: 12px;
      padding: 14px 8px;
      text-align: center;
    }
    .stat-num {
      font-size: 22px;
      font-weight: 700;
      color: #f1f5f9;
    }
    .stat-label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 3px;
    }
    .stat-box.entradas .stat-num  { color: #4ade80; }
    .stat-box.salidas .stat-num   { color: #f87171; }
    .stat-box.devol .stat-num     { color: #60a5fa; }
    .ultimo-mov {
      background: #1e293b;
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.7;
    }
    .ultimo-mov strong { color: #f1f5f9; }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #334155;
      margin-top: 20px;
    }
  </style>
</head>
<body>

  <div class="header">
    <span class="logo">RPM Construcciones</span>
    <span class="id-badge">${p.id}</span>
  </div>

  <div class="card">
    <div class="familia-tag">${p.familia}</div>
    <div class="descripcion">${p.descripcion}</div>
    <div class="marca">${p.marca}</div>
    <span class="zona-chip">📍 ${p.zona}</span>
  </div>

  <div class="stock-card">
    <div class="stock-label">Stock actual</div>
    <div class="stock-numero">${p.stock_actual}</div>
    <div class="stock-unidad">${p.unidad || 'unidades'}</div>
    <div class="estado-badge">${p.estado}</div>
    ${p.stock_minimo > 0 ? `<div class="minimo-row">Mínimo: ${p.stock_minimo} u.</div>` : ''}
  </div>

  <div class="stats-grid">
    <div class="stat-box entradas">
      <div class="stat-num">${p.entradas}</div>
      <div class="stat-label">Entradas</div>
    </div>
    <div class="stat-box salidas">
      <div class="stat-num">${p.salidas}</div>
      <div class="stat-label">Salidas</div>
    </div>
    <div class="stat-box devol">
      <div class="stat-num">${p.devoluciones}</div>
      <div class="stat-label">Devol.</div>
    </div>
  </div>

  ${p.ult_mov ? `
  <div class="ultimo-mov">
    Último movimiento: <strong>${p.ult_mov}</strong><br>
    Fecha: <strong>${p.ult_fecha}</strong> &nbsp;|&nbsp; Hora: <strong>${p.ult_hora}</strong>
  </div>` : ''}

  <div class="footer">RPM Stock · Datos en tiempo real desde Google Sheets</div>

</body>
</html>`;

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _htmlZona(zona, productos) {
  const filas = productos.map(p => {
    const esReponer   = p.estado === 'REPONER';
    const colorNum    = p.stock_actual <= 0 ? '#dc2626' : (esReponer ? '#ea580c' : '#4ade80');
    const bgEstado    = esReponer ? '#fee2e2' : '#dcfce7';
    const colorEstado = esReponer ? '#dc2626' : '#16a34a';
    return `
    <div class="item-card">
      <div class="item-top">
        <span class="item-familia">${p.familia}</span>
        <span class="item-estado" style="background:${bgEstado};color:${colorEstado}">${p.estado}</span>
      </div>
      <div class="item-desc">${p.descripcion}</div>
      <div class="item-marca">${p.marca}</div>
      <div class="item-bottom">
        <span class="item-id">${p.id}</span>
        <span class="item-stock" style="color:${colorNum}">${p.stock_actual} ${p.unidad || 'u.'}</span>
      </div>
    </div>`;
  }).join('');

  const reponer = productos.filter(p => p.estado === 'REPONER').length;
  const ok      = productos.length - reponer;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${zona} — RPM Stock</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      min-height: 100vh;
      padding: 16px;
    }
    .header { margin-bottom: 16px; }
    .logo { font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase; }
    .zona-titulo { font-size: 22px; font-weight: 800; color: #f8fafc; margin-top: 4px; }
    .resumen {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    }
    .res-box {
      background: #1e293b;
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }
    .res-num   { font-size: 28px; font-weight: 800; }
    .res-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .res-box.ok .res-num      { color: #4ade80; }
    .res-box.reponer .res-num { color: #f87171; }
    .search-wrap { margin-bottom: 12px; }
    .search-input {
      width: 100%;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      color: #f1f5f9;
      font-size: 14px;
      padding: 10px 14px;
      outline: none;
    }
    .search-input::placeholder { color: #475569; }
    .lista { display: flex; flex-direction: column; gap: 8px; }
    .item-card {
      background: #1e293b;
      border-radius: 12px;
      padding: 14px;
    }
    .item-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .item-familia { font-size: 11px; color: #60a5fa; font-weight: 600; text-transform: uppercase; }
    .item-estado  { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
    .item-desc    { font-size: 14px; font-weight: 600; color: #f8fafc; margin-bottom: 2px; }
    .item-marca   { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    .item-bottom  { display: flex; justify-content: space-between; align-items: center; }
    .item-id      { font-size: 11px; color: #475569; }
    .item-stock   { font-size: 18px; font-weight: 800; }
    .footer { text-align: center; font-size: 11px; color: #334155; margin-top: 20px; }
  </style>
</head>
<body>

  <div class="header">
    <div class="logo">RPM Construcciones</div>
    <div class="zona-titulo">📍 ${zona}</div>
  </div>

  <div class="resumen">
    <div class="res-box ok">
      <div class="res-num">${ok}</div>
      <div class="res-label">OK</div>
    </div>
    <div class="res-box reponer">
      <div class="res-num">${reponer}</div>
      <div class="res-label">Reponer</div>
    </div>
  </div>

  <div class="search-wrap">
    <input class="search-input" type="search" placeholder="Buscar producto..." oninput="filtrar(this.value)">
  </div>

  <div class="lista" id="lista">
    ${filas}
  </div>

  <div class="footer">RPM Stock · ${productos.length} productos · Datos en tiempo real</div>

  <script>
    function filtrar(q) {
      const term = q.toLowerCase();
      document.querySelectorAll('.item-card').forEach(el => {
        el.style.display = el.innerText.toLowerCase().includes(term) ? '' : 'none';
      });
    }
  <\/script>
</body>
</html>`;

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _htmlError(msg) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error — RPM Stock</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f1f5f9;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .box { background: #1e293b; border-radius: 16px; padding: 32px; text-align: center; max-width: 340px; }
    .icon { font-size: 40px; margin-bottom: 12px; }
    .titulo { font-size: 18px; font-weight: 700; color: #f87171; margin-bottom: 8px; }
    .msg { font-size: 14px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">⚠️</div>
    <div class="titulo">No se pudo cargar</div>
    <div class="msg">${msg}</div>
  </div>
</body>
</html>`;
  return HtmlService.createHtmlOutput(html);
}

// ============================================================
// 8. UTILIDADES DE MANTENIMIENTO
// ============================================================

function forzarAutorizacionFuerte() {
  DriveApp.createFile("Prueba_de_Permisos.txt", "El sistema ya tiene permisos");
}

function forzarFormatoTextoFactura() {
  const ss = SpreadsheetApp.openById('1PWCKGAQgZfBEWPwqWppsbylLdJLxJe3I6XWrEAhBwQk');
  const hojaMov = ss.getSheetByName('Movimientos');
  if (!hojaMov) return;
  hojaMov.getRange(1, DEP_COL_MOV.NRO_FACTURA, hojaMov.getMaxRows(), 1).setNumberFormat('@');
  Logger.log('Columna N° Factura formateada como texto.');
}

function instalarTriggerLimpiezaDiaria() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'limpiarImagenesVencidas') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('limpiarImagenesVencidas')
    .timeBased()
    .everyDays(1)
    .atHour(3) 
    .create();
}

// ============================================================
// HERRAMIENTAS Y EQUIPOS — BLOQUE NUEVO (pegar AL FINAL de Codigo.gs)
// No modifica nada existente. Funciones herr_*, constantes HERR_*.
// Además hay que aplicar 2 cambios mínimos de enrutamiento (ver instrucciones):
//   doGet  → action=herr-datos
//   doPost → accion=herr-movimiento
// Después de pegar: ejecutar UNA vez herr_prepararHojas() desde el editor.
// ============================================================

// ===== INICIO HERRAMIENTAS (NUEVO) =====
// ============================================================
// H.1 CATÁLOGO Y CONFIGURACIÓN (EDITABLE)
// ============================================================
const HERR_SS_ID = '1PWCKGAQgZfBEWPwqWppsbylLdJLxJe3I6XWrEAhBwQk';
const HERR_HOJA_UNIDADES = 'Unidades Herramientas';
const HERR_HOJA_MOVS     = 'Movimientos Herramientas';
const HERR_HOJA_STOCK    = 'Stock Herramientas';
const HERR_HOJA_REF = 'REF Herramientas';
const HERR_COLS_REF = ['CODIGO', 'HERRAMIENTA', 'MODO', 'ESTADO', 'DETALLE', 'FRECUENCIA DE MANTENIMIENTO (DÍAS)', 'FRECUENCIA'];

// ── MODO DE CADA FAMILIA ──────────────────────────────────────
// HERRAMIENTA MANUAL → se mueve por TIPO + CANTIDAD; al sacar se eligen los códigos exactos.
// EQUIPO             → se mueve por CÓDIGO INDIVIDUAL, sin cantidad.
// Para pasar una familia de un lado al otro: agregá o sacá su sigla de HERR_FAMILIAS_MANUALES.
// Cualquier sigla que NO esté en HERR_FAMILIAS_MANUALES se trata como EQUIPO. La lista
// HERR_FAMILIAS_EQUIPO es solo informativa (para que se vea qué se toma como equipo); lo que manda es la de manuales.
const HERR_FAMILIAS_MANUALES = ['HER'];
const HERR_FAMILIAS_EQUIPO = ["ALA", "AMO", "AGU", "APA", "ARR", "ATA", "ATO", "BGM", "BOM", "CAL", "CAN", "CAR", "CCO", "COM", "CPA", "CRI", "DEM", "DOB", "EST", "ELF", "GRA", "GRAA", "GRE", "GUI", "HAN", "HID", "HOR", "MAN", "MOR", "MOT", "MUL", "NIV", "NLA", "OXI", "PAL", "PER", "PIS", "PLAT", "REF", "ROT", "SEN", "SIC", "SOL", "TAB", "TAL", "TALE", "TEO", "TORI", "UPS", "VIB", "PLE", "ODO", "PRI", "ESI", "ETI"];

// Sigla → nombre de familia (hoja REF. del Excel). Es lo que se ve en el desplegable "Familia".
const HERR_NOMBRES_FAMILIA = {
  "ALA": "ALARGADOR",
  "AMO": "AMOLADORA",
  "AGU": "AGUJEREADORA DE PIE",
  "APA": "APAREJO ELECTRICO",
  "ARR": "CARGADOR ARRANCADOR",
  "ATA": "ATADORA DE HIERRO",
  "ATO": "ATORNILLADORA",
  "BGM": "BOMBA DE GASOIL",
  "BOM": "BOMBA DE AGUA / VACIO",
  "CAL": "SIERRA CALADORA",
  "CAN": "COMPACTADORA TIPO CANGURO",
  "CAR": "CARRETILLA",
  "CCO": "CORTADORA DE CONCRETO",
  "COM": "COMPRESOR",
  "CPA": "CORTADORA DE PASTO",
  "CRI": "CRIQUE CARRITO",
  "DEM": "MARTILLO DEMOLEDOR",
  "DOB": "DOBLADORA DE CAÑO",
  "EST": "ESTACIÓN TOTAL",
  "ELF": "MAQUINA DE ELECTROFUSION",
  "GRA": "GRASERA",
  "GRAA": "GRASERA DE AIRE",
  "GRE": "GRUPO ELECTRÓGENO",
  "GUI": "GUILLOTINA SOMAR",
  "HER": "HERRAMIENTAS DE MANO",
  "HAN": "HANDY RADIO",
  "HID": "HIDROLAVADORA",
  "HOR": "OLLA HORMIGONERA",
  "MAN": "MANOMETRO DE PRESIÓN DE AIRE PARA NEUMÁTICO",
  "MOR": "MORSA",
  "MOT": "MOTOSIERRA",
  "MUL": "SIERRA MULTICORTADORA",
  "NIV": "NIVEL OPTICO",
  "NLA": "NIVEL LASER",
  "OXI": "CILINDRO DE OXIGENO",
  "PAL": "PALA REVOCADORA",
  "PER": "PERCUTOR",
  "PIS": "PISTOLA DE CALOR",
  "PLAT": "COMPACTADORA TIPO PLATO",
  "REF": "REFLECTOR DE LUZ",
  "ROT": "ROTOMARTILLO",
  "SEN": "SIERRA SENSITIVA PROFESIONAL",
  "SIC": "SIERRA CIRCULAR",
  "SOL": "SOLDADORA",
  "TAB": "TABLERO ELECTRICO PORTATIL",
  "TAL": "TALADRO PERCUTOR",
  "TALE": "TALADRO ELECTRICO",
  "TEO": "TEODOLITO",
  "TORI": "TORRE DE ILUMINACION",
  "UPS": "EQUIPO UPS",
  "VIB": "VIBRADOR DE HORMIGON",
  "PLE": "PLEGADORA DE CHAPA",
  "ODO": "ODÓMETRO CON RUEDAS",
  "PRI": "PORTAPRISMA CON TARJETA",
  "ESI": "ESCALERA SIMPLE",
  "ETI": "ESCALERA TIJERA"
};

// Mayor número ya usado por sigla en el Excel original. El código automático continúa desde acá
// (o desde el máximo de la hoja, el que sea mayor), así no se pisan las etiquetas físicas existentes.
const HERR_CODIGO_MAX_EXCEL = {"AGU": 2, "AMO": 12, "ARR": 1, "BGM": 1, "BOM": 2, "CAN": 6, "CAR": 2, "CCO": 2, "COM": 4, "CRI": 1, "DEM": 1, "DOB": 1, "ESI": 8, "EST": 1, "ETI": 7, "GRA": 10, "GRAA": 2, "GRE": 12, "GUI": 1, "HAN": 5, "HER": 628, "HID": 1, "HOR": 3, "MAN": 1, "MOR": 3, "MOT": 7, "MUL": 1, "NIV": 1, "ODO": 1, "OXI": 1, "PAL": 1, "PIS": 1, "PLAT": 2, "PLE": 1, "PRI": 1, "REF": 3, "ROT": 3, "SEN": 2, "SIC": 1, "SOL": 4, "TAB": 3, "TAL": 3, "TALE": 3, "TEO": 1, "TORI": 1};

// Marcas sugeridas en el desplegable (siempre queda "Otro" para escribir una nueva).
const HERR_MARCAS_CATALOGO = ["ASAKI", "BAHCO", "BIASSONI", "BLACK JACK", "BLACK PANTHER", "BOSCH", "BREMEN", "BTA TOOLS", "BULIT", "CONER", "COVIAT", "DEWALT", "DIAMON BRAND", "DONG CHENG", "DORF", "EFAC", "EINHELL", "EL ROBLE", "EVEL", "GERARDI", "GLADIATOR", "GRUNDFOS", "HAMILTON", "HONDA", "HUSQVARNA", "KONA", "LUSQTOFF", "MACROLED", "METABO", "NIWA", "REIN", "SALKOR", "SANTA JUANA", "SENSEI", "SKILL", "STANLEY", "STIHL", "TAMIG", "TOTAL", "TOTH", "TOYAMA", "TRAMONTINA", "UYUSTOOLS", "VANDIUM", "VULCANO", "WACKER"];

// Tipos de herramienta manual (familia HER) con sus medidas conocidas. Derivados del DETALLE del Excel
// quitando marca y medida: revisá/unificá a mano (ej. "Maza" y "Masa"). Los tipos que cargues
// desde el formulario se suman solos a los desplegables.
const HERR_TIPOS_MANUALES = {
  "Alargador metros": ["31"],
  "Alicate": [],
  "Apisodor manual metalico": [],
  "Arco de sierra": ["300 MM", "CON HOJA DE SIERRA"],
  "Azada mango de madera": [],
  "Barreta de hierro torsionado": ["2 30 MTS", "2 MTS"],
  "Barreta de hierro torsionado metro": ["1"],
  "Barreta sacaclavos": ["48 CM", "58 CM", "61 CM", "79 CM"],
  "Buscapolo": ["190 MM", "AC 100 - 500 V"],
  "Buscapolo 3x140": ["AC 100 - 500 V", "MM"],
  "Buscapolo pvc": ["418"],
  "Caballete trípode mecánico": ["2 TN"],
  "Calibre metálico essex": ["7\""],
  "Cinta métrica": ["10 M", "10 MTS", "5 M", "5 MTS"],
  "Cinta métrica evelt": ["10 M", "5 MTS"],
  "Cinta métrica flexo": ["10 M", "FLG1025"],
  "Cinta métrica giant": ["10 M"],
  "Cinta métrica premium japan": ["5 M"],
  "Corta fierro": [],
  "Cortadora de ceramico": [],
  "Cuchara albañil": ["N°7", "N°8"],
  "Cucharin albañil": ["5\"", "6\""],
  "Destornillador electricista philips": ["140 MM", "65 MM", "90 MM", "92 MM"],
  "Destornillador electricista punta plana": ["100 MM", "140 MM", "150 MM"],
  "Destornillador perillero": ["THT26PH2038"],
  "Destornillador philips": ["150 MM"],
  "Destornillador philips chico": [],
  "Destornillador philips deg604 ph3x6\"": [],
  "Destornillador philips grande": [],
  "Destornillador philips mediana": [],
  "Destornillador philips mediano": [],
  "Destornillador philips pretul": [],
  "Destornillador plano": [],
  "Destornillador plano chico": [],
  "Destornillador plano deg604 x6\"": ["8 MM"],
  "Destornillador plano grande": [],
  "Destornillador plano mediano": [],
  "Destornillador plano perillero": [],
  "Destornillador plano y philips": [],
  "Destornillador punta plana": ["100 MM", "150 MM", "95 MM"],
  "Destornillador punta plana chica": [],
  "Destornillador punta plana grande": [],
  "Destornillador punta plana mediana": [],
  "Escuadra metálica": ["30 CM"],
  "Escuadra metálica truper": ["30 CM"],
  "Espátula": ["75 MM"],
  "Espátula albañil de acero mango plástico": ["2\""],
  "Espátula chica": [],
  "Espátula dentada mango de madera": ["110 MM", "135 MM", "180 MM", "185 MM"],
  "Espátula enduir cabo de madera": ["120"],
  "Espátula enduir cabo plástico": ["100"],
  "Espátula esquinera externa acero inoxidable": [],
  "Espátula esquinero mango de goma": ["150 MM"],
  "Espátula grande": [],
  "Espátula mango de madera": ["100 MM", "125 MM", "145 MM", "195 MM", "210 MM", "95 MM"],
  "Espátula mediana": [],
  "Espátula para unión con punta philips acero inoxidable": ["N°6 N°2"],
  "Fratacho de goma espuma": ["12 x 20 CM", "12 x 25 CM"],
  "Fratacho de madera de pino": ["11 x 25 CM", "12 x 30 CM", "12 x 35 CM", "7 x 18 5 CM"],
  "Grifa larga mango metalico": [],
  "Grinfas": ["10 MM", "12 MM", "8 MM"],
  "Guia p/ mecha copa nº22 jadever": [],
  "Hacha de mano": [],
  "Hachuela albañil": [],
  "Juego de destornillador": ["PHILIPS 4, PUNTA PLANA 2 (3X75, 4X100, 6,5X150, PH2X100, PH1X80, PH0X60)"],
  "Juego de llave allen bison piezas": ["10"],
  "Juego de llave allen estriada ingco piezas": ["9"],
  "Juego de llave allen estriada piezas": ["8", "FALTA UNA LLAVE"],
  "Juego de llave allen inco piezas": ["10", "9"],
  "Juego de llave allen piezas": ["9"],
  "Juego de llave tork": ["9 PIEZAS"],
  "Juego de llave tork inco piezas": ["9"],
  "Juego de llave tork piezas": ["4 PIEZAS", "8", "9"],
  "Juego de llave tubo - piezas": ["38"],
  "Juego de sondas milimetricas": [],
  "Juego llave allen piezas ingco": ["X 9"],
  "Lima plana threefiles grande": [],
  "Lima redonda grande": [],
  "Lima redonda plena grande": [],
  "Lima threefiles grande": [],
  "Lima triangular grande": [],
  "Linterna de mano seis av5813": ["SEIS AV5813 NARANJA C/2 BATERIAS"],
  "Llana dentada mango de plástico": ["13 x 25 CM"],
  "Llana lisa acero inoxidable": ["280 x 130 MM"],
  "Llana lisa mango de madera": ["12 x 25 CM", "12 x 30 CM"],
  "Llana lisa mango de plástico": ["12 x 25CM", "12 x 30 CM", "13 x 30 CM"],
  "Llave acodada doble boca": ["6\"", "SET DE LLAVE ACODADA DOBLE BOCA THT102486"],
  "Llave acodada doble boca tht102486": ["10\"", "12\"", "15\"", "17\"", "19\"", "22\"", "8\""],
  "Llave allen croos master": ["9942978 3/8 x 112 MM"],
  "Llave boca y ojo": ["10", "18", "8", "N°1 1/4", "N°10", "N°11", "N°12", "N°13", "N°15", "N°16", "N°17", "N°18", "N°19", "N°20", "N°21", "N°22", "N°24", "N°25", "N°29", "N°32", "N°7", "N°8"],
  "Llave boca y ojo crossmaster": ["N°22"],
  "Llave boca y ojo drop borged": ["11"],
  "Llave boca y ojo eastman": ["13"],
  "Llave boca y ojo master": ["N° 6", "N°14", "N°17", "N°22"],
  "Llave boca y ojo pegasus": ["12"],
  "Llave boca y ojo yeii": ["N° 14"],
  "Llave boca y ojo zhonggong": ["9"],
  "Llave combinada boca y ojo": ["N°18"],
  "Llave combinada boca y ojo - drop forged": ["N°21"],
  "Llave combinada boca y ojo - zhonggong": ["N°19"],
  "Llave criquet": [],
  "Llave filtros de aceite hogar": ["APERTURA MÍNIMA DE ANILLO 5CM, APERTURA MÁXIMA DE ANILLO 13 CM, DIAMETRO DEL PERNO 12 MM, LONGITUD TOTAL DEL PERNO 14 CM , LOGITUD TOTAL 48 MM"],
  "Llave francesa": ["10\"", "12\" 300 MM", "15\" 375 MM", "18\" 50 MM"],
  "Llave francesa crossmaster": ["10\" 250 MM"],
  "Llave francesa extra": ["15\""],
  "Llave stilson grande": [],
  "Llave stilson kamasa": ["10\""],
  "Llave t": ["N°10", "N°12"],
  "Llave tubo": ["1\"", "10 MM", "15", "17", "19", "20", "21", "24", "28", "30", "32", "7/8"],
  "Llave tubo allen hamilton": ["5", "8 MM"],
  "Llave tubo ccc": ["10"],
  "Llave tubo crosman": ["18 MM"],
  "Llave tubo cross master": ["17 MM"],
  "Llave tubo cuerpo largo cross master": ["13 MM"],
  "Llave tubo extension corta hamilton": ["13 MM 1/2 \""],
  "Llave tubo extension flexible corta": ["1/2\""],
  "Llave tubo hamilton": ["8"],
  "Llave tubo irimo": [],
  "Llave tubo sx": ["1/2 \""],
  "Llave tubo tork t-40": ["4 MM"],
  "Llave tubo vanadium": ["11", "11 MM", "13 MM", "14 MM", "15 MM", "16 MM", "17 MM", "19 MM", "24 MM"],
  "Machete ciriari": [],
  "Mango de fuerza de largo": ["1/2\""],
  "Marcador de polvo profesional": ["30 M", "CHOCLA"],
  "Martillo carpintero": [],
  "Martillo carpintero con mango metálico": [],
  "Martillo de goma": [],
  "Masa mango de madera": [],
  "Maza": ["1 5 KG", "2 KG", "3 KG", "CON MANGO DE MADERA"],
  "Maza de goma panther bp-mg120z": ["340 GR"],
  "Mecha copa nº22 jadever": [],
  "Minisierra arco": [],
  "Multimétro digital dt-830b": [],
  "Nivel de mano": ["18\" 450 MM", "20\" 500 MM", "400 MM 16\""],
  "Nivel de mano de madera s/identificación": [],
  "Nivel de mano fmt": ["900 MM"],
  "Pala cuadrada con mango de madera": [],
  "Pala pocera mango metalico": [],
  "Pala pocera sin mango": [],
  "Pala punta corazon mango de madera": [],
  "Pala punta corazon sin mango": [],
  "Pala punta cuadrada mango de madera": [],
  "Pala punta cuadrada mango metálico": [],
  "Pala punta cuadrada sin mango": [],
  "Pico mango de madera": [],
  "Pico para inflar": [],
  "Pico sin mango": [],
  "Pico sin mango paleta fina": [],
  "Pinza de fuerza perro": [],
  "Pinza de punta": [],
  "Pinza picoloro boca curva": ["10\""],
  "Pinza picoloro boca curva chrome vanadium": ["10\""],
  "Pinza saca seguro curva": [],
  "Pinza saca seguro curva grande": [],
  "Pinza saca seguro recta": [],
  "Pinza universal": [],
  "Pistola de silicona makawa": ["15 W"],
  "Pistola para silicona": [],
  "Pistola para silicona abrasol": [],
  "Plato mezclador durklero de aluminio": ["300 x 300 x 1 8 MM", "BANDEJA DURKLERA"],
  "Plomada": [],
  "Plomada de albañil": ["500 GR"],
  "Prensa para caño": [],
  "Prensa sargento tipo experto": ["G"],
  "Prensa sargento tipo f": ["50 x 150 MM"],
  "Prolongador para trifásico": ["10 MTS", "30 MTS"],
  "Pulverizador mochila": ["20L"],
  "Regla de esquina metálica": [],
  "Remachadora manual": ["10,5\""],
  "Remachadora pop makawa": [],
  "Saca bujias": [],
  "Saca filtro a cadena": [],
  "Saca filtro de cinta chico": [],
  "Saca filtro de cinta grande": [],
  "Soldadora de estaño": [],
  "Soldadora de estaño ferrawy": ["60 W"],
  "Tarraja de mano tipo destronillador": [],
  "Tenaza": ["200 MM 8\"", "250 MM 10 \"", "250 MM 10\"", "300 MM", "300 MM 12 \"", "41054 010"],
  "Tenaza alemania": ["250 MM 10\""],
  "Tenaza gherardi": ["300 MM 12 \""],
  "Tijera aviación corta chapa mota": ["300 MM", "CORTE RECTO Y CURVO"],
  "Tijera hojalatera": ["250 MM", "300 MM", "CORTE RECTO"],
  "Trazador de líneas": ["CHOCLA"]
};

// ============================================================
// H.2 ESTADOS, COLUMNAS Y TEXTOS FIJOS
// ============================================================
// Estados tomados del Excel (hoja principal + REF.). "disponible" = puede salir del depósito.
const HERR_ESTADOS = {
  'APTO':                   { disponible: true,  baja: false },
  'APTO CON OBSERVACIONES': { disponible: true,  baja: false },
  'NO APTO':                { disponible: false, baja: false },  // pendiente de reparación
  'VENCIDO':                { disponible: false, baja: false },  // 1 caso en el Excel (cilindro de oxígeno)
  'DADO DE BAJA':           { disponible: false, baja: true  }   // final: no cuenta en el total
};
const HERR_ESTADO_ALTA = 'APTO';                 // estado con el que entra una unidad nueva
const HERR_ESTADOS_ALTA = ['APTO', 'APTO CON OBSERVACIONES', 'NO APTO'];  // estados permitidos al dar de alta
const HERR_ESTADOS_DEVOLUCION = ['APTO', 'NO APTO'];
const HERR_LUGAR_DEPOSITO = 'DEPÓSITO';          // valor de LUGAR / PERSONA cuando está en depósito
const HERR_PREFIJO_PODER  = 'A CARGO DE ';       // mismo formato que ya usa el Excel ("A CARGO DE JOSÉ CANO")

// Hoja "Unidades Herramientas": 16 columnas del Excel (mismo orden) + 5 nuevas al final.
const HERR_COLS_UNIDADES = [
  'FECHA DE ALTA', 'SIGLA', 'NUM.', 'CODIGO', 'DETALLE', 'CARACTERISTICAS', 'MARCA', 'MODELO', 'N° SERIE',
  'NUEVO / USADO', 'CODIGO ANTERIOR', 'CRÍTICO?', 'ESTADO', 'FECHA DE INICIO DE MTO PREV.', 'LUGAR / PERSONA', 'OBSERVACIONES',
  'TIPO', 'UBIC. DEPÓSITO', 'UBIC. ESTANTE', 'UBIC. COLUMNA', 'UBIC. FILA'
];
const HERR_U = {
  FECHA: 0, SIGLA: 1, NUM: 2, CODIGO: 3, DETALLE: 4, CARACT: 5, MARCA: 6, MODELO: 7, SERIE: 8,
  NUEVO: 9, CODANT: 10, CRITICO: 11, ESTADO: 12, MTO: 13, LUGAR: 14, OBS: 15,
  TIPO: 16, UB_DEP: 17, UB_EST: 18, UB_COL: 19, UB_FIL: 20, TOTAL: 21
};
const HERR_COLS_MOVS = [
  'ID Mov.', 'Fecha', 'Tipo', 'Responsable', 'Obra / destino', 'Familia', 'Tipo herramienta', 'Medida',
  'Cantidad', 'Códigos', 'Estado devolución', 'Depósito', 'Estante', 'Columna', 'Fila', 'Obs. generales'
];
const HERR_COLS_STOCK = [
  'Familia', 'Tipo', 'Medida', 'Modo', 'Total (sin bajas)', 'En depósito', 'En poder (total)',
  'En poder de', 'No disponibles', 'Bajas'
];

// ============================================================
// H.3 UTILIDADES (todas con prefijo herr_)
// ============================================================
function herr_modo(sigla) {
  return HERR_FAMILIAS_MANUALES.indexOf(sigla) !== -1 ? 'HERRAMIENTA' : 'EQUIPO';
}
function herr_norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}
function herr_nombreFamilia(sigla) { return HERR_NOMBRES_FAMILIA[sigla] || sigla; }
function herr_medidaTxt(m) {
  return String(m || '').replace(/(\d)\s*(MM|CM|KG|MTS|GR)\b/g, (x, n, u) => n + ' ' + u.toLowerCase());
}
function herr_poder(lugar) {
  const l = String(lugar || '').trim().toUpperCase();
  const m = l.match(/^A CARGO(?: DE)?\s+(.+)$/);
  return m ? m[1].trim() : '';
}
function herr_infoEstado(e) {
  return HERR_ESTADOS[String(e || '').trim().toUpperCase()] || { disponible: false, baja: false };
}
function herr_abrirSS() { return SpreadsheetApp.openById(HERR_SS_ID); }

// Lee REF Herramientas y suma/pisa siglas en las constantes (la lista hardcodeada queda como base)
function herr_cargarRef(ss) {
  const hoja = ss.getSheetByName(HERR_HOJA_REF);
  if (!hoja || hoja.getLastRow() < 2) return;
  hoja.getRange(2, 1, hoja.getLastRow() - 1, 3).getValues().forEach(r => {
    const sigla  = String(r[0] || '').trim().toUpperCase();
    const nombre = String(r[1] || '').trim();
    const modo   = String(r[2] || '').trim().toUpperCase();
    if (!sigla || !nombre) return;
    HERR_NOMBRES_FAMILIA[sigla] = nombre;
    const i = HERR_FAMILIAS_MANUALES.indexOf(sigla);
    if (modo === 'HERRAMIENTA' && i === -1) HERR_FAMILIAS_MANUALES.push(sigla);
    if (modo === 'EQUIPO' && i !== -1) HERR_FAMILIAS_MANUALES.splice(i, 1);
  });
}

// EJECUTAR UNA SOLA VEZ desde el editor: crea REF Herramientas con la lista actual
function herr_sembrarRef() {
  const ss = herr_abrirSS();
  const h = ss.getSheetByName(HERR_HOJA_REF) || ss.insertSheet(HERR_HOJA_REF);
  if (h.getLastRow() > 0) { Logger.log('REF Herramientas ya tiene datos: no se pisa.'); return; }
  h.getRange(1, 1, 1, HERR_COLS_REF.length).setValues([HERR_COLS_REF])
    .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
  h.setFrozenRows(1);
  const sig = Object.keys(HERR_NOMBRES_FAMILIA).map(s => [s, HERR_NOMBRES_FAMILIA[s], herr_modo(s)]);
  h.getRange(2, 1, sig.length, 3).setValues(sig);
  h.getRange(2, 4, 4, 2).setValues([
    ['APTO', 'DISPONIBLE PARA EL USO'],
    ['APTO CON OBSERVACIONES', 'DISPONIBLE PARA EL USO, CON OBSERVACIONES QUE NO AFECTAN LA SEGURIDAD DEL OPERADOR'],
    ['NO APTO', 'EQUIPO EN PROCESO DE REPARACIÓN'],
    ['DADO DE BAJA', 'CON SOLICITUD DE BAJA']
  ]);
  h.getRange(2, 6, 4, 2).setValues([[30, 'Mensual'], [90, 'Trimestral'], [120, 'Semestral'], [360, 'Anual']]);
  [90, 280, 110, 190, 320, 130, 110].forEach((w, i) => h.setColumnWidth(i + 1, w));
}

function herr_leerUnidades(hoja) {
  const ult = hoja.getLastRow();
  if (ult <= 1) return [];
  return hoja.getRange(2, 1, ult - 1, HERR_U.TOTAL).getValues();
}

function herr_filaAObjeto(r) {
  const estado = String(r[HERR_U.ESTADO] || '').trim().toUpperCase();
  const lugar  = String(r[HERR_U.LUGAR] || '').trim();
  const info   = herr_infoEstado(estado);
  const sigla  = String(r[HERR_U.SIGLA] || '').trim().toUpperCase();
  return {
    codigo:  String(r[HERR_U.CODIGO] || '').trim().toUpperCase(),
    sigla:   sigla,
    detalle: String(r[HERR_U.DETALLE] || ''),
    medida:  String(r[HERR_U.CARACT] || ''),
    marca:   String(r[HERR_U.MARCA] || ''),
    modelo:  String(r[HERR_U.MODELO] || ''),
    serie:   String(r[HERR_U.SERIE] || ''),
    estado:  estado,
    lugar:   lugar,
    poder:   herr_poder(lugar),
    tipo:    String(r[HERR_U.TIPO] || '') || String(r[HERR_U.DETALLE] || ''),
    ub: {
      deposito: String(r[HERR_U.UB_DEP] || ''), estante: String(r[HERR_U.UB_EST] || ''),
      columna:  String(r[HERR_U.UB_COL] || ''), fila:    String(r[HERR_U.UB_FIL] || '')
    },
    disp: info.disponible,
    baja: info.baja
  };
}

// Stock por TIPO (la marca no suma). Herramientas manuales: tipo + medida. Equipos: un renglón por familia.
function herr_calcularStock(objs) {
  const mapa = {};
  objs.forEach(u => {
    const modo = herr_modo(u.sigla);
    const medida = modo === 'HERRAMIENTA' ? u.medida : '';
    const k = u.sigla + '|' + u.tipo + '|' + medida;
    if (!mapa[k]) mapa[k] = {
      sigla: u.sigla, familia: herr_nombreFamilia(u.sigla), tipo: u.tipo, medida: medida, modo: modo,
      total: 0, deposito: 0, poder: 0, poderDetalle: {}, nodisp: 0, bajas: 0
    };
    const s = mapa[k];
    if (u.baja) { s.bajas++; return; }
    s.total++;
    if (u.poder) { s.poder++; s.poderDetalle[u.poder] = (s.poderDetalle[u.poder] || 0) + 1; }
    else if (u.disp) s.deposito++;
    else s.nodisp++;
  });
  return Object.keys(mapa).map(k => mapa[k]).sort((a, b) =>
    (a.familia + a.tipo + a.medida).localeCompare(b.familia + b.tipo + b.medida));
}

function herr_escribirStock(ss, objs) {
  let hoja = ss.getSheetByName(HERR_HOJA_STOCK);
  if (!hoja) return;
  const filas = herr_calcularStock(objs).map(s => [
    s.familia, s.tipo, s.medida, s.modo, s.total, s.deposito, s.poder,
    Object.keys(s.poderDetalle).map(n => n + ': ' + s.poderDetalle[n]).join(' | '),
    s.nodisp, s.bajas
  ]);
  const maxF = hoja.getMaxRows();
  if (maxF > 1) hoja.getRange(2, 1, maxF - 1, HERR_COLS_STOCK.length).clearContent();
  if (filas.length) hoja.getRange(2, 1, filas.length, HERR_COLS_STOCK.length).setValues(filas);
}

function herr_catalogo() {
  return {
    familias: Object.keys(HERR_NOMBRES_FAMILIA).map(s => ({ s: s, n: HERR_NOMBRES_FAMILIA[s], modo: herr_modo(s) })),
    manuales: HERR_TIPOS_MANUALES,
    marcas: HERR_MARCAS_CATALOGO,
    estadosDevolucion: HERR_ESTADOS_DEVOLUCION,
    estadosAlta: HERR_ESTADOS_ALTA
  };
}

// Respeta mayúsculas/acentos de un tipo ya existente (en unidades o en el catálogo).
function herr_canonTipo(sigla, tipoTxt, objs) {
  if (herr_modo(sigla) === 'EQUIPO') return herr_nombreFamilia(sigla);
  const n = herr_norm(tipoTxt);
  for (let i = 0; i < objs.length; i++) {
    if (objs[i].sigla === sigla && herr_norm(objs[i].tipo) === n) return objs[i].tipo;
  }
  const keys = Object.keys(HERR_TIPOS_MANUALES);
  for (let j = 0; j < keys.length; j++) { if (herr_norm(keys[j]) === n) return keys[j]; }
  return String(tipoTxt).trim();
}

function herr_generarIdMov(hojaM, prefijo) {
  const ult = hojaM.getLastRow();
  let max = 0;
  if (ult > 1) {
    hojaM.getRange(2, 1, ult - 1, 1).getValues().forEach(([id]) => {
      const s = String(id || '');
      if (s.indexOf(prefijo + '-') === 0) {
        const n = parseInt(s.replace(prefijo + '-', ''), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
  }
  return prefijo + '-' + String(max + 1).padStart(3, '0');
}

// ============================================================
// H.4 ENDPOINT GET: action=herr-datos
// ============================================================
function herr_doGet(params) {
  try {
    const ss = herr_abrirSS();
    herr_cargarRef(ss);
    const hojaU = ss.getSheetByName(HERR_HOJA_UNIDADES);
    if (!hojaU) return jsonResp({ ok: false, error: 'Falta la hoja "' + HERR_HOJA_UNIDADES + '". Ejecutá herr_prepararHojas() una vez.' });
    const unidades = herr_leerUnidades(hojaU).filter(r => String(r[HERR_U.CODIGO] || '').trim() !== '').map(herr_filaAObjeto);
    return jsonResp({ ok: true, catalogo: herr_catalogo(), unidades: unidades, stock: herr_calcularStock(unidades) });
  } catch (err) {
    Logger.log('ERROR herr_doGet: ' + err.message);
    return jsonResp({ ok: false, error: err.message });
  }
}

// ============================================================
// H.5 ENDPOINT POST: accion=herr-movimiento
// ============================================================
// Se ejecuta dentro del LockService que ya toma doPost: la asignación de códigos consecutivos no puede duplicarse.
// Todo se valida en memoria primero; si hay un solo error NO se escribe nada.
function herr_procesarMovimiento(data, ss) {
  const hojaU = ss.getSheetByName(HERR_HOJA_UNIDADES);
  const hojaM = ss.getSheetByName(HERR_HOJA_MOVS);
  const hojaR = ss.getSheetByName(HERR_HOJA_REF);
  if (!hojaU || !hojaM || !hojaR) return jsonResp({ ok: false, error: 'Faltan hojas de herramientas. Ejecutá herr_prepararHojas() y herr_sembrarRef() una vez.' });
  herr_cargarRef(ss);
  const refNuevas = [];   // siglas nuevas a agregar a REF si todo valida

  let tipo = String(data.tipo_movimiento || '').trim().toUpperCase();
  if (tipo === 'DEVOLUCION') tipo = 'DEVOLUCIÓN';
  if (['ENTRADA', 'SALIDA', 'DEVOLUCIÓN'].indexOf(tipo) === -1) return jsonResp({ ok: false, error: 'Tipo de movimiento inválido.' });

  const responsable = String(data.responsable || '').trim().toUpperCase();
  const obra = String(data.obra || '').trim();
  const items = data.items || [];
  const errs = [];
  if (!responsable) errs.push('Falta el responsable.');
  if (!obra) errs.push('Falta la obra o destino.');
  if (!items.length) errs.push('No hay productos para registrar.');

  const filas = herr_leerUnidades(hojaU);
  const nuevas = [];
  const objs = () => filas.concat(nuevas).map(herr_filaAObjeto);
  const idxCodigo = {};
  filas.forEach((r, i) => { idxCodigo[String(r[HERR_U.CODIGO]).trim().toUpperCase()] = i; });
  const usados = {};
  filas.forEach(r => { usados[String(r[HERR_U.CODIGO]).trim().toUpperCase()] = true; });

  // máximo numérico por sigla = máx(hoja, Excel original); se actualiza al asignar
  const maxSig = {};
  function maxDe(sigla) {
    if (maxSig[sigla] === undefined) {
      let m = 0;
      filas.concat(nuevas).forEach(r => {
        const mt = String(r[HERR_U.CODIGO] || '').trim().toUpperCase().match(/^([A-Z]+)\s*-\s*(\d+)$/);
        if (mt && mt[1] === sigla) m = Math.max(m, parseInt(mt[2], 10));
      });
      maxSig[sigla] = m;
    }
    return maxSig[sigla];
  }

  const regs = {};   // movimientos agrupados por familia|tipo|medida
  function registrar(sigla, tipoU, medida, codigo, estado, ub) {
    const k = sigla + '|' + tipoU + '|' + medida;
    if (!regs[k]) regs[k] = { sigla: sigla, tipo: tipoU, medida: medida, codigos: [], estados: [], ub: ub || {} };
    regs[k].codigos.push(codigo);
    if (estado) regs[k].estados.push(codigo + ':' + estado);
  }

  const ahora = new Date();
  const asignados = [];
  let modificoExistentes = false;

  items.forEach((it, n) => {
    const rot = 'Ítem ' + (n + 1) + ': ';

    // ---------------- ENTRADA ----------------
    if (tipo === 'ENTRADA') {
      const fn = it.familia_nueva;
      if (fn && fn.sigla) {
        const sg = String(fn.sigla).trim().toUpperCase();
        const nm = String(fn.nombre || '').trim().toUpperCase();
        const md = String(fn.modo || '').trim().toUpperCase();
        const yaNueva = refNuevas.some(x => x[0] === sg);
        if (!/^[A-Z]{2,5}$/.test(sg)) { errs.push(rot + 'la sigla nueva debe tener de 2 a 5 letras.'); return; }
        if (!nm) { errs.push(rot + 'falta el nombre de la familia nueva.'); return; }
        if (['EQUIPO', 'HERRAMIENTA'].indexOf(md) === -1) { errs.push(rot + 'el modo de la familia nueva es inválido.'); return; }
        if (HERR_NOMBRES_FAMILIA[sg] && !yaNueva) { errs.push(rot + 'la sigla ' + sg + ' ya existe en REF.'); return; }
        if (!yaNueva) {
          HERR_NOMBRES_FAMILIA[sg] = nm;
          if (md === 'HERRAMIENTA') HERR_FAMILIAS_MANUALES.push(sg);
          refNuevas.push([sg, nm, md]);
        }
      }
      const sigla = String(it.sigla || '').trim().toUpperCase();
      if (!HERR_NOMBRES_FAMILIA[sigla]) { errs.push(rot + 'familia desconocida (' + sigla + ').'); return; }
      const cant = parseInt(it.cantidad, 10);
      if (!(cant >= 1 && cant <= 200)) { errs.push(rot + 'cantidad inválida.'); return; }
      const lugarSel = String(it.lugar || '').trim().toUpperCase();
      let lugarTxt = '', ub = {};
      if (lugarSel === 'A CARGO') {
        const persona = String(it.persona || '').trim().toUpperCase();
        if (!persona) { errs.push(rot + 'falta el nombre de la persona a cargo.'); return; }
        lugarTxt = HERR_PREFIJO_PODER + persona;
      } else if (herr_norm(lugarSel).indexOf('DEPOSITO') === 0) {
        lugarTxt = lugarSel;
        const u0 = it.ubic || {};
        ub = { deposito: u0.deposito || '', estante: u0.estante || '', columna: u0.columna || '', fila: u0.fila || '' };
      } else { errs.push(rot + 'falta indicar dónde queda (depósito o a cargo de).'); return; }
      const tipoU = herr_canonTipo(sigla, it.tipo, objs());
      if (!tipoU) { errs.push(rot + 'falta el tipo.'); return; }
      const modo = herr_modo(sigla);
      const medida = String(it.medida || '').trim().toUpperCase();
      const detalle = String(it.detalle || '').trim() || (tipoU + (medida ? ' ' + herr_medidaTxt(medida) : ''));
      const marca = String(it.marca || '').trim().toUpperCase();
      const modelo = String(it.modelo || '').trim().toUpperCase();
      const series = it.series || [];
      const manuales = it.codigos || [];
      if (!it.auto && manuales.length !== cant) { errs.push(rot + 'faltan códigos manuales (' + manuales.length + ' de ' + cant + ').'); return; }
      const nuevoUsado = String(it.nuevo_usado || '').trim().toUpperCase();
      if (['NUEVO', 'USADO'].indexOf(nuevoUsado) === -1) { errs.push(rot + 'falta indicar si es NUEVO o USADO.'); return; }
      const estadoAlta = String(it.estado || HERR_ESTADO_ALTA).trim().toUpperCase();
      if (HERR_ESTADOS_ALTA.indexOf(estadoAlta) === -1) { errs.push(rot + 'estado inválido (' + estadoAlta + ').'); return; }
      const critico = String(it.critico || 'NO').trim().toUpperCase() === 'SI' ? 'SI' : 'NO';
      const fechaMto = it.fecha_mto ? new Date(it.fecha_mto + 'T00:00:00') : '';
      const codAnt = it.cod_anterior || [];
      const obsItem = (String(it.obs || '').trim() || String(data.observaciones || '').trim()).toUpperCase();

      for (let i = 0; i < cant; i++) {
        let codigo, num;
        if (it.auto) {
          num = maxDe(sigla) + 1;
          codigo = sigla + '-' + String(num).padStart(3, '0');
        } else {
          codigo = String(manuales[i] || '').trim().toUpperCase();
          const mt = codigo.match(/^([A-Z]+)-(\d+)$/);
          if (!mt || mt[1] !== sigla) { errs.push(rot + 'el código "' + codigo + '" debe tener el formato ' + sigla + '-123.'); continue; }
          num = parseInt(mt[2], 10);
        }
        if (usados[codigo]) { errs.push(rot + 'el código ' + codigo + ' ya existe (o está repetido en este envío).'); continue; }
        usados[codigo] = true;
        maxSig[sigla] = Math.max(maxDe(sigla), num);
        const fila = new Array(HERR_U.TOTAL).fill('');
        fila[HERR_U.FECHA] = ahora;
        fila[HERR_U.SIGLA] = sigla;
        fila[HERR_U.NUM] = String(num).padStart(3, '0');
        fila[HERR_U.CODIGO] = codigo;
        fila[HERR_U.DETALLE] = detalle;
        fila[HERR_U.CARACT] = medida;
        fila[HERR_U.MARCA] = marca;
        fila[HERR_U.MODELO] = modelo;
        fila[HERR_U.SERIE] = String(series[i] || '').trim().toUpperCase();
        fila[HERR_U.NUEVO] = nuevoUsado;
        fila[HERR_U.CODANT] = String(codAnt[i] || '').trim().toUpperCase();
        fila[HERR_U.CRITICO] = critico;
        fila[HERR_U.ESTADO] = estadoAlta;
        fila[HERR_U.MTO] = fechaMto;
        fila[HERR_U.LUGAR] = lugarTxt;
        fila[HERR_U.OBS] = obsItem;
        fila[HERR_U.TIPO] = tipoU;
        fila[HERR_U.UB_DEP] = ub.deposito; fila[HERR_U.UB_EST] = ub.estante;
        fila[HERR_U.UB_COL] = ub.columna;  fila[HERR_U.UB_FIL] = ub.fila;
        nuevas.push(fila);
        asignados.push(codigo);
        registrar(sigla, tipoU, modo === 'HERRAMIENTA' ? medida : '', codigo, '', ub);
      }
      return;
    }

    // ---------------- SALIDA ----------------
    if (tipo === 'SALIDA') {
      const codigos = it.codigos || [];
      if (!codigos.length) { errs.push(rot + 'no elegiste unidades.'); return; }
      if (it.cantidad && parseInt(it.cantidad, 10) !== codigos.length) { errs.push(rot + 'la cantidad no coincide con las unidades elegidas.'); return; }
      codigos.forEach(c => {
        const cod = String(c).trim().toUpperCase();
        const i = idxCodigo[cod];
        if (i === undefined) { errs.push(rot + cod + ' no existe en Unidades Herramientas.'); return; }
        const o = herr_filaAObjeto(filas[i]);
        if (o.poder) { errs.push(rot + cod + ' ya está en poder de ' + o.poder + '.'); return; }
        if (!o.disp) { errs.push(rot + cod + ' no está disponible (estado ' + o.estado + ').'); return; }
        filas[i][HERR_U.LUGAR] = HERR_PREFIJO_PODER + responsable;
        filas[i][HERR_U.UB_DEP] = ''; filas[i][HERR_U.UB_EST] = ''; filas[i][HERR_U.UB_COL] = ''; filas[i][HERR_U.UB_FIL] = '';
        modificoExistentes = true;
        registrar(o.sigla, o.tipo, herr_modo(o.sigla) === 'HERRAMIENTA' ? o.medida : '', cod, '', {});
      });
      return;
    }

    // ---------------- DEVOLUCIÓN ----------------
    const lugarSel = String(it.lugar || '').trim().toUpperCase();
    if (herr_norm(lugarSel).indexOf('DEPOSITO') !== 0) { errs.push(rot + 'elegí a qué depósito vuelve.'); return; }
    const ub = it.ubic || {};
    const lista = it.codigos || [];
    if (!lista.length) { errs.push(rot + 'no elegiste unidades a devolver.'); return; }
    lista.forEach(x => {
      const cod = String(x.codigo || '').trim().toUpperCase();
      const est = String(x.estado || '').trim().toUpperCase();
      const i = idxCodigo[cod];
      if (i === undefined) { errs.push(rot + cod + ' no existe en Unidades Herramientas.'); return; }
      if (HERR_ESTADOS_DEVOLUCION.indexOf(est) === -1) { errs.push(rot + cod + ': el estado de devolución debe ser ' + HERR_ESTADOS_DEVOLUCION.join(' o ') + '.'); return; }
      const o = herr_filaAObjeto(filas[i]);
      if (herr_norm(o.poder) !== herr_norm(responsable)) { errs.push(rot + cod + ' no está en poder de ' + responsable + '.'); return; }
      filas[i][HERR_U.ESTADO] = est;
      filas[i][HERR_U.LUGAR] = lugarSel;
      filas[i][HERR_U.UB_DEP] = ub.deposito; filas[i][HERR_U.UB_EST] = ub.estante;
      filas[i][HERR_U.UB_COL] = ub.columna;  filas[i][HERR_U.UB_FIL] = ub.fila;
      modificoExistentes = true;
      registrar(o.sigla, o.tipo, herr_modo(o.sigla) === 'HERRAMIENTA' ? o.medida : '', cod, est, ub);
    });
  });

  if (errs.length) return jsonResp({ ok: false, error: errs.join(' • '), errores: errs });

  // ---- Escritura (solo si todo validó) ----
  if (modificoExistentes) hojaU.getRange(2, 1, filas.length, HERR_U.TOTAL).setValues(limpiarMatrizMayusculas_(filas, false));
  if (nuevas.length) {
    const primera = hojaU.getLastRow() + 1;
    const faltan = primera + nuevas.length - 1 - hojaU.getMaxRows();
    if (faltan > 0) hojaU.insertRowsAfter(hojaU.getMaxRows(), faltan + 200);
    hojaU.getRange(primera, HERR_U.NUM + 1, nuevas.length, 1).setNumberFormat('@');
    hojaU.getRange(primera, HERR_U.CODIGO + 1, nuevas.length, 1).setNumberFormat('@');
    hojaU.getRange(primera, 1, nuevas.length, HERR_U.TOTAL).setValues(limpiarMatrizMayusculas_(nuevas, false));
  }
    if (refNuevas.length) {
    const filaRef = hojaR.getLastRow() + 1;
    hojaR.getRange(filaRef, 1, refNuevas.length, 3).setValues(limpiarMatrizMayusculas_(refNuevas, false));
  }

  const prefijo = tipo === 'ENTRADA' ? 'HING' : (tipo === 'SALIDA' ? 'HSAL' : 'HDEV');
  const idMov = herr_generarIdMov(hojaM, prefijo);
  const tz = Session.getScriptTimeZone();
  const fechaTxt = Utilities.formatDate(ahora, tz, 'dd/MM/yyyy HH:mm:ss');
  Object.keys(regs).forEach(k => {
    const r = regs[k];
    hojaM.appendRow(limpiarFilaMayusculas_([
      idMov, fechaTxt, tipo, responsable, obra, herr_nombreFamilia(r.sigla), r.tipo, r.medida,
      r.codigos.length, r.codigos.join(', '), r.estados.join(', '),
      r.ub.deposito || '', r.ub.estante || '', r.ub.columna || '', r.ub.fila || '',
      String(data.observaciones || '').trim().toUpperCase()
    ], false));
  });

  herr_escribirStock(ss, filas.concat(nuevas).map(herr_filaAObjeto));
  return jsonResp({ ok: true, id: idMov, codigos: asignados });
}

// ============================================================
// H.6 PREPARAR HOJAS (ejecutar UNA vez desde el editor)
// ============================================================
// Crea las 3 hojas nuevas con sus encabezados y VACÍAS. No toca "Movimientos" ni "Stock".
// Los datos se cargan después desde el formulario.
function herr_prepararHojas() {
  const ss = herr_abrirSS();
  const defs = [
    { nombre: HERR_HOJA_UNIDADES, cols: HERR_COLS_UNIDADES, color: '#1a1a2e',
      anchos: [100, 60, 60, 90, 300, 160, 120, 110, 110, 100, 110, 80, 130, 130, 200, 220, 220, 90, 90, 90, 80] },
    { nombre: HERR_HOJA_MOVS, cols: HERR_COLS_MOVS, color: '#1a1a2e',
      anchos: [90, 150, 100, 130, 150, 190, 260, 130, 80, 300, 220, 80, 80, 80, 60, 220] },
    { nombre: HERR_HOJA_STOCK, cols: HERR_COLS_STOCK, color: '#2563eb',
      anchos: [190, 280, 130, 110, 110, 100, 110, 260, 110, 70] }
  ];
  defs.forEach(d => {
    let h = ss.getSheetByName(d.nombre);
    if (!h) h = ss.insertSheet(d.nombre);
    if (h.getLastRow() === 0) {
      h.getRange(1, 1, 1, d.cols.length).setValues([d.cols])
        .setFontWeight('bold').setBackground(d.color).setFontColor('#ffffff');
      h.setFrozenRows(1);
      d.anchos.forEach((w, i) => h.setColumnWidth(i + 1, w));
    }
  });
  const hu = ss.getSheetByName(HERR_HOJA_UNIDADES);
  // NUM. y CODIGO como texto (para conservar "002"); fechas en dd/MM/yyyy
  hu.getRange(1, HERR_U.NUM + 1, hu.getMaxRows(), 1).setNumberFormat('@');
  hu.getRange(1, HERR_U.CODIGO + 1, hu.getMaxRows(), 1).setNumberFormat('@');
  hu.getRange(2, HERR_U.FECHA + 1, hu.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy');
  hu.getRange(2, HERR_U.MTO + 1, hu.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy');
  Logger.log('Hojas de herramientas listas (vacías). Movimientos y Stock actuales: sin tocar.');
}
// ===== FIN HERRAMIENTAS =====
// ============================================================
// 9. FIRMAS DE SALIDA (NUEVO)
// ============================================================
const CARPETA_FIRMAS_ID = '1JPHCIB-uh2LU_LfVkAw0F0bsLwN5CWfk';
const HOJA_FIRMAS = 'Firmas Salidas';
const COLS_FIRMAS = [
  'Fecha', 'N° Envío', 'ID Pedido', 'Zona', 'Responsable', 'Obra / destino',
  'Solicitante', 'Equipo', 'Quién retira', 'DNI', 'Productos', 'Obs. generales', 'Firma'
];

function guardarFirmaSalida_(data, ss, idPedido, nroEnvio, fechaMov, filasMov) {
  // 1) Guardar la imagen en Drive (carpeta privada)
  const nombre = 'firma_' + String(idPedido) + '_' + String(nroEnvio) + '_' + Date.now() + '.png';
  const blob = Utilities.newBlob(Utilities.base64Decode(String(data.firma_base64)), 'image/png', nombre);
  const archivo = DriveApp.getFolderById(CARPETA_FIRMAS_ID).createFile(blob);
  const url = archivo.getUrl();

  // 2) Crear la hoja si todavía no existe
  let hoja = ss.getSheetByName(HOJA_FIRMAS);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_FIRMAS);
    hoja.appendRow(COLS_FIRMAS);
    hoja.getRange(1, 1, 1, COLS_FIRMAS.length)
      .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    hoja.setFrozenRows(1);
    [150, 90, 90, 170, 130, 150, 150, 130, 170, 100, 380, 220, 120]
      .forEach((w, i) => hoja.setColumnWidth(i + 1, w));
    hoja.getRange(1, 10, hoja.getMaxRows(), 1).setNumberFormat('@'); // DNI como texto
  }

  // 3) Armar la fila con los datos que ya calculó el servidor (no los del celular)
  const productos = filasMov.map(f => String(f[8] || '') + ' — ' + String(f[9] || '') + ' ' + String(f[10] || '')).join(' | ').toUpperCase();
  const zona = (filasMov.length ? String(filasMov[0][5] || '') : String(data.zona || '')).toUpperCase();

  hoja.appendRow(limpiarFilaMayusculas_([
    fechaMov, nroEnvio, idPedido, zona,
    String(data.responsable || '').trim().toUpperCase(),
    String(data.obra || '').trim().toUpperCase(),
    String(data.solicitante || '').trim().toUpperCase(),
    String(data.equipo || '').trim().toUpperCase(),
    String(data.firmante || '').trim().toUpperCase(),
    '',
    productos,
    String(data.obs_general || '').trim().toUpperCase(),
    ''
  ], false));

  const fila = hoja.getLastRow();
  hoja.getRange(fila, 10).setNumberFormat('@').setValue(String(data.firmante_dni || '').trim().toUpperCase());
  hoja.getRange(fila, 13).setFormula('=HYPERLINK("' + url + '","Ver firma")');
  return url;
}

// Lista las últimas salidas firmadas (para la pantalla "Salidas firmadas")
// ============================================================
// 10. FICHA DE SALIDA PARA EL PANEL (NUEVO)
// ============================================================
// action=ficha-salida&id=SAL-001
// Devuelve TODO lo de una salida: datos, productos, quién retiró y la imagen de la firma.
// La firma se busca en "Firmas Salidas" por ID Pedido (el navegador nunca manda un ID de Drive).
function fichaSalida_doGet(params) {
  try {
    const idPedido = String(params.id || '').trim().toUpperCase();
    if (!/^SAL-\d+$/.test(idPedido)) return jsonResp({ ok: false, error: 'ID de salida inválido.' });

    const ss = herr_abrirSS();
    const tz = Session.getScriptTimeZone();
    const fmtFecha = v => (v instanceof Date) ? Utilities.formatDate(v, tz, 'dd/MM/yyyy HH:mm') : String(v || '');

    // 1) Filas de esa salida en Movimientos
    const hojaMov = ss.getSheetByName('Movimientos');
    if (!hojaMov || hojaMov.getLastRow() <= 1) return jsonResp({ ok: false, error: 'No hay movimientos.' });
    const filas = hojaMov.getRange(2, 1, hojaMov.getLastRow() - 1, DEP_COL_MOV.TOTAL).getValues()
      .filter(r => String(r[DEP_COL_MOV.ID_PEDIDO - 1] || '').trim().toUpperCase() === idPedido);
    if (!filas.length) return jsonResp({ ok: false, error: 'No se encontró la salida ' + idPedido + '.' });
    const f0 = filas[0];

    // Solicitante / equipo / servicio / km viajan juntos en "Obs. ítem": "Solicitante: X | Equipo: Y | ..."
    const obsItem = String(f0[DEP_COL_MOV.OBS_ITEM - 1] || '');
    const campo = k => {
      const m = obsItem.match(new RegExp('(?:^|\\|)\\s*' + k + ':\\s*([^|]*)'));
      return m ? m[1].trim() : '';
    };

    // 2) Firma (si existe) en "Firmas Salidas"
    let firmado = false, firmante = '', dni = '', firma_img = '', solicF = '', equipoF = '';
    const hojaF = ss.getSheetByName(HOJA_FIRMAS);
    if (hojaF && hojaF.getLastRow() > 1) {
      const n = hojaF.getLastRow() - 1;
      const vals  = hojaF.getRange(2, 1, n, COLS_FIRMAS.length).getValues();
      const forms = hojaF.getRange(2, 13, n, 1).getFormulas();
      for (let i = vals.length - 1; i >= 0; i--) {
        if (String(vals[i][2] || '').trim().toUpperCase() !== idPedido) continue;
        firmado  = true;
        solicF   = String(vals[i][6] || '');
        equipoF  = String(vals[i][7] || '');
        firmante = String(vals[i][8] || '');
        dni      = String(vals[i][9] || '');
        const m = String(forms[i][0] || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m) {
          try {
            const bytes = DriveApp.getFileById(m[1]).getBlob().getBytes();
            firma_img = 'data:image/png;base64,' + Utilities.base64Encode(bytes);
          } catch (e) { Logger.log('No se pudo leer la firma ' + m[1] + ': ' + e.message); }
        }
        break;
      }
    }

    const items = filas.map(r => ({
      familia:     String(r[DEP_COL_MOV.FAMILIA     - 1] || ''),
      marca:       String(r[DEP_COL_MOV.MARCA       - 1] || ''),
      descripcion: String(r[DEP_COL_MOV.DESCRIPCION - 1] || ''),
      cantidad:    Number(r[DEP_COL_MOV.CANTIDAD    - 1]) || 0,
      unidad:      String(r[DEP_COL_MOV.UNIDAD      - 1] || '')
    }));

    return jsonResp({ ok: true, ficha: {
      id_pedido:     idPedido,
      envio:         String(f0[DEP_COL_MOV.NRO_ENVIO   - 1] || ''),
      fecha:         fmtFecha(f0[DEP_COL_MOV.FECHA - 1]),
      zona:          String(f0[DEP_COL_MOV.ZONA        - 1] || ''),
      responsable:   String(f0[DEP_COL_MOV.RESPONSABLE - 1] || ''),
      obra:          String(f0[DEP_COL_MOV.OBRA        - 1] || ''),
      solicitante:   campo('Solicitante') || solicF,
      equipo:        campo('Equipo')      || equipoF,
      tipo_servicio: campo('Servicio'),
      km_hs:         campo('Km/Hs'),
      factura:       String(f0[DEP_COL_MOV.NRO_FACTURA - 1] || ''),
      obs_general:   String(f0[DEP_COL_MOV.OBS_GENERAL - 1] || ''),
      items:         items,
      firmado:       firmado,
      firmante:      firmante,
      dni:           dni,
      firma_img:     firma_img
    }});
  } catch (err) {
    Logger.log('ERROR fichaSalida_doGet: ' + err.message);
    return jsonResp({ ok: false, error: err.message });
  }
}
function firmas_doGet(params) {
  try {
    const ss = herr_abrirSS();
    const hoja = ss.getSheetByName(HOJA_FIRMAS);
    if (!hoja || hoja.getLastRow() <= 1) return jsonResp({ ok: true, firmas: [] });

    const limite = Math.min(Number(params.limit) || 15, 40);
    const zona = String(params.zona || '').trim().toLowerCase();
    const n = hoja.getLastRow() - 1;
    const vals  = hoja.getRange(2, 1, n, COLS_FIRMAS.length).getValues();
    const forms = hoja.getRange(2, 13, n, 1).getFormulas();
    const tz = Session.getScriptTimeZone();

    // Productos: se leen de Movimientos por ID de pedido (más seguro que partir el texto)
    const porId = {};
    const hojaMov = ss.getSheetByName('Movimientos');
    if (hojaMov && hojaMov.getLastRow() > 1) {
      const buscados = {};
      vals.forEach(r => { buscados[String(r[2])] = true; });
      hojaMov.getRange(2, 1, hojaMov.getLastRow() - 1, DEP_COL_MOV.TOTAL).getValues().forEach(r => {
        const id = String(r[DEP_COL_MOV.ID_PEDIDO - 1]);
        if (!buscados[id]) return;
        (porId[id] = porId[id] || []).push({
          descripcion: String(r[DEP_COL_MOV.DESCRIPCION - 1] || ''),
          cantidad:    Number(r[DEP_COL_MOV.CANTIDAD - 1]) || 0,
          unidad:      String(r[DEP_COL_MOV.UNIDAD - 1] || '')
        });
      });
    }

    const firmas = [];
    for (let i = vals.length - 1; i >= 0 && firmas.length < limite; i--) {
      const r = vals[i];
      if (zona && String(r[3]).trim().toLowerCase() !== zona) continue;

      // La carpeta es privada: se manda la imagen embebida (data URL) para que se vea sin loguearse en Drive
      let firma_img = '';
      const m = String(forms[i][0] || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) {
        try {
          const bytes = DriveApp.getFileById(m[1]).getBlob().getBytes();
          firma_img = 'data:image/png;base64,' + Utilities.base64Encode(bytes);
        } catch (e) { Logger.log('No se pudo leer la firma ' + m[1] + ': ' + e.message); }
      }

      firmas.push({
        fecha: (r[0] instanceof Date) ? Utilities.formatDate(r[0], tz, 'dd/MM/yyyy HH:mm') : String(r[0] || ''),
        envio: String(r[1] || ''),
        responsable: String(r[4] || ''),
        obra: String(r[5] || ''),
        solicitante: String(r[6] || ''),
        equipo: String(r[7] || ''),
        firmante: String(r[8] || ''),
        dni: String(r[9] || ''),
        items: porId[String(r[2])] || [],
        firma_img: firma_img
      });
    }
    return jsonResp({ ok: true, firmas: firmas });
  } catch (err) {
    Logger.log('ERROR firmas_doGet: ' + err.message);
    return jsonResp({ ok: false, error: err.message });
  }
}

// ============================================================
// UTILIDAD ÚNICA: pasar a MAYÚSCULAS Movimientos, Stock y Firmas Salidas
// Se ejecuta a mano desde el editor, una sola vez.
// ============================================================
function pasarTodoAMayusculas() {
  const ss = SpreadsheetApp.openById('1PWCKGAQgZfBEWPwqWppsbylLdJLxJe3I6XWrEAhBwQk');
  const hojas = ['Movimientos', 'Stock', 'Firmas Salidas', 'Movimientos Traslados', 'Stock Traslados'];
  const columnasExcluidas = { 
    'Stock': [DEP_COL_STOCK.IMAGEN],
    'Stock Traslados': [DEP_COL_STOCK.IMAGEN]
  };

  hojas.forEach(nombre => {
    const hoja = ss.getSheetByName(nombre);
    if (!hoja || hoja.getLastRow() <= 1) {
      Logger.log('Hoja omitida (no existe o está vacía): ' + nombre);
      return;
    }

    const filas = hoja.getLastRow() - 1;
    const cols  = hoja.getLastColumn();
    const rango = hoja.getRange(2, 1, filas, cols);   // sin encabezado
    const valores  = rango.getValues();
    const formulas = rango.getFormulas();
    const excluidas = columnasExcluidas[nombre] || [];
    let cambios = 0;

    for (let i = 0; i < filas; i++) {
      for (let j = 0; j < cols; j++) {
        if (formulas[i][j]) {               // es fórmula: se conserva tal cual
          valores[i][j] = formulas[i][j];
          continue;
        }
        if (excluidas.indexOf(j + 1) !== -1) continue;
        const v = valores[i][j];
        if (typeof v !== 'string' || v === '') continue;       // números y fechas no se tocan
        if (/^https?:\/\//i.test(v.trim())) continue;          // links no se tocan
        const mayus = v.toUpperCase();
        if (mayus !== v) { valores[i][j] = mayus; cambios++; }
      }
    }

    if (cambios > 0) {
      rango.setValues(valores);
    }
    Logger.log(nombre + ': ' + cambios + ' celdas pasadas a mayúsculas.');
  });

  Logger.log('Listo.');
}