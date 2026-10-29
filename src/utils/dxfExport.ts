/**
 * DXF Export Utility
 * Generates DXF files from sketch data for CAD import
 */

import { Sketch, SketchPlane, SketchElement } from '../types';
import { unprojectFromPlane } from './sketchGeometry';

/**
 * Generate DXF file content from sketches
 */
export function generateDXF(
  sketches: Sketch[],
  sketchPlanes: SketchPlane[],
  units: string = 'mm'
): string {
  const lines: string[] = [];
  
  // DXF Header
  lines.push('0');
  lines.push('SECTION');
  lines.push('2');
  lines.push('HEADER');
  lines.push('9');
  lines.push('$ACADVER');
  lines.push('1');
  lines.push('AC1015'); // AutoCAD 2000 format
  lines.push('9');
  lines.push('$INSUNITS');
  lines.push('70');
  lines.push(units === 'mm' ? '4' : units === 'cm' ? '5' : units === 'in' ? '1' : '0');
  lines.push('0');
  lines.push('ENDSEC');
  
  // Tables Section
  lines.push('0');
  lines.push('SECTION');
  lines.push('2');
  lines.push('TABLES');
  
  // Layer table
  lines.push('0');
  lines.push('TABLE');
  lines.push('2');
  lines.push('LAYER');
  lines.push('70');
  lines.push(String(sketches.length));
  
  sketches.forEach((sketch, idx) => {
    lines.push('0');
    lines.push('LAYER');
    lines.push('2');
    lines.push(`Sketch_${idx + 1}`);
    lines.push('70');
    lines.push('0');
    lines.push('62');
    lines.push(String(idx + 1)); // Color index
    lines.push('6');
    lines.push('CONTINUOUS');
  });
  
  lines.push('0');
  lines.push('ENDTAB');
  lines.push('0');
  lines.push('ENDSEC');
  
  // Entities Section
  lines.push('0');
  lines.push('SECTION');
  lines.push('2');
  lines.push('ENTITIES');
  
  sketches.forEach((sketch, sketchIdx) => {
    const plane = sketchPlanes.find(p => p.id === sketch.planeId);
    if (!plane) return;
    
    const layerName = `Sketch_${sketchIdx + 1}`;
    
    sketch.elements.forEach(element => {
      const entities = elementToDXF(element, plane, layerName);
      lines.push(...entities);
    });
  });
  
  lines.push('0');
  lines.push('ENDSEC');
  
  // EOF
  lines.push('0');
  lines.push('EOF');
  
  return lines.join('\n');
}

/**
 * Convert a sketch element to DXF entities
 */
function elementToDXF(
  element: SketchElement,
  plane: SketchPlane,
  layerName: string
): string[] {
  const lines: string[] = [];
  
  switch (element.type) {
    case 'line': {
      const p1 = unprojectFromPlane(plane, element.points[0]);
      const p2 = unprojectFromPlane(plane, element.points[1]);
      
      lines.push('0');
      lines.push('LINE');
      lines.push('8');
      lines.push(layerName);
      lines.push('10');
      lines.push(String(p1[0]));
      lines.push('20');
      lines.push(String(p1[1]));
      lines.push('30');
      lines.push(String(p1[2]));
      lines.push('11');
      lines.push(String(p2[0]));
      lines.push('21');
      lines.push(String(p2[1]));
      lines.push('31');
      lines.push(String(p2[2]));
      break;
    }
    
    case 'polyline': {
      const points = element.points.map(p => unprojectFromPlane(plane, p));
      
      lines.push('0');
      lines.push('LWPOLYLINE');
      lines.push('8');
      lines.push(layerName);
      lines.push('90');
      lines.push(String(points.length));
      lines.push('70');
      lines.push(element.closed ? '1' : '0'); // Closed flag
      
      points.forEach(p => {
        lines.push('10');
        lines.push(String(p[0]));
        lines.push('20');
        lines.push(String(p[1]));
        lines.push('30');
        lines.push(String(p[2]));
      });
      break;
    }
    
    case 'circle3p': {
      // Calculate circle from 3 points
      const p1 = element.points[0];
      const p2 = element.points[1];
      const p3 = element.points[2];
      
      // Use circumcircle formula
      const ax = p1[0], ay = p1[1];
      const bx = p2[0], by = p2[1];
      const cx = p3[0], cy = p3[1];
      
      const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
      if (Math.abs(d) < 1e-10) break;
      
      const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
      const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
      
      const center2D: [number, number] = [ux, uy];
      const radius = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);
      
      const center3D = unprojectFromPlane(plane, center2D);
      
      lines.push('0');
      lines.push('CIRCLE');
      lines.push('8');
      lines.push(layerName);
      lines.push('10');
      lines.push(String(center3D[0]));
      lines.push('20');
      lines.push(String(center3D[1]));
      lines.push('30');
      lines.push(String(center3D[2]));
      lines.push('40');
      lines.push(String(radius));
      break;
    }
    
    case 'arc3p': {
      // For arcs, we'll export as a polyline approximation
      // TODO: Implement proper ARC entity
      const points = element.points.map(p => unprojectFromPlane(plane, p));
      
      lines.push('0');
      lines.push('LWPOLYLINE');
      lines.push('8');
      lines.push(layerName);
      lines.push('90');
      lines.push(String(points.length));
      lines.push('70');
      lines.push('0'); // Open
      
      points.forEach(p => {
        lines.push('10');
        lines.push(String(p[0]));
        lines.push('20');
        lines.push(String(p[1]));
        lines.push('30');
        lines.push(String(p[2]));
      });
      break;
    }
    
    case 'spline': {
      // Export spline as polyline approximation
      const points = element.points.map(p => unprojectFromPlane(plane, p));
      
      lines.push('0');
      lines.push('LWPOLYLINE');
      lines.push('8');
      lines.push(layerName);
      lines.push('90');
      lines.push(String(points.length));
      lines.push('70');
      lines.push('0'); // Open
      
      points.forEach(p => {
        lines.push('10');
        lines.push(String(p[0]));
        lines.push('20');
        lines.push(String(p[1]));
        lines.push('30');
        lines.push(String(p[2]));
      });
      break;
    }
  }
  
  return lines;
}

/**
 * Download DXF file
 */
export function downloadDXF(
  sketches: Sketch[],
  sketchPlanes: SketchPlane[],
  filename: string,
  units: string = 'mm'
): void {
  const dxfContent = generateDXF(sketches, sketchPlanes, units);
  const blob = new Blob([dxfContent], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
