import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LZString from 'lz-string';
import type { Account, Circuit, ComponentType, DeviceState, Lang, Mode, Note, Project, Sheet, SimEvent, SimSnapshot, TermRef } from './types';
import { CATALOG, PHASE_SIZE, isPhaseWire, isSupply, makeComponent, nextLabel, uid } from './lib/catalog';
import { initialStates, simStep } from './lib/engine';
import { EXAMPLES, exampleDOL } from './lib/examples';
import { LANGS, makeT } from './lib/i18n';
import Canvas, { type Selection, type View } from './components/Canvas';

const CanvasMemo = memo(Canvas);
const EMPTY_NOTES: Note[] = [];
import Palette from './components/Palette';
import PropertiesPanel from './components/PropertiesPanel';
import Toolbar from './components/Toolbar';
import EditorModal from './components/EditorModal';
import { ProjectDialog, SaveProjectDialog, readLibrary, writeLibrary, projectDomain } from './components/Dialogs';
import LogicLab from './components/LogicLab';
import { RotateCw, FlipHorizontal, Lock, Unlock } from 'lucide-react';
import SheetTabs from './components/SheetTabs';
import { AboutDialog, AccountDialog, CommDialog, NotesDialog, NotificationsPanel } from './components/Dialogs';

const LS_NEW = 'ccs.project.v3';
const LS_OLD = 'ccs.circuit.v1';
const LS_LANG = 'ccs.lang';
const LS_DARK = 'ccs.dark';
const LS_ACC = 'ccs.account';
const TICK = 0.04;

/** Upgrade older saved circuits and drop anything the catalog does not know. */
function migrateCircuit(raw: any): Circuit {
  const legacy = !raw?.v;
  const comps = ((raw?.components || []) as any[])
    .map((k) => (legacy && k && k.type === 'supply3' ? { ...k, type: 'supply3npe' } : k))
    .filter((k) => k && typeof k.type === 'string' && k.type in CATALOG)
    .map((k) => ({ ...k, props: { ...CATALOG[k.type as keyof typeof CATALOG].defaults, ...(k.props || {}) } }));
  const ids = new Set(comps.map((k) => k.id));
  for (const k of comps) if (k.props && k.props.parent && !ids.has(k.props.parent)) k.props.parent = '';
  const wires = ((raw?.wires || []) as any[]).filter((w) => w && w.a && w.b && ids.has(w.a.c) && ids.has(w.b.c));
  const notes = Array.isArray(raw?.notes) ? raw.notes.filter((n: any) => n && typeof n.x === 'number' && typeof n.y === 'number') : [];
  return { v: 2, components: comps, wires, notes };
}

function migrateProject(raw: any): Project {
  if (raw && Array.isArray(raw.sheets) && raw.sheets.length) {
    const sheets: Sheet[] = raw.sheets.map((sh: any, i: number) => ({
      name: typeof sh?.name === 'string' && sh.name ? sh.name : `Sheet ${i + 1}`,
      circuit: migrateCircuit(sh?.circuit || {}),
    }));
    const active = Math.min(Math.max(0, Number(raw.active) || 0), sheets.length - 1);
    return { v: 3, sheets, active };
  }
  return { v: 3, sheets: [{ name: 'Sheet 1', circuit: migrateCircuit(raw || {}) }], active: 0 };
}

function loadInitialProject(): Project {
  try {
    const h = window.location.hash;
    const m = h.match(/c=([^&]+)/);
    if (m) {
      const json = LZString.decompressFromEncodedURIComponent(m[1]);
      if (json) {
        const c = JSON.parse(json);
        if (c && (Array.isArray(c.sheets) || Array.isArray(c.components))) return migrateProject(c);
      }
    }
  } catch {
    /* ignore */
  }
  for (const key of [LS_NEW, LS_OLD]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const c = JSON.parse(raw);
        if (c && (Array.isArray(c.sheets) || (Array.isArray(c.components) && c.components.length))) return migrateProject(c);
      }
    } catch {
      /* ignore */
    }
  }
  return { v: 3, sheets: [{ name: 'Sheet 1', circuit: exampleDOL() }], active: 0 };
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(LS_LANG) as Lang) || 'en');
  const t = useMemo(() => makeT(lang), [lang]);
  const rtl = LANGS.find((l) => l.code === lang)?.dir === 'rtl';

  const [project, setProject] = useState<Project>(loadInitialProject);
  const [mode, setMode] = useState<Mode>('edit');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [placing, setPlacing] = useState<ComponentType | null>(null);
  const [notePlacing, setNotePlacing] = useState(false);
  const [noteEdit, setNoteEdit] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);
  const [notifs, setNotifs] = useState<SimEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<View>({ x: 40, y: 20, zoom: 1 });
  const [toast, setToast] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showLogic, setShowLogic] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [showComm, setShowComm] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showLeft, setShowLeft] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  const [showRight, setShowRight] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem(LS_DARK) === '1');
  const [account, setAccount] = useState<Account | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_ACC) || 'null');
    } catch {
      return null;
    }
  });
  const [hist, setHist] = useState({ u: 0, r: 0 });

  const statesRef = useRef<Record<string, DeviceState>>({});
  const timeRef = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const notifOpenRef = useRef(notifOpen);
  notifOpenRef.current = notifOpen;
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const lastUpdPush = useRef<{ id: string; t: number }>({ id: '', t: 0 });

  const sheetIndex = Math.min(project.active, project.sheets.length - 1);
  const sheet = project.sheets[sheetIndex];
  const circuit = sheet.circuit;
  const circuitRef = useRef(circuit);
  circuitRef.current = circuit;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    localStorage.setItem(LS_LANG, lang);
  }, [lang, rtl]);

  // autosave
  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(LS_NEW, JSON.stringify(project)), 400);
    return () => clearTimeout(id);
  }, [project]);

  const hideLeftPanel = useCallback(() => setShowLeft(false), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // ---------- undo / redo ----------
  const pushHistory = useCallback(() => {
    const cur = JSON.stringify(projectRef.current);
    const past = pastRef.current;
    if (past.length && past[past.length - 1] === cur) return;
    past.push(cur);
    if (past.length > 100) past.shift();
    futureRef.current = [];
    setHist({ u: past.length, r: 0 });
  }, []);

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (!past.length) return;
    futureRef.current.push(JSON.stringify(projectRef.current));
    setProject(JSON.parse(past.pop()!));
    setSelection(null);
    setShowEditor(false);
    setNoteEdit(null);
    setHist({ u: past.length, r: futureRef.current.length });
  }, []);

  const redo = useCallback(() => {
    const fut = futureRef.current;
    if (!fut.length) return;
    pastRef.current.push(JSON.stringify(projectRef.current));
    setProject(JSON.parse(fut.pop()!));
    setSelection(null);
    setShowEditor(false);
    setNoteEdit(null);
    setHist({ u: pastRef.current.length, r: fut.length });
  }, []);

  // ---------- simulation loop (active sheet) ----------
  useEffect(() => {
    if (mode !== 'run') {
      setSnapshot(null);
      return;
    }
    statesRef.current = initialStates(circuitRef.current);
    timeRef.current = 0;
    const h = setInterval(() => {
      let last: ReturnType<typeof simStep> | null = null;
      const newEvents: SimEvent[] = [];
      for (let i = 0; i < speedRef.current; i++) {
        last = simStep(circuitRef.current, statesRef.current, TICK, timeRef.current);
        statesRef.current = last.states;
        timeRef.current += TICK;
        newEvents.push(...last.newEvents);
      }
      if (last) {
        setSnapshot(last);
        for (let i = newEvents.length - 1; i >= 0; i--) {
          if (newEvents[i].level === 'error') {
            setFault(newEvents[i].text);
            break;
          }
        }
        const nb = newEvents.filter((e) => e.level === 'error' || e.level === 'warn');
        if (nb.length) {
          setNotifs((prev) => [...prev, ...nb].slice(-50));
          if (!notifOpenRef.current) setUnread((u) => u + nb.length);
        }
      }
    }, TICK * 1000);
    return () => clearInterval(h);
  }, [mode, sheetIndex]);

  useEffect(() => {
    if (!fault) return;
    const id = setTimeout(() => setFault(null), 3000);
    return () => clearTimeout(id);
  }, [fault]);

  // ---------- circuit editing (active sheet) ----------
  const updateCircuit = useCallback((fn: (c: Circuit) => Circuit) => {
    setProject((p) => ({ ...p, sheets: p.sheets.map((sh, i) => (i === p.active ? { ...sh, circuit: fn(sh.circuit) } : sh)) }));
  }, []);

  const addComponent = (type: ComponentType) => {
    if (mode === 'run') return;
    setPlacing(type);
    setNotePlacing(false);
    setSelection(null);
  };

  const placeComponent = useCallback(
    (type: ComponentType, x: number, y: number) => {
      pushHistory();
      const comp = makeComponent(type, x, y, circuitRef.current.components);
      updateCircuit((c) => ({ ...c, components: [...c.components, comp] }));
      setSelection({ kind: 'comp', id: comp.id });
      setPlacing(null);
    },
    [pushHistory, updateCircuit],
  );

  const cancelPlace = useCallback(() => {
    setPlacing(null);
    setNotePlacing(false);
  }, []);

  const moveComponent = useCallback(
    (id: string, x: number, y: number) => {
      updateCircuit((c) => ({ ...c, components: c.components.map((k) => (k.id === id ? { ...k, x, y } : k)) }));
    },
    [updateCircuit],
  );

  /** Pin -> free canvas: create a short junction-style stub ending at (x, y). */
  const addJoint = useCallback(
    (a: TermRef, x: number, y: number) => {
      const jx = Math.round(x / 10) * 10;
      const jy = Math.round(y / 10) * 10;
      pushHistory();
      updateCircuit((cc) => {
        const jid = uid('j');
        return {
          ...cc,
          components: [...cc.components, { id: jid, type: 'junction', x: jx, y: jy, label: nextLabel('junction', cc.components), props: {} }],
          wires: [...cc.wires, { id: uid('w'), a, b: { c: jid, p: 'p' }, route: 'elbow' as const }],
        };
      });
      showToast(t('junction_added'));
    },
    [pushHistory, updateCircuit, showToast, t],
  );

  const addWire = useCallback(
    (a: TermRef, b: TermRef) => {
      const c = circuitRef.current;
      const dup = c.wires.some((w) => (w.a.c === a.c && w.a.p === a.p && w.b.c === b.c && w.b.p === b.p) || (w.a.c === b.c && w.a.p === b.p && w.b.c === a.c && w.b.p === a.p));
      if (dup) return;
      pushHistory();
      const phase = isPhaseWire({ id: 'probe', a, b }, new Map(c.components.map((k) => [k.id, k] as const)), c.wires);
      updateCircuit((cc2) => ({ ...cc2, wires: [...cc2.wires, { id: uid('w'), a, b, size: phase ? PHASE_SIZE : 2 }] }));
    },
    [pushHistory, updateCircuit],
  );

  const setWireMid = useCallback(
    (id: string, mid: number, hv?: boolean) => {
      updateCircuit((c) => ({ ...c, wires: c.wires.map((w) => (w.id === id ? { ...w, mid, hv } : w)) }));
    },
    [updateCircuit],
  );

  const lockSelection = useCallback(() => {
    if (!selection || selection.kind !== 'comp') return;
    if (mode === 'run') return;
    pushHistory();
    updateCircuit((c) => ({ ...c, components: c.components.map((k) => (k.id === selection.id ? { ...k, locked: !k.locked } : k)) }));
  }, [selection, mode, pushHistory, updateCircuit]);

  const unlockAll = useCallback(() => {
    if (!circuit.components.some((k) => k.locked)) return;
    pushHistory();
    updateCircuit((c) => ({ ...c, components: c.components.map((k) => (k.locked ? { ...k, locked: false } : k)) }));
  }, [circuit.components, pushHistory, updateCircuit]);

  const rotateSelection = useCallback(() => {
    if (!selection || selection.kind !== 'comp') return;
    pushHistory();
    updateCircuit((c) => ({ components: c.components.map((k) => (k.id === selection.id ? { ...k, rot: (((k.rot || 0) + 90) % 360) as number } : k)), wires: c.wires }));
  }, [selection, pushHistory, updateCircuit]);

  const mirrorSelection = useCallback(() => {
    if (!selection || selection.kind !== 'comp') return;
    pushHistory();
    updateCircuit((c) => ({ components: c.components.map((k) => (k.id === selection.id ? { ...k, mirror: !k.mirror } : k)), wires: c.wires }));
  }, [selection, pushHistory, updateCircuit]);

  const setWireSize = useCallback((id: string, size: number) => {
    pushHistory();
    updateCircuit((c) => ({ ...c, wires: c.wires.map((w) => (w.id === id ? { ...w, size: Math.max(1, Math.min(12, size)) } : w)) }));
  }, [pushHistory, updateCircuit]);

  const setWireRoute = useCallback((id: string, route: string) => {
    pushHistory();
    updateCircuit((c) => ({ ...c, wires: c.wires.map((w) => (w.id === id ? { ...w, route: route as any, mid: undefined } : w)) }));
  }, [pushHistory, updateCircuit]);

  const flipWire = useCallback((id: string) => {
    pushHistory();
    updateCircuit((c) => ({ ...c, wires: c.wires.map((w) => (w.id === id ? { ...w, hv: !w.hv, mid: undefined } : w)) }));
  }, [pushHistory, updateCircuit]);

  const setWireColor = useCallback(
    (id: string, color: string) => {
      pushHistory();
      updateCircuit((c) => ({ ...c, wires: c.wires.map((w) => (w.id === id ? { ...w, color } : w)) }));
    },
    [pushHistory, updateCircuit],
  );

  const updateComponent = (id: string, patch: { label?: string; props?: Record<string, any> }) => {
    const now = Date.now();
    const last = lastUpdPush.current;
    if (last.id !== id || now - last.t > 1500) {
      pushHistory();
      lastUpdPush.current = { id, t: now };
    }
    updateCircuit((c) => ({
      ...c,
      components: c.components.map((k) => (k.id === id ? { ...k, ...(patch.label !== undefined ? { label: patch.label } : {}), props: { ...k.props, ...(patch.props || {}) } } : k)),
    }));
  };

  const deleteSelection = useCallback(() => {
    if (!selection || mode === 'run') return;
    pushHistory();
    updateCircuit((c) => {
      if (selection.kind === 'wire') return { ...c, wires: c.wires.filter((w) => w.id !== selection.id) };
      return {
        ...c,
        components: c.components.filter((k) => k.id !== selection.id).map((k) => (k.props.parent === selection.id ? { ...k, props: { ...k.props, parent: '' } } : k)),
        wires: c.wires.filter((w) => w.a.c !== selection.id && w.b.c !== selection.id),
      };
    });
    setSelection(null);
  }, [selection, mode, pushHistory, updateCircuit]);

  const duplicateSelection = useCallback(() => {
    if (!selection || selection.kind !== 'comp' || mode === 'run') return;
    const c = circuitRef.current;
    const src = c.components.find((k) => k.id === selection.id);
    if (!src) return;
    pushHistory();
    const copy = { ...src, id: uid(), x: src.x + 60, y: src.y, props: { ...src.props }, label: CATALOG[src.type].prefix ? nextLabel(src.type, c.components) : src.label };
    updateCircuit((cc) => ({ ...cc, components: [...cc.components, copy] }));
    setSelection({ kind: 'comp', id: copy.id });
  }, [selection, mode, pushHistory, updateCircuit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        redo();
        return;
      }
      if (typing) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelection();
      } else if (e.key === ' ') {
        e.preventDefault();
        setMode((m) => (m === 'run' ? 'edit' : 'run'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelection, duplicateSelection, undo, redo]);

  // ---------- notes ----------
  const addNote = useCallback(
    (x: number, y: number) => {
      pushHistory();
      const id = uid('n');
      updateCircuit((c) => ({ ...c, notes: [...(c.notes || []), { id, x, y, text: '' }] }));
      setNotePlacing(false);
      setNoteEdit(id);
    },
    [pushHistory, updateCircuit],
  );

  const moveNote = useCallback(
    (id: string, x: number, y: number) => {
      updateCircuit((c) => ({ ...c, notes: (c.notes || []).map((n) => (n.id === id ? { ...n, x, y } : n)) }));
    },
    [updateCircuit],
  );

  const updateNoteText = useCallback(
    (id: string, text: string) => {
      updateCircuit((c) => ({ ...c, notes: (c.notes || []).map((n) => (n.id === id ? { ...n, text } : n)) }));
    },
    [updateCircuit],
  );

  const deleteNote = useCallback(
    (id: string) => {
      updateCircuit((c) => ({ ...c, notes: (c.notes || []).filter((n) => n.id !== id) }));
      setNoteEdit(null);
    },
    [updateCircuit],
  );

  const openNoteEditor = useCallback(
    (id: string) => {
      pushHistory();
      setNoteEdit(id);
    },
    [pushHistory],
  );

  // ---------- run-mode operation ----------
  const operate = useCallback(
    (id: string, action: 'down' | 'up') => {
      const c = circuitRef.current.components.find((k) => k.id === id);
      const s = statesRef.current[id];
      if (!c || !s) return;
      if (isSupply(c.type) || c.type === 'psu24') {
        if (action === 'down' && s.tripped) s.tripped = false;
        return;
      }
      switch (c.type) {
        case 'pb_no':
        case 'pb_nc':
        case 'pb_dual':
          s.pressed = action === 'down';
          break;
        case 'timer':
        case 'ton':
        case 'tof':
        case 'tsd':
        case 'tp':
        case 'rto':
        case 'tcy':
          if (action === 'down' && (c.props.mode === 'rto' || c.type === 'rto')) {
            s.t = 0;
            s.out = false;
            s.fired = false;
            showToast(`\u21ba ${c.label || 'Timer'} – ${t('reset')}`);
          }
          break;
        case 'estop':
        case 'switch':
        case 'sens_limit':
        case 'sens_float':
        case 'sens_pressure':
        case 'sens_temp':
        case 'sens_photo':
        case 'sens_prox':
        case 'sens_reed':
        case 'sens_flow':
        case 'sens_vibration':
        case 'iso1':
        case 'iso2':
        case 'iso3':
        case 'esw1':
          if (action === 'down') s.on = !s.on;
          break;
        case 'cos1':
        case 'sel3':
          if (action === 'down') s.pos = ((s.pos || 0) + 1) % 3;
          break;
        case 'fsw1':
        case 'fsw3':
        case 'fsw2':
          if (action === 'down') {
            if (s.tripped) {
              s.tripped = false;
              s.heat = 0;
              s.current = 0;
            } else s.on = !s.on;
          }
          break;
        case 'mcb1':
        case 'mcb2':
        case 'mcb3':
        case 'mccb':
        case 'mccb4':
        case 'mpcb':
        case 'rccb':
        case 'rcbo':
        case 'rccb4':
          if (action === 'down') {
            if (s.tripped) {
              s.tripped = false;
              s.on = false;
              s.heat = 0;
              s.current = 0;
            } else s.on = !s.on;
          }
          break;
        case 'fuse':
        case 'fuse3':
        case 'fuse2':
          if (action === 'down' && s.tripped) {
            s.tripped = false;
            s.heat = 0;
            s.current = 0;
          }
          break;
        case 'overload':
        case 'dol_combo':
          if (action === 'down' && s.tripped) {
            if ((s.heat || 0) < 0.3) s.tripped = false;
            else showToast(`${c.label}: still hot (${Math.round((s.heat || 0) * 100)} %) – wait to cool before reset`);
          }
          break;
      }
    },
    [showToast],
  );

  const setLoad = useCallback((id: string, load: number) => {
    const st = statesRef.current[id];
    if (!st) return;
    const comp = circuitRef.current.components.find((k) => k.id === id);
    if (comp && comp.type === 'stc3008') {
      st.temp = load;
      (comp.props as any).simTemp = load;
    } else st.load = load;
  }, []);

  const resetSim = () => {
    statesRef.current = initialStates(circuitRef.current);
    timeRef.current = 0;
  };

  // ---------- sheets ----------
  const loadProject = useCallback((p: Project, push = true) => {
    if (push) {
      const cur = JSON.stringify(projectRef.current);
      pastRef.current.push(cur);
      if (pastRef.current.length > 100) pastRef.current.shift();
      futureRef.current = [];
      setHist({ u: pastRef.current.length, r: 0 });
    }
    setMode('edit');
    setSelection(null);
    setPlacing(null);
    setNotePlacing(false);
    setNoteEdit(null);
    setShowEditor(false);
    setProject(p);
  }, []);

  const switchSheet = (i: number) => {
    if (i === sheetIndex) return;
    setSelection(null);
    setPlacing(null);
    setNotePlacing(false);
    setNoteEdit(null);
    setShowEditor(false);
    setFault(null);
    setProject((p) => ({ ...p, active: i }));
  };

  const addSheet = () => {
    pushHistory();
    setProject((p) => {
      let n = p.sheets.length + 1;
      const names = new Set(p.sheets.map((s) => s.name));
      while (names.has(`Sheet ${n}`)) n++;
      return { ...p, sheets: [...p.sheets, { name: `Sheet ${n}`, circuit: { v: 2, components: [], wires: [], notes: [] } }], active: p.sheets.length };
    });
    setSelection(null);
    setShowEditor(false);
  };

  const renameSheet = (i: number) => {
    const cur = project.sheets[i]?.name || `Sheet ${i + 1}`;
    const name = window.prompt(t('sheet_name'), cur);
    if (!name || name === cur) return;
    pushHistory();
    setProject((p) => ({ ...p, sheets: p.sheets.map((sh, j) => (j === i ? { ...sh, name } : sh)) }));
  };

  const closeSheet = (i: number) => {
    if (project.sheets.length <= 1) return;
    if (!window.confirm(t('confirm_sheet_delete'))) return;
    pushHistory();
    setProject((p) => {
      const sheets = p.sheets.filter((_, j) => j !== i);
      return { ...p, sheets, active: Math.min(p.active >= i && p.active > 0 ? p.active - 1 : p.active, sheets.length - 1) };
    });
    setSelection(null);
    setShowEditor(false);
  };

  const clearSheet = () => {
    if (!circuit.components.length && !circuit.wires.length && !(circuit.notes || []).length) return;
    if (!window.confirm(t('confirm_clear'))) return;
    pushHistory();
    updateCircuit(() => ({ v: 2, components: [], wires: [], notes: [] }));
    setSelection(null);
    setShowEditor(false);
  };

  // ---------- file / share ----------

  const saveProjectAs = (name: string, ext: string): boolean => {
    const lib = readLibrary();
    const clean = name.trim() || `${t('project')} ${new Date().toLocaleString()}`;
    if (lib.some((x) => x.name === clean) && !window.confirm(t('overwrite_project'))) return false;
    const snapshot: Project = JSON.parse(JSON.stringify(projectRef.current));
    snapshot.v = 3;
    try {
      writeLibrary([{ name: clean, ext, savedAt: Date.now(), domain: projectDomain(snapshot), project: snapshot }, ...lib.filter((x) => x.name !== clean)]);
    } catch (err) {
      showToast(t('save_failed') + ' (storage full?)');
      return false;
    }
    // verify it is really persisted
    const stored = readLibrary().find((x) => x.name === clean);
    if (!stored) {
      showToast(t('save_failed'));
      return false;
    }
    showToast(`💾 ${clean} · ${t('saved_to_workspace')}`);
    return true;
  };
  const onSave = () => setShowSave(true);


  const onOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then((txt) => {
      try {
        const c = JSON.parse(txt);
        if (c && (Array.isArray(c.sheets) || Array.isArray(c.components))) {
          loadProject(migrateProject(c));
          history.replaceState(null, '', window.location.pathname);
        } else showToast('Invalid file');
      } catch {
        showToast('Invalid file');
      }
    });
    e.target.value = '';
  };

  const shareUrl = () => {
    const code = LZString.compressToEncodedURIComponent(JSON.stringify(project));
    return `${window.location.origin}${window.location.pathname}#c=${code}`;
  };

  const onShare = async () => {
    const url = shareUrl();
    history.replaceState(null, '', `#c=${url.split('#c=')[1]}`);
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('share_copied'));
    } catch {
      window.prompt('Share link', url);
    }
  };

  const onTelegram = () => {
    const url = shareUrl();
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Classic Control Simulator circuit')}`, '_blank');
  };

  const onCapture = () => {
    const svg = document.querySelector('svg.canvas-root') as SVGSVGElement | null;
    if (!svg) return;
    const W = svg.clientWidth || 800;
    const H = svg.clientHeight || 600;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(W));
    clone.setAttribute('height', String(H));
    clone.setAttribute('viewBox', `0 0 ${W} ${H}`);
    clone.removeAttribute('class');
    clone.setAttribute('style', `${clone.getAttribute('style') || ''};font-family:Inter,system-ui,sans-serif`);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = W * 2;
        cv.height = H * 2;
        const ctx = cv.getContext('2d')!;
        ctx.fillStyle = dark ? '#0b1120' : '#f8fafc';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0, W, H);
        URL.revokeObjectURL(url);
        cv.toBlob((b) => {
          if (!b) {
            showToast('Capture failed');
            return;
          }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'circuit.png';
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          showToast(`📸 ${t('capture')} ✓`);
        });
      } catch {
        showToast('Capture failed');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast('Capture failed');
    };
    img.src = url;
  };

  const importProject = (text: string): boolean => {
    try {
      let json: string | null = null;
      try {
        json = LZString.decompressFromEncodedURIComponent(text);
      } catch {
        /* not compressed */
      }
      const c = JSON.parse(json || text);
      if (c && (Array.isArray(c.sheets) || Array.isArray(c.components))) {
        loadProject(migrateProject(c));
        history.replaceState(null, '', window.location.pathname);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    (window as any).__loadExample = (key: string) => onExample(key);
    (window as any).__buildExample = (key: string) => {
      const ex = EXAMPLES.find((e) => e.key === key);
      return ex ? ex.build() : null;
    };
    return () => {
      delete (window as any).__loadExample;
      delete (window as any).__buildExample;
    };
  });

  const onExample = (key: string) => {
    const ex = EXAMPLES.find((e) => e.key === key);
    if (!ex) return;
    loadProject({ v: 3, sheets: [{ name: t(ex.titleKey), circuit: ex.build() }], active: 0 });
    history.replaceState(null, '', window.location.pathname);
    showToast(t(ex.titleKey));
  };

  const changeMode = (m: Mode) => {
    setPlacing(null);
    setNotePlacing(false);
    setShowEditor(false);
    setMode(m);
  };

  const toggleDark = () => {
    setDark((d) => {
      localStorage.setItem(LS_DARK, d ? '0' : '1');
      return !d;
    });
  };

  const saveAccount = (a: Account) => {
    setAccount(a);
    localStorage.setItem(LS_ACC, JSON.stringify(a));
    setShowAccount(false);
  };

  const signOut = () => {
    setAccount(null);
    localStorage.removeItem(LS_ACC);
    setShowAccount(false);
  };

  const unlinked = useMemo(() => circuit.components.filter((c) => CATALOG[c.type].linked && !circuit.components.some((p) => p.id === c.props.parent)).length, [circuit]);

  const activeNote = noteEdit ? (circuit.notes || []).find((n) => n.id === noteEdit) : undefined;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-900 text-slate-100" dir={rtl ? 'rtl' : 'ltr'}>
      <Toolbar
        t={t}
        lang={lang}
        setLang={setLang}
        mode={mode}
        setMode={changeMode}
        speed={speed}
        setSpeed={setSpeed}
        onReset={resetSim}
        canUndo={hist.u > 0}
        canRedo={hist.r > 0}
        onUndo={undo}
        onRedo={redo}
        onSave={onSave}
        onLoad={() => fileRef.current?.click()}
        onProject={() => setShowProject(true)}
        onClear={clearSheet}
        onExample={onExample}
        dark={dark}
        onToggleDark={toggleDark}
        onCapture={onCapture}
        onComm={() => setShowComm(true)}
        onShare={onShare}
        onTelegram={onTelegram}
        notifCount={unread}
        notifOpen={notifOpen}
        onNotifToggle={() => {
          setNotifOpen((o) => !o);
          setUnread(0);
        }}
        commentsActive={notePlacing}
        onComments={() => {
          if (mode === 'run') return;
          setNotePlacing((v) => !v);
          setPlacing(null);
        }}
        onAbout={() => setShowAbout(true)}
        account={account}
        onAccount={() => setShowAccount(true)}
        leftOpen={showLeft}
        onToggleLeft={() => setShowLeft((v) => !v)}
        onToggleRight={() => setShowRight((v) => !v)}
      />
      <input ref={fileRef} type="file" accept=".json,.sim,.prj,.ckt,.circ,.Elec,.Smrl,application/json" className="hidden" onChange={onOpenFile} />
      <SheetTabs names={project.sheets.map((s) => s.name)} active={sheetIndex} t={t} onSwitch={switchSheet} onAdd={addSheet} onRename={renameSheet} onClose={closeSheet} />

      <div className="relative flex min-h-0 flex-1">
        {/* left palette */}
        <aside className={`${showLeft ? 'flex' : 'hidden'} absolute inset-y-0 start-0 z-20 w-64 flex-col border-e border-slate-700 bg-slate-900 shadow-2xl md:static md:w-60 md:shadow-none`}>
          <Palette
            lang={lang}
            t={t}
            onAdd={(ty) => {
              addComponent(ty);
              if (window.innerWidth < 768) setShowLeft(false);
            }}
            disabled={mode === 'run'}
            onLogicLab={() => setShowLogic(true)}
          />
        </aside>

        {/* center */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div className="canvas-wrap h-full w-full">
              <CanvasMemo
                circuit={circuit}
                mode={mode}
                snapshot={snapshot}
                selection={selection}
                onSelect={setSelection}
                onMoveComponent={moveComponent}
                onAddWire={addWire}
                onSetWireMid={setWireMid}
                onOperate={operate}
                onView={setView}
                resetViewTitle={t('view_reset')}
                onBackgroundTap={hideLeftPanel}
                placing={placing}
                onPlace={placeComponent}
                onCancelPlace={cancelPlace}
                dark={dark}
                notes={circuit.notes ?? EMPTY_NOTES}
                notePlacing={notePlacing}
                onPlaceNote={addNote}
                onMoveNote={moveNote}
                onEditNote={openNoteEditor}
                onEditStart={pushHistory}
                onFlipWire={flipWire}
                onAddJoint={addJoint}
                onUnlockAll={unlockAll}
                onLockToggle={lockSelection}
                t_unlock_all={t('unlock_all')}
                t_fit={t('fit')}
              />
            </div>
            {/* overlays */}
            <div className="pointer-events-none absolute start-3 top-3 flex flex-col gap-2">
              {placing && <span className="w-fit rounded-md border border-amber-500/50 bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">Click on canvas to place · Esc to cancel</span>}
              {notePlacing && <span className="w-fit rounded-md border border-amber-500/50 bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">💬 {t('comments')} · Esc to cancel</span>}
              {mode === 'edit' && unlinked > 0 && <span className="w-fit rounded-md border border-red-500/50 bg-red-500/15 px-2 py-1 text-[11px] text-red-200">⚠ {unlinked} contact(s) {t('unlinked')}</span>}
            </div>
            {selection && mode === 'edit' && !placing && !notePlacing && (
              <div className="absolute left-1/2 top-3 z-20 flex w-auto max-w-[calc(100%-12px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/85 p-1 shadow-2xl backdrop-blur">
                <button onClick={() => setShowEditor(true)} className="flex shrink-0 items-center gap-1 rounded-lg border border-sky-500/60 bg-slate-800/95 px-2 py-1 text-[11px] font-bold text-sky-200 shadow-xl backdrop-blur hover:bg-slate-700">
                  {selection.kind === 'wire' ? `🎨 ${t('wire_color')}` : `✎ ${t('edit_device')}`}
                </button>
                {selection.kind === 'comp' && (() => {
                  const sc = circuit.components.find((k) => k.id === selection.id);
                  const locked = !!sc?.locked;
                  return (
                  <>
                    <button onClick={lockSelection} title={locked ? t('unlock') : t('lock')} className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold shadow-xl backdrop-blur ${locked ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200' : 'border-amber-500/60 bg-slate-800/95 text-amber-200 hover:bg-slate-700'}`}>
                      {locked ? <Lock size={13} /> : <Unlock size={13} />}
                    </button>
                    <button onClick={rotateSelection} title={t('rotate')} className="flex shrink-0 items-center gap-1 rounded-lg border border-violet-500/60 bg-slate-800/95 px-2 py-1 text-[11px] font-bold text-violet-200 shadow-xl backdrop-blur hover:bg-slate-700">
                      <RotateCw size={13} /> 90°
                    </button>
                    <button onClick={mirrorSelection} title={t('mirror')} className="flex shrink-0 items-center gap-1 rounded-lg border border-fuchsia-500/60 bg-slate-800/95 px-2 py-1 text-[11px] font-bold text-fuchsia-200 shadow-xl backdrop-blur hover:bg-slate-700">
                      <FlipHorizontal size={13} />
                    </button>
                  </>
                  );
                })()}
                {selection.kind === 'wire' && (
                  <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-violet-500/50 bg-slate-800/95 px-1 py-1 shadow-xl backdrop-blur">
                    {([['auto', '∿'], ['parallel', '∥'], ['elbow', '⌐'], ['plus', '⨯'], ['tee', '⊤'], ['step', '⌐⌐'], ['arc', '◜'], ['offset', '⇉'], ['zigzag', 'Z'], ['rail', '━'], ['straight', '╱']] as const).map(([r, icon]) => {
                      const cur = circuit.wires.find((k) => k.id === selection.id)?.route || 'auto';
                      return (
                        <button key={r} onClick={() => setWireRoute(selection.id, r)} title={t('r_' + r)} className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${cur === r ? 'bg-violet-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                          {icon}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selection.kind === 'wire' && (
                  <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-sky-500/50 bg-slate-800/95 px-1 py-1 shadow-xl backdrop-blur">
                    <button onClick={() => setWireSize(selection.id, 1)} title="-1" className="rounded px-1 text-[11px] font-bold text-slate-300 hover:bg-slate-700">−</button>
                    {[['S', 2], ['M', 3], ['L', 4], ['XXL', 6]].map(([lbl, sz]) => {
                      const w = circuit.wires.find((k) => k.id === selection.id);
                      const cur = w?.size || 2;
                      return (
                        <button key={lbl} onClick={() => setWireSize(selection.id, sz as number)} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cur === sz ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                          {lbl}
                        </button>
                      );
                    })}
                    <button onClick={() => setWireSize(selection.id, (circuit.wires.find((k) => k.id === selection.id)?.size || 2) + 1)} title="+1" className="rounded px-1 text-[11px] font-bold text-slate-300 hover:bg-slate-700">+</button>
                  </div>
                )}
                {selection.kind === 'wire' && (
                  <button onClick={() => selection.kind === 'wire' && flipWire(selection.id)} title={t('flip_route')} className="flex shrink-0 items-center gap-1 rounded-lg border border-sky-500/60 bg-slate-800/95 px-2 py-1 text-[11px] font-bold text-sky-200 shadow-xl backdrop-blur hover:bg-slate-700">
                    ⇄
                  </button>
                )}
                <button onClick={deleteSelection} className="flex shrink-0 items-center gap-1 rounded-lg border border-red-500/60 bg-slate-800/95 px-2 py-1 text-[11px] font-bold text-red-200 shadow-xl backdrop-blur hover:bg-slate-700">
                  🗑 {t('delete')}
                </button>
              </div>
            )}
            {fault && (
              <div className="pointer-events-none absolute left-1/2 top-16 max-w-[90%] -translate-x-1/2 truncate rounded-lg border border-red-500 bg-red-600/90 px-4 py-2 text-xs font-bold text-white shadow-xl fault-flash">
                ⚡ {t('fault_banner')}: {fault}
              </div>
            )}
            <div className="pointer-events-none absolute bottom-2 start-3 end-3 truncate rounded-md bg-slate-900/70 px-2 py-1 text-[10px] text-slate-300 backdrop-blur">{mode === 'run' ? t('hint_run') : t('hint_edit')}</div>
            {toast && <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-xs text-slate-100 shadow-xl">{toast}</div>}
          </div>
        </main>

        {/* right properties */}
        <aside className={`${showRight ? 'flex' : 'hidden'} absolute inset-y-0 end-0 z-20 w-72 flex-col border-s border-slate-700 bg-slate-900 shadow-2xl md:static md:flex md:shadow-none`}>
          <PropertiesPanel
            circuit={circuit}
            selection={selection}
            mode={mode}
            snapshot={snapshot}
            lang={lang}
            t={t}
            onUpdate={updateComponent}
            onDelete={deleteSelection}
            onDuplicate={duplicateSelection}
            onSetLoad={setLoad}
            onSetWireColor={setWireColor}
            onFlipWire={flipWire}
            onSetWireSize={setWireSize}
            onSetWireRoute={setWireRoute}
          />
        </aside>
      </div>

      {/* status bar */}
      <footer className="flex items-center gap-4 border-t border-slate-700 bg-slate-950 px-3 py-1 text-[10px] text-slate-400">
        <span className="font-semibold text-sky-300">📑 {sheet.name}</span>
        <span>
          {circuit.components.length} {t('components').toLowerCase()} · {circuit.wires.length} {t('wires')}
        </span>
        <span>
          {t('zoom')}: {Math.round(view.zoom * 100)}%
        </span>
        {snapshot && (
          <span className="font-mono text-emerald-300">
            {t('sim_time')}: {snapshot.time.toFixed(1)} s {speed > 1 ? `(×${speed})` : ''}
          </span>
        )}
        <span className="ms-auto hidden sm:inline">Space: {t('run')}/{t('stop')} · Del · Ctrl+D · Ctrl+Z · Esc</span>
      </footer>

      {showEditor && selection && (selection.kind === 'wire' ? circuit.wires.some((w) => w.id === selection.id) : circuit.components.some((c) => c.id === selection.id)) && (
        <EditorModal
          circuit={circuit}
          selection={selection}
          mode={mode}
          snapshot={snapshot}
          lang={lang}
          t={t}
          onUpdate={updateComponent}
          onDelete={deleteSelection}
          onDuplicate={duplicateSelection}
          onSetLoad={setLoad}
          onSetWireColor={setWireColor}
            onFlipWire={flipWire}
          onSetWireSize={setWireSize}
          onSetWireRoute={setWireRoute}
          onClose={() => setShowEditor(false)}
        />
      )}
      {showAbout && <AboutDialog t={t} onClose={() => setShowAbout(false)} />}
      {showComm && <CommDialog t={t} project={project} onImport={importProject} onClose={() => setShowComm(false)} />}
      {showLogic && <LogicLab t={t} onClose={() => setShowLogic(false)} />}
      {showSave && (
        <SaveProjectDialog t={t} onSave={saveProjectAs} onClose={() => setShowSave(false)} />
      )}
      {showProject && (
        <ProjectDialog
          t={t}
          project={project}
          onLoadProject={(p) => { loadProject(p); history.replaceState(null, '', window.location.pathname); setShowProject(false); showToast(t('project_loaded')); }}
          onImportFile={() => fileRef.current?.click()}
          examples={EXAMPLES.map((e) => ({ key: e.key, titleKey: e.titleKey, descKey: e.descKey }))}
          onNewProject={() => { if (!window.confirm(t('confirm_new_project'))) return; loadProject({ v: 3, sheets: [{ name: 'Sheet 1', circuit: { v: 2, components: [], wires: [], notes: [] } }], active: 0 }); history.replaceState(null, '', window.location.pathname); setShowProject(false); }}
          onClose={() => setShowProject(false)}
          notify={showToast}
        />
      )}
      {showAccount && <AccountDialog t={t} account={account} onSave={saveAccount} onSignOut={signOut} onClose={() => setShowAccount(false)} />}
      {notifOpen && <NotificationsPanel t={t} notifs={notifs} onClear={() => setNotifs([])} onClose={() => setNotifOpen(false)} />}
      {activeNote && <NotesDialog t={t} note={activeNote} onChange={(text) => updateNoteText(activeNote.id, text)} onDelete={() => deleteNote(activeNote.id)} onClose={() => setNoteEdit(null)} />}
    </div>
  );
}
