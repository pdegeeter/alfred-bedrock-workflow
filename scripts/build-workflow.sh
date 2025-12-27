#!/bin/bash
set -euo pipefail

# Build Alfred Bedrock Workflow
# Creates bedrock.alfredworkflow package

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build/workflow"
OUTPUT_FILE="$PROJECT_ROOT/bedrock.alfredworkflow"

echo "Building Alfred Bedrock Workflow..."

# Clean previous build
rm -rf "$BUILD_DIR"
rm -f "$OUTPUT_FILE"

# Create build directory
mkdir -p "$BUILD_DIR"

# Copy workflow files
echo "Copying workflow files..."

# Copy info.plist (workflow configuration)
if [[ -f "$PROJECT_ROOT/info.plist" ]]; then
    cp "$PROJECT_ROOT/info.plist" "$BUILD_DIR/"
else
    echo "Error: info.plist not found" >&2
    exit 1
fi

# Copy icon
if [[ -f "$PROJECT_ROOT/icons/icon.png" ]]; then
    cp "$PROJECT_ROOT/icons/icon.png" "$BUILD_DIR/icon.png"
else
    echo "Warning: icons/icon.png not found, workflow will have no icon" >&2
fi

# Copy compiled JavaScript files
if [[ -d "$PROJECT_ROOT/dist/Command" ]]; then
    cp -r "$PROJECT_ROOT/dist/"* "$BUILD_DIR/"
else
    echo "Error: dist/Command not found. Run 'pnpm build' first." >&2
    exit 1
fi

# Create .alfredworkflow package (zip archive)
echo "Creating bedrock.alfredworkflow..."
cd "$BUILD_DIR"
zip -r "$OUTPUT_FILE" . -x "*.DS_Store" -x "__MACOSX/*"

echo "Successfully created: $OUTPUT_FILE"
