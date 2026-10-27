import { useMemo, useState } from 'react';

/**
 * Logic diagram system for the electronics parts (74xx / 40xx style).
 * Two inputs feed a 3-stage gate chain; output drives a lamp.
 * Live value propagation + a full truth table are shown beside the IEC diagram.
 */

type Gate = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR';
type Src = 'A' | 'B' | 'G1' | 'G2';

const GATES: Gate[] = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'];

function evalGate(g: Gate, a: boolean, b: boolean): boolean {
  switch (g) {
    case 'AND':
      return a && b;
    case 'OR':
      return a || b;
    case 'NOT':
      return !a;
    case 'NAND':
      return !(a && b);
    case 'NOR':
      return !(a || b);
    case 'XOR':
      return a !== b;
    default:
      return false;
  }
}

const IC: Record<Gate, string> = { AND: '7408', OR: '7432', NOT: '7404', NAND: '7400', NOR: '7402', XOR: '7486' };

/** IEC 60617 gate outline (input side left, output right). */
function GateShape({ gate, x, y, lit }: { gate: Gate; x: number; y: number; lit: boolean }) {
  const ink = '#0f172a';
  const fill = lit ? '#dcfce7' : '#ffffff';
  const neon = '#ef4444';
  const stroke = lit ? '#16a34a' : ink;
  const body = (() => {
    switch (gate) {
      case 'AND':
        return <path d="M 0 0 H 26 A 20 20 0 0 1 26 40 H 0 Z" fill={fill} stroke={stroke} strokeWidth={2} />;
      case 'NAND':
        return (
          <g>
            <path d="M 0 0 H 26 A 20 20 0 0 1 26 40 H 0 Z" fill={fill} stroke={stroke} strokeWidth={2} />
            <circle cx={50} cy={20} r={4} fill={fill} stroke={stroke} strokeWidth={2} />
          </g>
        );
      case 'OR':
      case 'NOR':
      case 'XOR':
        return (
          <g>
            {gate === 'XOR' && <path d="M -6 0 Q 8 20 -6 40" fill="none" stroke={stroke} strokeWidth={2} />}
            <path d="M 0 0 Q 26 0 42 20 Q 26 40 0 40 Q 16 20 0 0 Z" fill={fill} stroke={stroke} strokeWidth={2} />
            {gate === 'NOR' && <circle cx={46} cy={20} r={4} fill={fill} stroke={stroke} strokeWidth={2} />}
          </g>
        );
      case 'NOT':
        return (
          <g>
            <path d="M 0 0 L 0 40 L 34 20 Z" fill={fill} stroke={stroke} strokeWidth={2} />
            <circle cx={38} cy={20} r={4} fill={fill} stroke={stroke} strokeWidth={2} />
          </g>
        );
    }
  })();
  return (
    <g transform={`translate(${x} ${y})`}>
      {body}
      <text x={gate === 'NOT' ? 12 : 20} y={25} fontSize={11} fontWeight={800} fill={lit ? neon : ink} textAnchor="middle">
        {gate === 'NOT' ? '1' : gate === 'AND' || gate === 'NAND' ? '&' : gate === 'OR' || gate === 'NOR' ? '≥1' : '=1'}
      </text>
      <text x={gate === 'NOT' ? 20 : 24} y={51} textAnchor="middle" fontSize={8} fontWeight={700} fill="#475569">
        {gate} · {IC[gate]}
      </text>
    </g>
  );
}

export default function LogicLab({ onClose, t }: { onClose: () => void; t: (k: string) => string }) {
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const [gates, setGates] = useState<{ g: Gate; sa: Src; sb: Src }[]>([
    { g: 'AND', sa: 'A', sb: 'B' },
    { g: 'NOT', sa: 'G1', sb: 'A' },
    { g: 'OR', sa: 'G2', sb: 'A' },
  ]);

  const values = useMemo(() => {
    const srcVal = (s: Src, i: number): boolean => {
      if (s === 'A') return a;
      if (s === 'B') return b;
      const idx = s === 'G1' ? 0 : 1;
      if (idx >= i) return false;
      return out[idx];
    };
    const out: boolean[] = [];
    gates.forEach((st, i) => out.push(evalGate(st.g, srcVal(st.sa, i), srcVal(st.sb, i))));
    return out;
  }, [a, b, gates]);

  const truth = useMemo(() => {
    const rows: { a: boolean; b: boolean; y: boolean }[] = [];
    for (const av of [false, true]) for (const bv of [false, true]) {
      const o: boolean[] = [];
      gates.forEach((st, i) => {
        const src = (s: Src): boolean => {
          if (s === 'A') return av;
          if (s === 'B') return bv;
          const idx = s === 'G1' ? 0 : 1;
          return idx < i ? o[idx] : false;
        };
        o.push(evalGate(st.g, src(st.sa), src(st.sb)));
      });
      rows.push({ a: av, b: bv, y: o[o.length - 1] });
    }
    return rows;
  }, [gates]);

  const finalOn = values[values.length - 1];
  const setGate = (i: number, patch: Partial<{ g: Gate; sa: Src; sb: Src }>) => setGates((arr) => arr.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5">
          <div>
            <h2 className="text-sm font-bold text-slate-100">🧠 {t('logic_lab')}</h2>
            <p className="text-[10px] text-slate-400">{t('logic_lab_sub')}</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-white">
            ✕
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 md:grid-cols-[1.1fr_1fr]">
          {/* diagram */}
          <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-2">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>IEC 60617 logic diagram</span>
              <span className="ms-auto rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{finalOn ? 'OUT = 1' : 'OUT = 0'}</span>
            </div>
            <svg viewBox="0 0 420 300" className="w-full" style={{ background: '#f8fafc', borderRadius: 6 }}>
              {/* input switches */}
              {[
                { y: 40, label: 'A', on: a, set: setA },
                { y: 92, label: 'B', on: b, set: setB },
              ].map((inp) => (
                <g key={inp.label} onClick={() => inp.set(!inp.on)} style={{ cursor: 'pointer' }}>
                  <rect x={8} y={inp.y - 16} width={28} height={32} rx={4} fill={inp.on ? '#16a34a' : '#e2e8f0'} stroke="#0f172a" strokeWidth={1.4} />
                  <text x={22} y={inp.y + 4} textAnchor="middle" fontSize={13} fontWeight={800} fill={inp.on ? '#fff' : '#0f172a'}>
                    {inp.on ? '1' : '0'}
                  </text>
                  <text x={22} y={inp.y - 20} textAnchor="middle" fontSize={9} fontWeight={700} fill="#0f172a">
                    {inp.label}
                  </text>
                  <line x1={36} y1={inp.y} x2={70} y2={inp.y} stroke="#0f172a" strokeWidth={1.6} />
                </g>
              ))}
              {/* stage 1 */}
              <GateShape gate={gates[0].g} x={70} y={26} lit={values[0]} />
              <line x1={70} y1={40} x2={70} y2={40} stroke="#0f172a" />
              <line x1={116} y1={46} x2={150} y2={46} stroke="#0f172a" strokeWidth={1.6} />
              <text x={133} y={40} textAnchor="middle" fontSize={8} fill="#475569">
                G1 = {values[0] ? 1 : 0}
              </text>
              {/* stage 2 */}
              <GateShape gate={gates[1].g} x={150} y={96} lit={values[1]} />
              <line x1={190} y1={116} x2={224} y2={116} stroke="#0f172a" strokeWidth={1.6} />
              <text x={207} y={110} textAnchor="middle" fontSize={8} fill="#475569">
                G2 = {values[1] ? 1 : 0}
              </text>
              {/* stage 3 */}
              <GateShape gate={gates[2].g} x={224} y={166} lit={values[2]} />
              <line x1={270} y1={186} x2={304} y2={186} stroke="#0f172a" strokeWidth={1.6} />
              {/* output lamp */}
              <g>
                <circle cx={330} cy={186} r={20} fill={finalOn ? '#fde68a' : '#fff'} stroke="#0f172a" strokeWidth={2} />
                <line x1={316} y1={172} x2={344} y2={200} stroke="#0f172a" strokeWidth={1.6} />
                <line x1={344} y1={172} x2={316} y2={200} stroke="#0f172a" strokeWidth={1.6} />
                <text x={330} y={222} textAnchor="middle" fontSize={9} fontWeight={700} fill={finalOn ? '#16a34a' : '#64748b'}>
                  Y {finalOn ? 'ON' : 'OFF'}
                </text>
              </g>
              {/* feedback labels */}
              <text x={300} y={60} fontSize={8} fill="#475569">AND=7408 · OR=7432</text>
              <text x={300} y={72} fontSize={8} fill="#475569">NAND=7400 · NOR=7402</text>
              <text x={300} y={84} fontSize={8} fill="#475569">XOR=7486 · NOT=7404</text>
            </svg>
            <div className="mt-1 text-[10px] text-slate-400">
              {t('logic_hint')}
            </div>
          </div>

          {/* controls + truth table */}
          <div className="space-y-2">
            {gates.map((st, i) => (
              <div key={i} className="rounded-lg border border-slate-700 bg-slate-800/60 p-2">
                <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-200">
                  <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px]">G{i + 1}</span>
                  <select
                    value={st.g}
                    onChange={(e) => setGate(i, { g: e.target.value as Gate })}
                    className="rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-100"
                  >
                    {GATES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <span className="ms-auto font-mono text-[10px] text-emerald-300">{values[i] ? 1 : 0}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  IN-A
                  <select value={st.sa} onChange={(e) => setGate(i, { sa: e.target.value as Src })} className="rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200">
                    {['A', 'B', ...gates.slice(0, i).map((_, k) => `G${k + 1}`)].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  IN-B
                  <select value={st.sb} onChange={(e) => setGate(i, { sb: e.target.value as Src })} className="rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200">
                    {['A', 'B', ...gates.slice(0, i).map((_, k) => `G${k + 1}`)].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('truth_table')} (Y = G3)</div>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="text-slate-400">
                    {['A', 'B', 'G1', 'G2', 'G3 = Y'].map((h) => (
                      <th key={h} className="border border-slate-700 px-1 py-0.5 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-center font-mono text-slate-200">
                  {truth.map((r, i) => {
                    const mid = (() => {
                      const o: boolean[] = [];
                      gates.forEach((st) => {
                        const src = (s: Src): boolean => (s === 'A' ? r.a : s === 'B' ? r.b : o[Number(s[1]) - 1] ?? false);
                        o.push(evalGate(st.g, src(st.sa), src(st.sb)));
                      });
                      return o;
                    })();
                    const active = r.a === a && r.b === b;
                    return (
                      <tr key={i} className={active ? 'bg-sky-500/15' : ''}>
                        <td className="border border-slate-700 py-0.5">{r.a ? 1 : 0}</td>
                        <td className="border border-slate-700 py-0.5">{r.b ? 1 : 0}</td>
                        <td className="border border-slate-700 py-0.5">{mid[0] ? 1 : 0}</td>
                        <td className="border border-slate-700 py-0.5">{mid[1] ? 1 : 0}</td>
                        <td className={`border border-slate-700 py-0.5 font-bold ${r.y ? 'text-emerald-300' : 'text-slate-400'}`}>{r.y ? 1 : 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setGates([
                    { g: 'AND', sa: 'A', sb: 'B' },
                    { g: 'NOT', sa: 'G1', sb: 'A' },
                    { g: 'OR', sa: 'G2', sb: 'A' },
                  ]);
                  setA(false);
                  setB(false);
                }}
                className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
              >
                ↺ {t('reset')}
              </button>
              <button onClick={() => setA(!a)} className="flex-1 rounded-md border border-emerald-600/60 bg-emerald-500/20 px-2 py-1.5 text-[11px] font-semibold text-emerald-200">
                A = {a ? 1 : 0}
              </button>
              <button onClick={() => setB(!b)} className="flex-1 rounded-md border border-emerald-600/60 bg-emerald-500/20 px-2 py-1.5 text-[11px] font-semibold text-emerald-200">
                B = {b ? 1 : 0}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
