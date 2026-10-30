# Mesh2CAD - MagicTrace Workbench

Aplicație web de reverse engineering care combină UI/UX Mesh2CAD cu motorul de conversie stl2step.

## 🎯 Ce Este

**MagicTrace** = Trasare magnetică cu snapping inteligent pe mesh STL
- Raycasting pe geometrie 3D
- Snapping la vârfuri, muchii ascuțite, centre de fețe
- Least Squares Fitting pentru linii/arce/cercuri perfecte
- Feedback vizual în timp real

## 🏗️ Arhitectură

```
┌─────────────────────────────────────┐
│  Frontend (React + Three.js)        │
│  - Viewer STL cu mod dual           │
│  - MagicTrace (raycasting + snap)   │
│  - Object Browser                   │
│  - 3 coloane layout                 │
└──────────────┬──────────────────────┘
               │ HTTP (viitor)
               ▼
┌─────────────────────────────────────┐
│  Backend (Express.js - viitor)      │
│  - POST /api/convert                │
│  - POST /api/analyze                │
└──────────────┬──────────────────────┘
               │ child_process
               ▼
┌─────────────────────────────────────┐
│  stl2step CLI (C++ - extern)        │
│  - STL → STEP conversion            │
│  - TrueForm analytic recovery       │
└─────────────────────────────────────┘
```

## ✨ Funcționalități Implementate

### ✅ Faza 1 (Complet)

**UI Mesh2CAD-style:**
- Layout 3 coloane (Toolbox | Viewport | Context)
- Toolbox cu categorii: PREPARE, GUIDES, BUILD CAD, EXPORT
- Object Browser cu arbore de entități
- Context Panel cu setări dinamice

**Viewer STL:**
- Import STL (binary/ASCII)
- Mod dual: Solid + Wireframe
- OrbitControls (rotire, zoom, pan)
- Grid helper

**MagicTrace Engine:**
- Raycasting pe mesh
- Snapping la vârfuri (vertex detection)
- Snapping la muchii ascuțite (edge detection cu threshold de unghi)
- Snapping la centre de fețe (face center detection)
- Least Squares Fitting:
  - Line fitting (PCA-based)
  - Circle fitting (3-point circumcircle)
- Confidence scoring pentru snap targets

**Drawing Tools:**
- Line (2 points)
- Arc (3 points)
- Circle (3 points)
- Polyline (multiple points)
- Sketch visualization (green = completed, yellow = in-progress)

### ⏳ Faza 2 (De integrat)

**Backend Express.js:**
- Upload STL
- Apel stl2step CLI
- Download STEP

**stl2step Integration:**
- Conversie STL → STEP cu topologie B-rep validă
- TrueForm mode (analytic recovery)
- Verificare volum

## 🚀 Setup

### 1. Compilează stl2step (extern)

```bash
# Descarcă stl2step
cd ~/Downloads
unzip stl2step-1.8.0.zip
cd stl2step-1.8.0

# Instalează OpenCASCADE (Linux)
sudo apt install libocct-foundation-dev libocct-modeling-algorithms-dev

# Compilează
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j

# Testează
./build/stl2step --version
```

### 2. Rulează aplicația

```bash
# Instalează dependențe
npm install

# Development
npm run dev

# Build producție
npm run build
```

### 3. Integrare stl2step (viitor)

Creează `server.js`:

```javascript
const express = require('express');
const { execFile } = require('child_process');
const multer = require('multer');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/api/convert', upload.single('stl'), (req, res) => {
  execFile('./stl2step', [
    req.file.path,
    '--engine', 'trueform',
    '-o', `${req.file.path}.step`
  ], (err, stdout) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.download(`${req.file.path}.step`);
    }
  });
});

app.listen(3001);
```

## 📖 Cum Funcționează MagicTrace

### 1. Snapping la Vârfuri
```typescript
// Detectează toate vârfurile din mesh
for (let i = 0; i < positions.count; i++) {
  const vertex = new THREE.Vector3(...);
  const distance = point.distanceTo(vertex);
  if (distance <= snapRadius) {
    targets.push({ type: 'vertex', position: vertex, ... });
  }
}
```

### 2. Snapping la Muchii
```typescript
// Detectează muchii ascuțite (unghi > threshold)
const threshold = Math.cos(edgeThreshold * Math.PI / 180);
if (n0.dot(n1) < threshold) {
  // Muchie ascuțită între triunghiuri
  edges.push({ start: v0, end: v1, normal: ... });
}
```

### 3. Snapping la Centre
```typescript
// Grupează triunghiuri după normală
const key = `${Math.round(n.x * 10)}_${Math.round(n.y * 10)}_${Math.round(n.z * 10)}`;
faceGroups.set(key, centers);
// Calculează centru mediu pentru fiecare grup
```

### 4. Least Squares Fitting
```typescript
// Line fitting (PCA)
const centroid = average(points);
const direction = principalAxis(points, centroid);
const confidence = 1 - (avgError / snapRadius);

// Circle fitting (3-point circumcircle)
const center = circumcenter(p1, p2, p3);
const radius = center.distanceTo(p1);
const confidence = 1 - (avgError / snapRadius);
```

## 🎨 UI Workflow

1. **PREPARE**
   - Import STL
   - Orient (viitor)
   - Size (viitor)

2. **GUIDES**
   - Select (selectare entități)
   - Magic Trace (trasare magnetică)
   - Line (2 puncte)
   - Arc (3 puncte)
   - Circle (3 puncte)

3. **BUILD CAD**
   - Convert to STEP (apelează stl2step)
   - Verify (verifică volum)

4. **EXPORT**
   - Export DXF (schițe 2D)
   - Export SVG (schițe vectoriale)

## 🔧 Tehnologii

- **Frontend**: React 18 + TypeScript
- **3D**: Three.js + OrbitControls + STLLoader
- **Styling**: CSS modules
- **Build**: Vite
- **Motor CAD**: stl2step (C++/OpenCASCADE) - extern

## 📝 Status

✅ UI Mesh2CAD-style complet  
✅ MagicTrace engine funcțional  
✅ Snapping la vârfuri/muchii/centre  
✅ Least Squares Fitting (line/circle)  
✅ Viewer STL cu mod dual  
⏳ Integrare stl2step (necesită backend)  
⏳ Export DXF/SVG funcțional  
⏳ Orientare automată  

## 🎯 Următorii Pași

1. **Testare MagicTrace** cu fișiere STL reale
2. **Integrare stl2step** (Express.js backend)
3. **Export DXF/SVG** pentru schițe
4. **Orientare automată** (detectare plan principal)
5. **Feature Tree** (istoric operații)

## 📄 License

MIT

## 🙏 Credits

- **Mesh2CAD** - Concept UI/UX
- **stl2step** (BlinkingSun) - Motor conversie STL → STEP
- **reverscad** (Shugar86) - Arhitectură de referință
- **OpenCASCADE** - Kernel CAD
