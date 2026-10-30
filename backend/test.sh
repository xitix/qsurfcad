#!/bin/bash
# Test script - verifies stl2step integration

set -e

echo "╔═══════════════════════════════════════════╗"
echo "║  QSurfCAD Integration Test                ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Check if backend is running
echo "1️⃣  Checking backend..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
    curl -s http://localhost:3001/api/health | jq .
else
    echo "❌ Backend is not running"
    echo ""
    echo "Start it with:"
    echo "  cd backend"
    echo "  node server.js"
    exit 1
fi

echo ""
echo "2️⃣  Testing conversion..."

# Create a simple test STL (cube)
cat > /tmp/test_cube.stl << 'EOF'
solid cube
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 10 10 0
      vertex 10 0 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 0 10 0
      vertex 10 10 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 10
      vertex 10 0 10
      vertex 10 10 10
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 10
      vertex 10 10 10
      vertex 0 10 10
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 10 0 0
      vertex 10 0 10
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 10 0 10
      vertex 0 0 10
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 10 0
      vertex 10 10 10
      vertex 10 10 0
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 10 0
      vertex 0 10 10
      vertex 10 10 10
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 0 10
      vertex 0 10 10
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 10 10
      vertex 0 10 0
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 10 0 0
      vertex 10 10 0
      vertex 10 10 10
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 10 0 0
      vertex 10 10 10
      vertex 10 0 10
    endloop
  endfacet
endsolid cube
EOF

# Test conversion
echo "Converting test cube..."
if curl -s -X POST http://localhost:3001/api/convert \
  -F "stl=@/tmp/test_cube.stl" \
  -o /tmp/test_output.step; then
    
    if [ -f /tmp/test_output.step ] && [ -s /tmp/test_output.step ]; then
        echo "✅ Conversion successful!"
        echo ""
        echo "Output file:"
        ls -lh /tmp/test_output.step
        echo ""
        echo "First 10 lines:"
        head -n 10 /tmp/test_output.step
    else
        echo "❌ Conversion failed - output file is empty"
        exit 1
    fi
else
    echo "❌ Conversion request failed"
    exit 1
fi

# Cleanup
rm -f /tmp/test_cube.stl /tmp/test_output.step

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  ✅ All tests passed!                     ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "You can now:"
echo "  1. Open http://localhost:5173 in browser"
echo "  2. Import an STL file"
echo "  3. Click 'Convert to STEP'"
echo ""
