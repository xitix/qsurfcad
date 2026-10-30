# QSurfCAD (aka qwensurfcad) - Naming Convention

## Numele Aplicației

**Nume oficial:** QSurfCAD  
**Nume alternativ:** qwensurfcad  
**Nume complet:** QSurfCAD - MagicTrace Workbench

## De ce QSurfCAD?

1. **Q** - de la "Qwen" (AI assistant care a dezvoltat proiectul)
2. **Surf** - de la "Surface" (suprafețe 3D, reconstrucție suprafețe)
3. **CAD** - Computer-Aided Design

## Relația cu Mesh2CAD

QSurfCAD este **inspirat** din conceptul Mesh2CAD (aplicație demonstrativă fără cod public), dar este o implementare complet independentă:

- ✅ **UI/UX inspirat din Mesh2CAD** - layout 3 coloane, workflow similar
- ✅ **MagicTrace** - implementare proprie a trasării magnetice
- ✅ **stl2step integration** - folosește motorul open-source BlinkingSun/stl2step
- ❌ **NU este fork Mesh2CAD** - cod scris de la zero

## Structura Nume în Cod

### Frontend
- `index.html`: `<title>QSurfCAD - MagicTrace Workbench</title>`
- `README.md`: `# QSurfCAD - MagicTrace Workbench`
- `src/utils/stlExport.ts`: `'Binary STL exported from QSurfCAD Workbench'`

### Backend
- `backend/server.js`: `QSurfCAD Backend Server`
- `backend/package.json`: `"name": "qsurfcad-backend"`
- Console output: `║  QSurfCAD Backend Server                  ║`

### Documentație
- `README.md`: Nume principal
- `SETUP_COMPLETE.md`: Ghid de instalare
- `QUICK_START.md`: Start rapid
- `backend/README.md`: Setup backend

## Referințe la Mesh2CAD

Următoarele referințe la "Mesh2CAD" sunt **intenate** și corecte:

1. **Concept original** - "UI/UX inspirat din Mesh2CAD"
2. **Demo video** - Link către demonstrația Mesh2CAD
3. **Credit** - "Mesh2CAD - Concept UI/UX" în secțiunea Credits

Acestea nu trebuie schimbate pentru că:
- Mesh2CAD este conceptul original (fără cod public)
- QSurfCAD este implementarea noastră independentă
- Este important să credităm sursa de inspirație

## GitHub Repository

**Repo principal:** `xitix/qwensurfcad`  
**Branch:** `main`  
**Structură:**
```
qwensurfcad/
├── src/              # Frontend React
├── backend/          # Backend Express.js
├── bin/              # Binare (stl2step)
├── README.md         # QSurfCAD documentation
└── ...
```

## Concluzie

- **Nume aplicație:** QSurfCAD (sau qwensurfcad)
- **Inspirat din:** Mesh2CAD (concept)
- **Motor conversie:** stl2step (BlinkingSun)
- **Cod:** Original, scris de la zero
