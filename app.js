const state = {
  products: [],
  filtered: [],
  stream: null,
  scanInterval: null,
  currentPage: 1,
  pageSize: 24
};

const productsEl = document.getElementById("products");
const searchInput = document.getElementById("searchInput");
const countLabel = document.getElementById("countLabel");
const emptyEl = document.getElementById("empty");
const detailEl = document.getElementById("productDetail");
const scannerPanel = document.getElementById("scannerPanel");
const video = document.getElementById("video");
const scanStatus = document.getElementById("scanStatus");
const paginationEl = document.getElementById("paginationControls");
const csvFileInput = document.getElementById("csvFileInput");

// --- GESTIÓN DE BASE DE DATOS LOCAL CON INDEXEDDB (Sin límite de 5MB) ---
function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("QrAppDB", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("inventario")) {
        db.createObjectStore("inventario");
      }
    };
  });
}

async function guardarCSVEnDB(textoCSV) {
  try {
    const db = await abrirDB();
    const tx = db.transaction("inventario", "readwrite");
    tx.objectStore("inventario").put(textoCSV, "csv_data");
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("Error guardando en IndexedDB:", e);
  }
}

async function obtenerCSVDebutDB() {
  try {
    const db = await abrirDB();
    const tx = db.transaction("inventario", "readonly");
    const store = tx.objectStore("inventario");
    return new Promise((resolve, reject) => {
      const req = store.get("csv_data");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("Error leyendo IndexedDB:", e);
    return null;
  }
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    if (row.some(v => String(v).trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(h => h.replace(/^\uFEFF/, "").trim().toLowerCase());

  return rows.slice(1).map(values => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = (values[i] ?? "").trim());
    return obj;
  });
}

function findField(product, names) {
  const keys = Object.keys(product);
  for (const name of names) {
    const exact = keys.find(k => normalize(k) === normalize(name));
    if (exact) return product[exact];
  }
  return "";
}

function formatPrice(value) {
  if (!value) return "Sin precio";
  return value;
}

function renderProducts(list) {
  productsEl.innerHTML = "";
  detailEl.classList.add("hidden");

  const totalItems = list.length;
  const totalPages = Math.ceil(totalItems / state.pageSize) || 1;

  if (state.currentPage > totalPages) {
    state.currentPage = 1;
  }

  emptyEl.classList.toggle("hidden", totalItems !== 0);

  if (totalItems === 0) {
    countLabel.textContent = "0 productos encontrados";
    paginationEl.innerHTML = "";
    return;
  }

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  const pageItems = list.slice(start, end);

  countLabel.textContent = `Mostrando ${start + 1} - ${Math.min(end, totalItems)} de ${totalItems} productos`;

  const fragment = document.createDocumentFragment();

  pageItems.forEach(product => {
    const name = findField(product, ["nombre", "name"]) || "Producto sin nombre";
    const code = findField(product, ["codigo", "código", "code"]);
    const supplier = findField(product, ["proveedor", "supplier"]);
    const price = findField(product, ["precio", "price"]);

    const card = document.createElement("article");
    card.className = "product";
    card.innerHTML = `
      <div class="product-name">${escapeHtml(name)}</div>
      <div class="product-row"><span>Código</span><strong>${escapeHtml(code || "—")}</strong></div>
      <div class="product-row"><span>Proveedor</span><strong>${escapeHtml(supplier || "—")}</strong></div>
      <div class="price">${escapeHtml(formatPrice(price))}</div>
    `;
    card.addEventListener("click", () => showDetail(product));
    fragment.appendChild(card);
  });

  productsEl.appendChild(fragment);
  renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
  if (totalPages <= 1) {
    paginationEl.innerHTML = "";
    return;
  }

  paginationEl.innerHTML = `
    <button id="prevPage" ${state.currentPage === 1 ? "disabled" : ""}>Anterior</button>
    <span>Página ${state.currentPage} de ${totalPages}</span>
    <button id="nextPage" ${state.currentPage === totalPages ? "disabled" : ""}>Siguiente</button>
  `;

  document.getElementById("prevPage").onclick = () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderProducts(state.filtered);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  document.getElementById("nextPage").onclick = () => {
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderProducts(state.filtered);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
}

function showDetail(product) {
  const name = findField(product, ["nombre", "name"]) || "Producto sin nombre";
  const code = findField(product, ["codigo", "código", "code"]);
  const supplier = findField(product, ["proveedor", "supplier"]);
  const price = findField(product, ["precio", "price"]);

  detailEl.innerHTML = `
    <h2>${escapeHtml(name)}</h2>
    <div class="detail-row"><div class="detail-label">Código</div><div class="detail-value">${escapeHtml(code || "—")}</div></div>
    <div class="detail-row"><div class="detail-label">Proveedor</div><div class="detail-value">${escapeHtml(supplier || "—")}</div></div>
    <div class="detail-row"><div class="detail-label">Precio</div><div class="detail-value">${escapeHtml(price || "—")}</div></div>
  `;
  detailEl.classList.remove("hidden");
  detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function searchProducts() {
  const q = normalize(searchInput.value);

  if (!q) {
    state.filtered = state.products;
  } else {
    state.filtered = state.products.filter(product =>
      Object.values(product).some(value => normalize(value).includes(q))
    );
  }

  state.currentPage = 1;
  renderProducts(state.filtered);
}

function findByCode(code) {
  const clean = normalize(code);
  return state.products.find(product => {
    const productCode = findField(product, ["codigo", "código", "code"]);
    return normalize(productCode) === clean;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function processCSVText(text, saveDB = true) {
  state.products = parseCSV(text);
  state.filtered = state.products;
  state.currentPage = 1;
  renderProducts(state.products);

  if (saveDB) {
    await guardarCSVEnDB(text);
  }
}

async function loadInventory() {
  // 1. Intentar cargar desde IndexedDB (persistente y sin límite de tamaño)
  const savedCSV = await obtenerCSVDebutDB();
  if (savedCSV) {
    processCSVText(savedCSV, false);
    return;
  }

  // 2. Si no hay en DB, buscar inventario.csv local por defecto
  try {
    const response = await fetch("inventario.csv", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar inventario.csv");

    const buffer = await response.arrayBuffer();
    let text;
    try {
      text = new TextDecoder("utf-8").decode(buffer);
      if (text.includes("\uFFFD")) throw new Error();
    } catch {
      text = new TextDecoder("windows-1252").decode(buffer);
    }

    processCSVText(text, true);
  } catch (error) {
    countLabel.textContent = "Sube un archivo CSV para comenzar";
    productsEl.innerHTML = "";
    paginationEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    console.warn("Esperando carga manual de CSV.", error);
  }
}

// Subir CSV manual
csvFileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const buffer = e.target.result;
    let text;
    try {
      text = new TextDecoder("utf-8").decode(buffer);
      if (text.includes("\uFFFD")) throw new Error();
    } catch {
      text = new TextDecoder("windows-1252").decode(buffer);
    }
    
    await processCSVText(text, true);
    searchInput.value = "";
  };
  reader.readAsArrayBuffer(file);
});

// --- SISTEMA DE ESCÁNER DE CÁMARA ROBUSTO (Nativo + ZXing Fallback) ---
async function startScanner() {
  scannerPanel.classList.remove("hidden");
  scanStatus.textContent = "Solicitando acceso a la cámara...";

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = state.stream;
    await video.play();

    scanStatus.textContent = "Apunta la cámara al código de barras.";

    // Priorizar BarcodeDetector nativo de móviles (Súper rápido y sin errores de CDN)
    if ("BarcodeDetector" in window) {
      const barcodeDetector = new BarcodeDetector({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code"]
      });

      state.scanInterval = setInterval(async () => {
        try {
          const codes = await barcodeDetector.detect(video);
          if (codes.length > 0) {
            handleScannedCode(codes[0].rawValue);
          }
        } catch (err) {
          // Ignorar errores menores de cuadro vacío
        }
      }, 300);

    } else if (window.ZXingBrowser) {
      // Fallback a la librería ZXing si el navegador no soporta BarcodeDetector nativo
      const reader = new window.ZXingBrowser.BrowserMultiFormatReader();
      reader.decodeFromVideoElement(video, (result) => {
        if (result) {
          handleScannedCode(result.getText());
        }
      });
    } else {
      scanStatus.textContent = "Tu navegador no soporta escaneo automático de cámara.";
    }

  } catch (error) {
    console.error(error);
    scanStatus.textContent = "No se pudo abrir la cámara. Revisa los permisos.";
  }
}

function handleScannedCode(code) {
  scanStatus.textContent = `Código detectado: ${code}`;
  const product = findByCode(code);
  if (product) {
    stopScanner();
    showDetail(product);
  } else {
    searchInput.value = code;
    searchProducts();
    scanStatus.textContent = `No hay coincidencia exacta para: ${code}`;
  }
}

function stopScanner() {
  if (state.scanInterval) {
    clearInterval(state.scanInterval);
    state.scanInterval = null;
  }

  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }

  if (video.srcObject) {
    video.srcObject = null;
  }

  scannerPanel.classList.add("hidden");
}

document.getElementById("scanTop").addEventListener("click", startScanner);
document.getElementById("closeScanner").addEventListener("click", stopScanner);
searchInput.addEventListener("input", searchProducts);

loadInventory();
