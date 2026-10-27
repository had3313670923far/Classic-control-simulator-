import { useMemo, useState } from 'react';
import LZString from 'lz-string';
import type { Account, Note, Project, SimEvent } from '../types';
import { Symbol } from './Symbols';

type T = (k: string) => string;

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:rounded-xl ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-4 py-2.5">
          <h2 className="truncate text-sm font-bold text-slate-100">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-white">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500';
const btnPri = 'rounded-md border border-sky-500/60 bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-100 hover:bg-sky-500/30';
const btnSec = 'rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700';
const btnDanger = 'rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20';

/* ---------------- About ---------------- */
export function AboutDialog({ t, onClose }: { t: T; onClose: () => void }) {
  return (
    <Shell title={`⚡ ${t('app_title')}`} onClose={onClose} wide>
      <div className="text-[11px] text-slate-400">
        {t('version')} 2.0 · Classic Control Simulator
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">{t('about_text')}</p>
      <div className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">{t('help_title')}</div>
      <ol className="mt-1 list-decimal space-y-1.5 ps-5 text-xs leading-relaxed text-slate-300">
        {['help_1', 'help_2', 'help_3', 'help_4', 'help_5', 'help_6', 'help_7'].map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ol>
    </Shell>
  );
}

/* ---------------- Account (local profile) ---------------- */
export function AccountDialog({ t, account, onSave, onSignOut, onClose }: { t: T; account: Account | null; onSave: (a: Account) => void; onSignOut: () => void; onClose: () => void }) {
  const [name, setName] = useState(account?.name || '');
  const [email, setEmail] = useState(account?.email || '');
  return (
    <Shell title={`👤 ${t('accounts')}`} onClose={onClose}>
      <label className="block">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('your_name')}</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('your_name')} className={inputCls} />
      </label>
      <label className="mt-3 block">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('email')}</div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@mail.com" className={inputCls} dir="ltr" />
      </label>
      <div className="mt-4 flex gap-2">
        <button onClick={() => onSave({ name: name.trim() || 'User', email: email.trim() })} className={`flex-1 ${btnPri}`}>
          {t('save')}
        </button>
        {account && (
          <button onClick={onSignOut} className={btnDanger}>
            {t('sign_out')}
          </button>
        )}
      </div>
    </Shell>
  );
}

/* ---------------- Communication (project data exchange) ---------------- */
export function CommDialog({ t, project, onImport, onClose }: { t: T; project: Project; onImport: (text: string) => boolean; onClose: () => void }) {
  const code = useMemo(() => LZString.compressToEncodedURIComponent(JSON.stringify(project)), [project]);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState(false);
  const stats = useMemo(() => {
    let c = 0,
      w = 0,
      n = 0;
    for (const s of project.sheets) {
      c += s.circuit.components.length;
      w += s.circuit.wires.length;
      n += s.circuit.notes?.length || 0;
    }
    return { sheets: project.sheets.length, c, w, n };
  }, [project]);
  return (
    <Shell title={`📡 ${t('communication')}`} onClose={onClose} wide>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          [t('sheets'), stats.sheets],
          [t('components'), stats.c],
          [t('wires'), stats.w],
          [t('comments'), stats.n],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-md border border-slate-700 bg-slate-800/60 px-1 py-2">
            <div className="text-base font-bold text-sky-200">{v as number}</div>
            <div className="truncate text-[10px] text-slate-400">{k as string}</div>
          </div>
        ))}
      </div>
      <div className="mb-1 mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('project_code')}</div>
      <textarea readOnly value={code} rows={3} dir="ltr" className={`${inputCls} resize-none font-mono text-[10px] leading-relaxed`} />
      <div className="mt-2 flex gap-2">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
          className={`flex-1 ${btnPri}`}
        >
          {copied ? `✓ ${t('copied')}` : `📋 ${t('copy_code')}`}
        </button>
      </div>
      <div className="mb-1 mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('import_code')}</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} dir="ltr" placeholder={t('project_code')} className={`${inputCls} resize-none font-mono text-[10px]`} />
      {err && <div className="mt-1 text-[11px] text-red-400">⚠ {t('invalid_code')}</div>}
      <button
        onClick={() => {
          if (onImport(text.trim())) onClose();
          else setErr(true);
        }}
        className={`mt-2 w-full ${btnSec}`}
      >
        ⬇ {t('import_code')}
      </button>
    </Shell>
  );
}

/* ---------------- Notifications ---------------- */
const COLORS: Record<SimEvent['level'], string> = { info: 'text-slate-300', ok: 'text-emerald-300', warn: 'text-amber-300', error: 'text-red-300' };
const ICON: Record<SimEvent['level'], string> = { info: '·', ok: '✓', warn: '⚠', error: '✖' };

export function NotificationsPanel({ t, notifs, onClear, onClose }: { t: T; notifs: SimEvent[]; onClear: () => void; onClose: () => void }) {
  return (
    <div className="fixed end-2 top-28 z-40 flex max-h-[60vh] w-80 max-w-[90vw] flex-col overflow-hidden rounded-xl border border-slate-600 bg-slate-900 shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-3 py-2">
        <span className="text-xs font-bold text-slate-100">🔔 {t('notifications')}</span>
        <div className="flex gap-2">
          <button onClick={onClear} className="text-[11px] text-slate-400 hover:text-slate-200">
            {t('clear_all')}
          </button>
          <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1 font-mono text-[11px] leading-5">
        {notifs.length === 0 && <div className="py-3 text-center text-slate-500">{t('no_notifications')}</div>}
        {[...notifs].reverse().map((e) => (
          <div key={e.id} className={`flex gap-2 border-b border-slate-800/60 py-0.5 ${COLORS[e.level]}`}>
            <span className="shrink-0 text-slate-500">{e.time.toFixed(1)}s</span>
            <span className="shrink-0">{ICON[e.level]}</span>
            <span>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Note editor ---------------- */
export function NotesDialog({ t, note, onChange, onDelete, onClose }: { t: T; note: Note; onChange: (text: string) => void; onDelete: () => void; onClose: () => void }) {
  return (
    <Shell title={`💬 ${t('note_title')}`} onClose={onClose}>
      <textarea value={note.text} onChange={(e) => onChange(e.target.value)} rows={5} autoFocus placeholder={t('note_placeholder')} className={`${inputCls} resize-y text-sm leading-relaxed`} />
      <div className="mt-3 flex gap-2">
        <button onClick={onClose} className={`flex-1 ${btnPri}`}>
          ✓ OK
        </button>
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className={btnDanger}
        >
          🗑 {t('delete')}
        </button>
      </div>
    </Shell>
  );
}

/* ---------------- Project library ---------------- */
const LS_PROJECTS = 'ccs.projects.v3';

export type Domain = 'electrical' | 'electronics';

export interface StoredProject {
  name: string;
  ext?: string;
  savedAt: number;
  domain?: Domain;
  project: Project;
}

/** Guess a domain from the components used in a project. */
export function projectDomain(p: Project): Domain {
  const ELEC = new Set(['resistor','res_fixed','pot','ldr','thermistor','varistor','res_net','capacitor','cap_elec','cap_ceramic','cap_film','cap_mica','supercap','cap_var','inductor','choke','toroid','air_core','var_inductor','diode','led','lamp_neon','diode_rect','diode_zener','diode_schottky','photodiode','varactor','tvs','tunnel','bridge','npn','pnp','bjt','darlington','phototransistor','jfet','mosfet','igbt','scr','scr_ic','triac','diac','gto','ic555','opamp','comparator','pll','logic','flipflop','shiftreg','counter','mcu','mpu','dsp','fpga','eeprom','sram','dram','flash','motor_driver','uln','transceiver','reg_linear','reg_smps','optocoupler','optocoupler_ic','triac_coupler','crystal','saw','fuse_glass','fuse_blade','fuse_ptc','switch_push','switch_toggle','switch_dip','switch_rotary','switch_micro','reed','relay_emr','relay_latch','dc_motor','bldc','stepper','servo','solenoid','terminal_block','header','power_jack','usb_port','audio_jack','ic_socket','buzzer_active','buzzer_piezo','speaker','microphone','cooling_fan','rotary_encoder','strain_gauge','heatsink','optocoupler_ic']);
  let e = 0;
  for (const sh of p.sheets) for (const c of sh.circuit.components) if (ELEC.has(c.type)) e++;
  return e > 0 ? 'electronics' : 'electrical';
}

export function readLibrary(): StoredProject[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(LS_PROJECTS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => x && typeof x.name === 'string' && x.project && Array.isArray(x.project.sheets) && x.project.sheets.length > 0);
  } catch {
    return [];
  }
}

export function writeLibrary(list: StoredProject[]) {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(list));
}

/** Community shares are stored separately from the workspace library. */
export interface SharedCircuit {
  id: string;
  name: string;
  author: string;
  domain: Domain;
  sharedAt: number;
  project: Project;
  likes: number;
  visibility?: 'public' | 'private';
  pin?: string;
}

const LS_SHARED = 'ccs.shared.v1';
const LS_POINTS = 'ccs.points.v1';
const LS_ACCESS = 'ccs.access.v1';
export const POINTS_COST = 10;

export function readPoints(): number {
  try {
    const raw = localStorage.getItem(LS_POINTS);
    return raw === null ? 30 : Math.max(0, Number(raw) || 0);
  } catch {
    return 30;
  }
}
export function writePoints(n: number) {
  try {
    localStorage.setItem(LS_POINTS, String(Math.max(0, n)));
  } catch {
    /* ignore */
  }
}
export interface AccessRecord {
  shareId: string;
  code: string;
  granted: ('view' | 'download' | 'edit')[];
  at: number;
}
export function readAccess(): AccessRecord[] {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_ACCESS) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
export function writeAccess(list: AccessRecord[]) {
  try {
    localStorage.setItem(LS_ACCESS, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
export function makeAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'CCS-';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function readShares(): SharedCircuit[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(LS_SHARED);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => x && x.project) : [];
  } catch {
    return [];
  }
}
export function writeShares(list: SharedCircuit[]) {
  try {
    localStorage.setItem(LS_SHARED, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function projectStats(p: Project) {
  let c = 0,
    w = 0;
  for (const s of p.sheets) {
    c += s.circuit.components.length;
    w += s.circuit.wires.length;
  }
  return { sheets: p.sheets.length, c, w };
}

export const PROJECT_EXTS = ['json', 'sim', 'prj', 'ckt', 'circ', 'Elec', 'Smrl'];

export function ProjectDialog({
  t,
  onLoadProject,
  onImportFile,
  onNewProject,
  onClose,
  notify,
  examples,
}: {
  t: T;
  project: Project;
  onLoadProject: (p: Project) => void;
  onImportFile: () => void;
  onNewProject: () => void;
  onClose: () => void;
  notify: (msg: string) => void;
  examples?: { key: string; titleKey: string; descKey: string; group?: 'electrical' | 'electronics' }[];
}) {
  const [list, setList] = useState<StoredProject[]>(() => readLibrary());
  const [menu, setMenu] = useState<string | null>(null);
  const [domain, setDomain] = useState<Domain>('electrical');
  const [page, setPage] = useState<'root' | 'workspace' | 'community'>('root');
  const [shares, setShares] = useState<SharedCircuit[]>(() => readShares());
  const [pendingShare, setPendingShare] = useState<{ key: string; name: string; circuit: any } | null>(null);
  const [shareMode, setShareMode] = useState<'public' | 'private'>('public');
  const [lockPin, setLockPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [points, setPoints] = useState<number>(() => readPoints());
  const [detail, setDetail] = useState<SharedCircuit | null>(null);
  const updatePoints = (n: number) => {
    setPoints(n);
    writePoints(n);
  };
  const publishExample = (ex: { key: string; titleKey: string }) => {
    const build = (window as any).__buildExample;
    if (typeof build !== 'function') return;
    const built = build(ex.key);
    if (!built) return;
    setPendingShare({ key: ex.key, name: t(ex.titleKey), circuit: built });
    setShareMode('public');
    setLockPin('');
    setUnlocked(false);
  };

  const confirmShare = () => {
    if (!pendingShare) return;
    if (shareMode === 'private' && lockPin.length !== 4) return;
    const entry: SharedCircuit = {
      id: 'sh' + Date.now().toString(36),
      name: pendingShare.name,
      author: 'Workspace',
      domain,
      sharedAt: Date.now(),
      project: { v: 3, sheets: [{ name: pendingShare.name, circuit: pendingShare.circuit }], active: 0 },
      likes: 0,
      visibility: shareMode,
      pin: shareMode === 'private' ? lockPin : undefined,
    };
    writeShares([entry, ...readShares()]);
    refreshShares();
    setPendingShare(null);
    setUnlocked(false);
    setLockPin('');
    notify(t('share_published'));
  };
  const refreshShares = () => setShares(readShares());
  const filtered = list.filter((x) => (x.domain ?? projectDomain(x.project)) === domain);
  const exampleList = (examples || []).filter((e) => (e.group ?? 'electrical') === domain);
  const openExample = (ex: string) => {
    const handler = (window as any).__loadExample;
    if (typeof handler === 'function') handler(ex);
    onClose();
  };
  const refresh = () => setList(readLibrary());
  const menuEntry = menu && menu !== 'head' ? list.find((x) => x.name === menu) : undefined;

  const doDelete = (nm: string) => {
    if (!window.confirm(t('delete_project_confirm'))) return;
    try {
      writeLibrary(readLibrary().filter((x) => x.name !== nm));
      setMenu(null);
      refresh();
    } catch {
      /* ignore */
    }
  };

  const doRename = (old: string) => {
    const nm = window.prompt(t('rename_title'), old)?.trim();
    if (!nm || nm === old) return;
    const lib = readLibrary();
    const src = lib.find((x) => x.name === old);
    if (!src) return;
    if (lib.some((x) => x.name === nm) && !window.confirm(t('overwrite_project'))) return;
    writeLibrary([{ ...src, name: nm, savedAt: Date.now() }, ...lib.filter((x) => x.name !== old && x.name !== nm)]);
    setMenu(null);
    refresh();
  };

  const doDownload = (entry: StoredProject) => {
    const e = entry.ext || 'json';
    const base = entry.name.replace(/[\\/:*?"<>|]/g, '').trim() || 'project';
    const blob = new Blob([JSON.stringify(entry.project, null, 2)], { type: e === 'json' ? 'application/json' : 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${base}.${e}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setMenu(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 shadow-2xl sm:h-[85vh] sm:max-h-[720px] sm:max-w-md sm:rounded-xl sm:border sm:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex shrink-0 items-center gap-1 border-b border-slate-800 px-2 py-2">
          <button onClick={() => (page === 'root' ? onClose() : setPage('root'))} className="rounded-md px-2 py-1.5 text-lg leading-none text-slate-300 hover:bg-slate-800" title="back">
            ←
          </button>
          <span className="flex-1 text-sm font-bold text-slate-100">{page === 'community' ? t('community') : page === 'workspace' ? t('workspace') : t('project')}</span>
          <button onClick={() => setMenu(menu === 'head' ? null : 'head')} className="rounded-md px-2 py-1.5 text-lg leading-none text-slate-300 hover:bg-slate-800" title="menu">
            ⋮
          </button>
          {menu === 'head' && (
            <div className="absolute end-2 top-12 z-[70] w-44 overflow-hidden rounded-lg border border-slate-600 bg-slate-800 shadow-2xl">
              <MenuItem icon="✚" label={t('new_project')} onClick={() => { setMenu(null); onNewProject(); }} />
              <MenuItem icon="📂" label={t('import_file')} onClick={() => { setMenu(null); onImportFile(); }} />
            </div>
          )}
        </div>
        {page === 'root' && (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-5 pb-6">
            <div className="mb-1 text-center">
              <div className="text-sm font-bold text-slate-100">{t('project')}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{list.length} {t('saved_projects').toLowerCase()} · {t('cloud')}</div>
            </div>
            <button onClick={() => { setPage('workspace'); refresh(); }} className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-start transition hover:bg-emerald-500/20">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-700 text-xl">🗂</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-emerald-100">{t('workspace')}</span>
                <span className="block text-[11px] text-emerald-200/70">{t('workspace_sub')}</span>
              </span>
              <span className="text-emerald-300">›</span>
            </button>
            <button onClick={() => { setPage('community'); refreshShares(); }} className="flex items-center gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-start transition hover:bg-sky-500/20">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-700 text-xl">👥</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-sky-100">{t('community')}</span>
                <span className="block text-[11px] text-sky-200/70">{t('community_sub')}</span>
              </span>
              <span className="text-sky-300">›</span>
            </button>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button onClick={onNewProject} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700">✚ {t('new_project')}</button>
              <button onClick={onImportFile} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700">📂 {t('import_file')}</button>
            </div>
          </div>
        )}

        {page !== 'root' && (
          <>
            <div className="grid shrink-0 grid-cols-2 gap-1.5 border-b border-slate-800 px-2 py-2">
              <button onClick={() => setDomain('electrical')} className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${domain === 'electrical' ? 'bg-emerald-700 text-white shadow' : 'border border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                ⚡ {t('tab_electrical')}
              </button>
              <button onClick={() => setDomain('electronics')} className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${domain === 'electronics' ? 'bg-teal-600 text-white shadow' : 'border border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                🔌 {t('tab_electronics')}
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[10px]">
              <span className="font-semibold text-sky-300">{page === 'community' ? t('shared_circuits') : t('cloud')}</span>
              <span className="text-slate-500">· {page === 'community' ? shares.filter((x) => (x.domain ?? 'electrical') === domain).length : filtered.length}</span>
              {page === 'community' && <span className="ms-auto rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">🪙 {points}</span>}
              <button onClick={page === 'community' ? refreshShares : refresh} className={`${page === 'community' ? '' : 'ms-auto'} rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800`} title="refresh">⟳</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {page === 'workspace' && exampleList.length > 0 && (
                <div className="mb-1 mt-1 rounded-md border border-slate-800 bg-slate-900/60 p-1">
                  <div className="px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">{t('examples')}</div>
                  {exampleList.map((ex) => (
                    <div key={ex.key} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-slate-800">
                      <button onClick={() => openExample(ex.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span className="text-xs">{domain === 'electronics' ? '🔌' : '⚡'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold text-slate-200">{t(ex.titleKey)}</span>
                          <span className="block truncate text-[9px] text-slate-500">{t(ex.descKey)}</span>
                        </span>
                      </button>
                      <button
                        onClick={() => publishExample(ex)}
                        title={t('share_community')}
                        className="shrink-0 rounded border border-sky-500/50 bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold text-sky-200 hover:bg-sky-500/30"
                      >
                        📤 {t('share_short')}
                      </button>
                      <button onClick={() => openExample(ex.key)} className="shrink-0 px-0.5 text-[10px] text-slate-500 hover:text-slate-200">▶</button>
                    </div>
                  ))}
                  <div className="mt-0.5 border-t border-slate-800/70 px-1 pb-0.5 pt-0.5 text-[9px] text-slate-500">
                    {t('share_hint')}
                  </div>
                </div>
              )}

              {page === 'workspace' && filtered.length === 0 && exampleList.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">{t('no_projects')}</div>
              )}
              {page === 'workspace' && filtered.map((x) => {
                const st = projectStats(x.project);
                return (
                  <div key={x.name} className="flex items-center gap-2.5 border-b border-slate-800/60 px-1.5 py-2.5">
                    <span className="shrink-0 text-xl">☁</span>
                    <button onClick={() => onLoadProject(x.project)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-[13px] font-semibold text-slate-100">{x.name}<span className="font-normal text-slate-500">.{x.ext || 'json'}</span></div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{new Date(x.savedAt).toLocaleString()} · 📁 {st.sheets}</div>
                    </button>
                    <button onClick={() => setMenu(x.name)} className="shrink-0 rounded px-1.5 py-1 text-base leading-none text-slate-400 hover:bg-slate-800">⋮</button>
                  </div>
                );
              })}

              {page === 'community' && shares.filter((x) => (x.domain ?? 'electrical') === domain).length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">{t('no_shares')}</div>
              )}
              {page === 'community' && shares.filter((x) => (x.domain ?? 'electrical') === domain).map((sh) => (
                <div key={sh.id} className="flex items-center gap-2.5 border-b border-slate-800/60 px-1.5 py-2.5">
                  <span className="shrink-0 text-xl">👤</span>
                  <button
                    onClick={() => {
                      if (sh.visibility === 'private' && sh.pin) {
                        const entered2 = window.prompt(t('enter_pin_to_open'), '');
                        if (entered2 !== sh.pin) {
                          notify(t('wrong_pin'));
                          return;
                        }
                      }
                      setDetail(sh);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[13px] font-semibold text-slate-100">{sh.name}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">{sh.author || t('anonymous')} · {new Date(sh.sharedAt).toLocaleDateString()} · ❤ {sh.likes} · 🪙 {POINTS_COST}</div>
                  </button>
                  <button onClick={() => { const next = readShares().map((k) => (k.id === sh.id ? { ...k, likes: k.likes + 1 } : k)); writeShares(next); refreshShares(); }} className="shrink-0 rounded px-1.5 py-1 text-xs text-rose-300 hover:bg-slate-800">❤</button>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${sh.visibility === 'private' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {sh.visibility === 'private' ? '🔒' : '🌍'}
                  </span>
                  <button
                    onClick={() => {
                      if (sh.visibility === 'private' && sh.pin) {
                        const entered = window.prompt(t('enter_pin_to_open'), '');
                        if (entered !== sh.pin) {
                          notify(t('wrong_pin'));
                          return;
                        }
                      }
                      onLoadProject(sh.project);
                    }}
                    className="shrink-0 rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    ▶
                  </button>
                </div>
              ))}
            </div>

          </>
        )}

        {detail && (
          <CommunityDetail
            t={t}
            share={detail}
            points={points}
            onPoints={updatePoints}
            onLoadProject={onLoadProject}
            onClose={() => setDetail(null)}
            notify={notify}
          />
        )}

        {pendingShare && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={() => setPendingShare(null)}>
            <div className="w-full max-w-sm overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5">
                <div className="text-sm font-bold text-slate-100">📤 {t('share_popup_title')}</div>
                <button onClick={() => setPendingShare(null)} className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-slate-800">✕</button>
              </div>
              <div className="p-3">
                <div className="truncate text-[12px] font-semibold text-slate-200">{pendingShare.name}</div>
                <div className="text-[10px] text-slate-500">{domain === 'electronics' ? '🔌 Electronics' : '⚡ Electrical'} · {t('share_visibility')}</div>

                {/* public / private */}
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <button onClick={() => setShareMode('public')} className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition ${shareMode === 'public' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-slate-700 text-slate-400'}`}>
                    🌍 {t('public')}
                  </button>
                  <button onClick={() => { setShareMode('private'); setUnlocked(false); }} className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition ${shareMode === 'private' ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-slate-700 text-slate-400'}`}>
                    🔒 {t('private')}
                  </button>
                </div>

                {shareMode === 'private' && (
                  <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">🔐 {t('lock_unlock')}</div>
                    <div className="mb-1 text-[10px] text-slate-400">{t('pin_hint')}</div>
                    <div className="flex gap-1.5">
                      <input
                        value={lockPin}
                        onChange={(e) => { setLockPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setUnlocked(false); }}
                        inputMode="numeric"
                        placeholder="• • • •"
                        className={`${inputCls} flex-1 text-center font-mono text-sm tracking-[0.4em]`}
                        dir="ltr"
                      />
                      <button onClick={() => setUnlocked(lockPin.length === 4)} disabled={lockPin.length !== 4} className="rounded-md bg-amber-500 px-3 text-[11px] font-bold text-slate-900 disabled:opacity-40">
                        🔓 {t('unlock')}
                      </button>
                    </div>
                    {lockPin.length > 0 && lockPin.length < 4 && <div className="mt-1 text-[10px] text-red-400">{t('pin_4_digits')}</div>}
                    {unlocked && <div className="mt-1 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">✓ {t('unlocked_note')}</div>}
                  </div>
                )}

                <button
                  onClick={confirmShare}
                  disabled={shareMode === 'private' && !(lockPin.length === 4 && unlocked)}
                  className="mt-3 w-full rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {shareMode === 'private' ? `🔒 ${t('share_private')}` : `🌍 ${t('share_public')}`}
                </button>
                <div className="mt-1 text-center text-[9px] text-slate-500">{t('share_note')}</div>
              </div>
            </div>
          </div>
        )}

        {menu && menu !== 'head' && menuEntry && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} />
            <div className="fixed inset-x-0 bottom-0 z-[70] mx-auto w-full max-w-md rounded-t-2xl border border-slate-600 bg-slate-900 p-2 pb-4 shadow-2xl">
              <div className="truncate px-2 py-1.5 text-xs font-bold text-slate-100">{menuEntry.name}</div>
              <MenuItem icon="📂" label={t('load_file')} onClick={() => onLoadProject(menuEntry.project)} />
              <MenuItem icon="⬇" label={t('download_file')} onClick={() => doDownload(menuEntry)} />
              <MenuItem icon="✎" label={t('rename')} onClick={() => doRename(menuEntry.name)} />
              <MenuItem icon="🗑" label={t('delete')} danger onClick={() => doDelete(menuEntry.name)} />
              <button onClick={() => setMenu(null)} className="mt-1 w-full rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                {t('cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type ShareAction = 'view' | 'download' | 'edit';

function CommunityDetail({
  t,
  share,
  points,
  onPoints,
  onLoadProject,
  onClose,
  notify,
}: {
  t: T;
  share: SharedCircuit;
  points: number;
  onPoints: (n: number) => void;
  onLoadProject: (p: Project) => void;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [action, setAction] = useState<ShareAction>('view');
  const [stage, setStage] = useState<'locked' | 'paying' | 'code'>('locked');
  const [code, setCode] = useState('');
  const [entered, setEntered] = useState('');
  const [err, setErr] = useState(false);
  const[granted, setGranted] = useState<ShareAction[]>(() => readAccess().find((a) => a.shareId === share.id)?.granted || []);
  const [preview, setPreview] = useState(false);

  const circuit = share.project.sheets[0]?.circuit;
  const comps = circuit?.components || [];
  const wires = circuit?.wires || [];
  const stats = share.project.sheets.reduce((acc, sh) => ({ c: acc.c + sh.circuit.components.length, w: acc.w + sh.circuit.wires.length }), { c: 0, w: 0 });
  const grantedNow = granted.includes(action);

  const pay = () => {
    if (points < POINTS_COST) {
      notify(t('not_enough_points'));
      return;
    }
    setStage('paying');
    setErr(false);
    setTimeout(() => {
      const next = points - POINTS_COST;
      onPoints(next);
      const newCode = makeAccessCode();
      setCode(newCode);
      const list = readAccess();
      const existing = list.find((a) => a.shareId === share.id);
      if (existing) {
        existing.code = newCode;
        existing.granted = Array.from(new Set([...existing.granted, action]));
      } else {
        list.unshift({ shareId: share.id, code: newCode, granted: [action], at: Date.now() });
      }
      writeAccess(list);
      setGranted(Array.from(new Set([...granted, action])));
      setStage('code');
      notify(t('payment_done'));
    }, 1000);
  };

  const unlock = () => {
    if (entered.trim().toUpperCase() === code.toUpperCase() && code) {
      setErr(false);
      if (action === 'edit') {
        onLoadProject(share.project);
        onClose();
      } else if (action === 'download') {
        const blob = new Blob([JSON.stringify(share.project, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${share.name.replace(/[\\/:*?"<>|]/g, '') || 'community-circuit'}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        notify(t('download_started'));
      } else {
        setPreview(true);
      }
    } else {
      setErr(true);
    }
  };

  const actions: { id: ShareAction; icon: string; label: string }[] = [
    { id: 'view', icon: '👁', label: t('view_circuit') },
    { id: 'download', icon: '⬇', label: t('download_file') },
    { id: 'edit', icon: '✎', label: t('edit_circuit') },
  ];

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-3" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-100">{share.name}</div>
            <div className="text-[10px] text-slate-500">
              {share.author || t('anonymous')} · {share.domain === 'electronics' ? '🔌 Electronics' : '⚡ Electrical'} · {share.visibility === 'private' ? '🔒' : '🌍'} {share.visibility === 'private' ? t('private') : t('public')}
            </div>
          </div>
          <div className="ms-2 flex shrink-0 items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-200">
            🪙 {points}
          </div>
          <button onClick={onClose} className="ms-1 rounded px-2 text-lg leading-none text-slate-400 hover:bg-slate-800">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {actions.map((a) => (
              <button
                key={a.id}
                onClick={() => { setAction(a.id); setEntered(''); setErr(false); setStage(granted.includes(a.id) ? 'code' : 'locked'); setPreview(false); }}
                className={`rounded-lg border p-2 text-center text-[11px] font-bold transition ${action === a.id ? 'border-sky-500 bg-sky-500/20 text-sky-200' : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'}`}
              >
                <div className="text-base">{a.icon}</div>
                {a.label}
                <div className={`mt-0.5 text-[9px] font-semibold ${granted.includes(a.id) ? 'text-emerald-400' : 'text-amber-300'}`}>
                  {granted.includes(a.id) ? '✓ ' + t('unlocked') : `🪙 ${POINTS_COST} ${t('points')}`}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-2 rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-[10px] text-slate-300">
            <div className="flex justify-between"><span>{t('sheets')}</span><b>{share.project.sheets.length}</b></div>
            <div className="flex justify-between"><span>{t('components')}</span><b>{stats.c}</b></div>
            <div className="flex justify-between"><span>{t('wires')}</span><b>{stats.w}</b></div>
          </div>

          {stage === 'locked' && (
            <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2">
              <div className="text-[11px] font-bold text-amber-200">🪙 {POINTS_COST} {t('points_required')}</div>
              <div className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{t('points_note')}</div>
              <button onClick={pay} disabled={points < POINTS_COST} className="mt-2 w-full rounded-md bg-amber-500 px-3 py-2 text-[11px] font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40">
                🪙 {t('send_points')} ({POINTS_COST})
              </button>
              {points < POINTS_COST && <div className="mt-1 text-center text-[10px] text-red-400">{t('not_enough_points')}</div>}
            </div>
          )}

          {stage === 'paying' && (
            <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-[11px] font-semibold text-sky-200">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
              {t('payment_processing')}
            </div>
          )}

          {stage === 'code' && (
            <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2">
              <div className="text-[11px] font-bold text-emerald-300">✓ {t('payment_complete')}</div>
              {code && !grantedNow ? null : null}
              {code && (
                <>
                  <div className="mt-1 text-[10px] text-slate-400">{t('access_code_label')}</div>
                  <div className="mt-1 flex items-center gap-1">
                    <code className="flex-1 truncate rounded border border-emerald-600/50 bg-slate-950 px-2 py-1.5 font-mono text-sm font-bold tracking-wider text-emerald-300" dir="ltr">{code}</code>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(code);
                          notify(t('copied'));
                        } catch {
                          notify(code);
                        }
                      }}
                      className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-[11px] font-bold text-slate-200"
                    >
                      📋
                    </button>
                  </div>
                </>
              )}
              <div className="mt-2 text-[10px] text-slate-400">{t('paste_code_hint')}</div>
              <div className="mt-1 flex gap-1.5">
                <input value={entered} onChange={(e) => { setEntered(e.target.value.toUpperCase()); setErr(false); }} placeholder="CCS-XXXXXX" className={`${inputCls} flex-1 font-mono text-[11px] tracking-wider`} dir="ltr" />
                <button onClick={unlock} className="rounded-md bg-emerald-500 px-3 text-[11px] font-bold text-white hover:bg-emerald-400">🔓 {t('access')}</button>
              </div>
              {err && <div className="mt-1 text-[10px] font-semibold text-red-400">{t('wrong_access_code')}</div>}
            </div>
          )}

          {preview && (
            <div className="mt-2 rounded-lg border border-slate-700 bg-white p-2">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('circuit_preview')}</div>
              <div className="grid max-h-44 grid-cols-4 gap-1 overflow-y-auto">
                {comps.slice(0, 24).map((c) => (
                  <div key={c.id} className="flex flex-col items-center rounded border border-slate-200 bg-slate-50 p-0.5" title={c.label || c.type}>
                    <svg viewBox="0 0 120 90" className="h-9 w-full">
                      <g transform="translate(10 10) scale(1)"><Symbol c={c} mode="edit" selected={false} faulted={false} /></g>
                    </svg>
                    <span className="w-full truncate text-center text-[8px] text-slate-600">{c.label || c.type}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1 text-[9px] text-slate-500">
                {wires.length} {t('wires')} · {comps.length} {t('components').toLowerCase()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, danger, onClick }: { icon: string; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-xs font-medium ${danger ? 'text-red-300 hover:bg-red-500/10' : 'text-slate-200 hover:bg-slate-700/60'}`}>
      <span className="w-4 shrink-0 text-center">{icon}</span>
      {label}
    </button>
  );
}

export function SaveProjectDialog({ t, onSave, onClose }: { t: T; onSave: (name: string, ext: string) => boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const submit = () => {
    let nm = name.trim();
    let ext = 'json';
    try {
      ext = localStorage.getItem('ccs.ext') || 'json';
    } catch {
      /* ignore */
    }
    const m = nm.match(/\.([A-Za-z0-9]+)$/);
    if (m) {
      const found = PROJECT_EXTS.find((e) => e.toLowerCase() === m[1].toLowerCase());
      if (found) {
        ext = found;
        nm = nm.slice(0, nm.length - m[0].length).trim();
      }
    }
    if (!nm) nm = `${t('project')} ${new Date().toLocaleString()}`;
    if (onSave(nm, ext)) {
      try {
        localStorage.setItem('ccs.ext', ext);
      } catch {
        /* ignore */
      }
      onClose();
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-sm font-bold text-slate-100">{t('save_project')}</div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder={t('project_name_ext')} className={inputCls} />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-600">
            {t('cancel')}
          </button>
          <button onClick={submit} className="rounded-md bg-emerald-500 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-400">
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
