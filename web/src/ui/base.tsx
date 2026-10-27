import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LuX, LuInbox, LuInfo, LuTriangleAlert, LuCircleCheck, LuCircleAlert } from 'react-icons/lu';
import type { Perfil, Prioridade, Setor, Status } from '../lib/types';
import { PRIORIDADE, STATUS, iniciais } from '../lib/regras';
import { useApp } from '../app/contexto';

export function Avatar({ p, setores, tam = '', titulo }: { p?: Perfil | null; setores?: Setor[]; tam?: '' | 'p' | 'm' | 'g'; titulo?: string }) {
  if (!p) return <span className={`av vazio ${tam}`} title={titulo || 'Sem responsável'}>?</span>;
  const cor = setores?.find(s => s.id === p.setor_id)?.cor || '#4b5568';
  return <span className={`av ${tam}`} style={{ ['--c' as string]: cor }} title={titulo || p.nome}>{iniciais(p.nome)}</span>;
}
export const PillStatus = ({ s }: { s: Status }) => <span className={`pill ponto t-${STATUS[s].tom}`}>{STATUS[s].rotulo}</span>;
export const Pri = ({ p }: { p: Prioridade }) => <span className={`prio ${p}`}>{p === 'urgente' ? '▲▲ ' : p === 'alta' ? '▲ ' : ''}{PRIORIDADE[p].rotulo}</span>;

/** Símbolo "Elo": dois blocos (setores) ligados pela passagem do trabalho. */
export function Simbolo({ tam = 20, classe = '' }: { tam?: number; classe?: string }) {
  return <svg className={`simbolo ${classe}`} width={tam} height={tam} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="1.5" y="1.5" width="10" height="10" rx="3" fill="currentColor" />
    <rect x="12.5" y="12.5" width="10" height="10" rx="3" fill="currentColor" opacity=".5" />
    <path d="M11.5 6.5h1.5c2.9 0 4.5 1.6 4.5 4.5v1.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>;
}
/** Marca do sistema: logotipo da empresa quando houver, senão o símbolo na cor da marca. */
export function Marca({ logo, nome, tam = 34 }: { logo?: string | null; nome?: string; tam?: number }) {
  return logo ? <img src={logo} alt={nome || 'Logotipo'} /> : <span className="logo-pad" style={{ width: tam, height: tam }}><Simbolo tam={tam} /></span>;
}
export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>;

/** Trilho de passagem: setores por onde o trabalho vem, está e vai. */
export interface NoElo { setor?: Setor | null; atual?: boolean; previsto?: boolean; rotulo?: ReactNode; sub?: ReactNode; onClick?: () => void; titulo?: string }
export function Elo({ nos, grande = false }: { nos: NoElo[]; grande?: boolean }) {
  const lista = nos.filter(n => n.setor);
  if (!lista.length) return null;
  return <span className={`elo ${grande ? 'grande' : ''}`}>{lista.map((n, i) => <span key={i} className="row" style={{ gap: 0, minWidth: 0 }}>
    {i > 0 && <span className={`liga ${n.previsto ? 'prev' : ''}`} style={{ ['--c1' as string]: lista[i - 1].setor?.cor, ['--c2' as string]: n.setor?.cor }} />}
    <span className={`no-e ${n.atual ? 'atual' : ''} ${n.previsto ? 'prev' : ''}`} style={{ ['--c' as string]: n.setor?.cor }} title={n.titulo}
      onClick={n.onClick ? e => { e.stopPropagation(); n.onClick?.(); } : undefined}><i /><span>{n.rotulo ?? n.setor?.nome}</span>{n.sub && <small>{n.sub}</small>}</span>
  </span>)}</span>;
}
export const PontoSetor = ({ s }: { s?: Setor | null }) => <span className="ponto-cor" style={{ ['--c' as string]: s?.cor || '#999' }} />;

export function Modal({ titulo, sub, onFechar, children, rodape, tam = '' }: { titulo: ReactNode; sub?: ReactNode; onFechar: () => void; children: ReactNode; rodape?: ReactNode; tam?: '' | 'largo' | 'estreito' }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onFechar(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onFechar]);
  return (
    <div className="veu" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className={`modal ${tam}`} role="dialog" aria-modal="true">
        <div className="modal-h"><div className="grow"><h2>{titulo}</h2>{sub && <div className="sub">{sub}</div>}</div>
          <button className="btn fant icone p" onClick={onFechar} aria-label="Fechar"><LuX size={18} /></button></div>
        <div className="modal-b">{children}</div>
        {rodape && <div className="modal-f">{rodape}</div>}
      </div>
    </div>
  );
}

export function Campo({ rotulo, ajuda, children, classe = '' }: { rotulo?: ReactNode; ajuda?: ReactNode; children: ReactNode; classe?: string }) {
  return <div className={`campo ${classe}`}>{rotulo && <label>{rotulo}</label>}{children}{ajuda && <span className="ajuda">{ajuda}</span>}</div>;
}
export function Toggle({ marcado, onChange, rotulo, desab }: { marcado: boolean; onChange: (v: boolean) => void; rotulo?: ReactNode; desab?: boolean }) {
  return <label className="toggle" style={desab ? { opacity: .55, pointerEvents: 'none' } : undefined}><input type="checkbox" checked={marcado} onChange={e => onChange(e.target.checked)} /><span className="tr" />{rotulo && <span>{rotulo}</span>}</label>;
}
export function Vazio({ children, icone }: { children: ReactNode; icone?: ReactNode }) {
  return <div className="vazio">{icone || <LuInbox size={28} />}<div>{children}</div></div>;
}
export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'atencao' | 'erro' | 'ok'; children: ReactNode }) {
  const I = tipo === 'atencao' ? LuTriangleAlert : tipo === 'erro' ? LuCircleAlert : tipo === 'ok' ? LuCircleCheck : LuInfo;
  return <div className={`aviso ${tipo}`}><I size={16} /><div>{children}</div></div>;
}
export function Painel({ titulo, sub, acoes, children, sem = false, id }: { titulo?: ReactNode; sub?: ReactNode; acoes?: ReactNode; children: ReactNode; sem?: boolean; id?: string }) {
  return <section className="painel" id={id}>
    {titulo && <div className="painel-h"><h2>{titulo}</h2>{sub && <span className="sub">{sub}</span>}{acoes && <div className="sp row wrap">{acoes}</div>}</div>}
    <div className={`painel-b ${sem ? 'sem' : ''}`}>{children}</div>
  </section>;
}

/** Menu suspenso ancorado no botão. */
export function Suspenso({ gatilho, children, alinhar = 'dir', classe = '' }: { gatilho: (abrir: () => void, aberto: boolean) => ReactNode; children: (fechar: () => void) => ReactNode; alinhar?: 'dir' | 'esq'; classe?: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', f); window.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', f); window.removeEventListener('keydown', k); };
  }, [aberto]);
  return <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
    {gatilho(() => setAberto(a => !a), aberto)}
    {aberto && <div className={`menu ${classe}`} style={{ top: 'calc(100% + 6px)', [alinhar === 'dir' ? 'right' : 'left']: 0 }}>{children(() => setAberto(false))}</div>}
  </div>;
}

/** Caixa de confirmação global (com campo de texto opcional). */
export function DialogoGlobal() {
  const { dialogo, fecharDialogo } = useApp();
  const [txt, setTxt] = useState('');
  useEffect(() => setTxt(''), [dialogo]);
  if (!dialogo) return null;
  const c = dialogo.campo;
  const invalido = !!c && ((c.obrigatorio && !txt.trim()) || (c.min ? txt.trim().length < c.min : false));
  return <Modal titulo={dialogo.titulo} onFechar={() => fecharDialogo(false)} tam="estreito"
    rodape={<><button className="btn" onClick={() => fecharDialogo(false)}>Cancelar</button>
      <button className={`btn ${dialogo.perigo ? 'perigo cheio' : 'pri'}`} disabled={invalido} onClick={() => fecharDialogo(c ? txt.trim() || ' ' : 'ok')}>{dialogo.ok || 'Confirmar'}</button></>}>
    {dialogo.texto && <div style={{ color: 'var(--text-2)' }}>{dialogo.texto}</div>}
    {c && <Campo rotulo={c.rotulo} ajuda={c.min ? `Mínimo de ${c.min} caracteres.` : undefined}>
      <textarea className="inp" autoFocus value={txt} placeholder={c.placeholder} onChange={e => setTxt(e.target.value)} /></Campo>}
  </Modal>;
}
export function Toasts() {
  const { toasts } = useApp();
  return <div className="toasts" aria-live="polite">{toasts.map(t => <div key={t.id} className={`toast ${t.tipo}`}>
    {t.tipo === 'erro' ? <LuCircleAlert size={17} /> : <LuCircleCheck size={17} />}<span>{t.texto}</span></div>)}</div>;
}
export const tamanhoArquivo = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
