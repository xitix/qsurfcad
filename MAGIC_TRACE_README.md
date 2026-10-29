# Magic Trace - Schițare peste fișiere STEP

## Starea Actuală

### ✅ Funcționalități Implementate

1. **Sistem de Snapping la Features B-rep** (`src/utils/snapEngine.ts`)
   - Snapping la vertex-uri
   - Snapping la muchii (linii și curbe)
   - Snapping la centre de fețe plane
   - Rază de snapping configurabilă

2. **Sistem de Constrângeri Geometrice** (`src/utils/constraintSolver.ts`)
   - Constrângeri: horizontal, vertical, coincident
   - Schițe cu puncte, linii, cercuri, arce
   - Export DXF și SVG
   - Rezolvator de constrângeri (simplificat)

3. **Import STEP (Framework)** (`src/utils/stepImporter.ts`)
   - Cod pentru import STEP cu OpenCASCADE.js
   - Extracție topologie B-rep (fețe, muchii, vertex-uri)
   - **NECESITĂ CONFIGURARE** - vezi secțiunea "Activare Import STEP"

4. **UI Integrat**
   - State management pentru STEP topology
   - Snap engine integrat în aplicație
   - Constraint solver disponibil

### ⚠️ Funcționalitate Parțială

**Import STEP**: Codul este scris, dar necesită configurare suplimentară pentru OpenCASCADE.js cu Vite.

## Activare Import STEP

### Problema

OpenCASCADE.js folosește WebAssembly (WASM) care necesită configurare specială în Vite:
- Plugin-uri: `vite-plugin-wasm` și `vite-plugin-top-level-await` (deja instalate)
- Fișiere WASM trebuie să fie accesibile ca assets
- Import dinamic necesită handling special

### Soluții Posibile

#### Opțiunea 1: Configurare Vite Avansată

Adăugați în `vite.config.js`:

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['opencascade.js'],
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },
});
```

#### Opțiunea 2: Încărcare Manuală WASM

Descărcați fișierul WASM separat și încărcați-l manual:

```javascript
// În stepImporter.ts
export async function initOpenCascade(): Promise<void> {
  if (occt) return;
  
  const wasmUrl = '/opencascade.wasm'; // Copiați în public/
  
  const module = await import('opencascade.js/dist/opencascade.js');
  occt = await module.default({
    locateFile: (path: string) => {
      if (path.endsWith('.wasm')) return wasmUrl;
      return path;
    }
  });
}
```

#### Opțiunea 3: Folosiți CDN

Încărcați OpenCASCADE.js din CDN în `index.html`:

```html
<script src="https://unpkg.com/opencascade.js/dist/opencascade.js"></script>
```

Apoi în cod:
```javascript
const occt = await window.OpenCascade();
```

### Testare

După configurare, testați importul STEP:

1. Generați un fișier STEP cu brep.io/stl2step
2. Încărcați-l în aplicație
3. Verificați că topologia este extrasă corect
4. Testați snapping la features

## Workflow Complet

### Pentru Utilizatori (Acum)

1. **Conversie STL → STEP**: Folosiți [brep.io/stl2step](https://next.brep.io/stl2step)
2. **Schițare peste STEP**: Folosiți Magic Trace (această aplicație)
   - Import fișier STEP
   - Schițați peste geometrie cu snapping
   - Adăugați constrângeri
   - Export DXF/SVG
3. **Reconstrucție CAD**: Import schițe în FreeCAD/SolidCraft/MOI3D

### Pentru Dezvoltatori

1. Activați import STEP (vezi secțiunea de mai sus)
2. Implementați vizualizare B-rep în Viewport
3. Adăugați unelte de schițare interactive
4. Implementați constrângeri avansate
5. Adăugați export cu constrângeri

## Fișiere Cheie

- `src/utils/stepImporter.ts` - Import STEP cu OpenCASCADE
- `src/utils/snapEngine.ts` - Snapping la features B-rep
- `src/utils/constraintSolver.ts` - Sistem de constrângeri
- `src/App.tsx` - State management și integrare
- `src/components/Viewport.tsx` - Vizualizare 3D (necesită actualizare)
- `src/components/Inspector.tsx` - UI pentru unelte (necesită actualizare)

## Următorii Pași

### Prioritate Înaltă

1. **Configurare OpenCASCADE.js** - Activare import STEP
2. **Vizualizare B-rep** - Afișare fețe, muchii, vertex-uri în Viewport
3. **Unelte de Schițare** - Line, Arc, Circle, Polyline cu snapping
4. **Feedback Vizual** - Indicatori pentru snapping targets

### Prioritate Medie

5. **Constrângeri Avansate** - parallel, perpendicular, tangent, equal
6. **Măsurători** - Distanțe, unghiuri, raze
7. **Export Avansat** - DXF cu constrângeri, SVG, JSON
8. **Optimizare** - Performance pentru modele mari

### Prioritate Scăzută

9. **Feature Recognition** - Detectare automată găuri, fileturi, etc.
10. **Parametric Editing** - Editare parametrică a schițelor
11. **Integration API** - API pentru integrare cu alte tool-uri

## Resurse

- [OpenCASCADE.js](https://github.com/donalffs/opencascade.js)
- [brep.io/stl2step](https://next.brep.io/stl2step)
- [Mesh2CAD Demo](https://www.youtube.com/watch?v=0-zkcARXbn8)
- [Vite WASM Guide](https://vitejs.dev/guide/features.html#webassembly)

## Note Tehnice

### OpenCASCADE.js

- Mărime: ~10MB (WASM + JS)
- Timp de încărcare: 2-5 secunde
- Performanță: Aproape nativă cu WebAssembly
- Compatibilitate: Toate browserele moderne

### Alternativi

Dacă OpenCASCADE.js este prea complex, considerați:
- **IFC.js** - Pentru IFC/BIM
- **three-csg** - Pentru operații booleane simple
- **Custom parser** - Pentru formate simple

## Contribuții

Pentru a contribui la activarea importului STEP:

1. Testați configurările Vite de mai sus
2. Raportați probleme în Issues
3. Propuneți soluții în Pull Requests
4. Împărtășiți experiența cu OpenCASCADE.js

## Licență

Acest proiect este un work-in-progress bazat pe conceptul Mesh2CAD.
Respectați licențele tuturor dependențelor utilizate.
