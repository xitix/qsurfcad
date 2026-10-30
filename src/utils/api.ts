/**
 * API Client for QSurfCAD Backend
 * Communicates with Express.js server that wraps stl2step CLI
 */

const API_BASE = 'http://localhost:3001';

export interface ConversionResult {
  ok: boolean;
  stepFile?: Blob;
  filename?: string;
  error?: string;
  details?: string;
}

export interface AnalysisResult {
  ok: boolean;
  filename: string;
  analysis: {
    triangles: number;
    vertices: number;
    components: number;
    watertight: boolean;
    volume: number;
    planes: number;
    cylinders: number;
    cones: number;
    spheres: number;
    faceted: number;
  };
}

export interface HealthStatus {
  status: string;
  stl2step: string;
  stl2stepPath: string;
  version: string | null;
}

/**
 * Check if backend is running and stl2step is available
 */
export async function checkHealth(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(
      'Backend not reachable. Make sure server.js is running on port 3001.\n' +
      'Run: node backend/server.js'
    );
  }
}

/**
 * Convert STL to STEP
 */
export async function convertSTLtoSTEP(
  file: File,
  engine: 'verbatim' | 'trueform' = 'trueform',
  units: 'mm' | 'in' = 'mm'
): Promise<ConversionResult> {
  const formData = new FormData();
  formData.append('stl', file);
  formData.append('engine', engine);
  formData.append('units', units);

  try {
    const response = await fetch(`${API_BASE}/api/convert`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        ok: false,
        error: error.error || 'Conversion failed',
        details: error.details
      };
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'output.step';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    return {
      ok: true,
      stepFile: blob,
      filename
    };
  } catch (error) {
    return {
      ok: false,
      error: 'Network error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Analyze STL without converting
 */
export async function analyzeSTL(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('stl', file);

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Analysis failed'
    );
  }
}

/**
 * Download STEP file to user's computer
 */
export function downloadSTEP(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
