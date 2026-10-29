import * as THREE from 'three';
import { MeshPreview, BoundaryEdge } from '../types';

export interface SnapPoint {
  position: THREE.Vector3;
  type: 'vertex' | 'edge' | 'edge-midpoint';
  distance: number;
  edgeIndex?: number;
  vertexIndex?: number;
}

export interface SnapResult {
  snapped: boolean;
  point: THREE.Vector3;
  snapPoint?: SnapPoint;
}

/**
 * Extract unique vertices from mesh triangles
 */
export function extractVertices(preview: MeshPreview): THREE.Vector3[] {
  const vertexMap = new Map<string, THREE.Vector3>();
  
  for (const tri of preview.preview) {
    for (const vertex of tri) {
      const key = `${vertex[0].toFixed(6)},${vertex[1].toFixed(6)},${vertex[2].toFixed(6)}`;
      if (!vertexMap.has(key)) {
        vertexMap.set(key, new THREE.Vector3(vertex[0], vertex[1], vertex[2]));
      }
    }
  }
  
  return Array.from(vertexMap.values());
}

/**
 * Find the nearest snap point (vertex or edge) to a given 3D point
 */
export function findSnapPoint(
  point: THREE.Vector3,
  preview: MeshPreview,
  maxDistance: number
): SnapResult {
  let bestSnap: SnapPoint | null = null;
  let bestDistance = maxDistance;
  
  // Check vertices
  const vertices = extractVertices(preview);
  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i];
    const distance = point.distanceTo(vertex);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSnap = {
        position: vertex.clone(),
        type: 'vertex',
        distance,
        vertexIndex: i,
      };
    }
  }
  
  // Check edges (boundary edges)
  if (preview.boundaryEdges) {
    for (let i = 0; i < preview.boundaryEdges.length; i++) {
      const edge = preview.boundaryEdges[i];
      const edgeStart = new THREE.Vector3(edge.a[0], edge.a[1], edge.a[2]);
      const edgeEnd = new THREE.Vector3(edge.b[0], edge.b[1], edge.b[2]);
      
      // Find closest point on edge
      const edgeDir = new THREE.Vector3().subVectors(edgeEnd, edgeStart);
      const edgeLength = edgeDir.length();
      edgeDir.normalize();
      
      const pointToStart = new THREE.Vector3().subVectors(point, edgeStart);
      const projection = pointToStart.dot(edgeDir);
      const clampedProjection = Math.max(0, Math.min(edgeLength, projection));
      
      const closestPoint = new THREE.Vector3()
        .copy(edgeStart)
        .add(edgeDir.multiplyScalar(clampedProjection));
      
      const distance = point.distanceTo(closestPoint);
      
      if (distance < bestDistance) {
        bestDistance = distance;
        
        // Determine snap type
        if (clampedProjection < edgeLength * 0.1 || clampedProjection > edgeLength * 0.9) {
          // Near edge endpoint - snap to vertex
          const vertexPos = clampedProjection < edgeLength * 0.5 ? edgeStart : edgeEnd;
          bestSnap = {
            position: vertexPos.clone(),
            type: 'vertex',
            distance,
            edgeIndex: i,
          };
        } else if (Math.abs(clampedProjection - edgeLength * 0.5) < edgeLength * 0.05) {
          // Near edge midpoint
          bestSnap = {
            position: closestPoint.clone(),
            type: 'edge-midpoint',
            distance,
            edgeIndex: i,
          };
        } else {
          // Snap to edge
          bestSnap = {
            position: closestPoint.clone(),
            type: 'edge',
            distance,
            edgeIndex: i,
          };
        }
      }
    }
  }
  
  if (bestSnap) {
    return {
      snapped: true,
      point: bestSnap.position,
      snapPoint: bestSnap,
    };
  }
  
  return {
    snapped: false,
    point: point.clone(),
  };
}

/**
 * Calculate snap radius based on mesh size
 */
export function calculateSnapRadius(preview: MeshPreview, percentage: number = 0.02): number {
  const maxDim = Math.max(preview.bounds[0], preview.bounds[1], preview.bounds[2]);
  return maxDim * percentage;
}
