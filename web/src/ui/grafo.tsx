/*
 * Editor de grafos genérico (estilo fluxograma): arrastar nós, ligar pela porta de saída,
 * selecionar/excluir ligações, pan e zoom. Usado no editor de fluxos e no mapa da empresa.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, PointerEvent as RPointerEvent } from 'react';
import { LuZoomIn, LuZoomOut, LuMaximize } from 'react-icons/lu';

export interface GNo { id: string; x: number; y: number; w: number; h: number; conteudo: ReactNode; classe?: string; entrada?: boolean; saida?: boolean }
export interface GAresta { id: string; de: string; para: string; rotulo?: string; classe?: string }
export type Selecao = { tipo: 'no' | 'aresta'; id: string } | null;

interface Props {
  nos: GNo[]; arestas: GAresta[];
  selecao?: Selecao; onSelecionar?: (s: Selecao) => void;
  onMover?: (id: string, x: number, y: number) => void;
  onMoverFim?: (id: string, x: number, y: number) => void;
  onConectar?: (de: string, para: string) => void;
  onExcluir?: (s: NonNullable<Selecao>) => void;
  onSoltarExterno?: (dt: DataTransfer, pos: { x: number; y: number }, noId: string | null) => void;
  aceitaSoltar?: (dt: DataTransfer) => boolean;
  editavel?: boolean; altura?: number | string; dica?: ReactNode; ajustarAoIniciar?: boolean;
}
type Arrasto =
  | { tipo: 'pan'; sx: number; sy: number; vx: number; vy: number; moveu: boolean }
  | { tipo: 'no'; id: string; sx: number; sy: number; ox: number; oy: number; moveu: boolean }
  | { tipo: 'liga'; de: string; x: number; y: number };

const GRADE = 10;
const encaixar = (v: number) => Math.round(v / GRADE) * GRADE;

export function Grafo(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [vista, setVista] = useState({ x: 20, y: 20, z: 1 });
  const vistaRef = useRef(vista); vistaRef.current = vista;
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const ajustou = useRef(false);

  const mundo = useCallback((cx: number, cy: number) => {
    const r = ref.current!.getBoundingClientRect(); const v = vistaRef.current;
    return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z };
  }, []);
  const noSob = (cx: number, cy: number) => {
    const el = document.elementFromPoint(cx, cy) as HTMLElement | null;
    return (el?.closest('[data-gno]') as HTMLElement | null)?.dataset.gno || null;
  };

  const ajustar = useCallback(() => {
    const el = ref.current; if (!el || !p.nos.length) return;
    const minX = Math.min(...p.nos.map(n => n.x)), minY = Math.min(...p.nos.map(n => n.y));
    const maxX = Math.max(...p.nos.map(n => n.x + n.w)), maxY = Math.max(...p.nos.map(n => n.y + n.h));
    const W = el.clientWidth, H = el.clientHeight, m = 50;
    const z = Math.max(0.6, Math.min(1.1, (W - m * 2) / Math.max(1, maxX - minX), (H - m * 2) / Math.max(1, maxY - minY)));
    setVista({ z, x: (W - (maxX - minX) * z) / 2 - minX * z, y: (H - (maxY - minY) * z) / 2 - minY * z });
  }, [p.nos]);
  useLayoutEffect(() => { if (!ajustou.current && p.nos.length && p.ajustarAoIniciar !== false) { ajustou.current = true; ajustar(); } }, [p.nos.length, ajustar, p.ajustarAoIniciar]);

  // zoom com a roda do mouse (listener não-passivo para impedir rolagem da página)
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const w = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(); const v = vistaRef.current;
      const z = Math.max(0.3, Math.min(2, v.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setVista({ z, x: mx - ((mx - v.x) / v.z) * z, y: my - ((my - v.y) / v.z) * z });
    };
    el.addEventListener('wheel', w, { passive: false });
    return () => el.removeEventListener('wheel', w);
  }, []);
  const zoom = (f: number) => {
    const el = ref.current!; const v = vistaRef.current; const z = Math.max(0.3, Math.min(2, v.z * f));
    const mx = el.clientWidth / 2, my = el.clientHeight / 2;
    setVista({ z, x: mx - ((mx - v.x) / v.z) * z, y: my - ((my - v.y) / v.z) * z });
  };

  // teclado: Delete remove seleção
  useEffect(() => {
    if (!p.editavel || !p.onExcluir) return;
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.key === 'Delete' || e.key === 'Backspace') && p.selecao && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) { e.preventDefault(); p.onExcluir!(p.selecao); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [p.editavel, p.onExcluir, p.selecao]);

  const baixo = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    const alvoEl = e.target as HTMLElement;
    if (alvoEl.closest('button, input, select, textarea, a, .rotulo-aresta, path.alvo')) return;
    const porta = alvoEl.closest('.porta.saida') as HTMLElement | null;
    const noEl = alvoEl.closest('[data-gno]') as HTMLElement | null;
    ref.current!.setPointerCapture(e.pointerId);
    if (porta && p.editavel && p.onConectar) {
      const w = mundo(e.clientX, e.clientY);
      setArrasto({ tipo: 'liga', de: porta.dataset.de as string, x: w.x, y: w.y });
    } else if (noEl) {
      const n = p.nos.find(x => x.id === noEl.dataset.gno); if (!n) return;
      setArrasto({ tipo: 'no', id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moveu: false });
    } else {
      setArrasto({ tipo: 'pan', sx: e.clientX, sy: e.clientY, vx: vista.x, vy: vista.y, moveu: false });
    }
  };
  const mover = (e: RPointerEvent) => {
    if (!arrasto) return;
    if (arrasto.tipo === 'pan') {
      const dx = e.clientX - arrasto.sx, dy = e.clientY - arrasto.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) setArrasto({ ...arrasto, moveu: true });
      setVista(v => ({ ...v, x: arrasto.vx + dx, y: arrasto.vy + dy }));
    } else if (arrasto.tipo === 'no') {
      const dx = (e.clientX - arrasto.sx) / vista.z, dy = (e.clientY - arrasto.sy) / vista.z;
      if (!arrasto.moveu && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!p.editavel || !p.onMover) return;
      if (!arrasto.moveu) setArrasto({ ...arrasto, moveu: true });
      p.onMover(arrasto.id, encaixar(arrasto.ox + dx), encaixar(arrasto.oy + dy));
    } else {
      const w = mundo(e.clientX, e.clientY);
      setArrasto({ ...arrasto, x: w.x, y: w.y });
      const n = noSob(e.clientX, e.clientY); setAlvo(n && n !== arrasto.de ? n : null);
    }
  };
  const soltar = (e: RPointerEvent) => {
    if (!arrasto) return;
    if (arrasto.tipo === 'pan' && !arrasto.moveu) p.onSelecionar?.(null);
    if (arrasto.tipo === 'no') {
      if (arrasto.moveu) { const n = p.nos.find(x => x.id === arrasto.id); if (n) p.onMoverFim?.(n.id, n.x, n.y); }
      else p.onSelecionar?.({ tipo: 'no', id: arrasto.id });
    }
    if (arrasto.tipo === 'liga') {
      const n = noSob(e.clientX, e.clientY);
      if (n && n !== arrasto.de) p.onConectar?.(arrasto.de, n);
    }
    setArrasto(null); setAlvo(null);
  };

  const porId = new Map(p.nos.map(n => [n.id, n]));
  const curva = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.max(50, Math.abs(x2 - x1) / 2);
    return { d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, mx: (x1 + 3 * (x1 + dx) + 3 * (x2 - dx) + x2) / 8, my: (y1 + 3 * y1 + 3 * y2 + y2) / 8 };
  };
  const linhas = p.arestas.map(a => {
    const A = porId.get(a.de), B = porId.get(a.para); if (!A || !B) return null;
    // ligações duplas (A→B e B→A) ganham deslocamento para não se sobreporem
    const reversa = p.arestas.some(x => x.de === a.para && x.para === a.de);
    const off = reversa ? (a.de < a.para ? -10 : 10) : 0;
    const c = curva(A.x + A.w, A.y + A.h / 2 + off, B.x - 4, B.y + B.h / 2 + off);
    return { a, ...c };
  }).filter(Boolean) as { a: GAresta; d: string; mx: number; my: number }[];
  const temp = arrasto?.tipo === 'liga' ? (() => { const A = porId.get(arrasto.de); return A ? curva(A.x + A.w, A.y + A.h / 2, arrasto.x, arrasto.y).d : ''; })() : '';

  return (
    <div ref={ref} className={`grafo ${arrasto?.tipo === 'pan' && arrasto.moveu ? 'pan' : ''}`} style={{ height: p.altura ?? 560, backgroundSize: `${20 * vista.z}px ${20 * vista.z}px`, backgroundPosition: `${vista.x}px ${vista.y}px` }}
      onPointerDown={baixo} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={() => { setArrasto(null); setAlvo(null); }}
      onDragOver={e => { if (!p.onSoltarExterno || (p.aceitaSoltar && !p.aceitaSoltar(e.dataTransfer))) return; e.preventDefault(); setAlvo(noSob(e.clientX, e.clientY)); }}
      onDragLeave={e => { if (!ref.current?.contains(e.relatedTarget as Node)) setAlvo(null); }}
      onDrop={e => { if (!p.onSoltarExterno) return; e.preventDefault(); const n = noSob(e.clientX, e.clientY); setAlvo(null); p.onSoltarExterno(e.dataTransfer, mundo(e.clientX, e.clientY), n); }}>
      <div className="mundo" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.z})` }}>
        <svg className="arestas" width="1" height="1">
          <defs>
            <marker id="seta-g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" style={{ fill: 'var(--line)' }} /></marker>
            <marker id="seta-g-sel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" style={{ fill: 'var(--accent)' }} /></marker>
            <marker id="seta-g-q" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" style={{ fill: 'var(--amber)' }} /></marker>
          </defs>
          {linhas.map(({ a, d }) => {
            const sel = p.selecao?.tipo === 'aresta' && p.selecao.id === a.id;
            return <g key={a.id} className={`${a.classe || ''} ${sel ? 'sel' : ''}`}>
              <path className="linha" d={d} markerEnd={`url(#${sel ? 'seta-g-sel' : a.classe?.includes('quente') ? 'seta-g-q' : 'seta-g'})`} />
              <path className="alvo" d={d} onPointerDown={e => { e.stopPropagation(); p.onSelecionar?.({ tipo: 'aresta', id: a.id }); }} />
            </g>;
          })}
          {temp && <path className="temp" d={temp} />}
        </svg>
        {linhas.filter(l => l.a.rotulo).map(({ a, mx, my }) => (
          <div key={'r' + a.id} className={`rotulo-aresta ${a.classe?.includes('quente') ? 'quente' : ''} ${p.selecao?.tipo === 'aresta' && p.selecao.id === a.id ? 'sel' : ''}`} style={{ left: mx, top: my }}
            onPointerDown={e => { e.stopPropagation(); p.onSelecionar?.({ tipo: 'aresta', id: a.id }); }}>{a.rotulo}</div>
        ))}
        {p.nos.map(n => (
          <div key={n.id} data-gno={n.id} className={`gno ${n.classe || ''} ${p.selecao?.tipo === 'no' && p.selecao.id === n.id ? 'sel' : ''} ${alvo === n.id ? 'alvo' : ''}`}
            style={{ left: n.x, top: n.y, width: n.w, height: n.h, cursor: p.editavel ? 'move' : 'pointer' }}>
            {n.entrada !== false && <span className="porta entrada" />}
            {n.conteudo}
            {p.editavel && p.onConectar && n.saida !== false && <span className="porta saida" data-de={n.id} title="Arraste até outro nó para ligar" />}
          </div>
        ))}
      </div>
      {p.dica && <div className="grafo-dica">{p.dica}</div>}
      <div className="grafo-ferr">
        <button className="btn fant icone p" title="Aproximar" onClick={() => zoom(1.2)}><LuZoomIn size={16} /></button>
        <button className="btn fant icone p" title="Afastar" onClick={() => zoom(1 / 1.2)}><LuZoomOut size={16} /></button>
        <button className="btn fant icone p" title="Ajustar à tela" onClick={ajustar}><LuMaximize size={15} /></button>
        <span className="xs muted" style={{ alignSelf: 'center', padding: '0 6px' }}>{Math.round(vista.z * 100)}%</span>
      </div>
    </div>
  );
}
