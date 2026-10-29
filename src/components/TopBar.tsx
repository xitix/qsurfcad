import { WORKFLOWS } from '../workflows';

interface TopBarProps {
  workflowId: string;
  onWorkflowChange: (id: string) => void;
  cadAvailable: boolean;
}

export function TopBar({ workflowId, onWorkflowChange, cadAvailable }: TopBarProps) {
  return (
    <header className="h-[54px] flex items-center gap-7 px-[18px] border-b border-[#111315] bg-[#202429] shrink-0">
      <a href="/" className="flex items-baseline gap-3 text-[#f1f3f4] no-underline text-[15px] font-bold tracking-[1.15px] whitespace-nowrap">
        SURFCAD <span className="text-[#8e989e] text-[9px] font-semibold tracking-[1.2px]">RECONSTRUCTION WORKBENCH</span>
      </a>

      <div className="flex items-center gap-2.5 min-w-[290px]">
        <label htmlFor="workflow-select" className="text-[#8e989e] text-[9px] font-bold tracking-[1.2px]">
          WORKFLOW
        </label>
        <select
          id="workflow-select"
          value={workflowId}
          onChange={(e) => onWorkflowChange(e.target.value)}
          className="w-[265px] min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none focus:border-[#4a89e6]"
        >
          {Object.entries(WORKFLOWS).map(([id, wf]) => (
            <option key={id} value={id}>{wf.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 ml-auto text-[#aab4ba] text-[11px]">
        <span className={`inline-block w-[7px] h-[7px] rounded-full ${cadAvailable ? 'bg-[#67c38c] shadow-[0_0_7px_#67c38c66]' : 'bg-[#e5b45b]'}`} />
        {cadAvailable ? 'FreeCAD available for verification' : 'FreeCAD not detected'}
      </div>
    </header>
  );
}
