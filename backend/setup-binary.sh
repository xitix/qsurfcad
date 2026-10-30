#!/bin/bash
# Setup script for stl2step binary
# Downloads from GitHub or creates symlink to local build

set -e

echo "╔═══════════════════════════════════════════╗"
echo "║  stl2step Binary Setup                    ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

BINARY_PATH="./stl2step"
GITHUB_URL="https://github.com/xitix/qwensurfcad/raw/main/bin/stl2step"
LOCAL_PATH="/home/xitix5r/Downloads/Delete/stl2step/build/stl2step"

# Check if binary already exists
if [ -f "$BINARY_PATH" ]; then
    echo "✅ stl2step binary already exists"
    ./stl2step --version
    exit 0
fi

echo "Choose setup method:"
echo "1. Download from GitHub (recommended)"
echo "2. Create symlink to local build"
echo "3. Copy local build"
echo ""

read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo "📥 Downloading from GitHub..."
        curl -L -o "$BINARY_PATH" "$GITHUB_URL"
        chmod +x "$BINARY_PATH"
        echo "✅ Downloaded successfully"
        ;;
    2)
        if [ ! -f "$LOCAL_PATH" ]; then
            echo "❌ Local build not found at: $LOCAL_PATH"
            exit 1
        fi
        echo "🔗 Creating symlink..."
        ln -s "$LOCAL_PATH" "$BINARY_PATH"
        echo "✅ Symlink created"
        ;;
    3)
        if [ ! -f "$LOCAL_PATH" ]; then
            echo "❌ Local build not found at: $LOCAL_PATH"
            exit 1
        fi
        echo "📋 Copying local build..."
        cp "$LOCAL_PATH" "$BINARY_PATH"
        chmod +x "$BINARY_PATH"
        echo "✅ Copied successfully"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "Testing binary..."
./stl2step --version

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Install dependencies: npm install"
echo "  2. Start server: node server.js"
