import React, { useRef } from 'react';
import './Toolbox.css';

interface ToolboxProps {
  activeTool: 'select' | 'magic-trace' | 'draw-line' | 'draw-arc' | 'draw-circle';
  onToolChange: (tool: 'select' | 'magic-trace' | 'draw-line' | 'draw-arc' | 'draw-circle') => void;
  onFileUpload: (file: File) => void;
  onConvert: () => void;
}

export const Toolbox: React.FC<ToolboxProps> = ({
  activeTool,
  onToolChange,
  onFileUpload,
  onConvert
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div className="toolbox">
      <div className="toolbox-section">
        <h3>PREPARE</h3>
        <button
          className="tool-button"
          onClick={() => fileInputRef.current?.click()}
        >
          📁 Import STL
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".stl"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button className="tool-button secondary">
          🔄 Orient
        </button>
        <button className="tool-button secondary">
          📏 Size
        </button>
      </div>

      <div className="toolbox-section">
        <h3>GUIDES</h3>
        <button
          className={`tool-button ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => onToolChange('select')}
        >
          🖱️ Select
        </button>
        <button
          className={`tool-button ${activeTool === 'magic-trace' ? 'active' : ''}`}
          onClick={() => onToolChange('magic-trace')}
        >
          ✨ Magic Trace
        </button>
        <button
          className={`tool-button ${activeTool === 'draw-line' ? 'active' : ''}`}
          onClick={() => onToolChange('draw-line')}
        >
          📏 Line
        </button>
        <button
          className={`tool-button ${activeTool === 'draw-arc' ? 'active' : ''}`}
          onClick={() => onToolChange('draw-arc')}
        >
          ⌒ Arc
        </button>
        <button
          className={`tool-button ${activeTool === 'draw-circle' ? 'active' : ''}`}
          onClick={() => onToolChange('draw-circle')}
        >
          ⭕ Circle
        </button>
      </div>

      <div className="toolbox-section">
        <h3>BUILD CAD</h3>
        <button className="tool-button primary" onClick={onConvert}>
          🔄 Convert to STEP
        </button>
        <button className="tool-button secondary">
          ✅ Verify
        </button>
      </div>

      <div className="toolbox-section">
        <h3>EXPORT</h3>
        <button className="tool-button secondary">
          💾 Export DXF
        </button>
        <button className="tool-button secondary">
          💾 Export SVG
        </button>
      </div>
    </div>
  );
};
