import { RunManifest, Stage } from '../types';
import { STAGE_TITLES } from '../workflows';

interface WorkflowRailProps {
  stage: Stage;
  run: RunManifest;
  onSetStage: (stage: Stage) => void;
  onNewRun: () => void;
  workflowId: string;
}

function stageDone(run: RunManifest, s: Stage): boolean {
  if (s === 0) return run.orientationConfirmed;
  if (s === 1) return run.reviewComplete;
  if (s === 2) return run.exportFormatValid;
  return run.validated;
}

function stageAvailable(run: RunManifest, s: Stage): boolean {
  if (s === 0) return true;
  if (s === 1) return stageDone(run, 0);
  if (s === 2) return stageDone(run, 1);
  return stageDone(run, 2);
}

const stageSubtitles = ['Load, size, align', 'Use CAD tool', 'STEP or IGES', 'Check handoff'];

export function WorkflowRail({ stage, run, onSetStage, onNewRun, workflowId }: WorkflowRailProps) {
  return (
    <aside className="flex flex-col w-[196px] py-5 px-[11px] border-r border-[#111315] bg-[#252a2f] shrink-0">
      <div className="px-2.5 pb-3 text-[#8e989e] text-[9px] font-bold tracking-[1.2px]">WORKFLOW</div>

      {([0, 1, 2, 3] as Stage[]).map((s) => {
        const isActive = stage === s;
        const isComplete = stageDone(run, s);
        const isLocked = !stageAvailable(run, s);

        return (
          <button
            key={s}
            type="button"
            disabled={isLocked}
            onClick={() => onSetStage(s)}
            className={`flex gap-2.5 items-center w-full py-2.5 px-2.5 border-0 rounded-sm text-left cursor-pointer transition-colors ${
              isActive
                ? 'text-white bg-[#2874e8]'
                : isLocked
                ? 'opacity-48 cursor-not-allowed text-[#b7c0c5] bg-transparent'
                : 'text-[#b7c0c5] bg-transparent hover:bg-[#30373e]'
            }`}
          >
            <span className={`w-6 text-[10px] font-bold ${isComplete ? 'text-[#67c38c]' : 'text-[#aab4ba]'}`}>
              {String(s + 1).padStart(2, '0')}
            </span>
            <span className="grid gap-[3px]">
              <strong className="text-[12px] font-semibold">{STAGE_TITLES[s]}</strong>
              <small className="text-[#aeb8bf] text-[10px]">{stageSubtitles[s]}</small>
            </span>
          </button>
        );
      })}

      <div className="flex-1" />

      <div className="mx-2 mb-3 pt-3 border-t border-[#3b4148] text-[#89949a] text-[10px] leading-[1.5]">
        {workflowId === 'stl-step'
          ? 'STL conversion runs in Surfcad · PLY curve authoring uses an external tool.'
          : 'PLY curvature traces are estimated in Surfcad · Final curves use an external tool.'}
      </div>

      <button
        type="button"
        onClick={onNewRun}
        className="py-2 px-2.5 border border-[#4a525a] rounded-sm text-left text-[#c9d0d4] bg-[#2d3339] cursor-pointer hover:bg-[#353d44] text-[11px]"
      >
        ＋ New workflow
      </button>
    </aside>
  );
}
