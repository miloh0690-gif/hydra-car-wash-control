# HYDRA CAR WASH — Sistema de Control de Personal

## Estado actual (Fase 1.5 parcialmente completada)

### Archivos entregados:
```
/hydra-personal/
├── index.html  (855 líneas) - Login, navegación, personal, asistencia, planilla, admin
├── Code.gs      (615 líneas) - Backend Apps Script completo
├── SETUP.md     - Guía de instalación paso a paso
└── README.md    - Este documento
```

### Funcionalidad implementada:

| Sección | Estado | Detalles |
|---------|--------|----------|
| Login | ✅ | PIN + tokens 8h expiración + bloqueo 5 intentos |
| Personal | ✅ | Lista editable con jornales modificables desde tabla |
| Asistencia | ✅ | Marcar Presente/½ día/Falta/Permiso para el día actual |
| Dashboard | ✅ | KPIs: personal activo, total jornal |
| Planilla | ✅ | Pendientes de pago con cálculo automático |
| Pagos históricos | ✅ | Listar pagos registrados |
| Ajustes | ✅ | Crear/adelantos/descuentos/bonos |
| Logo | ✅ | Subir imagen desde login (o botón en login) |

## Instrucciones rápidas de instalación

1. **Crear Google Sheet** con hojas: `Personal`, `Asistencia`, `Pagos_Planilla`, `Ajustes`, `Servicios`, `Usuarios`, `Config`

2. **Publicar Code.gs como Web App**:
   - Ejecutar como: "Yo"
   - Acceso: "Cualquiera con el enlace"
   - Copiar la URL de deployment

3. **Editar API_URL en index.html** (línea ~440):
   ```javascript
   const API_URL = 'TU_URL_DE_DEPLOY/exec';
   ```

4. **Abrir index.html** en Chrome/Safari (no funciona en Firefox por CORS)

5. **Login**:
   - Usuario: `admin`
   - PIN: `1234` (cambiar después del primer login)

## Personalización clave

### Jornales (editables)
Los jornales son **editables desde la tabla** en la pestaña Personal. Cambia el valor en la columna "Jornal (Bs)" y se guarda automáticamente. Cada operador puede tener su propio valor.

### Logo
- Botón "Cambiar Logo" en pantalla de login
- O subir archivo directamente desde el navegador
- Se guarda en localStorage y persiste en la sesión

## API Endpoints disponibles

| Acción | Descripción |
|--------|-------------|
| `login` | Valida usuario + PIN, devuelve token |
| `logout` | Invalida token |
| `personal.listar` | Lista personal activo |
| `personal.crear` | Crear nuevo operador |
| `personal.editar` | Editar campo (jornal_bs, estado, etc.) |
| `asistencia.listar` | Asistencia de un día |
| `asistencia.guardar` | Guardar todo el día (batch) |
| `planilla.pendientes` | Calcular días x jornal sin pagar |
| `planilla.pagar` | Registrar pago (calcula total) |
| `planilla.listar` | Historial de pagos |
| `ajustes.crear` | Adelanto/descuento/bono |
| `ajustes.listar` | Listar ajustes |
| `reportes.dashboard` | Datos para gráficos |

## Próximos pasos

1. **Logo del dragón** - Subir desde la pantalla de login si lo deseas
2. **Jornales iniciales** - Configurar desde la tabla Personal
3. **Servicios** - Importar CSV cuando estén listos los datos
4. **Fase 3** - Gráficos con Chart.js

## Seguridad

✅ PIN hash + salt  
✅ Tokens con expiración (8h)  
✅ Bloqueo 5 intentos fallidos (15 min)  
✅ Validación de tokens en cada acción  
✅ Roles: admin / encargado  
✅ LockService para escrituras concurrentes  
✅ Escape de fórmulas en Sheets