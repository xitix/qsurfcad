import { useState, useEffect } from 'react';
import { Toolbox } from './components/Toolbox';
import { Viewport } from './components/Viewport';
import { ContextPanel } from './components/ContextPanel';
import { ObjectBrowser } from './components/ObjectBrowser';
import { MagicTraceEngine } from './utils/MagicTraceEngine';
import { checkHealth, convertSTLtoSTEP, downloadSTEP, HealthStatus } from './utils/api';
import './App.css';

function App() {
  const [activeTool, setActiveTool] = useState<'select' | 'magic-trace' | 'draw-line' | 'draw-arc' | 'draw-circle'>('select');
  const [mesh, setMesh] = useState<any>(null);
  const [sketches, setSketches] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [snapInfo, setSnapInfo] = useState<{ type: string; position: [number, number, number] } | null>(null);
  const [backendStatus, setBackendStatus] = useState<HealthStatus | null>(null);
  const [converting, setConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const magicTrace = new MagicTraceEngine();

  // Check backend health on mount
  useEffect(() => {
    checkHealth()
      .then(setBackendStatus)
      .catch((err) => {
        console.warn('Backend check failed:', err);
        setBackendStatus(null);
      });
  }, []);

  const handleFileUpload = async (file: File) => {
    // TODO: Load STL file
    console.log('Loading:', file.name);
  };

  const handleConvertToSTEP = async () => {
    if (!mesh) {
      setStatusMessage('No STL file loaded');
      return;
    }

    if (!backendStatus || backendStatus.stl2step !== 'available') {
      setStatusMessage('Backend not available. Run: node backend/server.js');
      return;
    }

    setConverting(true);
    setStatusMessage('Converting STL to STEP...');

    try {
      const result = await convertSTLtoSTEP(mesh, 'trueform', 'mm');
      
      if (result.ok && result.stepFile && result.filename) {
        setStatusMessage('✅ Conversion successful! Downloading...');
        downloadSTEP(result.stepFile, result.filename);
      } else {
        setStatusMessage(`❌ Conversion failed: ${result.error}`);
      }
    } catch (error) {
      setStatusMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setConverting(false);
      setTimeout(() => setStatusMessage(''), 5000);
    }
  };

  return (
    <div className="app-container">
      {/* Left: Toolbox */}
      <Toolbox
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onFileUpload={handleFileUpload}
        onConvert={handleConvertToSTEP}
      />

      {/* Center: Viewport */}
      <Viewport
        mesh={mesh}
        sketches={sketches}
        activeTool={activeTool}
        magicTrace={magicTrace}
        onSnap={setSnapInfo}
        onSketchComplete={(sketch) => setSketches([...sketches, sketch])}
      />

      {/* Right: Context Panel + Object Browser */}
      <div className="right-panel">
        <ContextPanel
          activeTool={activeTool}
          selectedEntity={selectedEntity}
          snapInfo={snapInfo}
        />
        <ObjectBrowser
          mesh={mesh}
          sketches={sketches}
          selectedEntity={selectedEntity}
          onSelect={setSelectedEntity}
        />
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-left">
          {backendStatus ? (
            <span className={`status-indicator ${backendStatus.stl2step === 'available' ? 'online' : 'offline'}`}>
              {backendStatus.stl2step === 'available' ? '●' : '○'} Backend: {backendStatus.stl2step}
            </span>
          ) : (
            <span className="status-indicator offline">○ Backend: offline</span>
          )}
        </div>
        <div className="status-center">
          {statusMessage && <span className="status-message">{statusMessage}</span>}
          {converting && <span className="status-loading">⏳ Processing...</span>}
        </div>
        <div className="status-right">
          {mesh && <span>STL loaded</span>}
          {sketches.length > 0 && <span>{sketches.length} sketch(es)</span>}
        </div>
      </div>
    </div>
  );
}

export default App;
