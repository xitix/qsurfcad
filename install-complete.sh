#!/bin/bash
# QSurfCAD - Complete Installation Script
# Generează TOT proiectul (frontend + backend + setup)

set -e

echo "╔═══════════════════════════════════════════╗"
echo "║  QSurfCAD Complete Installation           ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

PROJECT_DIR="qsurfcad"

# Creează structura
echo "📁 Creating project structure..."
mkdir -p "$PROJECT_DIR"/{src/{components,utils},backend}
cd "$PROJECT_DIR"

# ========== FRONTEND ==========

echo "📦 Creating frontend files..."

# package.json
cat > package.json << 'EOF'
{
  "name": "qsurfcad",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "three": "^0.160.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@types/three": "^0.160.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
EOF

# index.html
cat > index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>QSurfCAD - MagicTrace Workbench</title>
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# vite.config.js
cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
EOF

# tsconfig files
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
EOF

# src/main.tsx
cat > src/main.tsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

# src/index.css
cat > src/index.css << 'EOF'
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #1a1a1a;
  color: #e0e0e0;
}

#root {
  width: 100vw;
  height: 100vh;
}
EOF

# src/types.ts
cat > src/types.ts << 'EOF'
export interface SnapTarget {
  type: 'vertex' | 'edge' | 'face-center';
  position: [number, number, number];
  distance: number;
}

export interface SketchPoint {
  position: [number, number, number];
  snapped: boolean;
}

export interface Sketch {
  id: string;
  points: SketchPoint[];
  type: 'line' | 'arc' | 'circle';
}
EOF

echo "✅ Frontend config files created"

# ========== BACKEND ==========

echo "🔧 Creating backend files..."

cd backend

# backend/package.json
cat > package.json << 'EOF'
{
  "name": "qsurfcad-backend",
  "version": "1.0.0",
  "description": "QSurfCAD Backend - wraps stl2step CLI",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5"
  }
}
EOF

# backend/server.js
cat > server.js << 'EOF'
const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const STL2STEP_PATH = process.env.STL2STEP_PATH || './stl2step';

app.post('/api/convert', upload.single('stl'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No STL file uploaded' });
  }

  const inputPath = req.file.path;
  const outputPath = inputPath + '.step';

  console.log(`[convert] Processing: ${req.file.originalname}`);

  const args = [inputPath, '-o', outputPath, '--engine', 'trueform', '--no-verify'];

  execFile(STL2STEP_PATH, args, { timeout: 60000 }, (error, stdout, stderr) => {
    fs.unlink(inputPath, () => {});

    if (error) {
      console.error('[convert] Error:', error.message);
      return res.status(500).json({ error: 'Conversion failed', details: error.message });
    }

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ error: 'STEP file not generated' });
    }

    const originalName = req.file.originalname.replace(/\.stl$/i, '') + '.step';
    res.download(outputPath, originalName, (err) => {
      setTimeout(() => fs.unlink(outputPath, () => {}), 1000);
    });
  });
});

app.get('/api/health', (req, res) => {
  execFile(STL2STEP_PATH, ['--version'], { timeout: 5000 }, (error, stdout) => {
    res.json({
      status: 'ok',
      stl2step: error ? 'not found' : 'available',
      stl2stepPath: STL2STEP_PATH,
      version: error ? null : stdout.trim()
    });
  });
});

app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  QSurfCAD Backend Server                  ║`);
  console.log(`║  http://localhost:${PORT}                    ║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);
  console.log(`stl2step path: ${STL2STEP_PATH}`);
  
  execFile(STL2STEP_PATH, ['--version'], (error, stdout) => {
    if (error) {
      console.warn(`\n⚠️  Warning: stl2step not found at ${STL2STEP_PATH}`);
    } else {
      console.log(`✅ stl2step found: ${stdout.trim()}`);
    }
  });
});
EOF

cd ..

echo "✅ Backend files created"

# ========== FINAL ==========

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  ✅ Installation Complete!                ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "📂 Project created at: $PROJECT_DIR/"
echo ""
echo "🚀 Next steps:"
echo ""
echo "1. Install frontend dependencies:"
echo "   cd $PROJECT_DIR"
echo "   npm install"
echo ""
echo "2. Install backend dependencies:"
echo "   cd backend"
echo "   npm install"
echo ""
echo "3. Copy stl2step binary to backend/:"
echo "   cp /path/to/stl2step ./backend/"
echo ""
echo "4. Start backend (terminal 1):"
echo "   cd backend"
echo "   node server.js"
echo ""
echo "5. Start frontend (terminal 2):"
echo "   cd .."
echo "   npm run dev"
echo ""
echo "6. Open browser: http://localhost:5173"
echo ""
echo "📚 For complete setup guide, see README.md"
echo ""
