import { MeshPreview, FlatRegion } from '../types';

function parseBinarySTL(buffer: ArrayBuffer): { triangles: number[][][]; isBinary: boolean } {
  const view = new DataView(buffer);
  
  // Binary STL: 80 byte header + 4 byte triangle count + 50 bytes per triangle
  if (buffer.byteLength < 84) {
    return { triangles: [], isBinary: false };
  }
  
  const numTriangles = view.getUint32(80, true);
  const expectedSize = 84 + numTriangles * 50;
  
  if (buffer.byteLength >= expectedSize && expectedSize > 84) {
    const triangles: number[][][] = [];
    let offset = 84;
    
    for (let i = 0; i < numTriangles; i++) {
      // Normal (3 floats) - skip
      offset += 12;
      
      // Vertex 1
      const v1x = view.getFloat32(offset, true); offset += 4;
      const v1y = view.getFloat32(offset, true); offset += 4;
      const v1z = view.getFloat32(offset, true); offset += 4;
      
      // Vertex 2
      const v2x = view.getFloat32(offset, true); offset += 4;
      const v2y = view.getFloat32(offset, true); offset += 4;
      const v2z = view.getFloat32(offset, true); offset += 4;
      
      // Vertex 3
      const v3x = view.getFloat32(offset, true); offset += 4;
      const v3y = view.getFloat32(offset, true); offset += 4;
      const v3z = view.getFloat32(offset, true); offset += 4;
      
      // Attribute byte count - skip
      offset += 2;
      
      triangles.push([
        [v1x, v1y, v1z],
        [v2x, v2y, v2z],
        [v3x, v3y, v3z],
      ]);
    }
    
    return { triangles, isBinary: true };
  }
  
  return { triangles: [], isBinary: false };
}

function parseAsciiSTL(text: string): { triangles: number[][][]; isAscii: boolean } {
  const triangles: number[][][] = [];
  const vertexRegex = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/gi;
  
  let match;
  let currentVertices: number[][] = [];
  
  while ((match = vertexRegex.exec(text)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const z = parseFloat(match[3]);
    
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      currentVertices.push([x, y, z]);
      
      if (currentVertices.length === 3) {
        triangles.push([...currentVertices]);
        currentVertices = [];
      }
    }
  }
  
  return { triangles, isAscii: triangles.length > 0 };
}

export function parseSTL(buffer: ArrayBuffer, filename: string): MeshPreview {
  // Try binary first
  let triangles: number[][][] = [];
  const binaryResult = parseBinarySTL(buffer);
  
  if (binaryResult.isBinary && binaryResult.triangles.length > 0) {
    triangles = binaryResult.triangles;
  } else {
    // Try ASCII
    const text = new TextDecoder().decode(buffer);
    const asciiResult = parseAsciiSTL(text);
    if (asciiResult.isAscii && asciiResult.triangles.length > 0) {
      triangles = asciiResult.triangles;
    }
  }
  
  if (triangles.length === 0) {
    throw new Error('Could not parse STL file. No valid triangles found.');
  }
  
  // Calculate bounds and center
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  const allVertices: number[][] = [];
  
  for (const tri of triangles) {
    for (const vertex of tri) {
      allVertices.push(vertex);
      minX = Math.min(minX, vertex[0]);
      minY = Math.min(minY, vertex[1]);
      minZ = Math.min(minZ, vertex[2]);
      maxX = Math.max(maxX, vertex[0]);
      maxY = Math.max(maxY, vertex[1]);
      maxZ = Math.max(maxZ, vertex[2]);
    }
  }
  
  const bounds: [number, number, number] = [maxX - minX, maxY - minY, maxZ - minZ];
  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  
  // Use all triangles for preview (modern browsers can handle it)
  // Only limit if absolutely necessary for very large meshes
  const MAX_PREVIEW = 500000;
  let previewTriangles: number[][][];
  
  if (triangles.length > MAX_PREVIEW) {
    // For very large meshes, use intelligent sampling that preserves mesh structure
    const stride = Math.ceil(triangles.length / MAX_PREVIEW);
    previewTriangles = triangles.filter((_, i) => i % stride === 0);
  } else {
    previewTriangles = triangles;
  }
  
  // Detect flat regions
  const flatRegions = detectFlatRegions(previewTriangles, bounds);
  
  return {
    format: 'STL',
    vertices: allVertices.length,
    triangles: triangles.length,
    bounds,
    center,
    preview: previewTriangles,
    previewTriangles: previewTriangles.length,
    flatRegions,
    flatRegion: flatRegions[0] || null,
  };
}

function detectFlatRegions(triangles: number[][][], bounds: [number, number, number]): FlatRegion[] {
  const regions: FlatRegion[] = [];
  const normalThreshold = 0.98; // cos(11.5°) - faces within ~11.5° of each other
  const minRegionSize = Math.max(3, Math.floor(triangles.length * 0.005));
  
  // Group triangles by their normal direction
  const normalGroups: { normal: [number, number, number]; indices: number[] }[] = [];
  
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    const a = tri[0];
    const b = tri[1];
    const c = tri[2];
    
    // Calculate face normal
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = ab[1] * ac[2] - ab[2] * ac[1];
    const ny = ab[2] * ac[0] - ab[0] * ac[2];
    const nz = ab[0] * ac[1] - ab[1] * ac[0];
    const mag = Math.sqrt(nx * nx + ny * ny + nz * nz);
    
    if (mag < 1e-12) continue;
    
    const normal: [number, number, number] = [nx / mag, ny / mag, nz / mag];
    
    // Find existing group with similar normal
    let found = false;
    for (const group of normalGroups) {
      const dot = Math.abs(
        normal[0] * group.normal[0] +
        normal[1] * group.normal[1] +
        normal[2] * group.normal[2]
      );
      
      if (dot > normalThreshold) {
        group.indices.push(i);
        // Update average normal
        const n = group.indices.length;
        group.normal = [
          (group.normal[0] * (n - 1) + normal[0]) / n,
          (group.normal[1] * (n - 1) + normal[1]) / n,
          (group.normal[2] * (n - 1) + normal[2]) / n,
        ];
        found = true;
        break;
      }
    }
    
    if (!found) {
      normalGroups.push({ normal, indices: [i] });
    }
  }
  
  // Filter groups that are large enough to be "flat regions"
  const largeGroups = normalGroups
    .filter(g => g.indices.length >= minRegionSize)
    .sort((a, b) => b.indices.length - a.indices.length)
    .slice(0, 8);
  
  for (const group of largeGroups) {
    // Normalize the average normal
    const mag = Math.sqrt(
      group.normal[0] ** 2 + group.normal[1] ** 2 + group.normal[2] ** 2
    );
    const normal: [number, number, number] = [
      group.normal[0] / mag,
      group.normal[1] / mag,
      group.normal[2] / mag,
    ];
    
    // Calculate center of region
    let cx = 0, cy = 0, cz = 0;
    for (const idx of group.indices) {
      const tri = triangles[idx];
      cx += (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
      cy += (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      cz += (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
    }
    const n = group.indices.length;
    cx /= n;
    cy /= n;
    cz /= n;
    
    // Determine side label
    const absNormal = [Math.abs(normal[0]), Math.abs(normal[1]), Math.abs(normal[2])];
    let side = 'interior';
    if (absNormal[2] > absNormal[0] && absNormal[2] > absNormal[1]) {
      side = normal[2] > 0 ? 'upper' : 'lower';
    } else if (absNormal[0] > absNormal[1]) {
      side = normal[0] > 0 ? 'right' : 'left';
    } else {
      side = normal[1] > 0 ? 'front' : 'back';
    }
    
    // Count connected patches (simplified - just count based on spatial separation)
    const connectedPatches = estimateConnectedPatches(triangles, group.indices);
    
    const previewAreaPercent = (group.indices.length / triangles.length) * 100;
    
    regions.push({
      normal,
      center: [cx, cy, cz],
      side,
      previewAreaPercent: Math.round(previewAreaPercent * 10) / 10,
      previewFacets: group.indices.length,
      connectedPatches,
      previewIndices: group.indices,
    });
  }
  
  return regions;
}

function estimateConnectedPatches(triangles: number[][][], indices: number[]): number {
  if (indices.length <= 1) return indices.length > 0 ? 1 : 0;
  
  // Simple spatial clustering - group by proximity
  const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  
  for (const idx of indices) {
    const tri = triangles[idx];
    for (const v of tri) {
      bounds.minX = Math.min(bounds.minX, v[0]);
      bounds.minY = Math.min(bounds.minY, v[1]);
      bounds.minZ = Math.min(bounds.minZ, v[2]);
      bounds.maxX = Math.max(bounds.maxX, v[0]);
      bounds.maxY = Math.max(bounds.maxY, v[1]);
      bounds.maxZ = Math.max(bounds.maxZ, v[2]);
    }
  }
  
  const diag = Math.sqrt(
    (bounds.maxX - bounds.minX) ** 2 +
    (bounds.maxY - bounds.minY) ** 2 +
    (bounds.maxZ - bounds.minZ) ** 2
  );
  
  if (diag < 1e-6) return 1;
  
  // Use grid-based clustering
  const gridSize = diag * 0.3;
  const clusters = new Set<string>();
  
  for (const idx of indices) {
    const tri = triangles[idx];
    const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    const cz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
    
    const gx = Math.floor(cx / gridSize);
    const gy = Math.floor(cy / gridSize);
    const gz = Math.floor(cz / gridSize);
    
    clusters.add(`${gx},${gy},${gz}`);
  }
  
  return Math.min(clusters.size, 4);
}
