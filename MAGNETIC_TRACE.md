# Magnetic Trace Implementation

## Overview
The Magnetic Trace tool is the core innovation of the Mesh2CAD application. It allows users to draw precise sketches on mesh surfaces by intelligently snapping to detected geometric features (edges, vertices, and midpoints).

## Implementation Details

### 1. Snap Detection System (`src/utils/snapDetector.ts`)

#### Key Functions:

**`extractVertices(preview: MeshPreview): THREE.Vector3[]`**
- Extracts unique vertices from mesh triangles
- Uses a Map with string keys to deduplicate vertices
- Returns array of 3D vertex positions

**`findSnapPoint(point: THREE.Vector3, preview: MeshPreview, maxDistance: number): SnapResult`**
- Main snap detection algorithm
- Checks proximity to:
  - **Vertices**: Exact mesh vertex positions
  - **Edges**: Boundary edges between flat regions
  - **Edge midpoints**: Center points of edges
- Returns snapped position if within `maxDistance` threshold
- Uses vector math to find closest point on edge segments

**`calculateSnapRadius(preview: MeshPreview, percentage: number = 0.02): number`**
- Calculates snap radius as percentage of mesh's maximum dimension
- Default: 2% of max dimension (X, Y, or Z)
- Ensures snap tolerance scales with model size

#### Snap Priority:
1. **Vertices** (highest priority) - Exact positions
2. **Edge midpoints** - Center of boundary edges
3. **Edge segments** - Any point along boundary edges

### 2. Viewport Integration (`src/components/Viewport.tsx`)

#### Magnetic Snapping on Click:
```typescript
// When user clicks during drawing:
1. Get 3D click position via raycasting
2. Check distance to sketch plane (15% tolerance)
3. Apply magnetic snapping:
   - Calculate snap radius (2% of max dimension)
   - Find nearest snap point (vertex/edge/midpoint)
   - If found: use snapped position
   - If not found: use original click position
4. Project to 2D sketch plane coordinates
5. Add to drawing points
```

#### Real-time Snap Indicator:
- **Mouse move detection**: Continuously checks for snap points as cursor moves
- **Visual feedback**: Shows "⚡ Snapped to [type]" in drawing indicator
- **Snap types displayed**:
  - `vertex` - Mesh vertex
  - `edge` - Boundary edge
  - `edge-midpoint` - Edge center point

### 3. User Experience Flow

#### Drawing with Magnetic Trace:
1. **Select drawing tool** (Line, Circle3P, Arc3P, Polyline, Spline)
2. **Hover over mesh**: Snap indicator appears when near features
3. **Click to place point**:
   - If near vertex/edge: automatically snaps to exact position
   - If not near feature: uses click position
4. **Visual feedback**: Green dots show placed points, yellow indicator shows snap
5. **Complete shape**:
   - Line: 2 points
   - Circle/Arc: 3 points
   - Polyline/Spline: Multiple points + Enter to close

#### Undo/Cancel:
- **Backspace/Ctrl+Z**: Remove last placed point
- **Escape**: Cancel current drawing
- **Enter**: Close polyline/spline

### 4. Technical Benefits

#### Precision:
- Snapping to vertices ensures exact geometric positions
- Edge snapping follows mesh topology
- Eliminates manual alignment errors

#### Efficiency:
- Reduces number of clicks needed
- Automatic feature detection
- Faster sketch creation

#### Accuracy:
- Snapped points align with mesh geometry
- Better foundation for CAD reconstruction
- Preserves design intent

### 5. Configuration

#### Snap Radius:
- Default: 2% of maximum mesh dimension
- Adjustable via `calculateSnapRadius(preview, percentage)`
- Larger percentage = more aggressive snapping
- Smaller percentage = more precise, less snapping

#### Plane Tolerance:
- Default: 15% of maximum dimension
- Points must be within this distance from sketch plane
- Prevents accidental snaps on wrong planes

### 6. Future Enhancements

#### Potential Improvements:
1. **Curvature-based snapping**: Snap to high-curvature regions
2. **Symmetry detection**: Snap to symmetric features
3. **Constraint inference**: Auto-detect horizontal/vertical/parallel
4. **Multi-snap modes**: Toggle between vertex/edge/midpoint priority
5. **Snap preview**: Show snap target before clicking
6. **Custom snap radius**: User-adjustable snap tolerance
7. **Feature recognition**: Auto-detect circles, rectangles, etc.

### 7. Integration with CAD Export

The snapped sketch points are:
1. Stored as 2D coordinates on sketch planes
2. Exported as JSON project data
3. Can be converted to DXF/SVG for CAD import
4. Preserve geometric precision from mesh to CAD

## Testing Checklist

- [ ] Snap to vertex works correctly
- [ ] Snap to edge works correctly
- [ ] Snap to edge midpoint works correctly
- [ ] Snap indicator shows correct type
- [ ] Snap radius scales with model size
- [ ] Undo removes snapped points correctly
- [ ] Snapped points project correctly to 2D
- [ ] Different drawing tools work with snapping
- [ ] Snap doesn't interfere with face selection
- [ ] Performance acceptable with large meshes

## Code References

- **Snap Detection**: `src/utils/snapDetector.ts`
- **Viewport Integration**: `src/components/Viewport.tsx` (handleViewportClick, handleMouseMove)
- **Sketch Geometry**: `src/utils/sketchGeometry.ts` (projectToPlane, unprojectFromPlane)
- **Types**: `src/types.ts` (SnapPoint, SnapResult interfaces)
