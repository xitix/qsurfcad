import { useState } from 'react';
import { Toolbox } from './components/Toolbox';
import { Viewport } from './components/Viewport';
import { ContextPanel } from './components/ContextPanel';
import { ObjectBrowser } from './components/ObjectBrowser';
import { MagicTraceEngine } from './utils/MagicTraceEngine';
import './App.css';

function App() {
  const [activeTool, setActiveTool] = useState<'select' | 'magic-trace' | 'draw-line' | 'draw-arc' | 'draw-circle'>('select');
  const [mesh, setMesh] = useState<any>(null);
  const [sketches, setSketches] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [snapInfo, setSnapInfo] = useState<{ type: string; position: [number, number, number] } | null>(null);

  const magicTrace = new MagicTraceEngine();

  const handleFileUpload = async (file: File) => {
    // TODO: Load STL file
    console.log('Loading:', file.name);
  };

  const handleConvertToSTEP = async () => {
    // TODO: Call stl2step backend
    console.log('Converting to STEP...');
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
    </div>
  );
}

export default App;
