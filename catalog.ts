import type { CircuitComponent, ComponentType, PinDef, Potential, TermRef, Wire } from '../types';

export const GRID = 20;

interface CatalogEntry {
  w: number;
  h: number;
  prefix: string;
  pins: (c: CircuitComponent) => PinDef[];
  defaults: Record<string, any>;
  isLoad?: boolean;
  isSource?: boolean;
  linked?: boolean; // needs a parent device
  linkTo?: ComponentType[]; // allowed parent types (undefined = any linkable)
}

const top = (id: string, x: number): PinDef => ({ id, x, y: 0, dir: 'up' });
const bot = (id: string, x: number, h: number): PinDef => ({ id, x, y: h, dir: 'down' });

const threePole = (h: number) => () => [top('1', 20), top('3', 40), top('5', 60), bot('2', 20, h), bot('4', 40, h), bot('6', 60, h)];
const twoPin = (a: string, b: string, h: number) => () => [top(a, 20), bot(b, 20, h)];

/** Terminal layout of every supply / reference-node type (left → right). */
export const SUPPLY_PINS: Record<string, string[]> = {
  supply3npe: ['L1', 'L2', 'L3', 'N', 'PE'],
  supply3pe: ['L1', 'L2', 'L3', 'PE'],
  supply3: ['L1', 'L2', 'L3'],
  supply1p: ['L'],
  supply1n: ['N'],
  supply1pe: ['PE'],
  supply1: ['L', 'N'],
  supply1npe: ['L', 'N', 'PE'],
};
export const SUPPLY_TYPES = Object.keys(SUPPLY_PINS) as ComponentType[];
export const isSupply = (type: string): boolean => Object.prototype.hasOwnProperty.call(SUPPLY_PINS, type);

const supplyEntry = (type: string): CatalogEntry => {
  const pins = SUPPLY_PINS[type];
  const single = pins.length === 1;
  return {
    w: (pins.length + 1) * 20,
    h: 40,
    prefix: single ? '' : 'G',
    pins: () => pins.map((p, i) => bot(p, 20 * (i + 1), 40)),
    defaults: pins.includes('L') ? { phase: 'L1' } : {},
    isSource: true,
  };
};

export const CATALOG: Record<ComponentType, CatalogEntry> = {
  supply3npe: supplyEntry('supply3npe'),
  supply3pe: supplyEntry('supply3pe'),
  supply3: supplyEntry('supply3'),
  supply1p: supplyEntry('supply1p'),
  supply1n: supplyEntry('supply1n'),
  supply1pe: supplyEntry('supply1pe'),
  supply1: supplyEntry('supply1'),
  supply1npe: supplyEntry('supply1npe'),
  psu24: {
    w: 80,
    h: 80,
    prefix: 'T',
    pins: () => [top('L', 20), top('N', 40), top('PE', 60), bot('+24', 20, 80), bot('0V', 40, 80)],
    defaults: {},
    isLoad: true,
    isSource: true,
  },
  busbar: {
    w: 200,
    h: 0,
    prefix: 'B',
    pins: (c) => {
      const n = Math.max(2, Math.min(40, Number(c.props.length) || 10));
      const arr: PinDef[] = [];
      for (let i = 0; i <= n; i++) arr.push({ id: 'p' + i, x: i * GRID, y: 0, dir: 'none' });
      return arr;
    },
    defaults: { length: 10, name: 'L1' },
  },
  junction: {
    w: 0,
    h: 0,
    prefix: 'X',
    pins: () => [{ id: 'p', x: 0, y: 0, dir: 'none' }],
    defaults: {},
  },
  mcb1: { w: 40, h: 80, prefix: 'Q', pins: twoPin('1', '2', 80), defaults: { In: 6, curve: 'C' } },
  mccb: { w: 100, h: 100, prefix: 'Q', pins: () => [top('1', 20), top('3', 50), top('5', 80), bot('2', 20, 100), bot('4', 50, 100), bot('6', 80, 100)], defaults: { In: 100, curve: 'C' } },
  mccb4: { w: 110, h: 100, prefix: 'Q', pins: () => [top('1', 16), top('3', 42), top('5', 68), top('7', 94), bot('2', 16, 100), bot('4', 42, 100), bot('6', 68, 100), bot('8', 94, 100)], defaults: { In: 100, curve: 'C' } },
  iso1: { w: 40, h: 80, prefix: 'QS', pins: twoPin('1', '2', 80), defaults: {} },
  iso2: { w: 60, h: 80, prefix: 'QS', pins: () => [top('1', 20), top('3', 40), bot('2', 20, 80), bot('4', 40, 80)], defaults: {} },
  iso3: { w: 80, h: 80, prefix: 'QS', pins: threePole(80), defaults: {} },
  cos1: { w: 60, h: 60, prefix: 'S', pins: () => [top('11', 20), top('12', 40), bot('14', 30, 60)], defaults: {} },
  esw1: { w: 60, h: 80, prefix: 'QS', pins: () => [top('1', 20), bot('2', 20, 80), bot('PE', 40, 80)], defaults: {} },
  fsw1: { w: 40, h: 80, prefix: 'QS', pins: twoPin('1', '2', 80), defaults: { In: 16 } },
  fsw2: { w: 60, h: 80, prefix: 'QS', pins: () => [top('1', 20), top('3', 40), bot('2', 20, 80), bot('4', 40, 80)], defaults: { In: 25 } },
  fsw3: { w: 80, h: 80, prefix: 'QS', pins: threePole(80), defaults: { In: 32 } },
  fuse2: { w: 60, h: 60, prefix: 'FU', pins: () => [top('1', 20), top('3', 40), bot('2', 20, 60), bot('4', 40, 60)], defaults: { In: 16 } },
  fuse3: { w: 80, h: 60, prefix: 'FU', pins: () => [top('1', 20), top('3', 40), top('5', 60), bot('2', 20, 60), bot('4', 40, 60), bot('6', 60, 60)], defaults: { In: 16 } },
  rccb4: { w: 80, h: 80, prefix: 'Q', pins: () => [top('1', 10), top('3', 30), top('5', 50), top('7', 70), bot('2', 10, 80), bot('4', 30, 80), bot('6', 50, 80), bot('8', 70, 80)], defaults: { Idn: 30 } },
  mcb2: { w: 60, h: 80, prefix: 'Q', pins: () => [top('1', 20), top('3', 40), bot('2', 20, 80), bot('4', 40, 80)], defaults: { In: 16, curve: 'C' } },
  mcb3: { w: 80, h: 80, prefix: 'Q', pins: threePole(80), defaults: { In: 16, curve: 'C' } },
  mpcb: { w: 80, h: 80, prefix: 'Q', pins: threePole(80), defaults: { Ir: 10 } },
  fuse: { w: 40, h: 60, prefix: 'FU', pins: twoPin('1', '2', 60), defaults: { In: 4 } },
  rccb: { w: 60, h: 80, prefix: 'Q', pins: () => [top('1', 20), top('3', 40), bot('2', 20, 80), bot('4', 40, 80)], defaults: { Idn: 30 } },
  rcbo: { w: 60, h: 80, prefix: 'Q', pins: () => [top('1', 20), top('3', 40), bot('2', 20, 80), bot('4', 40, 80)], defaults: { In: 16, curve: 'C', Idn: 30 } },
  overload: { w: 80, h: 80, prefix: 'F', pins: threePole(80), defaults: { Ir: 10 } },
  ol_no: { w: 40, h: 60, prefix: '', pins: twoPin('97', '98', 60), defaults: { parent: '' }, linked: true, linkTo: ['overload'] },
  ol_nc: { w: 40, h: 60, prefix: '', pins: twoPin('95', '96', 60), defaults: { parent: '' }, linked: true, linkTo: ['overload'] },
  phasemon: { w: 80, h: 60, prefix: 'U', pins: () => [top('L1', 20), top('L2', 40), top('L3', 60)], defaults: {} },
  ph1mon: { w: 60, h: 60, prefix: 'U', pins: () => [top('L', 20), top('N', 40)], defaults: {} },
  phr_coil: {
    w: 80, h: 80, prefix: 'K',
    pins: () => [top('L1', 20), top('L2', 40), top('L3', 60), bot('A1', 20, 80), bot('A2', 40, 80)],
    defaults: { V: 230 },
    isLoad: true,
  },
  floatless: {
    w: 128, h: 178, prefix: 'K',
    // photo layout: top 3/4/1/2 (E1/E2/E3/N), bottom 5/6/8/7 (NC/NO/COM/L)
    pins: () => [top('3', 22), top('4', 50), top('1', 78), top('2', 106), bot('5', 22, 178), bot('6', 50, 178), bot('8', 78, 178), bot('7', 106, 178)],
    // NOTE: photo layout — top row 3/4/1/2 = E1/E2/E3/N ; bottom row 5/6/8/7 = NC/NO/COM/L
    defaults: { V: 220, restartDelay: 0 },
    isLoad: true,
    isSource: true,
  },
  tank: {
    w: 84, h: 124, prefix: 'T',
    pins: () => [top('E1', 21), top('E2', 42), top('E3', 63)],
    defaults: { level: 0.4, dailyUse: 4 },
  },
  pmr: {
    w: 80, h: 140, prefix: 'K',
    pins: () => [top('L1', 10), top('L2', 30), top('L3', 50), top('N', 70), bot('11', 20, 140), bot('12', 40, 140), bot('14', 60, 140)],
    defaults: { unbalance: 10, nominal: 415, tripDelay: 200 },
  },
  ph_no: { w: 40, h: 60, prefix: '', pins: twoPin('15', '18', 60), defaults: { parent: '' }, linked: true, linkTo: ['phasemon', 'ph1mon', 'phr_coil', 'pmr'] },
  ph_nc: { w: 40, h: 60, prefix: '', pins: twoPin('15', '16', 60), defaults: { parent: '' }, linked: true, linkTo: ['phasemon', 'ph1mon', 'phr_coil', 'pmr'] },
  contactor_main1: { w: 40, h: 80, prefix: '', pins: twoPin('1', '2', 80), defaults: { parent: '' }, linked: true },
  contactor_main2: { w: 60, h: 80, prefix: '', pins: () => [top('1', 20), top('3', 40), bot('2', 20, 80), bot('4', 40, 80)], defaults: { parent: '' }, linked: true },
  contactor_main: { w: 80, h: 80, prefix: '', pins: threePole(80), defaults: { parent: '' }, linked: true },
  contactor_main4: { w: 100, h: 80, prefix: '', pins: () => [top('1', 20), top('3', 40), top('5', 60), top('7', 80), bot('2', 20, 80), bot('4', 40, 80), bot('6', 60, 80), bot('8', 80, 80)], defaults: { parent: '' }, linked: true },
  dol_combo: { w: 80, h: 100, prefix: '', pins: () => [top('1', 20), top('3', 40), top('5', 60), bot('2', 20, 100), bot('4', 40, 100), bot('6', 60, 100)], defaults: { parent: '', Ir: 10 }, linked: true },
  aux4: { w: 100, h: 60, prefix: '', pins: () => [top('13', 20), top('23', 40), top('11', 60), top('21', 80), bot('14', 20, 60), bot('24', 40, 60), bot('12', 60, 60), bot('22', 80, 60)], defaults: { parent: '' }, linked: true },
  coil: { w: 40, h: 60, prefix: 'KM', pins: twoPin('A1', 'A2', 60), defaults: { kind: 'contactor', V: 230 }, isLoad: true },
  relay: { w: 40, h: 60, prefix: 'KA', pins: twoPin('A1', 'A2', 60), defaults: { V: 230 }, isLoad: true },
  safety: { w: 60, h: 80, prefix: 'KS', pins: () => [top('E1', 20), top('E2', 40), bot('A1', 20, 80), bot('A2', 40, 80)], defaults: { V: 24 }, isLoad: true },
  timer: { w: 60, h: 60, prefix: 'KT', pins: twoPin('A1', 'A2', 60), defaults: { mode: 'on', delay: 5, delay2: 5, gap: 60, V: 230 }, isLoad: true },
  ton: { w: 60, h: 60, prefix: 'KT', pins: twoPin('A1', 'A2', 60), defaults: { mode: 'on', delay: 5, V: 230 }, isLoad: true },
  tof: { w: 60, h: 60, prefix: 'KT', pins: twoPin('A1', 'A2', 60), defaults: { mode: 'off', delay: 5, V: 230 }, isLoad: true },
  tsd: { w: 60, h: 60, prefix: 'KT', pins: twoPin('A1', 'A2', 60), defaults: { mode: 'sd', delay: 6, gap: 60, V: 230 }, isLoad: true },
  tp: { w: 60, h: 60, prefix: 'KT', pins: twoPin('A1', 'A2', 60), defaults: { mode: 'pulse', delay: 1, V: 230 }, isLoad: true },
  rto: { w: 60, h: 60, prefix: 'KT', pins: twoPin('A1', 'A2', 60), defaults: { mode: 'rto', delay: 10, V: 230 }, isLoad: true },
  tcy: { w: 60, h: 60, prefix: 'KT', pins: twoPin('A1', 'A2', 60), defaults: { mode: 'cyclic', delay: 1, delay2: 2, V: 230 }, isLoad: true },
  contact_no: { w: 40, h: 60, prefix: '', pins: twoPin('13', '14', 60), defaults: { parent: '' }, linked: true },
  contact_nc: { w: 40, h: 60, prefix: '', pins: twoPin('11', '12', 60), defaults: { parent: '' }, linked: true },
  co: { w: 60, h: 60, prefix: '', pins: () => [top('11', 20), top('12', 40), bot('14', 30, 60)], defaults: { parent: '' }, linked: true },
  timer_no: { w: 40, h: 60, prefix: '', pins: twoPin('15', '18', 60), defaults: { parent: '' }, linked: true, linkTo: ['timer', 'ton', 'tof', 'tsd', 'tp', 'rto', 'tcy'] },
  timer_nc: { w: 40, h: 60, prefix: '', pins: twoPin('15', '16', 60), defaults: { parent: '' }, linked: true, linkTo: ['timer', 'ton', 'tof', 'tsd', 'tp', 'rto', 'tcy'] },
  timer_co: { w: 60, h: 60, prefix: '', pins: () => [top('15', 20), top('16', 40), bot('18', 30, 60)], defaults: { parent: '' }, linked: true, linkTo: ['timer', 'ton', 'tof', 'tsd', 'tp', 'rto', 'tcy'] },
  timer_star: { w: 40, h: 60, prefix: '', pins: twoPin('17', '28', 60), defaults: { parent: '' }, linked: true, linkTo: ['timer', 'ton', 'tof', 'tsd', 'tp', 'rto', 'tcy'] },
  pb_no: { w: 40, h: 60, prefix: 'S', pins: twoPin('13', '14', 60), defaults: { color: 'green' } },
  pb_nc: { w: 40, h: 60, prefix: 'S', pins: twoPin('11', '12', 60), defaults: { color: 'red' } },
  pb_dual: { w: 60, h: 60, prefix: 'S', pins: () => [top('13', 15), top('11', 45), bot('14', 15, 60), bot('12', 45, 60)], defaults: { color: 'green' } },
  estop: { w: 40, h: 60, prefix: 'S', pins: twoPin('11', '12', 60), defaults: {} },
  sel3: { w: 60, h: 60, prefix: 'S', pins: () => [top('13', 20), top('23', 40), bot('14', 20, 60), bot('24', 40, 60)], defaults: {} },
  choke: { w: 60, h: 40, prefix: 'CH', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { uh: 470 } },
  toroid: { w: 60, h: 40, prefix: 'L', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { uh: 470 } },
  air_core: { w: 60, h: 40, prefix: 'L', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { uh: 470 } },
  var_inductor: { w: 60, h: 40, prefix: 'L', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }, { id: 'W', x: 30, y: 0, dir: 'none' }], defaults: { uh: 470 } },
  cap_elec: { w: 60, h: 40, prefix: 'C', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 25 } },
  cap_ceramic: { w: 60, h: 40, prefix: 'C', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 25 } },
  cap_film: { w: 60, h: 40, prefix: 'C', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 25 } },
  cap_mica: { w: 60, h: 40, prefix: 'C', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 25 } },
  supercap: { w: 60, h: 40, prefix: 'C', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 25 } },
  cap_var: { w: 60, h: 40, prefix: 'VC', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }, { id: 'W', x: 30, y: 0, dir: 'none' }], defaults: { V: 25 } },
  transformer: { w: 60, h: 60, prefix: 'TR', pins: () => [{ id: '1', x: 15, y: 0, dir: 'none' }, { id: '2', x: 35, y: 0, dir: 'none' }, { id: '3', x: 15, y: 60, dir: 'none' }, { id: '4', x: 35, y: 60, dir: 'none' }], defaults: { VA: 100 } },
  transformer_iso: { w: 60, h: 60, prefix: 'TR', pins: () => [{ id: '1', x: 15, y: 0, dir: 'none' }, { id: '2', x: 35, y: 0, dir: 'none' }, { id: '3', x: 15, y: 60, dir: 'none' }, { id: '4', x: 35, y: 60, dir: 'none' }], defaults: { VA: 100 } },
  autotransformer: { w: 60, h: 60, prefix: 'TR', pins: () => [{ id: '1', x: 15, y: 0, dir: 'none' }, { id: '2', x: 35, y: 0, dir: 'none' }, { id: '3', x: 15, y: 60, dir: 'none' }, { id: '4', x: 35, y: 60, dir: 'none' }], defaults: { VA: 100 } },
  ct: { w: 60, h: 60, prefix: 'TR', pins: () => [{ id: '1', x: 15, y: 0, dir: 'none' }, { id: '2', x: 35, y: 0, dir: 'none' }, { id: '3', x: 15, y: 60, dir: 'none' }, { id: '4', x: 35, y: 60, dir: 'none' }], defaults: { VA: 100 } },
  pt: { w: 60, h: 60, prefix: 'TR', pins: () => [{ id: '1', x: 15, y: 0, dir: 'none' }, { id: '2', x: 35, y: 0, dir: 'none' }, { id: '3', x: 15, y: 60, dir: 'none' }, { id: '4', x: 35, y: 60, dir: 'none' }], defaults: { VA: 100 } },
  crystal: { w: 60, h: 40, prefix: 'Y', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { mhz: 16 } },
  fuse_glass: { w: 60, h: 40, prefix: 'FU', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { A: 2 } },
  fuse_blade: { w: 60, h: 40, prefix: 'FU', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { A: 2 } },
  fuse_ptc: { w: 60, h: 40, prefix: 'FU', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { A: 2 } },
  saw: { w: 60, h: 40, prefix: 'FL', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { mhz: 433 } },
  diode_rect: { w: 60, h: 40, prefix: 'D', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { If: 1 } },
  diode_zener: { w: 60, h: 40, prefix: 'DZ', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { If: 1 } },
  diode_schottky: { w: 60, h: 40, prefix: 'DS', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { If: 1 } },
  photodiode: { w: 60, h: 40, prefix: 'PD', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { If: 1 } },
  varactor: { w: 60, h: 40, prefix: 'DV', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { If: 1 } },
  tvs: { w: 60, h: 40, prefix: 'TVS', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { If: 1 } },
  tunnel: { w: 60, h: 40, prefix: 'DT', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { If: 1 } },
  bridge: { w: 70, h: 70, prefix: 'BR', pins: () => [{ id: 'AC1', x: 15, y: 60, dir: 'none' }, { id: 'AC2', x: 30, y: 60, dir: 'none' }, { id: '+', x: 45, y: 60, dir: 'none' }, { id: '-', x: 45, y: 0, dir: 'none' }], defaults: { A: 10 } },
  bjt: { w: 70, h: 70, prefix: 'Q', pins: () => [{ id: 'B', x: 0, y: 35, dir: 'none' }, { id: 'C', x: 46, y: 0, dir: 'none' }, { id: 'E', x: 46, y: 70, dir: 'none' }], defaults: { hfe: 100 } },
  darlington: { w: 70, h: 70, prefix: 'Q', pins: () => [{ id: 'B', x: 0, y: 35, dir: 'none' }, { id: 'C', x: 46, y: 0, dir: 'none' }, { id: 'E', x: 46, y: 70, dir: 'none' }], defaults: { hfe: 1000 } },
  phototransistor: { w: 70, h: 70, prefix: 'QT', pins: () => [{ id: 'B', x: 0, y: 35, dir: 'none' }, { id: 'C', x: 46, y: 0, dir: 'none' }, { id: 'E', x: 46, y: 70, dir: 'none' }], defaults: { Vce: 30 } },
  igbt: { w: 70, h: 70, prefix: 'Q', pins: () => [{ id: 'B', x: 0, y: 35, dir: 'none' }, { id: 'C', x: 46, y: 0, dir: 'none' }, { id: 'E', x: 46, y: 70, dir: 'none' }], defaults: { Vces: 600 } },
  jfet: { w: 70, h: 70, prefix: 'J', pins: () => [{ id: 'G', x: 0, y: 35, dir: 'none' }, { id: 'D', x: 46, y: 0, dir: 'none' }, { id: 'S', x: 46, y: 70, dir: 'none' }], defaults: { Idss: 10 } },
  mosfet: { w: 70, h: 70, prefix: 'M', pins: () => [{ id: 'G', x: 0, y: 35, dir: 'none' }, { id: 'D', x: 46, y: 0, dir: 'none' }, { id: 'S', x: 46, y: 70, dir: 'none' }], defaults: { Vds: 60 } },
  scr_ic: { w: 70, h: 70, prefix: 'Q', pins: () => [{ id: 'G', x: 0, y: 35, dir: 'none' }, { id: 'A1', x: 44, y: 0, dir: 'none' }, { id: 'A2', x: 44, y: 70, dir: 'none' }], defaults: { It: 8 } },
  triac: { w: 70, h: 70, prefix: 'Q', pins: () => [{ id: 'G', x: 0, y: 35, dir: 'none' }, { id: 'A1', x: 44, y: 0, dir: 'none' }, { id: 'A2', x: 44, y: 70, dir: 'none' }], defaults: { It: 8 } },
  diac: { w: 70, h: 70, prefix: 'Q', pins: () => [{ id: 'G', x: 0, y: 35, dir: 'none' }, { id: 'A1', x: 44, y: 0, dir: 'none' }, { id: 'A2', x: 44, y: 70, dir: 'none' }], defaults: { It: 8 } },
  gto: { w: 70, h: 70, prefix: 'Q', pins: () => [{ id: 'G', x: 0, y: 35, dir: 'none' }, { id: 'A1', x: 44, y: 0, dir: 'none' }, { id: 'A2', x: 44, y: 70, dir: 'none' }], defaults: { It: 8 } },
  opamp: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '-IN', x: 0, y: 20, dir: 'none' }, { id: '+IN', x: 0, y: 45, dir: 'none' }, { id: 'OUT', x: 92, y: 41, dir: 'none' }, { id: 'V-', x: 0, y: 74, dir: 'none' }, { id: 'V+', x: 92, y: 74, dir: 'none' }], defaults: { V: 12 } },
  comparator: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '-IN', x: 0, y: 20, dir: 'none' }, { id: '+IN', x: 0, y: 45, dir: 'none' }, { id: 'OUT', x: 92, y: 41, dir: 'none' }, { id: 'V-', x: 0, y: 74, dir: 'none' }, { id: 'V+', x: 92, y: 74, dir: 'none' }], defaults: { V: 12 } },
  pll: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  motor_driver: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  uln: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  transceiver: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  reg_linear: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: 'IN', x: 0, y: 35, dir: 'none' }, { id: 'GND', x: 46, y: 76, dir: 'none' }, { id: 'OUT', x: 92, y: 35, dir: 'none' }], defaults: { V: 12 } },
  reg_smps: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: 'IN', x: 0, y: 35, dir: 'none' }, { id: 'GND', x: 46, y: 76, dir: 'none' }, { id: 'OUT', x: 92, y: 35, dir: 'none' }], defaults: { V: 12 } },
  eeprom: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  sram: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  dram: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  flash: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  logic: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  flipflop: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  shiftreg: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  counter: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  mcu: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  mpu: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  dsp: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  fpga: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  optocoupler_ic: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: 'A', x: 0, y: 30, dir: 'none' }, { id: 'K', x: 0, y: 60, dir: 'none' }, { id: 'C', x: 92, y: 30, dir: 'none' }, { id: 'E', x: 92, y: 60, dir: 'none' }], defaults: { ctr: 100 } },
  triac_coupler: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: 'A', x: 0, y: 30, dir: 'none' }, { id: 'K', x: 0, y: 60, dir: 'none' }, { id: 'MT1', x: 92, y: 30, dir: 'none' }, { id: 'MT2', x: 92, y: 60, dir: 'none' }], defaults: { V: 600 } },
  switch_push: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  switch_toggle: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  switch_dip: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  switch_rotary: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  switch_micro: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  reed: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  terminal_block: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '1', x: 16, y: 44, dir: 'none' }, { id: '2', x: 25, y: 44, dir: 'none' }, { id: '3', x: 34, y: 44, dir: 'none' }, { id: '4', x: 43, y: 44, dir: 'none' }], defaults: {} },
  header: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '1', x: 16, y: 44, dir: 'none' }, { id: '2', x: 25, y: 44, dir: 'none' }, { id: '3', x: 34, y: 44, dir: 'none' }, { id: '4', x: 43, y: 44, dir: 'none' }], defaults: {} },
  power_jack: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '+', x: 0, y: 20, dir: 'none' }, { id: '-', x: 60, y: 20, dir: 'none' }], defaults: {} },
  usb_port: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: 'VBUS', x: 0, y: 20, dir: 'none' }, { id: 'D-', x: 20, y: 44, dir: 'none' }, { id: 'D+', x: 40, y: 44, dir: 'none' }, { id: 'GND', x: 60, y: 20, dir: 'none' }], defaults: {} },
  audio_jack: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: 'T', x: 0, y: 20, dir: 'none' }, { id: 'R', x: 30, y: 44, dir: 'none' }, { id: 'S', x: 60, y: 20, dir: 'none' }], defaults: {} },
  ic_socket: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '1', x: 16, y: 44, dir: 'none' }, { id: '2', x: 25, y: 44, dir: 'none' }, { id: '3', x: 34, y: 44, dir: 'none' }, { id: '4', x: 43, y: 44, dir: 'none' }], defaults: {} },
  heatsink: { w: 60, h: 40, prefix: 'X', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  relay_emr: { w: 80, h: 80, prefix: 'K', pins: () => [{ id: 'A1', x: 18, y: 0, dir: 'none' }, { id: 'A2', x: 18, y: 40, dir: 'none' }, { id: 'COM', x: 40, y: 70, dir: 'none' }, { id: 'NO', x: 54, y: 26, dir: 'none' }, { id: 'NC', x: 64, y: 70, dir: 'none' }], defaults: { V: 12 } },
  relay_latch: { w: 80, h: 80, prefix: 'K', pins: () => [{ id: 'A1', x: 18, y: 0, dir: 'none' }, { id: 'A2', x: 18, y: 40, dir: 'none' }, { id: 'COM', x: 40, y: 70, dir: 'none' }, { id: 'NO', x: 54, y: 26, dir: 'none' }, { id: 'NC', x: 64, y: 70, dir: 'none' }], defaults: { V: 12 } },
  dc_motor: { w: 80, h: 80, prefix: 'M', pins: () => [{ id: '+', x: 15, y: 0, dir: 'none' }, { id: '-', x: 45, y: 0, dir: 'none' }, { id: 'PWM', x: 30, y: 76, dir: 'none' }], defaults: { V: 24 }, isLoad: true },
  bldc: { w: 80, h: 80, prefix: 'M', pins: () => [{ id: '+', x: 15, y: 0, dir: 'none' }, { id: '-', x: 45, y: 0, dir: 'none' }, { id: 'PWM', x: 30, y: 76, dir: 'none' }], defaults: { V: 24 }, isLoad: true },
  stepper: { w: 80, h: 80, prefix: 'M', pins: () => [{ id: 'A+', x: 8, y: 76, dir: 'none' }, { id: 'A-', x: 24, y: 76, dir: 'none' }, { id: 'B+', x: 40, y: 76, dir: 'none' }, { id: 'B-', x: 56, y: 76, dir: 'none' }], defaults: { V: 24 }, isLoad: true },
  servo: { w: 80, h: 80, prefix: 'M', pins: () => [{ id: '+', x: 15, y: 0, dir: 'none' }, { id: '-', x: 45, y: 0, dir: 'none' }, { id: 'PWM', x: 30, y: 76, dir: 'none' }], defaults: { V: 24 }, isLoad: true },
  solenoid: { w: 80, h: 80, prefix: 'M', pins: () => [{ id: '+', x: 15, y: 0, dir: 'none' }, { id: '-', x: 45, y: 0, dir: 'none' }], defaults: { V: 24 }, isLoad: true },
  buzzer_active: { w: 60, h: 60, prefix: 'BZ', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 12 }, isLoad: true },
  speaker: { w: 60, h: 60, prefix: 'BZ', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 12 } },
  microphone: { w: 60, h: 60, prefix: 'BZ', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 12 } },
  cooling_fan: { w: 60, h: 60, prefix: 'BZ', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 12 }, isLoad: true },
  rotary_encoder: { w: 60, h: 60, prefix: 'ENC', pins: () => [{ id: 'A', x: 0, y: 20, dir: 'none' }, { id: 'B', x: 30, y: 44, dir: 'none' }, { id: 'C', x: 60, y: 20, dir: 'none' }], defaults: {} },
  strain_gauge: { w: 70, h: 40, prefix: 'LC', pins: () => [{ id: 'E+', x: 0, y: 16, dir: 'none' }, { id: 'E-', x: 0, y: 30, dir: 'none' }, { id: 'S+', x: 60, y: 16, dir: 'none' }, { id: 'S-', x: 60, y: 30, dir: 'none' }], defaults: { kg: 50 } },
  res_fixed: { w: 60, h: 40, prefix: 'R', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  pot: { w: 60, h: 40, prefix: 'VR', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }, { id: 'W', x: 30, y: 0, dir: 'none' }], defaults: {} },
  ldr: { w: 60, h: 40, prefix: 'LDR', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  thermistor: { w: 60, h: 40, prefix: 'TH', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  res_net: { w: 60, h: 40, prefix: 'RN', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: {} },
  resistor: { w: 60, h: 40, prefix: 'R', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { ohm: 10000, watt: 0.25 } },
  capacitor: { w: 60, h: 40, prefix: 'C', pins: () => [{ id: '1 A', x: 0, y: 30, dir: 'none' }, { id: '2 K', x: 0, y: 60, dir: 'none' }, { id: '3 MT1', x: 92, y: 30, dir: 'none' }, { id: '4 MT2', x: 92, y: 60, dir: 'none' }], defaults: { uf: 1000, volt: 25, polar: true } },
  inductor: { w: 60, h: 40, prefix: 'L', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { uh: 470 } },
  diode: { w: 60, h: 40, prefix: 'D', pins: () => [{ id: 'A', x: 0, y: 20, dir: 'none' }, { id: 'K', x: 60, y: 20, dir: 'none' }], defaults: { If: 1 } },
  led: { w: 60, h: 40, prefix: 'LED', pins: () => [{ id: 'A', x: 0, y: 20, dir: 'none' }, { id: 'K', x: 60, y: 20, dir: 'none' }], defaults: { color: 'green', V: 2 } },
  lamp_neon: { w: 60, h: 40, prefix: 'NE', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 230 } },
  npn: { w: 70, h: 70, prefix: 'Q', pins: () => [{ id: 'B', x: 0, y: 35, dir: 'none' }, { id: 'C', x: 46, y: 0, dir: 'none' }, { id: 'E', x: 46, y: 70, dir: 'none' }], defaults: { hfe: 100 } },
  pnp: { w: 70, h: 70, prefix: 'Q', pins: () => [{ id: 'B', x: 0, y: 35, dir: 'none' }, { id: 'C', x: 46, y: 0, dir: 'none' }, { id: 'E', x: 46, y: 70, dir: 'none' }], defaults: { hfe: 100 } },
  scr: { w: 70, h: 70, prefix: 'SCR', pins: () => [{ id: 'G', x: 0, y: 35, dir: 'none' }, { id: 'A1', x: 44, y: 0, dir: 'none' }, { id: 'A2', x: 44, y: 70, dir: 'none' }], defaults: { It: 8 } },
  ic555: { w: 92, h: 110, prefix: 'U', pins: () => [{ id: '1', x: 0, y: 12, dir: 'none' }, { id: '2', x: 0, y: 22, dir: 'none' }, { id: '3', x: 0, y: 32, dir: 'none' }, { id: '4', x: 0, y: 42, dir: 'none' }, { id: '5', x: 0, y: 52, dir: 'none' }, { id: '6', x: 0, y: 62, dir: 'none' }, { id: '7', x: 0, y: 72, dir: 'none' }, { id: '8', x: 90, y: 72, dir: 'none' }, { id: '9', x: 90, y: 62, dir: 'none' }, { id: '10', x: 90, y: 52, dir: 'none' }, { id: '11', x: 90, y: 42, dir: 'none' }, { id: '12', x: 90, y: 32, dir: 'none' }, { id: '13', x: 90, y: 22, dir: 'none' }, { id: '14', x: 90, y: 12, dir: 'none' }], defaults: { V: 12 } },
  optocoupler: { w: 80, h: 70, prefix: 'U', pins: () => [{ id: 'A', x: 0, y: 30, dir: 'none' }, { id: 'K', x: 0, y: 60, dir: 'none' }, { id: 'C', x: 92, y: 30, dir: 'none' }, { id: 'E', x: 92, y: 60, dir: 'none' }], defaults: { ctr: 100 } },
  regulator: { w: 60, h: 70, prefix: 'U', pins: () => [{ id: '1 A', x: 0, y: 30, dir: 'none' }, { id: '2 K', x: 0, y: 60, dir: 'none' }, { id: '3 MT1', x: 92, y: 30, dir: 'none' }, { id: '4 MT2', x: 92, y: 60, dir: 'none' }], defaults: { V: 12 } },
  varistor: { w: 60, h: 40, prefix: 'RV', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 275 } },
  buzzer_piezo: { w: 60, h: 60, prefix: 'BZ', pins: () => [{ id: '1', x: 0, y: 20, dir: 'none' }, { id: '2', x: 60, y: 20, dir: 'none' }], defaults: { V: 12 } },
  ntc: {
    w: 48, h: 82, prefix: 'TE',
    // two-wire NTC probe: both terminals exit the bottom, side by side (P ⊕ | N ⊕)
    pins: () => [{ id: '1 A', x: 0, y: 30, dir: 'none' }, { id: '2 K', x: 0, y: 60, dir: 'none' }, { id: '3 MT1', x: 92, y: 30, dir: 'none' }, { id: '4 MT2', x: 92, y: 60, dir: 'none' }],
    defaults: { temp: 26, rated: 10, heatTime: 15, coolTime: 15, lowTemp: 18, highTemp: 26 },
    isLoad: true,
  },
  stc3008: {
    w: 120, h: 112, prefix: 'T',
    // ⊕1 L · ⊕2 N · ⊕3-⊕4 SENSOR · ⊕5 IN · ⊕6 OUT (AC 230 V)
    pins: () => [top('1', 14), top('2', 30), top('3', 50), top('4', 66), top('5', 88), top('6', 104)],
    defaults: { stopTemp: 18, startTemp: 26, temp: 26, autoCycle: true, cycleRate: 3, heatTime: 15, coolTime: 15, unit: 'C' },
    isLoad: false,
  },
  sens_limit: { w: 60, h: 60, prefix: 'S', pins: () => [top('1', 30), bot('2', 30, 60)], defaults: { kind: 'limit', contact: 'NO' } },
  sens_float: { w: 60, h: 60, prefix: 'S', pins: () => [top('1', 30), bot('2', 30, 60)], defaults: { kind: 'float', contact: 'NO' } },
  sens_pressure: { w: 60, h: 60, prefix: 'S', pins: () => [top('1', 30), bot('2', 30, 60)], defaults: { kind: 'pressure', contact: 'NO' } },
  sens_temp: { w: 60, h: 60, prefix: 'S', pins: () => [top('1', 30), bot('2', 30, 60)], defaults: { kind: 'thermostat', contact: 'NO' } },
  sens_photo: { w: 60, h: 60, prefix: 'S', pins: () => [top('1', 30), bot('2', 30, 60)], defaults: { kind: 'photo', contact: 'NO' } },
  sens_prox: { w: 60, h: 60, prefix: 'S', pins: () => [top('1', 30), bot('2', 30, 60)], defaults: { kind: 'prox', contact: 'NO' } },
  sens_reed: { w: 60, h: 60, prefix: 'S', pins: () => [top('1', 30), bot('2', 30, 60)], defaults: { kind: 'reed', contact: 'NO' } },
  sens_flow: { w: 60, h: 60, prefix: 'S', pins: () => [top('1', 30), bot('2', 30, 60)], defaults: { kind: 'flow', contact: 'NO' } },
  sens_vibration: { w: 60, h: 60, prefix: 'S', pins: () => [top('1', 30), bot('2', 30, 60)], defaults: { kind: 'vibration', contact: 'NO' } },
  switch: {
    w: 60, h: 60, prefix: 'S',
    pins: (c) => (c.props.contact === 'CO' ? [top('11', 20), top('12', 40), bot('14', 30, 60)] : [top('1', 30), bot('2', 30, 60)]),
    defaults: { kind: 'selector', contact: 'NO' },
  },
  lamp: { w: 40, h: 60, prefix: 'H', pins: twoPin('X1', 'X2', 60), defaults: { color: 'green', V: 230 }, isLoad: true },
  buzzer: { w: 40, h: 60, prefix: 'HA', pins: twoPin('X1', 'X2', 60), defaults: { V: 230 }, isLoad: true },
  horn: { w: 40, h: 60, prefix: 'HA', pins: twoPin('X1', 'X2', 60), defaults: { V: 230 }, isLoad: true },
  bell: { w: 40, h: 60, prefix: 'HA', pins: twoPin('X1', 'X2', 60), defaults: { V: 230 }, isLoad: true },
  motor3: {
    w: 80,
    h: 80,
    prefix: 'M',
    pins: () => [top('U', 20), top('V', 40), top('W', 60), bot('PE', 20, 80)],
    defaults: { In: 10, kW: 4, load: 1 },
    isLoad: true,
  },
  motor6: {
    w: 80,
    h: 80,
    prefix: 'M',
    pins: () => [top('U1', 20), top('V1', 40), top('W1', 60), bot('W2', 20, 80), bot('U2', 40, 80), bot('V2', 60, 80), bot('PE', 0, 80)],
    defaults: { In: 20, kW: 11, load: 0.3 },
    isLoad: true,
  },
  motor1: {
    w: 60,
    h: 80,
    prefix: 'M',
    pins: () => [top('L', 20), top('N', 40), bot('PE', 20, 80)],
    defaults: { In: 4, kW: 0.75, load: 1 },
    isLoad: true,
  },
};

export const PALETTE_GROUPS: { key: string; items: ComponentType[] }[] = [
  { key: 'grp_supply', items: ['supply3npe', 'supply3pe', 'supply3', 'supply1p', 'supply1n', 'supply1pe', 'supply1', 'supply1npe', 'psu24', 'busbar', 'junction'] },
  { key: 'grp_protection', items: ['mcb1', 'mcb2', 'mcb3', 'mccb', 'mccb4', 'mpcb', 'fuse', 'fuse2', 'fuse3', 'fsw1', 'fsw2', 'fsw3', 'iso1', 'iso2', 'iso3', 'cos1', 'esw1', 'rccb', 'rcbo', 'rccb4', 'overload', 'ol_no', 'ol_nc', 'phasemon', 'ph1mon', 'phr_coil', 'pmr', 'floatless', 'tank', 'ph_no', 'ph_nc'] },
  { key: 'grp_contact', items: ['coil', 'contactor_main1', 'contactor_main2', 'contactor_main', 'contactor_main4', 'dol_combo', 'contact_no', 'contact_nc', 'co', 'aux4'] },
  { key: 'grp_relay', items: ['relay', 'safety', 'contact_no', 'contact_nc', 'co'] },
  { key: 'grp_timer', items: ['ton', 'tof', 'tsd', 'tp', 'rto', 'tcy', 'timer', 'timer_no', 'timer_nc', 'timer_co', 'timer_star'] },
  { key: 'grp_control', items: ['tank', 'pb_no', 'pb_nc', 'pb_dual', 'estop', 'sel3'] },
  { key: 'grp_sensors', items: ['stc3008', 'ntc', 'sens_limit', 'sens_float', 'sens_pressure', 'sens_temp', 'sens_photo', 'sens_prox', 'sens_reed', 'sens_flow', 'sens_vibration'] },
  { key: 'grp_electronics', items: ['resistor', 'capacitor', 'inductor', 'diode', 'led', 'lamp_neon', 'npn', 'pnp', 'scr', 'ic555', 'optocoupler', 'bridge', 'regulator', 'varistor', 'buzzer_piezo', 'res_fixed', 'pot', 'ldr', 'thermistor', 'res_net', 'cap_elec', 'cap_ceramic', 'cap_film', 'cap_mica', 'supercap', 'cap_var', 'choke', 'toroid', 'air_core', 'var_inductor', 'transformer', 'transformer_iso', 'autotransformer', 'crystal', 'fuse_glass', 'fuse_blade', 'fuse_ptc', 'saw', 'diode_rect', 'diode_zener', 'diode_schottky', 'photodiode', 'varactor', 'tvs', 'tunnel', 'bjt', 'darlington', 'phototransistor', 'jfet', 'mosfet', 'igbt', 'scr_ic', 'triac', 'diac', 'gto', 'opamp', 'comparator', 'pll', 'motor_driver', 'uln', 'transceiver', 'reg_linear', 'reg_smps', 'eeprom', 'sram', 'dram', 'flash', 'logic', 'flipflop', 'shiftreg', 'counter', 'mcu', 'mpu', 'dsp', 'fpga', 'optocoupler_ic', 'triac_coupler', 'switch_push', 'switch_toggle', 'switch_dip', 'switch_rotary', 'switch_micro', 'reed', 'relay_emr', 'relay_latch', 'dc_motor', 'bldc', 'stepper', 'servo', 'solenoid', 'terminal_block', 'header', 'power_jack', 'usb_port', 'audio_jack', 'ic_socket', 'heatsink', 'buzzer_active', 'speaker', 'microphone', 'cooling_fan', 'rotary_encoder', 'strain_gauge', 'ct', 'pt'] },
  { key: 'grp_loads', items: ['motor3', 'motor6', 'motor1', 'lamp', 'buzzer', 'horn', 'bell'] },
];

export const LINKABLE_TYPES: ComponentType[] = ['coil', 'relay', 'stc3008', 'timer', 'ton', 'tof', 'tsd', 'tp', 'rto', 'tcy', 'overload', 'mcb1', 'mcb2', 'mcb3', 'mccb', 'mccb4', 'mpcb', 'fsw1', 'fsw3', 'fuse3', 'rccb', 'rcbo', 'rccb4', 'phasemon', 'ph1mon', 'phr_coil', 'safety', 'dol_combo', 'cos1', 'sel3', 'pb_no', 'pb_nc', 'pb_dual', 'estop', 'switch', 'pmr'];

/** Device types that carry a protective-earth terminal. */
export const EARTHED_TYPES: ComponentType[] = ['motor3', 'motor6', 'motor1', 'psu24'];

export function getPins(c: CircuitComponent): PinDef[] {
  return CATALOG[c.type].pins(c);
}

export function pinWorld(c: CircuitComponent, pinId: string): { x: number; y: number; dir: PinDef['dir'] } | null {
  const p = getPins(c).find((q) => q.id === pinId);
  if (!p) return null;
  return { x: c.x + p.x, y: c.y + p.y, dir: p.dir };
}

export function termKey(c: string, p: string) {
  return c + ':' + p;
}

export function supplyPhase(c: CircuitComponent): Potential {
  const ph = c.props.phase;
  return ph === 'L2' || ph === 'L3' ? ph : 'L1';
}

export function sourcePotential(c: CircuitComponent, pin: string): Potential | null {
  if (isSupply(c.type)) {
    if (pin === 'L') return supplyPhase(c);
    if (pin === 'L1' || pin === 'L2' || pin === 'L3' || pin === 'N' || pin === 'PE') return pin;
    return null;
  }
  if (c.type === 'psu24') return pin === '+24' ? 'P24' : pin === '0V' ? 'M24' : null;
  return null;
}

/** Auto wire colour in edit mode: follows the supply/source terminal the wire touches (L1 red, L2 yellow, L3 blue, …). */
export const PHASE_SIZE = 6; // XXL for 3-phase power conductors

/**
 * Trace a wire back through 1:1 series power devices (breaker poles, contactor poles,
 * overload poles, motor stator) until an upstream supply terminal is found.
 * This is what lets every downstream 3-phase conductor inherit L1/L2/L3 colours and XXL size.
 */
export function tracePhase(term: TermRef, comps: Map<string, CircuitComponent>, wires: Wire[], depth = 0, seen: Set<string> = new Set()): Potential | null {
  const key = term.c + ':' + term.p;
  if (seen.has(key) || depth > 60) return null;
  seen.add(key);
  const c = comps.get(term.c);
  if (!c) return null;
  const direct = sourcePotential(c, term.p);
  if (direct) return direct;
  // 1:1 pole pairs inside 3-phase power devices
  const POLES: Record<string, [string, string][]> = {
    mcb3: [['1', '2'], ['3', '4'], ['5', '6']],
    mccb: [['1', '2'], ['3', '4'], ['5', '6']],
    mpcb: [['1', '2'], ['3', '4'], ['5', '6']],
    contactor_main: [['1', '2'], ['3', '4'], ['5', '6']],
    fsw3: [['1', '2'], ['3', '4'], ['5', '6']],
    iso3: [['1', '2'], ['3', '4'], ['5', '6']],
    fuse3: [['1', '2'], ['3', '4'], ['5', '6']],
    overload: [['1', '2'], ['3', '4'], ['5', '6']],
  };
  const pair = (POLES[c.type] || []).find(([a, b]) => a === term.p || b === term.p);
  if (pair) {
    const other = pair[0] === term.p ? pair[1] : pair[0];
    if (other !== term.p) {
      const back = tracePhase({ c: c.id, p: other }, comps, wires, depth + 1, seen);
      if (back) return back;
    }
  }
  // follow the connected wire(s) of this terminal
  for (const w of wires) {
    if (w.a.c === term.c && w.a.p === term.p) {
      const r = tracePhase(w.b, comps, wires, depth + 1, seen);
      if (r) return r;
    } else if (w.b.c === term.c && w.b.p === term.p) {
      const r = tracePhase(w.a, comps, wires, depth + 1, seen);
      if (r) return r;
    }
  }
  return null;
}

/** True for conductors that belong to the 3-phase power circuit (L1/L2/L3). */
export function isPhaseWire(w: Wire, comps: Map<string, CircuitComponent>, wires: Wire[]): boolean {
  return !!(tracePhase(w.a, comps, wires) || tracePhase(w.b, comps, wires));
}

export function autoWireColor(w: Wire, comps: Map<string, CircuitComponent>, wires?: Wire[]): string | undefined {
  for (const t of [w.a, w.b]) {
    const c = comps.get(t.c);
    if (!c) continue;
    const pot = sourcePotential(c, t.p);
    if (pot) return POT_COLORS[pot];
  }
  if (wires) {
    const ph = tracePhase(w.a, comps, wires) || tracePhase(w.b, comps, wires);
    if (ph) return POT_COLORS[ph];
  }
  return undefined;
}

export const POT_COLORS: Record<Potential, string> = {
  L1: '#ef4444',
  L2: '#eab308',
  L3: '#3b82f6',
  N: '#1e293b',
  PE: '#16a34a',
  P24: '#f97316',
  M24: '#06b6d4',
};

export const LAMP_COLORS: Record<string, string> = {
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#facc15',
  white: '#f8fafc',
  blue: '#3b82f6',
};

let counter = 1;
export function uid(prefix = 'c') {
  counter += 1;
  return prefix + Date.now().toString(36).slice(-4) + (counter).toString(36) + Math.random().toString(36).slice(2, 5);
}

export function nextLabel(type: ComponentType, existing: CircuitComponent[]): string {
  const prefix = CATALOG[type].prefix;
  if (!prefix) return '';
  const used = new Set(existing.map((c) => c.label));
  for (let i = 1; i < 200; i++) {
    const l = prefix + i;
    if (!used.has(l)) return l;
  }
  return prefix;
}

export function makeComponent(type: ComponentType, x: number, y: number, existing: CircuitComponent[], label?: string, props?: Record<string, any>): CircuitComponent {
  return {
    id: uid(),
    type,
    x,
    y,
    label: label ?? nextLabel(type, existing),
    props: { ...CATALOG[type].defaults, ...(props || {}) },
  };
}
