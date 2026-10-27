interface Props {
  names: string[];
  active: number;
  t: (k: string) => string;
  onSwitch: (i: number) => void;
  onAdd: () => void;
  onRename: (i: number) => void;
  onClose: (i: number) => void;
}

export default function SheetTabs({ names, active, t, onSwitch, onAdd, onRename, onClose }: Props) {
  return (
    <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-slate-700 bg-slate-950 px-2 py-1">
      <span className="shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">📑 {t('sheets')}</span>
      {names.map((n, i) => (
        <div
          key={i}
          onClick={() => onSwitch(i)}
          onDoubleClick={() => onRename(i)}
          title={t('sheet_name')}
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border-x border-t px-2.5 py-1 text-xs font-medium transition ${
            i === active ? 'border-slate-600 bg-slate-800 text-sky-200' : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <span className="max-w-32 truncate">{n}</span>
          {names.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(i);
              }}
              className="rounded px-0.5 text-slate-500 hover:bg-slate-700 hover:text-red-300"
              title="✕"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button onClick={onAdd} className="flex shrink-0 items-center gap-0.5 rounded-md border border-dashed border-slate-600 px-2 py-1 text-xs font-bold text-slate-300 hover:border-sky-500 hover:text-sky-200" title="Sheet+">
        + {t('sheet')}
      </button>
    </div>
  );
}
