/**
 * QSurfCAD Backend Server
 * Express.js server that wraps stl2step CLI for STL → STEP conversion
 * 
 * Usage:
 *   node server.js
 *   # or
 *   STLPATH=/path/to/stl2step node server.js
 */

const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// File upload config
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Path to stl2step binary (configurable via env var)
// Priority: 1) env var, 2) local ./stl2step, 3) absolute path
const STL2STEP_PATH = process.env.STL2STEP_PATH || 
                      (require('fs').existsSync('./stl2step') ? './stl2step' : '/home/xitix5r/Downloads/Delete/stl2step/build/stl2step');

/**
 * POST /api/convert
 * Convert STL to STEP using stl2step
 */
app.post('/api/convert', upload.single('stl'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No STL file uploaded' });
  }

  const inputPath = req.file.path;
  const outputPath = inputPath + '.step';
  const engine = req.body?.engine || 'trueform'; // trueform = analytic recovery
  const units = req.body?.units || 'mm';

  console.log(`[convert] Processing: ${req.file.originalname}`);
  console.log(`[convert] Engine: ${engine}, Units: ${units}`);

  const args = [
    inputPath,
    '-o', outputPath,
    '--engine', engine,
    '--units', units,
    '--no-verify' // Skip re-read for speed
  ];

  execFile(STL2STEP_PATH, args, { timeout: 60000 }, (error, stdout, stderr) => {
    // Clean up input file
    fs.unlink(inputPath, () => {});

    if (error) {
      console.error('[convert] Error:', error.message);
      if (stderr) console.error('[convert] stderr:', stderr);
      return res.status(500).json({ 
        error: 'Conversion failed', 
        details: error.message,
        stderr: stderr 
      });
    }

    // Parse RESULT line from stdout
    const resultLine = stdout.split('\n').find(line => line.startsWith('RESULT '));
    let result = {};
    if (resultLine) {
      try {
        result = JSON.parse(resultLine.replace('RESULT ', ''));
      } catch (e) {
        console.warn('[convert] Failed to parse RESULT:', e.message);
      }
    }

    // Log useful info
    console.log(`[convert] Success: ${result.solids || '?'} solid(s), ${result.facesAfterUnify || '?'} faces`);
    if (result.smoothPlanes) {
      console.log(`[convert] Analytic: ${result.smoothPlanes} planes, ${result.smoothCylinders} cylinders`);
    }

    // Check if output exists
    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ error: 'STEP file not generated' });
    }

    // Send STEP file
    const originalName = req.file.originalname.replace(/\.stl$/i, '') + '.step';
    res.download(outputPath, originalName, (err) => {
      // Clean up output file after download
      setTimeout(() => {
        fs.unlink(outputPath, () => {});
      }, 1000);
    });
  });
});

/**
 * POST /api/analyze
 * Analyze STL without converting (fast inspection)
 */
app.post('/api/analyze', upload.single('stl'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No STL file uploaded' });
  }

  const inputPath = req.file.path;

  const args = [
    inputPath,
    '--no-verify',
    '--quiet'
  ];

  execFile(STL2STEP_PATH, args, { timeout: 30000 }, (error, stdout, stderr) => {
    fs.unlink(inputPath, () => {});

    if (error) {
      return res.status(500).json({ error: 'Analysis failed', details: error.message });
    }

    const resultLine = stdout.split('\n').find(line => line.startsWith('RESULT '));
    let result = {};
    if (resultLine) {
      try {
        result = JSON.parse(resultLine.replace('RESULT ', ''));
      } catch (e) {}
    }

    res.json({
      ok: true,
      filename: req.file.originalname,
      analysis: {
        triangles: result.triangles,
        vertices: result.vertices,
        components: result.components,
        watertight: result.watertight,
        volume: result.meshVolumeMM3,
        planes: result.smoothPlanes || 0,
        cylinders: result.smoothCylinders || 0,
        cones: result.smoothCones || 0,
        spheres: result.smoothSpheres || 0,
        faceted: result.smoothFacetFaces || 0
      }
    });
  });
});

/**
 * GET /api/health
 * Health check + stl2step availability
 */
app.get('/api/health', (req, res) => {
  execFile(STL2STEP_PATH, ['--version'], { timeout: 5000 }, (error, stdout) => {
    res.json({
      status: 'ok',
      stl2step: error ? 'not found' : 'available',
      stl2stepPath: STL2STEP_PATH,
      version: error ? null : stdout.trim()
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  QSurfCAD Backend Server                  ║`);
  console.log(`║  http://localhost:${PORT}                    ║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);
  console.log(`stl2step path: ${STL2STEP_PATH}`);
  
  // Verify stl2step is accessible
  execFile(STL2STEP_PATH, ['--version'], (error, stdout) => {
    if (error) {
      console.warn(`\n⚠️  Warning: stl2step not found at ${STL2STEP_PATH}`);
      console.warn(`   Set STL2STEP_PATH env var or copy binary to project root`);
    } else {
      console.log(`✅ stl2step found: ${stdout.trim()}`);
    }
  });
});
