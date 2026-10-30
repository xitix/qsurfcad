#!/bin/bash
# Script de instalare QSurfCAD
# Creează structura completă a proiectului pe mașina locală

set -e

echo "╔═══════════════════════════════════════════╗"
echo "║  QSurfCAD Installation Script             ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Creează structura de directoare
echo "📁 Creating project structure..."
mkdir -p qsurfcad/{src/{components,utils},backend}
cd qsurfcad

# Creează package.json principal
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

# Creează index.html
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

# Creează vite.config.js
cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
EOF

# Creează tsconfig.json
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
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

cat > tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.js"]
}
EOF

echo "✅ Project structure created"
echo ""
echo "📦 Next steps:"
echo "  1. cd qsurfcad"
echo "  2. npm install"
echo "  3. Copy source files from sandbox"
echo "  4. npm run dev"
echo ""
echo "📂 Source files needed:"
echo "  - src/App.tsx, App.css"
echo "  - src/main.tsx, index.css"
echo "  - src/types.ts"
echo "  - src/components/* (Toolbox, Viewport, ContextPanel, ObjectBrowser)"
echo "  - src/utils/MagicTraceEngine.ts, api.ts, stlParser.ts"
echo "  - backend/* (server.js, package.json, setup scripts)"
echo ""
echo "📚 Documentation:"
echo "  - README.md"
echo "  - SETUP_COMPLETE.md"
echo "  - QUICK_START.md"
echo ""
echo "✅ Installation script complete!"
