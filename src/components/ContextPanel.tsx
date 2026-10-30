import React from 'react';
import './ContextPanel.css';

interface ContextPanelProps {
  activeTool: 'select' | 'magic-trace' | 'draw-line' | 'draw-arc' | 'draw-circle';
  selectedEntity: string | null;
  snapInfo: { type: string; position: [number, number, number] } | null;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  activeTool,
  selectedEntity,
  snapInfo
}) => {
  const getToolDescription = () => {
    switch (activeTool) {
      case 'select':
        return 'Select entities in the viewport';
      case 'magic-trace':
        return 'Click to place points. Magic Trace will snap to vertices, edges, and centers.';
      case 'draw-line':
        return 'Click 2 points to create a line';
      case 'draw-arc':
        return 'Click 3 points to create an arc';
      case 'draw-circle':
        return 'Click 3 points to create a circle';
    }
  };

  return (
    <div className="context-panel">
      <div className="context-section">
        <h3>Active Tool</h3>
        <div className="tool-info">
          <strong>{activeTool.toUpperCase()}</strong>
          <p>{getToolDescription()}</p>
        </div>
      </div>

      {snapInfo && (
        <div className="context-section">
          <h3>Snap Target</h3>
          <div className="snap-info">
            <div className="snap-type">
              <span className="label">Type:</span>
              <span className="value">{snapInfo.type}</span>
            </div>
            <div className="snap-position">
              <span className="label">Position:</span>
              <span className="value">
                ({snapInfo.position[0].toFixed(2)}, {snapInfo.position[1].toFixed(2)}, {snapInfo.position[2].toFixed(2)})
              </span>
            </div>
          </div>
        </div>
      )}

      {selectedEntity && (
        <div className="context-section">
          <h3>Selected Entity</h3>
          <div className="entity-info">
            <p>{selectedEntity}</p>
          </div>
        </div>
      )}

      <div className="context-section">
        <h3>Settings</h3>
        <div className="settings">
          <label>
            Snap Radius (mm):
            <input type="number" defaultValue="0.5" step="0.1" min="0.1" />
          </label>
          <label>
            Edge Threshold (°):
            <input type="number" defaultValue="15" step="1" min="1" />
          </label>
        </div>
      </div>
    </div>
  );
};
