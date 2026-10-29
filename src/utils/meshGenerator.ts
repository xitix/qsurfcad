import { MeshPreview, FlatRegion } from '../types';

function generateTorusMesh(name: string): MeshPreview {
  const majorRadius = 30;
  const minorRadius = 10;
  const majorSegments = 24;
  const minorSegments = 12;
  
  const preview: number[][][] = [];
  const points: number[][] = [];
  let triangleCount = 0;
  
  const minX = Infinity, minY = Infinity, minZ = Infinity;
  const maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let actualMinX = minX, actualMinY = minY, actualMinZ = minZ;
  let actualMaxX = maxX, actualMaxY = maxY, actualMaxZ = maxZ;
  
  for (let i = 0; i < majorSegments; i++) {
    for (let j = 0; j < minorSegments; j++) {
      const u1 = (i / majorSegments) * Math.PI * 2;
      const u2 = ((i + 1) / majorSegments) * Math.PI * 2;
      const v1 = (j / minorSegments) * Math.PI * 2;
      const v2 = ((j + 1) / minorSegments) * Math.PI * 2;
      
      const p1 = [
        (majorRadius + minorRadius * Math.cos(v1)) * Math.cos(u1),
        (majorRadius + minorRadius * Math.cos(v1)) * Math.sin(u1),
        minorRadius * Math.sin(v1),
      ];
      const p2 = [
        (majorRadius + minorRadius * Math.cos(v2)) * Math.cos(u1),
        (majorRadius + minorRadius * Math.cos(v2)) * Math.sin(u1),
        minorRadius * Math.sin(v2),
      ];
      const p3 = [
        (majorRadius + minorRadius * Math.cos(v2)) * Math.cos(u2),
        (majorRadius + minorRadius * Math.cos(v2)) * Math.sin(u2),
        minorRadius * Math.sin(v2),
      ];
      const p4 = [
        (majorRadius + minorRadius * Math.cos(v1)) * Math.cos(u2),
        (majorRadius + minorRadius * Math.cos(v1)) * Math.sin(u2),
        minorRadius * Math.sin(v1),
      ];
      
      preview.push([p1, p2, p3]);
      preview.push([p1, p3, p4]);
      triangleCount += 2;
      
      for (const p of [p1, p2, p3, p4]) {
        points.push(p);
        actualMinX = Math.min(actualMinX, p[0]);
        actualMinY = Math.min(actualMinY, p[1]);
        actualMinZ = Math.min(actualMinZ, p[2]);
        actualMaxX = Math.max(actualMaxX, p[0]);
        actualMaxY = Math.max(actualMaxY, p[1]);
        actualMaxZ = Math.max(actualMaxZ, p[2]);
      }
    }
  }
  
  const bounds: [number, number, number] = [
    actualMaxX - actualMinX,
    actualMaxY - actualMinY,
    actualMaxZ - actualMinZ,
  ];
  const center: [number, number, number] = [
    (actualMinX + actualMaxX) / 2,
    (actualMinY + actualMaxY) / 2,
    (actualMinZ + actualMaxZ) / 2,
  ];
  
  // Detect flat regions (top and bottom of torus)
  const flatRegions: FlatRegion[] = [];
  
  // Top region
  const topIndices: number[] = [];
  const bottomIndices: number[] = [];
  preview.forEach((tri, idx) => {
    const avgZ = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
    if (avgZ > minorRadius * 0.85) topIndices.push(idx);
    if (avgZ < -minorRadius * 0.85) bottomIndices.push(idx);
  });
  
  if (topIndices.length > 0) {
    flatRegions.push({
      normal: [0, 0, 1],
      center: [0, 0, minorRadius * 0.9],
      side: 'upper',
      previewAreaPercent: 5.2,
      previewFacets: topIndices.length,
      connectedPatches: 1,
      previewIndices: topIndices,
    });
  }
  
  if (bottomIndices.length > 0) {
    flatRegions.push({
      normal: [0, 0, -1],
      center: [0, 0, -minorRadius * 0.9],
      side: 'lower',
      previewAreaPercent: 5.2,
      previewFacets: bottomIndices.length,
      connectedPatches: 1,
      previewIndices: bottomIndices,
    });
  }
  
  // Side region
  const sideIndices: number[] = [];
  preview.forEach((tri, idx) => {
    const avgX = (tri[0][0] + tri[1][0] + tri[2][0]) / 2;
    const avgY = (tri[0][1] + tri[1][1] + tri[2][1]) / 2;
    const dist = Math.sqrt(avgX * avgX + avgY * avgY);
    if (dist > majorRadius + minorRadius * 0.85) sideIndices.push(idx);
  });
  
  if (sideIndices.length > 2) {
    flatRegions.push({
      normal: [1, 0, 0],
      center: [majorRadius + minorRadius, 0, 0],
      side: 'interior',
      previewAreaPercent: 8.5,
      previewFacets: sideIndices.length,
      connectedPatches: 2,
      previewIndices: sideIndices,
    });
  }
  
  return {
    format: 'STL',
    vertices: points.length,
    triangles: triangleCount,
    bounds,
    center,
    preview,
    previewTriangles: preview.length,
    points: points.slice(0, Math.min(points.length, 5000)),
    previewPoints: Math.min(points.length, 5000),
    flatRegions,
    flatRegion: flatRegions[0] || null,
  };
}

function generateSphereMesh(name: string): MeshPreview {
  const radius = 25;
  const segments = 20;
  const rings = 16;
  
  const preview: number[][][] = [];
  const points: number[][] = [];
  let triangleCount = 0;
  
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (let i = 0; i < rings; i++) {
    const theta1 = (i / rings) * Math.PI;
    const theta2 = ((i + 1) / rings) * Math.PI;
    
    for (let j = 0; j < segments; j++) {
      const phi1 = (j / segments) * Math.PI * 2;
      const phi2 = ((j + 1) / segments) * Math.PI * 2;
      
      const p1 = [
        radius * Math.sin(theta1) * Math.cos(phi1),
        radius * Math.sin(theta1) * Math.sin(phi1),
        radius * Math.cos(theta1),
      ];
      const p2 = [
        radius * Math.sin(theta1) * Math.cos(phi2),
        radius * Math.sin(theta1) * Math.sin(phi2),
        radius * Math.cos(theta1),
      ];
      const p3 = [
        radius * Math.sin(theta2) * Math.cos(phi2),
        radius * Math.sin(theta2) * Math.sin(phi2),
        radius * Math.cos(theta2),
      ];
      const p4 = [
        radius * Math.sin(theta2) * Math.cos(phi1),
        radius * Math.sin(theta2) * Math.sin(phi1),
        radius * Math.cos(theta2),
      ];
      
      if (i > 0) {
        preview.push([p1, p2, p3]);
        triangleCount++;
      }
      if (i < rings - 1) {
        preview.push([p1, p3, p4]);
        triangleCount++;
      }
      
      for (const p of [p1, p2, p3, p4]) {
        points.push(p);
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        minZ = Math.min(minZ, p[2]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
        maxZ = Math.max(maxZ, p[2]);
      }
    }
  }
  
  const bounds: [number, number, number] = [maxX - minX, maxY - minY, maxZ - minZ];
  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  
  // Flat regions for sphere
  const flatRegions: FlatRegion[] = [];
  const topIndices: number[] = [];
  const bottomIndices: number[] = [];
  
  preview.forEach((tri, idx) => {
    const avgZ = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
    if (avgZ > radius * 0.9) topIndices.push(idx);
    if (avgZ < -radius * 0.9) bottomIndices.push(idx);
  });
  
  if (topIndices.length > 0) {
    flatRegions.push({
      normal: [0, 0, 1],
      center: [0, 0, radius * 0.95],
      side: 'upper',
      previewAreaPercent: 3.1,
      previewFacets: topIndices.length,
      connectedPatches: 1,
      previewIndices: topIndices,
    });
  }
  
  if (bottomIndices.length > 0) {
    flatRegions.push({
      normal: [0, 0, -1],
      center: [0, 0, -radius * 0.95],
      side: 'lower',
      previewAreaPercent: 3.1,
      previewFacets: bottomIndices.length,
      connectedPatches: 1,
      previewIndices: bottomIndices,
    });
  }
  
  return {
    format: 'STL',
    vertices: points.length,
    triangles: triangleCount,
    bounds,
    center,
    preview,
    previewTriangles: preview.length,
    points: points.slice(0, 3000),
    previewPoints: 3000,
    flatRegions,
    flatRegion: flatRegions[0] || null,
  };
}

function generatePointCloud(name: string): MeshPreview {
  const pointCount = 8000;
  const points: number[][] = [];
  
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  // Generate a scan-like point cloud (partial surface)
  for (let i = 0; i < pointCount; i++) {
    const u = Math.random() * Math.PI * 1.5;
    const v = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 2;
    
    const x = r * Math.sin(u) * Math.cos(v) + (Math.random() - 0.5) * 0.5;
    const y = r * Math.sin(u) * Math.sin(v) + (Math.random() - 0.5) * 0.5;
    const z = r * Math.cos(u) + (Math.random() - 0.5) * 0.5;
    
    points.push([x, y, z]);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  
  const bounds: [number, number, number] = [maxX - minX, maxY - minY, maxZ - minZ];
  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  
  // Generate curvature traces
  const curvatureTraces = [];
  for (let i = 0; i < 12; i++) {
    const tracePoints: number[][] = [];
    const startU = Math.random() * Math.PI;
    const startV = Math.random() * Math.PI * 2;
    const r = 20;
    
    for (let j = 0; j < 8 + Math.floor(Math.random() * 12); j++) {
      const u = startU + j * 0.08;
      const v = startV + j * 0.12 + Math.sin(j * 0.5) * 0.1;
      tracePoints.push([
        r * Math.sin(u) * Math.cos(v),
        r * Math.sin(u) * Math.sin(v),
        r * Math.cos(u),
      ]);
    }
    
    curvatureTraces.push({
      points: tracePoints,
      angle: 2 + Math.random() * 15,
    });
  }
  
  return {
    format: 'PLY',
    encoding: 'binary_little_endian',
    vertices: pointCount,
    triangles: 0,
    bounds,
    center,
    preview: [],
    previewTriangles: 0,
    points,
    previewPoints: points.length,
    pointCloud: true,
    flatRegions: [],
    flatRegion: null,
    curvatureTraces,
  };
}

export function generateDemoMesh(filename: string, workflowId: string): { preview: MeshPreview } {
  const isPLY = workflowId === 'ply-iges' || filename.toLowerCase().endsWith('.ply');
  
  if (isPLY) {
    return { preview: generatePointCloud(filename) };
  }
  
  // Use filename hash to pick a mesh type
  const hash = filename.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  if (hash % 2 === 0) {
    return { preview: generateTorusMesh(filename) };
  } else {
    return { preview: generateSphereMesh(filename) };
  }
}
