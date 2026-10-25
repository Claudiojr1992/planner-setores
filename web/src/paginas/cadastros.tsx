import { useState } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuCheck, LuUserPlus } from 'react-icons/lu';
import { useDados } from '../app/contexto';
import type { Papel, Perfil, Setor } from '../lib/types';
import { PAPEL, aberta, fmtData } from '../lib/regras';
import { Avatar, Aviso, Campo, Modal, Painel, PontoSetor, Toggle, Vazio } from '../ui/base';

const CORES = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777', '#0891b2', '#dc2626', '#4f46e5', '#65a30d', '#475569'];

export function Setores() {
  const { dados, svc, executar, confirmar } = useDados();
  const [edit, setEdit] = useState<Partial<Setor> | null>(null);
  return <>
    <div className="cabeca"><div className="t"><h1>Setores</h1><p>Áreas da empresa, suas cores e gestores responsáveis.</p></div><div className="sp"><button className="btn pri" onClick={() => setEdit({ cor: CORES[dados.setores.length % CORES.length] })}><LuPlus size={16} />Novo setor</button></div></div>
    <Painel sem>{dados.setores.length === 0 ? <div style={{ padding: 18 }}><Vazio>Nenhum setor cadastrado. Comece criando os setores da empresa.</Vazio></div> :
      <div className="tabela-wrap"><table className="tb"><thead><tr><th>Setor</th><th>Gestor</th><th className="d">Pessoas</th><th className="d">Abertas</th><th>Vínculos</th><th /></tr></thead>
        <tbody>{dados.setores.map(s => { const g = dados.perfis.find(p => p.id === s.gestor_id);
          return <tr key={s.id}><td><span className="row"><PontoSetor s={s} /><span><b>{s.nome}</b>{s.descricao && <div className="xs muted">{s.descricao}</div>}</span></span></td>
            <td>{g ? <span className="row"><Avatar p={g} setores={dados.setores} tam="p" />{g.nome}</span> : <span className="pill t-amber">sem gestor</span>}</td>
            <td className="d num">{dados.perfis.filter(p => p.setor_id === s.id && p.ativo).length}</td>
            <td className="d num">{dados.atividades.filter(a => a.setor_id === s.id && aberta(a)).length}</td>
            <td className="sm muted">{dados.vinculos.filter(v => v.origem_id === s.id).length} saída(s) · {dados.vinculos.filter(v => v.destino_id === s.id).length} entrada(s)</td>
            <td className="d"><div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn p" onClick={() => setEdit(s)}><LuPencil size={13} />Editar</button>
              <button className="btn p fant perigo" title="Excluir" onClick={async () => { if (await confirmar({ titulo: 'Excluir setor', perigo: true, ok: 'Excluir', texto: <>Excluir <b>{s.nome}</b>? Vínculos com outros setores também serão removidos.</> })) executar(() => svc.excluirSetor(s), 'Setor excluído'); }}><LuTrash2 size={14} /></button></div></td></tr>; })}</tbody></table></div>}
    </Painel>
    {edit && <ModalSetor s={edit} onFechar={() => setEdit(null)} />}
  </>;
}

function ModalSetor({ s, onFechar }: { s: Partial<Setor>; onFechar: () => void }) {
  const { dados, svc, executar } = useDados();
  const [v, setV] = useState({ nome: s.nome || '', cor: s.cor || '#2563eb', descricao: s.descricao || '', gestor_id: s.gestor_id || '' });
  return <Modal titulo={s.id ? 'Editar setor' : 'Novo setor'} onFechar={onFechar}
    rodape={<><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" onClick={async () => { const r = await executar(() => svc.salvarSetor({ ...s, ...v, gestor_id: v.gestor_id || null }), 'Setor salvo'); if (r) onFechar(); }}>Salvar</button></>}>
    <Campo rotulo="Nome"><input className="inp" autoFocus value={v.nome} onChange={e => setV({ ...v, nome: e.target.value })} placeholder="Ex.: Fiscal" /></Campo>
    <Campo rotulo="Descrição"><input className="inp" value={v.descricao} onChange={e => setV({ ...v, descricao: e.target.value })} placeholder="Responsabilidades do setor" /></Campo>
    <Campo rotulo="Cor"><div className="row wrap">{CORES.map(c => <button key={c} type="button" onClick={() => setV({ ...v, cor: c })} style={{ width: 30, height: 30, borderRadius: 8, background: c, border: v.cor === c ? '3px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }} aria-label={c} />)}<input type="color" value={v.cor} onChange={e => setV({ ...v, cor: e.target.value })} style={{ width: 40, height: 32, border: 0, background: 'none' }} /></div></Campo>
    <Campo rotulo="Gestor" ajuda="O gestor aceita solicitações, distribui atividades e programa férias da equipe."><select className="inp" value={v.gestor_id} onChange={e => setV({ ...v, gestor_id: e.target.value })}><option value="">— sem gestor —</option>
      {dados.perfis.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}{p.setor_id ? ` (${dados.setores.find(x => x.id === p.setor_id)?.nome})` : ''}</option>)}</select></Campo>
  </Modal>;
}

export function Pessoas() {
  const { dados, eu, svc, executar, confirmar, modo } = useDados();
  const [edit, setEdit] = useState<Perfil | null>(null);
  const [busca, setBusca] = useState('');
  const pendentes = dados.perfis.filter(p => !p.ativo && !p.setor_id);
  const lista = dados.perfis.filter(p => !pendentes.includes(p) && (!busca || p.nome.toLowerCase().includes(busca.toLowerCase()) || p.email.includes(busca.toLowerCase())));
  return <>
    <div className="cabeca"><div className="t"><h1>Pessoas e acessos</h1><p>Aprove cadastros, defina setor e papel de cada pessoa.</p></div></div>
    <Aviso>Para incluir alguém, peça que a pessoa se cadastre em <b>Criar conta</b> na tela de login{modo === 'supabase' ? '' : ' (no modo demonstração os dados ficam neste navegador)'}. O cadastro aparece abaixo para aprovação.</Aviso>
    {pendentes.length > 0 && <Painel titulo={<span className="row"><LuUserPlus size={17} />Aguardando aprovação</span>} sub={`${pendentes.length} cadastro(s)`}>
      <div className="col" style={{ gap: 10 }}>{pendentes.map(p => <div key={p.id} className="row wrap" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
        <Avatar p={p} tam="m" /><div className="grow"><b>{p.nome}</b><div className="xs muted">{p.email} · cadastrado em {fmtData(p.criado_em)}</div></div>
        <button className="btn p pri" onClick={() => setEdit({ ...p, ativo: true })}><LuCheck size={14} />Aprovar e definir setor</button>
        <button className="btn p fant perigo" onClick={async () => { if (await confirmar({ titulo: 'Recusar cadastro', perigo: true, ok: 'Excluir cadastro', texto: <>Excluir o cadastro de <b>{p.nome}</b>?</> })) executar(() => svc.excluirPerfil(p), 'Cadastro removido'); }}>Recusar</button>
      </div>)}</div></Painel>}
    <Painel sem titulo="Pessoas" acoes={<input className="inp" style={{ width: 240 }} placeholder="Buscar por nome ou e-mail" value={busca} onChange={e => setBusca(e.target.value)} />}>
      <div className="tabela-wrap"><table className="tb"><thead><tr><th>Nome</th><th>Setor</th><th>Papel</th><th className="d">Abertas</th><th>Situação</th><th /></tr></thead>
        <tbody>{lista.map(p => { const s = dados.setores.find(x => x.id === p.setor_id); const gestorDe = dados.setores.filter(x => x.gestor_id === p.id);
          return <tr key={p.id}><td><span className="row"><Avatar p={p} setores={dados.setores} /><span><b>{p.nome}</b>{p.id === eu.id && <span className="xs muted"> (você)</span>}<div className="xs muted">{p.email}{p.cargo ? ` · ${p.cargo}` : ''}</div></span></span></td>
            <td>{s ? <span className="row"><PontoSetor s={s} />{s.nome}</span> : <span className="muted">—</span>}</td>
            <td>{PAPEL[p.papel]}{gestorDe.length > 0 && <div className="xs muted">gestor de {gestorDe.map(x => x.nome).join(', ')}</div>}</td>
            <td className="d num">{dados.atividades.filter(a => a.responsavel_id === p.id && aberta(a)).length}</td>
            <td><span className={`pill ${p.ativo ? 't-green' : 't-gray'}`}>{p.ativo ? 'Ativo' : 'Bloqueado'}</span></td>
            <td className="d"><button className="btn p" onClick={() => setEdit(p)}><LuPencil size={13} />Editar</button></td></tr>; })}</tbody></table></div>
    </Painel>
    {edit && <ModalPessoa p={edit} onFechar={() => setEdit(null)} />}
  </>;
}

function ModalPessoa({ p, onFechar }: { p: Perfil; onFechar: () => void }) {
  const { dados, eu, svc, executar } = useDados();
  const [v, setV] = useState({ nome: p.nome, cargo: p.cargo || '', setor_id: p.setor_id || '', papel: p.papel, ativo: p.ativo });
  const abertas = dados.atividades.filter(a => a.responsavel_id === p.id && aberta(a)).length;
  return <Modal titulo={p.ativo === false || !p.setor_id ? 'Liberar acesso' : 'Editar pessoa'} sub={p.email} onFechar={onFechar}
    rodape={<><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" onClick={async () => {
      const r = await executar(() => svc.salvarPerfil(p.id, { nome: v.nome, cargo: v.cargo || null, setor_id: v.papel === 'admin' && !v.setor_id ? null : v.setor_id || null, papel: v.papel, ativo: v.ativo }), 'Pessoa atualizada'); if (r) onFechar();
    }}>Salvar</button></>}>
    <div className="grade">
      <Campo rotulo="Nome"><input className="inp" value={v.nome} onChange={e => setV({ ...v, nome: e.target.value })} /></Campo>
      <Campo rotulo="Cargo"><input className="inp" value={v.cargo} onChange={e => setV({ ...v, cargo: e.target.value })} placeholder="Ex.: Analista Fiscal" /></Campo>
      <Campo rotulo="Setor"><select className="inp" value={v.setor_id} onChange={e => setV({ ...v, setor_id: e.target.value })}><option value="">— nenhum —</option>{dados.setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></Campo>
      <Campo rotulo="Papel"><select className="inp" value={v.papel} onChange={e => setV({ ...v, papel: e.target.value as Papel })} disabled={p.id === eu.id && dados.perfis.filter(x => x.papel === 'admin' && x.ativo).length < 2}>
        {(Object.keys(PAPEL) as Papel[]).map(k => <option key={k} value={k}>{PAPEL[k]}</option>)}</select></Campo>
    </div>
    <div className="col sm muted" style={{ gap: 2 }}><span><b>Colaborador:</b> executa as atividades da própria fila e solicita a setores vinculados.</span><span><b>Gestor:</b> aceita, distribui, programa férias e desenha fluxos e vínculos.</span><span><b>Administrador:</b> acesso total, cadastros, marca e integrações.</span></div>
    {v.papel === 'gestor' && v.setor_id && <Aviso>Ao salvar, {v.nome.split(' ')[0]} passa a ser o gestor de <b>{dados.setores.find(s => s.id === v.setor_id)?.nome}</b>.</Aviso>}
    {p.id !== eu.id && <Toggle marcado={v.ativo} onChange={x => setV({ ...v, ativo: x })} rotulo={v.ativo ? 'Acesso liberado' : 'Acesso bloqueado'} />}
    {!v.ativo && abertas > 0 && <Aviso tipo="atencao">Esta pessoa tem {abertas} atividade(s) aberta(s). Redistribua-as no painel do setor.</Aviso>}
  </Modal>;
}
