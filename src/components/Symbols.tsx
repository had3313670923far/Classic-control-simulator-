import { memo } from 'react';
import type { CircuitComponent, ComponentType, DeviceState, Mode, Potential } from '../types';
import { CATALOG, LAMP_COLORS, POT_COLORS, SUPPLY_PINS, getPins, supplyPhase, termKey } from '../lib/catalog';
import { initialState } from '../lib/engine';

const INK = '#1e293b';
const ON = '#16a34a';
const RED = '#dc2626';
const AMBER = '#f59e0b';
const BODY = '#f1f5f9';
const BODY_STROKE = '#64748b';

export interface SymbolProps {
  c: CircuitComponent;
  st?: DeviceState;
  mode: Mode;
  parentLabel?: string;
  parentType?: ComponentType;
  selected: boolean;
  faulted: boolean;
  termPot?: Record<string, Potential | undefined>; // live potentials (run mode)
  active?: boolean; // linked contacts: parent device active
  timedMode?: string; // parent timer mode (for timed contact glyph)
}

const Lead = ({ x1, y1, x2, y2, color = INK, w = 1.6 }: { x1: number; y1: number; x2: number; y2: number; color?: string; w?: number }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
);

const PinNo = ({ x, y, text, anchor = 'end' }: { x: number; y: number; text: string; anchor?: 'start' | 'end' | 'middle' }) => (
  <text x={x} y={y} fontSize={6.5} fill="#64748b" textAnchor={anchor} fontFamily="ui-monospace, monospace">
    {text}
  </text>
);

const Label = ({ x, y, text, color = INK, size = 10, anchor = 'start', bold = true }: { x: number; y: number; text: string; color?: string; size?: number; anchor?: 'start' | 'end' | 'middle'; bold?: boolean }) =>
  text ? (
    <text x={x} y={y} fontSize={size} fontWeight={bold ? 700 : 500} fill={color} textAnchor={anchor} fontFamily="Inter, system-ui, sans-serif">
      {text}
    </text>
  ) : null;

interface ContactGlyphProps {
  closed: boolean;
  nc?: boolean;
  x?: number;
  top?: number;
  bottom?: number;
  run: boolean;
  timed?: 'on' | 'off' | 'flash';
  thermal?: boolean;
  lean?: 'left' | 'right';
  openRight45?: boolean;
}

function ContactGlyph({ closed, nc, x = 20, top = 20, bottom = 40, run, timed, thermal, lean = 'left', openRight45 = false }: ContactGlyphProps) {
  const color = run ? (closed ? ON : INK) : INK;
  const mid = (top + bottom) / 2;
  const tipX = lean === 'left' ? x - 7 : x + 7;
  const tipY = top + 6;
  const gap = bottom - top;
  // NC rest: blade leans 30 degrees right, crossing over the bridge
  const ncTip = { x: x + (gap + 7) * Math.tan(Math.PI / 6), y: top - 7 };
  // PB-NC opens swinging to 45 degrees right; others swing left away from the bridge
  const openTip = nc && openRight45 ? { x: x + (gap - 6), y: top + 6 } : { x: tipX, y: tipY };
  const closedTip = nc ? ncTip : { x, y: top };
  const end = closed ? closedTip : openTip;
  const start = closed ? openTip : closedTip;
  return (
    <g>
      {nc && <Lead x1={x} y1={top} x2={x + 16} y2={top} color={color} w={1.6} />}
      <line key={closed ? 'c' : 'o'} x1={x} y1={bottom} x2={end.x} y2={end.y} stroke={color} strokeWidth={2} strokeLinecap="round">
        <animate attributeName="x2" from={start.x} to={end.x} dur="0.15s" fill="freeze" />
        <animate attributeName="y2" from={start.y} to={end.y} dur="0.15s" fill="freeze" />
      </line>
      {timed && (
        <g>
          <line x1={x - 7} y1={mid} x2={x - 2} y2={mid} stroke={INK} strokeWidth={1} strokeDasharray="1.5 1.5" />
          <path d={timed === 'on' ? `M ${x - 12} ${mid + 5} a 5 5 0 0 1 0 -10` : `M ${x - 8} ${mid + 5} a 5 5 0 0 0 0 -10`} fill="none" stroke={INK} strokeWidth={1.2} />
          {timed === 'flash' && <circle cx={x - 10} cy={mid} r={1.2} fill={INK} />}
        </g>
      )}
      {thermal && (
        <g>
          <line x1={x - 8} y1={mid} x2={x - 2} y2={mid} stroke={INK} strokeWidth={1} strokeDasharray="1.5 1.5" />
          <path d={`M ${x - 16} ${mid - 4} h 8 v 8 h -8 z M ${x - 15} ${mid} h 6`} fill="none" stroke={INK} strokeWidth={1.1} />
        </g>
      )}
    </g>
  );
}

interface ChangeoverProps {
  active: boolean;
  run: boolean;
  timed?: 'on' | 'off' | 'flash';
  thermal?: boolean;
}

/** Changeover blade: common A (top-left) rocks between B (top-right, rest) and C (bottom, active). */
function ChangeoverGlyph({ active, run, timed, thermal }: ChangeoverProps) {
  const color = run ? ON : INK;
  const P = { x: 20, y: 30 };
  const B = { x: 40, y: 30 };
  const C = { x: 30, y: 46 };
  const T = active ? C : B;
  return (
    <g>
      <Lead x1={P.x} y1={P.y} x2={T.x} y2={T.y} color={color} w={2} />
      {timed && (
        <g>
          <line x1={P.x - 7} y1={38} x2={P.x - 2} y2={38} stroke={INK} strokeWidth={1} strokeDasharray="1.5 1.5" />
          <path d={timed === 'on' ? `M 8 43 a 5 5 0 0 1 0 -10` : `M 12 43 a 5 5 0 0 0 0 -10`} fill="none" stroke={INK} strokeWidth={1.2} />
          {timed === 'flash' && <circle cx={10} cy={38} r={1.2} fill={INK} />}
        </g>
      )}
      {thermal && (
        <g>
          <line x1={P.x - 8} y1={38} x2={P.x - 2} y2={38} stroke={INK} strokeWidth={1} strokeDasharray="1.5 1.5" />
          <path d="M 4 34 h 8 v 8 h -8 z M 5 38 h 6" fill="none" stroke={INK} strokeWidth={1.1} />
        </g>
      )}
    </g>
  );
}

interface BladeProps {
  x: number;
  top: number;
  bottom: number;
  closed: boolean;
  mark?: 'x' | 'hook' | 'none';
  color: string;
}

/** IEC switch blade, pivot at the bottom. x = automatic breaker, hook = disconnector. */
function BreakerBlade({ x, top, bottom, closed, mark = 'x', color }: BladeProps) {
  const tipX = closed ? x : x + 9;
  const tipY = closed ? top : top + 1;
  const mx = closed ? x : x + 4.5;
  const my = closed ? top + 11 : (top + 1 + bottom) / 2 - 4;
  return (
    <g>
      <line x1={x} y1={bottom} x2={tipX} y2={tipY} stroke={color} strokeWidth={2} strokeLinecap="round" />
      {mark === 'hook' ? (
        <circle cx={tipX} cy={tipY} r={2.2} fill="none" stroke={color} strokeWidth={1.4} />
      ) : mark === 'x' ? (
        <path d={`M ${mx - 3} ${my - 3} L ${mx + 3} ${my + 3} M ${mx + 3} ${my - 3} L ${mx - 3} ${my + 3}`} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      ) : null}
    </g>
  );
}

function ReleaseMarks({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={7} height={10} fill={INK} />
      <path d={`M ${x} ${y + 14} a 3.5 3.5 0 0 0 7 0`} fill="none" stroke={INK} strokeWidth={1.2} />
    </g>
  );
}

const Tag = ({ x, y, text, anchor = 'start' }: { x: number; y: number; text?: string; anchor?: 'start' | 'end' | 'middle' }) =>
  text ? (
    <text x={x} y={y} fontSize={6.5} fontWeight={700} fill="#64748b" textAnchor={anchor} fontFamily="ui-monospace, monospace">
      {text}
    </text>
  ) : null;

const TYPE_TAG: Partial<Record<ComponentType, string>> = {
  coil: 'COIL',
  relay: 'RELAY',
  contact_no: 'NO',
  contact_nc: 'NC',
  co: 'CO',
  timer_no: 'T-NO',
  timer_nc: 'T-NC',
  timer_co: 'T-CO',
  timer_star: 'T-Y',
  ol_no: 'OL-NO',
  ol_nc: 'OL-NC',
  ph_no: 'PH-NO',
  ph_nc: 'PH-NC',
  aux4: 'AUX',
  contactor_main: 'MAIN',
  contactor_main1: 'MAIN',
  contactor_main2: 'MAIN',
  contactor_main4: 'MAIN-4P',
  dol_combo: 'DOL',
  timer: 'TIMER',
  ton: 'TON',
  tof: 'TOF',
  tsd: 'Y-Δ',
  tp: 'TP',
  rto: 'RTO',
  tcy: 'CYC',
  pb_no: 'PB-NO',
  pb_nc: 'PB-NC',
  pb_dual: 'PB-NO+NC',
  estop: 'E-STOP',
  lamp: 'LAMP',
  buzzer: 'BUZ',
  horn: 'HORN',
  bell: 'BELL',
  phasemon: 'PHASE-3P',
  ph1mon: 'PHASE-1P',
  phr_coil: 'PH-COIL',
  pmr: 'PMR',
  floatless: 'FLS',
  sens_limit: 'LIMIT',
  stc3008: 'STC-3008',
  ntc: 'NTC',
  resistor: 'R',
  capacitor: 'C',
  inductor: 'L',
  diode: 'D',
  led: 'LED',
  lamp_neon: 'NEON',
  npn: 'NPN',
  pnp: 'PNP',
  scr: 'SCR',
  ic555: '555',
  optocoupler: 'OPTO',
  bridge: 'BR',
  regulator: 'REG',
  varistor: 'MOV',
  buzzer_piezo: 'BZ',
  res_fixed: 'R',
  res_net: 'RN',
  fuse_glass: 'FU',
  fuse_blade: 'FU',
  fuse_ptc: 'PPTC',
  saw: 'SAW',
  ldr: 'LDR',
  thermistor: 'TH',
  pot: 'POT',
  cap_var: 'VC',
  var_inductor: 'L',
  cap_elec: 'C',
  supercap: 'SC',
  cap_ceramic: 'C',
  cap_film: 'C',
  cap_mica: 'C',
  choke: 'CH',
  toroid: 'L',
  air_core: 'L',
  transformer: 'TR',
  transformer_iso: 'TR',
  autotransformer: 'AT',
  ct: 'CT',
  pt: 'PT',
  crystal: 'Y',
  diode_rect: 'D',
  photodiode: 'PD',
  varactor: 'DV',
  tvs: 'TVS',
  tunnel: 'DT',
  diode_zener: 'DZ',
  diode_schottky: 'DS',
  jfet: 'JFET',
  mosfet: 'MOSFET',
  igbt: 'IGBT',
  darlington: 'DARL',
  phototransistor: 'PT',
  triac: 'TRIAC',
  diac: 'DIAC',
  gto: 'GTO',
  scr_ic: 'SCR',
  opamp: 'OP',
  comparator: 'CMP',
  logic: 'LOGIC',
  flipflop: 'FF',
  shiftreg: 'SR',
  counter: 'CTR',
  pll: 'PLL',
  transceiver: 'TX',
  motor_driver: 'DRV',
  uln: 'ULN',
  reg_linear: 'REG',
  reg_smps: 'SMPS',
  eeprom: 'EEP',
  sram: 'RAM',
  dram: 'DRAM',
  flash: 'FLASH',
  mcu: 'MCU',
  mpu: 'CPU',
  dsp: 'DSP',
  fpga: 'FPGA',
  optocoupler_ic: 'OPTO',
  triac_coupler: 'MOC',
  switch_push: 'PB',
  switch_toggle: 'SW',
  switch_dip: 'DIP',
  switch_rotary: 'ROT',
  switch_micro: 'MICRO',
  reed: 'REED',
  relay_emr: 'EMR',
  relay_latch: 'LATCH',
  dc_motor: 'DC',
  bldc: 'BLDC',
  stepper: 'STP',
  servo: 'SRV',
  solenoid: 'SOL',
  terminal_block: 'TB',
  header: 'HDR',
  power_jack: 'JACK',
  usb_port: 'USB',
  audio_jack: 'AUX',
  ic_socket: 'SOCKET',
  buzzer_active: 'BZ',
  speaker: 'SPK',
  microphone: 'MIC',
  cooling_fan: 'FAN',
  rotary_encoder: 'ENC',
  strain_gauge: 'LC',
  heatsink: 'HS',
  sens_float: 'FLOAT',
  sens_pressure: 'PRESS',
  sens_temp: 'TEMP',
  sens_photo: 'PHOTO',
  sens_prox: 'PROX',
  sens_reed: 'REED',
  sens_flow: 'FLOW',
  sens_vibration: 'VIB',
  tank: 'TANK',
};

const KIND_TAG: Record<string, string> = {
  selector: 'SEL',
  key: 'KEY',
  limit: 'LIMIT',
  float: 'FLOAT',
  pressure: 'PRESS',
  thermostat: 'TEMP',
  photo: 'PHOTO',
  prox: 'PROX',
};

function Selection({ w, h, selected, faulted }: { w: number; h: number; selected: boolean; faulted: boolean }) {
  if (!selected && !faulted) return null;
  return (
    <rect
      x={-6}
      y={-6}
      width={Math.max(w, 1) + 12}
      height={Math.max(h, 1) + 12}
      rx={4}
      fill={faulted ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.08)'}
      stroke={faulted ? RED : '#3b82f6'}
      strokeWidth={1.5}
      strokeDasharray={faulted ? undefined : '4 3'}
      className={faulted ? 'fault-flash' : undefined}
    />
  );
}

export const Symbol = memo(function Symbol({ c, st, mode, parentLabel, parentType, selected, faulted, termPot, active, timedMode }: SymbolProps) {
  const run = mode === 'run';
  const s: DeviceState = st || initialState(c);
  const { w, h } = CATALOG[c.type];
  const sel = <Selection w={w} h={h} selected={selected} faulted={faulted} />;
  const timedKind = parentType === 'timer' ? timedMode || 'on' : undefined;

  switch (c.type) {
    case 'supply3npe':
    case 'supply3pe':
    case 'supply3':
    case 'supply1':
    case 'supply1npe':
    case 'supply1p':
    case 'supply1n':
    case 'supply1pe': {
      const pins = SUPPLY_PINS[c.type];
      const tripped = !!s.tripped;
      const phase = supplyPhase(c);
      const three = pins.includes('L1');
      const single = pins.length === 1;
      const fill = tripped ? RED : c.type === 'supply1pe' ? '#15803d' : c.type === 'supply1n' ? '#475569' : '#1e293b';
      const pinName = (p: string) => (p === 'L' ? phase : p);
      return (
        <g>
          {sel}
          <rect x={0} y={0} width={w} height={h} rx={5} fill={fill} stroke={INK} />
          {single ? (
            <g>
              {c.type === 'supply1pe' ? (
                <g stroke="#fff" strokeWidth={1.8} strokeLinecap="round">
                  <line x1={20} y1={7} x2={20} y2={17} />
                  <line x1={11} y1={17} x2={29} y2={17} />
                  <line x1={14} y1={22} x2={26} y2={22} />
                  <line x1={17} y1={27} x2={23} y2={27} />
                </g>
              ) : (
                <text x={20} y={24} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff" fontFamily="Inter, system-ui, sans-serif">
                  {pinName(pins[0])}
                </text>
              )}
              <text x={20} y={36} textAnchor="middle" fontSize={5.5} fontWeight={600} fill={tripped ? '#fff' : '#cbd5e1'}>
                {tripped ? 'TRIPPED' : c.type === 'supply1p' ? '240 V' : c.type === 'supply1n' ? 'NEUTRAL' : 'EARTH'}
              </text>
            </g>
          ) : (
            <g>
              <text x={w / 2} y={15} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#fff" fontFamily="Inter, system-ui, sans-serif">
                {tripped ? (w >= 100 ? 'TRIPPED – click to restore' : 'TRIPPED') : three ? '3~ 415 V 50 Hz' : w <= 60 ? '1~ 240 V' : '1~ 240 V 50 Hz'}
              </text>
              {pins.map((p, i) => (
                <text key={p} x={20 + i * 20} y={32} textAnchor="middle" fontSize={8} fontWeight={700} fill={p === 'PE' ? '#86efac' : p === 'N' ? '#cbd5e1' : '#fde68a'} fontFamily="ui-monospace, monospace">
                  {pinName(p)}
                </text>
              ))}
            </g>
          )}
          <Label x={-6} y={14} text={c.label} anchor="end" />
        </g>
      );
    }
    case 'psu24': {
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={12} />
          <Lead x1={40} y1={0} x2={40} y2={12} />
          <Lead x1={60} y1={0} x2={60} y2={12} />
          <Lead x1={20} y1={68} x2={20} y2={80} />
          <Lead x1={40} y1={68} x2={40} y2={80} />
          <rect x={4} y={12} width={72} height={56} rx={3} fill={BODY} stroke={BODY_STROKE} />
          <text x={40} y={34} textAnchor="middle" fontSize={8} fontWeight={700} fill={INK}>
            AC / DC
          </text>
          <text x={40} y={48} textAnchor="middle" fontSize={10} fontWeight={700} fill={INK}>
            24 V
          </text>
          <g stroke={INK} strokeWidth={1} strokeLinecap="round">
            <line x1={60} y1={12} x2={60} y2={16} />
            <line x1={56} y1={16} x2={64} y2={16} />
            <line x1={57.5} y1={18.5} x2={62.5} y2={18.5} />
            <line x1={59} y1={21} x2={61} y2={21} />
          </g>
          <circle cx={70} cy={60} r={3} fill={run && s.energized ? ON : s.tripped ? RED : '#cbd5e1'} />
          <PinNo x={14} y={9} text="L" />
          <PinNo x={34} y={9} text="N" />
          <PinNo x={54} y={9} text="PE" />
          <PinNo x={14} y={78} text="+24" />
          <PinNo x={34} y={78} text="0V" />
          <Label x={82} y={44} text={c.label} />
        </g>
      );
    }
    case 'busbar': {
      const n = Math.max(2, Math.min(40, Number(c.props.length) || 10));
      const L = n * 20;
      const pot = termPot?.[termKey(c.id, 'p0')];
      const col = run ? (pot ? POT_COLORS[pot] : '#94a3b8') : INK;
      return (
        <g>
          <Selection w={L} h={0} selected={selected} faulted={faulted} />
          <line x1={-4} y1={0} x2={L + 4} y2={0} stroke={col} strokeWidth={5} strokeLinecap="round" />
          {run && pot === 'PE' && <line x1={0} y1={0} x2={L} y2={0} stroke="#facc15" strokeWidth={5} strokeDasharray="8 8" />}
          <Label x={-10} y={4} text={c.props.name || c.label} anchor="end" />
        </g>
      );
    }
    case 'junction': {
      const pot = termPot?.[termKey(c.id, 'p')];
      const col = run ? (pot ? POT_COLORS[pot] : '#94a3b8') : INK;
      return (
        <g>
          <Selection w={0} h={0} selected={selected} faulted={faulted} />
          <circle cx={0} cy={0} r={3.5} fill={col} />
        </g>
      );
    }
    case 'mcb1':
    case 'mcb2':
    case 'mcb3': {
      const poles = c.type === 'mcb3' ? [20, 40, 60] : c.type === 'mcb2' ? [20, 40] : [20];
      const closed = !!s.on && !s.tripped;
      const color = s.tripped ? RED : run && closed ? ON : INK;
      return (
        <g>
          {sel}
          {poles.map((x) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={12} />
              <BreakerBlade x={x} top={12} bottom={44} closed={closed} color={color} />
              <Lead x1={x} y1={44} x2={x} y2={64} />
              <Lead x1={x} y1={76} x2={x} y2={80} />
            </g>
          ))}
          <ReleaseMarks x={poles[0] - 16} y={24} />
          <line x1={poles[0] - 9} y1={30} x2={poles[0] - 1} y2={30} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          {poles.length > 1 && <line x1={poles[0]} y1={28} x2={poles[poles.length - 1]} y2={28} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />}
          <rect x={2} y={64} width={w - 4} height={12} fill={BODY} stroke={BODY_STROKE} strokeWidth={0.8} />
          <text x={w / 2} y={73} textAnchor="middle" fontSize={6.5} fontWeight={700} fill={s.tripped ? RED : INK} fontFamily="ui-monospace, monospace">
            {c.props.curve}
            {c.props.In} {s.tripped ? 'TRIP' : closed ? 'ON' : 'OFF'}
          </text>
          {poles.map((x, i) => (
            <g key={'n' + x}>
              <PinNo x={x - 3} y={9} text={String(1 + i * 2)} />
              <PinNo x={x - 3} y={63} text={String(2 + i * 2)} />
            </g>
          ))}
          <Label x={w + 2} y={44} text={c.label} />
        </g>
      );
    }
    case 'mpcb': {
      const poles = [20, 40, 60];
      const closed = !!s.on && !s.tripped;
      const color = s.tripped ? RED : run && closed ? ON : INK;
      return (
        <g>
          {sel}
          {poles.map((x) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={12} />
              <BreakerBlade x={x} top={12} bottom={44} closed={closed} color={color} />
              <Lead x1={x} y1={44} x2={x} y2={64} />
              <Lead x1={x} y1={76} x2={x} y2={80} />
            </g>
          ))}
          <ReleaseMarks x={4} y={24} />
          <line x1={11} y1={30} x2={19} y2={30} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          <line x1={20} y1={28} x2={60} y2={28} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
          <rect x={2} y={64} width={w - 4} height={12} fill={BODY} stroke={BODY_STROKE} strokeWidth={0.8} />
          <text x={w / 2} y={73} textAnchor="middle" fontSize={6.5} fontWeight={700} fill={s.tripped ? RED : INK} fontFamily="ui-monospace, monospace">
            Ir {c.props.Ir}A {s.tripped ? 'TRIP' : closed ? 'ON' : 'OFF'}
          </text>
          {poles.map((x, i) => (
            <g key={'n' + x}>
              <PinNo x={x - 3} y={9} text={String(1 + i * 2)} />
              <PinNo x={x - 3} y={63} text={String(2 + i * 2)} />
            </g>
          ))}
          <Label x={w + 2} y={44} text={c.label} />
        </g>
      );
    }
    case 'rccb':
    case 'rcbo': {
      const poles = [20, 40];
      const rcbo = c.type === 'rcbo';
      const closed = !!s.on && !s.tripped;
      const color = s.tripped ? RED : run && closed ? ON : INK;
      return (
        <g>
          {sel}
          {poles.map((x) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={12} />
              <BreakerBlade x={x} top={12} bottom={44} closed={closed} color={color} />
              <Lead x1={x} y1={44} x2={x} y2={64} />
              <Lead x1={x} y1={76} x2={x} y2={80} />
            </g>
          ))}
          {rcbo && (
            <g>
              <ReleaseMarks x={4} y={22} />
              <line x1={11} y1={28} x2={19} y2={28} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
            </g>
          )}
          <line x1={20} y1={28} x2={40} y2={28} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
          <ellipse cx={30} cy={56} rx={16} ry={4.5} fill="none" stroke={INK} strokeWidth={1.2} />
          <line x1={30} y1={60} x2={30} y2={64} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          <circle cx={8} cy={56} r={3.2} fill="#fef08a" stroke={INK} strokeWidth={0.8} />
          <text x={8} y={58} textAnchor="middle" fontSize={5} fontWeight={800} fill={INK}>
            T
          </text>
          <rect x={2} y={64} width={w - 4} height={12} fill={BODY} stroke={BODY_STROKE} strokeWidth={0.8} />
          <text x={w / 2} y={73} textAnchor="middle" fontSize={6} fontWeight={700} fill={s.tripped ? RED : INK} fontFamily="ui-monospace, monospace">
            {rcbo ? `${c.props.curve}${c.props.In} ` : ''}
            {c.props.Idn}mA {s.tripped ? 'TRIP' : closed ? 'ON' : 'OFF'}
          </text>
          {poles.map((x, i) => (
            <g key={'n' + x}>
              <PinNo x={x - 3} y={9} text={String(1 + i * 2)} />
              <PinNo x={x - 3} y={63} text={String(2 + i * 2)} />
            </g>
          ))}
          <Label x={w + 2} y={44} text={c.label} />
        </g>
      );
    }
    case 'iso1':
    case 'iso2':
    case 'iso3': {
      const poles = c.type === 'iso3' ? [20, 40, 60] : c.type === 'iso2' ? [20, 40] : [20];
      const on = !!s.on;
      const color = run && on ? ON : INK;
      return (
        <g>
          {sel}
          {poles.map((x) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={12} />
              <BreakerBlade x={x} top={12} bottom={44} closed={on} mark="hook" color={color} />
              <Lead x1={x} y1={44} x2={x} y2={64} />
              <Lead x1={x} y1={76} x2={x} y2={80} />
            </g>
          ))}
          {poles.length > 1 && <line x1={poles[0]} y1={28} x2={poles[poles.length - 1]} y2={28} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />}
          <rect x={2} y={64} width={w - 4} height={12} fill={BODY} stroke={BODY_STROKE} strokeWidth={0.8} />
          <text x={w / 2} y={73} textAnchor="middle" fontSize={6.5} fontWeight={700} fill={on ? ON : INK} fontFamily="ui-monospace, monospace">
            {on ? 'ON' : 'OFF'}
          </text>
          {poles.map((x, i) => (
            <g key={'n' + x}>
              <PinNo x={x - 3} y={9} text={String(1 + i * 2)} />
              <PinNo x={x - 3} y={63} text={String(2 + i * 2)} />
            </g>
          ))}
          <Label x={w + 2} y={44} text={c.label} />
        </g>
      );
    }
    case 'fsw1':
    case 'fsw2':
    case 'fsw3': {
      const poles = c.type === 'fsw3' ? [20, 40, 60] : c.type === 'fsw2' ? [20, 40] : [20];
      const blown = !!s.tripped;
      const on = !!s.on;
      const color = blown ? RED : run && on ? ON : INK;
      return (
        <g>
          {sel}
          {poles.map((x, i) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={12} />
              <BreakerBlade x={x} top={12} bottom={34} closed={on} mark="none" color={color} />
              <rect x={x - 6} y={36} width={12} height={14} rx={1.5} fill="#fff" stroke={blown ? RED : INK} strokeWidth={1.3} />
              {blown ? <path d={`M ${x} 36 L ${x} 41 L ${x + 3} 43 L ${x - 3} 43 L ${x} 45 L ${x} 50`} fill="none" stroke={RED} strokeWidth={1.1} /> : <Lead x1={x} y1={36} x2={x} y2={50} />}
              <Lead x1={x} y1={50} x2={x} y2={64} />
              <Lead x1={x} y1={76} x2={x} y2={80} />
              <PinNo x={x - 3} y={9} text={String(1 + i * 2)} />
              <PinNo x={x - 3} y={63} text={String(2 + i * 2)} />
            </g>
          ))}
          {poles.length > 1 && <line x1={poles[0]} y1={23} x2={poles[poles.length - 1]} y2={23} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />}
          <rect x={2} y={64} width={w - 4} height={12} fill={BODY} stroke={BODY_STROKE} strokeWidth={0.8} />
          <text x={w / 2} y={73} textAnchor="middle" fontSize={6.5} fontWeight={700} fill={blown ? RED : INK} fontFamily="ui-monospace, monospace">
            {c.props.In}A {blown ? 'BLOWN' : on ? 'ON' : 'OFF'}
          </text>
          <Label x={w + 2} y={44} text={c.label} />
        </g>
      );
    }
    case 'cos1': {
      const pos = s.pos || 0;
      const color = run && pos !== 0 ? ON : INK;
      const tip = pos === 1 ? { x: 40, y: 30 } : pos === 2 ? { x: 30, y: 46 } : { x: 30, y: 37 };
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={30} />
          <Lead x1={40} y1={0} x2={40} y2={30} />
          <Lead x1={30} y1={46} x2={30} y2={60} />
          <circle cx={20} cy={30} r={1.4} fill={color} />
          <circle cx={40} cy={30} r={1.4} fill={color} />
          <circle cx={30} cy={46} r={1.4} fill={color} />
          <Lead x1={20} y1={30} x2={tip.x} y2={tip.y} color={color} w={2} />
          <circle cx={20} cy={30} r={1.6} fill={color} />
          <line x1={20} y1={30} x2={12} y2={30} stroke={INK} strokeWidth={1} strokeDasharray="1.5 1.5" />
          <circle cx={6} cy={30} r={5.5} fill="#fff" stroke={INK} strokeWidth={1.2} />
          <line x1={6} y1={30} x2={pos === 1 ? 1.5 : pos === 2 ? 10.5 : 6} y2={pos === 0 ? 25 : 27} stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <PinNo x={17} y={9} text="11" />
          <PinNo x={37} y={9} text="12" />
          <PinNo x={27} y={58} text="14" />
          <Label x={46} y={14} text={c.label} size={8} />
        </g>
      );
    }
    case 'esw1': {
      const on = !!s.on;
      const color = run ? (on ? ON : INK) : INK;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={18} />
          <Lead x1={20} y1={50} x2={20} y2={80} />
          <Lead x1={40} y1={34} x2={40} y2={80} />
          {on ? <Lead x1={20} y1={18} x2={20} y2={50} color={color} w={2} /> : <Lead x1={20} y1={50} x2={29} y2={19} color={color} w={2} />}
          <circle cx={20} cy={50} r={1.6} fill={color} />
          {on ? <Lead x1={20} y1={50} x2={30} y2={60} color={color} w={1.6} /> : <Lead x1={20} y1={50} x2={40} y2={50} color={color} w={2} />}
          <circle cx={40} cy={50} r={1.4} fill={color} />
          <g stroke={INK} strokeWidth={1.1} strokeLinecap="round">
            <line x1={36} y1={60} x2={44} y2={60} />
            <line x1={37.5} y1={63} x2={42.5} y2={63} />
            <line x1={39} y1={66} x2={41} y2={66} />
          </g>
          <PinNo x={17} y={9} text="1" />
          <PinNo x={17} y={78} text="2" />
          <PinNo x={37} y={78} text="PE" />
          <text x={46} y={24} fontSize={6.5} fontWeight={800} fill={on ? ON : RED}>
            {on ? 'ON' : 'EARTH'}
          </text>
          <Label x={62} y={44} text={c.label} />
        </g>
      );
    }
    case 'mccb4': {
      const poles = [12, 38, 64, 90];
      const closed = !!s.on && !s.tripped;
      const color = s.tripped ? RED : run && closed ? ON : INK;
      return (
        <g>
          {sel}
          {poles.map((x) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={14} />
              <BreakerBlade x={x} top={14} bottom={54} closed={closed} color={color} />
              <Lead x1={x} y1={54} x2={x} y2={84} />
              <Lead x1={x} y1={96} x2={x} y2={100} />
              <PinNo x={x - 3} y={11} text={String(1 + poles.indexOf(x) * 2)} />
              <PinNo x={x - 3} y={83} text={String(2 + poles.indexOf(x) * 2)} />
            </g>
          ))}
          <ReleaseMarks x={4} y={34} />
          <line x1={11} y1={40} x2={19} y2={40} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          <line x1={12} y1={32} x2={90} y2={32} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
          <rect x={2} y={84} width={104} height={12} fill={BODY} stroke={BODY_STROKE} strokeWidth={0.8} />
          <text x={54} y={93} textAnchor="middle" fontSize={7} fontWeight={700} fill={s.tripped ? RED : INK} fontFamily="ui-monospace, monospace">
            MCCB 4P {c.props.In}A {s.tripped ? 'TRIP' : closed ? 'ON' : 'OFF'}
          </text>
          <Label x={112} y={54} text={c.label} />
        </g>
      );
    }
    case 'mccb': {
      const poles = [20, 50, 80];
      const closed = !!s.on && !s.tripped;
      const color = s.tripped ? RED : run && closed ? ON : INK;
      return (
        <g>
          {sel}
          {poles.map((x) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={14} />
              <BreakerBlade x={x} top={14} bottom={52} closed={closed} color={color} />
              <Lead x1={x} y1={52} x2={x} y2={84} />
              <Lead x1={x} y1={96} x2={x} y2={100} />
            </g>
          ))}
          <ReleaseMarks x={4} y={30} />
          <line x1={11} y1={36} x2={19} y2={36} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          <line x1={20} y1={33} x2={80} y2={33} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
          <rect x={2} y={84} width={96} height={12} fill={BODY} stroke={BODY_STROKE} strokeWidth={0.8} />
          <text x={50} y={93} textAnchor="middle" fontSize={7} fontWeight={700} fill={s.tripped ? RED : INK} fontFamily="ui-monospace, monospace">
            MCCB {c.props.In}A {s.tripped ? 'TRIP' : closed ? 'ON' : 'OFF'}
          </text>
          {poles.map((x, i) => (
            <g key={'n' + x}>
              <PinNo x={x - 3} y={11} text={String(1 + i * 2)} />
              <PinNo x={x - 3} y={83} text={String(2 + i * 2)} />
            </g>
          ))}
          <Label x={102} y={54} text={c.label} />
        </g>
      );
    }
    case 'fuse2': {
      const blown = !!s.tripped;
      return (
        <g>
          {sel}
          {[20, 40].map((x, i) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={14} />
              <Lead x1={x} y1={46} x2={x} y2={60} />
              <rect x={x - 7} y={14} width={14} height={32} rx={2} fill={blown ? '#fee2e2' : '#fff'} stroke={blown ? RED : INK} strokeWidth={1.4} />
              {blown ? <path d={`M ${x} 14 L ${x} 24 L ${x + 4} 28 L ${x - 4} 32 L ${x} 36 L ${x} 46`} fill="none" stroke={RED} strokeWidth={1.2} /> : <Lead x1={x} y1={14} x2={x} y2={46} />}
              <PinNo x={x - 3} y={9} text={String(1 + i * 2)} />
              <PinNo x={x - 3} y={58} text={String(2 + i * 2)} />
            </g>
          ))}
          <Label x={62} y={34} text={`${c.label} ${c.props.In}A`} size={9} />
        </g>
      );
    }
    case 'fuse3': {
      const blown = !!s.tripped;
      return (
        <g>
          {sel}
          {[20, 40, 60].map((x, i) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={14} />
              <Lead x1={x} y1={46} x2={x} y2={60} />
              <rect x={x - 7} y={14} width={14} height={32} rx={2} fill={blown ? '#fee2e2' : '#fff'} stroke={blown ? RED : INK} strokeWidth={1.4} />
              {blown ? <path d={`M ${x} 14 L ${x} 24 L ${x + 4} 28 L ${x - 4} 32 L ${x} 36 L ${x} 46`} fill="none" stroke={RED} strokeWidth={1.2} /> : <Lead x1={x} y1={14} x2={x} y2={46} />}
              <PinNo x={x - 3} y={9} text={String(1 + i * 2)} />
              <PinNo x={x - 3} y={58} text={String(2 + i * 2)} />
            </g>
          ))}
          <Label x={82} y={34} text={`${c.label} ${c.props.In}A`} size={9} />
        </g>
      );
    }
    case 'rccb4': {
      const poles = [10, 30, 50, 70];
      const closed = !!s.on && !s.tripped;
      const color = s.tripped ? RED : run && closed ? ON : INK;
      return (
        <g>
          {sel}
          {poles.map((x) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={12} />
              <BreakerBlade x={x} top={12} bottom={44} closed={closed} color={color} />
              <Lead x1={x} y1={44} x2={x} y2={64} />
              <Lead x1={x} y1={76} x2={x} y2={80} />
            </g>
          ))}
          <line x1={10} y1={28} x2={70} y2={28} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
          <ellipse cx={40} cy={56} rx={32} ry={4.5} fill="none" stroke={INK} strokeWidth={1.2} />
          <line x1={40} y1={60} x2={40} y2={64} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          <circle cx={75} cy={56} r={3} fill="#fef08a" stroke={INK} strokeWidth={0.8} />
          <text x={75} y={58} textAnchor="middle" fontSize={5} fontWeight={800} fill={INK}>
            T
          </text>
          <rect x={2} y={64} width={w - 4} height={12} fill={BODY} stroke={BODY_STROKE} strokeWidth={0.8} />
          <text x={w / 2} y={73} textAnchor="middle" fontSize={6} fontWeight={700} fill={s.tripped ? RED : INK} fontFamily="ui-monospace, monospace">
            4P {c.props.Idn}mA {s.tripped ? 'TRIP' : closed ? 'ON' : 'OFF'}
          </text>
          {poles.map((x, i) => (
            <g key={'n' + x}>
              <PinNo x={x - 2} y={9} text={String(1 + i * 2)} />
              <PinNo x={x - 2} y={63} text={String(2 + i * 2)} />
            </g>
          ))}
          <Label x={82} y={44} text={c.label} />
        </g>
      );
    }
    case 'fuse': {
      const blown = !!s.tripped;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={14} />
          <Lead x1={20} y1={46} x2={20} y2={60} />
          <rect x={13} y={14} width={14} height={32} rx={2} fill={blown ? '#fee2e2' : '#fff'} stroke={blown ? RED : INK} strokeWidth={1.4} />
          {blown ? <path d="M 20 14 L 20 24 L 24 28 L 16 32 L 20 36 L 20 46" fill="none" stroke={RED} strokeWidth={1.2} /> : <Lead x1={20} y1={14} x2={20} y2={46} />}
          <Label x={30} y={34} text={`${c.label} ${c.props.In}A`} size={9} />
        </g>
      );
    }
    case 'overload': {
      const tripped = !!s.tripped;
      const heat = Math.min(1, s.heat || 0);
      return (
        <g>
          {sel}
          <rect x={4} y={12} width={72} height={56} rx={3} fill={tripped ? '#fee2e2' : BODY} stroke={BODY_STROKE} />
          {[20, 40, 60].map((x, i) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={26} />
              <rect x={x - 4} y={26} width={8} height={14} fill="#fff" stroke={INK} strokeWidth={1.3} />
              <path d={`M ${x - 4} ${33} h 8`} stroke={INK} strokeWidth={1} />
              <Lead x1={x} y1={40} x2={x} y2={80} />
              <PinNo x={x - 5} y={9} text={String(1 + i * 2)} />
              <PinNo x={x - 5} y={78} text={String(2 + i * 2)} />
            </g>
          ))}
          <rect x={10} y={56} width={60} height={5} fill="#fff" stroke="#94a3b8" strokeWidth={0.6} />
          <rect x={10} y={56} width={60 * heat} height={5} fill={heat > 0.8 ? RED : heat > 0.5 ? AMBER : '#22c55e'} />
          <rect x={8} y={44.5} width={64} height={9} fill={tripped ? '#fee2e2' : BODY} />
          <text x={40} y={51.5} textAnchor="middle" fontSize={7} fill={INK} fontWeight={600} fontFamily="ui-monospace, monospace">
            Ir {c.props.Ir}A{run && s.current ? ` · ${s.current.toFixed(1)}A` : ''}
          </text>
          <circle cx={70} cy={18} r={4.5} fill={tripped ? RED : '#3b82f6'} stroke="#fff" strokeWidth={1} className={tripped ? 'fault-flash' : undefined}>
            <title>RESET</title>
          </circle>
          {tripped && (
            <text x={40} y={21} textAnchor="middle" fontSize={7} fontWeight={800} fill={RED}>
              TRIPPED
            </text>
          )}
          <Label x={82} y={44} text={c.label} />
        </g>
      );
    }
    case 'contactor_main1': {
      const closed = !!active;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={28} />
          <ContactGlyph closed={closed} x={20} top={28} bottom={52} run={run} />
          <Lead x1={20} y1={52} x2={20} y2={80} />
          <PinNo x={15} y={9} text="1L1" />
          <PinNo x={15} y={78} text="2T1" />
          <Label x={42} y={44} text={parentLabel || ''} color={parentLabel ? INK : RED} />
          <Tag x={42} y={54} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'contactor_main2': {
      const closed = !!active;
      return (
        <g>
          {sel}
          {[20, 40].map((x, i) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={28} />
              <ContactGlyph closed={closed} x={x} top={28} bottom={52} run={run} />
              <Lead x1={x} y1={52} x2={x} y2={80} />
              <PinNo x={x - 3} y={9} text={['1L1', '3L2'][i]} />
              <PinNo x={x - 3} y={78} text={['2T1', '4T2'][i]} />
            </g>
          ))}
          <line x1={14} y1={40} x2={46} y2={40} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
          <Label x={62} y={44} text={parentLabel || ''} color={parentLabel ? INK : RED} />
          <Tag x={62} y={54} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'contactor_main': {
      const closed = !!active;
      return (
        <g>
          {sel}
          {[20, 40, 60].map((x, i) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={28} />
              <ContactGlyph closed={closed} x={x} top={28} bottom={52} run={run} />
              <Lead x1={x} y1={52} x2={x} y2={80} />
              <PinNo x={x - 3} y={9} text={['1L1', '3L2', '5L3'][i]} />
              <PinNo x={x - 3} y={78} text={['2T1', '4T2', '6T3'][i]} />
            </g>
          ))}
          <line x1={14} y1={40} x2={66} y2={40} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
          <Label x={82} y={44} text={parentLabel || ''} color={parentLabel ? INK : RED} />
          <Tag x={82} y={54} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'contact_no':
    case 'contact_nc':
    case 'ol_no':
    case 'ol_nc':
    case 'ph_no':
    case 'ph_nc':
    case 'timer_no':
    case 'timer_nc':
    case 'timer_star': {
      const nc = c.type.endsWith('nc');
      const closed = nc ? !active : !!active;
      const pins: Record<string, [string, string]> = {
        contact_no: ['13', '14'],
        contact_nc: ['11', '12'],
        ol_no: ['97', '98'],
        ol_nc: ['95', '96'],
        ph_no: ['15', '18'],
        ph_nc: ['15', '16'],
        timer_no: ['15', '18'],
        timer_nc: ['15', '16'],
        timer_star: ['17', '28'],
      };
      const [p1, p2] = pins[c.type];
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={20} />
          <ContactGlyph closed={closed} nc={nc} run={run} timed={timedKind as any} thermal={parentType === 'overload'} />
          <Lead x1={20} y1={40} x2={20} y2={60} />
          <PinNo x={17} y={9} text={p1} />
          <PinNo x={17} y={58} text={p2} />
          <Label x={30} y={34} text={parentLabel || ''} color={parentLabel ? INK : RED} size={9} />
          {c.label && <Label x={30} y={44} text={c.label} size={7} bold={false} color="#64748b" />}
          <Tag x={30} y={53} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'contactor_main4': {
      const closed = !!active;
      return (
        <g>
          {sel}
          {[20, 40, 60, 80].map((x, i) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={28} />
              <ContactGlyph closed={closed} x={x} top={28} bottom={52} run={run} />
              <Lead x1={x} y1={52} x2={x} y2={80} />
              <PinNo x={x - 3} y={9} text={['1L1', '3L2', '5L3', 'N'][i]} />
              <PinNo x={x - 3} y={78} text={['2T1', '4T2', '6T3', 'N'][i]} />
            </g>
          ))}
          <line x1={14} y1={40} x2={86} y2={40} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
          <Label x={102} y={44} text={parentLabel || ''} color={parentLabel ? INK : RED} />
          <Tag x={102} y={54} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'dol_combo': {
      const closed = !!active && !s.tripped;
      const tripped = !!s.tripped;
      return (
        <g>
          {sel}
          {[20, 40, 60].map((x, i) => (
            <g key={x}>
              <Lead x1={x} y1={0} x2={x} y2={26} />
              <ContactGlyph closed={closed} x={x} top={26} bottom={46} run={run} />
              <Lead x1={x} y1={46} x2={x} y2={58} />
              <rect x={x - 4} y={58} width={8} height={12} fill="#fff" stroke={INK} strokeWidth={1.2} />
              <Lead x1={x} y1={70} x2={x} y2={100} />
              <PinNo x={x - 3} y={9} text={['1L1', '3L2', '5L3'][i]} />
              <PinNo x={x - 3} y={98} text={['2T1', '4T2', '6T3'][i]} />
            </g>
          ))}
          <line x1={14} y1={36} x2={66} y2={36} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
          <rect x={71} y={26} width={5} height={24} rx={1} fill={tripped ? RED : '#cbd5e1'} />
          <circle cx={73} cy={16} r={5} fill={tripped ? RED : '#3b82f6'} stroke="#fff" strokeWidth={1} className={tripped ? 'fault-flash' : undefined}>
            <title>RESET</title>
          </circle>
          <rect x={8} y={74} width={64} height={12} fill="#fff" stroke="#94a3b8" strokeWidth={0.6} />
          <text x={40} y={83} textAnchor="middle" fontSize={7} fill={INK} fontWeight={600} fontFamily="ui-monospace, monospace">
            Ir {c.props.Ir}A{run && s.current ? ` · ${s.current.toFixed(1)}A` : ''}
          </text>
          <rect x={8} y={88} width={64} height={4} fill="#fff" stroke="#94a3b8" strokeWidth={0.6} />
          <rect x={8} y={88} width={64 * Math.min(1, s.heat || 0)} height={4} fill={(s.heat || 0) > 0.8 ? RED : (s.heat || 0) > 0.5 ? AMBER : '#22c55e'} />
          <Label x={82} y={54} text={parentLabel || c.label || ''} color={parentLabel ? INK : RED} size={9} />
          <Tag x={82} y={64} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'aux4': {
      const on = !!active;
      const cols: { x: number; nc: boolean; p1: string; p2: string }[] = [
        { x: 20, nc: false, p1: '13', p2: '14' },
        { x: 40, nc: false, p1: '23', p2: '24' },
        { x: 60, nc: true, p1: '11', p2: '12' },
        { x: 80, nc: true, p1: '21', p2: '22' },
      ];
      return (
        <g>
          {sel}
          {cols.map((col) => (
            <g key={col.x}>
              <Lead x1={col.x} y1={0} x2={col.x} y2={20} />
              <ContactGlyph closed={col.nc ? !on : on} nc={col.nc} x={col.x} run={run} />
              <Lead x1={col.x} y1={40} x2={col.x} y2={60} />
              <PinNo x={col.x - 3} y={9} text={col.p1} />
              <PinNo x={col.x - 3} y={58} text={col.p2} />
            </g>
          ))}
          <line x1={14} y1={30} x2={86} y2={30} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
          <Label x={102} y={34} text={parentLabel || ''} color={parentLabel ? INK : RED} size={9} />
          <Tag x={102} y={44} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'floatless': {
      const on = run && !!s.out;
      const wet = run && !!s.energized;
      const ink = '#1f2937';
      const sub = '#6b7280';
      const topCols = [
        { x: 22, probe: 'E1', pin: '3', label: ['HIGH', 'E1'] },
        { x: 50, probe: 'E2', pin: '4', label: ['LOW', 'E2'] },
        { x: 78, probe: 'E3', pin: '1', label: ['REF', 'E3'] },
        { x: 106, probe: 'N', pin: '2', label: ['NEUTRAL', 'N'] },
      ];
      const botCols = [
        { x: 22, name: 'NC', pin: '5', label: ['N/C', 'NC'] },
        { x: 50, name: 'NO', pin: '6', label: ['N/O', 'NO'] },
        { x: 78, name: 'COM', pin: '8', label: ['COM', 'COM'] },
        { x: 106, name: 'L', pin: '7', label: ['LINE', 'L'] },
      ];
      const Screw = ({ x, y }: { x: number; y: number }) => (
        <g>
          <circle cx={x} cy={y} r={6.4} fill="none" stroke={ink} strokeWidth={1.5} />
          <line x1={x - 3.6} y1={y} x2={x + 3.6} y2={y} stroke={ink} strokeWidth={1.4} />
          <line x1={x} y1={y - 3.6} x2={x} y2={y + 3.6} stroke={ink} strokeWidth={1.4} />
        </g>
      );
      return (
        <g>
          {sel}
          <rect x={2} y={4} width={124} height={158} rx={4} fill="#fbf6e6" stroke="#cbbfa4" strokeWidth={1.4} />
          {topCols.map((col) => (
            <g key={'t' + col.pin}>
              <Lead x1={col.x} y1={0} x2={col.x} y2={10} />
              <Screw x={col.x} y={17} />
              <text x={col.x} y={37} textAnchor="middle" fontSize={11} fontWeight={800} fill={ink}>{col.probe}</text>
              <line x1={col.x} y1={42} x2={col.x} y2={47} stroke={ink} strokeWidth={1.6} />
              <text x={col.x} y={58} textAnchor="middle" fontSize={11} fontWeight={800} fill={ink}>{col.pin}</text>
              {col.label.map((ln, i) => (
                <text key={i} x={col.x} y={68 + i * 7} textAnchor="middle" fontSize={4.6} fontWeight={700} fill={sub}>{ln}</text>
              ))}
            </g>
          ))}
          <line x1={6} y1={84} x2={122} y2={84} stroke={ink} strokeWidth={1.3} />
          <text x={64} y={97} textAnchor="middle" fontSize={7.4} fontWeight={800} fill={ink}>FLOATLESS SWITCH — FLS 8-PIN</text>
          <line x1={6} y1={103} x2={122} y2={103} stroke={ink} strokeWidth={1.3} />
          {botCols.map((col) => (
            <g key={'b' + col.pin}>
              {col.label.map((ln, i) => (
                <text key={i} x={col.x} y={112 + i * 6.5} textAnchor="middle" fontSize={4.6} fontWeight={700} fill={sub}>{ln}</text>
              ))}
              <text x={col.x} y={128} textAnchor="middle" fontSize={11} fontWeight={800} fill={ink}>{col.pin}</text>
              <line x1={col.x} y1={131} x2={col.x} y2={136} stroke={ink} strokeWidth={1.6} />
              <text x={col.x} y={146} textAnchor="middle" fontSize={10.5} fontWeight={800} fill={ink}>{col.name}</text>
              <Lead x1={col.x} y1={149} x2={col.x} y2={158} color={ink} />
              <Screw x={col.x} y={164} />
              <Lead x1={col.x} y1={172} x2={col.x} y2={178} />
            </g>
          ))}
          {/* status chips */}
          <circle cx={12} cy={12} r={3.4} fill={wet ? '#22c55e' : on ? '#0ea5e9' : '#cbd5e1'} stroke={ink} strokeWidth={0.8} />
          <Label x={130} y={30} text={c.label} />
          <Tag x={130} y={40} text={TYPE_TAG[c.type]} />
          {run && (
            <text x={130} y={50} fontSize={6} fontWeight={700} fill={on ? '#0284c7' : wet ? '#059669' : '#64748b'}>
              {on ? 'NO / DRAIN' : wet ? 'NC / FILL' : 'DRY'}
            </text>
          )}
        </g>
      );
    }
    case 'tank': {
      const level = Math.max(0, Math.min(1, s.level ?? Number(c.props.level) ?? 0.4));
      const p1 = termPot?.[c.id + ':E1'];
      const p2 = termPot?.[c.id + ':E2'];
      const p3 = termPot?.[c.id + ':E3'];
      const waterY = 26 + (1 - level) * 88;
      const probeY = (d: number) => 30 + d * 86;
      const rows: [string, number, Potential | undefined, boolean][] = [
        ['E1', probeY(0.16), p1, !!p1 && !!p3 && p1 !== p3],
        ['E2', probeY(0.46), p2, !!p2 && !!p3 && p2 !== p3],
        ['E3', probeY(0.78), p3, false],
      ];
      return (
        <g>
          {sel}
          {rows.map(([n, y]) => <Lead key={n} x1={n === 'E1' ? 21 : n === 'E2' ? 42 : 63} y1={0} x2={n === 'E1' ? 21 : n === 'E2' ? 42 : 63} y2={y} />)}
          <rect x={7} y={18} width={70} height={100} rx={4} fill="#f8fafc" stroke={BODY_STROKE} strokeWidth={1.6} />
          <rect x={9} y={waterY} width={66} height={Math.max(0, 116 - waterY)} fill="#38bdf8" opacity={0.55} />
          <path d={`M 9 ${waterY + 2} q 8 -3 17 0 t 17 0 t 17 0 t 17 0`} fill="none" stroke="#e0f2fe" strokeWidth={1.4}>
            <animate attributeName="d" values={`M 9 ${waterY + 2} q 8 -3 17 0 t 17 0 t 17 0 t 17 0;M 9 ${waterY + 2} q 8 3 17 0 t 17 0 t 17 0 t 17 0;M 9 ${waterY + 2} q 8 -3 17 0 t 17 0 t 17 0 t 17 0`} dur="3s" repeatCount="indefinite" />
          </path>
          {rows.map(([n, y, , wetRow], i) => {
            const x = i === 0 ? 21 : i === 1 ? 42 : 63;
            return (
              <g key={'p' + n}>
                <line x1={x} y1={y} x2={x} y2={28} stroke="#64748b" strokeWidth={2.2} strokeLinecap="round" />
                <circle cx={x} cy={y} r={3.2} fill={wetRow ? '#0EA5E9' : '#e2e8f0'} stroke="#475569" strokeWidth={0.9} />
                <text x={x + 4} y={y - 4} fontSize={5.6} fontWeight={700} fill="#475569">{n}</text>
              </g>
            );
          })}
          <rect x={7} y={18} width={70} height={8} rx={2} fill="#e2e8f0" stroke={BODY_STROKE} strokeWidth={0.9} />
          <text x={42} y={112} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">{Math.round(level * 100)}%</text>
          <PinNo x={18} y={9} text="E1" />
          <PinNo x={39} y={9} text="E2" />
          <PinNo x={60} y={9} text="E3" />
          <Label x={84} y={44} text={c.label} />
          <Tag x={84} y={54} text={TYPE_TAG[c.type]} />
          {run && <text x={84} y={64} fontSize={6} fontWeight={700} fill={level >= 0.78 ? '#059669' : level < 0.26 ? '#b91c1c' : '#0284c7'}>{level >= 0.78 ? 'HIGH' : level < 0.26 ? 'E3 DRY' : 'LOW'}</text>}
        </g>
      );
    }
    case 'pmr': {
      const unb = Number(c.props.unbalance) || 10;
      const nom = Number(c.props.nominal) || 415;
      const lit = (pin: string, want: string) => run && termPot?.[c.id + ':' + pin] === want;
      const fault = run && !!s.msg && s.msg !== 'no supply';
      const on = run && !!s.out;
      const unbA = (-60 + ((unb - 5) / 10) * 120) * Math.PI / 180;
      const nomA = (-60 + ((nom - 380) / 40) * 120) * Math.PI / 180;
      return (
        <g>
          {sel}
          <Lead x1={10} y1={0} x2={10} y2={10} />
          <Lead x1={30} y1={0} x2={30} y2={10} />
          <Lead x1={50} y1={0} x2={50} y2={10} />
          <Lead x1={70} y1={0} x2={70} y2={10} />
          <rect x={2} y={10} width={76} height={102} rx={3} fill="#fff" stroke={BODY_STROKE} />
          <text x={40} y={19} textAnchor="middle" fontSize={5.5} fontWeight={700} fill={INK}>
            PHASE MONITORING
          </text>
          <text x={40} y={27} textAnchor="middle" fontSize={6.5} fontWeight={800} fill={INK}>
            RELAY PMR-3P
          </text>
          <circle cx={16} cy={37} r={3} fill={lit('L1', 'L1') ? ON : '#cbd5e1'} stroke={INK} strokeWidth={0.7} />
          <circle cx={32} cy={37} r={3} fill={lit('L2', 'L2') ? ON : '#cbd5e1'} stroke={INK} strokeWidth={0.7} />
          <circle cx={48} cy={37} r={3} fill={lit('L3', 'L3') ? ON : '#cbd5e1'} stroke={INK} strokeWidth={0.7} />
          <circle cx={66} cy={37} r={3} fill={fault ? RED : '#cbd5e1'} stroke={INK} strokeWidth={0.7} className={fault ? 'fault-flash' : undefined} />
          <text x={16} y={45} textAnchor="middle" fontSize={5} fill={INK}>
            L1
          </text>
          <text x={32} y={45} textAnchor="middle" fontSize={5} fill={INK}>
            L2
          </text>
          <text x={48} y={45} textAnchor="middle" fontSize={5} fill={INK}>
            L3
          </text>
          <text x={66} y={45} textAnchor="middle" fontSize={5} fontWeight={700} fill={fault ? RED : INK}>
            FT
          </text>
          <text x={8} y={58} fontSize={4.5} fill={INK}>
            PHASE LOSS
          </text>
          <text x={8} y={64} fontSize={4.5} fill={INK}>
            SEQUENCE
          </text>
          <text x={8} y={70} fontSize={4.5} fill={INK}>
            UNBALANCE
          </text>
          <circle cx={60} cy={62} r={8} fill={BODY} stroke={INK} strokeWidth={1.2} />
          <line x1={60} y1={62} x2={60 + 6 * Math.sin(unbA)} y2={62 - 6 * Math.cos(unbA)} stroke={RED} strokeWidth={1.4} strokeLinecap="round" />
          <text x={60} y={76} textAnchor="middle" fontSize={5.5} fill={INK} fontFamily="ui-monospace, monospace">
            {unb}%
          </text>
          <circle cx={60} cy={88} r={8} fill={BODY} stroke={INK} strokeWidth={1.2} />
          <line x1={60} y1={88} x2={60 + 6 * Math.sin(nomA)} y2={88 - 6 * Math.cos(nomA)} stroke={RED} strokeWidth={1.4} strokeLinecap="round" />
          <text x={60} y={102} textAnchor="middle" fontSize={5.5} fill={INK} fontFamily="ui-monospace, monospace">
            {nom}V
          </text>
          <text x={30} y={110} textAnchor="middle" fontSize={5} fill={INK}>
            RELAY OUTPUT 5A
          </text>
          <Lead x1={20} y1={124} x2={20} y2={140} />
          <Lead x1={40} y1={124} x2={40} y2={140} />
          <Lead x1={60} y1={116} x2={60} y2={140} />
          {on ? <Lead x1={20} y1={124} x2={60} y2={116} color={ON} w={2} /> : <Lead x1={20} y1={124} x2={40} y2={124} color={INK} w={2} />}
          <PinNo x={7} y={8} text="L1" />
          <PinNo x={27} y={8} text="L2" />
          <PinNo x={47} y={8} text="L3" />
          <PinNo x={67} y={8} text="N" />
          <PinNo x={17} y={138} text="11" />
          <PinNo x={37} y={138} text="12" />
          <PinNo x={57} y={138} text="14" />
          <Label x={82} y={58} text={c.label} />
          <Tag x={82} y={68} text={TYPE_TAG[c.type]} />
          {run && s.msg && <Label x={82} y={78} text={s.msg} size={6} color={RED} />}
        </g>
      );
    }
    case 'co':
    case 'timer_co': {
      const p = c.type === 'co' ? ['11', '12', '14'] : ['15', '16', '18'];
      const on = !!active;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={30} />
          <Lead x1={40} y1={0} x2={40} y2={30} />
          <Lead x1={30} y1={46} x2={30} y2={60} />
          <ChangeoverGlyph active={on} run={run} timed={timedKind as any} thermal={parentType === 'overload'} />
          <PinNo x={17} y={9} text={p[0]} />
          <PinNo x={37} y={9} text={p[1]} />
          <PinNo x={27} y={58} text={p[2]} />
          <Label x={46} y={50} text={parentLabel || ''} color={parentLabel ? INK : RED} size={9} />
          <Tag x={46} y={59} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'pb_no':
    case 'pb_nc':
    case 'estop': {
      const nc = c.type !== 'pb_no';
      const actuated = c.type === 'estop' ? !!s.on : !!s.pressed;
      const closed = nc ? !actuated : actuated;
      const color = c.type === 'estop' ? RED : LAMP_COLORS[c.props.color] || '#22c55e';
      const dx = actuated ? 3 : 0;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={20} />
          <ContactGlyph closed={closed} nc={nc} run={run} openRight45={c.type === 'pb_nc'} />
          <Lead x1={20} y1={40} x2={20} y2={60} />
          <line x1={2 + dx} y1={30} x2={18} y2={30} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          {c.type === 'estop' ? (
            <path d={`M ${-2 + dx} 36 L ${-2 + dx} 24 a 8 8 0 0 1 8 0 L ${6 + dx} 36 z`} fill={color} stroke={INK} strokeWidth={0.8} />
          ) : (
            <g>
              <line x1={4 + dx} y1={24} x2={4 + dx} y2={36} stroke={INK} strokeWidth={1.2} />
              <rect x={-3 + dx} y={23} width={6} height={14} rx={1.5} fill={color} stroke={INK} strokeWidth={0.8} />
            </g>
          )}
          <PinNo x={17} y={9} text={nc ? '11' : '13'} />
          <PinNo x={17} y={58} text={nc ? '12' : '14'} />
          <Label x={30} y={34} text={c.label} size={9} />
          <Tag x={30} y={44} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'pb_dual': {
      const pressed = !!s.pressed;
      const color = LAMP_COLORS[c.props.color] || '#22c55e';
      const dx = pressed ? 3 : 0;
      return (
        <g>
          {sel}
          <Lead x1={15} y1={0} x2={15} y2={20} />
          <ContactGlyph closed={pressed} x={15} run={run} />
          <Lead x1={15} y1={40} x2={15} y2={60} />
          <Lead x1={45} y1={0} x2={45} y2={20} />
          <ContactGlyph closed={!pressed} nc x={45} run={run} />
          <Lead x1={45} y1={40} x2={45} y2={60} />
          <line x1={2 + dx} y1={30} x2={13} y2={30} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          <line x1={17} y1={30} x2={43} y2={30} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          <line x1={4 + dx} y1={24} x2={4 + dx} y2={36} stroke={INK} strokeWidth={1.2} />
          <rect x={-3 + dx} y={23} width={6} height={14} rx={1.5} fill={color} stroke={INK} strokeWidth={0.8} />
          <PinNo x={12} y={9} text="13" />
          <PinNo x={12} y={58} text="14" />
          <PinNo x={42} y={9} text="11" />
          <PinNo x={42} y={58} text="12" />
          <Tag x={30} y={12} text={TYPE_TAG[c.type]} anchor="middle" />
          <Label x={30} y={52} text={c.label} size={8} anchor="middle" />
        </g>
      );
    }
    case 'sel3': {
      const pos = s.pos || 0;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={20} />
          <ContactGlyph closed={pos === 1} x={20} run={run} />
          <Lead x1={20} y1={40} x2={20} y2={60} />
          <Lead x1={40} y1={0} x2={40} y2={20} />
          <ContactGlyph closed={pos === 2} x={40} run={run} />
          <Lead x1={40} y1={40} x2={40} y2={60} />
          <line x1={24} y1={30} x2={36} y2={30} stroke={INK} strokeWidth={1} strokeDasharray="1.5 1.5" />
          <circle cx={30} cy={30} r={5.5} fill="#fff" stroke={INK} strokeWidth={1.2} />
          <line x1={30} y1={30} x2={pos === 1 ? 25.5 : pos === 2 ? 34.5 : 30} y2={pos === 0 ? 25 : 25.5} stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <PinNo x={17} y={9} text="13" />
          <PinNo x={37} y={9} text="23" />
          <PinNo x={17} y={58} text="14" />
          <PinNo x={37} y={58} text="24" />
          <Label x={62} y={34} text={c.label} size={8} />
        </g>
      );
    }
    case 'ntc': {
      const t = run ? (s.temp ?? Number(c.props.temp) ?? 26) : Number(c.props.temp) ?? 26;
      const hot = t > 30;
      const cold = t < 20;
      return (
        <g>
          {sel}
          {/* red conductor (P) */}
          <path d="M 14 0 C 14 10, 14 20, 14 30" fill="none" stroke="#b91c1c" strokeWidth={2.2} strokeLinecap="round" />
          {/* white conductor (N) */}
          <path d="M 34 0 C 34 10, 34 20, 34 30" fill="none" stroke="#e5e7eb" strokeWidth={2.2} strokeLinecap="round" />
          <path d="M 34 26 L 34 30" stroke="#9ca3af" strokeWidth={2.2} />
          {/* cable gland + probe stem */}
          <rect x={10} y={30} width={28} height={7} rx={2} fill="#9ca3af" stroke="#4b5563" strokeWidth={0.9} />
          <path d="M 12 32 h 24 M 12 35 h 24" stroke="#6b7280" strokeWidth={0.6} />
          <rect x={17} y={37} width={14} height={3} rx={1} fill="#6b7280" />
          <defs>
            <linearGradient id={`ntc-${c.id}`} x1="0" x2="1">
              <stop offset="0" stopColor="#f8fafc" />
              <stop offset="0.45" stopColor="#cbd5e1" />
              <stop offset="0.7" stopColor="#e5e7eb" />
              <stop offset="1" stopColor="#94a3b8" />
            </linearGradient>
          </defs>
          <rect x={15} y={40} width={18} height={22} rx={9} fill={`url(#ntc-${c.id})`} stroke="#64748b" strokeWidth={1} />
          <path d="M 24 42 L 24 60" stroke="#f1f5f9" strokeWidth={1.4} opacity={0.8} />
          <circle cx={24} cy={58} r={4.4} fill={hot ? '#ef4444' : cold ? '#3b82f6' : '#eab308'} opacity={run ? 0.55 : 0.25} />
          <circle cx={24} cy={58} r={2.2} fill={hot ? '#dc2626' : cold ? '#2563eb' : '#f59e0b'} />
          {/* bottom terminal block: P ⊕ | N ⊕ side by side */}
          <rect x={4} y={64} width={40} height={14} rx={2} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={0.9} />
          {[{ x: 14, label: 'P', wire: '#b91c1c' }, { x: 34, label: 'N', wire: '#e5e7eb' }].map((p2) => (
            <g key={p2.label}>
              <circle cx={p2.x} cy={71} r={4.6} fill="#9ca3af" stroke="#374151" strokeWidth={0.9} />
              <circle cx={p2.x} cy={71} r={2} fill={p2.wire} stroke="#374151" strokeWidth={0.5} />
              <line x1={p2.x - 2.6} y1={71} x2={p2.x + 2.6} y2={71} stroke="#374151" strokeWidth={0.8} />
              <text x={p2.x} y={80} textAnchor="middle" fontSize={5} fontWeight={800} fill="#334155">{p2.label}</text>
            </g>
          ))}
          <text x={44} y={48} fontSize={7.5} fontWeight={800} fill="#0f172a">{t.toFixed(1)}°C</text>
          <text x={44} y={56} fontSize={5.2} fill="#475569">NTC {c.props.rated ?? 10}k</text>
          <text x={44} y={64} fontSize={5} fontWeight={700} fill="#b91c1c">RED</text>
          <text x={44} y={71} fontSize={5} fontWeight={700} fill="#64748b">WHITE</text>
          <Label x={-4} y={78} text={c.label} anchor="start" size={9} />
        </g>
      );
    }
    case 'resistor':
    case 'varistor': {
      const varistor = c.type === 'varistor';
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={14} y2={20} />
          <Lead x1={46} y1={20} x2={60} y2={20} />
          <path d="M 14 20 h 4 l 3 -8 l 5 16 l 5 -16 l 5 16 l 5 -16 l 3 8 h 2" fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          {varistor && <line x1={12} y1={30} x2={48} y2={10} stroke={RED} strokeWidth={1.2} />}
          <Tag x={20} y={36} text={TYPE_TAG[c.type]} />
          <Label x={54} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'capacitor': {
      const polar = !!c.props.polar;
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={24} y2={20} />
          <Lead x1={36} y1={20} x2={60} y2={20} />
          <line x1={24} y1={8} x2={24} y2={32} stroke={INK} strokeWidth={2} />
          {polar ? <path d="M 36 8 a 12 12 0 0 1 0 24" fill="none" stroke={INK} strokeWidth={2} /> : <line x1={36} y1={8} x2={36} y2={32} stroke={INK} strokeWidth={2} />}
          {polar && <text x={17} y={13} fontSize={7} fill={INK}>+</text>}
          <Tag x={20} y={40} text={TYPE_TAG[c.type]} />
          <Label x={44} y={13} text={c.label} size={8} />
        </g>
      );
    }
    case 'inductor': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={14} y2={20} />
          <Lead x1={46} y1={20} x2={60} y2={20} />
          <path d="M 14 20 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0" fill="none" stroke={INK} strokeWidth={1.6} />
          <Tag x={20} y={36} text={TYPE_TAG[c.type]} />
          <Label x={52} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'diode':
    case 'led': {
      const isLed = c.type === 'led';
      const col = LAMP_COLORS[c.props.color] || '#22c55e';
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={22} y2={20} />
          <Lead x1={38} y1={20} x2={60} y2={20} />
          <path d="M 22 10 L 38 20 L 22 30 Z" fill={isLed ? col : '#fff'} stroke={INK} strokeWidth={1.5} />
          <line x1={38} y1={10} x2={38} y2={30} stroke={INK} strokeWidth={2} />
          {isLed && (
            <g stroke={col} strokeWidth={1.2} fill="none" className="lamp-glow">
              <path d="M 40 12 l 5 -5 M 42 17 l 6 -2" />
            </g>
          )}
          <text x={14} y={16} fontSize={6} fill={INK}>A</text>
          <text x={42} y={16} fontSize={6} fill={INK}>K</text>
          <Tag x={22} y={38} text={TYPE_TAG[c.type]} />
          <Label x={52} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'lamp_neon': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={16} y2={20} />
          <Lead x1={44} y1={20} x2={60} y2={20} />
          <circle cx={30} cy={20} r={12} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <line x1={22} y1={12} x2={38} y2={28} stroke={INK} strokeWidth={1.2} />
          <line x1={38} y1={12} x2={22} y2={28} stroke={INK} strokeWidth={1.2} />
          <Tag x={24} y={40} text={TYPE_TAG[c.type]} />
          <Label x={46} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'npn':
    case 'pnp':
    case 'bjt': {
      const pnp = c.type === 'pnp';
      return (
        <g>
          {sel}
          <Lead x1={0} y1={35} x2={20} y2={35} />
          <circle cx={35} cy={35} r={17} fill="none" stroke={INK} strokeWidth={1.3} />
          <line x1={20} y1={35} x2={32} y2={35} stroke={INK} strokeWidth={2} />
          <line x1={32} y1={26} x2={32} y2={44} stroke={INK} strokeWidth={2.4} />
          <line x1={32} y1={29} x2={46} y2={18} stroke={INK} strokeWidth={1.6} />
          <line x1={32} y1={41} x2={46} y2={52} stroke={INK} strokeWidth={1.6} />
          <line x1={46} y1={18} x2={46} y2={0} stroke={INK} strokeWidth={1.6} />
          <line x1={46} y1={52} x2={46} y2={70} stroke={INK} strokeWidth={1.6} />
          {pnp ? <path d="M 32 33 L 38 35 L 32 37 Z" fill={INK} /> : <path d="M 38 30 L 38 44 L 32 37 Z" fill={INK} />}
          <text x={12} y={30} fontSize={6} fill={INK}>B</text>
          <text x={50} y={10} fontSize={6} fill={INK}>{pnp ? 'E' : 'C'}</text>
          <text x={50} y={68} fontSize={6} fill={INK}>{pnp ? 'C' : 'E'}</text>
          <Tag x={54} y={38} text={TYPE_TAG[c.type]} />
          <Label x={58} y={28} text={c.label} size={8} />
        </g>
      );
    }
    case 'scr': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={35} x2={20} y2={35} />
          <path d="M 22 20 L 44 35 L 22 50 Z" fill="#fff" stroke={INK} strokeWidth={1.5} />
          <line x1={44} y1={20} x2={44} y2={50} stroke={INK} strokeWidth={2} />
          <line x1={44} y1={20} x2={44} y2={0} stroke={INK} strokeWidth={1.6} />
          <line x1={44} y1={50} x2={44} y2={70} stroke={INK} strokeWidth={1.6} />
          <line x1={20} y1={35} x2={30} y2={52} stroke={INK} strokeWidth={1.4} />
          <path d="M 26 44 L 34 50 L 28 54" fill="none" stroke={INK} strokeWidth={1.2} />
          <text x={12} y={30} fontSize={6} fill={INK}>G</text>
          <text x={48} y={12} fontSize={6} fill={INK}>A</text>
          <text x={48} y={68} fontSize={6} fill={INK}>K</text>
          <Tag x={56} y={38} text={TYPE_TAG[c.type]} />
          <Label x={58} y={28} text={c.label} size={8} />
        </g>
      );
    }
    case 'ic555': {
      return (
        <g>
          {sel}
          <rect x={14} y={10} width={52} height={70} rx={2} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <path d="M 34 6 a 8 8 0 0 1 12 0" fill="none" stroke={INK} strokeWidth={1.2} />
          <text x={40} y={50} textAnchor="middle" fontSize={9} fontWeight={700} fill={INK}>555</text>
          <text x={40} y={70} textAnchor="middle" fontSize={5} fill="#64748b">TIMER</text>
          <Tag x={70} y={52} text={TYPE_TAG[c.type]} />
          <Label x={70} y={40} text={c.label} size={8} />
        </g>
      );
    }
    case 'optocoupler': {
      return (
        <g>
          {sel}
          <rect x={20} y={12} width={40} height={46} rx={2} fill="#fff" stroke={INK} strokeWidth={1.3} />
          <line x1={30} y1={20} x2={50} y2={50} stroke={INK} strokeWidth={1} opacity={0.25} />
          <text x={40} y={40} textAnchor="middle" fontSize={7} fill={INK}>⇄</text>
          <Tag x={64} y={42} text={TYPE_TAG[c.type]} />
          <Label x={64} y={30} text={c.label} size={8} />
        </g>
      );
    }
    case 'bridge': {
      return (
        <g>
          {sel}
          <path d="M 20 20 L 35 35 L 20 50 L 35 35 L 50 20 M 35 35 L 50 50" fill="none" stroke={INK} strokeWidth={1.4} />
          <path d="M 32 32 L 38 38 M 38 32 L 32 38" stroke={INK} strokeWidth={1.2} />
          <text x={18} y={16} fontSize={6} fill={INK}>~</text>
          <text x={46} y={16} fontSize={6} fill={INK}>+</text>
          <text x={46} y={58} fontSize={6} fill={INK}>−</text>
          <Tag x={54} y={36} text={TYPE_TAG[c.type]} />
          <Label x={58} y={24} text={c.label} size={8} />
        </g>
      );
    }
    case 'regulator': {
      return (
        <g>
          {sel}
          <rect x={18} y={26} width={24} height={18} rx={2} fill="#fff" stroke={INK} strokeWidth={1.3} />
          <line x1={0} y1={35} x2={18} y2={35} stroke={INK} strokeWidth={1.5} />
          <line x1={42} y1={35} x2={60} y2={35} stroke={INK} strokeWidth={1.5} />
          <line x1={30} y1={44} x2={30} y2={70} stroke={INK} strokeWidth={1.5} />
          <text x={12} y={31} fontSize={5.5} fill={INK}>IN</text>
          <text x={46} y={31} fontSize={5.5} fill={INK}>OUT</text>
          <text x={30} y={54} textAnchor="middle" fontSize={7} fontWeight={700} fill={INK}>{c.props.V ?? 12}V</text>
          <Tag x={48} y={58} text={TYPE_TAG[c.type]} />
          <Label x={48} y={22} text={c.label} size={8} />
        </g>
      );
    }
    case 'buzzer_piezo': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={30} x2={20} y2={30} />
          <Lead x1={40} y1={30} x2={60} y2={30} />
          <circle cx={30} cy={30} r={10} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <path d="M 24 30 h 12 M 30 24 v 12" stroke={INK} strokeWidth={1.1} />
          <Tag x={22} y={50} text={TYPE_TAG[c.type]} />
          <Label x={44} y={22} text={c.label} size={8} />
        </g>
      );
    }
    case 'res_fixed':
    case 'res_net':
    case 'fuse_glass':
    case 'fuse_blade':
    case 'fuse_ptc':
    case 'saw': {
      const fuse = c.type.startsWith('fuse');
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={60} y2={20} />
          {fuse ? (
            <g>
              <rect x={18} y={13} width={24} height={14} rx={2} fill="#fff" stroke={INK} strokeWidth={1.4} />
              <line x1={18} y1={20} x2={42} y2={20} stroke={INK} strokeWidth={1.2} />
              {c.type === 'fuse_ptc' && <path d="M 26 14 L 34 26" stroke={RED} strokeWidth={1.2} />}
            </g>
          ) : (
            <path d="M 14 20 h 4 l 3 -8 l 5 16 l 5 -16 l 5 16 l 5 -16 l 3 8 h 2" fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          )}
          <Tag x={20} y={36} text={TYPE_TAG[c.type]} />
          <Label x={48} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'ldr':
    case 'thermistor':
    case 'varistor': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={20} y2={20} />
          <rect x={20} y={12} width={20} height={16} rx={1.5} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <line x1={40} y1={20} x2={60} y2={20} stroke={INK} strokeWidth={1.6} />
          {c.type === 'ldr' ? (
            <g stroke={INK} strokeWidth={1} fill="none">
              <path d="M 16 10 L 10 4 M 20 8 L 16 1 M 24 8 L 22 1" />
              <path d="M 26 14 l 8 12 M 30 12 l 8 12" strokeWidth={1.2} />
            </g>
          ) : c.type === 'thermistor' ? (
            <path d="M 22 30 l 6 -20 M 26 30 l 6 -20" stroke={INK} strokeWidth={1.3} />
          ) : (
            <g>
              <line x1={20} y1={20} x2={40} y2={20} stroke={INK} strokeWidth={1.4} />
              <path d="M 18 30 L 42 10" stroke={RED} strokeWidth={1.2} />
            </g>
          )}
          <Tag x={22} y={38} text={TYPE_TAG[c.type]} />
          <Label x={48} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'pot':
    case 'cap_var':
    case 'var_inductor': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={20} y2={20} />
          <Lead x1={40} y1={20} x2={60} y2={20} />
          {c.type === 'pot' ? (
            <path d="M 20 20 h 3 l 2 -7 l 4 14 l 4 -14 l 4 14 l 3 -7 h 1" fill="none" stroke={INK} strokeWidth={1.5} />
          ) : (
            <line x1={30} y1={8} x2={30} y2={32} stroke={INK} strokeWidth={2} />
          )}
          <line x1={30} y1={20} x2={30} y2={2} stroke={INK} strokeWidth={1.4} />
          <path d="M 26 6 L 30 0 L 34 6" fill="none" stroke={INK} strokeWidth={1.4} />
          <Tag x={22} y={42} text={TYPE_TAG[c.type]} />
          <Label x={50} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'cap_elec':
    case 'supercap': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={24} y2={20} />
          <Lead x1={36} y1={20} x2={60} y2={20} />
          <line x1={24} y1={8} x2={24} y2={32} stroke={INK} strokeWidth={2} />
          <path d="M 36 8 a 12 12 0 0 1 0 24" fill="none" stroke={INK} strokeWidth={2} />
          <text x={15} y={13} fontSize={8} fill={RED}>+</text>
          <Tag x={22} y={40} text={TYPE_TAG[c.type]} />
          <Label x={46} y={12} text={c.label} size={8} />
        </g>
      );
    }
    case 'cap_ceramic':
    case 'cap_film':
    case 'cap_mica': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={24} y2={20} />
          <Lead x1={36} y1={20} x2={60} y2={20} />
          <line x1={24} y1={9} x2={24} y2={31} stroke={INK} strokeWidth={2} />
          <line x1={36} y1={9} x2={36} y2={31} stroke={INK} strokeWidth={2} />
          <text x={30} y={12} textAnchor="middle" fontSize={5} fill={INK}>{c.type === 'cap_ceramic' ? 'K' : c.type === 'cap_film' ? 'F' : 'M'}</text>
          <Tag x={22} y={40} text={TYPE_TAG[c.type]} />
          <Label x={46} y={12} text={c.label} size={8} />
        </g>
      );
    }
    case 'choke':
    case 'toroid':
    case 'air_core': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={14} y2={20} />
          <Lead x1={46} y1={20} x2={60} y2={20} />
          {c.type === 'toroid' ? (
            <g>
              <ellipse cx={30} cy={20} rx={20} ry={13} fill="none" stroke={INK} strokeWidth={1.5} />
              <ellipse cx={30} cy={20} rx={10} ry={5} fill="none" stroke={INK} strokeWidth={1.2} />
            </g>
          ) : c.type === 'choke' ? (
            <g>
              <path d="M 14 20 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0" fill="none" stroke={INK} strokeWidth={1.6} />
              <line x1={16} y1={28} x2={44} y2={28} stroke={INK} strokeWidth={1.3} />
            </g>
          ) : (
            <g>
              <path d="M 14 20 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0" fill="none" stroke={INK} strokeWidth={1.6} />
              <line x1={30} y1={12} x2={30} y2={28} stroke={INK} strokeWidth={0.9} strokeDasharray="2 2" />
            </g>
          )}
          <Tag x={22} y={42} text={TYPE_TAG[c.type]} />
          <Label x={50} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'transformer':
    case 'transformer_iso':
    case 'autotransformer':
    case 'ct':
    case 'pt': {
      return (
        <g>
          {sel}
          <Lead x1={15} y1={0} x2={15} y2={14} />
          <Lead x1={35} y1={0} x2={35} y2={14} />
          <Lead x1={15} y1={46} x2={15} y2={60} />
          <Lead x1={35} y1={46} x2={35} y2={60} />
          <path d="M 12 16 a 4 4 0 0 1 0 8 a 4 4 0 0 1 0 8 a 4 4 0 0 1 0 8" fill="none" stroke={INK} strokeWidth={1.5} />
          <path d="M 38 16 a 4 4 0 0 0 0 8 a 4 4 0 0 0 0 8 a 4 4 0 0 0 0 8" fill="none" stroke={INK} strokeWidth={1.5} />
          {c.type === 'transformer' && <line x1={25} y1={16} x2={25} y2={40} stroke={INK} strokeWidth={1.2} />}
          <Tag x={46} y={32} text={TYPE_TAG[c.type]} />
          <Label x={46} y={20} text={c.label} size={8} />
        </g>
      );
    }
    case 'crystal': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={22} y2={20} />
          <Lead x1={38} y1={20} x2={60} y2={20} />
          <rect x={22} y={12} width={16} height={16} rx={2} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <line x1={18} y1={10} x2={18} y2={30} stroke={INK} strokeWidth={2} />
          <line x1={42} y1={10} x2={42} y2={30} stroke={INK} strokeWidth={2} />
          <Tag x={22} y={40} text={TYPE_TAG[c.type]} />
          <Label x={46} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'diode_rect':
    case 'photodiode':
    case 'varactor':
    case 'tvs':
    case 'tunnel': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={22} y2={20} />
          <Lead x1={38} y1={20} x2={60} y2={20} />
          <path d="M 22 10 L 38 20 L 22 30 Z" fill="#fff" stroke={INK} strokeWidth={1.5} />
          <line x1={38} y1={10} x2={38} y2={30} stroke={INK} strokeWidth={2} />
          {c.type === 'photodiode' && <path d="M 14 8 l -6 -6 M 20 6 l -2 -7" stroke={INK} strokeWidth={1} />}
          {c.type === 'varactor' && <path d="M 38 10 v 6 M 42 10 v 6" stroke={INK} strokeWidth={1.1} />}
          {c.type === 'tvs' && <path d="M 38 10 l 4 -6 M 38 30 l 4 6" stroke={INK} strokeWidth={1.1} />}
          {c.type === 'tunnel' && <path d="M 24 30 l 6 -14" stroke={INK} strokeWidth={1.1} />}
          <Tag x={22} y={38} text={TYPE_TAG[c.type]} />
          <Label x={46} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'diode_zener':
    case 'diode_schottky': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={22} y2={20} />
          <Lead x1={38} y1={20} x2={60} y2={20} />
          <path d="M 22 10 L 38 20 L 22 30 Z" fill="#fff" stroke={INK} strokeWidth={1.5} />
          <path d={c.type === 'diode_zener' ? 'M 34 10 h 4 v 6 M 38 30 v -6 h 4' : 'M 34 10 h 4 v 6 M 38 30 v 6 h 4'} fill="none" stroke={INK} strokeWidth={2} />
          <Tag x={20} y={38} text={TYPE_TAG[c.type]} />
          <Label x={46} y={10} text={c.label} size={8} />
        </g>
      );
    }
    case 'bridge': {
      return (
        <g>
          {sel}
          <Lead x1={15} y1={60} x2={15} y2={44} />
          <Lead x1={30} y1={60} x2={30} y2={44} />
          <Lead x1={45} y1={60} x2={45} y2={44} />
          <Lead x1={45} y1={0} x2={45} y2={16} />
          <path d="M 15 16 L 30 30 L 15 44 Z M 45 16 L 30 30 L 45 44 Z" fill="#fff" stroke={INK} strokeWidth={1.4} />
          <Tag x={54} y={36} text={TYPE_TAG[c.type]} />
          <Label x={54} y={24} text={c.label} size={8} />
        </g>
      );
    }
    case 'jfet':
    case 'mosfet': {
      const mos = c.type === 'mosfet';
      return (
        <g>
          {sel}
          <Lead x1={0} y1={35} x2={20} y2={35} />
          <circle cx={35} cy={35} r={17} fill="none" stroke={INK} strokeWidth={1.3} />
          <line x1={20} y1={35} x2={30} y2={35} stroke={INK} strokeWidth={1.6} />
          <line x1={30} y1={24} x2={30} y2={46} stroke={INK} strokeWidth={2.2} />
          {mos ? (
            <g stroke={INK} strokeWidth={1.6} fill="none">
              <line x1={38} y1={24} x2={38} y2={46} />
              <line x1={38} y1={28} x2={46} y2={28} />
              <line x1={38} y1={42} x2={46} y2={42} />
              <line x1={46} y1={0} x2={46} y2={28} />
              <line x1={46} y1={42} x2={46} y2={70} />
            </g>
          ) : (
            <g stroke={INK} strokeWidth={1.6} fill="none">
              <line x1={32} y1={29} x2={46} y2={18} />
              <line x1={32} y1={41} x2={46} y2={52} />
              <line x1={46} y1={18} x2={46} y2={0} />
              <line x1={46} y1={52} x2={46} y2={70} />
              <line x1={32} y1={35} x2={30} y2={35} />
            </g>
          )}
          <text x={12} y={30} fontSize={6} fill={INK}>G</text>
          <text x={50} y={10} fontSize={6} fill={INK}>D</text>
          <text x={50} y={68} fontSize={6} fill={INK}>S</text>
          <Tag x={54} y={38} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'igbt':
    case 'darlington':
    case 'phototransistor': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={35} x2={20} y2={35} />
          <circle cx={35} cy={35} r={17} fill="none" stroke={INK} strokeWidth={1.3} />
          <line x1={20} y1={35} x2={32} y2={35} stroke={INK} strokeWidth={1.8} />
          <line x1={32} y1={26} x2={32} y2={44} stroke={INK} strokeWidth={2.4} />
          <line x1={32} y1={29} x2={46} y2={18} stroke={INK} strokeWidth={1.6} />
          <line x1={32} y1={41} x2={46} y2={52} stroke={INK} strokeWidth={1.6} />
          <line x1={46} y1={18} x2={46} y2={0} stroke={INK} strokeWidth={1.6} />
          <line x1={46} y1={52} x2={46} y2={70} stroke={INK} strokeWidth={1.6} />
          <path d="M 38 30 L 38 44 L 32 37 Z" fill={INK} />
          {c.type === 'phototransistor' && <path d="M 10 12 l -6 -6 M 16 10 l -2 -7" stroke={INK} strokeWidth={1} />}
          {c.type === 'igbt' && <line x1={32} y1={35} x2={28} y2={35} stroke={INK} strokeWidth={1.2} />}
          <text x={12} y={30} fontSize={6} fill={INK}>B/G</text>
          <text x={50} y={10} fontSize={6} fill={INK}>C</text>
          <text x={50} y={68} fontSize={6} fill={INK}>E</text>
          <Tag x={54} y={40} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'triac':
    case 'diac':
    case 'gto':
    case 'scr_ic': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={35} x2={18} y2={35} />
          <path d="M 22 15 L 44 35 L 22 55 Z" fill="#fff" stroke={INK} strokeWidth={1.5} />
          <line x1={44} y1={15} x2={44} y2={55} stroke={INK} strokeWidth={2} />
          <line x1={44} y1={15} x2={44} y2={0} stroke={INK} strokeWidth={1.5} />
          <line x1={44} y1={55} x2={44} y2={70} stroke={INK} strokeWidth={1.5} />
          {c.type === 'triac' ? (
            <g>
              <path d="M 26 15 L 44 35 L 26 55" fill="none" stroke={INK} strokeWidth={1.3} />
              <line x1={18} y1={35} x2={26} y2={35} stroke={INK} strokeWidth={1.3} />
            </g>
          ) : c.type === 'diac' ? (
            <path d="M 22 15 L 42 35 L 22 55" fill="none" stroke={INK} strokeWidth={1.3} />
          ) : (
            <g>
              <line x1={18} y1={35} x2={30} y2={52} stroke={INK} strokeWidth={1.3} />
              <path d="M 26 44 L 34 50 L 28 54" fill="none" stroke={INK} strokeWidth={1.2} />
            </g>
          )}
          <text x={10} y={30} fontSize={6} fill={INK}>{c.type === 'scr_ic' ? 'G' : 'G'}</text>
          <Tag x={54} y={38} text={TYPE_TAG[c.type]} />
          <Label x={56} y={26} text={c.label} size={8} />
        </g>
      );
    }
    case 'opamp':
    case 'comparator': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={18} x2={20} y2={18} />
          <Lead x1={0} y1={52} x2={20} y2={52} />
          <Lead x1={60} y1={35} x2={80} y2={35} />
          <path d="M 20 8 L 20 62 L 60 35 Z" fill="#fff" stroke={INK} strokeWidth={1.5} />
          <text x={26} y={22} fontSize={7} fill={INK}>−</text>
          <text x={26} y={56} fontSize={7} fill={INK}>+</text>
          <text x={42} y={38} fontSize={6} fill={INK}>{c.type === 'comparator' ? 'CMP' : 'A'}</text>
          <Tag x={60} y={54} text={TYPE_TAG[c.type]} />
          <Label x={62} y={22} text={c.label} size={8} />
        </g>
      );
    }
    case 'logic':
    case 'flipflop':
    case 'shiftreg':
    case 'counter':
    case 'pll':
    case 'transceiver':
    case 'motor_driver':
    case 'uln':
    case 'eeprom':
    case 'sram':
    case 'dram':
    case 'flash':
    case 'mcu':
    case 'mpu':
    case 'dsp':
    case 'fpga': {
      const label = { logic: '&', flipflop: 'FF', shiftreg: 'SR', counter: 'CTR', pll: 'PLL', transceiver: 'TX', motor_driver: 'DRV', uln: 'ULN', eeprom: 'EEPROM', sram: 'SRAM', dram: 'DRAM', flash: 'FLASH', mcu: 'MCU', mpu: 'CPU', dsp: 'DSP', fpga: 'FPGA' }[c.type] || 'IC';
      const ic = { logic: '74xx', flipflop: '7474', shiftreg: '74HC595', counter: '74HC160', pll: 'CD4046', transceiver: 'MAX485', motor_driver: 'L298N', uln: 'ULN2003', eeprom: '24C02', sram: '62256', dram: '4164', flash: 'W25Q', mcu: 'ATmega', mpu: 'CPU', dsp: 'DSP', fpga: 'FPGA' }[c.type] || '';
      const pins = getPins(c);
      const left = pins.filter((p) => p.x === 0).sort((x, y) => x.y - y.y);
      const right = pins.filter((p) => p.x > 0).sort((x, y) => x.y - y.y);
      return (
        <g>
          {sel}
          {/* DIP body */}
          <rect x={26} y={12} width={40} height={86} rx={2} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <path d="M 40 12 a 6 6 0 0 1 12 0" fill="none" stroke={INK} strokeWidth={1.1} />
          <circle cx={31} cy={18} r={1.4} fill={INK} />
          {/* pins + numbers */}
          {left.map((p, i) => (
            <g key={p.id}>
              <line x1={0} y1={p.y} x2={26} y2={p.y} stroke={INK} strokeWidth={1.5} />
              <text x={28} y={p.y - 2} fontSize={4.5} fill="#64748b">{i + 1}</text>
              <text x={4} y={p.y - 2} fontSize={4.5} fill="#94a3b8">{p.id.slice(0, 4)}</text>
            </g>
          ))}
          {right.map((p, i) => (
            <g key={p.id}>
              <line x1={66} y1={p.y} x2={90} y2={p.y} stroke={INK} strokeWidth={1.5} />
              <text x={64} y={p.y - 2} textAnchor="end" fontSize={4.5} fill="#64748b">{14 - i}</text>
              <text x={88} y={p.y - 2} textAnchor="end" fontSize={4.5} fill="#94a3b8">{p.id.slice(0, 4)}</text>
            </g>
          ))}
          <text x={46} y={48} textAnchor="middle" fontSize={9} fontWeight={800} fill={INK}>{label}</text>
          <text x={46} y={60} textAnchor="middle" fontSize={4.6} fill="#64748b">{ic}</text>
          <Tag x={94} y={38} text={TYPE_TAG[c.type]} />
          <Label x={94} y={28} text={c.label} size={8} />
        </g>
      );
    }
    case 'opamp':
    case 'comparator':
    case 'reg_linear':
    case 'reg_smps': {
      const isReg = c.type.startsWith('reg');
      return (
        <g>
          {sel}
          {isReg ? (
            <g>
              <rect x={30} y={26} width={32} height={44} rx={2} fill="#fff" stroke={INK} strokeWidth={1.4} />
              <text x={46} y={48} textAnchor="middle" fontSize={7} fontWeight={700} fill={INK}>{c.type === 'reg_linear' ? '78xx' : 'LM2596'}</text>
              <text x={46} y={58} textAnchor="middle" fontSize={5.5} fill="#64748b">{c.props.V ?? 12}V</text>
            </g>
          ) : (
            <g>
              <path d="M 24 8 L 24 74 L 70 41 Z" fill="#fff" stroke={INK} strokeWidth={1.5} />
              <text x={30} y={26} fontSize={7} fill={INK}>−</text>
              <text x={30} y={62} fontSize={7} fill={INK}>+</text>
              <text x={46} y={44} fontSize={6} fill={INK}>{c.type === 'comparator' ? 'CMP' : 'A'}</text>
            </g>
          )}
          {getPins(c).map((p) => (
            <g key={p.id}>
              {p.x === 0 ? <line x1={0} y1={p.y} x2={isReg ? 30 : 24} y2={p.y} stroke={INK} strokeWidth={1.5} /> : <line x1={isReg ? 62 : 70} y1={p.y} x2={92} y2={p.y} stroke={INK} strokeWidth={1.5} />}
              <text x={p.x === 0 ? 4 : 88} y={p.y - 2} textAnchor={p.x === 0 ? 'start' : 'end'} fontSize={4.6} fill="#64748b">{p.id}</text>
            </g>
          ))}
          <Tag x={94} y={38} text={TYPE_TAG[c.type]} />
          <Label x={94} y={28} text={c.label} size={8} />
        </g>
      );
    }
    case 'optocoupler_ic':
    case 'triac_coupler': {
      return (
        <g>
          {sel}
          <rect x={30} y={20} width={32} height={52} rx={2} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <path d="M 42 20 a 6 6 0 0 1 12 0" fill="none" stroke={INK} strokeWidth={1} />
          <path d="M 40 34 l 12 10 M 52 34 l -12 10" stroke={INK} strokeWidth={1.1} />
          <text x={46} y={56} textAnchor="middle" fontSize={5.5} fill="#64748b">OPTO</text>
          {getPins(c).map((p) => (
            <g key={p.id}>
              {p.x === 0 ? <line x1={0} y1={p.y} x2={30} y2={p.y} stroke={INK} strokeWidth={1.5} /> : <line x1={62} y1={p.y} x2={92} y2={p.y} stroke={INK} strokeWidth={1.5} />}
              <text x={p.x === 0 ? 4 : 88} y={p.y - 2} textAnchor={p.x === 0 ? 'start' : 'end'} fontSize={4.6} fill="#64748b">{p.id}</text>
            </g>
          ))}
          <Tag x={94} y={38} text={TYPE_TAG[c.type]} />
          <Label x={94} y={28} text={c.label} size={8} />
        </g>
      );
    }
    case 'switch_push':
    case 'switch_toggle':
    case 'switch_dip':
    case 'switch_rotary':
    case 'switch_micro':
    case 'reed': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={20} y2={20} />
          <Lead x1={40} y1={20} x2={60} y2={20} />
          <circle cx={20} cy={20} r={2} fill={INK} />
          <circle cx={40} cy={20} r={2} fill={INK} />
          <line x1={20} y1={20} x2={40} y2={8} stroke={INK} strokeWidth={1.6} />
          <line x1={30} y1={4} x2={30} y2={14} stroke={INK} strokeWidth={1.2} />
          <line x1={24} y1={4} x2={36} y2={4} stroke={INK} strokeWidth={1.2} />
          {c.type === 'reed' && <path d="M 12 30 l 5 -5 M 44 30 l -5 -5" stroke={INK} strokeWidth={1.1} />}
          <Tag x={20} y={38} text={TYPE_TAG[c.type]} />
          <Label x={46} y={12} text={c.label} size={8} />
        </g>
      );
    }
    case 'relay_emr':
    case 'relay_latch': {
      return (
        <g>
          {sel}
          <rect x={8} y={22} width={20} height={18} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <Lead x1={18} y1={0} x2={18} y2={22} />
          <Lead x1={18} y1={40} x2={18} y2={56} />
          <line x1={32} y1={40} x2={50} y2={40} stroke={INK} strokeWidth={1.4} strokeDasharray="2 2" />
          <circle cx={40} cy={58} r={2} fill={INK} />
          <circle cx={54} cy={44} r={2} fill={INK} />
          <line x1={40} y1={58} x2={52} y2={44} stroke={INK} strokeWidth={1.5} />
          <circle cx={64} cy={58} r={2} fill={INK} />
          <Lead x1={40} y1={58} x2={40} y2={70} />
          <Lead x1={54} y1={44} x2={54} y2={26} />
          <Lead x1={64} y1={58} x2={64} y2={70} />
          <Tag x={68} y={34} text={TYPE_TAG[c.type]} />
          <Label x={68} y={22} text={c.label} size={8} />
        </g>
      );
    }
    case 'dc_motor':
    case 'bldc':
    case 'stepper':
    case 'servo':
    case 'solenoid': {
      return (
        <g>
          {sel}
          <Lead x1={15} y1={0} x2={15} y2={18} />
          <Lead x1={45} y1={0} x2={45} y2={18} />
          {getPins(c).filter((p) => p.y > 40).map((p) => (
            <line key={'d' + p.id} x1={p.x} y1={40} x2={p.x} y2={p.y} stroke={INK} strokeWidth={1.5} />
          ))}
          {c.type === 'solenoid' ? (
            <g>
              <rect x={12} y={22} width={36} height={28} rx={2} fill="#fff" stroke={INK} strokeWidth={1.3} />
              <path d="M 16 28 h 28 M 16 34 h 28 M 16 40 h 28" stroke={INK} strokeWidth={1} />
              <line x1={30} y1={22} x2={30} y2={14} stroke={INK} strokeWidth={2} />
            </g>
          ) : (
            <g>
              <circle cx={30} cy={40} r={18} fill="#fff" stroke={INK} strokeWidth={1.5} />
              <text x={30} y={47} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>M</text>
              <text x={30} y={56} textAnchor="middle" fontSize={5} fill={INK}>{c.type === 'bldc' ? 'BLDC' : c.type === 'stepper' ? 'STP' : c.type === 'servo' ? 'SRV' : 'DC'}</text>
            </g>
          )}
          <Tag x={54} y={42} text={TYPE_TAG[c.type]} />
          <Label x={54} y={30} text={c.label} size={8} />
        </g>
      );
    }
    case 'terminal_block':
    case 'header':
    case 'power_jack':
    case 'usb_port':
    case 'audio_jack':
    case 'ic_socket': {
      return (
        <g>
          {sel}
          <rect x={8} y={14} width={44} height={24} rx={2} fill="#fff" stroke={INK} strokeWidth={1.4} />
          {[16, 25, 34, 43].map((x) => (
            <g key={x}>
              <circle cx={x} cy={22} r={2.6} fill="none" stroke={INK} strokeWidth={1.1} />
              <line x1={x} y1={30} x2={x} y2={44} stroke={INK} strokeWidth={1.2} />
            </g>
          ))}
          <Tag x={54} y={24} text={TYPE_TAG[c.type]} />
          <Label x={54} y={12} text={c.label} size={8} />
        </g>
      );
    }
    case 'buzzer_active':
    case 'speaker':
    case 'microphone':
    case 'cooling_fan': {
      return (
        <g>
          {sel}
          <Lead x1={0} y1={20} x2={30} y2={20} />
          <Lead x1={30} y1={20} x2={60} y2={20} />
          <path d="M 24 12 L 24 28 L 10 36 L 10 4 Z" fill="#fff" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
          {c.type === 'microphone' ? (
            <path d="M 28 8 a 10 10 0 0 1 0 24" fill="none" stroke={INK} strokeWidth={1.2} />
          ) : (
            <g fill="none" stroke={INK} strokeWidth={1.2}>
              <path d="M 30 10 a 10 10 0 0 1 0 20" />
              <path d="M 36 6 a 16 16 0 0 1 0 28" />
            </g>
          )}
          <Tag x={23} y={46} text={TYPE_TAG[c.type]} />
          <Label x={44} y={44} text={c.label} size={8} />
        </g>
      );
    }
    case 'rotary_encoder':
    case 'strain_gauge':
    case 'heatsink': {
      return (
        <g>
          {sel}
          <rect x={12} y={12} width={36} height={26} rx={3} fill="#fff" stroke={INK} strokeWidth={1.4} />
          {c.type === 'heatsink' ? (
            <g stroke={INK} strokeWidth={1.2}>
              {[18, 24, 30, 36, 42].map((x) => <line key={x} x1={x} y1={14} x2={x} y2={36} />)}
            </g>
          ) : c.type === 'strain_gauge' ? (
            <path d="M 16 30 L 24 18 L 32 30 L 40 18" fill="none" stroke={INK} strokeWidth={1.2} />
          ) : (
            <g>
              <circle cx={30} cy={25} r={9} fill="none" stroke={INK} strokeWidth={1.2} />
              <path d="M 30 16 v 18 M 21 25 h 18" stroke={INK} strokeWidth={1} />
            </g>
          )}
          <Tag x={52} y={28} text={TYPE_TAG[c.type]} />
          <Label x={52} y={16} text={c.label} size={8} />
        </g>
      );
    }
    case 'stc3008': {
      const temp = run ? (s.temp ?? Number(c.props.temp) ?? 26) : Number(c.props.temp) || 26;
      const set = Number(c.props.startTemp) || 26;
      const relay = run && !!s.out;
      const inLive = run && !!termPot?.[c.id + ':5'];
      const body = '#475569';
      const cap = '#334155';
      // ⊕1 L · ⊕2 N · ⊕3 ⊕4 SENSOR · ⊕5 IN · ⊕6 OUT
      const ports = [
        { n: '1', x: 14 },
        { n: '2', x: 30 },
        { n: '3', x: 50 },
        { n: '4', x: 66 },
        { n: '5', x: 88 },
        { n: '6', x: 104 },
      ];
      const labelRow: { text: string; x1: number; x2: number }[] = [
        { text: 'L', x1: 14, x2: 14 },
        { text: 'N', x1: 30, x2: 30 },
        { text: 'SENSOR', x1: 50, x2: 66 },
        { text: 'IN', x1: 88, x2: 88 },
        { text: 'OUT', x1: 104, x2: 104 },
      ];
      return (
        <g>
          {sel}
          {/* terminal strip */}
          <rect x={4} y={0} width={112} height={13} rx={2} fill={cap} stroke="#1f2937" strokeWidth={1.1} />
          <text x={0} y={9} fontSize={5} fill="#475569" textAnchor="end">⊕</text>
          {ports.map((p) => {
            const live = (p.n === '1' || p.n === '5') && run;
            return (
              <g key={p.n}>
                <circle cx={p.x} cy={6.5} r={4} fill={p.n === '6' && relay && inLive ? '#22c55e' : p.n === '6' ? '#f59e0b' : p.n === '5' && inLive ? '#22c55e' : '#9ca3af'} stroke="#111827" strokeWidth={0.9} />
                <line x1={p.x - 2.4} y1={6.5} x2={p.x + 2.4} y2={6.5} stroke="#1f2937" strokeWidth={0.9} />
                <line x1={p.x} y1={4.1} x2={p.x} y2={8.9} stroke="#1f2937" strokeWidth={0.9} />
                <text x={p.x} y={-2} textAnchor="middle" fontSize={6.5} fontWeight={800} fill="#0f172a">{p.n}</text>
                {live && <circle cx={p.x} cy={6.5} r={5.6} fill="none" stroke="#22c55e" strokeWidth={0.5} opacity={0.7} />}
              </g>
            );
          })}
          {labelRow.map((l) => {
            const mid = (l.x1 + l.x2) / 2;
            return (
              <g key={l.text}>
                <line x1={mid} y1={14} x2={mid} y2={19} stroke="#94a3b8" strokeWidth={0.7} />
                <text x={mid} y={25} textAnchor="middle" fontSize={5} fontWeight={800} fill="#334155">{l.text}</text>
              </g>
            );
          })}
          {/* body */}
          <rect x={2} y={28} width={116} height={80} rx={3} fill={body} stroke="#1f2937" strokeWidth={1.2} />
          <rect x={6} y={32} width={108} height={72} rx={2} fill="none" stroke="#64748b" strokeWidth={0.6} />
          {/* OUT led + PV display */}
          <text x={26} y={41} textAnchor="middle" fontSize={5.4} fontWeight={700} fill="#e5e7eb">OUT</text>
          <circle cx={26} cy={46} r={3} fill={relay ? '#ef4444' : '#7f1d1d'} stroke="#111827" strokeWidth={0.6} />
          <text x={72} y={41} textAnchor="middle" fontSize={5} fontWeight={700} fill="#e5e7eb">SET {set}°C</text>
          <rect x={10} y={50} width={54} height={26} rx={2} fill="#0b1220" stroke="#1f2937" strokeWidth={0.8} />
          <text x={37} y={69} textAnchor="middle" fontSize={18} fontWeight={700} fill={relay ? '#fca5a5' : '#ef4444'} fontFamily="ui-monospace, monospace">
            {Number.isFinite(temp) ? temp.toFixed(1) : '---'}
          </text>
          <text x={66} y={55} fontSize={6} fontWeight={700} fill="#e5e7eb">°C</text>
          <rect x={70} y={50} width={38} height={26} rx={2} fill="#0b1220" stroke="#1f2937" strokeWidth={0.8} />
          <text x={89} y={69} textAnchor="middle" fontSize={15} fontWeight={700} fill="#60a5fa" fontFamily="ui-monospace, monospace">
            {set.toFixed(0)}
          </text>
          <text x={108} y={55} fontSize={5} fontWeight={700} fill="#e5e7eb">°C</text>
          <text x={110} y={86} textAnchor="end" fontSize={6.5} fontWeight={800} fill="#e5e7eb">STC-3008</text>
          <rect x={9} y={74} width={68} height={11} rx={2} fill={relay ? (inLive ? '#16a34a' : '#b45309') : '#1f2937'} stroke={relay ? (inLive ? '#22c55e' : '#f59e0b') : '#475569'} strokeWidth={0.7} />
          <text x={43} y={81.5} textAnchor="middle" fontSize={5.2} fontWeight={800} fill={relay || inLive ? '#ffffff' : '#e2e8f0'}>
            {relay ? (inLive ? '5-6 NC · OUT 6' : '5-6 NC · 5 NO PWR') : '5-6 NO'}
          </text>
          <Label x={122} y={40} text={c.label} />
          <Tag x={122} y={50} text={TYPE_TAG[c.type]} />
          {run && <text x={122} y={60} fontSize={6} fontWeight={700} fill={relay ? '#0284c7' : '#64748b'}>{temp.toFixed(1)}°C</text>}
        </g>
      );
    }
    case 'sens_limit':
    case 'sens_float':
    case 'sens_pressure':
    case 'sens_temp':
    case 'sens_photo':
    case 'sens_prox':
    case 'sens_reed':
    case 'sens_flow':
    case 'sens_vibration': {
      const kind = (c.props.kind as string) || 'limit';
      const on = !!s.on;
      const nc = c.props.contact === 'NC';
      const closed = nc ? !on : on;
      const letter = kind === 'float' ? 'F' : kind === 'pressure' ? 'P' : kind === 'thermostat' ? 'θ' : kind === 'limit' ? 'L' : kind === 'flow' ? 'Q' : kind === 'vibration' ? 'V' : '';
      const actuator = () => {
        if (kind === 'photo')
          return (
            <g>
              <circle cx={3} cy={30} r={6.5} fill={on ? '#fef9c3' : '#fff'} stroke={INK} strokeWidth={1.2} />
              <circle cx={3} cy={30} r={2} fill={on ? '#eab308' : '#fff'} stroke={INK} strokeWidth={1} />
              <path d="M 3 21 v -2 M 3 39 v 2 M -6 30 h -2 M 12 30 h 2 M -3.4 23.6 l -1.4 -1.4 M 9.4 36.4 l 1.4 1.4 M -3.4 36.4 l -1.4 1.4 M 9.4 23.6 l 1.4 -1.4" stroke={INK} strokeWidth={0.9} />
            </g>
          );
        if (kind === 'prox')
          return (
            <g>
              <circle cx={3} cy={30} r={6.5} fill={on ? '#fef9c3' : '#fff'} stroke={INK} strokeWidth={1.2} />
              <rect x={-1.5} y={27} width={5} height={6} fill={on ? '#eab308' : '#fff'} stroke={INK} strokeWidth={1} />
              <path d="M 5.5 27.5 a 4 4 0 0 1 0 5" fill="none" stroke={INK} strokeWidth={0.9} />
              <path d="M 7.5 26 a 7 7 0 0 1 0 8" fill="none" stroke={INK} strokeWidth={0.9} />
            </g>
          );
        if (kind === 'reed')
          return (
            <g>
              <rect x={-3} y={22} width={13} height={16} rx={2} fill={on ? '#dbeafe' : '#fff'} stroke={INK} strokeWidth={1.2} />
              <line x1={-1} y1={27} x2={8} y2={27} stroke={INK} strokeWidth={0.9} />
              <line x1={-1} y1={33} x2={8} y2={33} stroke={INK} strokeWidth={0.9} />
              <text x={-9} y={33} fontSize={7} fill={INK} textAnchor="end">N</text>
              <text x={-9} y={24} fontSize={7} fill={INK} textAnchor="end">S</text>
            </g>
          );
        if (kind === 'flow')
          return (
            <g>
              <circle cx={3} cy={30} r={6.5} fill={on ? '#cffafe' : '#fff'} stroke={INK} strokeWidth={1.2} />
              <path d="M -2 30 h 10 M 4 26 l 4 4 l -4 4" fill="none" stroke={INK} strokeWidth={1.1} />
            </g>
          );
        if (kind === 'vibration')
          return (
            <g>
              <circle cx={3} cy={30} r={6.5} fill={on ? '#fee2e2' : '#fff'} stroke={INK} strokeWidth={1.2} />
              <path d="M -3 30 q 2 -5 4 0 t 4 0 t 4 0" fill="none" stroke={INK} strokeWidth={1.1} />
            </g>
          );
        return (
          <g>
            <circle cx={3} cy={30} r={6.5} fill={on ? '#dbeafe' : '#fff'} stroke={INK} strokeWidth={1.2} />
            <text x={3} y={33} textAnchor="middle" fontSize={8} fontWeight={700} fill={INK}>{letter}</text>
          </g>
        );
      };
      return (
        <g>
          {sel}
          <Lead x1={30} y1={0} x2={30} y2={20} />
          <ContactGlyph closed={closed} nc={nc} x={30} run={run} />
          <Lead x1={30} y1={40} x2={30} y2={60} />
          <line x1={8} y1={30} x2={28} y2={30} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          {actuator()}
          <PinNo x={27} y={9} text="1" />
          <PinNo x={27} y={58} text="2" />
          <Label x={42} y={34} text={c.label} size={9} />
          <Tag x={42} y={44} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'switch': {
      const on = !!s.on;
      const isCO = c.props.contact === 'CO';
      const nc = c.props.contact === 'NC';
      const closed = nc ? !on : on;
      const kind = c.props.kind as string;
      const letter = kind === 'float' ? 'F' : kind === 'pressure' ? 'P' : kind === 'thermostat' ? 'θ' : kind === 'limit' ? 'L' : '';
      const actuator = (
        <g>
          <line x1={8} y1={30} x2={isCO ? 18 : 28} y2={30} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          {kind === 'selector' ? (
            <g transform={`translate(3 30) rotate(${on ? 45 : -45})`}>
              <circle cx={0} cy={0} r={6} fill="#fff" stroke={INK} strokeWidth={1.2} />
              <line x1={0} y1={-6} x2={0} y2={6} stroke={INK} strokeWidth={2} />
            </g>
          ) : kind === 'key' ? (
            <g>
              <circle cx={3} cy={30} r={6.5} fill={on ? '#dbeafe' : '#fff'} stroke={INK} strokeWidth={1.2} />
              <circle cx={1} cy={28} r={2} fill="none" stroke={INK} strokeWidth={1.1} />
              <line x1={3} y1={28} x2={3} y2={34.5} stroke={INK} strokeWidth={1.1} />
              <line x1={3} y1={31} x2={5.5} y2={31} stroke={INK} strokeWidth={1} />
              <line x1={3} y1={33.5} x2={5.5} y2={33.5} stroke={INK} strokeWidth={1} />
            </g>
          ) : kind === 'prox' ? (
            <g>
              <circle cx={3} cy={30} r={6.5} fill={on ? '#fef9c3' : '#fff'} stroke={INK} strokeWidth={1.2} />
              <rect x={-1.5} y={27} width={5} height={6} fill={on ? '#eab308' : '#fff'} stroke={INK} strokeWidth={1} />
              <path d="M 5.5 27.5 a 4 4 0 0 1 0 5" fill="none" stroke={INK} strokeWidth={0.9} />
              <path d="M 7.5 26 a 7 7 0 0 1 0 8" fill="none" stroke={INK} strokeWidth={0.9} />
            </g>
          ) : kind === 'photo' ? (
            <g>
              <circle cx={3} cy={30} r={6.5} fill={on ? '#fef9c3' : '#fff'} stroke={INK} strokeWidth={1.2} />
              <circle cx={3} cy={30} r={2} fill={on ? '#eab308' : '#fff'} stroke={INK} strokeWidth={1} />
              <path d="M 3 21 v -2 M 3 39 v 2 M -6 30 h -2 M 12 30 h 2 M -3.4 23.6 l -1.4 -1.4 M 9.4 36.4 l 1.4 1.4 M -3.4 36.4 l -1.4 1.4 M 9.4 23.6 l 1.4 -1.4" stroke={INK} strokeWidth={0.9} />
            </g>
          ) : (
            <g>
              <circle cx={3} cy={30} r={6.5} fill={on ? '#dbeafe' : '#fff'} stroke={INK} strokeWidth={1.2} />
              <text x={3} y={33} textAnchor="middle" fontSize={8} fontWeight={700} fill={INK}>
                {letter}
              </text>
            </g>
          )}
        </g>
      );
      if (isCO)
        return (
          <g>
            {sel}
            <Lead x1={20} y1={0} x2={20} y2={30} />
            <Lead x1={40} y1={0} x2={40} y2={30} />
            <Lead x1={30} y1={46} x2={30} y2={60} />
            <ChangeoverGlyph active={on} run={run} />
            {actuator}
            <PinNo x={17} y={9} text="11" />
            <PinNo x={37} y={9} text="12" />
            <PinNo x={27} y={58} text="14" />
            <Label x={46} y={50} text={c.label} size={8} />
            <Tag x={46} y={59} text={KIND_TAG[kind] || 'SW'} />
          </g>
        );
      return (
        <g>
          {sel}
          <Lead x1={30} y1={0} x2={30} y2={20} />
          <ContactGlyph closed={closed} nc={nc} x={30} run={run} />
          <Lead x1={30} y1={40} x2={30} y2={60} />
          {actuator}
          <PinNo x={27} y={9} text="1" />
          <PinNo x={27} y={58} text="2" />
          <Label x={40} y={34} text={c.label} size={9} />
          <Tag x={40} y={44} text={KIND_TAG[kind] || 'SW'} />
        </g>
      );
    }
    case 'relay': {
      const e = !!s.energized;
      const burnt = !!s.burnt;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={20} />
          <Lead x1={20} y1={40} x2={20} y2={60} />
          <rect x={10} y={20} width={20} height={20} fill={burnt ? '#1e293b' : run && e ? ON : '#fff'} stroke={burnt ? RED : INK} strokeWidth={1.5} />
          <line x1={10} y1={40} x2={30} y2={20} stroke={run && e ? '#fff' : INK} strokeWidth={1} />
          {burnt && <path d="M 12 22 L 28 38 M 28 22 L 12 38" stroke={RED} strokeWidth={1.2} />}
          <PinNo x={17} y={9} text="A1" />
          <PinNo x={17} y={58} text="A2" />
          <Tag x={34} y={9} text={TYPE_TAG[c.type]} />
          <Label x={34} y={34} text={c.label} />
          {run && s.msg === 'undervoltage' && <Label x={34} y={44} text={`${s.volt} V!`} size={7} color={AMBER} />}
          <text x={34} y={53} fontSize={6.5} fill="#64748b">
            {c.props.V} V
          </text>
        </g>
      );
    }
    case 'coil': {
      const e = !!s.energized;
      const burnt = !!s.burnt;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={20} />
          <Lead x1={20} y1={40} x2={20} y2={60} />
          <rect x={10} y={20} width={20} height={20} fill={burnt ? '#1e293b' : run && e ? ON : '#fff'} stroke={burnt ? RED : INK} strokeWidth={1.5} />
          <line x1={10} y1={40} x2={30} y2={20} stroke={run && e ? '#fff' : INK} strokeWidth={1} />
          {burnt && <path d="M 12 22 L 28 38 M 28 22 L 12 38" stroke={RED} strokeWidth={1.2} />}
          <PinNo x={17} y={9} text="A1" />
          <PinNo x={17} y={58} text="A2" />
          <Tag x={34} y={9} text={TYPE_TAG[c.type]} />
          <Label x={34} y={34} text={c.label} />
          {run && s.msg === 'undervoltage' && <Label x={34} y={44} text={`${s.volt} V!`} size={7} color={AMBER} />}
          <text x={34} y={53} fontSize={6.5} fill="#64748b">
            {c.props.V} V
          </text>
        </g>
      );
    }
    case 'timer':
    case 'ton':
    case 'tof':
    case 'tsd':
    case 'tp':
    case 'rto':
    case 'tcy': {
      const e = !!s.energized;
      const delay = Number(c.props.delay) || 5;
      const mode = c.props.mode;
      const glyph = mode === 'on' ? 'ON-DELAY' : mode === 'off' ? 'OFF-DELAY' : mode === 'pulse' ? 'ONE-SHOT' : mode === 'rto' ? 'RETENTIVE' : mode === 'cyclic' ? 'CYCLIC' : mode === 'sd' ? 'STAR-DELTA' : 'FLASHER';
      const delay2 = Math.max(0.1, Number(c.props.delay2) || delay);
      const gapS = (Number(c.props.gap) || 60) / 1000;
      const rem = mode === 'off' ? (s.out && !e ? delay - (s.t || 0) : delay) : mode === 'rto' ? (s.t || 0) : mode === 'cyclic' ? Math.max(0, (s.out ? delay : delay2) - (s.t || 0)) : mode === 'sd' ? Math.max(0, delay + gapS - (s.t || 0)) : mode === 'pulse' ? (s.out ? Math.max(0, delay - (s.t || 0)) : delay) : Math.max(0, delay - (s.t || 0));
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={20} />
          <Lead x1={20} y1={40} x2={20} y2={60} />
          <rect x={10} y={20} width={20} height={20} fill={s.burnt ? '#1e293b' : run && e ? ON : '#fff'} stroke={INK} strokeWidth={1.5} />
          <text x={20} y={34} textAnchor="middle" fontSize={9} fill={run && e ? '#fff' : INK} fontWeight={700}>
            {mode === 'on' ? 'T' : mode === 'off' ? 'T̄' : mode === 'pulse' ? 'P' : mode === 'rto' ? 'R' : mode === 'cyclic' ? 'C' : mode === 'sd' ? 'YΔ' : 'F'}
          </text>
          <rect x={33} y={20} width={30} height={20} rx={2} fill={run && s.out ? '#fef3c7' : '#fff'} stroke={BODY_STROKE} strokeWidth={0.8} />
          <text x={48} y={33} textAnchor="middle" fontSize={8} fill={INK} fontFamily="ui-monospace, monospace" fontWeight={600}>
            {run ? `${rem.toFixed(1)}s` : `${delay}s`}
          </text>
          <text x={48} y={16} textAnchor="middle" fontSize={5.5} fontWeight={700} fill="#64748b">
            {glyph}
          </text>
          <PinNo x={17} y={9} text="A1" />
          <PinNo x={17} y={58} text="A2" />
          <Label x={66} y={34} text={c.label} />
          <Tag x={66} y={44} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'lamp': {
      const col = LAMP_COLORS[c.props.color] || '#22c55e';
      const on = run && !!s.energized;
      const burnt = !!s.burnt;
      const br = on ? Math.min(1.3, ((s.volt || 0) / (Number(c.props.V) || 230)) ** 2) : 0;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={20} />
          <Lead x1={20} y1={40} x2={20} y2={60} />
          {on && <circle cx={20} cy={30} r={16} fill={col} opacity={0.35 * br} className="lamp-glow" />}
          <circle cx={20} cy={30} r={10} fill={burnt ? '#475569' : on ? col : `${col}33`} stroke={burnt ? RED : INK} strokeWidth={1.4} />
          <path d="M 13 23 L 27 37 M 27 23 L 13 37" stroke={burnt ? '#94a3b8' : INK} strokeWidth={1.1} />
          {burnt && <path d="M 16 26 L 22 30 L 17 34" stroke={RED} strokeWidth={1} fill="none" />}
          <PinNo x={17} y={9} text="X1" />
          <PinNo x={17} y={58} text="X2" />
          <Label x={34} y={34} text={c.label} />
          <Tag x={34} y={52} text={TYPE_TAG[c.type]} />
          <text x={34} y={43} fontSize={6.5} fill="#64748b">
            {c.props.V} V
          </text>
        </g>
      );
    }
    case 'buzzer': {
      const on = run && !!s.energized;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={22} />
          <Lead x1={20} y1={38} x2={20} y2={60} />
          <path d="M 8 38 L 32 38 L 32 32 A 12 12 0 0 0 8 32 Z" fill={on ? AMBER : '#fff'} stroke={INK} strokeWidth={1.4} />
          {on && (
            <g className="lamp-glow">
              <path d="M 36 24 a 8 8 0 0 1 0 12" fill="none" stroke={AMBER} strokeWidth={1.5} />
              <path d="M 40 20 a 13 13 0 0 1 0 20" fill="none" stroke={AMBER} strokeWidth={1.5} />
            </g>
          )}
          <PinNo x={17} y={9} text="X1" />
          <PinNo x={17} y={58} text="X2" />
          <Label x={34} y={50} text={c.label} />
          <Tag x={34} y={59} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'phr_coil': {
      const lit = (pin: string, want: string) => run && termPot?.[c.id + ':' + pin] === want;
      const on = run && !!s.out;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={12} />
          <Lead x1={40} y1={0} x2={40} y2={12} />
          <Lead x1={60} y1={0} x2={60} y2={12} />
          <rect x={8} y={12} width={64} height={20} rx={3} fill={BODY} stroke={BODY_STROKE} />
          <circle cx={20} cy={22} r={3} fill={lit('L1', 'L1') ? ON : '#cbd5e1'} stroke={INK} strokeWidth={0.7} />
          <circle cx={40} cy={22} r={3} fill={lit('L2', 'L2') ? ON : '#cbd5e1'} stroke={INK} strokeWidth={0.7} />
          <circle cx={60} cy={22} r={3} fill={lit('L3', 'L3') ? ON : '#cbd5e1'} stroke={INK} strokeWidth={0.7} />
          <line x1={40} y1={32} x2={40} y2={36} stroke={INK} strokeWidth={1} strokeDasharray="2 1.5" />
          <rect x={15} y={36} width={50} height={24} fill={s.burnt ? '#1e293b' : on ? ON : '#fff'} stroke={INK} strokeWidth={1.5} />
          <line x1={15} y1={60} x2={65} y2={36} stroke={on ? '#fff' : INK} strokeWidth={1} />
          <Lead x1={20} y1={60} x2={20} y2={80} />
          <Lead x1={40} y1={60} x2={40} y2={80} />
          <PinNo x={17} y={9} text="L1" />
          <PinNo x={37} y={9} text="L2" />
          <PinNo x={57} y={9} text="L3" />
          <PinNo x={17} y={78} text="A1" />
          <PinNo x={37} y={78} text="A2" />
          <Tag x={82} y={30} text={TYPE_TAG[c.type]} />
          <Label x={82} y={44} text={c.label} />
          {run && s.msg && <Label x={82} y={54} text={s.msg} size={6.5} color={RED} />}
        </g>
      );
    }
    case 'ph1mon': {
      const ok = run && !!s.out;
      const lit = run && (s.volt || 0) >= 180;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={12} />
          <Lead x1={40} y1={0} x2={40} y2={12} />
          <rect x={4} y={12} width={52} height={36} rx={3} fill={BODY} stroke={BODY_STROKE} />
          <Tag x={30} y={19} text={TYPE_TAG[c.type]} anchor="middle" />
          <circle cx={18} cy={28} r={4} fill={lit ? ON : '#cbd5e1'} stroke={INK} strokeWidth={0.8} />
          <text x={18} y={43} textAnchor="middle" fontSize={6.5} fill={INK} fontFamily="ui-monospace, monospace">
            L-N
          </text>
          <circle cx={42} cy={28} r={4} fill={ok ? ON : s.msg ? RED : '#cbd5e1'} stroke={INK} strokeWidth={0.8} />
          <text x={42} y={43} textAnchor="middle" fontSize={6} fontWeight={700} fill={INK}>
            OUT
          </text>
          <PinNo x={14} y={9} text="L" />
          <PinNo x={34} y={9} text="N" />
          <Label x={6} y={57} text={c.label} size={9} />
          {run && s.msg && <Label x={30} y={57} text={s.msg} size={6.5} color={RED} />}
        </g>
      );
    }
    case 'phasemon': {
      const lit = (pin: string, want: string) => run && termPot?.[c.id + ':' + pin] === want;
      const leds: [string, string][] = [
        ['L1', 'L1'],
        ['L2', 'L2'],
        ['L3', 'L3'],
      ];
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={12} />
          <Lead x1={40} y1={0} x2={40} y2={12} />
          <Lead x1={60} y1={0} x2={60} y2={12} />
          <rect x={4} y={12} width={72} height={36} rx={3} fill={BODY} stroke={BODY_STROKE} />
          <Tag x={40} y={19} text={TYPE_TAG[c.type]} anchor="middle" />
          {leds.map(([pin, want], i) => (
            <g key={pin}>
              <circle cx={18 + i * 18} cy={27} r={4} fill={lit(pin, want) ? ON : '#cbd5e1'} stroke={INK} strokeWidth={0.8} />
              <text x={18 + i * 18} y={42} textAnchor="middle" fontSize={6.5} fill={INK} fontFamily="ui-monospace, monospace">
                {pin}
              </text>
            </g>
          ))}
          <circle cx={70} cy={27} r={4} fill={run && s.out ? ON : s.msg ? RED : '#cbd5e1'} stroke={INK} strokeWidth={0.8} />
          <text x={70} y={42} textAnchor="middle" fontSize={6} fontWeight={700} fill={INK}>
            OUT
          </text>
          <PinNo x={14} y={9} text="L1" />
          <PinNo x={34} y={9} text="L2" />
          <PinNo x={54} y={9} text="L3" />
          <Label x={6} y={57} text={c.label} size={9} />
          {run && s.msg && <Label x={30} y={57} text={s.msg} size={6.5} color={RED} />}
        </g>
      );
    }
    case 'safety': {
      const powered = run && (s.volt || 0) >= (Number(c.props.V) || 24) * 0.8;
      const loop = s.msg !== 'loop open';
      const rows: [string, boolean, string][] = [
        ['PWR', powered, ON],
        ['IN', run && loop, '#3b82f6'],
        ['OUT', run && !!s.out, ON],
      ];
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={12} />
          <Lead x1={40} y1={0} x2={40} y2={12} />
          <Lead x1={20} y1={68} x2={20} y2={80} />
          <Lead x1={40} y1={68} x2={40} y2={80} />
          <rect x={4} y={12} width={52} height={56} rx={3} fill={s.burnt ? '#1e293b' : BODY} stroke={run && s.out ? ON : BODY_STROKE} strokeWidth={run && s.out ? 2 : 1} />
          <text x={30} y={22} textAnchor="middle" fontSize={6.5} fontWeight={800} fill={INK}>
            SAFETY
          </text>
          {rows.map(([name, on, col], i) => (
            <g key={name}>
              <circle cx={12} cy={31 + i * 12} r={3.2} fill={on ? col : '#cbd5e1'} stroke={INK} strokeWidth={0.7} />
              <text x={19} y={33.5 + i * 12} fontSize={6.5} fontWeight={600} fill={INK}>
                {name}
              </text>
            </g>
          ))}
          <text x={30} y={66} textAnchor="middle" fontSize={6.5} fill={INK} fontFamily="ui-monospace, monospace">
            {c.props.V}V
          </text>
          <PinNo x={14} y={9} text="E1" />
          <PinNo x={34} y={9} text="E2" />
          <PinNo x={14} y={78} text="A1" />
          <PinNo x={34} y={78} text="A2" />
          <Label x={62} y={44} text={c.label} />
        </g>
      );
    }
    case 'horn': {
      const on = run && !!s.energized;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={22} />
          <Lead x1={20} y1={38} x2={20} y2={60} />
          <path d="M 20 22 L 6 14 L 6 46 L 20 38 Z" fill={on ? AMBER : '#fff'} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
          {on && (
            <g className="lamp-glow" stroke={AMBER} strokeWidth={1.5} fill="none">
              <path d="M 2 24 a 8 8 0 0 0 0 12" />
            </g>
          )}
          <PinNo x={17} y={9} text="X1" />
          <PinNo x={17} y={58} text="X2" />
          <Label x={34} y={50} text={c.label} />
          <Tag x={34} y={59} text={TYPE_TAG[c.type]} />
        </g>
      );
    }
    case 'bell': {
      const on = run && !!s.energized;
      return (
        <g>
          {sel}
          <Lead x1={20} y1={0} x2={20} y2={18} />
          <Lead x1={20} y1={44} x2={20} y2={60} />
          <path d="M 8 38 A 12 12 0 0 1 32 38 L 32 40 L 8 40 Z" fill={on ? AMBER : '#fff'} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <circle cx={20} cy={42.5} r={2} fill={INK} />
          {on && (
            <g className="lamp-glow" stroke={AMBER} strokeWidth={1.4} fill="none">
              <path d="M 4 28 a 7 7 0 0 0 0 10" />
              <path d="M 36 28 a 7 7 0 0 1 0 10" />
            </g>
          )}
          <PinNo x={17} y={9} text="X1" />
          <PinNo x={17} y={58} text="X2" />
          <Tag x={34} y={12} text={TYPE_TAG[c.type]} />
          <Label x={34} y={52} text={c.label} />
        </g>
      );
    }
    case 'motor3':
    case 'motor6':
    case 'motor1': {
      const six = c.type === 'motor6';
      const one = c.type === 'motor1';
      const cx = one ? 30 : 40;
      const cy = six ? 40 : 50;
      const r = six ? 22 : one ? 24 : 26;
      const speed = s.speed || 0;
      const running = run && speed > 0.02;
      const dur = running ? Math.max(0.15, 1.2 / Math.max(speed, 0.05)) : 0;
      const topPins = one ? [20, 40] : [20, 40, 60];
      const cfg = s.config;
      const status = !run ? '' : s.msg === 'single phasing' ? '1-PH!' : s.msg === 'stalled' ? 'STALL' : s.msg === 'braking' ? 'BRAKE' : cfg === 'star' ? 'Y' : cfg === 'delta' ? 'Δ' : speed > 0.02 ? `${Math.round(speed * 100)}%` : '';
      const warn = run && (s.msg === 'single phasing' || s.msg === 'stalled' || s.burnt);
      return (
        <g>
          {sel}
          {topPins.map((x) => (
            <Lead key={x} x1={x} y1={0} x2={x} y2={cy} />
          ))}
          {six && [20, 40, 60].map((x) => <Lead key={'b' + x} x1={x} y1={cy} x2={x} y2={80} />)}
          {six ? <path d={`M 0 80 V 68 L ${cx} ${cy}`} fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /> : <Lead x1={20} y1={80} x2={20} y2={cy} />}
          <circle cx={cx} cy={cy} r={r} fill={warn ? '#fee2e2' : '#fff'} stroke={warn ? RED : INK} strokeWidth={1.8} />
          {running && (
            <circle
              cx={cx}
              cy={cy}
              r={r - 4}
              fill="none"
              stroke={ON}
              strokeWidth={2.5}
              strokeDasharray="6 10"
              style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `spin ${dur}s linear infinite`, animationDirection: s.dir === -1 ? 'reverse' : 'normal' }}
            />
          )}
          <text x={cx} y={cy + (six ? 2 : 1)} textAnchor="middle" fontSize={six ? 15 : 18} fontWeight={800} fill={INK} fontFamily="Inter, system-ui, sans-serif">
            M
          </text>
          <text x={cx} y={cy + (six ? 12 : 13)} textAnchor="middle" fontSize={8} fill={INK}>
            {one ? '1~' : '3~'}
          </text>
          {status && (
            <text x={cx} y={cy - (six ? 9 : 11)} textAnchor="middle" fontSize={7} fontWeight={800} fill={warn ? RED : ON} fontFamily="ui-monospace, monospace">
              {status}
            </text>
          )}
          {topPins.map((x, i) => (
            <PinNo key={'t' + x} x={x - 2} y={9} text={one ? ['L', 'N'][i] : six ? ['U1', 'V1', 'W1'][i] : ['U', 'V', 'W'][i]} />
          ))}
          {six && [20, 40, 60].map((x, i) => <PinNo key={'bn' + x} x={x - 2} y={78} text={['W2', 'U2', 'V2'][i]} />)}
          <PinNo x={six ? -3 : 17} y={78} text="PE" />
          <Label x={cx + r + 6} y={cy - 2} text={c.label} />
          <text x={cx + r + 6} y={cy + 8} fontSize={6.5} fill="#64748b">
            {c.props.kW} kW · {c.props.In} A
          </text>
          {run && s.current ? (
            <text x={cx + r + 6} y={cy + 17} fontSize={6.5} fill={INK} fontFamily="ui-monospace, monospace">
              {s.current.toFixed(1)} A
            </text>
          ) : null}
        </g>
      );
    }
    default:
      return (
        <g>
          {sel}
          <rect x={0} y={0} width={w} height={h} fill="#fff" stroke={INK} />
        </g>
      );
  }
});
