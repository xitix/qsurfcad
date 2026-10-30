const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const STL2STEP_PATH = process.env.STL2STEP_PATH || './stl2step';

app.post('/api/convert', upload.single('stl'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No STL file uploaded' });
  }

  const inputPath = req.file.path;
  const outputPath = inputPath + '.step';

  console.log(`[convert] Processing: ${req.file.originalname}`);

  const args = [inputPath, '-o', outputPath, '--engine', 'trueform', '--no-verify'];

  execFile(STL2STEP_PATH, args, { timeout: 60000 }, (error, stdout, stderr) => {
    fs.unlink(inputPath, () => {});

    if (error) {
      console.error('[convert] Error:', error.message);
      return res.status(500).json({ error: 'Conversion failed', details: error.message });
    }

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ error: 'STEP file not generated' });
    }

    const originalName = req.file.originalname.replace(/\.stl$/i, '') + '.step';
    res.download(outputPath, originalName, (err) => {
      setTimeout(() => fs.unlink(outputPath, () => {}), 1000);
    });
  });
});

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

app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  QSurfCAD Backend Server                  ║`);
  console.log(`║  http://localhost:${PORT}                    ║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);
  console.log(`stl2step path: ${STL2STEP_PATH}`);
  
  execFile(STL2STEP_PATH, ['--version'], (error, stdout) => {
    if (error) {
      console.warn(`\n⚠️  Warning: stl2step not found at ${STL2STEP_PATH}`);
    } else {
      console.log(`✅ stl2step found: ${stdout.trim()}`);
    }
  });
});
