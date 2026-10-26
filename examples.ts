import type { Circuit, CircuitComponent, ComponentType, Wire } from '../types';
import { CATALOG } from './catalog';
import { EXTRA_EXAMPLES } from './examplesExtra';

class Builder {
  comps: CircuitComponent[] = [];
  wires: Wire[] = [];
  private n = 0;
  constructor(private key: string) {}
  add(type: ComponentType, x: number, y: number, label = '', props: Record<string, any> = {}) {
    const id = `${this.key}_${++this.n}`;
    this.comps.push({ id, type, x, y, label, props: { ...CATALOG[type].defaults, ...props } });
    return id;
  }
  w(a: string, ap: string, b: string, bp: string, mid?: number) {
    this.wires.push({ id: `${this.key}_w${++this.n}`, a: { c: a, p: ap }, b: { c: b, p: bp }, ...(mid !== undefined ? { mid } : {}) });
  }
  build(): Circuit {
    return { v: 2, components: this.comps, wires: this.wires };
  }
  /** PE from the supply, down the left margin, to an earthed device. */
  pe(G: string, target: string, mid: number) {
    const J = this.add('junction', 0, 130);
    this.w(G, 'PE', J, 'p', 130);
    this.w(J, 'p', target, 'PE', mid);
  }
}

function powerSection(b: Builder, coilId: string, opts: { In?: number; Ir?: number; mIn?: number; kW?: number; curve?: string } = {}) {
  const G = b.add('supply3npe', 40, 40, 'G1');
  const Q1 = b.add('mcb3', 40, 140, 'Q1', { In: opts.In ?? 16, curve: opts.curve ?? 'C' });
  const KM = b.add('contactor_main', 40, 280, '', { parent: coilId });
  const F1 = b.add('overload', 40, 420, 'F1', { Ir: opts.Ir ?? 10 });
  const M1 = b.add('motor3', 40, 560, 'M1', { In: opts.mIn ?? 10, kW: opts.kW ?? 4, load: 1 });
  b.w(G, 'L1', Q1, '1');
  b.w(G, 'L2', Q1, '3');
  b.w(G, 'L3', Q1, '5');
  b.w(Q1, '2', KM, '1');
  b.w(Q1, '4', KM, '3');
  b.w(Q1, '6', KM, '5');
  b.w(KM, '2', F1, '1');
  b.w(KM, '4', F1, '3');
  b.w(KM, '6', F1, '5');
  b.w(F1, '2', M1, 'U');
  b.w(F1, '4', M1, 'V');
  b.w(F1, '6', M1, 'W');
  b.pe(G, M1, 680);
  return { G, Q1, KM, F1, M1 };
}

export function exampleDOL(): Circuit {
  const b = new Builder('dol');
  const KM1 = b.add('coil', 320, 500, 'KM1');
  const { G, F1 } = powerSection(b, KM1);
  const Q2 = b.add('mcb1', 300, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 300, 240, '', { length: 12, name: 'L1' });
  const BN = b.add('busbar', 300, 600, '', { length: 15, name: 'N' });
  const F1nc = b.add('contact_nc', 320, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 320, 340, 'S0');
  const S1 = b.add('pb_no', 320, 420, 'S1');
  const KM1no = b.add('contact_no', 400, 420, '', { parent: KM1 });
  const H1 = b.add('lamp', 460, 500, 'H1', { color: 'green' });
  const F1no = b.add('contact_no', 520, 260, '', { parent: F1 });
  const H2 = b.add('lamp', 520, 500, 'H2', { color: 'red' });
  const J1 = b.add('junction', 600, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p9');
  b.w(BL, 'p12', F1no, '13');
  b.w(F1no, '14', H2, 'X1');
  b.w(H2, 'X2', BN, 'p12');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p15');
  return b.build();
}

export function exampleFwdRev(): Circuit {
  const b = new Builder('fr');
  const KM1 = b.add('coil', 360, 580, 'KM1');
  const KM2 = b.add('coil', 480, 580, 'KM2');
  const { G, Q1, F1 } = powerSection(b, KM1);
  const KM2m = b.add('contactor_main', 160, 280, '', { parent: KM2 });
  b.w(Q1, '2', KM2m, '5', 240);
  b.w(Q1, '4', KM2m, '3', 250);
  b.w(Q1, '6', KM2m, '1', 260);
  b.w(KM2m, '2', F1, '1', 380);
  b.w(KM2m, '4', F1, '3', 390);
  b.w(KM2m, '6', F1, '5', 400);

  const Q2 = b.add('mcb1', 360, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 360, 240, '', { length: 13, name: 'L1' });
  const BN = b.add('busbar', 360, 680, '', { length: 13, name: 'N' });
  const F1nc = b.add('contact_nc', 360, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 360, 340, 'S0');
  const S1 = b.add('pb_no', 360, 420, 'S1 FWD');
  const KM2nc = b.add('contact_nc', 360, 500, '', { parent: KM2 });
  const KM1no = b.add('contact_no', 420, 420, '', { parent: KM1 });
  const S2 = b.add('pb_no', 480, 420, 'S2 REV');
  const KM2no = b.add('contact_no', 540, 420, '', { parent: KM2 });
  const KM1nc = b.add('contact_nc', 480, 500, '', { parent: KM1 });
  const J1 = b.add('junction', 620, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(BL, 'p1', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '13', KM1no, '13');
  b.w(KM1no, '13', S2, '13');
  b.w(S2, '13', KM2no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(S1, '14', KM2nc, '11');
  b.w(KM2nc, '12', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p1');
  b.w(S2, '14', KM2no, '14');
  b.w(S2, '14', KM1nc, '11');
  b.w(KM1nc, '12', KM2, 'A1');
  b.w(KM2, 'A2', BN, 'p7');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p13');
  return b.build();
}

export function exampleStarDelta(): Circuit {
  const b = new Builder('sd');
  const KM1 = b.add('coil', 400, 660, 'KM1');
  const KM3 = b.add('coil', 580, 660, 'KM3 Y');
  const KM2 = b.add('coil', 660, 660, 'KM2 Δ');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const Q1 = b.add('mcb3', 40, 140, 'Q1', { In: 32, curve: 'C' });
  const KM1m = b.add('contactor_main', 40, 280, '', { parent: KM1 });
  const F1 = b.add('overload', 40, 420, 'F1', { Ir: 20 });
  const M1 = b.add('motor6', 40, 560, 'M1', { In: 20, kW: 11, load: 0.3 });
  const KM2m = b.add('contactor_main', 160, 420, '', { parent: KM2 });
  const KM3m = b.add('contactor_main', 280, 560, '', { parent: KM3 });
  b.w(G, 'L1', Q1, '1');
  b.w(G, 'L2', Q1, '3');
  b.w(G, 'L3', Q1, '5');
  b.w(Q1, '2', KM1m, '1');
  b.w(Q1, '4', KM1m, '3');
  b.w(Q1, '6', KM1m, '5');
  b.w(KM1m, '2', F1, '1');
  b.w(KM1m, '4', F1, '3');
  b.w(KM1m, '6', F1, '5');
  b.w(F1, '2', M1, 'U1');
  b.w(F1, '4', M1, 'V1');
  b.w(F1, '6', M1, 'W1');
  b.w(KM1m, '2', KM2m, '1', 400);
  b.w(KM1m, '4', KM2m, '3', 390);
  b.w(KM1m, '6', KM2m, '5', 380);
  b.w(KM2m, '2', M1, 'W2', 680);
  b.w(KM2m, '4', M1, 'U2', 700);
  b.w(KM2m, '6', M1, 'V2', 720);
  b.w(KM2m, '2', KM3m, '1', 540);
  b.w(KM2m, '4', KM3m, '3', 530);
  b.w(KM2m, '6', KM3m, '5', 520);
  b.w(KM3m, '2', KM3m, '4');
  b.w(KM3m, '4', KM3m, '6');
  b.pe(G, M1, 760);

  const Q2 = b.add('mcb1', 400, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 400, 240, '', { length: 15, name: 'L1' });
  const BN = b.add('busbar', 400, 740, '', { length: 18, name: 'N' });
  const F1nc = b.add('contact_nc', 400, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 400, 340, 'S0');
  const S1 = b.add('pb_no', 400, 420, 'S1');
  const KM1no = b.add('contact_no', 460, 420, '', { parent: KM1 });
  const KT1 = b.add('timer', 500, 660, 'KT1', { mode: 'on', delay: 6 });
  const KT1nc = b.add('contact_nc', 580, 500, '', { parent: KT1 });
  const KM2nc = b.add('contact_nc', 580, 580, '', { parent: KM2 });
  const KT1no = b.add('contact_no', 660, 500, '', { parent: KT1 });
  const KM3nc = b.add('contact_nc', 660, 580, '', { parent: KM3 });
  const J1 = b.add('junction', 760, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(BL, 'p1', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A1', KT1, 'A1');
  b.w(S1, '14', KT1nc, '11', 490);
  b.w(KT1nc, '12', KM2nc, '11');
  b.w(KM2nc, '12', KM3, 'A1');
  b.w(KT1nc, '11', KT1no, '13');
  b.w(KT1no, '14', KM3nc, '11');
  b.w(KM3nc, '12', KM2, 'A1');
  b.w(KM1, 'A2', BN, 'p1');
  b.w(KT1, 'A2', BN, 'p6');
  b.w(KM3, 'A2', BN, 'p10');
  b.w(KM2, 'A2', BN, 'p14');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p18');
  return b.build();
}

export function exampleFlasher(): Circuit {
  const b = new Builder('fl');
  const G = b.add('supply1', 40, 40, 'G1');
  const Q1 = b.add('mcb1', 40, 140, 'Q1', { In: 6, curve: 'B' });
  const S1 = b.add('switch', 40, 260, 'S1', { kind: 'selector', contact: 'NO' });
  const KT1 = b.add('timer', 40, 360, 'KT1', { mode: 'flash', delay: 0.5 });
  const KT1no = b.add('contact_no', 140, 360, '', { parent: KT1 });
  const H1 = b.add('lamp', 140, 440, 'H1', { color: 'yellow' });
  const KT1nc = b.add('contact_nc', 200, 360, '', { parent: KT1 });
  const H2 = b.add('lamp', 200, 440, 'H2', { color: 'green' });
  const BN = b.add('busbar', 40, 540, '', { length: 12, name: 'N' });
  const J1 = b.add('junction', 280, 100);
  b.w(G, 'L', Q1, '1');
  b.w(Q1, '2', S1, '1');
  b.w(S1, '2', KT1, 'A1');
  b.w(S1, '2', KT1no, '13', 340);
  b.w(KT1no, '13', KT1nc, '11');
  b.w(KT1no, '14', H1, 'X1');
  b.w(KT1nc, '12', H2, 'X1');
  b.w(KT1, 'A2', BN, 'p1');
  b.w(H1, 'X2', BN, 'p6');
  b.w(H2, 'X2', BN, 'p9');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p12');
  return b.build();
}

export function exampleLevel(): Circuit {
  const b = new Builder('lv');
  const KM1 = b.add('coil', 320, 500, 'KM1');
  const { G, F1 } = powerSection(b, KM1, { In: 10, Ir: 4, mIn: 4, kW: 1.5 });
  const Q2 = b.add('mcb1', 300, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 300, 240, '', { length: 14, name: 'L1' });
  const BN = b.add('busbar', 300, 600, '', { length: 16, name: 'N' });
  const F1nc = b.add('contact_nc', 320, 260, '', { parent: F1 });
  const S1 = b.add('switch', 320, 340, 'S1 AUTO', { kind: 'selector', contact: 'NO' });
  const S2 = b.add('switch', 320, 420, 'LSL', { kind: 'float', contact: 'NO' });
  const H1 = b.add('lamp', 400, 500, 'H1', { color: 'green' });
  const S3 = b.add('switch', 480, 340, 'PSH', { kind: 'pressure', contact: 'NO' });
  const HA1 = b.add('buzzer', 480, 500, 'HA1');
  const H2 = b.add('lamp', 540, 500, 'H2', { color: 'red' });
  const J1 = b.add('junction', 620, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S1, '1');
  b.w(S1, '2', S2, '1');
  b.w(S2, '2', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p6');
  b.w(BL, 'p10', S3, '1');
  b.w(S3, '2', HA1, 'X1');
  b.w(HA1, 'X1', H2, 'X1');
  b.w(HA1, 'X2', BN, 'p10');
  b.w(H2, 'X2', BN, 'p13');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p16');
  return b.build();
}

export function exampleTwoPlace(): Circuit {
  const b = new Builder('tp');
  const KM1 = b.add('coil', 320, 580, 'KM1');
  const { G, F1 } = powerSection(b, KM1);
  const Q2 = b.add('mcb1', 300, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 300, 240, '', { length: 12, name: 'L1' });
  const BN = b.add('busbar', 300, 680, '', { length: 14, name: 'N' });
  const F1nc = b.add('contact_nc', 320, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 320, 340, 'S0 STOP A');
  const S01 = b.add('pb_nc', 320, 420, 'S01 STOP B');
  const S1 = b.add('pb_no', 320, 500, 'S1 START A');
  const S2 = b.add('pb_no', 380, 500, 'S2 START B');
  const KM1no = b.add('contact_no', 440, 500, '', { parent: KM1 });
  const H1 = b.add('lamp', 500, 580, 'H1', { color: 'green' });
  const J1 = b.add('junction', 580, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(BL, 'p1', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S01, '11');
  b.w(S01, '12', S1, '13');
  b.w(S1, '13', S2, '13');
  b.w(S2, '13', KM1no, '13');
  b.w(S1, '14', S2, '14');
  b.w(S2, '14', KM1no, '14');
  b.w(S1, '14', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p1');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p11');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p14');
  return b.build();
}

export const EXAMPLES: { key: string; titleKey: string; descKey: string; build: () => Circuit }[] = [
  { key: 'dol', titleKey: 'ex_dol', descKey: 'ex_dol_d', build: exampleDOL },
  { key: 'fwdrev', titleKey: 'ex_fwdrev', descKey: 'ex_fwdrev_d', build: exampleFwdRev },
  { key: 'stardelta', titleKey: 'ex_stardelta', descKey: 'ex_stardelta_d', build: exampleStarDelta },
  { key: 'twoplace', titleKey: 'ex_twoplace', descKey: 'ex_twoplace_d', build: exampleTwoPlace },
  { key: 'level', titleKey: 'ex_level', descKey: 'ex_level_d', build: exampleLevel },
  { key: 'flasher', titleKey: 'ex_flasher', descKey: 'ex_flasher_d', build: exampleFlasher },
  ...EXTRA_EXAMPLES,
];
