# Setup Rapid - 3 Pași Simpli

## ✅ Metoda 1: Automată (Recomandată)

```bash
cd backend
chmod +x setup-binary.sh
./setup-binary.sh
```

Alege opțiunea **1** pentru a descărca de pe GitHub.

---

## ✅ Metoda 2: Manuală (Dacă ai deja binarul)

### Pas 1: Copiază binarul

```bash
cd backend
cp /home/xitix5r/Downloads/Delete/stl2step/build/stl2step ./
chmod +x stl2step
```

### Pas 2: Instalează dependențe

```bash
npm install
```

### Pas 3: Pornește serverul

```bash
node server.js
```

Ar trebui să vezi:
```
✅ stl2step found: stl2step 1.8.0
```

---

## ✅ Metoda 3: Symlink (Fără copiere)

```bash
cd backend
ln -s /home/xitix5r/Downloads/Delete/stl2step/build/stl2step ./stl2step
npm install
node server.js
```

---

## 🚀 Testează Conversia

### Din terminal:

```bash
# Testează direct cu curl
curl -X POST http://localhost:3001/api/convert \
  -F "stl=@/path/to/your/file.stl" \
  --output output.step

# Verifică rezultatul
ls -lh output.step
```

### Din browser:

1. Pornește frontend-ul:
```bash
cd ..
npm run dev
```

2. Deschide `http://localhost:5173`
3. Importă un STL
4. Click **🔄 Convert to STEP**
5. Fișierul se descarcă automat!

---

## 🔧 Configurare Alternativă

Dacă binarul e în alt loc, folosește variabila de mediu:

```bash
STL2STEP_PATH=/calea/catre/stl2step node server.js
```

---

## ❓ Probleme?

### "stl2step: command not found"

Binarul nu e executabil:
```bash
chmod +x stl2step
```

### "Permission denied"

Verifică permisiunile:
```bash
ls -lh stl2step
# Ar trebui să fie: -rwxr-xr-x
```

### "Backend not reachable"

Serverul nu rulează. Pornește-l:
```bash
node server.js
```

---

## 📊 Verifică Statusul

```bash
# Health check
curl http://localhost:3001/api/health
```

Răspuns așteptat:
```json
{
  "status": "ok",
  "stl2step": "available",
  "stl2stepPath": "./stl2step",
  "version": "stl2step 1.8.0"
}
```

---

## 🎯 Următorul Pas

După ce setup-ul funcționează:
1. Testează cu Sample Plate.stl
2. Verifică că STEP-ul se deschide în FreeCAD
3. Explorează MagicTrace în browser

**Gata!** 🎉
