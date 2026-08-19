# Asistencia QR Escolar

Aplicación web progresiva (PWA) para pasar lista a los alumnos mediante
código QR desde el celular, generar credenciales y descargar reportes en PDF.

Todos los datos (alumnos y asistencias) se guardan **solo en el dispositivo**
(localStorage del navegador). No hay servidor ni base de datos externa.

## Funciones

- **Registro de alumnos**: alta con nombre, apellidos, grado, grupo y tutor.
  Asigna automáticamente un número de matrícula y genera su código QR.
  Permite descargar el listado completo en PDF.
- **Toma de asistencia**: escanea el QR del alumno con la cámara, muestra sus
  datos para compararlos contra la credencial física y registra la
  asistencia (evita duplicados el mismo día).
- **Reporte de asistencia**: genera un reporte por rango de fechas, con
  totales y descarga en PDF.
- **Crear tarjeta**: genera una credencial tipo gafete (con QR) por alumno,
  descargable en PDF tamaño credencial (CR80) lista para imprimir.
- **Menú (☰) → Reiniciar aplicación**: borra todos los datos y regresa la
  app a su estado inicial. Pide una contraseña de confirmación.

## Accesos

| Acción | Contraseña |
|---|---|
| Iniciar sesión (usuario: cualquier nombre) | `0000` |
| Reiniciar aplicación (borra todo) | `1111` |

**Importante:** cambia estas contraseñas antes de usar la app en producción.
Están definidas como constantes al inicio de `js/app.js`:

```js
const PASSWORD_LOGIN = '0000';
const PASSWORD_RESET = '1111';
```

También puedes cambiar el nombre de la escuela que aparece en los PDFs y en
la credencial ejecutando esto una vez en la consola del navegador (o
agregando un campo de configuración más adelante):

```js
DB.setSchoolName('Nombre de tu escuela');
```

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (puede ser público o privado, pero
   GitHub Pages gratuito requiere que sea público, salvo cuentas de pago).
2. Sube **todo el contenido de esta carpeta** (no la carpeta en sí, sino su
   contenido: `index.html`, `manifest.json`, `service-worker.js`, `css/`,
   `js/`, `icons/`) a la raíz del repositorio.
   - Desde la web de GitHub: botón **"Add file" → "Upload files"** y arrastra
     todo el contenido.
   - O desde tu computadora:
     ```bash
     git init
     git add .
     git commit -m "Primera versión de Asistencia QR"
     git branch -M main
     git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
     git push -u origin main
     ```
3. En el repositorio: **Settings → Pages**.
4. En "Build and deployment" → "Source" elige **"Deploy from a branch"**.
5. En "Branch" elige `main` y la carpeta `/ (root)`. Guarda.
6. Espera uno o dos minutos. GitHub te dará una URL parecida a:
   `https://TU-USUARIO.github.io/TU-REPOSITORIO/`
7. Abre esa URL **desde el navegador Chrome del celular Android**.

## Instalarla en el celular como app nativa

Una vez que abras el link de GitHub Pages desde Chrome en Android:

- Verás un botón **"Instalar aplicación en este celular"** en la pantalla de
  inicio de sesión (o la opción **"Instalar aplicación"** en el menú ☰).
- Al presionarlo, Chrome mostrará el diálogo nativo de instalación.
- También puedes instalarla manualmente desde el menú ⋮ de Chrome →
  **"Instalar aplicación"** o **"Agregar a pantalla de inicio"**.
- Una vez instalada, el ícono aparece en el cajón de aplicaciones y se abre
  en pantalla completa, sin barra de direcciones, como una app nativa.
- Gracias al *service worker*, después de la primera visita la app sigue
  funcionando **sin conexión a internet** (incluyendo el escáner de cámara,
  la generación de QR y de PDF).

> Nota técnica: el botón de instalación solo aparece si el sitio se sirve
> por HTTPS (GitHub Pages ya lo hace automáticamente) y el navegador
> soporta el evento `beforeinstallprompt` (Chrome/Edge en Android). En
> iPhone (Safari) no existe ese diálogo automático: ahí se instala desde
> **Compartir → Agregar a pantalla de inicio**.

## Permisos de cámara

Al usar por primera vez "Toma de asistencia", el navegador pedirá permiso
de cámara. Debe **aceptarse** para poder escanear los códigos QR. Si se negó
por error, se puede volver a habilitar desde el candado de la barra de
direcciones (o, ya instalada, desde Ajustes → Apps → Asistencia QR → Permisos).

## Estructura de archivos

```
asistencia-qr/
├── index.html            # Toda la interfaz (login + 4 vistas + menú)
├── manifest.json         # Metadatos de instalación de la PWA
├── service-worker.js     # Caché para funcionamiento offline
├── css/
│   └── style.css         # Estilos e identidad visual
├── js/
│   ├── db.js              # Almacenamiento local (localStorage)
│   ├── qr.js               # Generación y escaneo de códigos QR
│   ├── pdf.js               # Generación de reportes/credenciales PDF
│   └── app.js                # Lógica de la interfaz y navegación
└── icons/                 # Íconos de instalación (normal y "maskable")
```

## Librerías externas usadas (vía CDN, se cachean para uso offline)

- [`qrcode`](https://github.com/soldair/node-qrcode) — generación de códigos QR.
- [`html5-qrcode`](https://github.com/mebjas/html5-qrcode) — escaneo de QR con la cámara.
- [`jsPDF`](https://github.com/parallax/jsPDF) + [`jspdf-autotable`](https://github.com/simonbengtsson/jsPDF-AutoTable) — generación de PDFs.

## Ideas para siguientes mejoras

- Pantalla de configuración para cambiar contraseñas y nombre de la escuela
  desde la interfaz (sin tocar código).
- Exportar/importar los datos como archivo `.json` (respaldo manual).
- Fotografía del alumno en el registro (para mostrarla al escanear y en la credencial).
