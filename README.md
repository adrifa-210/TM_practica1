# Demostrador de Modelo IA - Clasificador de Imágenes

Aplicación web interactiva y minimalista en Modo Oscuro para probar el modelo de clasificación de imágenes en tiempo real ("Boli", "Gafas", "Nada").

## Memoria de las Prácticas

Puedes consultar la memoria completa de las prácticas en Google Colab a través del siguiente enlace:

**[Ver Memoria de las Prácticas en Google Colab](https://colab.research.google.com/drive/1uxp2WRErzQW16MOoomvwFtoUrx99iADQ?usp=sharing)**

---

## Características de la Web

- **Modo Webcam**: Predicción en tiempo real con botones para iniciar y detener la cámara.
- **Subir Imagen**: Clasificación de imágenes locales mediante arrastrar y soltar (*drag & drop*) o selección de archivo.
- **Umbral de Confianza Configurable**: Selección del porcentaje de confianza mínimo. Si una detección no supera el umbral, la respuesta responderá automáticamente **"Nada"**.
- **Histórico en LocalStorage**: Guardado de resultados con marca de tiempo, fuente y filtros de cumplimiento.
- **Diseño Responsivo y Modo Oscuro**: Interfaz cuidada, accesible y adaptada a cualquier dispositivo.

---

## Ejecución Local

Para probar la aplicación web, abre un servidor HTTP local desde la raíz del proyecto (para permitir la lectura de los archivos JSON del modelo):

```bash
# Opción 1: Con Python 3
python3 -m http.server 8000

# Opción 2: Con Node.js (npx serve)
npx serve .
```

Abre `http://localhost:8000` en tu navegador.
