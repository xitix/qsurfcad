/**
 * STL Export Utility
 * Generates binary STL files from mesh data with orientation applied
 */

import { MeshPreview, Orientation } from '../types';
import * as THREE from 'three';

/**
 * Generate binary STL file from mesh preview with orientation applied
 */
export function generateSTL(
  preview: MeshPreview,
  orientation: Orientation
): ArrayBuffer {
  const triangles = preview.preview;
  const numTriangles = triangles.length;
  
  // Binary STL format:
  // 80 bytes header
  // 4 bytes (uint32) number of triangles
  // For each triangle:
  //   12 bytes (3 floats) normal vector
  //   36 bytes (9 floats) 3 vertices
  //   2 bytes attribute byte count
  
  const bufferSize = 80 + 4 + (numTriangles * 50);
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  // Header (80 bytes)
  const header = 'Binary STL exported from QSurfCAD Workbench';
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  }
  
  // Number of triangles
  view.setUint32(80, numTriangles, true);
  
  let offset = 84;
  
  // Apply orientation transform
  const scale = orientation.scale;
  const rotRad = orientation.rotation.map(v => v * Math.PI / 180) as [number, number, number];
  const center = new THREE.Vector3(...preview.center);
  
  for (const tri of triangles) {
    // Transform vertices
    const vertices = tri.map(v => {
      const p = new THREE.Vector3(v[0], v[1], v[2]);
      
      // Apply rotation
      p.applyAxisAngle(new THREE.Vector3(1, 0, 0), rotRad[0]);
      p.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotRad[1]);
      p.applyAxisAngle(new THREE.Vector3(0, 0, 1), rotRad[2]);
      
      // Apply scale
      p.multiplyScalar(scale);
      
      // Apply center offset
      p.sub(center.clone().multiplyScalar(scale));
      
      return p;
    });
    
    // Calculate normal
    const v0 = vertices[0];
    const v1 = vertices[1];
    const v2 = vertices[2];
    
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    
    // Write normal (12 bytes)
    view.setFloat32(offset, normal.x, true); offset += 4;
    view.setFloat32(offset, normal.y, true); offset += 4;
    view.setFloat32(offset, normal.z, true); offset += 4;
    
    // Write vertices (36 bytes)
    for (const v of vertices) {
      view.setFloat32(offset, v.x, true); offset += 4;
      view.setFloat32(offset, v.y, true); offset += 4;
      view.setFloat32(offset, v.z, true); offset += 4;
    }
    
    // Attribute byte count (2 bytes)
    view.setUint16(offset, 0, true); offset += 2;
  }
  
  return buffer;
}

/**
 * Download STL file
 */
export function downloadSTL(
  preview: MeshPreview,
  orientation: Orientation,
  filename: string
): void {
  const buffer = generateSTL(preview, orientation);
  const blob = new Blob([buffer], { type: 'application/sla' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
