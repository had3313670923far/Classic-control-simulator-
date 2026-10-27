export type ComponentType =
  | 'supply3npe'
  | 'supply3pe'
  | 'supply3'
  | 'supply1p'
  | 'supply1n'
  | 'supply1pe'
  | 'supply1'
  | 'supply1npe'
  | 'psu24'
  | 'busbar'
  | 'junction'
  | 'mcb1'
  | 'mcb2'
  | 'mcb3'
  | 'mccb'
  | 'mccb4'
  | 'mpcb'
  | 'fuse'
  | 'fuse2'
  | 'fuse3'
  | 'fsw1'
  | 'fsw2'
  | 'fsw3'
  | 'iso1'
  | 'iso2'
  | 'iso3'
  | 'cos1'
  | 'esw1'
  | 'rccb'
  | 'rcbo'
  | 'rccb4'
  | 'overload'
  | 'ol_no'
  | 'ol_nc'
  | 'phasemon'
  | 'ph1mon'
  | 'phr_coil'
  | 'pmr'
  | 'floatless'
  | 'ph_no'
  | 'ph_nc'
  | 'contactor_main'
  | 'contactor_main1'
  | 'contactor_main2'
  | 'contactor_main4'
  | 'dol_combo'
  | 'aux4'
  | 'coil'
  | 'relay'
  | 'safety'
  | 'timer'
  | 'ton'
  | 'tof'
  | 'tsd'
  | 'tp'
  | 'rto'
  | 'tcy'
  | 'contact_no'
  | 'contact_nc'
  | 'co'
  | 'timer_no'
  | 'timer_nc'
  | 'timer_co'
  | 'timer_star'
  | 'pb_no'
  | 'pb_nc'
  | 'pb_dual'
  | 'estop'
  | 'switch'
  | 'sens_limit'
  | 'sens_float'
  | 'sens_pressure'
  | 'sens_temp'
  | 'sens_photo'
  | 'sens_prox'
  | 'sens_reed'
  | 'sens_flow'
  | 'sens_vibration'
  | 'stc3008'
  | 'resistor'
  | 'capacitor'
  | 'diode'
  | 'led'
  | 'npn'
  | 'pnp'
  | 'scr'
  | 'ic555'
  | 'optocoupler'
  | 'bridge'
  | 'regulator'
  | 'inductor'
  | 'varistor'
  | 'lamp_neon'
  | 'buzzer_piezo'
  | 'tank'
  | 'ntc'
  | 'sel3'
  | 'lamp'
  | 'buzzer'
  | 'horn'
  | 'bell'
  | 'motor3'
  | 'motor6'
  | 'motor1'
  | 'res_fixed'
  | 'pot'
  | 'ldr'
  | 'thermistor'
  | 'res_net'
  | 'cap_elec'
  | 'cap_ceramic'
  | 'cap_film'
  | 'cap_mica'
  | 'supercap'
  | 'cap_var'
  | 'choke'
  | 'toroid'
  | 'air_core'
  | 'var_inductor'
  | 'transformer'
  | 'transformer_iso'
  | 'autotransformer'
  | 'ct'
  | 'pt'
  | 'crystal'
  | 'fuse_glass'
  | 'fuse_blade'
  | 'fuse_ptc'
  | 'saw'
  | 'diode_rect'
  | 'diode_zener'
  | 'diode_schottky'
  | 'photodiode'
  | 'varactor'
  | 'tvs'
  | 'tunnel'
  | 'bjt'
  | 'darlington'
  | 'phototransistor'
  | 'jfet'
  | 'mosfet'
  | 'igbt'
  | 'scr_ic'
  | 'triac'
  | 'diac'
  | 'gto'
  | 'opamp'
  | 'comparator'
  | 'pll'
  | 'motor_driver'
  | 'uln'
  | 'transceiver'
  | 'reg_linear'
  | 'reg_smps'
  | 'eeprom'
  | 'sram'
  | 'dram'
  | 'flash'
  | 'logic'
  | 'flipflop'
  | 'shiftreg'
  | 'counter'
  | 'mcu'
  | 'mpu'
  | 'dsp'
  | 'fpga'
  | 'optocoupler_ic'
  | 'triac_coupler'
  | 'switch_push'
  | 'switch_toggle'
  | 'switch_dip'
  | 'switch_rotary'
  | 'switch_micro'
  | 'reed'
  | 'relay_emr'
  | 'relay_latch'
  | 'dc_motor'
  | 'bldc'
  | 'stepper'
  | 'servo'
  | 'solenoid'
  | 'terminal_block'
  | 'header'
  | 'power_jack'
  | 'usb_port'
  | 'audio_jack'
  | 'ic_socket'
  | 'heatsink'
  | 'buzzer_active'
  | 'speaker'
  | 'microphone'
  | 'cooling_fan'
  | 'rotary_encoder'
  | 'strain_gauge'
;

export interface TermRef {
  c: string; // component id
  p: string; // pin id
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  label: string;
  props: Record<string, any>;
  rot?: number; // 0 | 90 | 180 | 270
  mirror?: boolean; // flipped horizontally
  locked?: boolean; // position/rotation locked on canvas
}

export type WireRoute = 'auto' | 'elbow' | 'parallel' | 'plus' | 'tee' | 'arc' | 'step' | 'zigzag' | 'straight' | 'rail' | 'offset';

export interface Wire {
  id: string;
  a: TermRef;
  b: TermRef;
  mid?: number; // optional override of the middle segment coordinate
  hv?: boolean; // true = horizontal-first routing (middle segment moves left/right)
  size?: number; // wire stroke size preset: 2 / 3 / 4 / 6
  route?: WireRoute; // optional explicit routing style
  joints?: { x: number; y: number }[]; // extra T / junction points
  color?: string; // user wire colour (edit mode); empty = auto
}

export interface Note {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface Circuit {
  v?: number; // schema version
  components: CircuitComponent[];
  wires: Wire[];
  notes?: Note[];
}

export interface Sheet {
  name: string;
  circuit: Circuit;
}

export interface Project {
  v?: number;
  sheets: Sheet[];
  active: number;
}

export interface Account {
  name: string;
  email: string;
}

export interface PinDef {
  id: string;
  x: number;
  y: number;
  dir: 'up' | 'down' | 'none';
}

export type Potential = 'L1' | 'L2' | 'L3' | 'N' | 'PE' | 'P24' | 'M24';

export interface DeviceState {
  on?: boolean; // mcb on, switch actuated, estop latched
  tripped?: boolean; // mcb / overload / fuse(blown) / supply
  pressed?: boolean; // pushbuttons
  pos?: number; // rotary position (changeover / 3-pos selector)
  noClosed?: boolean; // dual pushbutton NO side
  ncClosed?: boolean; // dual pushbutton NC side
  energized?: boolean; // coils / timers / psu
  out?: boolean; // timer output
  heat?: number; // thermal accumulator 0..1
  t?: number; // timer elapsed
  fired?: boolean; // one-shot fired / cyclic started latch
  speed?: number; // motor speed 0..1
  dir?: 1 | -1 | 0; // motor direction
  current?: number; // measured current (A)
  volt?: number; // measured voltage (V)
  burnt?: boolean; // coil / lamp burnt out
  load?: number; // motor mechanical load factor
  config?: 'star' | 'delta' | 'single' | 'none' | 'run';
  msg?: string;
  level?: number; // tank water level 0..1
  temp?: number; // measured temperature (°C)
  setpoint?: number; // controller set point
  hysteresis?: number;
  wait?: number; // restart delay accumulator (s)
  filled?: boolean; // floatless fill-demand latch
}

export interface SimEvent {
  id: number;
  time: number;
  text: string;
  level: 'info' | 'warn' | 'error' | 'ok';
}

export interface SimSnapshot {
  time: number;
  states: Record<string, DeviceState>;
  termPot: Record<string, Potential | undefined>;
  wireCurrent: Record<string, number>;
  faultWires: Set<string>;
  faultTerms: Set<string>;
}

export type Mode = 'edit' | 'run';
export type Lang = 'en' | 'bn' | 'ar';
