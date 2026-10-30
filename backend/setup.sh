#!/bin/bash
# Quick setup script for Mesh2CAD backend

echo "╔═══════════════════════════════════════════╗"
echo "║  Mesh2CAD Backend Setup                   ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Check if stl2step exists in backend folder
if [ ! -f "./stl2step" ]; then
    echo "⚠️  stl2step binary not found in backend/"
    echo ""
    echo "Please copy your stl2step binary to this folder:"
    echo "  cp /path/to/stl2step /path/to/mesh2cad-workbench/backend/"
    echo ""
    echo "Or set STL2STEP_PATH environment variable:"
    echo "  export STL2STEP_PATH=/path/to/stl2step"
    echo ""
    read -p "Press Enter to continue anyway..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Start the server with:"
echo "   node server.js"
echo ""
echo "Then in another terminal, start the frontend:"
echo "   cd .. && npm run dev"
echo ""
