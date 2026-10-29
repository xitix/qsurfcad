export type ConstraintType = 
  | 'horizontal'
  | 'vertical'
  | 'parallel'
  | 'perpendicular'
  | 'coincident'
  | 'concentric'
  | 'tangent'
  | 'equal'
  | 'fixed';

export interface Constraint {
  id: string;
  type: ConstraintType;
  entities: string[]; // IDs of constrained entities
  parameters?: Record<string, number>;
}

export interface SketchPoint {
  id: string;
  x: number;
  y: number;
  constraints: string[]; // Constraint IDs
}

export interface SketchLine {
  id: string;
  startId: string;
  endId: string;
  constraints: string[];
}

export interface SketchArc {
  id: string;
  centerId: string;
  startId: string;
  endId: string;
  radius: number;
  constraints: string[];
}

export interface SketchCircle {
  id: string;
  centerId: string;
  radius: number;
  constraints: string[];
}

export interface Sketch {
  points: Map<string, SketchPoint>;
  lines: Map<string, SketchLine>;
  arcs: Map<string, SketchArc>;
  circles: Map<string, SketchCircle>;
  constraints: Map<string, Constraint>;
}

export class ConstraintSolver {
  private sketch: Sketch;

  constructor() {
    this.sketch = {
      points: new Map(),
      lines: new Map(),
      arcs: new Map(),
      circles: new Map(),
      constraints: new Map()
    };
  }

  /**
   * Add a point to the sketch
   */
  addPoint(x: number, y: number): string {
    const id = `point_${Date.now()}_${Math.random()}`;
    this.sketch.points.set(id, {
      id,
      x,
      y,
      constraints: []
    });
    return id;
  }

  /**
   * Add a line to the sketch
   */
  addLine(startId: string, endId: string): string {
    const id = `line_${Date.now()}_${Math.random()}`;
    this.sketch.lines.set(id, {
      id,
      startId,
      endId,
      constraints: []
    });
    return id;
  }

  /**
   * Add a circle to the sketch
   */
  addCircle(centerId: string, radius: number): string {
    const id = `circle_${Date.now()}_${Math.random()}`;
    this.sketch.circles.set(id, {
      id,
      centerId,
      radius,
      constraints: []
    });
    return id;
  }

  /**
   * Add an arc to the sketch
   */
  addArc(centerId: string, startId: string, endId: string, radius: number): string {
    const id = `arc_${Date.now()}_${Math.random()}`;
    this.sketch.arcs.set(id, {
      id,
      centerId,
      startId,
      endId,
      radius,
      constraints: []
    });
    return id;
  }

  /**
   * Add a constraint
   */
  addConstraint(type: ConstraintType, entities: string[], parameters?: Record<string, number>): string {
    const id = `constraint_${Date.now()}_${Math.random()}`;
    const constraint: Constraint = {
      id,
      type,
      entities,
      parameters
    };
    
    this.sketch.constraints.set(id, constraint);
    
    // Add constraint reference to entities
    for (const entityId of entities) {
      const point = this.sketch.points.get(entityId);
      if (point) {
        point.constraints.push(id);
      }
      
      const line = this.sketch.lines.get(entityId);
      if (line) {
        line.constraints.push(id);
      }
      
      const circle = this.sketch.circles.get(entityId);
      if (circle) {
        circle.constraints.push(id);
      }
      
      const arc = this.sketch.arcs.get(entityId);
      if (arc) {
        arc.constraints.push(id);
      }
    }
    
    return id;
  }

  /**
   * Remove a constraint
   */
  removeConstraint(constraintId: string): void {
    const constraint = this.sketch.constraints.get(constraintId);
    if (!constraint) return;
    
    // Remove constraint reference from entities
    for (const entityId of constraint.entities) {
      const point = this.sketch.points.get(entityId);
      if (point) {
        point.constraints = point.constraints.filter(id => id !== constraintId);
      }
      
      const line = this.sketch.lines.get(entityId);
      if (line) {
        line.constraints = line.constraints.filter(id => id !== constraintId);
      }
      
      const circle = this.sketch.circles.get(entityId);
      if (circle) {
        circle.constraints = circle.constraints.filter(id => id !== constraintId);
      }
      
      const arc = this.sketch.arcs.get(entityId);
      if (arc) {
        arc.constraints = arc.constraints.filter(id => id !== constraintId);
      }
    }
    
    this.sketch.constraints.delete(constraintId);
  }

  /**
   * Solve constraints (simplified - just applies basic constraints)
   */
  solve(): void {
    for (const constraint of this.sketch.constraints.values()) {
      this.applyConstraint(constraint);
    }
  }

  /**
   * Apply a single constraint
   */
  private applyConstraint(constraint: Constraint): void {
    switch (constraint.type) {
      case 'horizontal':
        this.applyHorizontal(constraint.entities[0]);
        break;
      case 'vertical':
        this.applyVertical(constraint.entities[0]);
        break;
      case 'coincident':
        this.applyCoincident(constraint.entities[0], constraint.entities[1]);
        break;
      // Add more constraint types as needed
    }
  }

  /**
   * Apply horizontal constraint to a line
   */
  private applyHorizontal(lineId: string): void {
    const line = this.sketch.lines.get(lineId);
    if (!line) return;
    
    const startPoint = this.sketch.points.get(line.startId);
    const endPoint = this.sketch.points.get(line.endId);
    
    if (!startPoint || !endPoint) return;
    
    // Make Y coordinates equal
    const avgY = (startPoint.y + endPoint.y) / 2;
    startPoint.y = avgY;
    endPoint.y = avgY;
  }

  /**
   * Apply vertical constraint to a line
   */
  private applyVertical(lineId: string): void {
    const line = this.sketch.lines.get(lineId);
    if (!line) return;
    
    const startPoint = this.sketch.points.get(line.startId);
    const endPoint = this.sketch.points.get(line.endId);
    
    if (!startPoint || !endPoint) return;
    
    // Make X coordinates equal
    const avgX = (startPoint.x + endPoint.x) / 2;
    startPoint.x = avgX;
    endPoint.x = avgX;
  }

  /**
   * Apply coincident constraint (make two points the same)
   */
  private applyCoincident(point1Id: string, point2Id: string): void {
    const point1 = this.sketch.points.get(point1Id);
    const point2 = this.sketch.points.get(point2Id);
    
    if (!point1 || !point2) return;
    
    // Average positions
    const avgX = (point1.x + point2.x) / 2;
    const avgY = (point1.y + point2.y) / 2;
    
    point1.x = avgX;
    point1.y = avgY;
    point2.x = avgX;
    point2.y = avgY;
  }

  /**
   * Get the sketch data
   */
  getSketch(): Sketch {
    return this.sketch;
  }

  /**
   * Export sketch to DXF format
   */
  exportToDXF(): string {
    let dxf = '0\nSECTION\n2\nENTITIES\n';
    
    // Export lines
    for (const line of this.sketch.lines.values()) {
      const startPoint = this.sketch.points.get(line.startId);
      const endPoint = this.sketch.points.get(line.endId);
      
      if (startPoint && endPoint) {
        dxf += `0\nLINE\n8\n0\n`;
        dxf += `10\n${startPoint.x}\n20\n${startPoint.y}\n30\n0\n`;
        dxf += `11\n${endPoint.x}\n21\n${endPoint.y}\n31\n0\n`;
      }
    }
    
    // Export circles
    for (const circle of this.sketch.circles.values()) {
      const center = this.sketch.points.get(circle.centerId);
      
      if (center) {
        dxf += `0\nCIRCLE\n8\n0\n`;
        dxf += `10\n${center.x}\n20\n${center.y}\n30\n0\n`;
        dxf += `40\n${circle.radius}\n`;
      }
    }
    
    dxf += '0\nENDSEC\n0\nEOF\n';
    
    return dxf;
  }

  /**
   * Export sketch to SVG format
   */
  exportToSVG(): string {
    let svg = '<?xml version="1.0" encoding="UTF-8"?>\n';
    svg += '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">\n';
    
    // Export lines
    for (const line of this.sketch.lines.values()) {
      const startPoint = this.sketch.points.get(line.startId);
      const endPoint = this.sketch.points.get(line.endId);
      
      if (startPoint && endPoint) {
        svg += `  <line x1="${startPoint.x}" y1="${startPoint.y}" x2="${endPoint.x}" y2="${endPoint.y}" stroke="black" stroke-width="1"/>\n`;
      }
    }
    
    // Export circles
    for (const circle of this.sketch.circles.values()) {
      const center = this.sketch.points.get(circle.centerId);
      
      if (center) {
        svg += `  <circle cx="${center.x}" cy="${center.y}" r="${circle.radius}" stroke="black" stroke-width="1" fill="none"/>\n`;
      }
    }
    
    svg += '</svg>\n';
    
    return svg;
  }
}
