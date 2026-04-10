const STORAGE_KEY = "kandartologi_v1";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { profileName: "", entries: [] };
    const d = JSON.parse(raw);
    return {
      profileName: typeof d.profileName === "string" ? d.profileName : "",
      entries: Array.isArray(d.entries) ? d.entries.filter((e) => e && e.id) : [],
    };
  } catch {
    return { profileName: "", entries: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/** @type {L.Map|null} */
let map = null;
/** @type {L.LayerGroup|null} */
let layerGroup = null;

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function stars(n, symbol = "★") {
  const r = Math.min(5, Math.max(1, Number(n) || 1));
  const emptySymbol = symbol === "★" ? "☆" : ""; 
  return symbol.repeat(r) + emptySymbol.repeat(symbol === "★" ? 5 - r : 0);
}

function ensureLeafletIcons() {
  if (typeof L === "undefined") return;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "vendor/images/marker-icon-2x.png",
    iconUrl: "vendor/images/marker-icon.png",
    shadowUrl: "vendor/images/marker-shadow.png",
  });
}

function ensureMap() {
  ensureLeafletIcons();
  if (map) return;
  map = L.map("map", { scrollWheelZoom: true }).setView([4.2, 101.9], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  layerGroup = L.layerGroup().addTo(map);
}

function refreshMap() {
  ensureMap();
  if (!layerGroup || !map) return;
  layerGroup.clearLayers();
  let list = state.entries;
  const fa = document.getElementById("filter-area");
  const only = fa ? fa.value : "";
  if (only) list = list.filter((e) => (e.area || "") === only);

  const bounds = [];
  for (const e of list) {
    const lat = Number(e.lat);
    const lng = Number(e.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    const m = L.marker([lat, lng]);
    const peer = e.sharedFrom ? ` <small>(dari ${escapeHtml(e.sharedFrom)})</small>` : "";
    m.bindPopup(
      `<strong>${escapeHtml(e.stallName || "")}</strong>${peer}<br/>${stars(e.rating)}<br/><small>${escapeHtml(e.area || "")}</small>`
    );
    m.addTo(layerGroup);
    bounds.push([lat, lng]);
  }
  if (bounds.length) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
  requestAnimationFrame(() => map.invalidateSize());
}

function populateAreaFilter() {
  const sel = document.getElementById("filter-area");
  if (!sel) return;
  const cur = sel.value;
  const areas = [...new Set(state.entries.map((e) => e.area).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Semua</option>';
  for (const a of areas) {
    const o = document.createElement("option");
    o.value = a;
    o.textContent = a;
    sel.appendChild(o);
  }
  if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function renderCatalog() {
  const root = document.getElementById("catalog-list");
  const empty = document.getElementById("catalog-empty");
  const tpl = document.getElementById("tpl-card");
  if (!root || !empty || !tpl) return;

  let list = [...state.entries].sort((a, b) => String(b.visited || "").localeCompare(String(a.visited || "")));
  const fa = document.getElementById("filter-area");
  const only = fa ? fa.value : "";
  if (only) list = list.filter((e) => (e.area || "") === only);

  root.replaceChildren();
  empty.hidden = list.length > 0;

  for (const e of list) {
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector(".review-card");
    card.dataset.id = e.id;
    node.querySelector(".review-title").textContent = e.stallName || "Tanpa nama";
    node.querySelector(".review-stars").textContent = stars(e.rating);
    
    const jokiEl = node.querySelector(".review-joki");
    if (jokiEl) {
      jokiEl.textContent = e.jokiRating ? `Joki: ${stars(e.jokiRating, "⭐")}` : "";
    }

    node.querySelector(".review-area").textContent = `📍 ${e.area || "—"}`;
    node.querySelector(".review-dishes").textContent = e.dishes ? `Hidangan: ${e.dishes}` : "";
    node.querySelector(".review-notes").textContent = e.notes ? e.notes : "";
    
    const peer = e.sharedFrom ? ` · Dari: ${e.sharedFrom}` : "";
    const coord =
      e.lat != null && e.lng != null && !Number.isNaN(Number(e.lat)) && !Number.isNaN(Number(e.lng))
        ? ` · ${Number(e.lat).toFixed(4)}, ${Number(e.lng).toFixed(4)}`
        : "";
    
    const banjirLevels = ["", "Kering", "Sikit Seghok", "Standard", "Banjir", "Tsunami"];
    const banjirStatus = e.banjir ? banjirLevels[e.banjir] : "Standard";

    node.querySelector(".review-meta").textContent = `Lawatan: ${e.visited || "—"}${coord}${peer} · 🌊 ${banjirStatus}`;
    
    node.querySelector(".btn-delete").addEventListener("click", () => {
      if (!confirm("Buang lawatan ini?")) return;
      state.entries = state.entries.filter((x) => x.id !== e.id);
      saveState();
      renderAll();
    });
    root.appendChild(node);
  }
  renderPeerFeed();
}

function renderPeerFeed() {
  const ul = document.getElementById("peer-feed");
  if (!ul) return;
  const peers = state.entries.filter((e) => e.sharedFrom);
  ul.replaceChildren();
  if (peers.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Belum ada ulasan import — import fail JSON rakan untuk lihat di sini & dalam katalog.";
    ul.appendChild(li);
    return;
  }
  for (const e of peers.slice(0, 12)) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${escapeHtml(e.stallName)}</strong> (${escapeHtml(e.area)}) — ${stars(e.rating)} — <em>dari ${escapeHtml(e.sharedFrom || "?")}</em>`;
    ul.appendChild(li);
  }
}

function renderAll() {
  populateAreaFilter();
  renderCatalog();
  const mapPanel = document.getElementById("panel-map");
  if (mapPanel && !mapPanel.hidden) refreshMap();
}

document.querySelectorAll(".nav-tabs .tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panel = btn.getAttribute("data-panel");
    document.querySelectorAll(".nav-tabs .tab").forEach((b) => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    document.querySelectorAll(".panel").forEach((p) => {
      p.hidden = p.id !== `panel-${panel}`;
    });
    if (panel === "map") {
      setTimeout(() => refreshMap(), 50);
    }
  });
});

document.getElementById("filter-area")?.addEventListener("change", () => {
  renderCatalog();
  if (document.getElementById("panel-map") && !document.getElementById("panel-map").hidden) refreshMap();
});

document.getElementById("form-entry")?.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const stallName = String(fd.get("stallName") || "").trim();
  const area = String(fd.get("area") || "").trim();
  const dishes = String(fd.get("dishes") || "").trim();
  const notes = String(fd.get("notes") || "").trim();
  const rating = Number(fd.get("rating")) || 3;
  const jokiRating = Number(fd.get("jokiRating")) || 0; 
  const banjir = Number(fd.get("banjir")) || 3;
  const visited = String(fd.get("visited") || "");
  
  let latRaw = fd.get("lat");
  let lngRaw = fd.get("lng");
  let lat = (latRaw === "" || latRaw == null) ? null : Number(latRaw);
  let lng = (lngRaw === "" || lngRaw == null) ? null : Number(lngRaw);

  if (!stallName || !area || !visited) return;

  state.entries.push({
    id: uid(),
    stallName,
    area,
    dishes,
    notes,
    rating,
    jokiRating,
    banjir,
    visited,
    lat: lat != null && !Number.isNaN(lat) ? lat : null,
    lng: lng != null && !Number.isNaN(lng) ? lng : null,
  });

  saveState();
  ev.target.reset();
  
  const bl = document.getElementById('banjir-label');
  if (bl) bl.textContent = "Standard";

  const vd = ev.target.querySelector('[name="visited"]');
  if (vd) vd.value = todayYmd();
  renderAll();
});

const visitInput = document.getElementById("form-entry")?.querySelector('[name="visited"]');
if (visitInput) visitInput.value = todayYmd();

document.getElementById("btn-geo")?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation tidak disokong.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const form = document.getElementById("form-entry");
      if (!form) return;
      form.querySelector('[name="lat"]').value = String(pos.coords.latitude.toFixed(6));
      form.querySelector('[name="lng"]').value = String(pos.coords.longitude.toFixed(6));
    },
    () => alert("Tidak dapat lokasi — isi lat/lng manual atau teruskan tanpa pin.")
  );
});

document.getElementById("form-profile")?.addEventListener("submit", (ev) => {
  ev.preventDefault();
  state.profileName = String(document.getElementById("profile-name").value || "").trim();
  saveState();
});

const pNameInput = document.getElementById("profile-name");
if (pNameInput) pNameInput.value = state.profileName;

document.getElementById("btn-export")?.addEventListener("click", () => {
  const payload = {
    schema: "kandartologi-export-v1",
    exportedAt: new Date().toISOString(),
    author: state.profileName || "anonymous",
    entries: state.entries.map(({ sharedFrom, ...rest }) => rest),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.download = "kandartologi-katalog.json";
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("input-import")?.addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  ev.target.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const author =
      typeof data.author === "string" && data.author.trim()
        ? data.author.trim()
        : typeof data.sharedBy === "string"
          ? data.sharedBy.trim()
          : "kawan";
    let incoming = [];
    if (Array.isArray(data.entries)) incoming = data.entries;
    else if (Array.isArray(data)) incoming = data;
    if (incoming.length === 0) {
      alert("Tiada entries dalam fail.");
      return;
    }
    let n = 0;
    for (const raw of incoming) {
      if (!raw || typeof raw !== "object") continue;
      const stallName = String(raw.stallName || raw.name || "").trim();
      const area = String(raw.area || "").trim();
      if (!stallName || !area) continue;
      state.entries.push({
        id: uid(),
        stallName,
        area,
        dishes: String(raw.dishes || "").trim(),
        notes: String(raw.notes || "").trim(),
        rating: Math.min(5, Math.max(1, Number(raw.rating) || 3)),
        jokiRating: Number(raw.jokiRating) || 0,
        banjir: Number(raw.banjir) || 3,
        visited: String(raw.visited || raw.date || todayYmd()),
        lat: raw.lat != null ? Number(raw.lat) : null,
        lng: raw.lng != null ? Number(raw.lng) : null,
        sharedFrom: author,
      });
      n += 1;
    }
    saveState();
    alert(`Import siap: ${n} lawatan ditambah (ditanda dari ${author}).`);
    renderAll();
  } catch {
    alert("Fail JSON tidak sah.");
  }
});

const banjirSlider = document.getElementById('banjir-slider');
const banjirLabel = document.getElementById('banjir-label');
const levels = ["", "Kering", "Sikit Seghok", "Standard", "Banjir", "Tsunami Mat!"];

banjirSlider?.addEventListener('input', (e) => {
  if (banjirLabel) banjirLabel.textContent = levels[e.target.value];
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});

document.getElementById('btn-search')?.addEventListener('click', async () => {
  const query = document.getElementById('map-search').value;
  const resultsContainer = document.getElementById('search-results');
  
  if (!query) return;
  
  resultsContainer.innerHTML = '<p style="padding: 10px;">Mencari...</p>';

  try {
    // Switch to Photon API
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lat=5.41&lon=100.33`);
    const data = await response.json();

    resultsContainer.innerHTML = ''; 

    if (!data.features || data.features.length === 0) {
      resultsContainer.innerHTML = '<p style="padding: 10px;">Lokasi tidak dijumpai.</p>';
      return;
    }

    data.features.forEach(feature => {
      const item = feature.properties;
      const [lon, lat] = feature.geometry.coordinates; // Photon uses [lng, lat]
      
      const div = document.createElement('div');
      div.style.padding = '12px';
      div.style.borderBottom = '1px solid #383838';
      div.style.cursor = 'pointer';
      div.style.fontSize = '14px';

      // Construct a nice address string
      const name = item.name || "";
      const street = item.street || "";
      const city = item.city || "";
      const fullAddress = [name, street, city].filter(Boolean).join(", ");

      div.textContent = fullAddress;
      
      div.onclick = () => {
        document.getElementById('input-lat').value = lat;
        document.getElementById('input-lng').value = lon;
        document.getElementById('map-search').value = name || street || query;
        resultsContainer.innerHTML = '';
      };
      resultsContainer.appendChild(div);
    });
  } catch (error) {
    resultsContainer.innerHTML = '<p style="padding: 10px;">Ralat sambungan.</p>';
  }
});
  });
}

renderAll();
