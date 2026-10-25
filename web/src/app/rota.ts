/* Roteador por hash (#/caminho?x=1): funciona em qualquer servidor estático, sem configuração. */
import { useEffect, useState } from 'react';

export interface Rota { caminho: string; partes: string[]; query: URLSearchParams }

export function lerRota(): Rota {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '') || '/';
  const [c, q] = h.split('?');
  const caminho = '/' + c.replace(/^\/+|\/+$/g, '');
  return { caminho, partes: caminho.split('/').filter(Boolean), query: new URLSearchParams(q || '') };
}
export function navegar(para: string, substituir = false) {
  const alvo = '#' + (para.startsWith('/') ? para : '/' + para);
  if (substituir) history.replaceState(null, '', location.pathname + location.search + alvo);
  else location.hash = alvo;
  if (substituir) window.dispatchEvent(new HashChangeEvent('hashchange'));
}
export function useRota(): Rota {
  const [r, setR] = useState(lerRota);
  useEffect(() => {
    const f = () => setR(lerRota());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
