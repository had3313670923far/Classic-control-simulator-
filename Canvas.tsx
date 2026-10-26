import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Circuit, CircuitComponent, ComponentType, Mode, Note, SimSnapshot, TermRef } from '../types';
import { CATALOG, GRID, PHASE_SIZE, POT_COLORS, getPins, isSupply, pinWorld, termKey, tracePhase } from '../lib/catalog';
import { compMapOf, ptsToPath, routeWire, terminalWireCounts } from '../lib/routing';
import { parentActive } from '../lib/engine';
import { Symbol } from './Symbols';
import { Lock, UnlockKeyhole } from 'lucide-react';

export interface Selection {
  kind: 'comp' | 'wire';
  id: string;
}

export interface View {
  x: number;
  y: number;
  zoom: number;
}

interface CanvasProps {
  circuit: Circuit;
  mode: Mode;
  snapshot: SimSnapshot | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  onMoveComponent: (id: string, x: number, y: number) => void;
  onAddWire: (a: TermRef, b: TermRef) => void;
  onSetWireMid: (id: string, mid: number, hv?: boolean) => void;
  onOperate: (id: string, action: 'down' | 'up') => void;
  onView?: (view: View) => void;
  placing: ComponentType | null;
  onPlace: (type: ComponentType, x: number, y: number) => void;
  onCancelPlace: () => void;
  resetViewTitle: string;
  onBackgroundTap?: () => void;
  dark: boolean;
  notes: Note[];
  notePlacing: boolean;
  onPlaceNote: (x: number, y: number) => void;
  onMoveNote: (id: string, x: number, y: number) => void;
  onEditNote: (id: string) => void;
  onEditStart: () => void;
  onFlipWire: (id: string) => void;
  onAddJoint?: (a: TermRef, x: number, y: number) => void;
  onUnlockAll: () => void;
  onLockToggle: () => void;
  t_unlock_all?: string;
  t_fit?: string;
}

const OPERABLE_BASE = new Set(['pb_no', 'pb_nc', 'pb_dual', 'estop', 'switch', 'sens_limit', 'sens_float', 'sens_pressure', 'sens_temp', 'sens_photo', 'sens_prox', 'sens_reed', 'sens_flow', 'sens_vibration', 'mcb1', 'mcb2', 'mcb3', 'mccb', 'mccb4', 'mpcb', 'fuse', 'fuse3', 'fsw1', 'fsw3', 'iso1', 'iso2', 'iso3', 'rccb', 'rcbo', 'rccb4', 'overload', 'dol_combo', 'cos1', 'esw1', 'sel3', 'fuse2', 'fsw2', 'psu24']);
const isOperable = (c: CircuitComponent) => OPERABLE_BASE.has(c.type) || ((c.type === 'timer' && c.props.mode === 'rto') || c.type === 'rto') || isSupply(c.type);

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

export default function Canvas(props: CanvasProps) {
  const { circuit, mode, snapshot, selection, onSelect, onMoveComponent, onAddWire, onSetWireMid, onOperate, onView, placing, onPlace, onCancelPlace, resetViewTitle, onBackgroundTap, dark, notes, notePlacing, onPlaceNote, onMoveNote, onEditNote, onEditStart, onUnlockAll, onLockToggle, onAddJoint } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | null>(null);
  const groupRef = useRef<SVGGElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const pendingStart = useRef<{ x: number; y: number } | null>(null);
  const commitTimer = useRef<number | null>(null);
  const [view, setView] = useState<View>({ x: 40, y: 20, zoom: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [pending, setPending] = useState<TermRef | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [hoverPin, setHoverPin] = useState<string | null>(null);
  const dragRef = useRef<
    | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
    | { kind: 'comp'; id: string; ox: number; oy: number; moved: boolean }
    | { kind: 'wire'; id: string; gx: number; gy: number }
    | { kind: 'note'; id: string; ox: number; oy: number; moved: boolean }
    | { kind: 'operate'; id: string }
    | null
  >(null);
  // multi-touch tracking for pinch zoom
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ d0: number; zoom0: number; x0: number; y0: number; mx0: number; my0: number } | null>(null);

  const compMap = useMemo(() => compMapOf(circuit), [circuit]);
  const wireCounts = useMemo(() => terminalWireCounts(circuit), [circuit]);
  /** wireId -> L1/L2/L3 (cached: phase tracing is expensive, topology rarely changes) */
  const phaseMap = useMemo(() => {
    const cm = compMapOf(circuit);
    const out = new Map<string, string>();
    for (const w of circuit.wires) {
      const ph = tracePhase(w.a, cm, circuit.wires) || tracePhase(w.b, cm, circuit.wires);
      if (ph) out.set(w.id, POT_COLORS[ph]);
    }
    return out;
  }, [circuit]);
  const run = mode === 'run';

  /**
   * Paint pan/zoom straight into the SVG transform (zero React renders while dragging)
   * and commit the React state lazily, so selecting/clicking stays snappy.
   */
  const applyView = useCallback((next: View | ((v: View) => View), commit = false) => {
    const v = typeof next === 'function' ? next(viewRef.current) : next;
    viewRef.current = v;
    if (groupRef.current) groupRef.current.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.zoom})`);
    if (commit) {
      if (commitTimer.current !== null) {
        window.clearTimeout(commitTimer.current);
        commitTimer.current = null;
      }
      setView(v);
      return;
    }
    if (commitTimer.current !== null) return;
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = null;
      setView(viewRef.current);
    }, 120);
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    },
    [],
  );

  const toWorld = useCallback((e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (e.clientX - r.left - v.x) / v.zoom, y: (e.clientY - r.top - v.y) / v.zoom };
  }, []);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }, []);

  const viewReport = useRef<number>(0);
  useEffect(() => {
    const now = performance.now();
    if (now - viewReport.current < 90) return;
    viewReport.current = now;
    onView?.(view);
  }, [view, onView]);

  useEffect(() => {
    if (run) setPending(null);
  }, [run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPending(null);
        onCancelPlace();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancelPlace]);

  const beginPinchIfSecond = useCallback(
    (e: { pointerId: number; clientX: number; clientY: number }) => {
      const map = pointersRef.current;
      map.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (map.size === 2) {
        const pts = [...map.values()];
        const r = svgRef.current!.getBoundingClientRect();
        const d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const v = viewRef.current;
        pinchRef.current = { d0: Math.max(d0, 1), zoom0: v.zoom, x0: v.x, y0: v.y, mx0: (pts[0].x + pts[1].x) / 2 - r.left, my0: (pts[0].y + pts[1].y) / 2 - r.top };
        const d = dragRef.current;
        if (d?.kind === 'operate') onOperate((d as { id: string }).id, 'up');
        dragRef.current = null;
        setPending(null);
        return true;
      }
      return false;
    },
    [onOperate],
  );

  // ---- global pointer handlers for drags + pinch ----
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const map = pointersRef.current;
      if (map.has(e.pointerId)) map.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pending) {
        const p = toWorld(e);
        mouseRef.current = p;
        setMouse(p);
      }
      const pinch = pinchRef.current;
      if (pinch && map.size >= 2) {
        const pts = [...map.values()].slice(0, 2);
        const r = svgRef.current!.getBoundingClientRect();
        const dist = Math.max(Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), 1);
        const mx = (pts[0].x + pts[1].x) / 2 - r.left;
        const my = (pts[0].y + pts[1].y) / 2 - r.top;
        const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (pinch.zoom0 * dist) / pinch.d0));
        // keep the world point under the initial midpoint anchored, follow finger midpoint
        const wx = (pinch.mx0 - pinch.x0) / pinch.zoom0;
        const wy = (pinch.my0 - pinch.y0) / pinch.zoom0;
        applyView({ zoom: nz, x: mx - wx * nz, y: my - wy * nz });
        return;
      }
      const d = dragRef.current;
      if (!d) {
        if (pending || placing || notePlacing) setMouse(toWorld(e));
        return;
      }
      if (d.kind === 'pan') {
        const dx = e.clientX - d.sx;
        const dy = e.clientY - d.sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        applyView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
      } else if (d.kind === 'comp') {
        const p = toWorld(e);
        const nx = Math.round((p.x - d.ox) / GRID) * GRID;
        const ny = Math.round((p.y - d.oy) / GRID) * GRID;
        const c = compMap.get(d.id);
        if (c && (c.x !== nx || c.y !== ny)) {
          d.moved = true;
          onMoveComponent(d.id, nx, ny);
        }
      } else if (d.kind === 'note') {
        const p = toWorld(e);
        const nx = Math.round((p.x - d.ox) / 5) * 5;
        const ny = Math.round((p.y - d.oy) / 5) * 5;
        d.moved = true;
        onMoveNote(d.id, nx, ny);
      } else if (d.kind === 'wire') {
        const p = toWorld(e);
        const dx = p.x - d.gx;
        const dy = p.y - d.gy;
        if (Math.abs(dx) > Math.abs(dy) + 4) {
          onSetWireMid(d.id, Math.round(p.x / 10) * 10, true);
        } else if (Math.abs(dy) > Math.abs(dx) + 4) {
          onSetWireMid(d.id, Math.round(p.y / 10) * 10, false);
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      // pin + drag released on empty canvas -> create a junction stub wire there
      if (pending && !run) {
        const dragged = mouseRef.current && pendingStart.current &&
          (Math.abs(mouseRef.current.x - pendingStart.current.x) > 8 || Math.abs(mouseRef.current.y - pendingStart.current.y) > 8);
        if (dragged && onAddJoint) {
          const target = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
          const onPin = !!target?.closest('[data-pin-hit]');
          if (!onPin) {
            onAddJoint(pending, mouseRef.current!.x, mouseRef.current!.y);
            setPending(null);
            setMouse(null);
          }
        }
      }
      pointersRef.current.delete(e.pointerId);
      const wasPinching = !!pinchRef.current;
      if (pinchRef.current && pointersRef.current.size < 2) pinchRef.current = null;
      const d = dragRef.current;
      if (d?.kind === 'operate') onOperate(d.id, 'up');
      else if (d?.kind === 'note' && !d.moved) onEditNote(d.id);
      const panned = d?.kind === 'pan' && d.moved;
      dragRef.current = null;
      // settle the React view state at the end of a gesture so later clicks line up
      if (panned || wasPinching) setView(viewRef.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [compMap, onMoveComponent, onMoveNote, onEditNote, onSetWireMid, onOperate, pending, placing, notePlacing, toWorld]);

  const snap = (v: number) => Math.round(v / GRID) * GRID;

  const zoomAt = (mx: number, my: number, factor: number) => {
    applyView((v) => {
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      const k = nz / v.zoom;
      return { zoom: nz, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
    });
  };

  const zoomCenter = (factor: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, factor);
  };

  const syncView = () => setView((v) => (v.x === viewRef.current.x && v.y === viewRef.current.y && v.zoom === viewRef.current.zoom ? v : { ...viewRef.current }));

  const onBgMouseDown = (e: React.PointerEvent) => {
    syncView();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (beginPinchIfSecond(e)) return;
    if (placing) {
      const p = toWorld(e);
      onPlace(placing, snap(p.x), snap(p.y));
      return;
    }
    if (notePlacing) {
      const p = toWorld(e);
      onPlaceNote(Math.round(p.x / 5) * 5, Math.round(p.y / 5) * 5);
      return;
    }
    onBackgroundTap?.();
    dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    if (pending) setPending(null);
    else onSelect(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    const { x: mx, y: my } = toLocal(e.clientX, e.clientY);
    zoomAt(mx, my, e.deltaY < 0 ? 1.12 : 0.9);
  };

  const onCompMouseDown = (e: React.PointerEvent, c: CircuitComponent) => {
    syncView();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    if (beginPinchIfSecond(e)) return;
    if (placing) {
      const p = toWorld(e);
      onPlace(placing, snap(p.x), snap(p.y));
      return;
    }
    if (notePlacing) return;
    if (run) {
      if (isOperable(c)) {
        dragRef.current = { kind: 'operate', id: c.id };
        onOperate(c.id, 'down');
      }
      onSelect({ kind: 'comp', id: c.id });
      return;
    }
    if (pending) {
      setPending(null);
      return;
    }
    const p = toWorld(e);
    dragRef.current = { kind: 'comp', id: c.id, ox: p.x - c.x, oy: p.y - c.y, moved: false };
    onEditStart();
    onSelect({ kind: 'comp', id: c.id });
  };

  const onNoteMouseDown = (e: React.PointerEvent, n: Note) => {
    if (run || notePlacing) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    if (beginPinchIfSecond(e)) return;
    const p = toWorld(e);
    dragRef.current = { kind: 'note', id: n.id, ox: p.x - n.x, oy: p.y - n.y, moved: false };
    onEditStart();
    onSelect(null);
  };

  const onPinMouseDown = (e: React.PointerEvent, ref: TermRef) => {
    syncView();
    if (run) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    if (beginPinchIfSecond(e)) return;
    if (pending) {
      if (pending.c !== ref.c || pending.p !== ref.p) onAddWire(pending, ref);
      setPending(null);
    } else {
      const p = toWorld(e);
      setPending(ref);
      setMouse(p);
      mouseRef.current = p;
      pendingStart.current = p;
    }
  };

  const onPinMouseUp = (e: React.PointerEvent, ref: TermRef) => {
    if (run || !pending) return;
    if (pending.c === ref.c && pending.p === ref.p) return; // simple click – keep pending
    e.stopPropagation();
    onAddWire(pending, ref);
    setPending(null);
  };

  const onWireMouseDown = (e: React.PointerEvent, id: string) => {
    syncView();
    if (run) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    if (beginPinchIfSecond(e)) return;
    onSelect({ kind: 'wire', id });
    const p = toWorld(e);
    dragRef.current = { kind: 'wire', id, gx: p.x, gy: p.y };
    onEditStart();
  };

  const pendingRoute = useMemo(() => {
    if (!pending || !mouse) return null;
    const c = compMap.get(pending.c);
    if (!c) return null;
    const A = pinWorld(c, pending.p);
    if (!A) return null;
    // junction-style preview: elbow from the pin toward the cursor, dot at the moving end
    const sx = Math.abs(mouse.x - A.x) > 6 ? Math.round(A.x + (mouse.x - A.x) / 2) : A.x;
    const pts = [A, { x: sx, y: A.y }, { x: sx, y: mouse.y }, mouse];
    return { d: ptsToPath(pts), end: mouse, start: A };
  }, [pending, mouse, compMap]);

  // render layers
  const wireLayer = circuit.wires.map((w) => {
        const r = routeWire(w, compMap);
        if (!r) return null;
        const d = ptsToPath(r.pts);
        const isSel = selection?.kind === 'wire' && selection.id === w.id;
        const pot = snapshot?.termPot[termKey(w.a.c, w.a.p)];
        const fault = snapshot?.faultWires.has(w.id);
        const cur = snapshot?.wireCurrent[w.id] || 0;
        const autoColor = phaseMap.get(w.id);
        const phase = !!autoColor;
        const editColor = w.color || autoColor || (isSel ? '#2563eb' : '#475569');
        const sz = w.size || (phase ? PHASE_SIZE : 2);
        const color = run ? (fault ? '#ef4444' : pot ? POT_COLORS[pot] : '#94a3b8') : editColor;
        return (
          <g key={w.id} onPointerDown={(e) => onWireMouseDown(e, w.id)} className={run ? '' : 'cursor-pointer'}>
            <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(14, sz + 10)} />
            {isSel && <path d={d} fill="none" stroke="#93c5fd" strokeWidth={sz + 5} opacity={0.6} />}
            <path d={d} fill="none" stroke={color} strokeWidth={isSel ? sz + 1 : fault ? sz + 2 : run && pot ? sz + 0.6 : sz} strokeLinejoin="round" strokeLinecap="round" className={fault ? 'fault-flash' : undefined} />
            {run && pot === 'PE' && !fault && <path d={d} fill="none" stroke="#facc15" strokeWidth={sz + 0.6} strokeDasharray="5 5" strokeLinejoin="round" />}
            {run && cur > 0 && !fault && <path d={d} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="4 8" className="flow" opacity={0.9} />}
          </g>
        );
  });

  const componentLayer = circuit.components.map((c) => {
        const st = snapshot?.states[c.id];
        const isSel = selection?.kind === 'comp' && selection.id === c.id;
        const parent = c.props.parent ? compMap.get(c.props.parent) : undefined;
        const linked = CATALOG[c.type].linked;
        const active = linked && run ? parentActive(parent, snapshot?.states[parent?.id || ''], c.type) : false;
        const pins = getPins(c);
        const pinLabels = (c.props?.pinLabels || {}) as Record<string, string>;
        const modelName = (c.props?.model as string) || '';
        const faulted = !!snapshot && pins.some((p) => snapshot.faultTerms.has(termKey(c.id, p.id)));
        const { w, h } = CATALOG[c.type];
        const bw = c.type === 'busbar' ? Math.max(1, Number(c.props.length) || 10) * 20 : w;
        const bh = c.type === 'busbar' ? 0 : h;
        const operable = run && isOperable(c);
        return (
          <g
            key={c.id}
            transform={(() => {
              const cx = (bw || 20) / 2;
              const cy = (bh || 20) / 2;
              const r = c.rot || 0;
              const m = c.mirror ? -1 : 1;
              return r || c.mirror ? `translate(${c.x + cx} ${c.y + cy}) scale(${m} 1) rotate(${r}) translate(${-cx} ${-cy})` : `translate(${c.x} ${c.y})`;
            })()}
            onPointerDown={(e) => onCompMouseDown(e, c)}
            className={operable ? 'cursor-pointer' : run ? '' : 'cursor-move'}
          >
            {c.type === 'busbar' ? (
              <rect x={-10} y={-13} width={bw + 20} height={26} rx={4} fill="transparent" className={run ? '' : 'cursor-pointer'} />
            ) : (
              <rect x={-4} y={-4} width={Math.max(w, 8) + 8} height={Math.max(h, 8) + 8} fill="transparent" />
            )}
            {modelName && (
              <text x={bw + 6} y={-6} fontSize={7} fontWeight={700} fill="#0f766e" style={{ pointerEvents: 'none' }}>
                {modelName}
              </text>
            )}
            <Symbol
              c={c}
              st={st}
              mode={mode}
              parentLabel={linked ? parent?.label : undefined}
              parentType={parent?.type}
              selected={isSel}
              faulted={faulted}
              termPot={snapshot?.termPot}
              active={active}
              {...(linked && parent?.type === 'timer' ? { timedMode: parent.props.mode } : {})}
            />
            {pins.map((p) => {
              const key = termKey(c.id, p.id);
              const n = wireCounts[key] || 0;
              const dot = c.type === 'busbar' || c.type === 'junction' ? n >= 1 : n >= 2;
              const pot = snapshot?.termPot[key];
              const col = run ? (pot ? POT_COLORS[pot] : '#cbd5e1') : '#334155';
              const isHover = hoverPin === key;
              const isPending = pending?.c === c.id && pending.p === p.id;
              return (
                <g key={p.id}>
                  {dot && <circle cx={p.x} cy={p.y} r={3.6} fill={run ? col : '#1e293b'} />}
                  {!run && (
                    <circle cx={p.x} cy={p.y} r={isHover || isPending ? 5 : c.type === 'busbar' ? 2.2 : 3} fill={isHover || isPending ? '#2563eb' : '#fff'} stroke={isHover || isPending ? '#1d4ed8' : '#475569'} strokeWidth={1.2} style={{ pointerEvents: 'none' }} />
                  )}
                  {run && <circle cx={p.x} cy={p.y} r={2.6} fill={col} style={{ pointerEvents: 'none' }} />}
                  {!run && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={9}
                      fill="transparent"
                      className="cursor-pointer"
                      onPointerDown={(e) => onPinMouseDown(e, { c: c.id, p: p.id })}
                      onPointerUp={(e) => onPinMouseUp(e, { c: c.id, p: p.id })}
                      data-pin-hit="1"
                      onPointerEnter={() => setHoverPin(key)}
                      onPointerLeave={() => setHoverPin((h) => (h === key ? null : h))}
                    >
                      <title>{pinLabels[p.id] || p.id}</title>
                    </circle>
                  )}
                </g>
              );
            })}
          </g>
        );
  });


  return (
    <>
      <svg
        ref={svgRef}
        className={`canvas-root h-full w-full select-none ${run ? 'cursor-default' : placing || notePlacing ? 'cursor-copy' : 'cursor-crosshair'}`}
        onPointerDown={onBgMouseDown}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ background: dark ? '#0b1120' : '#f8fafc', touchAction: 'none', filter: dark ? 'invert(1) hue-rotate(180deg)' : undefined }}
      >
        <defs>
          <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <circle cx={0} cy={0} r={0.9} fill="#cbd5e1" />
          </pattern>
          <pattern id="grid5" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} fill="none" stroke="#e2e8f0" strokeWidth={1} />
          </pattern>
        </defs>
        <g ref={groupRef} transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
          <rect x={-10000} y={-10000} width={20000} height={20000} fill="url(#grid5)" />
          <rect x={-10000} y={-10000} width={20000} height={20000} fill="url(#grid)" />

          {/* wires */}
          {wireLayer}

          {/* pending wire */}
          {pendingRoute && (
            <g style={{ pointerEvents: 'none' }}>
              <path d={pendingRoute.d} fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" />
              <circle cx={pendingRoute.end.x} cy={pendingRoute.end.y} r={4} fill="#2563eb" opacity={0.85} />
              <circle cx={pendingRoute.end.x} cy={pendingRoute.end.y} r={7} fill="#2563eb" opacity={0.18} />
            </g>
          )}

          {/* ghost of component being placed */}
          {placing && mouse && (
            <g transform={`translate(${snap(mouse.x)} ${snap(mouse.y)})`} opacity={0.55} style={{ pointerEvents: 'none' }}>
              <Symbol c={{ id: 'ghost', type: placing, x: 0, y: 0, label: '', props: { ...CATALOG[placing].defaults } }} mode="edit" selected={true} faulted={false} />
            </g>
          )}

          {/* components */}
          {componentLayer}

          {/* sticky notes */}
          {notes.map((n) => {
            const lines = (n.text || ' ').split('\n').slice(0, 10);
            const bw = Math.min(340, Math.max(90, ...lines.map((l) => l.length * 7.2 + 18)));
            const bh = lines.length * 15 + 16;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                onPointerDown={(e) => onNoteMouseDown(e, n)}
                className={run || notePlacing ? '' : 'cursor-move'}
                style={run || notePlacing ? { pointerEvents: 'none' } : undefined}
                opacity={n.text ? 1 : 0.6}
              >
                <rect x={0} y={0} width={bw} height={bh} rx={3} fill="#fef9c3" stroke="#eab308" strokeWidth={1.2} style={{ pointerEvents: 'none' }} />
                <path d={`M ${bw - 12} 0 L ${bw} 0 L ${bw} 12 Z`} fill="#fde047" stroke="#eab308" strokeWidth={0.8} style={{ pointerEvents: 'none' }} />
                {lines.map((ln, i) => (
                  <text key={i} x={9} y={16 + i * 15} fontSize={12} fill="#1e293b" fontFamily="Inter, system-ui, sans-serif">
                    {ln || ' '}
                  </text>
                ))}
              </g>
            );
          })}
          {/* grip dots on the selected wire */}
          {!run &&
            selection?.kind === 'wire' &&
            (() => {
              const w = circuit.wires.find((k) => k.id === selection.id);
              const r = w ? routeWire(w, compMap) : null;
              if (!w || !r || r.pts.length < 2) return null;
              const dots: { x: number; y: number }[] = [];
              if (r.pts.length === 2) {
                dots.push({ x: (r.pts[0].x + r.pts[1].x) / 2, y: (r.pts[0].y + r.pts[1].y) / 2 });
              } else {
                const e1 = r.pts[1];
                const e2 = r.pts[2];
                if (Math.hypot(e2.x - e1.x, e2.y - e1.y) >= 8) dots.push(e1, e2);
                dots.push({ x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 });
              }
              return (
                <g style={{ pointerEvents: 'none' }}>
                  {dots.map((d, i) => (
                    <g key={i}>
                      <circle cx={d.x} cy={d.y} r={6.5} fill="#2563eb" opacity={0.25} />
                      <circle cx={d.x} cy={d.y} r={4} fill="#fff" stroke="#2563eb" strokeWidth={1.6} />
                    </g>
                  ))}
                </g>
              );
            })()}
        </g>
      </svg>
      {/* zoom controls (touch friendly) */}
      <div className="absolute bottom-10 end-3 z-10 flex flex-col gap-1">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            const selComp = selection?.kind === 'comp' ? circuit.components.find((k) => k.id === selection.id) : undefined;
            if (selComp) onLockToggle();
            else if (circuit.components.some((k) => k.locked)) onUnlockAll();
            else if (circuit.components.length) onSelect({ kind: 'comp', id: circuit.components[0].id });
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border shadow-lg backdrop-blur ${circuit.components.some((k) => k.locked) ? 'border-emerald-500/70 bg-emerald-500/20 text-emerald-300' : 'border-slate-600 bg-slate-800/90 text-slate-100 hover:bg-slate-700'}`}
          title={circuit.components.some((k) => k.locked) ? props.t_unlock_all || 'Unlock all' : 'Lock / Unlock'}
        >
          {circuit.components.some((k) => k.locked) ? <UnlockKeyhole size={16} /> : <Lock size={16} />}
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => zoomCenter(1.25)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-800/90 text-lg font-bold text-slate-100 shadow-lg backdrop-blur hover:bg-slate-700"
          title="+"
        >
          +
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => zoomCenter(0.8)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-800/90 text-lg font-bold text-slate-100 shadow-lg backdrop-blur hover:bg-slate-700"
          title="−"
        >
          −
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => applyView({ x: 40, y: 20, zoom: 0.55 }, true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-800/90 text-sm text-slate-100 shadow-lg backdrop-blur hover:bg-slate-700"
          title={props.t_fit || resetViewTitle || 'Fit (55%)'}
        >
          ⤢
        </button>
      </div>
    </>
  );
}
