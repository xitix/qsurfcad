/**
 * STEP File Generator (ISO 10303-21)
 * Generates STEP files with analytic surfaces (planes, cylinders, circles)
 */

import { DetectedPrimitive, PlanePrimitive, CylinderPrimitive, CirclePrimitive } from './primitiveDetection';
import { MeshPreview } from '../types';

/**
 * Generate STEP file from detected primitives
 */
export function generateSTEP(
  primitives: DetectedPrimitive[],
  preview: MeshPreview,
  projectName: string = 'Mesh2CAD_Export'
): string {
  const lines: string[] = [];
  let entityId = 1;

  // STEP Header
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push('FILE_DESCRIPTION((\'Mesh to STEP conversion\'));');
  lines.push(`FILE_NAME('${projectName}.step','${new Date().toISOString()}',('make3d.ro'),('make3d.ro'),'Mesh2CAD Workbench','Mesh2CAD Workbench','');`);
  lines.push('FILE_SCHEMA((\'AUTOMOTIVE_DESIGN\'));');
  lines.push('ENDSEC;');
  lines.push('DATA;');

  // Create application context
  const appContextId = entityId++;
  lines.push(`#${appContextId} = APPLICATION_CONTEXT('automotive design');`);

  // Create product
  const productId = entityId++;
  lines.push(`#${productId} = PRODUCT('${projectName}','${projectName}','',(#${appContextId}));`);

  // Create product definition
  const prodDefId = entityId++;
  lines.push(`#${prodDefId} = PRODUCT_DEFINITION('design','',#${productId},#${appContextId});`);

  // Create product definition shape
  const prodDefShapeId = entityId++;
  lines.push(`#${prodDefShapeId} = PRODUCT_DEFINITION_SHAPE('','',#${prodDefId});`);

  // Create shape representation
  const shapeRepId = entityId++;
  lines.push(`#${shapeRepId} = SHAPE_REPRESENTATION('',(),(#${appContextId}));`);

  // Create items for each primitive
  const itemIds: number[] = [];

  for (const prim of primitives) {
    const itemId = createPrimitiveEntity(prim, lines, entityId);
    if (itemId > 0) {
      itemIds.push(itemId);
      entityId = itemId + 1;
    }
  }

  // Add items to shape representation
  if (itemIds.length > 0) {
    const itemsList = itemIds.map(id => `#${id}`).join(',');
    lines[lines.findIndex(l => l.includes(`#${shapeRepId} = SHAPE_REPRESENTATION`))] = 
      `#${shapeRepId} = SHAPE_REPRESENTATION('',(${itemsList}),(#${appContextId}));`;
  }

  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  return lines.join('\n');
}

/**
 * Create STEP entities for a primitive
 */
function createPrimitiveEntity(
  prim: DetectedPrimitive,
  lines: string[],
  startId: number
): number {
  let id = startId;

  switch (prim.type) {
    case 'plane': {
      const plane = prim.parameters as PlanePrimitive;
      
      // Create direction
      const dirId = id++;
      lines.push(`#${dirId} = DIRECTION('',(${plane.normal[0]},${plane.normal[1]},${plane.normal[2]}));`);
      
      // Create cartesian point
      const pointId = id++;
      lines.push(`#${pointId} = CARTESIAN_POINT('',(${plane.point[0]},${plane.point[1]},${plane.point[2]}));`);
      
      // Create axis2 placement 3d
      const placementId = id++;
      lines.push(`#${placementId} = AXIS2_PLACEMENT_3D('',#${pointId},#${dirId},$);`);
      
      // Create plane
      const planeId = id++;
      lines.push(`#${planeId} = PLANE('',#${placementId});`);
      
      return planeId;
    }

    case 'cylinder': {
      const cyl = prim.parameters as CylinderPrimitive;
      
      // Create direction (axis)
      const dirId = id++;
      lines.push(`#${dirId} = DIRECTION('',(${cyl.axis[0]},${cyl.axis[1]},${cyl.axis[2]}));`);
      
      // Create cartesian point
      const pointId = id++;
      lines.push(`#${pointId} = CARTESIAN_POINT('',(${cyl.point[0]},${cyl.point[1]},${cyl.point[2]}));`);
      
      // Create axis2 placement 3d
      const placementId = id++;
      lines.push(`#${placementId} = AXIS2_PLACEMENT_3D('',#${pointId},#${dirId},$);`);
      
      // Create cylindrical surface
      const cylId = id++;
      lines.push(`#${cylId} = CYLINDRICAL_SURFACE('',#${placementId},${cyl.radius});`);
      
      return cylId;
    }

    case 'circle': {
      const circle = prim.parameters as CirclePrimitive;
      
      // Create direction (normal)
      const dirId = id++;
      lines.push(`#${dirId} = DIRECTION('',(${circle.normal[0]},${circle.normal[1]},${circle.normal[2]}));`);
      
      // Create cartesian point (center)
      const pointId = id++;
      lines.push(`#${pointId} = CARTESIAN_POINT('',(${circle.center[0]},${circle.center[1]},${circle.center[2]}));`);
      
      // Create axis2 placement 3d
      const placementId = id++;
      lines.push(`#${placementId} = AXIS2_PLACEMENT_3D('',#${pointId},#${dirId},$);`);
      
      // Create circle
      const circleId = id++;
      lines.push(`#${circleId} = CIRCLE('',#${placementId},${circle.radius});`);
      
      return circleId;
    }

    default:
      return 0;
  }
}

/**
 * Download STEP file
 */
export function downloadSTEP(
  primitives: DetectedPrimitive[],
  preview: MeshPreview,
  filename: string,
  projectName: string = 'Mesh2CAD_Export'
): void {
  const stepContent = generateSTEP(primitives, preview, projectName);
  const blob = new Blob([stepContent], { type: 'application/step' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
