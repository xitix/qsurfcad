# QSurfCAD - Ghid Rapid: Integrare stl2step

## 📍 Unde încarc stl2step?

**Răspuns scurt:** În folderul `backend/` al proiectului.

## 🎯 Pași concreți (copy-paste ready)

### Pasul 1: Copiază binarul

```bash
# Verifică unde ai stl2step
ls -lh ~/Downloads/Delete/stl2step/build/stl2step

# Copiază în backend
cp ~/Downloads/Delete/stl2step/build/stl2step /path/to/qsurfcad-workbench/backend/

# Verifică că s-a copiat
ls -lh /path/to/qsurfcad-workbench/backend/stl2step

# Testează
cd /path/to/qsurfcad-workbench/backend
./stl2step --version
```

**Rezultat așteptat:**
```
stl2step 1.8.0
```

### Pasul 2: Instalează dependențe

```bash
cd /path/to/qsurfcad-workbench/backend
npm install
```

### Pasul 3: Pornește backend

```bash
node server.js
```

**Rezultat așteptat:**
```
╔═══════════════════════════════════════════╗
║  QSurfCAD Backend Server                  ║
║  http://localhost:3001                    ║
╚═══════════════════════════════════════════╝

stl2step path: ./stl2step
✅ stl2step found: stl2step 1.8.0
```

### Pasul 4: Pornește frontend (alt terminal)

```bash
cd /path/to/qsurfcad-workbench
npm run dev
```

### Pasul 5: Testează în browser

1. Deschide `http://localhost:5173`
2. Verifică status bar: **"● Backend: available"** (verde)
3. Importă un STL
4. Click **🔄 Convert to STEP**
5. Fișierul se descarcă automat!

---

## 🗂️ Structura finală

```
qsurfcad-workbench/
├── backend/
│   ├── server.js              ← Express.js server
│   ├── stl2step               ← Binarul tău (copiat aici)
│   ├── package.json
│   ├── SETUP.md               ← Ghid detaliat
│   └── node_modules/
├── src/
│   ├── App.tsx                ← UI principal
│   ├── utils/
│   │   ├── MagicTraceEngine.ts
│   │   └── api.ts             ← Client API pentru backend
│   └── components/
├── package.json
└── README.md
```

---

## 🔧 Alternative (dacă nu vrei să copiezi)

### Opțiunea A: Symlink

```bash
cd /path/to/qsurfcad-workbench/backend
ln -s ~/Downloads/Delete/stl2step/build/stl2step stl2step
```

### Opțiunea B: Environment variable

```bash
cd /path/to/qsurfcad-workbench/backend
STL2STEP_PATH=~/Downloads/Delete/stl2step/build/stl2step node server.js
```

### Opțiunea C: Path absolut în server.js

Editează `backend/server.js`:
```javascript
const STL2STEP_PATH = '/home/xitix5r/Downloads/Delete/stl2step/build/stl2step';
```

---

## ✅ Verificare rapidă

După ce ai pornit backend-ul, testează:

```bash
# Health check
curl http://localhost:3001/api/health
```

**Răspuns așteptat:**
```json
{
  "status": "ok",
  "stl2step": "available",
  "stl2stepPath": "./stl2step",
  "version": "stl2step 1.8.0"
}
```

---

## 🎬 Test complet cu Sample Plate.stl

```bash
# Testează conversia direct
cd /path/to/qsurfcad-workbench/backend
curl -X POST http://localhost:3001/api/convert \
  -F "stl=@/path/to/Sample Plate.stl" \
  -F "engine=trueform" \
  --output test.step

# Verifică rezultatul
ls -lh test.step
```

**Sau din browser:**
1. Importă Sample Plate.stl
2. Click "Convert to STEP"
3. Descarcă și deschide în FreeCAD

---

## 🐛 Probleme comune

### "Backend not reachable"
**Soluție:** Backend-ul nu rulează. Pornește `node server.js`

### "stl2step not found"
**Soluție:** Binarul nu e în `backend/`. Copiază-l sau folosește symlink.

### "Conversion failed"
**Soluție:** Verifică logs în terminalul backend-ului. Probabil STL invalid.

---

## 📊 Ce se întâmplă în spate

```
Browser                    Backend                    stl2step
   │                          │                           │
   │  POST /api/convert       │                           │
   │  (STL file)              │                           │
   ├─────────────────────────►│                           │
   │                          │  execFile(stl2step ...)   │
   │                          ├──────────────────────────►│
   │                          │                           │ 4080 facets
   │                          │                           │ → 15 analytic regions
   │                          │                           │ → STEP file
   │                          │◄──────────────────────────┤
   │  STEP file (download)    │                           │
   │◄─────────────────────────┤                           │
```

---

## 🎯 Următorii pași

După ce conversia funcționează:

1. ✅ **Testează cu STL-uri complexe** (găuri, cilindri, etc.)
2. 🔜 **Adaugă MagicTrace peste STEP** (nu doar STL)
3. 🔜 **Implementează orientare automată**
4. 🔜 **Export DXF pentru schițe**

---

**Întrebări?** Vezi [backend/SETUP.md](backend/SETUP.md) pentru detalii complete.
