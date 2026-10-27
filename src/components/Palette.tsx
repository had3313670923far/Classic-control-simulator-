import { useMemo, useState } from 'react';
import type { ComponentType, Lang } from '../types';
import { CATALOG, PALETTE_GROUPS } from '../lib/catalog';
import { compName } from '../lib/i18n';
import { Symbol } from './Symbols';

interface Props {
  lang: Lang;
  t: (k: string) => string;
  onAdd: (type: ComponentType) => void;
  disabled: boolean;
  onLogicLab?: () => void;
}

const GROUP_COLORS: Record<string, string> = {
  grp_supply: '#38bdf8',
  grp_protection: '#ef4444',
  grp_contact: '#14b8a6',
  grp_relay: '#fb923c',
  grp_timer: '#facc15',
  grp_control: '#a855f7',
  grp_sensors: '#22d3ee',
  grp_loads: '#94a3b8',
};

function Preview({ type }: { type: ComponentType }) {
  const c = useMemo(() => ({ id: 'pv', type, x: 0, y: 0, label: '', props: { ...CATALOG[type].defaults, length: 3 } }), [type]);
  const { w, h } = CATALOG[type];
  const W = type === 'busbar' ? 60 : Math.max(w, 1);
  const H = Math.max(h, 1);
  const BW = 64;
  const BH = 50;
  const scale = Math.min((BW - 10) / (W + 14), (BH - 8) / (H + 14));
  return (
    <svg viewBox={`0 0 ${BW} ${BH}`} className="h-[50px] w-full" style={{ direction: 'ltr' }}>
      <g transform={`translate(${(BW - W * scale) / 2} ${(BH - H * scale) / 2}) scale(${scale})`} style={{ filter: 'invert(1) hue-rotate(180deg)' }}>
        <Symbol c={c} mode="edit" selected={false} faulted={false} />
      </g>
    </svg>
  );
}

export default function Palette({ lang, t, onAdd, disabled, onLogicLab }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'electrical' | 'electronics'>('electrical');
  const query = q.trim().toLowerCase();
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-700 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('components')}</div>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-slate-700 bg-slate-950/60 p-0.5">
          <button onClick={() => setTab('electrical')} className={`rounded-md px-1 py-1 text-[10px] font-bold transition ${tab === 'electrical' ? 'bg-amber-500 text-slate-900 shadow' : 'text-slate-400 hover:text-slate-200'}`}>
            ⚡ {t('tab_electrical')}
          </button>
          <button onClick={() => setTab('electronics')} className={`rounded-md px-1 py-1 text-[10px] font-bold transition ${tab === 'electronics' ? 'bg-teal-500 text-slate-900 shadow' : 'text-slate-400 hover:text-slate-200'}`}>
            🔌 {t('tab_electronics')}
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="mt-2 w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-sky-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {tab === 'electronics' && onLogicLab && (
          <button onClick={onLogicLab} className="mb-2 flex w-full items-center gap-2 rounded-lg border border-teal-500/50 bg-teal-500/10 px-2 py-2 text-left transition hover:bg-teal-500/20">
            <span className="text-base">🧠</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold text-teal-200">{t('logic_lab')}</span>
              <span className="block truncate text-[9px] text-teal-300/70">{t('truth_table')} · 74xx</span>
            </span>
          </button>
        )}
        {PALETTE_GROUPS.filter((g) => (tab === 'electronics' ? g.key === 'grp_electronics' : g.key !== 'grp_electronics')).map((g) => {
          const items = g.items.filter((it) => !query || compName(lang, it).toLowerCase().includes(query) || compName('en', it).toLowerCase().includes(query));
          if (!items.length) return null;
          const isOpen = open[g.key] !== false;
          const color = GROUP_COLORS[g.key] || '#64748b';
          return (
            <div key={g.key} className="mb-2">
              <button onClick={() => setOpen((o) => ({ ...o, [g.key]: !isOpen }))} className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-[11px] font-semibold text-slate-300 hover:bg-slate-800">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                <span className="flex-1 truncate">{t(g.key)}</span>
                <span className="text-slate-500">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {items.map((type) => (
                    <button
                      key={type}
                      disabled={disabled}
                      onClick={() => onAdd(type)}
                      title={compName(lang, type)}
                      className="group flex flex-col overflow-hidden rounded-md border border-slate-700/70 bg-slate-950/70 transition hover:border-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ borderBottom: `2px solid ${color}` }}
                    >
                      <div className="flex justify-center px-0.5 pt-1">
                        <Preview type={type} />
                      </div>
                      <div className="line-clamp-2 min-h-7 px-1 pb-1 text-center text-[8.5px] font-medium leading-tight text-slate-300">{compName(lang, type)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
