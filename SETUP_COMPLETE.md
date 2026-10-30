# 🚀 QSurfCAD - Setup Complet - Ghid Pas cu Pas

## Opțiunea A: Descarcă de pe GitHub (Cel mai simplu)

```bash
cd backend
curl -L -o stl2step https://github.com/xitix/qwensurfcad/raw/main/bin/stl2step
chmod +x stl2step
npm install
node server.js
```

**Gata!** Serverul rulează pe `http://localhost:3001`

---

## Opțiunea B: Folosește binarul local (Fără download)

```bash
cd backend
cp /home/xitix5r/Downloads/Delete/stl2step/build/stl2step ./
chmod +x stl2step
npm install
node server.js
```

**Gata!** Serverul rulează pe `http://localhost:3001`

---

## Opțiunea C: Symlink (Elegant, fără copiere)

```bash
cd backend
ln -s /home/xitix5r/Downloads/Delete/stl2step/build/stl2step ./stl2step
npm install
node server.js
```

**Gata!** Serverul rulează pe `http://localhost:3001`

---

## ✅ Verifică că funcționează

### Test 1: Health check

```bash
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

### Test 2: Conversie rapidă

```bash
# Descarcă scriptul de test
chmod +x test.sh
./test.sh
```

**Sau manual:**
```bash
curl -X POST http://localhost:3001/api/convert \
  -F "stl=@/calea/catre/fisier.stl" \
  --output output.step

ls -lh output.step
```

---

## 🎨 Testează în Browser

### Pas 1: Pornește frontend-ul (alt terminal)

```bash
cd ..
npm run dev
```

### Pas 2: Deschide browser

```
http://localhost:5173
```

### Pas 3: Verifică status bar

Ar trebui să vezi: **"● Backend: available"** (verde)

### Pas 4: Testează conversia

1. Click **📁 Import STL**
2. Selectează un fișier STL
3. Click **🔄 Convert to STEP**
4. Fișierul STEP se descarcă automat!

---

## 📋 Ce se întâmplă în spate

```
┌─────────────┐
│   Browser   │
│  (React UI) │
└──────┬──────┘
       │ 1. Upload STL
       ▼
┌─────────────┐
│   Backend   │
│ (Express.js)│
└──────┬──────┘
       │ 2. Execută: stl2step --engine trueform
       ▼
┌─────────────┐
│  stl2step   │
│   (C++ CLI) │
└──────┬──────┘
       │ 3. Generează STEP cu 15 regiuni analitice
       ▼
┌─────────────┐
│   Backend   │
└──────┬──────┘
       │ 4. Returnează STEP
       ▼
┌─────────────┐
│   Browser   │
│  (Download) │
└─────────────┘
```

---

## 🔧 Configurare Avansată

### Dacă binarul e în alt loc:

```bash
# Folosește variabila de mediu
STL2STEP_PATH=/calea/catre/stl2step node server.js
```

### Sau editează server.js:

```javascript
const STL2STEP_PATH = '/calea/absoluta/catre/stl2step';
```

---

## ❓ Probleme Comune

### "stl2step: Permission denied"

```bash
chmod +x stl2step
```

### "Backend not reachable"

Serverul nu rulează:
```bash
node server.js
```

### "Cannot find module 'express'"

Instalează dependențele:
```bash
npm install
```

### "stl2step not found"

Verifică path-ul:
```bash
ls -lh stl2step
./stl2step --version
```

---

## 🎯 Următorii Pași

După ce setup-ul funcționează:

1. ✅ **Testează cu STL-uri reale**
   - Sample Plate.stl
   - Alte fișiere din colecția ta

2. 🔜 **Explorează MagicTrace**
   - Importă STL
   - Click pe **✨ Magic Trace**
   - Desenează linii/arce/cercuri peste mesh

3. 🔜 **Verifică STEP-ul în CAD**
   - Deschide în FreeCAD
   - Verifică că fețele sunt analitice (plane, cilindri)
   - Testează editabilitatea

---

## 📞 Suport

Dacă ceva nu funcționează:

1. Verifică logs în terminalul backend-ului
2. Rulează `./test.sh` pentru diagnostic
3. Verifică `curl http://localhost:3001/api/health`

---

**Gata de lucru!** 🎉

Acum ai:
- ✅ UI QSurfCAD (stil Mesh2CAD)
- ✅ MagicTrace funcțional
- ✅ Conversie STL → STEP cu stl2step
- ✅ Backend Express.js
- ✅ Download automat STEP
