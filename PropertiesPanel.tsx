import type { Circuit, CircuitComponent, ComponentType, DeviceState, Lang, Mode, SimSnapshot } from '../types';
import { CATALOG, LINKABLE_TYPES, SUPPLY_PINS, getPins, isSupply } from '../lib/catalog';
import { parentActive } from '../lib/engine';
import { compName } from '../lib/i18n';
import type { Selection } from './Canvas';

interface Props {
  circuit: Circuit;
  selection: Selection | null;
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
  onSetWireRoute?: (id: string, route: string) => void;
}

export const WIRE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#0f172a'];

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
    {children}
  </label>
);

const inputCls = 'w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500';

function Select({ value, onChange, options }: { value: any; onChange: (v: string) => void; options: { v: string | number; l: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}

function Num({ value, onChange, min, max, step }: { value: any; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className={inputCls} />;
}

function Badge({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'err' | 'muted' }) {
  const cls = tone === 'ok' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : tone === 'warn' ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : tone === 'err' ? 'bg-red-500/15 text-red-300 border-red-500/40' : 'bg-slate-700/40 text-slate-300 border-slate-600';
  return <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{text}</span>;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 py-1.5 text-xs">
      <span className="text-slate-400">{k}</span>
      <span className="font-mono text-slate-100">{v}</span>
    </div>
  );
}

const ELECTRONICS_TYPES: ComponentType[] = [
  'resistor','res_fixed','pot','ldr','thermistor','varistor','res_net','capacitor','cap_elec','cap_ceramic','cap_film','cap_mica','supercap','cap_var',
  'inductor','choke','toroid','air_core','var_inductor','diode','led','lamp_neon','diode_rect','diode_zener','diode_schottky','photodiode','varactor','tvs','tunnel','bridge',
  'npn','pnp','bjt','darlington','phototransistor','jfet','mosfet','igbt','scr','scr_ic','triac','diac','gto',
  'ic555','opamp','comparator','pll','logic','flipflop','shiftreg','counter','mcu','mpu','dsp','fpga','eeprom','sram','dram','flash',
  'motor_driver','uln','transceiver','reg_linear','reg_smps','optocoupler','optocoupler_ic','triac_coupler',
  'transformer','transformer_iso','autotransformer','ct','pt','crystal','saw','fuse_glass','fuse_blade','fuse_ptc',
  'switch_push','switch_toggle','switch_dip','switch_rotary','switch_micro','reed','relay_emr','relay_latch',
  'dc_motor','bldc','stepper','servo','solenoid','terminal_block','header','power_jack','usb_port','audio_jack','ic_socket',
  'buzzer_active','buzzer_piezo','speaker','microphone','cooling_fan','rotary_encoder','strain_gauge','heatsink',
];

const DEFAULT_MODELS: Record<string, string> = {
  resistor: 'CFR-25 10k', res_fixed: 'CFR-25 1k', pot: 'RV09 10k', ldr: 'GL5528', thermistor: 'NTC 10k B3950', varistor: 'MOV 14D471K',
  capacitor: 'CE-25V-1000µF', cap_elec: 'CE-25V-1000µF', cap_ceramic: '104 100nF', cap_film: 'MKP 400V 1µF', cap_mica: 'CM 470pF', supercap: '5.5V 1F', cap_var: 'VC 30pF',
  inductor: 'L-470µH', choke: 'CM Choke 10mH', toroid: 'T50-26', air_core: '5T 22AWG',
  diode: '1N4007', diode_rect: '1N4007', diode_zener: '1N4733 5.1V', diode_schottky: '1N5819', photodiode: 'BPW34', varactor: 'BBY40', tvs: 'P6KE400A', tunnel: '1N3712',
  led: '5mm green', lamp_neon: '230V neon', npn: '2N2222', pnp: '2N2907', bjt: '2N2222', darlington: 'TIP122', phototransistor: 'LTR-3208E',
  jfet: '2N5457', mosfet: 'IRF540N', igbt: 'FGA25N120', scr: 'TYN612', scr_ic: 'TYN612', triac: 'BT136', diac: 'DB3', gto: 'GTO-5A',
  ic555: 'NE555P', opamp: 'LM741', comparator: 'LM393', pll: 'CD4046', logic: 'SN74HC00N', flipflop: '74HC74', shiftreg: '74HC595', counter: '74HC160',
  mcu: 'ATmega328P', mpu: 'x86 CPU', dsp: 'TMS320', fpga: 'EP4CE6', eeprom: '24C02', sram: '62256', dram: '4164', flash: 'W25Q64', motor_driver: 'L298N', uln: 'ULN2003', transceiver: 'MAX485',
  reg_linear: 'LM7805', reg_smps: 'LM2596', optocoupler: 'PC817', optocoupler_ic: 'PC817', triac_coupler: 'MOC3021',
  transformer: '230/12V 1A', transformer_iso: '1:1 1kVA', autotransformer: 'Variac 2A', ct: 'CT 100/5A', pt: 'PT 415/110V',
  crystal: '16MHz HC-49', saw: 'SAW 433MHz', fuse_glass: '5×20 2A', fuse_blade: 'ATO 10A', fuse_ptc: 'PPTC 0.5A',
  switch_push: 'TS-11 SPST', switch_toggle: 'MTS-102', switch_dip: 'DIP-4', switch_rotary: 'RS-3P', switch_micro: 'V-153 5A', reed: 'MKA-14103',
  relay_emr: 'SRD-12VDC-SL-C', relay_latch: 'HFE 2-coil', dc_motor: 'RS-555 12V', bldc: 'BLDC 24V 4000rpm', stepper: 'NEMA17', servo: 'SG90', solenoid: '12V 2-way',
  terminal_block: 'TB-5.08 4P', header: '2.54mm 2×4', power_jack: 'DC-005', usb_port: 'USB-C 16P', audio_jack: 'PJ-320 3.5mm', ic_socket: 'DIP-16 ZIF',
  buzzer_active: 'SFM-27 12V', buzzer_piezo: 'Passive 20mm', speaker: '8Ω 3W', microphone: 'Electret 9767', cooling_fan: '4010 12V',
  rotary_encoder: 'EC11 20-step', strain_gauge: 'HX711 5kg', heatsink: 'Al 20×20×10', res_net: 'SIP-5 10k', bridge: 'KBPC3510',
};
function defaultModel(t2: ComponentType) { return DEFAULT_MODELS[t2] ?? 'Generic'; }

export default function PropertiesPanel({ circuit, selection, mode, snapshot, lang, t, onUpdate, onDelete, onDuplicate, onSetLoad, onSetWireColor, onFlipWire, onSetWireSize, onSetWireRoute }: Props) {
  const comp = selection?.kind === 'comp' ? circuit.components.find((c) => c.id === selection.id) : undefined;
  const wire = selection?.kind === 'wire' ? circuit.wires.find((w) => w.id === selection.id) : undefined;

  if (!comp && !wire) {
    return (
      <div className="p-3 text-xs leading-relaxed text-slate-400">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('properties')}</div>
        {t('no_selection')}
      </div>
    );
  }

  if (wire) {
    const name = (r: { c: string; p: string }) => {
      const c = circuit.components.find((x) => x.id === r.c);
      return `${c?.label || (c ? compName(lang, c.type) : '?')}:${r.p}`;
    };
    return (
      <div className="p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('properties')}</div>
        <div className="rounded-md border border-slate-700 bg-slate-800/60 p-2 text-xs text-slate-200">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Wire</div>
            {mode === 'edit' && (
              <button onClick={() => onFlipWire(wire.id)} title={t('flip_route')} className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700">
                ⇄ {t('flip_route')}
              </button>
            )}
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-400">
            {name(wire.a)} ⟷ {name(wire.b)}
          </div>
          {snapshot && (
            <div className="mt-2">
              <Row k={t('current')} v={`${(snapshot.wireCurrent[wire.id] || 0).toFixed(2)} A`} />
              <Row k={t('voltage_m')} v={snapshot.termPot[`${wire.a.c}:${wire.a.p}`] || '—'} />
            </div>
          )}
        </div>
        {mode === 'edit' && (
          <div className="mt-3 rounded-md border border-slate-700 bg-slate-800/60 p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <span>{t('wire_size')}</span>
              <span className="font-mono text-sky-300">{wire.size || 2}px</span>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <button onClick={() => onSetWireSize(wire.id, (wire.size || 2) - 1)} className="h-7 min-w-7 rounded border border-slate-600 bg-slate-800 text-sm font-bold text-slate-200">−</button>
              {[['S', 2], ['M', 3], ['L', 4], ['XXL', 6]].map(([lbl, sz]) => (
                <button key={lbl} onClick={() => onSetWireSize(wire.id, sz as number)} className={`h-7 rounded border px-2 text-[11px] font-bold ${(wire.size || 2) === sz ? 'border-sky-400 bg-sky-500/25 text-sky-100' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>
                  {lbl}
                </button>
              ))}
              <button onClick={() => onSetWireSize(wire.id, (wire.size || 2) + 1)} className="h-7 min-w-7 rounded border border-slate-600 bg-slate-800 text-sm font-bold text-slate-200">+</button>
            </div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('route_style')}</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(['auto', 'parallel', 'elbow', 'plus', 'tee', 'step', 'arc', 'offset', 'zigzag', 'rail', 'straight'] as const).map((r) => (
                <button key={r} onClick={() => onSetWireRoute?.(wire.id, r)} className={`h-7 rounded border px-2 text-[11px] font-bold ${(wire.route || 'auto') === r ? 'border-violet-400 bg-violet-500/25 text-violet-100' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>
                  {t('r_' + r)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onSetWireColor(wire.id, '')}
                title={t('color_auto')}
                className={`flex h-7 min-w-7 items-center justify-center rounded border px-1.5 text-[10px] font-bold ${!wire.color ? 'border-sky-400 bg-sky-500/20 text-sky-200' : 'border-slate-600 bg-slate-800 text-slate-400'}`}
              >
                {t('color_auto')}
              </button>
              {WIRE_COLORS.map((col) => (
                <button
                  key={col}
                  onClick={() => onSetWireColor(wire.id, col)}
                  title={col}
                  className={`h-7 w-7 rounded border-2 ${wire.color === col ? 'border-sky-400' : 'border-slate-600'}`}
                  style={{ background: col }}
                />
              ))}
            </div>
          </div>
        )}
        {mode === 'edit' && (
          <button onClick={onDelete} className="mt-3 w-full rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20">
            {t('delete')}
          </button>
        )}
      </div>
    );
  }

  const c = comp as CircuitComponent;
  const p = c.props;
  const st: DeviceState = snapshot?.states[c.id] || {};
  const set = (k: string, v: any) => onUpdate(c.id, { props: { [k]: v } });
  const edit = mode === 'edit';
  const linkTo = CATALOG[c.type].linkTo;
  const linkTargets = circuit.components.filter((x) => LINKABLE_TYPES.includes(x.type) && x.id !== c.id && (!linkTo || linkTo.includes(x.type)));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-700 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('properties')}</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">{compName(lang, c.type)}</div>
        {c.label && <div className="font-mono text-xs text-sky-300">{c.label}</div>}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {edit && CATALOG[c.type].prefix !== '' && (
          <Field label={t('label')}>
            <input value={c.label} onChange={(e) => onUpdate(c.id, { label: e.target.value })} className={inputCls} />
          </Field>
        )}
        {edit && isSupply(c.type) && SUPPLY_PINS[c.type].includes('L') && (
          <Field label={t('phase')}>
            <Select value={p.phase || 'L1'} onChange={(v) => set('phase', v)} options={['L1', 'L2', 'L3'].map((x) => ({ v: x, l: `${x} (240 V to N)` }))} />
          </Field>
        )}
        {edit && CATALOG[c.type].linked && (
          <Field label={t('linked_to')}>
            <Select
              value={p.parent || ''}
              onChange={(v) => set('parent', v)}
              options={[{ v: '', l: t('none') }, ...linkTargets.map((x) => ({ v: x.id, l: `${x.label || '?'} — ${compName(lang, x.type)}` }))]}
            />
            {!p.parent && <div className="mt-1 text-[10px] text-red-400">⚠ {t('unlinked')}</div>}
          </Field>
        )}
        {edit && (c.type === 'contact_no' || c.type === 'contact_nc' || c.type === 'co' || c.type === 'timer_no' || c.type === 'timer_nc' || c.type === 'timer_co' || c.type === 'ol_no' || c.type === 'ol_nc' || c.type === 'ph_no' || c.type === 'ph_nc') && (
          <Field label={t('label')}>
            <input value={c.label} onChange={(e) => onUpdate(c.id, { label: e.target.value })} className={inputCls} placeholder="optional note" />
          </Field>
        )}
        {edit && (c.type === 'mcb1' || c.type === 'mcb2' || c.type === 'mcb3') && (
          <>
            <Field label={t('rated_current')}>
              <Select value={p.In} onChange={(v) => set('In', Number(v))} options={[2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63].map((a) => ({ v: a, l: `${a} A` }))} />
            </Field>
            <Field label={t('curve')}>
              <Select value={p.curve} onChange={(v) => set('curve', v)} options={[{ v: 'B', l: 'B (3–5 × In)' }, { v: 'C', l: 'C (5–10 × In)' }, { v: 'D', l: 'D (10–20 × In)' }]} />
            </Field>
          </>
        )}
        {edit && (c.type === 'mccb' || c.type === 'mccb4') && (
          <>
            <Field label={t('rated_current')}>
              <Select value={p.In} onChange={(v) => set('In', Number(v))} options={[16, 25, 32, 40, 50, 63, 80, 100, 125, 160, 250, 400, 630].map((a) => ({ v: a, l: `${a} A` }))} />
            </Field>
            <Field label={t('curve')}>
              <Select value={p.curve} onChange={(v) => set('curve', v)} options={[{ v: 'B', l: 'B (3–5 × In)' }, { v: 'C', l: 'C (5–10 × In)' }, { v: 'D', l: 'D (10–20 × In)' }]} />
            </Field>
          </>
        )}
        {edit && (c.type === 'fuse' || c.type === 'fuse2' || c.type === 'fuse3' || c.type === 'fsw1' || c.type === 'fsw2' || c.type === 'fsw3') && (
          <Field label={t('rated_current')}>
            <Select value={p.In} onChange={(v) => set('In', Number(v))} options={[1, 2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63].map((a) => ({ v: a, l: `${a} A` }))} />
          </Field>
        )}
        {edit && (c.type === 'overload' || c.type === 'mpcb' || c.type === 'dol_combo') && (
          <Field label={t('overload_setting')}>
            <Num value={p.Ir} onChange={(v) => set('Ir', v)} min={0.1} max={200} step={0.5} />
          </Field>
        )}
        {edit && (c.type === 'rccb' || c.type === 'rccb4') && (
          <Field label={t('idn')}>
            <Select value={p.Idn} onChange={(v) => set('Idn', Number(v))} options={[10, 30, 100, 300, 1000].map((a) => ({ v: a, l: `${a} mA` }))} />
          </Field>
        )}
        {edit && c.type === 'rcbo' && (
          <>
            <Field label={t('rated_current')}>
              <Select value={p.In} onChange={(v) => set('In', Number(v))} options={[6, 10, 16, 20, 25, 32, 40].map((a) => ({ v: a, l: `${a} A` }))} />
            </Field>
            <Field label={t('curve')}>
              <Select value={p.curve} onChange={(v) => set('curve', v)} options={[{ v: 'B', l: 'B (3–5 × In)' }, { v: 'C', l: 'C (5–10 × In)' }, { v: 'D', l: 'D (10–20 × In)' }]} />
            </Field>
            <Field label={t('idn')}>
              <Select value={p.Idn} onChange={(v) => set('Idn', Number(v))} options={[10, 30, 100, 300, 1000].map((a) => ({ v: a, l: `${a} mA` }))} />
            </Field>
          </>
        )}
        {edit && (c.type === 'relay' || c.type === 'phr_coil') && (
          <Field label={t('coil_voltage')}>
            <Select value={p.V} onChange={(v) => set('V', Number(v))} options={[{ v: 24, l: '24 V DC' }, { v: 230, l: '230 V AC' }, { v: 400, l: '400 V AC' }]} />
          </Field>
        )}
        {edit && c.type === 'coil' && (
          <>
            <Field label={t('coil_kind')}>
              <Select value={p.kind} onChange={(v) => set('kind', v)} options={[{ v: 'contactor', l: t('contactor') }, { v: 'relay', l: t('relay') }]} />
            </Field>
            <Field label={t('coil_voltage')}>
              <Select value={p.V} onChange={(v) => set('V', Number(v))} options={[{ v: 24, l: '24 V DC' }, { v: 230, l: '230 V AC' }, { v: 400, l: '400 V AC' }]} />
            </Field>
          </>
        )}
        {edit && c.type === 'safety' && (
          <Field label={t('voltage')}>
            <Select value={p.V} onChange={(v) => set('V', Number(v))} options={[{ v: 24, l: '24 V DC' }, { v: 230, l: '230 V AC' }]} />
          </Field>
        )}
        {edit && (c.type === 'timer' || c.type === 'ton' || c.type === 'tof' || c.type === 'tsd' || c.type === 'tp' || c.type === 'rto' || c.type === 'tcy') && (
          <>
{c.type === 'timer' && (<>
            <Field label={t('timer_mode')}>
              <Select value={p.mode} onChange={(v) => set('mode', v)} options={[{ v: 'on', l: t('on_delay') }, { v: 'off', l: t('off_delay') }, { v: 'flash', l: t('flasher') }, { v: 'pulse', l: t('one_shot') }, { v: 'rto', l: t('retentive') }, { v: 'cyclic', l: t('cyclic') }, { v: 'sd', l: t('star_delta') }]} />
            </Field>
            </>)}
            <Field label={t('delay')}>
              <Num value={p.delay} onChange={(v) => set('delay', v)} min={0.1} max={3600} step={0.5} />
            </Field>
            {p.mode === 'cyclic' && (
              <>
                <Field label={t('delay_on')}>
                  <Num value={p.delay} onChange={(v) => set('delay', v)} min={0.1} max={3600} step={0.5} />
                </Field>
                <Field label={t('delay_off')}>
                  <Num value={p.delay2 ?? p.delay} onChange={(v) => set('delay2', v)} min={0.1} max={3600} step={0.5} />
                </Field>
              </>
            )}
            {p.mode === 'sd' && (
              <Field label={t('gap_ms')}>
                <Num value={p.gap ?? 60} onChange={(v) => set('gap', v)} min={10} max={1000} step={5} />
              </Field>
            )}
            {p.mode === 'rto' && <div className="text-[10px] text-slate-400">💡 {t('rto_reset_hint')}</div>}
            <Field label={t('coil_voltage')}>
              <Select value={p.V} onChange={(v) => set('V', Number(v))} options={[{ v: 24, l: '24 V DC' }, { v: 230, l: '230 V AC' }, { v: 400, l: '400 V AC' }]} />
            </Field>
          </>
        )}
        {edit && (c.type === 'lamp' || c.type === 'pb_no' || c.type === 'pb_nc' || c.type === 'pb_dual') && (
          <Field label={t('color')}>
            <Select value={p.color} onChange={(v) => set('color', v)} options={['green', 'red', 'yellow', 'white', 'blue'].map((x) => ({ v: x, l: x }))} />
          </Field>
        )}
        {edit && (c.type === 'lamp' || c.type === 'buzzer' || c.type === 'horn' || c.type === 'bell') && (
          <Field label={t('voltage')}>
            <Select value={p.V} onChange={(v) => set('V', Number(v))} options={[{ v: 24, l: '24 V' }, { v: 230, l: '230 V' }, { v: 400, l: '400 V' }]} />
          </Field>
        )}
        {edit && (c.type === 'sens_limit' || c.type === 'sens_float' || c.type === 'sens_pressure' || c.type === 'sens_temp' || c.type === 'sens_photo' || c.type === 'sens_prox' || c.type === 'sens_reed' || c.type === 'sens_flow' || c.type === 'sens_vibration') && (
          <>
            <Field label={t('switch_kind')}>
              <Select value={p.kind || 'limit'} onChange={(v) => set('kind', v)} options={['limit', 'float', 'pressure', 'thermostat', 'photo', 'prox', 'reed', 'flow', 'vibration'].map((x) => ({ v: x, l: t(x) }))} />
            </Field>
            <Field label={t('contact')}>
              <Select value={p.contact} onChange={(v) => set('contact', v)} options={[{ v: 'NO', l: 'NO' }, { v: 'NC', l: 'NC' }, { v: 'CO', l: t('changeover') }]} />
            </Field>
          </>
        )}
        {edit && c.type === 'switch' && (
          <>
            <Field label={t('switch_kind')}>
              <Select value={p.kind} onChange={(v) => set('kind', v)} options={['selector', 'key', 'float', 'pressure', 'thermostat', 'limit', 'photo', 'prox'].map((x) => ({ v: x, l: t(x) }))} />
            </Field>
            <Field label={t('contact')}>
              <Select value={p.contact} onChange={(v) => set('contact', v)} options={[{ v: 'NO', l: 'NO' }, { v: 'NC', l: 'NC' }, { v: 'CO', l: `CO (${t('changeover')} 11-12-14)` }]} />
            </Field>
          </>
        )}
        {edit && (c.type === 'motor3' || c.type === 'motor6' || c.type === 'motor1') && (
          <>
            <Field label={t('rated_current')}>
              <Num value={p.In} onChange={(v) => set('In', v)} min={0.1} max={500} step={0.5} />
            </Field>
            <Field label={t('power')}>
              <Num value={p.kW} onChange={(v) => set('kW', v)} min={0.1} max={500} step={0.5} />
            </Field>
            <Field label={`${t('load')} (${Math.round((p.load ?? 1) * 100)}%)`}>
              <input type="range" min={0} max={2.5} step={0.05} value={p.load ?? 1} onChange={(e) => set('load', Number(e.target.value))} className="w-full accent-sky-500" />
            </Field>
          </>
        )}
        {edit && c.type === 'ntc' && (
          <>
            <Field label={`${t('probe_temp')} (°C)`}>
              <Num value={p.temp ?? 26} onChange={(v) => set('temp', v)} min={-40} max={150} step={0.5} />
            </Field>
            <Field label={t('ntc_rated')}>
              <Select value={p.rated ?? 10} onChange={(v) => set('rated', Number(v))} options={[...[5, 10, 15, 20, 50].map((x) => ({ v: x, l: `${x} kΩ` }))]} />
            </Field>
            <Field label={`${t('heat_time')} (${p.heatTime ?? 15}s)`}>
              <Num value={p.heatTime ?? 15} onChange={(v) => set('heatTime', v)} min={1} max={180} step={1} />
            </Field>
            <Field label={`${t('cool_time')} (${p.coolTime ?? 15}s)`}>
              <Num value={p.coolTime ?? 15} onChange={(v) => set('coolTime', v)} min={1} max={180} step={1} />
            </Field>
          </>
        )}
        {edit && c.type === 'stc3008' && (
          <>
            <Field label={`${t('stop_temp')} — Relay OFF`}>
              <Num value={p.stopTemp ?? 18} onChange={(v) => set('stopTemp', v)} min={-40} max={200} step={0.5} />
            </Field>
            <Field label={`${t('start_temp')} — Relay ON (5-6)`}>
              <Num value={p.startTemp ?? 26} onChange={(v) => set('startTemp', v)} min={-40} max={200} step={0.5} />
            </Field>
            <Field label={t('auto_cycle')}>
              <Select value={p.autoCycle === false ? 'manual' : 'auto'} onChange={(v) => set('autoCycle', v === 'auto')} options={[{ v: 'auto', l: t('auto_cycle') }, { v: 'manual', l: t('manual_mode') }]} />
            </Field>
            <Field label={`${t('heat_time')} — ${p.heatTime ?? 15}s`}>
              <input type="range" min={5} max={120} step={1} value={p.heatTime ?? 15} onChange={(e) => set('heatTime', Number(e.target.value))} className="w-full accent-orange-500" />
            </Field>
            <Field label={`${t('cool_time')} — ${p.coolTime ?? 15}s`}>
              <input type="range" min={5} max={120} step={1} value={p.coolTime ?? 15} onChange={(e) => set('coolTime', Number(e.target.value))} className="w-full accent-sky-500" />
            </Field>
            <Field label={`${t('measured_temp')} (PV)`}>
              <Num value={p.temp ?? 22} onChange={(v) => set('temp', v)} min={-40} max={150} step={0.5} />
            </Field>
          </>
        )}
        {edit && c.type === 'tank' && (
          <>
            <Field label={`${t('water_level')} (${Math.round((p.level ?? 0.4) * 100)}%)`}>
              <input type="range" min={0} max={1} step={0.01} value={p.level ?? 0.4} onChange={(e) => set('level', Number(e.target.value))} className="w-full accent-sky-500" />
            </Field>
            <Field label={`${t('daily_use')} (${p.dailyUse ?? 4}%/s)`}>
              <Num value={p.dailyUse ?? 4} onChange={(v) => set('dailyUse', v)} min={0} max={50} step={1} />
            </Field>
          </>
        )}
        {edit && c.type === 'floatless' && (
          <>
            <Field label={t('voltage')}>
              <Select value={p.V} onChange={(v) => set('V', Number(v))} options={[{ v: 220, l: '220 V AC' }, { v: 240, l: '240 V AC' }]} />
            </Field>
            <Field label={`${t('restart_delay')} (${p.restartDelay ?? 0} s)`}>
              <input type="range" min={0} max={10} step={0.5} value={p.restartDelay ?? 0} onChange={(e) => set('restartDelay', Number(e.target.value))} className="w-full accent-sky-500" />
            </Field>
          </>
        )}
        {edit && c.type === 'pmr' && (
          <>
            <Field label={t('p_unbalance')}>
              <Select value={p.unbalance} onChange={(v) => set('unbalance', Number(v))} options={[5, 10, 15].map((a) => ({ v: a, l: `${a} %` }))} />
            </Field>
            <Field label={t('p_nominal')}>
              <Select value={p.nominal} onChange={(v) => set('nominal', Number(v))} options={[380, 400, 415, 420].map((a) => ({ v: a, l: `${a} V` }))} />
            </Field>
            <Field label={t('p_trip_delay')}>
              <Select value={p.tripDelay} onChange={(v) => set('tripDelay', Number(v))} options={[100, 200, 500, 1000].map((a) => ({ v: a, l: `${a} ms` }))} />
            </Field>
          </>
        )}
        {edit && ELECTRONICS_TYPES.includes(c.type) && (
          <div className="rounded-md border border-teal-600/40 bg-teal-500/5 p-2">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-teal-300">
              <span>🔌</span> {t('el_specs')}
            </div>
            <div className="space-y-2">
              <Field label={t('model')}>
                <input
                  value={p.model ?? defaultModel(c.type)}
                  onChange={(e) => set('model', e.target.value)}
                  className={inputCls}
                  dir="ltr"
                  placeholder={defaultModel(c.type)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('pkg')}>
                  <Select value={p.pkg ?? 'DIP'} onChange={(v) => set('pkg', v)} options={['DIP', 'SMD', 'TO-92', 'TO-220', 'DO-41', 'SOT-23', 'Axial', 'Radial', 'Module'].map((x) => ({ v: x, l: x }))} />
                </Field>
                <Field label={t('pin_count')}>
                  <Select value={String(p.pinCount ?? getPins(c).length)} onChange={(v) => set('pinCount', Number(v))} options={[2, 3, 4, 5, 6, 8, 10, 14, 16, 20].map((x) => ({ v: x, l: String(x) }))} />
                </Field>
              </div>
              <Field label={t('pin_labels')}>
                <div className="grid grid-cols-2 gap-1">
                  {getPins(c).map((pin) => (
                    <label key={pin.id} className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1 py-0.5">
                      <span className="w-8 shrink-0 truncate font-mono text-[9px] text-slate-400" title={pin.id}>{pin.id}</span>
                      <input
                        value={p.pinLabels?.[pin.id] ?? ''}
                        onChange={(e) => set('pinLabels', { ...(p.pinLabels || {}), [pin.id]: e.target.value })}
                        placeholder={pin.id}
                        className="w-full bg-transparent text-[10px] text-slate-100 outline-none"
                      />
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                {(c.type.startsWith('res') || c.type === 'pot' || c.type === 'ldr' || c.type === 'thermistor' || c.type === 'varistor') && (
                  <Field label={t('value_ohm')}>
                    <Num value={p.ohm ?? 1000} onChange={(v) => set('ohm', v)} min={0.01} step={1} />
                  </Field>
                )}
                {(c.type.startsWith('cap') || c.type === 'supercap') && (
                  <Field label={t('value_cap')}>
                    <Select value={p.capUnit ?? 'µF'} onChange={(v) => set('capUnit', v)} options={[{ v: 'pF', l: 'pF' }, { v: 'nF', l: 'nF' }, { v: 'µF', l: 'µF' }, { v: 'F', l: 'F' }]} />
                  </Field>
                )}
                <Field label={t('voltage_v')}>
                  <Num value={p.V ?? (c.type === 'lamp_neon' ? 230 : 12)} onChange={(v) => set('V', v)} min={0} step={0.1} />
                </Field>
                <Field label={t('current_a')}>
                  <Num value={p.I ?? 1} onChange={(v) => set('I', v)} min={0} step={0.01} />
                </Field>
                {(c.type === 'crystal' || c.type === 'saw' || c.type === 'ic555' || c.type === 'mcu' || c.type === 'pll') && (
                  <Field label={t('freq')}>
                    <Num value={p.freq ?? 16000000} onChange={(v) => set('freq', v)} min={1} step={1} />
                  </Field>
                )}
                <Field label={t('power_w')}>
                  <Num value={p.watt ?? 0.25} onChange={(v) => set('watt', v)} min={0} step={0.05} />
                </Field>
                <Field label={t('tolerance')}>
                  <Num value={p.tol ?? 5} onChange={(v) => set('tol', v)} min={0} step={0.1} />
                </Field>
                {(c.type.includes('bjt') || c.type === 'darlington' || c.type.includes('mosfet') || c.type.includes('jfet')) && (
                  <Field label={t('gain')}>
                    <Num value={p.hfe ?? 100} onChange={(v) => set('hfe', v)} min={1} step={1} />
                  </Field>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                {c.type === 'logic' || c.type === 'flipflop' || c.type === 'counter' ? (
                  <Field label={t('logic_family')}>
                    <Select value={p.family ?? '74xx'} onChange={(v) => set('family', v)} options={['74xx', '74HC', '74LS', '40xx', 'CMOS'].map((x) => ({ v: x, l: x }))} />
                  </Field>
                ) : null}
                <div className="mt-1 rounded bg-slate-900/60 px-2 py-1 font-mono text-[10px] text-slate-300">
                  {p.model ?? defaultModel(c.type)} · {p.pkg ?? 'DIP'} · {getPins(c).length} pins · {p.V ?? (c.type === 'lamp_neon' ? 230 : 12)}V
                </div>
              </div>
            </div>
          </div>
        )}
        {edit && c.type === 'busbar' && (
          <>
            <Field label={t('bar_name')}>
              <input value={p.name || ''} onChange={(e) => set('name', e.target.value)} className={inputCls} />
            </Field>
            <Field label={t('bar_length')}>
              <Num value={p.length} onChange={(v) => set('length', Math.max(2, Math.min(40, v)))} min={2} max={40} step={1} />
            </Field>
          </>
        )}

        {/* live values */}
        {snapshot && (
          <div className="rounded-md border border-slate-700 bg-slate-800/60 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('measurements')}</div>
            {(c.type === 'coil' || c.type === 'relay' || c.type === 'timer' || c.type === 'ton' || c.type === 'tof' || c.type === 'tsd' || c.type === 'tp' || c.type === 'rto' || c.type === 'tcy') && (
              <>
                <Row k={t('state')} v={st.burnt ? <Badge text={t('burnt')} tone="err" /> : st.energized ? <Badge text={t('energized')} tone="ok" /> : <Badge text={t('released')} tone="muted" />} />
                <Row k={t('voltage_m')} v={`${st.volt ?? 0} V`} />
                {(c.type === 'timer' || c.type === 'ton' || c.type === 'tof' || c.type === 'tsd' || c.type === 'tp' || c.type === 'rto' || c.type === 'tcy') && <Row k={t('delay')} v={`${(st.t || 0).toFixed(1)} / ${p.delay} s`} />}
              </>
            )}
            {(c.type === 'lamp' || c.type === 'buzzer' || c.type === 'horn' || c.type === 'bell') && (
              <>
                <Row k={t('state')} v={st.burnt ? <Badge text={t('blown')} tone="err" /> : st.energized ? <Badge text={t('on')} tone="ok" /> : <Badge text={t('off')} tone="muted" />} />
                <Row k={t('voltage_m')} v={`${st.volt ?? 0} V`} />
              </>
            )}
            {(c.type === 'mcb1' || c.type === 'mcb2' || c.type === 'mcb3' || c.type === 'mccb' || c.type === 'mccb4' || c.type === 'mpcb' || c.type === 'fuse' || c.type === 'fuse2' || c.type === 'fuse3' || c.type === 'fsw1' || c.type === 'fsw2' || c.type === 'fsw3' || c.type === 'iso1' || c.type === 'iso2' || c.type === 'iso3' || c.type === 'rccb' || c.type === 'rcbo' || c.type === 'rccb4') && (
              <>
                <Row k={t('state')} v={st.tripped ? <Badge text={c.type === 'fuse' || c.type === 'fuse2' || c.type === 'fuse3' || c.type === 'fsw1' || c.type === 'fsw2' || c.type === 'fsw3' ? t('blown') : t('tripped')} tone="err" /> : st.on || c.type === 'fuse' || c.type === 'fuse2' || c.type === 'fuse3' ? <Badge text={t('on')} tone="ok" /> : <Badge text={t('off')} tone="muted" />} />
                <Row k={t('current')} v={`${(st.current === 999 ? 0 : st.current || 0).toFixed(2)} A`} />
                <Row k={t('thermal')} v={`${Math.round((st.heat || 0) * 100)} %`} />
                {c.type === 'mpcb' && <Row k={t('overload_setting')} v={`Ir ${p.Ir} A`} />}
                {(c.type === 'rccb' || c.type === 'rcbo' || c.type === 'rccb4') && <Row k={t('idn')} v={`${p.Idn} mA`} />}
              </>
            )}
            {(c.type === 'overload' || c.type === 'dol_combo') && (
              <>
                <Row k={t('state')} v={st.tripped ? <Badge text={t('tripped')} tone="err" /> : <Badge text="OK" tone="ok" />} />
                <Row k={t('current')} v={`${(st.current || 0).toFixed(2)} A / ${p.Ir} A`} />
                <Row k={t('thermal')} v={`${Math.round((st.heat || 0) * 100)} %`} />
              </>
            )}
            {(c.type === 'motor3' || c.type === 'motor6' || c.type === 'motor1') && (
              <>
                <Row
                  k={t('state')}
                  v={
                    st.msg === 'single phasing' ? (
                      <Badge text="SINGLE PHASING" tone="err" />
                    ) : st.msg === 'stalled' ? (
                      <Badge text="STALLED" tone="err" />
                    ) : (st.speed || 0) > 0.02 ? (
                      <Badge text={st.config === 'star' ? 'RUN (Y)' : st.config === 'delta' ? 'RUN (Δ)' : 'RUN'} tone="ok" />
                    ) : (
                      <Badge text={t('stopped')} tone="muted" />
                    )
                  }
                />
                <Row k={t('speed_m')} v={`${Math.round((st.speed || 0) * 100)} %`} />
                <Row k={t('current')} v={`${(st.current || 0).toFixed(1)} A`} />
                {c.type !== 'motor1' && <Row k={t('direction')} v={st.dir === 1 ? t('forward') : st.dir === -1 ? t('reverse') : '—'} />}
                <div className="pt-2">
                  <div className="mb-1 text-[10px] text-slate-400">
                    {t('load')}: {Math.round((st.load ?? p.load ?? 1) * 100)}%
                  </div>
                  <input type="range" min={0} max={2.5} step={0.05} value={st.load ?? p.load ?? 1} onChange={(e) => onSetLoad(c.id, Number(e.target.value))} className="w-full accent-sky-500" />
                </div>
              </>
            )}
            {(c.type === 'pb_no' || c.type === 'pb_nc' || c.type === 'pb_dual') && <Row k={t('state')} v={st.pressed ? <Badge text="PRESSED" tone="ok" /> : <Badge text="—" tone="muted" />} />}
            {(c.type === 'switch' || c.type === 'estop' || c.type === 'esw1' || c.type.startsWith('sens_')) && <Row k={t('state')} v={st.on ? <Badge text={t('on')} tone="ok" /> : <Badge text={t('off')} tone="muted" />} />}
            {(c.type === 'cos1' || c.type === 'sel3') && <Row k={t('state')} v={<Badge text={(st.pos || 0) === 0 ? '0 (OFF)' : (st.pos || 0) === 1 ? 'I' : 'II'} tone={(st.pos || 0) === 0 ? 'muted' : 'ok'} />} />}
            {(isSupply(c.type) || c.type === 'psu24') && <Row k={t('state')} v={st.tripped ? <Badge text={t('tripped')} tone="err" /> : <Badge text={t('on')} tone="ok" />} />}
            {(c.type === 'contact_no' || c.type === 'contact_nc' || c.type === 'co' || c.type === 'timer_no' || c.type === 'timer_nc' || c.type === 'timer_co' || c.type === 'ol_no' || c.type === 'ol_nc' || c.type === 'ph_no' || c.type === 'ph_nc' || c.type === 'contactor_main' || c.type === 'contactor_main1' || c.type === 'contactor_main2' || c.type === 'contactor_main4' || c.type === 'dol_combo' || c.type === 'aux4') &&
              (() => {
                const parent = circuit.components.find((x) => x.id === p.parent);
                const act = parentActive(parent, parent ? snapshot?.states[parent.id] : undefined, c.type);
                const isNc = c.type === 'contact_nc' || c.type === 'ol_nc' || c.type === 'ph_nc' || c.type === 'timer_nc';
                const closed = c.type === 'dol_combo' ? act && !st.tripped : c.type === 'co' || c.type === 'timer_co' ? true : isNc ? !act : act;
                return (
                  <>
                    <Row k={t('linked_to')} v={parent?.label || t('unlinked')} />
                    {parent &&
                      (c.type === 'aux4' ? (
                        <>
                          <Row k="13-14 · 23-24" v={act ? <Badge text={t('closed')} tone="ok" /> : <Badge text={t('contact_open')} tone="muted" />} />
                          <Row k="11-12 · 21-22" v={!act ? <Badge text={t('closed')} tone="ok" /> : <Badge text={t('contact_open')} tone="muted" />} />
                        </>
                      ) : c.type === 'co' || c.type === 'timer_co' ? (
                        <Row k={t('state')} v={<Badge text={act ? '11–14 / 15–18' : '11–12 / 15–16'} tone={act ? 'ok' : 'muted'} />} />
                      ) : (
                        <Row k={t('state')} v={closed ? <Badge text={t('closed')} tone="ok" /> : <Badge text={t('contact_open')} tone="muted" />} />
                      ))}
                  </>
                );
              })()}
            {(c.type === 'phasemon' || c.type === 'ph1mon') && (
              <>
                <Row k={t('state')} v={st.out ? <Badge text={t('healthy')} tone="ok" /> : <Badge text={t('phase_fault')} tone="err" />} />
                {st.msg && <Row k={t('measurements')} v={st.msg} />}
              </>
            )}
            {c.type === 'phr_coil' && (
              <>
                <Row k={t('state')} v={st.burnt ? <Badge text={t('burnt')} tone="err" /> : st.out ? <Badge text={t('on')} tone="ok" /> : <Badge text={t('off')} tone="muted" />} />
                <Row k={t('voltage_m')} v={`${st.volt ?? 0} V`} />
                {st.msg && <Row k={t('measurements')} v={st.msg} />}
              </>
            )}
            {c.type === 'stc3008' && (
              <>
                <Row k={`${t('measured_temp')} (PV)`} v={`${(st.temp ?? p.temp ?? 0).toFixed(1)} °C`} />
                {mode === 'run' && (
                  <input type="range" min={0} max={50} step={0.1} value={st.temp ?? 26} onChange={(e) => onSetLoad(c.id, Number(e.target.value))} className="mt-1 w-full accent-sky-500" />
                )}
                <Row k={`${t('stop_temp')} / ${t('start_temp')}`} v={`${p.stopTemp ?? 18} / ${p.startTemp ?? 26} °C`} />
                <Row k="⊕1 L · ⊕2 N" v={<Badge text="220V AC" tone="muted" />} />
                <Row k="⊕3 · ⊕4 SENSOR" v={<Badge text={st.msg === 'sensor open' ? 'OPEN' : 'NTC'} tone={st.msg === 'sensor open' ? 'err' : 'muted'} />} />
                <Row k="⊕5 IN · ⊕6 OUT" v={st.out ? <Badge text="NC · 230V OUT" tone="ok" /> : <Badge text="NO · OPEN" tone="muted" />} />
                <Row k="5-6 contact" v={st.out ? <Badge text="NC (closed)" tone="ok" /> : <Badge text="NO (open)" tone="warn" />} />
                <Row k="⊕5 external IN" v={<Badge text={(st as any).inLive ? 'LIVE' : 'NO POWER'} tone={(st as any).inLive ? 'ok' : 'warn'} />} />
                {st.msg && <Row k={t('state')} v={st.msg} />}
              </>
            )}
            {c.type === 'tank' && (
              <>
                <Row k={t('water_level')} v={`${Math.round((st.level ?? 0) * 100)} %`} />
                <Row k="E1 / E2 / E3" v={st.msg === 'dry' ? <Badge text={t('e3_dry')} tone="err" /> : st.msg === 'full' ? <Badge text={t('tank_full')} tone="ok" /> : <Badge text={t('tank_low')} tone="warn" />} />
                {mode === 'run' && (
                  <div className="pt-1">
                    <input type="range" min={0} max={1} step={0.01} value={st.level ?? p.level ?? 0.4} onChange={(e) => onSetLoad(c.id, Number(e.target.value))} className="w-full accent-sky-500" />
                  </div>
                )}
              </>
            )}
            {c.type === 'floatless' && (
              <>
                <Row k={t('state')} v={<Badge text={st.out ? 'NO (6)' : 'NC (5)'} tone={st.out ? 'ok' : 'muted'} />} />
                <Row k="8 COM / 7 L / 2 N" v={`${st.volt ?? 0} V`} />
                {st.msg && <Row k={t('measurements')} v={st.msg} />}
              </>
            )}
            {c.type === 'pmr' && (
              <>
                <Row k={t('state')} v={st.out ? <Badge text={t('healthy')} tone="ok" /> : <Badge text={t('phase_fault')} tone="err" />} />
                {st.msg && <Row k={t('measurements')} v={st.msg} />}
              </>
            )}
            {c.type === 'safety' && (
              <>
                <Row k={t('state')} v={st.burnt ? <Badge text={t('burnt')} tone="err" /> : st.out ? <Badge text={t('on')} tone="ok" /> : <Badge text={t('off')} tone="muted" />} />
                <Row k={t('voltage_m')} v={`${st.volt ?? 0} V`} />
                <Row k="E1–E2" v={st.msg === 'loop open' ? <Badge text={t('loop_open')} tone="err" /> : <Badge text={t('loop_closed')} tone="ok" />} />
              </>
            )}
          </div>
        )}
      </div>
      {edit && (
        <div className="flex gap-2 border-t border-slate-700 p-3">
          <button onClick={onDuplicate} className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">
            {t('duplicate')}
          </button>
          <button onClick={onDelete} className="flex-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20">
            {t('delete')}
          </button>
        </div>
      )}
    </div>
  );
}
