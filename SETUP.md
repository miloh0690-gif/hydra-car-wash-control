# Instrucciones de Instalación - Hydra Car Wash

## Paso 1: Crear la hoja de cálculo

1. Crea un nuevo Google Sheet en Google Sheets
2. Copia el nombre: `Hydra Car Wash - Personal`
3. **Importa este archivo como plantilla o crea las pestañas manualmente**

### Pestañas requeridas:
- `Personal`
- `Asistencia`
- `Pagos_Planilla`
- `Ajustes`
- `Servicios`
- `Usuarios`
- `Config`

## Paso 2: Estructura de columnas

Cada hoja debe tener la fila 1 con los encabezados exactos:

### Personal
```
id_personal | nombre | cargo | jornal_bs | estado | fecha_ingreso | telefono | notas
```

### Asistencia
```
id_asistencia | fecha | id_personal | estado | jornada | hora_entrada | hora_salida | observacion | registrado_por
```

### Pagos_Planilla
```
id_pago | fecha | id_personal | descripcion | dias | jornal_bs | total_pagado | periodo_desde | periodo_hasta | registrado_por
```

### Ajustes
```
id_ajuste | fecha | id_personal | tipo | monto_bs | motivo | id_pago_aplicado
```

### Servicios
```
id_servicio | fecha | cliente | placa | marca | tipo_vehiculo | actividad | total_servicio_bs | id_personal
```

### Usuarios
```
usuario | nombre | rol | salt | pin_hash | activo
```

### Config
```
clave | valor
```

## Paso 3: Instalar el backend (Google Apps Script)

1. Abre el Google Sheet
2. Ve a **Extensiones > Apps Script**
3. Borra el contenido del archivo `Code.gs` que aparece
4. Copia y pega todo el contenido de `Code.gs` que viene en este proyecto
5. Guarda con nombre: `Code.gs`

## Paso 4: Crear usuarios

### Opción A: Crear admin desde el Script
1. En Apps Script, ejecuta la función `crearHojasIniciales`
2. Esto creará:
   - Todas las hojas con sus encabezados
   - Usuario admin con PIN: `1234`

### Opción B: Crear usuarios manualmente
En la hoja `Usuarios`, agrega una fila con:
```
usuario: admin
nombre: Administrador
rol: admin
salt: (dejar vacío - se genera automáticamente al crear)
pin_hash: (dejar vacío - se genera automáticamente)
activo: SI
```

**Cambiar el PIN después del primer ingreso:**
```javascript
// En Apps Script, ejecutar:
const hash = hashConSalt('NUEVO_PIN', salt);
// Actualizar en hoja Usuarios
```

## Paso 5: Publicar como Web App

1. En Apps Script: **Deploy > New deployment**
2. Tipo: **Web App**
3. Ejecutar como: **Yo**
4. Acceso: **Cualquiera con el enlace**
5. Copia la URL que te da

La URL tendrá formato:
```
https://script.google.com/macros/s/AKfycbx.../exec
```

## Paso 6: Configurar el frontend

1. Abre `index.html` en tu editor
2. Busca la línea:
```javascript
const API_URL = 'https://script.google.com/macros/s/TU_WEB_APP_ID/exec';
```
3. Reemplaza `TU_WEB_APP_ID` con tu ID real

## Paso 7: Cargar datos iniciales

### Personal (ejemplo)
| id_personal | nombre | cargo | jornal_bs | estado | fecha_ingreso |
|-------------|--------|-------|-----------|--------|---------------|
| PER-001 | Alejandro | Lavador | 100 | Activo | 01/01/2024 |
| PER-002 | Danys | Lavador | 120 | Activo | 01/01/2024 |
| PER-003 | Fabián | Lavador | 100 | Activo | 15/03/2024 |

*(Agregar los 10 operadores según corresponda)*

### Servicios (importar CSV)
1. Prepara un CSV con las columnas del documento
2. En el sistema, usar botón "Importar Servicios"

## Paso 8: Probar

1. Abre `index.html` en tu navegador
2. Inicia sesión con:
   - Usuario: `admin`
   - PIN: `1234`
3. Navega por el sistema

## Seguridad importante

- **NO compartir la URL del Web App publicado** con personas no autorizadas
- Cambiar el PIN del admin inmediatamente
- Configurar roles adicionales si es necesario (`encargado`, `admin`)

## Personalización

### Cambiar el logo
Reemplaza el placeholder en CSS con tu data URI:
```html
<div class="logo-placeholder" style="background-image: url('data:image/svg+xml;base64,....');"></div>
```

### Cambiar colores
Edita las variables CSS en `:root`:
```css
--bg: #0A0F2C;
--red: #E0243B;
/* etc. */
```

### Jornales por operador
Modifica la columna `jornal_bs` en la hoja `Personal` según cada operador.