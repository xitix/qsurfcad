interface TopBarProps {
  projectName: string;
  onNewProject: () => void;
}

export function TopBar({ projectName, onNewProject }: TopBarProps) {
  return (
    <header className="h-[54px] flex items-center gap-7 px-[18px] border-b border-[#111315] bg-[#202429] shrink-0">
      <a href="/" className="flex items-baseline gap-3 text-[#f1f3f4] no-underline text-[15px] font-bold tracking-[1.15px] whitespace-nowrap">
        <span className="text-[#56a4ff]">make3d.ro</span>
        <span className="text-[#8e989e] text-[9px] font-semibold tracking-[1.2px]">STL → EDITABLE CAD WORKBENCH</span>
      </a>

      <div className="flex items-center gap-2.5 min-w-[290px]">
        <label className="text-[#8e989e] text-[9px] font-bold tracking-[1.2px]">PROJECT</label>
        <span className="text-[#d3dade] text-[11px] truncate">{projectName}</span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={onNewProject}
          className="px-3 py-1.5 border border-[#4a525a] rounded-sm text-[#c9d0d4] bg-[#2d3339] cursor-pointer hover:bg-[#353d44] text-[10px] font-semibold"
        >
          ＋ New Project
        </button>
        <div className="flex items-center gap-2 text-[#aab4ba] text-[11px]">
          <span className="inline-block w-[7px] h-[7px] rounded-full bg-[#67c38c] shadow-[0_0_7px_#67c38c66]" />
          <span>CAD tools ready</span>
        </div>
      </div>
    </header>
  );
}
