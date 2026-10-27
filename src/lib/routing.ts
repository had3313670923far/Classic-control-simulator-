import type { Circuit, CircuitComponent, Wire, WireRoute } from '../types';
import { pinWorld } from './catalog';

export interface Pt {
  x: number;
  y: number;
}

/** Five professional routing styles + the automatic elbow. */
export function routeStyle(A: Pt, B: Pt, style: WireRoute, mid?: number, hv?: boolean): Pt[] {
  const midX = mid ?? Math.round((A.x + B.x) / 2);
  const midY = mid ?? Math.round((A.y + B.y) / 2);
  switch (style) {
    case 'parallel': {
      // two long parallel runs joined by short perpendicular jumps
      const midX2 = Math.round(A.x + (B.x - A.x) * 0.5);
      return [A, { x: midX2, y: A.y }, { x: midX2, y: B.y }, B];
    }
    case 'elbow': {
      return hv ? [A, { x: B.x, y: A.y }, B] : [A, { x: A.x, y: B.y }, B];
    }
    case 'plus': {
      // straight through the geometric centre on both axes
      const cx = midX;
      const cy = midY;
      return [A, { x: A.x, y: cy }, { x: cx, y: cy }, { x: cx, y: B.y }, B];
    }
    case 'tee': {
      // T-shaped branch: vertical stub, long horizontal run, vertical drop
      const midY2 = Math.round(A.y + (B.y - A.y) * 0.35);
      return [A, { x: A.x, y: midY2 }, { x: B.x, y: midY2 }, B];
    }
    case 'straight': {
      // direct point-to-point (flies past components – useful for buses / documentation)
      return [A, B];
    }
    case 'rail': {
      // power-bus style: rise to the nearest rail then travel flat to the target column
      const railY = Math.round(Math.min(A.y, B.y) - 40);
      return [A, { x: A.x, y: railY }, { x: B.x, y: railY }, B];
    }
    case 'offset': {
      // parallel offset lane – keeps two harnesses side by side
      const lane = mid === undefined ? 24 : mid;
      const off = A.y <= B.y ? -lane : lane;
      const y1 = A.y + off;
      const y2 = B.y + off;
      return [A, { x: A.x, y: y1 }, { x: B.x, y: y1 }, { x: B.x, y: y2 }, B];
    }
    case 'step': {
      // staircase: two short 90° steps instead of one big elbow
      const dx = Math.round((B.x - A.x) / 2);
      const dy = Math.round((B.y - A.y) / 2);
      return [A, { x: A.x + dx, y: A.y }, { x: A.x + dx, y: A.y + dy }, { x: B.x, y: A.y + dy }, B];
    }
    case 'zigzag': {
      // compact three-bend dogleg for crowded control panels
      const dx = Math.round((B.x - A.x) / 3);
      return [A, { x: A.x + dx, y: A.y }, { x: A.x + dx, y: B.y }, { x: A.x + dx * 2, y: B.y }, { x: A.x + dx * 2, y: A.y }, B];
    }
    case 'arc': {
      // single smooth corner: straight, rounded turn, straight (fewer visible bends)
      const ay = A.y + Math.round((B.y - A.y) * 0.18);
      return [A, { x: A.x, y: ay }, { x: B.x, y: ay }, B];
    }
    default:
      return hv ? [A, { x: B.x, y: A.y }, B] : [A, { x: A.x, y: midY }, { x: B.x, y: midY }, B];
  }
}

/** Orthogonal route for a wire: vertical – horizontal – vertical (or h-v-h for horizontal pins). */
export function routeWire(w: Wire, compMap: Map<string, CircuitComponent>): { pts: Pt[]; horizontalFirst: boolean } | null {
  const ca = compMap.get(w.a.c);
  const cb = compMap.get(w.b.c);
  if (!ca || !cb) return null;
  const A = pinWorld(ca, w.a.p);
  const B = pinWorld(cb, w.b.p);
  if (!A || !B) return null;
  if (w.route && w.route !== 'auto') return { pts: routeStyle(A, B, w.route, w.mid, w.hv), horizontalFirst: false };
  return routePoints(A, B, w.mid, w.hv);
}

export function routePoints(A: Pt & { dir?: string }, B: Pt & { dir?: string }, mid?: number, horizontalFirst?: boolean): { pts: Pt[]; horizontalFirst: boolean } {
  if ((A.x === B.x || A.y === B.y) && (mid === undefined || horizontalFirst === undefined)) {
    return { pts: [A, B], horizontalFirst: false };
  }
  if (horizontalFirst) {
    const midX = mid ?? Math.round((A.x + B.x) / 2);
    return {
      pts: [A, { x: midX, y: A.y }, { x: midX, y: B.y }, B],
      horizontalFirst: true,
    };
  }
  const midY = mid ?? Math.round((A.y + B.y) / 2);
  return {
    pts: [A, { x: A.x, y: midY }, { x: B.x, y: midY }, B],
    horizontalFirst: false,
  };
}

export function ptsToPath(pts: Pt[]): string {
  return pts.map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`)).join(' ');
}

export function compMapOf(circuit: Circuit) {
  return new Map(circuit.components.map((c) => [c.id, c] as const));
}

/** Count wires attached to each terminal – used to draw junction dots where 3+ wires meet. */
export function terminalWireCounts(circuit: Circuit): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of circuit.wires) {
    const ka = w.a.c + ':' + w.a.p;
    const kb = w.b.c + ':' + w.b.p;
    out[ka] = (out[ka] || 0) + 1;
    out[kb] = (out[kb] || 0) + 1;
  }
  return out;
}
