/* Cor da marca da empresa: personalizável em Empresa e marca.
   Define --marca e --marca-texto no <html>; o restante do tema deriva delas no CSS. */
export const COR_PADRAO = '#0b7a75';
export const CORES_SUGERIDAS = ['#0b7a75', '#1f5fbf', '#3d4bb8', '#7a3fb5', '#b0306a', '#c2410c', '#a16207', '#2f7d32', '#334155'];
const CHAVE = 'planner.marca';

export const corValida = (c?: string | null): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** Luminância relativa (WCAG) de uma cor #rrggbb. */
export function luminancia(hex: string) {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
/** Contraste entre duas cores (1 a 21). */
export function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/** Texto sobre a cor da marca: branco, a não ser que a cor seja clara demais. */
export const textoSobre = (c: string) => (contraste(c, '#ffffff') >= 3 ? '#ffffff' : '#10191f');

export function aplicarMarca(cor?: string | null) {
  const c = corValida(cor) ? cor.toLowerCase() : COR_PADRAO;
  if (typeof document === 'undefined') return c;
  const r = document.documentElement.style;
  r.setProperty('--marca', c);
  r.setProperty('--marca-texto', textoSobre(c));
  try { localStorage.setItem(CHAVE, c); } catch { /* navegador sem armazenamento */ }
  return c;
}
