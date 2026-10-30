# Setup Guide: Integrating stl2step

## 📋 Cerințe

- ✅ stl2step compilat și funcțional (ai confirmat că merge)
- ✅ Node.js 18+ instalat
- ✅ Aplicatia Mesh2CAD (acest repo)

## 🚀 Setup Rapid (5 minute)

### 1. Copiază binarul stl2step

```bash
# Din folderul unde ai compilat stl2step
cd ~/Downloads/Delete/stl2step/build

# Copiază în folderul backend al proiectului
cp stl2step /path/to/mesh2cad-workbench/backend/

# Verifică că merge
cd /path/to/mesh2cad-workbench/backend
./stl2step --version
```

### 2. Instalează dependențele backend

```bash
cd /path/to/mesh2cad-workbench/backend
npm install
```

### 3. Pornește backend-ul

```bash
cd /path/to/mesh2cad-workbench/backend
node server.js
```

Ar trebui să vezi:
```
╔═══════════════════════════════════════════╗
║  Mesh2CAD Backend Server                  ║
║  http://localhost:3001                    ║
╚═══════════════════════════════════════════╝

stl2step path: ./stl2step
✅ stl2step found: stl2step 1.8.0
```

### 4. Pornește frontend-ul (în alt terminal)

```bash
cd /path/to/mesh2cad-workbench
npm run dev
```

### 5. Testează conversia

1. Deschide browser la `http://localhost:5173`
2. Importă un STL (butonul 📁 Import STL)
3. Verifică status bar: "● Backend: available"
4. Click pe butonul **🔄 Convert to STEP**
5. Fișierul STEP se descarcă automat!

## 🔧 Configurare Avansată

### Varianta A: Binar în backend/ (recomandat)

```
mesh2cad-workbench/
├── backend/
│   ├── server.js
│   ├── stl2step          ← binar aici
│   └── package.json
```

**Avantaj:** Totul în proiect, ușor de gestionat.

### Varianta B: Binar în altă locație

Dacă preferi să păstrezi stl2step în `~/Downloads/Delete/stl2step/build/`:

```bash
# Pornește serverul cu path explicit
cd /path/to/mesh2cad-workbench/backend
STL2STEP_PATH=/home/xitix5r/Downloads/Delete/stl2step/build/stl2step node server.js
```

### Varianta C: Symlink

```bash
cd /path/to/mesh2cad-workbench/backend
ln -s /home/xitix5r/Downloads/Delete/stl2step/build/stl2step stl2step
```

## 📊 API Endpoints

### POST /api/convert
Convertește STL → STEP

**Request:**
```bash
curl -X POST http://localhost:3001/api/convert \
  -F "stl=@Sample_Plate.stl" \
  -F "engine=trueform" \
  -F "units=mm" \
  --output output.step
```

**Response:** Fișier STEP (download)

### POST /api/analyze
Analizează STL fără conversie

**Request:**
```bash
curl -X POST http://localhost:3001/api/analyze \
  -F "stl=@Sample_Plate.stl"
```

**Response:**
```json
{
  "ok": true,
  "filename": "Sample_Plate.stl",
  "analysis": {
    "triangles": 4080,
    "vertices": 2036,
    "components": 1,
    "watertight": true,
    "volume": 12345.67,
    "planes": 7,
    "cylinders": 8,
    "cones": 0,
    "spheres": 0,
    "faceted": 0
  }
}
```

### GET /api/health
Verifică statusul backend-ului

**Response:**
```json
{
  "status": "ok",
  "stl2step": "available",
  "stl2stepPath": "./stl2step",
  "version": "stl2step 1.8.0"
}
```

## 🎨 Opțiuni Conversie

### Engine Modes

**`verbatim`** - Conversie rapidă, faceted
- Păstrează toate triunghiurile
- Fast, dar mai puțin precis
- Bun pentru mesh-uri complexe

**`trueform`** - Reconstrucție analitică (recomandat)
- Detectează plane, cilindri, conuri, sfere
- STEP mai curat, editabil în CAD
- Mai lent, dar rezultate profesionale

### Units

**`mm`** - Milimetri (default)
**`in`** - Inch (conversie automată ×25.4)

## 🐛 Troubleshooting

### "Backend not reachable"

**Problemă:** Serverul nu rulează.

**Soluție:**
```bash
cd backend
node server.js
```

### "stl2step not found"

**Problemă:** Binarul nu e în path-ul corect.

**Soluții:**
1. Copiază binarul în `backend/`
2. Sau folosește `STL2STEP_PATH` env var
3. Sau creează symlink

### "Conversion failed"

**Problemă:** stl2step a eșuat.

**Verifică:**
- Fișierul STL e valid?
- stl2step funcționează standalone?
- Vezi logs în terminalul backend-ului

### CORS errors în browser

**Problemă:** Frontend nu poate accesa backend.

**Soluție:** Asigură-te că backend-ul are `cors()` middleware (deja inclus).

## 📈 Performance

**Timpi tipici (Sample Plate.stl):**
- STL import: ~25ms
- Segmentation: ~32ms
- Topology build: ~121ms
- STEP export: ~5ms
- **Total: ~534ms**

**Fișiere mari (100k+ triunghiuri):**
- Total: 2-5 secunde
- Recomandare: `--no-verify` pentru viteză

## 🔐 Securitate

**Notă:** Acest server e pentru uz local. Nu-l expune pe internet!

Dacă ai nevoie de acces remote:
1. Folosește reverse proxy (nginx)
2. Adaugă autentificare
3. Limitează dimensiunea fișierelor
4. Rate limiting

## 📝 Logs

Backend-ul loghează în stdout:
```
[convert] Processing: Sample_Plate.stl
[convert] Engine: trueform, Units: mm
[convert] Success: 1 solid(s), 15 faces
[convert] Analytic: 7 planes, 8 cylinders
```

## 🎯 Workflow Complet

1. **Compilează stl2step** (deja făcut ✅)
2. **Copiază binarul** în `backend/`
3. **Pornește backend:** `node server.js`
4. **Pornește frontend:** `npm run dev`
5. **Importă STL** în browser
6. **Click "Convert to STEP"**
7. **Descarcă STEP** și deschide în FreeCAD/SolidCraft

## 🚀 Next Steps

După ce conversia funcționează:
- Adaugă MagicTrace peste STEP (nu doar STL)
- Implementează orientare automată
- Adaugă export DXF pentru schițe
- Feature tree pentru istoric operații

---

**Suport:** Dacă întâmpini probleme, verifică logs în ambele terminale (frontend + backend).
