interface StatusBarProps {
  message: string;
  meshName: string;
  triangles: number;
  vertices: number;
}

export function StatusBar({ message, meshName, triangles, vertices }: StatusBarProps) {
  return (
    <div className="flex h-6 items-center gap-2 px-3 border-t border-[#363d43] text-[#9ca7ad] bg-[#252a2f] text-[9px] shrink-0">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#67c38c]" />
      <span className="truncate">{message}</span>
      <span className="flex-1" />
      <span className="truncate">{meshName}</span>
      <span className="text-[#5e686e]">|</span>
      <span>{triangles > 0 ? `${triangles.toLocaleString()} triangles · ${vertices.toLocaleString()} vertices` : 'No mesh'}</span>
    </div>
  );
}
