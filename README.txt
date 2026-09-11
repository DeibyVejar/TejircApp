# QrApp Web

Versión web sencilla de QrApp para consultar el inventario y escanear productos.

## Estructura

- `index.html` — interfaz
- `style.css` — estilos
- `app.js` — lógica y lector de códigos
- `inventario.csv` — inventario proporcionado

## Importante para probarla

No abras `index.html` directamente con doble clic si quieres que cargue el CSV. Los navegadores pueden bloquear la lectura del archivo local.

### Opción rápida con Python

Desde esta carpeta:

```bash
python -m http.server 8000
```

Después abre:

```text
http://localhost:8000
```

Para probar la cámara desde un iPhone, el sitio debe estar servido mediante HTTPS (por ejemplo, GitHub Pages, Netlify o Vercel). Safari normalmente bloquea el acceso a la cámara en páginas HTTP normales.

## Actualizar inventario

Simplemente reemplaza:

```text
inventario.csv
```

por el nuevo CSV manteniendo el mismo formato de columnas.

## Columnas actuales esperadas

- nombre
- proveedor
- codigo
- precio

La búsqueda también revisa todos los campos del CSV.

## Alojamiento gratuito

Este proyecto es estático. No necesita backend ni base de datos.

Puede alojarse gratuitamente en GitHub Pages, Netlify o Vercel.

## Dependencia del escáner

El lector utiliza ZXing Browser desde un CDN. Para una primera versión sencilla no hace falta instalar nada.

Si quieres que funcione completamente offline, posteriormente se puede guardar la librería localmente.
