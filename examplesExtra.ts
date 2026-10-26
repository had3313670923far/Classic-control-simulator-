import type { Circuit, CircuitComponent, ComponentType, Wire } from '../types';
import { CATALOG } from './catalog';

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
  link(id: string, parent: string) {
    const c = this.comps.find((k) => k.id === id);
    if (c) c.props = { ...c.props, parent };
  }
  w(a: string, ap: string, b: string, bp: string, mid?: number) {
    this.wires.push({ id: `${this.key}_w${++this.n}`, a: { c: a, p: ap }, b: { c: b, p: bp }, ...(mid !== undefined ? { mid } : {}) });
  }
  build(): Circuit {
    return { v: 2, components: this.comps, wires: this.wires };
  }
  pe(G: string, target: string, mid: number) {
    const J = this.add('junction', 0, 130);
    this.w(G, 'PE', J, 'p', 130);
    this.w(J, 'p', target, 'PE', mid);
  }
}

/** One 3-phase motor power column sharing a supply. */
function powerAt(b: Builder, x: number, G: string, coilId: string, o: { q: string; f: string; m: string; In?: number; Ir?: number; mIn?: number; kW?: number }) {
  const Q1 = b.add('mcb3', x, 140, o.q, { In: o.In ?? 16, curve: 'C' });
  const KM = b.add('contactor_main', x, 280, '', { parent: coilId });
  const F1 = b.add('overload', x, 420, o.f, { Ir: o.Ir ?? 10 });
  const M1 = b.add('motor3', x, 560, o.m, { In: o.mIn ?? 10, kW: o.kW ?? 4, load: 1 });
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
  return { Q1, KM, F1, M1 };
}

/** 230 V control supply: MCB + L1 rail + N rail fed from a 3-phase supply at x=40. */
function ctlSupply(b: Builder, G: string, x = 300, opts: { q?: string; blLen?: number; bnLen?: number; bnY?: number; blY?: number } = {}) {
  const blLen = opts.blLen ?? 12;
  const bnLen = opts.bnLen ?? 15;
  const bnY = opts.bnY ?? 600;
  const Q2 = b.add('mcb1', x, 140, opts.q || 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', x, opts.blY ?? 240, '', { length: blLen, name: 'L1' });
  const BN = b.add('busbar', x, bnY, '', { length: bnLen, name: 'N' });
  const J1 = b.add('junction', x + bnLen * 20, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p' + bnLen);
  return { Q2, BL, BN };
}

/** Star-delta power section (line/star/delta contactors + 6-terminal motor). */
function sdPower(b: Builder, G: string, KM1: string, KM2: string, KM3: string) {
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
  return { Q1, F1, M1 };
}

// 7. Hand / Off / Auto DOL
export function exHandAuto(): Circuit {
  const b = new Builder('ha');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 320, 500, 'KM1');
  const { F1, M1 } = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  b.pe(G, M1, 680);
  const { BL, BN } = ctlSupply(b, G);
  const F1nc = b.add('contact_nc', 320, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 320, 340, 'S0');
  const S1 = b.add('switch', 320, 420, 'HAND', { kind: 'selector', contact: 'NO' });
  const S2 = b.add('switch', 400, 420, 'AUTO', { kind: 'selector', contact: 'NO' });
  const LS = b.add('switch', 400, 500, 'LSL', { kind: 'float', contact: 'NO' });
  const H1 = b.add('lamp', 460, 500, 'H1', { color: 'green' });
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '1');
  b.w(S0, '12', S2, '1');
  b.w(S1, '2', KM1, 'A1');
  b.w(S2, '2', LS, '1');
  b.w(LS, '2', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p9');
  return b.build();
}

// 8. Jog + Run control
export function exJog(): Circuit {
  const b = new Builder('jg');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 320, 500, 'KM1');
  const { F1, M1 } = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  b.pe(G, M1, 680);
  const { BL, BN } = ctlSupply(b, G);
  const F1nc = b.add('contact_nc', 320, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 320, 340, 'S0');
  const S1 = b.add('pb_no', 320, 420, 'S1 RUN');
  const KM1no = b.add('contact_no', 400, 420, '', { parent: KM1 });
  const S2 = b.add('pb_dual', 400, 500, 'S2 JOG');
  const H1 = b.add('lamp', 460, 500, 'H1', { color: 'green' });
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '13', KM1no, '13');
  b.w(KM1no, '13', S2, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(KM1no, '14', S2, '11');
  b.w(S2, '12', KM1, 'A1');
  b.w(S2, '14', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p9');
  return b.build();
}

// 9. Auto-reverse with limit switches
export function exAutoRev(): Circuit {
  const b = new Builder('ar');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 360, 580, 'KM1');
  const KM2 = b.add('coil', 480, 580, 'KM2');
  const { Q1, F1, M1 } = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  b.pe(G, M1, 680);
  const KM2m = b.add('contactor_main', 160, 280, '', { parent: KM2 });
  b.w(Q1, '2', KM2m, '5', 240);
  b.w(Q1, '4', KM2m, '3', 250);
  b.w(Q1, '6', KM2m, '1', 260);
  b.w(KM2m, '2', F1, '1', 380);
  b.w(KM2m, '4', F1, '3', 390);
  b.w(KM2m, '6', F1, '5', 400);
  const { BL, BN } = ctlSupply(b, G, 360, { blLen: 13, bnLen: 13, bnY: 680 });
  const F1nc = b.add('contact_nc', 360, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 360, 340, 'S0');
  const S1 = b.add('pb_no', 360, 420, 'S1 FWD');
  const KM1no = b.add('contact_no', 420, 420, '', { parent: KM1 });
  const KM2nc = b.add('contact_nc', 360, 500, '', { parent: KM2 });
  const LS1 = b.add('switch', 280, 500, 'LS1', { kind: 'limit', contact: 'CO' });
  const S2 = b.add('pb_no', 480, 420, 'S2 REV');
  const KM2no = b.add('contact_no', 540, 420, '', { parent: KM2 });
  const KM1nc = b.add('contact_nc', 480, 500, '', { parent: KM1 });
  const LS2 = b.add('switch', 560, 500, 'LS2', { kind: 'limit', contact: 'CO' });
  b.w(BL, 'p1', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', LS1, '11');
  b.w(S0, '12', LS2, '11');
  b.w(LS1, '12', S1, '13');
  b.w(LS2, '12', S2, '13');
  b.w(S1, '13', KM1no, '13');
  b.w(S2, '13', KM2no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(S1, '14', KM2nc, '11');
  b.w(KM2nc, '12', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p1');
  b.w(S2, '14', KM2no, '14');
  b.w(S2, '14', KM1nc, '11');
  b.w(KM1nc, '12', KM2, 'A1');
  b.w(KM2, 'A2', BN, 'p7');
  b.w(LS1, '14', S2, '14');
  b.w(LS2, '14', S1, '14');
  return b.build();
}

// 10. Manual star-delta
export function exManDelta(): Circuit {
  const b = new Builder('md');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 400, 660, 'KM1');
  const KM3 = b.add('coil', 580, 660, 'KM3 Y');
  const KM2 = b.add('coil', 660, 660, 'KM2 D');
  const { F1 } = sdPower(b, G, KM1, KM2, KM3);
  const Q2 = b.add('mcb1', 400, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 400, 240, '', { length: 15, name: 'L1' });
  const BN = b.add('busbar', 400, 740, '', { length: 18, name: 'N' });
  const J1 = b.add('junction', 760, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p18');
  const F1nc = b.add('contact_nc', 400, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 400, 340, 'S0');
  const S1 = b.add('pb_no', 400, 420, 'S1 Y');
  const KM1no = b.add('contact_no', 460, 420, '', { parent: KM1 });
  const KM2nc = b.add('contact_nc', 580, 580, '', { parent: KM2 });
  const S2 = b.add('pb_no', 660, 500, 'S2 D');
  const KM2no = b.add('contact_no', 720, 500, '', { parent: KM2 });
  const KM3nc = b.add('contact_nc', 660, 580, '', { parent: KM3 });
  b.w(BL, 'p1', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(S1, '14', KM2nc, '11', 490);
  b.w(KM2nc, '12', KM3, 'A1');
  b.w(KM2nc, '11', S2, '13');
  b.w(S2, '14', KM3nc, '11');
  b.w(KM3nc, '12', KM2, 'A1');
  b.w(S2, '13', KM2no, '13');
  b.w(S2, '14', KM2no, '14');
  b.w(KM1, 'A2', BN, 'p1');
  b.w(KM3, 'A2', BN, 'p10');
  b.w(KM2, 'A2', BN, 'p14');
  return b.build();
}

// 11. Star-delta with 24 V control
export function exSD24(): Circuit {
  const b = new Builder('s24');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 400, 660, 'KM1', { V: 24 });
  const KM3 = b.add('coil', 580, 660, 'KM3 Y', { V: 24 });
  const KM2 = b.add('coil', 660, 660, 'KM2 D', { V: 24 });
  const { F1 } = sdPower(b, G, KM1, KM2, KM3);
  const T1 = b.add('psu24', 400, 140, 'T1');
  const BL = b.add('busbar', 400, 300, '', { length: 15, name: '+24' });
  const BN = b.add('busbar', 400, 740, '', { length: 18, name: '0V' });
  const J0 = b.add('junction', 760, 300);
  b.w(G, 'L1', T1, 'L', 110);
  b.w(G, 'N', T1, 'N', 120);
  b.w(G, 'PE', T1, 'PE', 130);
  b.w(T1, '+24', BL, 'p1');
  b.w(T1, '0V', J0, 'p', 260);
  b.w(J0, 'p', BN, 'p18');
  const F1nc = b.add('contact_nc', 400, 320, '', { parent: F1 });
  const S0 = b.add('pb_nc', 400, 400, 'S0');
  const S1 = b.add('pb_no', 400, 480, 'S1');
  const KM1no = b.add('contact_no', 460, 480, '', { parent: KM1 });
  const KT1 = b.add('timer', 500, 660, 'KT1', { mode: 'on', delay: 6, V: 24 });
  const KT1nc = b.add('contact_nc', 580, 500, '', { parent: KT1 });
  const KM2nc = b.add('contact_nc', 580, 580, '', { parent: KM2 });
  const KT1no = b.add('contact_no', 660, 500, '', { parent: KT1 });
  const KM3nc = b.add('contact_nc', 660, 580, '', { parent: KM3 });
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
  return b.build();
}

// 12. Two-motor timer sequence
export function exSeq2(): Circuit {
  const b = new Builder('sq2');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 380, 580, 'KM1');
  const KM2 = b.add('coil', 560, 580, 'KM2');
  const p1 = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  const p2 = powerAt(b, 200, G, KM2, { q: 'Q3', f: 'F2', m: 'M2' });
  b.pe(G, p1.M1, 680);
  b.pe(G, p2.M1, 680);
  const { BL, BN } = ctlSupply(b, G, 380, { blLen: 12, bnLen: 14, bnY: 660 });
  const F1nc = b.add('contact_nc', 380, 260, '', { parent: p1.F1 });
  const F2nc = b.add('contact_nc', 380, 340, '', { parent: p2.F1 });
  const S0 = b.add('pb_nc', 380, 420, 'S0');
  const S1 = b.add('pb_no', 380, 500, 'S1');
  const KM1no = b.add('contact_no', 440, 500, '', { parent: KM1 });
  const KT1 = b.add('timer', 440, 580, 'KT1', { mode: 'on', delay: 5 });
  const KTno = b.add('contact_no', 500, 420, '', { parent: KT1 });
  const H1 = b.add('lamp', 500, 580, 'H1', { color: 'green' });
  const H2 = b.add('lamp', 620, 580, 'H2', { color: 'green' });
  b.w(BL, 'p1', F1nc, '11');
  b.w(F1nc, '12', F2nc, '11');
  b.w(F2nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A1', KT1, 'A1');
  b.w(S1, '14', KTno, '13');
  b.w(KTno, '14', KM2, 'A1');
  b.w(KM1, 'A2', BN, 'p1');
  b.w(KT1, 'A2', BN, 'p4');
  b.w(KM2, 'A2', BN, 'p10');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p7');
  b.w(KM2, 'A1', H2, 'X1');
  b.w(H2, 'X2', BN, 'p13');
  return b.build();
}

// 13. M2 permissive on M1 running
export function exPermissive(): Circuit {
  const b = new Builder('pm');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 380, 500, 'KM1');
  const KM2 = b.add('coil', 520, 580, 'KM2');
  const p1 = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  const p2 = powerAt(b, 200, G, KM2, { q: 'Q3', f: 'F2', m: 'M2' });
  b.pe(G, p1.M1, 680);
  b.pe(G, p2.M1, 680);
  const Q2 = b.add('mcb1', 380, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 380, 240, '', { length: 12, name: 'L1' });
  const BN = b.add('busbar', 300, 660, '', { length: 15, name: 'N' });
  const J1 = b.add('junction', 600, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p15');
  const F1nc = b.add('contact_nc', 380, 260, '', { parent: p1.F1 });
  const S0 = b.add('pb_nc', 380, 340, 'S0');
  const S1 = b.add('pb_no', 380, 420, 'S1 M1');
  const KM1no = b.add('contact_no', 440, 420, '', { parent: KM1 });
  const F2nc = b.add('contact_nc', 520, 340, '', { parent: p2.F1 });
  const S2 = b.add('pb_no', 520, 420, 'S2 M2');
  const PERM = b.add('contact_no', 520, 500, '', { parent: KM1 });
  const KM2no = b.add('contact_no', 580, 420, '', { parent: KM2 });
  const H1 = b.add('lamp', 300, 500, 'H1', { color: 'green' });
  const H2 = b.add('lamp', 580, 500, 'H2', { color: 'green' });
  b.w(BL, 'p1', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A2', BN, 'p5');
  b.w(S0, '12', F2nc, '11');
  b.w(F2nc, '12', S2, '13');
  b.w(S2, '14', PERM, '13');
  b.w(PERM, '14', KM2, 'A1');
  b.w(S2, '13', KM2no, '13');
  b.w(S2, '14', KM2no, '14');
  b.w(KM2, 'A2', BN, 'p12');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p1');
  b.w(KM2, 'A1', H2, 'X1');
  b.w(H2, 'X2', BN, 'p15');
  return b.build();
}

// 14. Three-motor cascade
export function exCascade3(): Circuit {
  const b = new Builder('c3');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 460, 660, 'KM1');
  const KM2 = b.add('coil', 640, 660, 'KM2');
  const KM3 = b.add('coil', 780, 660, 'KM3');
  const p1 = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  const p2 = powerAt(b, 180, G, KM2, { q: 'Q3', f: 'F2', m: 'M2' });
  const p3 = powerAt(b, 320, G, KM3, { q: 'Q5', f: 'F3', m: 'M3' });
  b.pe(G, p1.M1, 680);
  b.pe(G, p2.M1, 680);
  b.pe(G, p3.M1, 680);
  const { BL, BN } = ctlSupply(b, G, 460, { blLen: 16, bnLen: 18, bnY: 740 });
  const F1nc = b.add('contact_nc', 460, 260, '', { parent: p1.F1 });
  const F2nc = b.add('contact_nc', 460, 340, '', { parent: p2.F1 });
  const F3nc = b.add('contact_nc', 460, 420, '', { parent: p3.F1 });
  const S0 = b.add('pb_nc', 460, 500, 'S0');
  const S1 = b.add('pb_no', 460, 580, 'S1');
  const KM1no = b.add('contact_no', 520, 580, '', { parent: KM1 });
  const KT1 = b.add('timer', 560, 660, 'KT1', { mode: 'on', delay: 5 });
  const KT1no = b.add('contact_no', 560, 580, '', { parent: KT1 });
  const KM2no = b.add('contact_no', 620, 580, '', { parent: KM2 });
  const KT2 = b.add('timer', 700, 660, 'KT2', { mode: 'on', delay: 5 });
  const KT2no = b.add('contact_no', 700, 580, '', { parent: KT2 });
  const KM3no = b.add('contact_no', 760, 580, '', { parent: KM3 });
  b.w(BL, 'p1', F1nc, '11');
  b.w(F1nc, '12', F2nc, '11');
  b.w(F2nc, '12', F3nc, '11');
  b.w(F3nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(S1, '14', KT1, 'A1');
  b.w(S1, '14', KT1no, '13');
  b.w(KT1no, '14', KM2, 'A1');
  b.w(KT1no, '13', KM2no, '13');
  b.w(KT1no, '14', KM2no, '14');
  b.w(KM2, 'A1', KT2, 'A1');
  b.w(KM2, 'A1', KT2no, '13');
  b.w(KT2no, '14', KM3, 'A1');
  b.w(KT2no, '13', KM3no, '13');
  b.w(KT2no, '14', KM3no, '14');
  b.w(KM1, 'A2', BN, 'p1');
  b.w(KT1, 'A2', BN, 'p6');
  b.w(KM2, 'A2', BN, 'p10');
  b.w(KT2, 'A2', BN, 'p13');
  b.w(KM3, 'A2', BN, 'p17');
  return b.build();
}

// 15. Mains–generator ATS (manual transfer)
export function exATS(): Circuit {
  const b = new Builder('ats');
  const G1 = b.add('supply3npe', 40, 40, 'G1');
  const G2 = b.add('supply3npe', 260, 40, 'G2');
  const KM1 = b.add('coil', 460, 580, 'KM1');
  const KM2 = b.add('coil', 580, 580, 'KM2');
  const Q1 = b.add('mcb3', 40, 140, 'Q1', { In: 32, curve: 'C' });
  const KM1m = b.add('contactor_main', 40, 280, '', { parent: KM1 });
  const F1 = b.add('overload', 40, 420, 'F1', { Ir: 20 });
  const M1 = b.add('motor3', 40, 560, 'M1', { In: 20, kW: 11, load: 1 });
  const Q3 = b.add('mcb3', 260, 140, 'Q3', { In: 32, curve: 'C' });
  const KM2m = b.add('contactor_main', 260, 280, '', { parent: KM2 });
  b.w(G1, 'L1', Q1, '1');
  b.w(G1, 'L2', Q1, '3');
  b.w(G1, 'L3', Q1, '5');
  b.w(Q1, '2', KM1m, '1');
  b.w(Q1, '4', KM1m, '3');
  b.w(Q1, '6', KM1m, '5');
  b.w(KM1m, '2', F1, '1');
  b.w(KM1m, '4', F1, '3');
  b.w(KM1m, '6', F1, '5');
  b.w(F1, '2', M1, 'U');
  b.w(F1, '4', M1, 'V');
  b.w(F1, '6', M1, 'W');
  b.w(G2, 'L1', Q3, '1');
  b.w(G2, 'L2', Q3, '3');
  b.w(G2, 'L3', Q3, '5');
  b.w(Q3, '2', KM2m, '1');
  b.w(Q3, '4', KM2m, '3');
  b.w(Q3, '6', KM2m, '5');
  b.w(KM2m, '2', F1, '1', 380);
  b.w(KM2m, '4', F1, '3', 390);
  b.w(KM2m, '6', F1, '5', 400);
  b.pe(G1, M1, 680);
  const Q2 = b.add('mcb1', 460, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 460, 240, '', { length: 6, name: 'L1' });
  const BN = b.add('busbar', 460, 660, '', { length: 16, name: 'N' });
  const J1 = b.add('junction', 780, 100);
  b.w(G1, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(G1, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p16');
  const F1nc = b.add('contact_nc', 460, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 460, 340, 'S0');
  const S1 = b.add('pb_no', 460, 420, 'S1 MAINS');
  const KM1no = b.add('contact_no', 520, 420, '', { parent: KM1 });
  const KM2nc = b.add('contact_nc', 460, 500, '', { parent: KM2 });
  const S2 = b.add('pb_no', 580, 420, 'S2 GEN');
  const KM2no = b.add('contact_no', 640, 420, '', { parent: KM2 });
  const KM1nc = b.add('contact_nc', 580, 500, '', { parent: KM1 });
  const H1 = b.add('lamp', 700, 580, 'H1', { color: 'green' });
  const H2 = b.add('lamp', 760, 580, 'H2', { color: 'yellow' });
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
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p13');
  b.w(KM2, 'A1', H2, 'X1');
  b.w(H2, 'X2', BN, 'p16');
  return b.build();
}

// 16. Star-delta + phase-failure monitor
export function exSDPhase(): Circuit {
  const b = new Builder('sdp');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 400, 660, 'KM1');
  const KM3 = b.add('coil', 580, 660, 'KM3 Y');
  const KM2 = b.add('coil', 660, 660, 'KM2 D');
  const { F1 } = sdPower(b, G, KM1, KM2, KM3);
  const U1 = b.add('phasemon', 280, 140, 'U1');
  b.w(G, 'L1', U1, 'L1', 110);
  b.w(G, 'L2', U1, 'L2', 120);
  b.w(G, 'L3', U1, 'L3', 130);
  const Q2 = b.add('mcb1', 400, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 400, 240, '', { length: 15, name: 'L1' });
  const BN = b.add('busbar', 400, 740, '', { length: 18, name: 'N' });
  const J1 = b.add('junction', 760, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p18');
  const PH = b.add('ph_no', 400, 260, '', { parent: U1 });
  const F1nc = b.add('contact_nc', 400, 340, '', { parent: F1 });
  const S0 = b.add('pb_nc', 400, 420, 'S0');
  const S1 = b.add('pb_no', 400, 500, 'S1');
  const KM1no = b.add('contact_no', 460, 500, '', { parent: KM1 });
  const KT1 = b.add('timer', 500, 660, 'KT1', { mode: 'on', delay: 6 });
  const KT1nc = b.add('contact_nc', 580, 500, '', { parent: KT1 });
  const KM2nc = b.add('contact_nc', 580, 580, '', { parent: KM2 });
  const KT1no = b.add('contact_no', 660, 500, '', { parent: KT1 });
  const KM3nc = b.add('contact_nc', 660, 580, '', { parent: KM3 });
  b.w(BL, 'p1', PH, '15');
  b.w(PH, '18', F1nc, '11');
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
  return b.build();
}

// 17. DOL with overload signaling (95-96 / 97-98)
export function exDOLol(): Circuit {
  const b = new Builder('dol');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 320, 500, 'KM1');
  const { F1, M1 } = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  b.pe(G, M1, 680);
  const { BL, BN } = ctlSupply(b, G);
  const ONC = b.add('ol_nc', 320, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 320, 340, 'S0');
  const S1 = b.add('pb_no', 320, 420, 'S1');
  const KM1no = b.add('contact_no', 400, 420, '', { parent: KM1 });
  const H1 = b.add('lamp', 460, 500, 'H1', { color: 'green' });
  const ONO = b.add('ol_no', 520, 260, '', { parent: F1 });
  const H2 = b.add('lamp', 520, 500, 'H2', { color: 'red' });
  b.w(BL, 'p2', ONC, '95');
  b.w(ONC, '96', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p9');
  b.w(BL, 'p12', ONO, '97');
  b.w(ONO, '98', H2, 'X1');
  b.w(H2, 'X2', BN, 'p12');
  return b.build();
}

// 18. RCCB-protected single-phase DOL with earth-fault test
export function exDOLrccb(): Circuit {
  const b = new Builder('rc');
  const G = b.add('supply1npe', 40, 40, 'G2');
  const KM1 = b.add('coil', 200, 280, 'KM1');
  const Q1 = b.add('mcb1', 40, 140, 'Q1', { In: 16, curve: 'C' });
  const Q2 = b.add('rccb', 40, 240, 'Q2', { Idn: 30 });
  const KM = b.add('contactor_main', 40, 360, '', { parent: KM1 });
  const M1 = b.add('motor1', 40, 500, 'M1', { In: 4, kW: 0.75, load: 1 });
  const JN = b.add('junction', 100, 160);
  const JR = b.add('junction', 140, 380);
  b.w(G, 'L', Q1, '1');
  b.w(Q1, '2', Q2, '1');
  b.w(G, 'N', JN, 'p');
  b.w(JN, 'p', Q2, '3');
  b.w(Q2, '2', KM, '1');
  b.w(KM, '2', M1, 'L');
  b.w(Q2, '4', JR, 'p');
  b.w(JR, 'p', M1, 'N', 460);
  b.w(G, 'PE', M1, 'PE', 600);
  const S0 = b.add('pb_nc', 200, 140, 'S0');
  const S1 = b.add('pb_no', 200, 220, 'S1');
  const KM1no = b.add('contact_no', 260, 220, '', { parent: KM1 });
  const S2 = b.add('pb_no', 200, 360, 'S2 TEST');
  const H1 = b.add('lamp', 320, 280, 'H1', { color: 'green' });
  b.w(Q2, '2', S0, '11', 230);
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A2', JR, 'p');
  b.w(KM, '2', S2, '13', 400);
  b.w(S2, '14', G, 'PE', 250);
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', KM1, 'A2');
  return b.build();
}

// 19. MPCB-protected DOL
export function exMPCB(): Circuit {
  const b = new Builder('mp');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 320, 420, 'KM1');
  const Q1 = b.add('mpcb', 40, 140, 'Q1', { Ir: 10 });
  const KM = b.add('contactor_main', 40, 280, '', { parent: KM1 });
  const M1 = b.add('motor3', 40, 420, 'M1', { In: 10, kW: 4, load: 1 });
  b.w(G, 'L1', Q1, '1');
  b.w(G, 'L2', Q1, '3');
  b.w(G, 'L3', Q1, '5');
  b.w(Q1, '2', KM, '1');
  b.w(Q1, '4', KM, '3');
  b.w(Q1, '6', KM, '5');
  b.w(KM, '2', M1, 'U');
  b.w(KM, '4', M1, 'V');
  b.w(KM, '6', M1, 'W');
  b.pe(G, M1, 560);
  const { BL, BN } = ctlSupply(b, G);
  const S0 = b.add('pb_nc', 320, 260, 'S0');
  const S1 = b.add('pb_no', 320, 340, 'S1');
  const KM1no = b.add('contact_no', 380, 340, '', { parent: KM1 });
  const H1 = b.add('lamp', 380, 420, 'H1', { color: 'green' });
  const Q1no = b.add('contact_no', 460, 260, '', { parent: Q1 });
  const H2 = b.add('lamp', 460, 420, 'H2', { color: 'red' });
  b.w(BL, 'p2', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p5');
  b.w(BL, 'p9', Q1no, '13');
  b.w(Q1no, '14', H2, 'X1');
  b.w(H2, 'X2', BN, 'p9');
  return b.build();
}

// 20. Safety relay E-STOP control
export function exSafety(): Circuit {
  const b = new Builder('sf');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 540, 500, 'KM1');
  const { F1, M1 } = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  b.pe(G, M1, 680);
  const T1 = b.add('psu24', 300, 140, 'T1');
  const S0 = b.add('estop', 300, 260, 'S0');
  const KS = b.add('safety', 380, 260, 'KS1', { V: 24 });
  b.w(G, 'L1', T1, 'L', 110);
  b.w(G, 'N', T1, 'N', 120);
  b.w(G, 'PE', T1, 'PE', 130);
  b.w(KS, 'E1', S0, '11');
  b.w(S0, '12', KS, 'E2');
  b.w(T1, '+24', KS, 'A1');
  b.w(T1, '0V', KS, 'A2');
  const Q2 = b.add('mcb1', 520, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 520, 240, '', { length: 8, name: 'L1' });
  const BN = b.add('busbar', 520, 600, '', { length: 9, name: 'N' });
  const J1 = b.add('junction', 700, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p9');
  const F1nc = b.add('contact_nc', 540, 260, '', { parent: F1 });
  const KSno = b.add('contact_no', 540, 340, '', { parent: KS });
  const S1 = b.add('pb_no', 540, 420, 'S1');
  const KM1no = b.add('contact_no', 600, 420, '', { parent: KM1 });
  const H1 = b.add('lamp', 600, 500, 'H1', { color: 'green' });
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', KSno, '13');
  b.w(KSno, '14', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p5');
  return b.build();
}

// 21. Tank fill with overflow alarm
export function exTank2(): Circuit {
  const b = new Builder('t2');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 320, 580, 'KM1');
  const { F1, M1 } = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1', In: 10, Ir: 4, mIn: 4, kW: 1.5 });
  b.pe(G, M1, 680);
  const { BL, BN } = ctlSupply(b, G, 300, { bnY: 660 });
  const F1nc = b.add('contact_nc', 320, 260, '', { parent: F1 });
  const S1 = b.add('switch', 320, 340, 'S1 AUTO', { kind: 'selector', contact: 'NO' });
  const LSL = b.add('switch', 320, 420, 'LSL', { kind: 'float', contact: 'NO' });
  const KM1no = b.add('contact_no', 380, 420, '', { parent: KM1 });
  const LSH = b.add('switch', 320, 500, 'LSH', { kind: 'float', contact: 'NC' });
  const H1 = b.add('lamp', 400, 580, 'H1', { color: 'green' });
  const LSHH = b.add('switch', 470, 340, 'LSHH', { kind: 'float', contact: 'NO' });
  const HA1 = b.add('buzzer', 480, 500, 'HA1');
  const H2 = b.add('lamp', 540, 500, 'H2', { color: 'red' });
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S1, '1');
  b.w(S1, '2', LSL, '1');
  b.w(LSL, '1', KM1no, '13');
  b.w(LSL, '2', LSH, '1');
  b.w(LSL, '2', KM1no, '14');
  b.w(LSH, '2', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p6');
  b.w(BL, 'p10', LSHH, '1');
  b.w(LSHH, '2', HA1, 'X1');
  b.w(LSHH, '2', H2, 'X1');
  b.w(HA1, 'X2', BN, 'p10');
  b.w(H2, 'X2', BN, 'p13');
  return b.build();
}

// 22. Pressure pump control
export function exPressure(): Circuit {
  const b = new Builder('pr');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 320, 500, 'KM1');
  const { F1, M1 } = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1', In: 10, Ir: 4, mIn: 4, kW: 1.5 });
  b.pe(G, M1, 680);
  const { BL, BN } = ctlSupply(b, G);
  const F1nc = b.add('contact_nc', 320, 260, '', { parent: F1 });
  const S1 = b.add('switch', 320, 340, 'S1 AUTO', { kind: 'selector', contact: 'NO' });
  const PSL = b.add('switch', 320, 420, 'PSL', { kind: 'pressure', contact: 'NO' });
  const H1 = b.add('lamp', 400, 500, 'H1', { color: 'green' });
  const PSH = b.add('switch', 470, 340, 'PSH', { kind: 'pressure', contact: 'NO' });
  const HA1 = b.add('buzzer', 480, 500, 'HA1');
  const H2 = b.add('lamp', 540, 500, 'H2', { color: 'red' });
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S1, '1');
  b.w(S1, '2', PSL, '1');
  b.w(PSL, '2', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p6');
  b.w(BL, 'p10', PSH, '1');
  b.w(PSH, '2', HA1, 'X1');
  b.w(PSH, '2', H2, 'X1');
  b.w(HA1, 'X2', BN, 'p10');
  b.w(H2, 'X2', BN, 'p13');
  return b.build();
}

// 23. Thermostat fan
export function exFan(): Circuit {
  const b = new Builder('fn');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 320, 500, 'KM1');
  const { F1, M1 } = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1 FAN', In: 10, Ir: 4, mIn: 4, kW: 1.5 });
  b.pe(G, M1, 680);
  const { BL, BN } = ctlSupply(b, G);
  const ONC = b.add('ol_nc', 320, 260, '', { parent: F1 });
  const S1 = b.add('switch', 320, 340, 'S1 AUTO', { kind: 'selector', contact: 'NO' });
  const TS = b.add('switch', 320, 420, 'TS', { kind: 'thermostat', contact: 'NO' });
  const H1 = b.add('lamp', 380, 500, 'H1', { color: 'green' });
  const ONO = b.add('ol_no', 440, 260, '', { parent: F1 });
  const H2 = b.add('lamp', 440, 500, 'H2', { color: 'red' });
  b.w(BL, 'p2', ONC, '95');
  b.w(ONC, '96', S1, '1');
  b.w(S1, '2', TS, '1');
  b.w(TS, '2', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p5');
  b.w(BL, 'p8', ONO, '97');
  b.w(ONO, '98', H2, 'X1');
  b.w(H2, 'X2', BN, 'p8');
  return b.build();
}

// 24. Star-delta with run/trip signaling
export function exSDLamps(): Circuit {
  const b = new Builder('sdl');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 400, 660, 'KM1');
  const KM3 = b.add('coil', 580, 660, 'KM3 Y');
  const KM2 = b.add('coil', 660, 660, 'KM2 D');
  const { F1 } = sdPower(b, G, KM1, KM2, KM3);
  const Q2 = b.add('mcb1', 400, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 400, 240, '', { length: 17, name: 'L1' });
  const BN = b.add('busbar', 400, 740, '', { length: 18, name: 'N' });
  const J1 = b.add('junction', 760, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p18');
  const F1nc = b.add('contact_nc', 400, 260, '', { parent: F1 });
  const S0 = b.add('pb_nc', 400, 340, 'S0');
  const S1 = b.add('pb_no', 400, 420, 'S1');
  const KM1no = b.add('contact_no', 460, 420, '', { parent: KM1 });
  const KT1 = b.add('timer', 500, 660, 'KT1', { mode: 'on', delay: 6 });
  const KT1nc = b.add('contact_nc', 580, 500, '', { parent: KT1 });
  const KM2nc = b.add('contact_nc', 580, 580, '', { parent: KM2 });
  const KT1no = b.add('contact_no', 660, 500, '', { parent: KT1 });
  const KM3nc = b.add('contact_nc', 660, 580, '', { parent: KM3 });
  const H1 = b.add('lamp', 460, 660, 'H1', { color: 'green' });
  const ONO = b.add('ol_no', 720, 260, '', { parent: F1 });
  const H2 = b.add('lamp', 720, 500, 'H2', { color: 'red' });
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
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p4');
  b.w(BL, 'p17', ONO, '97');
  b.w(ONO, '98', H2, 'X1');
  b.w(H2, 'X2', BN, 'p17');
  return b.build();
}

// 25. Single-phase motor DOL
export function ex1Ph(): Circuit {
  const b = new Builder('1p');
  const G = b.add('supply1npe', 40, 40, 'G2');
  const KM1 = b.add('coil', 200, 300, 'KM1');
  const Q1 = b.add('mcb1', 40, 140, 'Q1', { In: 16, curve: 'C' });
  const KM = b.add('contactor_main', 40, 240, '', { parent: KM1 });
  const FU = b.add('fuse', 40, 340, 'FU1', { In: 6 });
  const M1 = b.add('motor1', 40, 440, 'M1', { In: 4, kW: 0.75, load: 1 });
  const JN = b.add('junction', 140, 260);
  const PEJ = b.add('junction', 140, 120);
  b.w(G, 'L', Q1, '1');
  b.w(Q1, '2', KM, '1');
  b.w(KM, '2', FU, '1');
  b.w(FU, '2', M1, 'L');
  b.w(G, 'N', JN, 'p', 170);
  b.w(JN, 'p', M1, 'N', 420);
  b.w(G, 'PE', PEJ, 'p');
  b.w(PEJ, 'p', M1, 'PE', 540);
  const S0 = b.add('pb_nc', 200, 140, 'S0');
  const S1 = b.add('pb_no', 200, 220, 'S1');
  const KM1no = b.add('contact_no', 260, 220, '', { parent: KM1 });
  const H1 = b.add('lamp', 260, 300, 'H1', { color: 'green' });
  const BN = b.add('busbar', 200, 420, '', { length: 6, name: 'N' });
  const J1 = b.add('junction', 320, 100);
  b.w(Q1, '2', S0, '11', 170);
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A2', BN, 'p1');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p6');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p4');
  return b.build();
}

// 26. Two-hand start (momentary)
export function ex2Hand(): Circuit {
  const b = new Builder('2h');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 320, 500, 'KM1');
  const { F1, M1 } = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  b.pe(G, M1, 680);
  const { BL, BN } = ctlSupply(b, G);
  const F1nc = b.add('contact_nc', 320, 260, '', { parent: F1 });
  const S1 = b.add('pb_no', 320, 340, 'S1 LEFT');
  const S2 = b.add('pb_no', 320, 420, 'S2 RIGHT');
  const H1 = b.add('lamp', 380, 500, 'H1', { color: 'green' });
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S1, '13');
  b.w(S1, '14', S2, '13');
  b.w(S2, '14', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p5');
  return b.build();
}

// 27. Alarm with acknowledge
export function exAlarm(): Circuit {
  const b = new Builder('al');
  const G = b.add('supply1npe', 40, 40, 'G2');
  const KA1 = b.add('coil', 360, 300, 'KA1', { kind: 'relay', V: 230 });
  const PSH = b.add('switch', 200, 140, 'PSH', { kind: 'pressure', contact: 'NO' });
  const TSH = b.add('switch', 280, 140, 'TSH', { kind: 'thermostat', contact: 'NO' });
  const KAnc = b.add('contact_nc', 200, 240, '', { parent: KA1 });
  const HA1 = b.add('buzzer', 200, 320, 'HA1');
  const H1 = b.add('lamp', 280, 320, 'H1', { color: 'red' });
  const SACK = b.add('pb_no', 360, 140, 'S ACK');
  const KAno = b.add('contact_no', 300, 220, '', { parent: KA1 });
  const BN = b.add('busbar', 200, 420, '', { length: 10, name: 'N' });
  const J1 = b.add('junction', 400, 80);
  b.w(G, 'L', PSH, '1', 110);
  b.w(G, 'L', TSH, '1', 120);
  b.w(PSH, '2', TSH, '2');
  b.w(TSH, '2', KAnc, '11');
  b.w(KAnc, '12', HA1, 'X1');
  b.w(TSH, '2', H1, 'X1');
  b.w(TSH, '2', SACK, '13');
  b.w(TSH, '2', KAno, '13');
  b.w(SACK, '14', KA1, 'A1');
  b.w(KAno, '14', KA1, 'A1');
  b.w(HA1, 'X2', BN, 'p1');
  b.w(H1, 'X2', BN, 'p5');
  b.w(KA1, 'A2', BN, 'p9');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p10');
  return b.build();
}

// 28. E-stop chain conveyor
export function exEstopChain(): Circuit {
  const b = new Builder('ec');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 320, 580, 'KM1');
  const { F1, M1 } = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  b.pe(G, M1, 680);
  const { BL, BN } = ctlSupply(b, G, 300, { bnY: 660 });
  const F1nc = b.add('contact_nc', 320, 260, '', { parent: F1 });
  const S0A = b.add('estop', 320, 340, 'S0A');
  const S0B = b.add('estop', 320, 420, 'S0B');
  const S1 = b.add('pb_no', 320, 500, 'S1');
  const KM1no = b.add('contact_no', 380, 500, '', { parent: KM1 });
  const H1 = b.add('lamp', 380, 580, 'H1', { color: 'green' });
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S0A, '11');
  b.w(S0A, '12', S0B, '11');
  b.w(S0B, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p5');
  return b.build();
}

// 29. Day/night lighting contactor
export function exPhoto(): Circuit {
  const b = new Builder('ph');
  const G = b.add('supply1npe', 40, 40, 'G2');
  const KM1 = b.add('coil', 200, 220, 'KM1');
  const Q1 = b.add('mcb1', 40, 140, 'Q1', { In: 10, curve: 'C' });
  const KM = b.add('contactor_main', 40, 240, '', { parent: KM1 });
  const H1 = b.add('lamp', 120, 360, 'H1', { color: 'white' });
  const H2 = b.add('lamp', 200, 360, 'H2', { color: 'white' });
  const PHOTO = b.add('switch', 200, 140, 'S1', { kind: 'photo', contact: 'NO' });
  const BN = b.add('busbar', 120, 480, '', { length: 8, name: 'N' });
  const J1 = b.add('junction', 280, 80);
  b.w(G, 'L', Q1, '1');
  b.w(Q1, '2', KM, '1');
  b.w(KM, '2', H1, 'X1');
  b.w(KM, '2', H2, 'X1', 340);
  b.w(H1, 'X2', BN, 'p1');
  b.w(H2, 'X2', BN, 'p5');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p8');
  b.w(Q1, '2', PHOTO, '1', 130);
  b.w(PHOTO, '2', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p8', 500);
  return b.build();
}

// 30. Off-delay fan rundown
export function exRundown(): Circuit {
  const b = new Builder('rd');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 380, 500, 'KM1');
  const KM2 = b.add('coil', 520, 420, 'KM2 FAN');
  const p1 = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1' });
  const p2 = powerAt(b, 200, G, KM2, { q: 'Q3', f: 'F2', m: 'M2', mIn: 4, kW: 1.5 });
  b.pe(G, p1.M1, 680);
  b.pe(G, p2.M1, 680);
  const Q2 = b.add('mcb1', 380, 140, 'Q2', { In: 6, curve: 'B' });
  const BL = b.add('busbar', 380, 240, '', { length: 8, name: 'L1' });
  const BN = b.add('busbar', 300, 660, '', { length: 16, name: 'N' });
  const J1 = b.add('junction', 620, 100);
  b.w(G, 'L1', Q2, '1', 110);
  b.w(Q2, '2', BL, 'p1');
  b.w(G, 'N', J1, 'p', 90);
  b.w(J1, 'p', BN, 'p16');
  const F1nc = b.add('contact_nc', 380, 260, '', { parent: p1.F1 });
  const S0 = b.add('pb_nc', 380, 340, 'S0');
  const S1 = b.add('pb_no', 380, 420, 'S1');
  const KM1no = b.add('contact_no', 440, 420, '', { parent: KM1 });
  const KT1 = b.add('timer', 440, 500, 'KT1', { mode: 'off', delay: 10 });
  const F2nc = b.add('contact_nc', 520, 260, '', { parent: p2.F1 });
  const KTno = b.add('contact_no', 520, 340, '', { parent: KT1 });
  const H1 = b.add('lamp', 300, 500, 'H1', { color: 'green' });
  const H2 = b.add('lamp', 580, 420, 'H2', { color: 'yellow' });
  b.w(BL, 'p1', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S1, '14', KM1, 'A1');
  b.w(S1, '13', KM1no, '13');
  b.w(S1, '14', KM1no, '14');
  b.w(KM1, 'A1', KT1, 'A1');
  b.w(KT1, 'A2', BN, 'p8');
  b.w(KM1, 'A2', BN, 'p5');
  b.w(BL, 'p8', F2nc, '11');
  b.w(F2nc, '12', KTno, '13');
  b.w(KTno, '14', KM2, 'A1');
  b.w(KM2, 'A2', BN, 'p12');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p1');
  b.w(KM2, 'A1', H2, 'X1');
  b.w(H2, 'X2', BN, 'p15');
  return b.build();
}

// 31. Floatless level switch (8-pin) + water tank — clean layout, no overlaps
export function exFloatlessTank(): Circuit {
  const b = new Builder('flt');

  // ---------- Column 1 (x 40..200): 3-phase power for the fill pump ----------
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 900, 300, 'KM1 FILL PUMP');
  const P = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1 PUMP', In: 10, Ir: 4, mIn: 4, kW: 1.5 });
  b.pe(G, P.M1, 700);

  // ---------- Column 2 (x 240..360): tank + floatless electrodes ----------
  const T = b.add('tank', 240, 120, 'T1 WATER TANK', { level: 0.55, dailyUse: 1 });
  const F = b.add('floatless', 240, 330, 'F1 FLS-8');
  b.w(T, 'E1', F, '3', 300);
  b.w(T, 'E2', F, '4', 316);
  b.w(T, 'E3', F, '1', 332);

  // ---------- Column 3 (x 440..1000): 230 V control, rails at the bottom ----------
  const { BL, BN } = ctlSupply(b, G, 460, { blLen: 18, bnLen: 26, blY: 660, bnY: 900 });
  b.w(BL, 'p1', F, '2', 300); // LINE  -> pin 2 (L)
  b.w(BN, 'p1', F, '7', 320); // NEUTRAL -> pin 7 (N)

  const F1nc = b.add('contact_nc', 560, 200, '', { parent: P.F1 });
  const S0 = b.add('pb_nc', 560, 260, 'S0 STOP');
  const S1 = b.add('switch', 560, 320, 'AUTO', { kind: 'selector', contact: 'NO' });
  const Fpump = b.add('contact_no', 560, 380, '', { parent: F });
  const H1 = b.add('lamp', 620, 380, 'PUMP ON', { color: 'green' });
  const Flvl = b.add('contact_nc', 660, 200, '', { parent: F });
  const H2 = b.add('lamp', 720, 380, 'LEVEL FULL', { color: 'red' });
  const S1no = b.add('contact_no', 820, 320, '', { parent: KM1 });

  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '1');
  b.w(S1, '2', Fpump, '13');
  b.w(Fpump, '14', KM1, 'A1');
  b.w(S1, '2', S1no, '13');
  b.w(S1no, '14', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KM1, 'A1', H1, 'X1', 700);
  b.w(H1, 'X2', BN, 'p8');
  b.w(BL, 'p15', Flvl, '11', 240);
  b.w(Flvl, '12', H2, 'X1', 300);
  b.w(H2, 'X2', BN, 'p14');

  return b.build();
}

/** Shared reversing+star-delta power stage. Returns contactors and the 3-phase supply. */
function sdRevPower(b: Builder) {
  const G = b.add('supply3npe', 40, 40, 'G1');
  const Q1 = b.add('mcb3', 40, 140, 'Q1', { In: 25, curve: 'C' });
  const KMF = b.add('contactor_main', 40, 260, '', { parent: '' });
  const KMR = b.add('contactor_main', 160, 260, '', { parent: '' });
  const F1 = b.add('overload', 40, 400, 'F1', { Ir: 12 });
  const M1 = b.add('motor6', 40, 530, 'M1', { In: 12, kW: 5.5, load: 0.4 });
  const KMD = b.add('contactor_main', 180, 400, '', { parent: '' });
  const KMY = b.add('contactor_main', 320, 400, '', { parent: '' });
  // line -> Q1
  b.w(G, 'L1', Q1, '1');
  b.w(G, 'L2', Q1, '3');
  b.w(G, 'L3', Q1, '5');
  // forward: L1 L2 L3
  b.w(Q1, '2', KMF, '1');
  b.w(Q1, '4', KMF, '3');
  b.w(Q1, '6', KMF, '5');
  // reverse: swap L1 and L3
  b.w(Q1, '2', KMR, '5');
  b.w(Q1, '4', KMR, '3');
  b.w(Q1, '6', KMR, '1');
  // both feed the overload
  b.w(KMF, '2', F1, '1');
  b.w(KMF, '4', F1, '3');
  b.w(KMF, '6', F1, '5');
  b.w(KMR, '2', F1, '1', 360);
  b.w(KMR, '4', F1, '3', 370);
  b.w(KMR, '6', F1, '5', 380);
  // overload -> motor main winding
  b.w(F1, '2', M1, 'U1', 470);
  b.w(F1, '4', M1, 'V1', 480);
  b.w(F1, '6', M1, 'W1', 490);
  // delta contactor: line -> winding tails
  b.w(F1, '2', KMD, '1', 340);
  b.w(F1, '4', KMD, '3', 350);
  b.w(F1, '6', KMD, '5', 360);
  b.w(KMD, '2', M1, 'W2', 620);
  b.w(KMD, '4', M1, 'U2', 640);
  b.w(KMD, '6', M1, 'V2', 660);
  // star contactor: shorts the tails
  b.w(M1, 'W2', KMY, '1', 700);
  b.w(M1, 'U2', KMY, '3', 720);
  b.w(M1, 'V2', KMY, '5', 740);
  b.w(KMY, '2', KMY, '4');
  b.w(KMY, '4', KMY, '6');
  b.pe(G, M1, 800);
  return { G, Q1, KMF, KMR, F1, M1, KMD, KMY };
}

/** Auto star-delta forward / reverse — one-touch forward or reverse with Y-Δ timing. */
export function exAutoSdRev(): Circuit {
  const b = new Builder('asr');
  const P = sdRevPower(b);
  const KMF = b.add('coil', 1000, 620, 'KMF FWD');
  const KMR = b.add('coil', 1090, 620, 'KMR REV');
  const KMY = b.add('coil', 1180, 760, 'KMY STAR');
  const KMD = b.add('coil', 1270, 760, 'KMD DELTA');
  const KT1 = b.add('timer', 1150, 880, 'KT1 Y-Δ', { mode: 'on', delay: 6 });
  // link the power contactors to their coils
  b.link(P.KMF, KMF);
  b.link(P.KMR, KMR);
  b.link(P.KMY, KMY);
  b.link(P.KMD, KMD);
  const { BL, BN } = ctlSupply(b, P.G, 620, { blLen: 26, bnLen: 34, blY: 240, bnY: 1040 });
  const F1nc = b.add('contact_nc', 640, 260, '', { parent: P.F1 });
  const S0 = b.add('pb_nc', 640, 320, 'S0 STOP');
  const S1 = b.add('pb_no', 720, 380, 'S1 FWD');
  const KMFno = b.add('contact_no', 800, 380, '', { parent: KMF });
  const KMRnc = b.add('contact_nc', 640, 440, '', { parent: KMR });
  const S2 = b.add('pb_no', 720, 520, 'S2 REV');
  const KMRno = b.add('contact_no', 800, 520, '', { parent: KMR });
  const KMFnc = b.add('contact_nc', 640, 580, '', { parent: KMF });
  const KMFrun = b.add('contact_no', 900, 440, '', { parent: KMF });
  const KMRrun = b.add('contact_no', 900, 520, '', { parent: KMR });
  const KTnc = b.add('contact_nc', 960, 300, '', { parent: KT1 });
  const KMDnc = b.add('contact_nc', 1040, 300, '', { parent: KMD });
  const KTno = b.add('contact_no', 1120, 300, '', { parent: KT1 });
  const KMYnc = b.add('contact_nc', 1200, 300, '', { parent: KMY });
  const H1 = b.add('lamp', 1000, 800, 'FWD', { color: 'green' });
  const H2 = b.add('lamp', 1080, 800, 'REV', { color: 'yellow' });
  const H3 = b.add('lamp', 1160, 940, 'STAR', { color: 'blue' });
  const H4 = b.add('lamp', 1240, 940, 'DELTA', { color: 'green' });
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S0, '12', S2, '13');
  b.w(S1, '13', KMFno, '13');
  b.w(S1, '14', KMRnc, '11');
  b.w(KMRnc, '12', KMF, 'A1');
  b.w(S1, '14', KMFno, '14');
  b.w(S2, '13', KMRno, '13');
  b.w(S2, '14', KMFnc, '11');
  b.w(KMFnc, '12', KMR, 'A1');
  b.w(S2, '14', KMRno, '14');
  b.w(BL, 'p14', KMFrun, '13');
  b.w(BL, 'p14', KMRrun, '13');
  b.w(KMFrun, '14', KTnc, '11');
  b.w(KMFrun, '14', KTno, '13');
  b.w(KMRrun, '14', KTnc, '11');
  b.w(KMRrun, '14', KTno, '13');
  b.w(KMFrun, '14', KT1, 'A1');
  b.w(KTnc, '12', KMDnc, '11');
  b.w(KMDnc, '12', KMY, 'A1');
  b.w(KTno, '14', KMYnc, '11');
  b.w(KMYnc, '12', KMD, 'A1');
  b.w(KMF, 'A2', BN, 'p2');
  b.w(KMR, 'A2', BN, 'p4');
  b.w(KMY, 'A2', BN, 'p8');
  b.w(KMD, 'A2', BN, 'p12');
  b.w(KT1, 'A2', BN, 'p16');
  b.w(KMF, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p18');
  b.w(KMR, 'A1', H2, 'X1');
  b.w(H2, 'X2', BN, 'p20');
  b.w(KMY, 'A1', H3, 'X1');
  b.w(H3, 'X2', BN, 'p22');
  b.w(KMD, 'A1', H4, 'X1');
  b.w(H4, 'X2', BN, 'p24');
  return b.build();
}

/** Manual star-delta forward / reverse — operator presses STAR then DELTA. */
export function exManualSdRev(): Circuit {
  const b = new Builder('msr');
  const P = sdRevPower(b);
  const KMF = b.add('coil', 1000, 620, 'KMF FWD');
  const KMR = b.add('coil', 1090, 620, 'KMR REV');
  const KMY = b.add('coil', 1180, 760, 'KMY STAR');
  const KMD = b.add('coil', 1270, 760, 'KMD DELTA');
  b.link(P.KMF, KMF);
  b.link(P.KMR, KMR);
  b.link(P.KMY, KMY);
  b.link(P.KMD, KMD);
  const { BL, BN } = ctlSupply(b, P.G, 620, { blLen: 26, bnLen: 34, blY: 240, bnY: 1040 });
  const F1nc = b.add('contact_nc', 640, 260, '', { parent: P.F1 });
  const S0 = b.add('pb_nc', 640, 320, 'S0 STOP');
  const S1 = b.add('pb_no', 720, 380, 'S1 FWD');
  const KMFno = b.add('contact_no', 800, 380, '', { parent: KMF });
  const KMRnc = b.add('contact_nc', 640, 440, '', { parent: KMR });
  const S2 = b.add('pb_no', 720, 520, 'S2 REV');
  const KMRno = b.add('contact_no', 800, 520, '', { parent: KMR });
  const KMFnc = b.add('contact_nc', 640, 580, '', { parent: KMF });
  const SEL = b.add('sel3', 920, 300, 'S3 STAR / DELTA');
  const KMDnc = b.add('contact_nc', 1180, 220, '', { parent: KMD });
  const KMYnc = b.add('contact_nc', 1180, 320, '', { parent: KMY });
  const H1 = b.add('lamp', 1000, 800, 'FWD', { color: 'green' });
  const H2 = b.add('lamp', 1080, 800, 'REV', { color: 'yellow' });
  const H3 = b.add('lamp', 1160, 940, 'STAR', { color: 'blue' });
  const H4 = b.add('lamp', 1240, 940, 'DELTA', { color: 'green' });
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '13');
  b.w(S0, '12', S2, '13');
  b.w(S1, '13', KMFno, '13');
  b.w(S1, '14', KMRnc, '11');
  b.w(KMRnc, '12', KMF, 'A1');
  b.w(S1, '14', KMFno, '14');
  b.w(S2, '13', KMRno, '13');
  b.w(S2, '14', KMFnc, '11');
  b.w(KMFnc, '12', KMR, 'A1');
  b.w(S2, '14', KMRno, '14');
  // 3-position selector: I = STAR, OFF, II = DELTA (mutually exclusive)
  b.w(BL, 'p12', KMDnc, '11');
  b.w(KMDnc, '12', SEL, '13');
  b.w(SEL, '14', KMY, 'A1');
  b.w(BL, 'p16', KMYnc, '11');
  b.w(KMYnc, '12', SEL, '23');
  b.w(SEL, '24', KMD, 'A1');
  b.w(KMF, 'A2', BN, 'p2');
  b.w(KMR, 'A2', BN, 'p4');
  b.w(KMY, 'A2', BN, 'p8');
  b.w(KMD, 'A2', BN, 'p12');
  b.w(KMF, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p18');
  b.w(KMR, 'A1', H2, 'X1');
  b.w(H2, 'X2', BN, 'p20');
  b.w(KMY, 'A1', H3, 'X1');
  b.w(H3, 'X2', BN, 'p22');
  b.w(KMD, 'A1', H4, 'X1');
  b.w(H4, 'X2', BN, 'p24');
  return b.build();
}

/** Submersible pump control box: float switches + overload + run / trip indication. */
export function exSubPump(): Circuit {
  const b = new Builder('sub');
  const G = b.add('supply1npe', 40, 40, 'G1 230V');
  const Q1 = b.add('mcb1', 40, 140, 'Q1 16A', { In: 16, curve: 'C' });
  const KM1 = b.add('coil', 520, 560, 'KM1 PUMP');
  const KM = b.add('contactor_main', 40, 260, '', { parent: KM1 });
  const F1 = b.add('overload', 40, 400, 'F1 10A', { Ir: 8 });
  const M1 = b.add('motor1', 40, 540, 'M1 SUBMERSIBLE', { In: 8, kW: 1.5, load: 1 });
  const JN = b.add('junction', 160, 120);
  b.w(G, 'L', Q1, '1');
  b.w(Q1, '2', KM, '1');
  b.w(KM, '2', F1, '1', 320);
  b.w(F1, '2', M1, 'L', 480);
  b.w(G, 'N', JN, 'p');
  b.w(JN, 'p', M1, 'N', 640);
  b.w(G, 'PE', M1, 'PE', 700);
  const FS = b.add('fuse', 240, 160, 'FU1 2A', { In: 2 });
  const BL = b.add('busbar', 240, 240, '', { length: 16, name: 'L' });
  const BN = b.add('busbar', 240, 820, '', { length: 20, name: 'N' });
  const JBN = b.add('junction', 600, 120);
  b.w(Q1, '2', FS, '1', 130);
  b.w(FS, '2', BL, 'p1');
  b.w(G, 'N', JBN, 'p', 90);
  b.w(JBN, 'p', BN, 'p20');
  const F1nc = b.add('contact_nc', 620, 200, '', { parent: F1 });
  const S1 = b.add('switch', 620, 280, 'AUTO / OFF', { kind: 'selector', contact: 'NO' });
  const LSH = b.add('switch', 620, 360, 'LSH HIGH', { kind: 'float', contact: 'NC' });
  const LSL = b.add('switch', 620, 440, 'LSL LOW', { kind: 'float', contact: 'NO' });
  const KM1no = b.add('contact_no', 700, 440, '', { parent: KM1 });
  const H1 = b.add('lamp', 720, 620, 'POWER', { color: 'green' });
  const H2 = b.add('lamp', 790, 620, 'RUN', { color: 'green' });
  const F1no = b.add('contact_no', 860, 200, '', { parent: F1 });
  const H3 = b.add('lamp', 860, 620, 'TRIP', { color: 'red' });
  b.w(BL, 'p1', F1nc, '11');
  b.w(F1nc, '12', S1, '1');
  b.w(S1, '2', LSH, '1');
  b.w(LSH, '2', LSL, '1');
  b.w(LSL, '2', KM1, 'A1');
  b.w(LSL, '1', KM1no, '13');
  b.w(LSL, '2', KM1no, '14');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(BL, 'p14', H1, 'X1');
  b.w(H1, 'X2', BN, 'p6');
  b.w(KM, '2', H2, 'X1', 600);
  b.w(H2, 'X2', BN, 'p10');
  b.w(BL, 'p16', F1no, '13');
  b.w(F1no, '14', H3, 'X1');
  b.w(H3, 'X2', BN, 'p14');
  return b.build();
}

/** Automatic star-delta started by a thermostat / humidity contact. */
export function exSdTemp(): Circuit {
  const b = new Builder('sdt');
  const KM1 = b.add('coil', 620, 620, 'KM1 LINE');
  const KM3 = b.add('coil', 720, 760, 'KM3 STAR');
  const KM2 = b.add('coil', 820, 760, 'KM2 DELTA');
  const KT1 = b.add('timer', 720, 880, 'KT1 Y-Δ', { mode: 'on', delay: 6 });
  const G = b.add('supply3npe', 40, 40, 'G1');
  const P = sdPower(b, G, KM1, KM2, KM3);
  const TS = b.add('switch', 760, 360, 'TS TEMP', { kind: 'thermostat', contact: 'NO' });
  const HS = b.add('switch', 840, 360, 'HS HUMIDITY', { kind: 'thermostat', contact: 'NO' });
  const { BL, BN } = ctlSupply(b, G, 620, { blLen: 22, bnLen: 30, blY: 240, bnY: 1040 });
  const F1nc = b.add('contact_nc', 640, 320, '', { parent: P.F1 });
  const S0 = b.add('pb_nc', 640, 380, 'S0 STOP');
  const S1 = b.add('switch', 620, 440, 'AUTO', { kind: 'selector', contact: 'NO' });
  const KM1no = b.add('contact_no', 700, 440, '', { parent: KM1 });
  const KTnc = b.add('contact_nc', 760, 440, '', { parent: KT1 });
  const KM2nc = b.add('contact_nc', 760, 520, '', { parent: KM2 });
  const KTno = b.add('contact_no', 860, 440, '', { parent: KT1 });
  const KM3nc = b.add('contact_nc', 860, 520, '', { parent: KM3 });
  const H1 = b.add('lamp', 920, 620, 'COOLING', { color: 'green' });
  const H2 = b.add('lamp', 990, 620, 'STAR', { color: 'blue' });
  const H3 = b.add('lamp', 1060, 620, 'DELTA', { color: 'green' });
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '1');
  b.w(S1, '2', TS, '1');
  b.w(S1, '2', HS, '1');
  b.w(TS, '2', KM1, 'A1');
  b.w(HS, '2', KM1, 'A1');
  b.w(S1, '2', KM1no, '13');
  b.w(KM1no, '14', KM1, 'A1');
  b.w(KM1, 'A1', KT1, 'A1', 700);
  b.w(BL, 'p10', KTnc, '11');
  b.w(KTnc, '12', KM2nc, '11');
  b.w(KM2nc, '12', KM3, 'A1');
  b.w(BL, 'p10', KTno, '13');
  b.w(KTno, '14', KM3nc, '11');
  b.w(KM3nc, '12', KM2, 'A1');
  b.w(KM1, 'A2', BN, 'p2');
  b.w(KT1, 'A2', BN, 'p8');
  b.w(KM3, 'A2', BN, 'p12');
  b.w(KM2, 'A2', BN, 'p16');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p20');
  b.w(KM3, 'A1', H2, 'X1');
  b.w(H2, 'X2', BN, 'p22');
  b.w(KM2, 'A1', H3, 'X1');
  b.w(H3, 'X2', BN, 'p24');
  return b.build();
}

/** Proximity sensor starts the motor and a TOF keeps it running after the object leaves. */
export function exProxMotor(): Circuit {
  const b = new Builder('pxm');
  const G = b.add('supply3npe', 40, 40, 'G1');
  const KM1 = b.add('coil', 620, 520, 'KM1 MOTOR');
  const P = powerAt(b, 40, G, KM1, { q: 'Q1', f: 'F1', m: 'M1 CONVEYOR', In: 10, Ir: 6, mIn: 6, kW: 2.2 });
  const { BL, BN } = ctlSupply(b, G, 600, { blLen: 22, bnLen: 30, blY: 240, bnY: 900 });
  const F1nc = b.add('contact_nc', 640, 260, '', { parent: P.F1 });
  const S0 = b.add('pb_nc', 640, 320, 'S0 STOP');
  const S1 = b.add('switch', 620, 380, 'AUTO', { kind: 'selector', contact: 'NO' });
  const PX = b.add('switch', 640, 440, 'S1 PROXIMITY', { kind: 'prox', contact: 'NO' });
  const TOF = b.add('tof', 680, 540, 'KT1 RUN-ON', { delay: 5 });
  const TNO = b.add('timer_no', 760, 440, '', { parent: TOF });
  const H1 = b.add('lamp', 780, 640, 'MOTOR ON', { color: 'green' });
  const H2 = b.add('lamp', 850, 640, 'OBJECT', { color: 'yellow' });
  // sensor -> off-delay timer -> motor contactor (runs on for 5 s after the object leaves)
  b.w(BL, 'p2', F1nc, '11');
  b.w(F1nc, '12', S0, '11');
  b.w(S0, '12', S1, '1');
  b.w(S1, '2', PX, '1');
  b.w(PX, '2', TOF, 'A1');
  b.w(TOF, 'A2', BN, 'p2');
  b.w(BL, 'p6', TNO, '15');
  b.w(TNO, '18', KM1, 'A1');
  b.w(KM1, 'A2', BN, 'p6');
  b.w(KM1, 'A1', H1, 'X1');
  b.w(H1, 'X2', BN, 'p10');
  b.w(PX, '2', H2, 'X1', 600);
  b.w(H2, 'X2', BN, 'p14');
  return b.build();
}

export const EXTRA_EXAMPLES: { key: string; titleKey: string; descKey: string; build: () => Circuit }[] = [
  { key: 'handauto', titleKey: 'ex_handauto', descKey: 'ex_handauto_d', build: exHandAuto },
  { key: 'jog', titleKey: 'ex_jog', descKey: 'ex_jog_d', build: exJog },
  { key: 'autorev', titleKey: 'ex_autorev', descKey: 'ex_autorev_d', build: exAutoRev },
  { key: 'mandelta', titleKey: 'ex_mandelta', descKey: 'ex_mandelta_d', build: exManDelta },
  { key: 'sd24', titleKey: 'ex_sd24', descKey: 'ex_sd24_d', build: exSD24 },
  { key: 'seq2', titleKey: 'ex_seq2', descKey: 'ex_seq2_d', build: exSeq2 },
  { key: 'permissive', titleKey: 'ex_permissive', descKey: 'ex_permissive_d', build: exPermissive },
  { key: 'cascade3', titleKey: 'ex_cascade3', descKey: 'ex_cascade3_d', build: exCascade3 },
  { key: 'ats', titleKey: 'ex_ats', descKey: 'ex_ats_d', build: exATS },
  { key: 'sdphase', titleKey: 'ex_sdphase', descKey: 'ex_sdphase_d', build: exSDPhase },
  { key: 'dolol', titleKey: 'ex_dolol', descKey: 'ex_dolol_d', build: exDOLol },
  { key: 'dolrccb', titleKey: 'ex_dolrccb', descKey: 'ex_dolrccb_d', build: exDOLrccb },
  { key: 'mpcb', titleKey: 'ex_mpcb', descKey: 'ex_mpcb_d', build: exMPCB },
  { key: 'safety', titleKey: 'ex_safety', descKey: 'ex_safety_d', build: exSafety },
  { key: 'tank2', titleKey: 'ex_tank2', descKey: 'ex_tank2_d', build: exTank2 },
  { key: 'pressure', titleKey: 'ex_pressure', descKey: 'ex_pressure_d', build: exPressure },
  { key: 'fan', titleKey: 'ex_fan', descKey: 'ex_fan_d', build: exFan },
  { key: 'sdlamps', titleKey: 'ex_sdlamps', descKey: 'ex_sdlamps_d', build: exSDLamps },
  { key: '1ph', titleKey: 'ex_1ph', descKey: 'ex_1ph_d', build: ex1Ph },
  { key: '2hand', titleKey: 'ex_2hand', descKey: 'ex_2hand_d', build: ex2Hand },
  { key: 'alarm', titleKey: 'ex_alarm', descKey: 'ex_alarm_d', build: exAlarm },
  { key: 'estopchain', titleKey: 'ex_estopchain', descKey: 'ex_estopchain_d', build: exEstopChain },
  { key: 'photo', titleKey: 'ex_photo', descKey: 'ex_photo_d', build: exPhoto },
  { key: 'rundown', titleKey: 'ex_rundown', descKey: 'ex_rundown_d', build: exRundown },
  { key: 'floatlessTank', titleKey: 'ex_flt_tank', descKey: 'ex_flt_tank_d', build: exFloatlessTank },
  { key: 'autosdrev', titleKey: 'ex_autosdrev', descKey: 'ex_autosdrev_d', build: exAutoSdRev },
  { key: 'manualsdrev', titleKey: 'ex_manualsdrev', descKey: 'ex_manualsdrev_d', build: exManualSdRev },
  { key: 'subpump', titleKey: 'ex_subpump', descKey: 'ex_subpump_d', build: exSubPump },
  { key: 'sdtemp', titleKey: 'ex_sdtemp', descKey: 'ex_sdtemp_d', build: exSdTemp },
  { key: 'proxmotor', titleKey: 'ex_proxmotor', descKey: 'ex_proxmotor_d', build: exProxMotor },
];
