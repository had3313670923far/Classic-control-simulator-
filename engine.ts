import type { Circuit, CircuitComponent, DeviceState, Potential, SimEvent, SimSnapshot, TermRef } from '../types';
import { EARTHED_TYPES, SUPPLY_PINS, getPins, isSupply, sourcePotential, termKey } from './catalog';

export interface StepResult extends SimSnapshot {
  newEvents: SimEvent[];
}

type Via = { kind: 'wire'; id: string } | { kind: 'dev'; id: string; pole: string };
interface Edge {
  to: string;
  via: Via;
}

let evId = 1;

export function initialState(c: CircuitComponent): DeviceState {
  if (isSupply(c.type)) return { tripped: false };
  switch (c.type) {
    case 'mcb1':
    case 'mcb2':
    case 'mcb3':
    case 'mccb':
    case 'mccb4':
    case 'mpcb':
    case 'rccb':
    case 'rcbo':
    case 'rccb4':
      return { on: false, tripped: false, heat: 0, current: 0 };
    case 'fuse':
    case 'fuse2':
    case 'fuse3':
      return { tripped: false, heat: 0, current: 0 };
    case 'overload':
      return { tripped: false, heat: 0, current: 0 };
    case 'pb_no':
    case 'pb_nc':
      return { pressed: false };
    case 'pb_dual':
      return { pressed: false, noClosed: false, ncClosed: true, t: 0 };
    case 'estop':
      return { on: false };
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
      return { on: false };
    case 'coil':
    case 'relay':
    case 'phr_coil':
    case 'timer':
    case 'ton':
    case 'tof':
    case 'tsd':
    case 'tp':
    case 'rto':
    case 'tcy':
      return { energized: false, out: false, t: 0, volt: 0, burnt: false, heat: 0 };
    case 'led':
    case 'lamp_neon':
    case 'buzzer_active':
    case 'speaker':
    case 'cooling_fan':
    case 'dc_motor':
    case 'bldc':
    case 'stepper':
    case 'servo':
    case 'solenoid':
      return { energized: false, volt: 0, burnt: false, t: 0, current: 0 };
    case 'relay_emr':
    case 'relay_latch':
      return { energized: false, volt: 0, t: 0 };
    case 'lamp':
    case 'horn':
    case 'bell':
    case 'buzzer':
      return { energized: false, volt: 0, burnt: false, t: 0 };
    case 'motor3':
    case 'motor6':
    case 'motor1':
      return { speed: 0, dir: 0, current: 0, load: Number(c.props.load ?? 1), config: 'none' };
    case 'iso1':
    case 'iso2':
    case 'iso3':
    case 'esw1':
      return { on: false };
    case 'cos1':
    case 'sel3':
      return { pos: 0 };
    case 'fsw1':
    case 'fsw2':
    case 'fsw3':
      return { on: false, tripped: false, heat: 0, current: 0 };
    case 'dol_combo':
      return { tripped: false, heat: 0, current: 0 };
    case 'psu24':
      return { energized: false, tripped: false };
    case 'phasemon':
    case 'ph1mon':
    case 'pmr':
    case 'floatless':
    case 'tank':
    case 'stc3008':
    case 'ntc':
    case 'safety':
      return { out: false, volt: 0, burnt: false, heat: 0, t: 0, energized: false, wait: 0 }; // filled = undefined -> NO until PV reaches 26
    default:
      return {};
  }
}

export function initialStates(circuit: Circuit): Record<string, DeviceState> {
  const st: Record<string, DeviceState> = {};
  for (const c of circuit.components) st[c.id] = initialState(c);
  return st;
}

export function parentActive(parent: CircuitComponent | undefined, st: DeviceState | undefined, childType?: string): boolean {
  if (!parent || !st) return false;
  if (childType === 'timer_star') {
    const d = Math.max(0.1, Number(parent.props.delay) || 5);
    return !!st.energized && (st.t || 0) < d;
  }
  switch (parent.type) {
    case 'coil':
    case 'relay':
    case 'relay_emr':
    case 'relay_latch':
      return !!st.energized;
    case 'timer':
    case 'ton':
    case 'tof':
    case 'tsd':
    case 'tp':
    case 'rto':
    case 'tcy':
      return !!st.out;
    case 'overload':
    case 'mcb1':
    case 'mcb2':
    case 'mcb3':
    case 'mccb':
    case 'mccb4':
    case 'mpcb':
    case 'fsw1':
    case 'fsw3':
    case 'fuse3':
    case 'rccb':
    case 'rcbo':
    case 'rccb4':
    case 'dol_combo':
      return !!st.tripped;
    case 'pb_no':
    case 'pb_nc':
    case 'pb_dual':
      return !!st.pressed;
    case 'phasemon':
    case 'ph1mon':
    case 'phr_coil':
    case 'pmr':
    case 'floatless':
    case 'safety':
      return !!st.out;
    case 'stc3008':
      return !!st.out || !!st.energized;
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
      return !!st.on;
    case 'cos1':
    case 'sel3':
      return (st.pos || 0) !== 0;
    default:
      return false;
  }
}

const isL = (p?: Potential) => p === 'L1' || p === 'L2' || p === 'L3';

const isRef = (p?: Potential) => p === 'N' || p === 'PE';

/** Nominal voltage between two potentials (415/240 V system, 24 V DC control). */
export function voltage(a?: Potential, b?: Potential): number {
  if (!a || !b || a === b) return 0;
  if (isL(a) && isL(b)) return 415;
  if ((isL(a) && isRef(b)) || (isL(b) && isRef(a))) return 240;
  if ((a === 'P24' && b === 'M24') || (a === 'M24' && b === 'P24')) return 24;
  return 0;
}

const POT_NAME = (p: Potential) => (p === 'P24' ? '+24V' : p === 'M24' ? '0V' : p);
const POT_RANK: Record<Potential, number> = { L1: 0, L2: 1, L3: 2, P24: 3, N: 4, M24: 5, PE: 6 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const torqueCurve = (s: number) => (s < 0.85 ? 1.6 + 1.0 * s : (2.45 * (1 - s)) / 0.15);
const PH_IDX: Record<string, number> = { L1: 0, L2: 1, L3: 2 };

function phaseDir(a?: Potential, b?: Potential): 1 | -1 {
  if (!a || !b) return 1;
  return (PH_IDX[b] - PH_IDX[a] + 3) % 3 === 1 ? 1 : -1;
}

interface MotorOpts {
  n: number; // number of live phases (3 = full, 2 = single phasing, 0/1 = off)
  dirNew: 1 | -1;
  torqueScale: number;
  startIpu: number;
  runScale: number;
  config: DeviceState['config'];
}

function motorDynamics(c: CircuitComponent, s: DeviceState, o: MotorOpts, dt: number, log: Logger): number {
  const L = Number(s.load ?? c.props.load ?? 1);
  const J = 2.0;
  const speed = s.speed || 0;
  const In = Number(c.props.In) || 10;
  let Ipu = 0;
  const prevCfg = s.config;
  const prevMsg = s.msg;
  if (o.n >= 3) {
    if (s.dir && o.dirNew !== s.dir && speed > 0.02) {
      // plugging / braking when phase sequence reversed while running
      s.speed = Math.max(0, speed - dt * 1.5);
      s.config = o.config;
      s.msg = 'braking';
      s.current = o.startIpu * In * 1.1;
      if (prevMsg !== 'braking') log(`${c.label}: phase sequence reversed while running – plugging (braking)!`, 'warn');
      return s.current;
    }
    s.dir = o.dirNew;
    const Te = o.torqueScale * torqueCurve(speed);
    const acc = (Te - L) / J;
    s.speed = clamp(speed + acc * dt, 0, 1);
    const stalled = s.speed < 0.02 && Te <= L;
    Ipu = o.startIpu * Math.pow(1 - s.speed, 1.5) + o.runScale * (0.25 + 0.75 * L) * s.speed;
    s.config = o.config;
    s.msg = stalled ? 'stalled' : undefined;
    const cfgName = o.config === 'star' ? 'star' : o.config === 'delta' ? 'delta' : o.dirNew === 1 ? 'forward' : 'reverse';
    if (prevMsg === 'braking') log(`${c.label} started (${cfgName})`, 'ok');
    else if (prevCfg === 'none' || prevCfg === undefined) log(`${c.label} ${speed > 0.05 ? 're-energized' : 'started'} (${cfgName})`, 'ok');
    else if (prevCfg !== o.config && o.config === 'delta' && prevCfg === 'star') log(`${c.label} switched to delta`, 'ok');
    if (stalled && prevMsg !== 'stalled') log(`${c.label} stalled – insufficient torque (load ${Math.round(L * 100)}%)`, 'warn');
  } else if (o.n === 2) {
    s.config = 'single';
    if (speed > 0.05) {
      const Te = 0.5 * torqueCurve(speed);
      s.speed = clamp(speed + ((Te - L) / J) * dt, 0, 1);
      Ipu = 1.7 * (0.25 + 0.75 * L) * Math.max(s.speed, 0.4);
    } else {
      s.speed = Math.max(0, speed - dt * 0.4);
      Ipu = 4;
    }
    s.msg = 'single phasing';
    if (prevCfg !== 'single') log(`${c.label}: single phasing! one phase missing`, 'warn');
  } else {
    if (prevCfg && prevCfg !== 'none' && speed > 0) log(`${c.label} de-energized – coasting`, 'info');
    s.config = 'none';
    s.msg = undefined;
    s.speed = Math.max(0, speed - dt * (0.15 + 0.35 * L));
    if (s.speed === 0) s.dir = 0;
    Ipu = 0;
  }
  s.current = Ipu * In;
  return s.current;
}

type Logger = (text: string, level?: SimEvent['level']) => void;

export function simStep(circuit: Circuit, prev: Record<string, DeviceState>, dt: number, time: number): StepResult {
  const comps = circuit.components;
  const cmap = new Map(comps.map((c) => [c.id, c] as const));
  const states: Record<string, DeviceState> = {};
  for (const c of comps) states[c.id] = { ...(prev[c.id] ?? initialState(c)) };
  states.__sys = { ...(prev.__sys || {}) }; // system-level flags (e.g. N–PE bridge warning)
  const events: SimEvent[] = [];
  const log: Logger = (text, level = 'info') => events.push({ id: evId++, time, text, level });

  // ---------- 1. Build conduction graph ----------
  const adj = new Map<string, Edge[]>();
  const allTerms: string[] = [];
  const termComp = new Map<string, CircuitComponent>();
  for (const c of comps)
    for (const p of getPins(c)) {
      const k = termKey(c.id, p.id);
      allTerms.push(k);
      adj.set(k, []);
      termComp.set(k, c);
    }
  const addEdge = (a: string, b: string, via: Via) => {
    if (!adj.has(a) || !adj.has(b)) return;
    adj.get(a)!.push({ to: b, via });
    adj.get(b)!.push({ to: a, via });
  };
  for (const w of circuit.wires) addEdge(termKey(w.a.c, w.a.p), termKey(w.b.c, w.b.p), { kind: 'wire', id: w.id });

  const active = (c: CircuitComponent) => parentActive(cmap.get(c.props.parent), states[c.props.parent], c.type);

  for (const c of comps) {
    const s = states[c.id];
    const k = (p: string) => termKey(c.id, p);
    const dev = (p1: string, p2: string) => addEdge(k(p1), k(p2), { kind: 'dev', id: c.id, pole: p1 });
    switch (c.type) {
      case 'busbar': {
        const pins = getPins(c);
        for (let i = 1; i < pins.length; i++) addEdge(k(pins[i - 1].id), k(pins[i].id), { kind: 'dev', id: c.id, pole: 'bar' });
        break;
      }
      case 'mcb1':
      case 'iso1':
      case 'fsw1':
        if (s.on && !s.tripped) dev('1', '2');
        break;
      case 'mcb2':
      case 'iso2':
      case 'fsw2':
      case 'rccb':
      case 'rcbo':
        if (s.on && !s.tripped) {
          dev('1', '2');
          dev('3', '4');
        }
        break;
      case 'mccb4':
        if (s.on && !s.tripped) {
          dev('1', '2');
          dev('3', '4');
          dev('5', '6');
          dev('7', '8');
        }
        break;
      case 'mpcb':
      case 'mccb':
      case 'iso3':
      case 'fsw3':
      case 'mcb3':
        if (s.on && !s.tripped) {
          dev('1', '2');
          dev('3', '4');
          dev('5', '6');
        }
        break;
      case 'fuse':
        if (!s.tripped) dev('1', '2');
        break;
      case 'fuse3':
        if (!s.tripped) {
          dev('1', '2');
          dev('3', '4');
          dev('5', '6');
        }
        break;
      case 'rccb4':
        if (s.on && !s.tripped) {
          dev('1', '2');
          dev('3', '4');
          dev('5', '6');
          dev('7', '8');
        }
        break;
      case 'dol_combo':
        if (active(c) && !s.tripped) {
          dev('1', '2');
          dev('3', '4');
          dev('5', '6');
        }
        break;
      case 'contactor_main4':
        if (active(c)) {
          dev('1', '2');
          dev('3', '4');
          dev('5', '6');
          dev('7', '8');
        }
        break;
      case 'aux4':
        if (active(c)) {
          dev('13', '14');
          dev('23', '24');
        } else {
          dev('11', '12');
          dev('21', '22');
        }
        break;
      case 'fuse2':
        if (!s.tripped) {
          dev('1', '2');
          dev('3', '4');
        }
        break;
      case 'cos1':
        if (s.pos === 1) dev('11', '12');
        else if (s.pos === 2) dev('11', '14');
        break;
      case 'esw1':
        if (s.on) dev('1', '2');
        else {
          dev('1', 'PE');
          dev('2', 'PE');
        }
        break;
      case 'sel3':
        if (s.pos === 1) dev('13', '14');
        else if (s.pos === 2) dev('23', '24');
        break;
      case 'overload':
        dev('1', '2');
        dev('3', '4');
        dev('5', '6');
        break;
      case 'contactor_main':
        if (active(c)) {
          dev('1', '2');
          dev('3', '4');
          dev('5', '6');
        }
        break;
      case 'contactor_main1':
        if (active(c)) dev('1', '2');
        break;
      case 'contactor_main2':
        if (active(c)) {
          dev('1', '2');
          dev('3', '4');
        }
        break;
      case 'contact_no':
        if (active(c)) dev('13', '14');
        break;
      case 'contact_nc':
        if (!active(c)) dev('11', '12');
        break;
      case 'ol_no':
        if (active(c)) dev('97', '98');
        break;
      case 'ol_nc':
        if (!active(c)) dev('95', '96');
        break;
      case 'ph_no':
      case 'timer_no':
        if (active(c)) dev('15', '18');
        break;
      case 'ph_nc':
      case 'timer_nc':
        if (!active(c)) dev('15', '16');
        break;
      case 'co':
        if (active(c)) dev('11', '14');
        else dev('11', '12');
        break;
      case 'timer_co':
        if (active(c)) dev('15', '18');
        else dev('15', '16');
        break;
      case 'timer_star':
        if (active(c)) dev('17', '28');
        break;
      case 'pb_no':
        if (s.pressed) dev('13', '14');
        break;
      case 'pb_nc':
        if (!s.pressed) dev('11', '12');
        break;
      case 'pb_dual':
        if (s.noClosed) dev('13', '14');
        if (s.ncClosed) dev('11', '12');
        break;
      case 'estop':
        if (!s.on) dev('11', '12');
        break;
      case 'pmr':
        if (s.out) dev('11', '14');
        else dev('11', '12');
        break;
      case 'floatless':
        // 8 = COM, internally fed from LINE (pin 2). NC (5) = fill/status, NO (6) = drain.
        dev('2', '8');
        // relay rest position: NC (5, supply/fill) · energised: NO (6, drain/alarm)
        if (s.energized) dev('8', '6');
        else dev('8', '5');
        break;
      case 'tank':
        break;
      case 'sens_limit':
      case 'sens_float':
      case 'sens_pressure':
      case 'sens_temp':
      case 'sens_photo':
      case 'sens_prox':
      case 'sens_reed':
      case 'sens_flow':
      case 'sens_vibration': {
        const nc = c.props.contact === 'NC';
        if (nc ? !s.on : !!s.on) dev('1', '2');
        break;
      }
      case 'stc3008':
        // ⊕5 IN is an ISOLATED input (dry contact COM) – the operator must bring
        // the extra 230 V there. ⊕6 OUT is the switched output.
        // The contact only conducts when the relay closes: 5 -> 6.
        if (s.out) dev('5', '6');
        break;
      // ---------- electronics ----------
      case 'res_fixed':
      case 'res_net':
      case 'pot':
      case 'choke':
      case 'toroid':
      case 'air_core':
      case 'var_inductor':
      case 'fuse_glass':
      case 'fuse_blade':
      case 'fuse_ptc':
      case 'saw':
      case 'crystal':
      case 'terminal_block':
      case 'header':
      case 'power_jack':
      case 'usb_port':
      case 'audio_jack':
      case 'ic_socket':
      case 'heatsink':
      case 'strain_gauge': {
        const pins = getPins(c);
        for (let i = 1; i < pins.length; i++) dev(pins[0].id, pins[i].id);
        break;
      }
      case 'switch_push':
      case 'switch_toggle':
      case 'switch_dip':
      case 'switch_rotary':
      case 'switch_micro':
      case 'reed':
        if (s.on) {
          const pins = getPins(c);
          for (let i = 1; i < pins.length; i++) dev(pins[0].id, pins[i].id);
        }
        break;
      case 'diode_rect':
      case 'diode_schottky':
      case 'diode_zener':
      case 'photodiode':
      case 'tvs':
      case 'tunnel':
      case 'varactor':
      case 'scr_ic':
      case 'triac':
      case 'gto':
        dev('A', 'K');
        break;
      case 'bridge':
        dev('AC1', '+');
        dev('AC2', '-');
        break;
      case 'bjt':
      case 'npn':
      case 'pnp':
      case 'darlington':
      case 'phototransistor':
      case 'igbt':
      case 'jfet':
      case 'mosfet':
        dev('C', 'E');
        break;
      case 'optocoupler':
      case 'optocoupler_ic':
      case 'triac_coupler':
        dev('C', 'E');
        break;
      case 'relay_emr':
      case 'relay_latch':
        // coil state is resolved in the loads pass; contacts follow it there
        if (s.energized) dev('COM', 'NO');
        else dev('COM', 'NC');
        break;
      case 'switch': {
        if (c.props.contact === 'CO') {
          if (s.on) dev('11', '14');
          else dev('11', '12');
        } else {
          const closed = c.props.contact === 'NC' ? !s.on : !!s.on;
          if (closed) dev('1', '2');
        }
        break;
      }
    }
  }
  // ---------- 1b. Tank water bridges submerged probes ----------
  for (const tc of comps) {
    if (tc.type !== 'tank') continue;
    const lvl = Math.max(0, Math.min(1, states[tc.id].level ?? Number(tc.props.level) ?? 0.4));
    const wet = ['E1', 'E2', 'E3'].filter((q) => lvl >= (q === 'E1' ? 0.78 : q === 'E2' ? 0.46 : 0.26));
    for (let i = 1; i < wet.length; i++) {
      const a1 = termKey(tc.id, wet[i - 1]);
      const b1 = termKey(tc.id, wet[i]);
      if (!adj.has(a1) || !adj.has(b1)) continue;
      adj.get(a1)!.push({ to: b1, via: { kind: 'dev', id: tc.id, pole: wet[i - 1] } });
      adj.get(b1)!.push({ to: a1, via: { kind: 'dev', id: tc.id, pole: wet[i - 1] } });
    }
  }

  // ---------- 2. Nets ----------
  const netOf = new Map<string, number>();
  const nets: string[][] = [];
  for (const t of allTerms) {
    if (netOf.has(t)) continue;
    const id = nets.length;
    const members: string[] = [];
    const queue = [t];
    netOf.set(t, id);
    while (queue.length) {
      const cur = queue.pop()!;
      members.push(cur);
      for (const e of adj.get(cur) || []) {
        if (!netOf.has(e.to)) {
          netOf.set(e.to, id);
          queue.push(e.to);
        }
      }
    }
    nets.push(members);
  }

  // sources
  const srcPot = new Map<string, Potential>();
  for (const c of comps) {
    const s = states[c.id];
    if (isSupply(c.type) && !s.tripped) {
      for (const p of getPins(c)) {
        const pot = sourcePotential(c, p.id);
        if (pot) srcPot.set(termKey(c.id, p.id), pot);
      }
    }
    if (c.type === 'psu24' && s.energized && !s.tripped) {
      srcPot.set(termKey(c.id, '+24'), 'P24');
      srcPot.set(termKey(c.id, '0V'), 'M24');
    }
  }
  const netSources: Map<number, { term: string; pot: Potential }[]> = new Map();
  for (const [term, pot] of srcPot) {
    const n = netOf.get(term)!;
    if (!netSources.has(n)) netSources.set(n, []);
    netSources.get(n)!.push({ term, pot });
  }
  const netPots: (Potential | undefined)[] = new Array(nets.length).fill(undefined);
  const netPotSet: Set<Potential>[] = nets.map(() => new Set<Potential>());
  const netConflict: boolean[] = new Array(nets.length).fill(false);
  let npeBridged = false;
  for (const [n, list] of netSources) {
    const pots = Array.from(new Set(list.map((x) => x.pot)));
    netPotSet[n] = new Set(pots);
    let conflict = false;
    for (let i = 0; i < pots.length && !conflict; i++) for (let j = i + 1; j < pots.length; j++) if (voltage(pots[i], pots[j]) > 0) conflict = true;
    if (conflict) netConflict[n] = true;
    else {
      // potentials at the same voltage (N & PE, 0V & PE …) may share a net – pick a representative
      pots.sort((a, b) => POT_RANK[a] - POT_RANK[b]);
      netPots[n] = pots[0];
      if (pots.includes('N') && pots.includes('PE')) npeBridged = true;
    }
  }
  if (npeBridged && !states.__sys.on) log('N and PE are bridged – not permitted downstream of the main earthing terminal (TN-S)', 'warn');
  states.__sys.on = npeBridged;

  // BFS path finder (returns vias along the path)
  const bfsPath = (start: string, isGoal: (t: string) => boolean): Via[] | null => {
    const prevMap = new Map<string, { from: string; via: Via } | null>();
    prevMap.set(start, null);
    const queue = [start];
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      if (cur !== start && isGoal(cur)) {
        const path: Via[] = [];
        let t = cur;
        while (true) {
          const p = prevMap.get(t);
          if (!p) break;
          path.push(p.via);
          t = p.from;
        }
        return path.reverse();
      }
      for (const e of adj.get(cur) || []) {
        if (!prevMap.has(e.to)) {
          prevMap.set(e.to, { from: cur, via: e.via });
          queue.push(e.to);
        }
      }
    }
    return null;
  };

  // ---------- 3. Short circuits ----------
  const faultWires = new Set<string>();
  const faultTerms = new Set<string>();
  for (let n = 0; n < nets.length; n++) {
    if (!netConflict[n]) continue;
    const list = netSources.get(n)!;
    let s1 = list[0];
    let s2 = list[1];
    outer: for (const a of list)
      for (const b of list)
        if (voltage(a.pot, b.pot) > 0) {
          s1 = a;
          s2 = b;
          break outer;
        }
    for (const t of nets[n]) faultTerms.add(t);
    const path = bfsPath(s1.term, (t) => t === s2.term) || [];
    const pair = `${POT_NAME(s1.pot)}–${POT_NAME(s2.pot)}`;
    const kind = s1.pot === 'PE' || s2.pot === 'PE' ? 'EARTH FAULT' : 'SHORT CIRCUIT';
    const prot: { id: string; rating: number; idx: number }[] = [];
    path.forEach((via, idx) => {
      if (via.kind === 'wire') faultWires.add(via.id);
      else {
        const d = cmap.get(via.id);
        if (!d) return;
        const t = d.type;
        let rating: number | null = null;
        if (t === 'mcb1' || t === 'mcb2' || t === 'mcb3' || t === 'mccb' || t === 'mccb4' || t === 'fuse' || t === 'fuse2' || t === 'fuse3' || t === 'fsw1' || t === 'fsw2' || t === 'fsw3') rating = Number(d.props.In) || 16;
        else if (t === 'mpcb') rating = Number(d.props.Ir) || 10;
        else if (t === 'rcbo') rating = kind === 'EARTH FAULT' ? -1 : Number(d.props.In) || 16;
        else if (t === 'rccb') rating = kind === 'EARTH FAULT' ? -1 : null; // no overcurrent release
        else if (t === 'rccb4') rating = kind === 'EARTH FAULT' ? -1 : null;
        if (rating === null || states[d.id].tripped || states[d.id].on === false) return;
        const ex = prot.find((p) => p.id === d.id);
        if (ex) ex.idx = idx;
        else prot.push({ id: d.id, rating, idx });
      }
    });
    if (prot.length) {
      prot.sort((a, b) => a.rating - b.rating || b.idx - a.idx);
      const victim = cmap.get(prot[0].id)!;
      const vs = states[victim.id];
      vs.tripped = true;
      vs.on = false;
      vs.current = 999;
      const why = (victim.type === 'rccb' || victim.type === 'rcbo' || victim.type === 'rccb4') && kind === 'EARTH FAULT' ? 'tripped on residual current' : victim.type === 'fuse' || victim.type === 'fuse2' || victim.type === 'fuse3' ? 'blown' : victim.type === 'fsw1' || victim.type === 'fsw2' || victim.type === 'fsw3' ? 'fuse blown' : 'tripped instantaneously';
      log(`${kind} (${pair})! ${victim.label} ${why}`, 'error');
    } else {
      const lineSrc = [s1, s2].find((x) => isL(x.pot) || x.pot === 'P24') || s1;
      const src = termComp.get(lineSrc.term);
      if (src) {
        states[src.id].tripped = true;
        states[src.id].energized = false;
        log(`${kind} (${pair}) with no protection! ${src.label || 'Supply'} cut off by upstream breaker`, 'error');
      }
    }
  }

  const termPot: Record<string, Potential | undefined> = {};
  for (const t of allTerms) {
    const n = netOf.get(t)!;
    termPot[t] = netConflict[n] ? undefined : netPots[n];
  }

  // ---------- 3b. Earthing check (once, when the simulation starts) ----------
  if (time === 0 && comps.some((c) => isSupply(c.type) && SUPPLY_PINS[c.type].includes('PE'))) {
    for (const c of comps) {
      if (!EARTHED_TYPES.includes(c.type)) continue;
      const n = netOf.get(termKey(c.id, 'PE'));
      if (n == null || !netPotSet[n].has('PE')) log(`${c.label}: PE terminal is not earthed!`, 'warn');
    }
  }

  // ---------- 4. Loads ----------
  const loadCurrents: { term: string; I: number }[] = [];
  for (const c of comps) {
    const s = states[c.id];
    const k = (p: string) => termKey(c.id, p);
    const V = (a: string, b: string) => voltage(termPot[k(a)], termPot[k(b)]);
    switch (c.type) {
      case 'coil':
      case 'relay':
      case 'timer':
      case 'ton':
      case 'tof':
      case 'tsd':
      case 'tp':
      case 'rto':
      case 'tcy': {
        const v = V('A1', 'A2');
        s.volt = v;
        const vr = Number(c.props.V) || 230;
        const wasE = !!s.energized;
        if (s.burnt) s.energized = false;
        else if (v > vr * 1.25) {
          s.heat = (s.heat || 0) + dt;
          s.energized = true;
          if (s.heat > 0.4) {
            s.burnt = true;
            s.energized = false;
            log(`${c.label}: coil burnt out! ${v} V applied to a ${vr} V coil`, 'error');
          }
        } else if (v >= vr * 0.8) {
          s.energized = true;
          s.heat = 0;
          s.msg = undefined;
        } else {
          s.energized = false;
          s.heat = 0;
          s.msg = v > 0 ? 'undervoltage' : undefined;
          if (v > 0 && wasE === false && prev[c.id]?.msg !== 'undervoltage') log(`${c.label}: ${v} V too low for ${vr} V coil – will not pick up`, 'warn');
        }
        if (s.energized !== wasE) log(`${c.label} ${s.energized ? 'energized' : 'released'}`, s.energized ? 'ok' : 'info');
        if (s.energized) {
          const I = (c.type === 'timer' || c.type === 'ton' || c.type === 'tof' || c.type === 'tsd' || c.type === 'tp' || c.type === 'rto' || c.type === 'tcy') ? 0.02 : (c.props.kind === 'relay' || c.type === 'relay') ? 0.03 : 0.12;
          loadCurrents.push({ term: k('A1'), I }, { term: k('A2'), I });
        }
        if (c.type === 'timer' || c.type === 'ton' || c.type === 'tof' || c.type === 'tsd' || c.type === 'tp' || c.type === 'rto' || c.type === 'tcy') {
          const mode = c.props.mode;
          const delay = Math.max(0.1, Number(c.props.delay) || 5);
          const wasOut = !!s.out;
          if (mode === 'on') {
            if (s.energized) {
              s.t = Math.min(delay, (s.t || 0) + dt);
              s.out = s.t >= delay;
            } else {
              s.t = 0;
              s.out = false;
            }
          } else if (mode === 'off') {
            if (s.energized) {
              s.out = true;
              s.t = 0;
            } else if (s.out) {
              s.t = (s.t || 0) + dt;
              if (s.t >= delay) s.out = false;
            }
          } else if (mode === 'flash') {
            if (s.energized) {
              s.t = (s.t || 0) + dt;
              if (s.t >= delay) {
                s.t = 0;
                s.out = !s.out;
              }
            } else {
              s.t = 0;
              s.out = false;
            }
          } else if (mode === 'pulse') {
            if (s.energized) {
              if (!s.fired) {
                s.t = (s.t || 0) + dt;
                s.out = true;
                if (s.t >= delay) {
                  s.out = false;
                  s.fired = true;
                }
              } else s.out = false;
            } else {
              s.t = 0;
              s.out = false;
              s.fired = false;
            }
          } else if (mode === 'rto') {
            if (s.energized && !s.out) {
              s.t = (s.t || 0) + dt;
              if (s.t >= delay) s.out = true;
            }
          } else if (mode === 'cyclic') {
            const offD = Math.max(0.1, Number(c.props.delay2) || delay);
            if (!s.energized) {
              s.t = 0;
              s.out = false;
              s.fired = false;
            } else if (!s.fired) {
              s.fired = true;
              s.out = true;
              s.t = 0;
            } else {
              s.t = (s.t || 0) + dt;
              if (s.t >= (s.out ? delay : offD)) {
                s.t = 0;
                s.out = !s.out;
              }
            }
          } else if (mode === 'sd') {
            const gapS = (Number(c.props.gap) || 60) / 1000;
            if (s.energized) {
              s.t = Math.min(delay + gapS, (s.t || 0) + dt);
              s.out = (s.t || 0) >= delay + gapS;
            } else {
              s.t = 0;
              s.out = false;
            }
          }
          if (s.out !== wasOut && mode !== 'flash' && mode !== 'cyclic') log(`${c.label} timer ${s.out ? 'timed out – contacts switched' : 'contacts reset'}`, 'info');
        }
        break;
      }
      case 'led':
      case 'lamp_neon':
      case 'buzzer_active':
      case 'speaker':
      case 'cooling_fan':
      case 'dc_motor':
      case 'bldc':
      case 'stepper':
      case 'servo':
      case 'solenoid': {
        const p1 = termPot[k(getPins(c)[0].id)];
        const p2 = termPot[k(getPins(c)[1].id)];
        const v = voltage(p1, p2);
        s.volt = v;
        const need = Number(c.props.V) || (c.type === 'lamp_neon' ? 230 : 12);
        const draw = Number(c.props.I) || 0.02;
        s.energized = v >= need * 0.6;
        s.msg = v > need * 1.4 ? 'overvoltage' : undefined;
        if (s.energized) loadCurrents.push({ term: k(getPins(c)[0].id), I: draw }, { term: k(getPins(c)[1].id), I: draw });
        break;
      }
      case 'lamp':
      case 'horn':
      case 'bell':
      case 'buzzer': {
        const v = V('X1', 'X2');
        s.volt = v;
        const vr = Number(c.props.V) || 230;
        if (s.burnt) {
          s.energized = false;
          break;
        }
        if (v > vr * 1.25) {
          s.t = (s.t || 0) + dt;
          if (s.t > 0.3) {
            s.burnt = true;
            s.energized = false;
            log(`${c.label} blown! ${v} V applied to ${vr} V ${c.type}`, 'error');
            break;
          }
        } else s.t = 0;
        const wasE = !!s.energized;
        s.energized = v >= vr * 0.5;
        if (s.energized) {
          const I = c.type === 'buzzer' ? 0.05 : 0.03;
          loadCurrents.push({ term: k('X1'), I }, { term: k('X2'), I });
        }
        if ((c.type === 'buzzer' || c.type === 'horn' || c.type === 'bell') && s.energized !== wasE) log(`${c.label} ${s.energized ? 'sounding' : 'silent'}`, s.energized ? 'warn' : 'info');
        break;
      }
      case 'psu24': {
        const v = V('L', 'N');
        s.volt = v;
        if (s.tripped) {
          s.energized = false;
          break;
        }
        if (v > 260) {
          s.tripped = true;
          s.energized = false;
          log(`${c.label}: input over-voltage (${v} V) – PSU protection tripped`, 'error');
          break;
        }
        const wasE = !!s.energized;
        s.energized = v >= 180;
        if (s.energized !== wasE) log(`${c.label} 24 V DC ${s.energized ? 'available' : 'lost'}`, s.energized ? 'ok' : 'info');
        if (s.energized) loadCurrents.push({ term: k('L'), I: 0.3 }, { term: k('N'), I: 0.3 });
        break;
      }
      case 'pb_dual': {
        // break-before-make: the opening side switches at once, the closing side follows after 80 ms
        const pressed = !!s.pressed;
        const GAP = 0.08;
        if (pressed && s.ncClosed) {
          s.ncClosed = false;
          s.t = time;
        } else if (pressed && !s.noClosed && time - (s.t || 0) >= GAP) s.noClosed = true;
        else if (!pressed && s.noClosed) {
          s.noClosed = false;
          s.t = time;
        } else if (!pressed && !s.ncClosed && time - (s.t || 0) >= GAP) s.ncClosed = true;
        break;
      }
      case 'ph1mon': {
        const v = V('L', 'N');
        s.volt = v;
        const ok = v >= 180 && v <= 265;
        const wasOut = !!s.out;
        s.out = ok;
        s.msg = v < 180 ? 'no supply' : v > 265 ? 'overvoltage' : undefined;
        if (s.out !== wasOut) log(`${c.label} 1-phase monitor: ${s.out ? 'supply healthy' : 'SUPPLY FAULT (' + s.msg + ')'}`, s.out ? 'ok' : 'error');
        break;
      }
      case 'phr_coil': {
        const v = V('A1', 'A2');
        s.volt = v;
        const vr = Number(c.props.V) || 230;
        if (!s.burnt && v > vr * 1.25) {
          s.heat = (s.heat || 0) + dt;
          if (s.heat > 0.4) {
            s.burnt = true;
            log(`${c.label}: phase relay coil burnt out! ${v} V on a ${vr} V coil`, 'error');
          }
        } else s.heat = 0;
        const powered = !s.burnt && v >= vr * 0.8;
        s.energized = powered;
        const pots = ['L1', 'L2', 'L3'].map((p) => termPot[k(p)]);
        const have = new Set(pots.filter(isL));
        const healthy = have.size === 3 && new Set(pots).size === 3;
        const wasOut = !!s.out;
        s.out = powered && healthy;
        if (s.burnt) s.msg = 'burnt';
        else if (!powered) s.msg = v > 0 ? 'undervoltage' : 'no supply';
        else if (!healthy) s.msg = ['L1', 'L2', 'L3'].filter((p) => !isL(termPot[k(p)])).join(', ') + ' missing';
        else s.msg = undefined;
        if (s.out !== wasOut) log(`${c.label} phase relay coil ${s.out ? 'ON – output energized' : 'OFF (' + (s.msg || 'input open') + ')'}`, s.out ? 'ok' : 'warn');
        if (powered) loadCurrents.push({ term: k('A1'), I: 0.03 }, { term: k('A2'), I: 0.03 });
        break;
      }
      case 'tank': {
        const use = Math.max(0, Number(c.props.dailyUse) || 4) / 100;
        const inflow = s.energized ? 0.4 : 0;
        const lvl = Math.max(0, Math.min(1, (s.level ?? Number(c.props.level) ?? 0.4) - use * dt + inflow * dt));
        s.level = lvl;
        s.msg = lvl <= 0.05 ? 'dry' : lvl >= 0.97 ? 'full' : undefined;
        break;
      }
      case 'floatless': {
        // PHOTO PINOUT  3=E1 high · 4=E2 low · 1=E3 ref · 2=N
        //               5=NC (supply) · 6=NO (drain) · 8=COM · 7=L
        const supply = V('2', '7'); // 2 = L (line) · 7 = N (neutral)
        const electrodeWires = circuit.wires.filter((w) => {
          const probe = (t: TermRef) => t.c === c.id && ['1', '3', '4'].includes(t.p);
          return probe(w.a) || probe(w.b);
        });
        const pinOf = (w: (typeof electrodeWires)[number]) => (w.a.c === c.id ? w.a.p : w.b.p);
        const nearOf = (w: (typeof electrodeWires)[number]) => (w.a.c === c.id ? w.b : w.a);
        const probeWet = (pin: string) => {
          const w = electrodeWires.find((k) => pinOf(k) === pin);
          if (!w) return false;
          const near = nearOf(w);
          const tk = cmap.get(near.c);
          if (!tk || tk.type !== 'tank') return true;
          const lvl = Math.max(0, Math.min(1, states[tk.id].level ?? Number(tk.props.level) ?? 0.4));
          const depth = near.p === 'E1' ? 0.78 : near.p === 'E2' ? 0.46 : 0.1; // E3 sits on the tank bottom
          return lvl >= depth;
        };
        const powered = supply >= 180 && !s.burnt;
        const refWet = probeWet('1');
        const highWet = probeWet('3');
        const lowWet = probeWet('4');
        s.volt = powered ? 8 : 0;
        const wasOut = !!s.out;
        // Level sequence wanted by the user:
        //   water rises to E1  -> pump OFF (NC 5 supplies the tank, NO 6 alarms/drains)
        //   stays off through the gap
        //   water falls below the E2 probe -> pump ON again
        // `s.energized` = relay coil; the pump hangs on the linked NC contact, so the
        // coil must be ENERGIZED while the pump is running. We expose the pump demand
        // through `s.out` (consumed by aux contacts):
        //   out = true  -> "call for water" (pump runs via NC)
        //   out = false -> full / E1 wet     (NC opens, pump stops)
        const gapS = Math.max(0, Number(c.props.restartDelay) || 0);
        // STATE MACHINE (user sequence):
        //   water reaches E1 (high) -> pump OFF immediately  (do not restart in the gap)
        //   water falls below E2    -> pump ON again after `restartDelay` seconds
        let pumpOn = s.filled === undefined ? true : !!s.filled;
        if (powered && refWet) {
          if (highWet) {
            pumpOn = false;
            s.wait = 0;
          } else if (!lowWet) {
            if (pumpOn) s.wait = 0;
            else {
              s.wait = (s.wait || 0) + dt;
              if ((s.wait || 0) >= gapS) pumpOn = true;
            }
          }
        } else {
          pumpOn = false;
          s.wait = 0;
        }
        s.filled = pumpOn;
        // coil energised means "level reached" (relay rest = NC supply)
        s.energized = powered && refWet && highWet && !s.burnt;
        s.out = pumpOn; // linked NC contact closes -> pump runs (true = call for water)
        s.msg = s.burnt ? 'burnt' : !powered ? 'no supply' : !refWet ? 'E3 dry' : highWet ? 'tank full' : lowWet ? 'normal' : 'tank low';
        if (s.out !== wasOut) log(`${c.label} floatless: ${s.out ? 'draining (NO 6)' : 'supply (NC 5)'} – ${s.msg}`, s.out ? 'ok' : 'info');
        if (powered) loadCurrents.push({ term: k('2'), I: 0.02 });
        break;
      }
      case 'pmr': {
        const pls = ['L1', 'L2', 'L3'].map((p) => termPot[k(p)]);
        const nPresent = pls.filter(isL).length;
        const powered = nPresent >= 2;
        const have = new Set(pls.filter(isL));
        const allPresent = have.size === 3 && new Set(pls).size === 3;
        let reversed = false;
        if (allPresent) {
          const order = pls.map((p) => (p === 'L1' ? 0 : p === 'L2' ? 1 : 2));
          let inv = 0;
          for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (order[i] > order[j]) inv++;
          reversed = inv % 2 === 1;
        }
        const vl = pls.map((p) => (isL(p) ? 415 : 0));
        const avg = (vl[0] + vl[1] + vl[2]) / 3;
        const unb = avg > 0 ? ((Math.max(vl[0], vl[1], vl[2]) - Math.min(vl[0], vl[1], vl[2])) / avg) * 100 : 0;
        const nom = Number(c.props.nominal) || 415;
        const uv = Math.min(vl[0], vl[1], vl[2]) < 0.9 * nom;
        const ov = Math.max(vl[0], vl[1], vl[2]) > 1.1 * nom;
        const unbTrip = unb > (Number(c.props.unbalance) || 10);
        const missing = ['L1', 'L2', 'L3'].filter((p) => !isL(termPot[k(p)]));
        const fault = !allPresent || reversed || unbTrip || uv || ov;
        const delayS = (Number(c.props.tripDelay) || 200) / 1000;
        const wasOut = !!s.out;
        if (!powered) {
          s.out = false;
          s.t = 0;
        } else if (!fault) {
          s.out = true;
          s.t = 0;
        } else {
          s.t = (s.t || 0) + dt;
          if ((s.t || 0) >= delayS) s.out = false;
        }
        if (!powered) s.msg = 'no supply';
        else if (!fault) s.msg = undefined;
        else {
          const parts: string[] = [];
          if (missing.length) parts.push(missing.join(', ') + ' missing');
          else if (!allPresent) parts.push('invalid phase set');
          if (reversed) parts.push('reversed sequence');
          if (unbTrip) parts.push(`unbalance ${unb.toFixed(0)}%`);
          if (uv && !missing.length) parts.push('undervoltage');
          if (ov) parts.push('overvoltage');
          s.msg = parts.join(', ') || 'fault';
        }
        if (s.out !== wasOut) log(`${c.label} PMR ${s.out ? 'healthy – output energized' : 'FAULT (' + (s.msg || 'tripped') + ')'}`, s.out ? 'ok' : 'error');
        break;
      }
      case 'stc3008': {
        // ⊕1 L · ⊕2 N power · ⊕3-⊕4 NTC sensor · ⊕5 IN (COM) · ⊕6 OUT (AC 230 V)
        // 5-6 NORMAL = NO (open, no output)
        // temp reaches 26 °C  -> relay ON  -> 5-6 NC (closed, 230 V out)
        // temp falls to 18 °C -> relay OFF -> 5-6 NO (open)
        // 18 -> 26 °C rising  -> stays NO until it touches 26 °C again
        const stopT = Number(c.props.stopTemp ?? 18);
        const startT = Number(c.props.startTemp ?? 26);
        const auto = c.props.autoCycle !== false;
        const powered = !!(termPot[k('1')] && termPot[k('2')] && termPot[k('1')] !== termPot[k('2')]) && !s.burnt;
        // sensor present when one component is wired to BOTH probe terminals 3 and 4
        const sensorOk = c && circuit.components.some((other) => {
          if (other.id === c.id) return false;
          const touches = (pin: string) => circuit.wires.some((w) => (w.a.c === c.id && w.a.p === pin && w.b.c === other.id) || (w.b.c === c.id && w.b.p === pin && w.a.c === other.id));
          return touches('3') && touches('4');
        });
        const probe = circuit.components.find((o) => {
          if (o.type !== 'ntc') return false;
          const touches = (pin: string) => circuit.wires.some((w) => (w.a.c === c.id && w.a.p === pin && w.b.c === o.id) || (w.b.c === c.id && w.b.p === pin && w.a.c === o.id));
          return touches('3') || touches('4');
        });
        // the controller drives the probe's thermal model (relay output 6 -> NTC)
        if (probe) {
          const pst = states[probe.id];
          pst.energized = !!s.out; // cooling while the relay is closed
          if (pst.temp === undefined) pst.temp = Number(probe.props.temp ?? Number(c.props.startTemp ?? 26));
        }
        const probeTemp = probe ? Number(states[probe.id].temp ?? probe.props.temp) : undefined;
        // transition times (editable): default 15 s from 18 °C to 26 °C and back
        const heatS = Math.max(1, Number(c.props.heatTime ?? 15));
        const coolS = Math.max(1, Number(c.props.coolTime ?? 15));
        const span = Math.max(1, startT - stopT);
        if (s.temp === undefined) s.temp = probeTemp ?? (auto ? startT : Number(c.props.temp ?? (stopT + startT) / 2));
        // opening state is NO unless the PV is already at/above the start limit
        if (auto && s.filled === undefined) s.filled = Number(s.temp) >= startT;
        let temp = Number(s.temp);
        // an external NTC probe overrides the internal demo ramp
        if (probeTemp !== undefined) temp = probeTemp;
        let demand = s.filled === true;
        if (probeTemp === undefined && auto && powered) {
          if (demand) temp -= (span / coolS) * dt;
          else temp += (span / heatS) * dt;
          if (temp >= startT) {
            temp = startT;
            demand = true;
          }
          if (temp <= stopT) {
            temp = stopT;
            demand = false;
          }
          s.filled = demand;
        } else if (probeTemp === undefined) {
          const manual = Number(c.props.temp ?? temp);
          temp = manual;
          demand = manual >= startT ? true : manual <= stopT ? false : demand;
        } else {
          demand = temp >= startT ? true : temp <= stopT ? false : demand;
          s.filled = demand;
        }
        s.temp = Math.round(temp * 10) / 10;
        s.setpoint = startT;
        s.hysteresis = stopT;
        s.out = powered && sensorOk && demand; // relay coil -> 5-6 closes
        s.energized = false; // relay NO/NC mirrored through `out`
        // is there live power on the external input pin 5?
        const inLive = !!(termPot[k('5')]);
        s.volt = inLive ? 230 : 0;
        s.msg = !powered
          ? 'no supply (1-2)'
          : !sensorOk
            ? 'sensor open (3-4)'
            : !demand
              ? `5-6 NO · relay OFF (<${startT}°C)`
              : inLive
                ? `5-6 NC · relay ON (≥${startT}°C) · power out of 6`
                : `5-6 NC · relay ON but NO power on ⊕5 IN`;
        loadCurrents.push({ term: k('1'), I: 0.04 });
        break;
      }
      case 'phasemon': {
        const want = ['L1', 'L2', 'L3'];
        const have = new Set(want.map((p) => termPot[k(p)]).filter(isL));
        const missing = want.filter((p) => !isL(termPot[k(p)]));
        const wasOut = !!s.out;
        s.out = have.size === 3 && new Set(want.map((p) => termPot[k(p)])).size === 3;
        s.msg = s.out ? undefined : `${missing.join(', ')} missing`;
        if (s.out !== wasOut) log(`${c.label} phase monitor: ${s.out ? 'all phases healthy' : 'PHASE FAULT (' + s.msg + ')'}`, s.out ? 'ok' : 'error');
        break;
      }
      case 'safety': {
        const v = V('A1', 'A2');
        s.volt = v;
        const vr = Number(c.props.V) || 24;
        const n1 = netOf.get(k('E1'));
        const n2 = netOf.get(k('E2'));
        const loop = n1 !== undefined && n1 === n2;
        const powered = !s.burnt && v >= vr * 0.8;
        if (!s.burnt && v > vr * 1.25) {
          s.heat = (s.heat || 0) + dt;
          if (s.heat > 0.4) {
            s.burnt = true;
            log(`${c.label}: safety relay burnt out! ${v} V on a ${vr} V supply`, 'error');
          }
        } else s.heat = 0;
        s.msg = s.burnt ? 'burnt' : !powered ? (v > 0 ? 'undervoltage' : 'no supply') : loop ? undefined : 'loop open';
        const wasOut = !!s.out;
        s.out = powered && loop;
        if (s.out !== wasOut) log(`${c.label} safety output ${s.out ? 'ENABLED (loop closed)' : 'cut off (' + (s.msg || 'input open') + ')'}`, s.out ? 'ok' : 'warn');
        if (powered) loadCurrents.push({ term: k('A1'), I: 0.05 }, { term: k('A2'), I: 0.05 });
        break;
      }
      case 'motor3': {
        const pU = termPot[k('U')],
          pV = termPot[k('V')],
          pW = termPot[k('W')];
        const live = [pU, pV, pW].filter(isL) as Potential[];
        const n = new Set(live).size;
        const I = motorDynamics(c, s, { n, dirNew: phaseDir(pU, pV), torqueScale: 1, startIpu: 6, runScale: 1, config: 'run' }, dt, log);
        if (I > 0) for (const p of ['U', 'V', 'W']) if (isL(termPot[k(p)])) loadCurrents.push({ term: k(p), I });
        break;
      }
      case 'motor6': {
        const tops = ['U1', 'V1', 'W1'].map((p) => termPot[k(p)]);
        const nTop = new Set(tops.filter(isL)).size;
        const bNets = ['W2', 'U2', 'V2'].map((p) => netOf.get(k(p))!);
        const starPoint = bNets[0] === bNets[1] && bNets[1] === bNets[2] && !netPots[bNets[0]] && !netConflict[bNets[0]];
        const windings = [
          ['U1', 'U2'],
          ['V1', 'V2'],
          ['W1', 'W2'],
        ].filter(([a, b]) => voltage(termPot[k(a)], termPot[k(b)]) >= 400).length;
        let opts: MotorOpts;
        if (starPoint && nTop === 3) opts = { n: 3, dirNew: phaseDir(tops[0], tops[1]), torqueScale: 1 / 3, startIpu: 2, runScale: 0.6, config: 'star' };
        else if (windings === 3) opts = { n: 3, dirNew: phaseDir(tops[0], tops[1]), torqueScale: 1, startIpu: 6, runScale: 1, config: 'delta' };
        else if (windings >= 1 || (starPoint && nTop === 2)) opts = { n: 2, dirNew: 1, torqueScale: 0.5, startIpu: 4, runScale: 1, config: 'single' };
        else opts = { n: 0, dirNew: 1, torqueScale: 0, startIpu: 0, runScale: 0, config: 'none' };
        const I = motorDynamics(c, s, opts, dt, log);
        if (I > 0) for (const p of ['U1', 'V1', 'W1', 'W2', 'U2', 'V2']) if (isL(termPot[k(p)])) loadCurrents.push({ term: k(p), I: opts.config === 'delta' && p.endsWith('2') ? I * 0.58 : I });
        break;
      }
      case 'motor1': {
        const v = V('L', 'N');
        s.volt = v;
        const on = v >= 180 && v <= 260;
        if (v > 260) {
          if (!s.burnt) log(`${c.label}: ${v} V on a 240 V motor – winding damage!`, 'error');
          s.burnt = true;
        }
        const I = motorDynamics(c, s, { n: on && !s.burnt ? 3 : 0, dirNew: 1, torqueScale: 1, startIpu: 5, runScale: 1, config: 'run' }, dt, log);
        if (I > 0) loadCurrents.push({ term: k('L'), I }, { term: k('N'), I });
        break;
      }
    }
  }

  // ---------- 4b. NTC probes: 2-wire probe ramps up/down using the configured times ----------
  for (const c of comps) {
    if (c.type !== 'ntc') continue;
    const s = states[c.id];
    const lo = Number(c.props.lowTemp ?? 18);
    const hi = Number(c.props.highTemp ?? 26);
    const heatS = Math.max(1, Number(c.props.heatTime ?? 15));
    const coolS = Math.max(1, Number(c.props.coolTime ?? 15));
    if (s.temp === undefined) s.temp = Number(c.props.temp ?? hi);
    // direction comes from the controlling relay when wired, otherwise from its own latch
    // `energized` = cooling direction. Start cooling at the hot limit and heat at the cold one.
    let cooling = !!s.energized;
    if (Number(s.temp) >= hi) cooling = true;
    if (Number(s.temp) <= lo) cooling = false;
    const rate = (hi - lo) / (cooling ? coolS : heatS);
    let next = Number(s.temp) + (cooling ? -1 : 1) * rate * dt;
    if (next <= lo) {
      next = lo;
      cooling = false;
    }
    if (next >= hi) {
      next = hi;
      cooling = true;
    }
    s.energized = cooling;
    s.temp = Math.round(next * 100) / 100; // 0.01 °C resolution avoids stalling
  }

  // ---------- 5. Current paths ----------
  const wireCurrent: Record<string, number> = {};
  const devCurrent: Record<string, Record<string, number>> = {};
  for (const { term, I } of loadCurrents) {
    const n = netOf.get(term);
    if (n == null || netConflict[n] || !netPots[n]) continue;
    const pot = netPots[n];
    const path = bfsPath(term, (t) => srcPot.get(t) === pot);
    if (!path) continue;
    for (const via of path) {
      if (via.kind === 'wire') wireCurrent[via.id] = (wireCurrent[via.id] || 0) + I;
      else {
        if (!devCurrent[via.id]) devCurrent[via.id] = {};
        devCurrent[via.id][via.pole] = (devCurrent[via.id][via.pole] || 0) + I;
      }
    }
  }
  const maxPole = (id: string) => Math.max(0, ...Object.values(devCurrent[id] || {}));

  // ---------- 6. Protective devices ----------
  for (const c of comps) {
    const s = states[c.id];
    if (c.type === 'mcb1' || c.type === 'mcb2' || c.type === 'mcb3' || c.type === 'mccb' || c.type === 'mccb4' || c.type === 'mpcb') {
      if (s.current === 999 && s.tripped) continue; // just tripped by short circuit this tick
      const I = maxPole(c.id);
      s.current = I;
      if (s.on && !s.tripped) {
        const isMpcb = c.type === 'mpcb';
        const In = isMpcb ? Number(c.props.Ir) || 10 : Number(c.props.In) || 16;
        const mult = isMpcb ? 13 : ({ B: 5, C: 10, D: 20 } as Record<string, number>)[c.props.curve] || 10;
        if (I >= mult * In) {
          s.tripped = true;
          s.on = false;
          log(`${c.label} tripped – magnetic release (${I.toFixed(1)} A ≥ ${mult}×${In} A, curve ${c.props.curve})`, 'error');
        } else if (I > 1.13 * In) {
          s.heat = Math.min(1, (s.heat || 0) + ((I / In) ** 2 - 1) * dt * 0.01);
          if (s.heat >= 1) {
            s.tripped = true;
            s.on = false;
            log(`${c.label} tripped – thermal overload (${I.toFixed(1)} A on ${In} A breaker)`, 'error');
          }
        } else s.heat = Math.max(0, (s.heat || 0) - dt * 0.05);
      } else s.heat = Math.max(0, (s.heat || 0) - dt * 0.05);
    } else if (c.type === 'rccb' || c.type === 'rcbo' || c.type === 'rccb4') {
      if (s.current === 999 && s.tripped) continue;
      const poles = devCurrent[c.id] || {};
      const iL = poles['1'] || 0;
      const iN = poles['3'] || 0;
      const I = c.type === 'rccb4' ? Math.max(poles['1'] || 0, poles['3'] || 0, poles['5'] || 0) : Math.max(iL, iN);
      let imb = Math.abs(iL - iN);
      if (c.type === 'rccb4') {
        // pairing proxy: the largest pole current that cannot be paired with returns
        const ps = [poles['1'] || 0, poles['3'] || 0, poles['5'] || 0, poles['7'] || 0];
        const mx = Math.max(ps[0], ps[1], ps[2], ps[3]);
        imb = Math.max(0, mx - (ps[0] + ps[1] + ps[2] + ps[3] - mx));
      }
      s.current = I;
      if (s.on && !s.tripped) {
        const idn = (Number(c.props.Idn) || 30) / 1000;
        if (imb >= idn && I > 0.001) {
          s.tripped = true;
          s.on = false;
          log(`${c.label} tripped – earth leakage ${imb >= 1 ? imb.toFixed(2) + ' A' : Math.round(imb * 1000) + ' mA'} (IΔn ${c.props.Idn} mA)`, 'error');
        } else if (c.type === 'rcbo') {
          const In = Number(c.props.In) || 16;
          const mult = ({ B: 5, C: 10, D: 20 } as Record<string, number>)[c.props.curve] || 10;
          if (I >= mult * In) {
            s.tripped = true;
            s.on = false;
            log(`${c.label} tripped – magnetic release (${I.toFixed(1)} A, curve ${c.props.curve})`, 'error');
          } else if (I > 1.13 * In) {
            s.heat = Math.min(1, (s.heat || 0) + ((I / In) ** 2 - 1) * dt * 0.01);
            if (s.heat >= 1) {
              s.tripped = true;
              s.on = false;
              log(`${c.label} tripped – thermal overload (${I.toFixed(1)} A on ${In} A)`, 'error');
            }
          } else s.heat = Math.max(0, (s.heat || 0) - dt * 0.05);
        } else s.heat = 0;
      }
    } else if (c.type === 'fuse' || c.type === 'fuse2' || c.type === 'fuse3' || c.type === 'fsw1' || c.type === 'fsw2' || c.type === 'fsw3') {
      if (s.current === 999 && s.tripped) continue;
      const I = maxPole(c.id);
      s.current = I;
      if (!s.tripped) {
        const In = Number(c.props.In) || 4;
        if (I >= 8 * In) {
          s.tripped = true;
          log(`${c.label} fuse blown (${I.toFixed(1)} A)`, 'error');
        } else if (I > 1.3 * In) {
          s.heat = Math.min(1, (s.heat || 0) + ((I / In) ** 2 - 1) * dt * 0.05);
          if (s.heat >= 1) {
            s.tripped = true;
            log(`${c.label} fuse blown – sustained overload (${I.toFixed(1)} A on ${In} A)`, 'error');
          }
        } else s.heat = Math.max(0, (s.heat || 0) - dt * 0.05);
      }
    } else if (c.type === 'overload' || c.type === 'dol_combo') {
      const I = maxPole(c.id);
      s.current = I;
      const Ir = Number(c.props.Ir) || 10;
      if (!s.tripped) {
        if (I > 1.1 * Ir) {
          s.heat = Math.min(1, (s.heat || 0) + ((I / Ir) ** 2 - 1) * dt * 0.008);
          if (s.heat >= 1) {
            s.tripped = true;
            log(`${c.label || (c.props.parent ? cmap.get(c.props.parent)?.label || '' : '')} ${c.type === 'dol_combo' ? 'starter combo' : 'thermal overload relay'} TRIPPED (I = ${I.toFixed(1)} A, Ir = ${Ir} A)`, 'error');
          }
        } else s.heat = Math.max(0, (s.heat || 0) - dt * 0.02);
      } else s.heat = Math.max(0, (s.heat || 0) - dt * 0.02);
    }
  }

  return { time, states, termPot, wireCurrent, faultWires, faultTerms, newEvents: events };
}
