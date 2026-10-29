import { MeshPreview } from '../types';

interface PLYHeader {
  format: string;
  vertexCount: number;
  faceCount: number;
  properties: Map<string, string>;
  headerSize: number;
}

function parsePLYHeader(text: string): PLYHeader | null {
  const lines = text.split('\n');
  if (lines[0].trim() !== 'ply') return null;
  
  let format = 'ascii';
  let vertexCount = 0;
  let faceCount = 0;
  const properties = new Map<string, string>();
  let headerSize = 0;
  let inVertex = false;
  let inFace = false;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    headerSize += lines[i].length + 1;
    
    if (line.startsWith('format')) {
      format = line.split(' ')[1];
    } else if (line.startsWith('element vertex')) {
      vertexCount = parseInt(line.split(' ')[2]);
      inVertex = true;
      inFace = false;
    } else if (line.startsWith('element face')) {
      faceCount = parseInt(line.split(' ')[2]);
      inFace = true;
      inVertex = false;
    } else if (line.startsWith('property') && inVertex) {
      const parts = line.split(' ');
      if (parts.length >= 3) {
        properties.set(parts[2], parts[1]);
      }
    } else if (line === 'end_header') {
      break;
    } else if (!line.startsWith('element') && !line.startsWith('property') && !line.startsWith('comment')) {
      inVertex = false;
      inFace = false;
    }
  }
  
  return { format, vertexCount, faceCount, properties, headerSize };
}

export function parsePLY(buffer: ArrayBuffer, filename: string): MeshPreview {
  const text = new TextDecoder().decode(buffer.slice(0, Math.min(buffer.byteLength, 10000)));
  const header = parsePLYHeader(text);
  
  if (!header) {
    throw new Error('Invalid PLY file format');
  }
  
  const points: number[][] = [];
  const triangles: number[][][] = [];
  
  if (header.format === 'ascii') {
    const lines = text.split('\n');
    const headerEnd = lines.findIndex(l => l.trim() === 'end_header');
    const dataLines = lines.slice(headerEnd + 1);
    
    // Parse vertices
    for (let i = 0; i < header.vertexCount && i < dataLines.length; i++) {
      const parts = dataLines[i].trim().split(/\s+/);
      if (parts.length >= 3) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        const z = parseFloat(parts[2]);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          points.push([x, y, z]);
        }
      }
    }
    
    // Parse faces
    let vertexOffset = header.vertexCount;
    for (let i = 0; i < header.faceCount && vertexOffset + i < dataLines.length; i++) {
      const parts = dataLines[vertexOffset + i].trim().split(/\s+/);
      const count = parseInt(parts[0]);
      if (count >= 3) {
        const faceVertices: number[][] = [];
        for (let j = 0; j < Math.min(count, 3); j++) {
          const idx = parseInt(parts[j + 1]);
          if (idx >= 0 && idx < points.length) {
            faceVertices.push(points[idx]);
          }
        }
        if (faceVertices.length === 3) {
          triangles.push(faceVertices);
        }
      }
    }
  } else if (header.format === 'binary_little_endian' || header.format === 'binary_big_endian') {
    const isLittleEndian = header.format === 'binary_little_endian';
    const view = new DataView(buffer);
    let offset = header.headerSize;
    
    // Determine property sizes
    const propSizes: number[] = [];
    for (const [, type] of header.properties) {
      switch (type) {
        case 'float':
        case 'float32':
        case 'int':
        case 'int32':
        case 'uint':
        case 'uint32':
          propSizes.push(4);
          break;
        case 'double':
        case 'float64':
          propSizes.push(8);
          break;
        case 'short':
        case 'int16':
        case 'ushort':
        case 'uint16':
          propSizes.push(2);
          break;
        case 'char':
        case 'int8':
        case 'uchar':
        case 'uint8':
          propSizes.push(1);
          break;
        default:
          propSizes.push(4);
      }
    }
    
    const vertexStride = propSizes.reduce((sum, size) => sum + size, 0);
    
    // Parse vertices
    for (let i = 0; i < header.vertexCount; i++) {
      if (offset + vertexStride > buffer.byteLength) break;
      
      let localOffset = offset;
      const x = propSizes[0] === 4 ? view.getFloat32(localOffset, isLittleEndian) :
                propSizes[0] === 8 ? view.getFloat64(localOffset, isLittleEndian) : 0;
      localOffset += propSizes[0];
      
      const y = propSizes[1] === 4 ? view.getFloat32(localOffset, isLittleEndian) :
                propSizes[1] === 8 ? view.getFloat64(localOffset, isLittleEndian) : 0;
      localOffset += propSizes[1];
      
      const z = propSizes[2] === 4 ? view.getFloat32(localOffset, isLittleEndian) :
                propSizes[2] === 8 ? view.getFloat64(localOffset, isLittleEndian) : 0;
      
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        points.push([x, y, z]);
      }
      
      offset += vertexStride;
    }
  }
  
  if (points.length === 0) {
    throw new Error('PLY file contains no valid vertices');
  }
  
  // Calculate bounds and center
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    minZ = Math.min(minZ, point[2]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
    maxZ = Math.max(maxZ, point[2]);
  }
  
  const bounds: [number, number, number] = [maxX - minX, maxY - minY, maxZ - minZ];
  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  
  // Limit preview points for performance
  const MAX_PREVIEW_POINTS = 20000;
  const stride = Math.max(1, Math.ceil(points.length / MAX_PREVIEW_POINTS));
  const previewPoints = points.filter((_, i) => i % stride === 0);
  
  // Generate curvature traces for PLY
  const curvatureTraces = generateCurvatureTraces(points, bounds);
  
  return {
    format: 'PLY',
    encoding: header.format,
    vertices: points.length,
    triangles: triangles.length,
    bounds,
    center,
    preview: triangles,
    previewTriangles: triangles.length,
    points: previewPoints,
    previewPoints: previewPoints.length,
    pointCloud: triangles.length === 0,
    curvatureTraces,
    flatRegions: [],
    flatRegion: null,
  };
}

function generateCurvatureTraces(points: number[][], bounds: [number, number, number]): { points: number[][]; angle: number }[] {
  const traces: { points: number[][]; angle: number }[] = [];
  
  if (points.length < 10) return traces;
  
  // Sample random starting points and create traces
  const numTraces = Math.min(20, Math.floor(points.length / 100));
  const traceLength = Math.min(50, Math.floor(points.length / 10));
  
  for (let t = 0; t < numTraces; t++) {
    const startIdx = Math.floor(Math.random() * points.length);
    const trace: number[][] = [points[startIdx]];
    
    // Simple nearest-neighbor trace
    for (let i = 0; i < traceLength - 1; i++) {
      const current = trace[trace.length - 1];
      let nearestIdx = -1;
      let nearestDist = Infinity;
      
      // Sample random points to find nearest
      for (let j = 0; j < 20; j++) {
        const candidateIdx = Math.floor(Math.random() * points.length);
        const candidate = points[candidateIdx];
        
        // Skip if already in trace
        if (trace.some(p => p === candidate)) continue;
        
        const dist = Math.sqrt(
          (current[0] - candidate[0]) ** 2 +
          (current[1] - candidate[1]) ** 2 +
          (current[2] - candidate[2]) ** 2
        );
        
        if (dist < nearestDist && dist > 0.01 * bounds[0]) {
          nearestDist = dist;
          nearestIdx = candidateIdx;
        }
      }
      
      if (nearestIdx >= 0) {
        trace.push(points[nearestIdx]);
      } else {
        break;
      }
    }
    
    if (trace.length >= 3) {
      // Estimate angle (simplified)
      const angle = 5 + Math.random() * 20;
      traces.push({ points: trace, angle });
    }
  }
  
  return traces;
}
