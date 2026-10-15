/* ============================================================
   qr.js — generación de códigos QR (librería "qrcode") y
   escaneo por cámara (librería "html5-qrcode").
   ============================================================ */

const QR = (() => {
  const PREFIX = 'AQR'; // identifica que el QR pertenece a esta app

  function payloadFor(matricula) {
    return `${PREFIX}:${matricula}`;
  }

  function parsePayload(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (trimmed.startsWith(`${PREFIX}:`)) {
      return trimmed.slice(PREFIX.length + 1);
    }
    return null;
  }

  // Dibuja un QR dentro de un <canvas> ya existente en el DOM.
  function renderToCanvas(canvas, matricula, size = 240) {
    return new Promise((resolve, reject) => {
      if (typeof QRCode === 'undefined') {
        reject(new Error('Librería QRCode no disponible (sin conexión la primera vez).'));
        return;
      }
      QRCode.toCanvas(
        canvas,
        payloadFor(matricula),
        { width: size, margin: 1, color: { dark: '#1B2430', light: '#FFFFFF' } },
        (err) => (err ? reject(err) : resolve(canvas))
      );
    });
  }

  // Devuelve un dataURL PNG del QR (útil para insertarlo en un PDF).
  function toDataURL(matricula, size = 300) {
    return new Promise((resolve, reject) => {
      if (typeof QRCode === 'undefined') {
        reject(new Error('Librería QRCode no disponible (sin conexión la primera vez).'));
        return;
      }
      QRCode.toDataURL(
        payloadFor(matricula),
        { width: size, margin: 1, color: { dark: '#1B2430', light: '#FFFFFF' } },
        (err, url) => (err ? reject(err) : resolve(url))
      );
    });
  }

  // ---------- Escáner de cámara ----------
  // Envuelve Html5Qrcode para simplificar iniciar/detener.
  class Scanner {
    constructor(elementId) {
      this.elementId = elementId;
      this.instance = null;
      this.running = false;
    }

    async start(onDecoded, onError) {
      if (typeof Html5Qrcode === 'undefined') {
        onError && onError(new Error('Librería de escaneo no disponible (sin conexión la primera vez).'));
        return;
      }
      if (this.running) return;
      this.instance = new Html5Qrcode(this.elementId, { verbose: false });
      const config = {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
          return { width: size, height: size };
        },
        aspectRatio: 1.0
      };
      try {
        await this.instance.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            // Evita disparos repetidos mientras se procesa un resultado.
            if (this._locked) return;
            this._locked = true;
            onDecoded(decodedText);
          },
          () => {
            /* callback de "no se detectó nada en este frame": se ignora */
          }
        );
        this.running = true;
      } catch (err) {
        onError && onError(err);
      }
    }

    unlock() {
      this._locked = false;
    }

    async stop() {
      if (this.instance && this.running) {
        try {
          await this.instance.stop();
          this.instance.clear();
        } catch (e) {
          /* ignorar errores al detener */
        }
      }
      this.running = false;
      this._locked = false;
    }
  }

  return { payloadFor, parsePayload, renderToCanvas, toDataURL, Scanner };
})();
