import { useEffect } from 'react';
import type { Circuit, Lang, Mode, SimSnapshot } from '../types';
import { compName } from '../lib/i18n';
import PropertiesPanel from './PropertiesPanel';
import type { Selection } from './Canvas';

interface Props {
  circuit: Circuit;
  selection: Selection;
  mode: Mode;
  snapshot: SimSnapshot | null;
  lang: Lang;
  t: (k: string) => string;
  onUpdate: (id: string, patch: { label?: string; props?: Record<string, any> }) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetLoad: (id: string, load: number) => void;
  onSetWireColor: (id: string, color: string) => void;
  onFlipWire: (id: string) => void;
  onSetWireSize: (id: string, size: number) => void;
  onSetWireRoute: (id: string, route: string) => void;
  onClose: () => void;
}

/** Device / wire editor as a bottom-sheet (mobile) / dialog (desktop). */
export default function EditorModal(p: Props) {
  const { t, selection, circuit } = p;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.onClose]);

  const title =
    selection.kind === 'wire'
      ? `${t('wire_color')} / ${t('delete')}`
      : (() => {
          const c = circuit.components.find((x) => x.id === selection.id);
          return c ? `${t('edit_device')}: ${compName(p.lang, c.type)}${c.label ? ` (${c.label})` : ''}` : t('edit_device');
        })();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={p.onClose}>
      <div
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:h-[640px] sm:max-w-md sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-4 py-2.5">
          <h2 className="truncate text-sm font-bold text-slate-100">{title}</h2>
          <button onClick={p.onClose} className="rounded-md px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-white" title="✕">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <PropertiesPanel
            circuit={p.circuit}
            selection={p.selection}
            mode={p.mode}
            snapshot={p.snapshot}
            lang={p.lang}
            t={p.t}
            onUpdate={p.onUpdate}
            onDelete={() => {
              p.onDelete();
              p.onClose();
            }}
            onDuplicate={p.onDuplicate}
            onSetLoad={p.onSetLoad}
            onSetWireColor={p.onSetWireColor}
            onFlipWire={p.onFlipWire}
            onSetWireSize={p.onSetWireSize}
            onSetWireRoute={p.onSetWireRoute}
          />
        </div>
      </div>
    </div>
  );
}
