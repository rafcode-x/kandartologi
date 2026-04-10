# kandartologi

**POC** — catat lawatan **Nasi Kandar** (macam app review kopi): katalog, **peta** (Leaflet + OpenStreetMap), dan **kongsi** melalui fail JSON (tiada pangkalan data; data dalam `localStorage` seperti [mechaok](https://github.com/rafieq-afed/mechaok)).

## Ciri

- **Katalog** — gerai, kawasan, hidangan, rating, nota, tarikh; lat/lng pilihan atau **Ambil lokasi**.
- **Peta** — pin untuk entri yang ada koordinat; tapis ikut kawasan.
- **Kongsi** — eksport JSON; import JSON rakan (ulasan ditanda *Dari: …*). Tiada akaun / server — serahkan fail secara manual (WhatsApp, e-mel).

## Pralihat tempatan

```bash
python3 -m http.server 8080
```

Buka `http://127.0.0.1:8080` — peta perlukan internet untuk jubin OSM.

## GitHub Pages

Repo → **Settings → Pages** → `main`, folder `/ (root)`.

## Lesen data

Anda bertanggungjawab atas kandungan nota & ulasan. POC ini tidak menghantar data ke mana-mana melainkan anda kongsi fail JSON secara sengaja.
