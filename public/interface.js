const conteudo = document.querySelector('#conteudo');
const janela = document.querySelector('#janela');
const aviso = document.querySelector('#aviso');
const estado = { tela: 'agenda', sessaoId: null, filmes: [], sessoes: [] };
let temporizador;
let carregamento = 0;

const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});
const dataSessao = inicio => dataFormatada.format(new Date(`${inicio}:00Z`));
const filmeDe = sessao => estado.filmes.find(filme => filme.id === sessao.filme);
const plural = (n, singular, pluralizado) => `${n} ${n === 1 ? singular : pluralizado}`;
const entidades = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapar = texto => String(texto).replace(/[&<>"']/g, caractere => entidades[caractere]);

async function api(rota, metodo = 'GET', dados) {
  const resposta = await fetch(rota, {
    method: metodo,
    headers: dados ? { 'Content-Type': 'application/json' } : undefined,
    body: dados ? JSON.stringify(dados) : undefined,
  });
  const resultado = await resposta.json();
  if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível concluir a operação.');
  return resultado;
}

function mostrarAviso(mensagem) {
  aviso.textContent = mensagem;
  aviso.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { aviso.hidden = true; }, 5500);
}

function disponibilidade(sessao) {
  if (sessao.encerrada) return '<span class="situacao esgotada">Encerrada</span>';
  if (sessao.vagas === 0) return '<span class="situacao esgotada">Esgotada</span>';
  return `<span class="situacao ${sessao.vagas <= 4 ? 'poucas' : ''}">${plural(sessao.vagas, 'vaga disponível', 'vagas disponíveis')}</span>`;
}

function botaoReserva(sessao, classe, texto, rotulo) {
  const indisponivel = sessao.encerrada || sessao.vagas === 0;
  return `<button class="botao ${classe}" type="button" data-reservar="${sessao.id}" ${indisponivel ? 'disabled' : ''} ${rotulo ? `aria-label="${escapar(rotulo)}"` : ''}>${texto}</button>`;
}

function cartaz(sessao) {
  const filme = filmeDe(sessao);
  return `<article class="filme">
    <img src="/imagens/${filme.id}.jpg" alt="" width="800" height="400">
    <div class="filme-info">
      <p class="metadados">${filme.genero} · ${filme.minutos} min</p>
      <h3>${filme.titulo}</h3>
      <p class="metadados">${dataSessao(sessao.inicio)} · ${escapar(sessao.sala)}</p>
      <div class="filme-acoes">${disponibilidade(sessao)}${botaoReserva(sessao, 'secundario', 'Reservar', `Reservar ${filme.titulo}`)}</div>
    </div>
  </article>`;
}

function agenda() {
  const sessoes = estado.sessoes.filter(sessao => !sessao.encerrada);
  if (!sessoes.length) return '<div class="cabecalho-secao"><h1>Em cartaz</h1></div><p class="estado-vazio">A próxima programação será divulgada em breve.</p>';
  const destaque = sessoes[0];
  const filme = filmeDe(destaque);
  return `<section class="hero" aria-label="Sessão em destaque">
    <img class="hero-img" src="/imagens/${filme.id}.jpg" alt="">
    <div class="hero-texto">
      <p class="rotulo">Sessão em destaque</p>
      <h1>${filme.titulo}</h1>
      <div class="metadados"><span>${filme.genero} · ${filme.minutos} min</span><span>${dataSessao(destaque.inicio)} · ${escapar(destaque.sala)}</span></div>
      <p>${filme.sinopse}</p>
      <div class="hero-acoes">${botaoReserva(destaque, 'principal', 'Reservar lugar')}${disponibilidade(destaque)}</div>
    </div>
  </section>
  <section aria-labelledby="titulo-grade">
    <div class="cabecalho-secao"><h2 id="titulo-grade">Próximas sessões</h2><p>Entrada gratuita com reserva</p></div>
    <div class="grade">${sessoes.map(cartaz).join('')}</div>
  </section>`;
}

function painel(reservas) {
  const sessao = estado.sessoes.find(item => item.id === estado.sessaoId);
  const linhas = reservas.map(reserva => {
    const situacao = { reservada: 'Reservada', presente: 'Presença confirmada', cancelada: 'Cancelada' }[reserva.status];
    const acoes = reserva.status === 'reservada' ? `
      <button class="botao secundario" type="button" data-codigo="${reserva.codigo}" data-status="presente">Confirmar presença</button>
      <button class="botao secundario perigo" type="button" data-codigo="${reserva.codigo}" data-status="cancelada">Cancelar</button>` : '—';
    return `<tr><td>${escapar(reserva.nome)}</td><td><code>${reserva.codigo}</code></td><td>${reserva.quantidade}</td><td class="situacao ${reserva.status}">${situacao}</td><td>${acoes}</td></tr>`;
  }).join('');
  return `<div class="cabecalho-secao">
    <div><p class="rotulo">Organização</p><h1>Controle de sessões</h1></div>
    <button type="button" class="botao principal" data-nova>Nova sessão</button>
  </div>
  <div class="painel-topo">
    <label for="seletor-sessao">Sessão
      <select id="seletor-sessao">${estado.sessoes.map(item => `<option value="${item.id}" ${item.id === estado.sessaoId ? 'selected' : ''}>${filmeDe(item).titulo} · ${dataSessao(item.inicio)} · ${escapar(item.sala)}</option>`).join('')}</select>
    </label>
    <div class="indicadores">
      <div class="indicador"><strong>${sessao.capacidade}</strong><span>Capacidade</span></div>
      <div class="indicador"><strong>${sessao.capacidade - sessao.vagas}</strong><span>Lugares ocupados</span></div>
      <div class="indicador"><strong>${sessao.vagas}</strong><span>Vagas restantes</span></div>
    </div>
    <p class="aviso-local">Modo demonstração. Use nomes fictícios nas reservas.</p>
  </div>
  <div class="cabecalho-secao"><h2>Lista de reservas</h2><p>${plural(reservas.length, 'registro', 'registros')}</p></div>
  ${linhas ? `<div class="tabela-wrap" role="region" aria-label="Lista de reservas" tabindex="0"><table><thead><tr><th scope="col">Nome</th><th scope="col">Código</th><th scope="col">Lugares</th><th scope="col">Status</th><th scope="col">Ações</th></tr></thead><tbody>${linhas}</tbody></table></div>` : '<p class="estado-vazio">Ainda não há reservas para esta sessão.</p>'}`;
}

async function carregar(focar = false) {
  const pedido = ++carregamento;
  const tela = estado.tela;
  document.querySelectorAll('nav [data-tela]').forEach(botao => {
    if (botao.dataset.tela === tela) botao.setAttribute('aria-current', 'page');
    else botao.removeAttribute('aria-current');
  });
  try {
    const catalogo = await api('/api/catalogo');
    if (pedido !== carregamento) return;
    estado.filmes = catalogo.filmes;
    estado.sessoes = catalogo.sessoes;
    if (!estado.sessoes.some(item => item.id === estado.sessaoId)) estado.sessaoId = estado.sessoes[0]?.id;
    const reservas = tela === 'painel' ? await api(`/api/sessoes/${estado.sessaoId}/reservas`) : [];
    if (pedido !== carregamento) return;
    conteudo.innerHTML = tela === 'painel' ? painel(reservas) : agenda();
    if (focar) conteudo.focus();
  } catch (erro) {
    if (pedido !== carregamento) return;
    conteudo.innerHTML = `<p class="estado-vazio">${escapar(erro.message)} <button class="botao secundario" type="button" data-tentar>Tentar de novo</button></p>`;
  }
}

function modal(titulo, corpo) {
  janela.innerHTML = `<div class="modal-topo"><h2 id="titulo-janela">${titulo}</h2><button type="button" class="modal-fechar" data-fechar aria-label="Fechar">×</button></div>${corpo}`;
  if (!janela.open) janela.showModal();
  janela.querySelector('input, .modal-fechar').focus();
}

function abrirReserva(id) {
  const sessao = estado.sessoes.find(item => item.id === id);
  if (!sessao || sessao.vagas === 0 || sessao.encerrada) return;
  const filme = filmeDe(sessao);
  modal('Reservar lugar', `<p class="apoio">${filme.titulo} · ${dataSessao(sessao.inicio)} · ${escapar(sessao.sala)}</p>
    <form class="formulario" data-form="reserva" data-sessao="${id}">
      <label>Seu nome<input name="nome" required minlength="2" maxlength="80" placeholder="Ex.: Alex Reis" autocomplete="off" autofocus></label>
      <label>Lugares<select name="quantidade"><option value="1">1 lugar</option><option value="2">2 lugares</option><option value="3">3 lugares</option><option value="4">4 lugares</option></select></label>
      <p class="apoio">${plural(sessao.vagas, 'vaga disponível', 'vagas disponíveis')} nesta sessão.</p>
      <p class="mensagem-erro" role="alert" hidden></p>
      <button class="botao principal" type="submit">Confirmar reserva</button>
    </form>`);
  janela.querySelector('[name="nome"]').focus();
}

function abrirNovaSessao() {
  modal('Nova sessão', `<form class="formulario" data-form="sessao">
    <label><span id="rotulo-filme">Filme</span><select name="filme" aria-labelledby="rotulo-filme">${estado.filmes.map(filme => `<option value="${filme.id}">${filme.titulo}</option>`).join('')}</select></label>
    <label>Data e hora (São Paulo)<input name="inicio" type="datetime-local" required></label>
    <label>Sala<input name="sala" required maxlength="50" value="Sala 1"></label>
    <label>Capacidade<input name="capacidade" type="number" min="1" max="300" value="24" required></label>
    <p class="mensagem-erro" role="alert" hidden></p>
    <button class="botao principal" type="submit">Publicar sessão</button>
  </form>`);
}

document.addEventListener('click', async evento => {
  const botao = evento.target.closest('button');
  if (!botao) return;
  if (botao.dataset.tela) {
    estado.tela = botao.dataset.tela;
    await carregar(true);
  } else if (botao.hasAttribute('data-tentar')) await carregar();
  else if (botao.dataset.reservar) abrirReserva(Number(botao.dataset.reservar));
  else if (botao.hasAttribute('data-nova')) abrirNovaSessao();
  else if (botao.hasAttribute('data-fechar')) janela.close();
  else if (botao.dataset.codigo) {
    const cancelar = botao.dataset.status === 'cancelada';
    if (cancelar && !window.confirm('Cancelar esta reserva e devolver os lugares à sessão?')) return;
    botao.disabled = true;
    try {
      await api(`/api/reservas/${botao.dataset.codigo}`, 'PATCH', { status: botao.dataset.status });
      await carregar();
      mostrarAviso(cancelar ? 'Reserva cancelada. Lugares liberados.' : 'Presença confirmada.');
    } catch (erro) {
      mostrarAviso(erro.message);
    } finally {
      botao.disabled = false;
    }
  }
});

conteudo.addEventListener('change', evento => {
  if (evento.target.id === 'seletor-sessao') {
    estado.sessaoId = Number(evento.target.value);
    carregar();
  }
});

janela.addEventListener('submit', async evento => {
  evento.preventDefault();
  const form = evento.target;
  const botao = form.querySelector('button[type="submit"]');
  const erroForm = form.querySelector('.mensagem-erro');
  const dados = Object.fromEntries(new FormData(form));
  botao.disabled = true;
  erroForm.hidden = true;
  try {
    if (form.dataset.form === 'reserva') {
      const id = Number(form.dataset.sessao);
      const sessao = estado.sessoes.find(item => item.id === id);
      const reserva = await api(`/api/sessoes/${id}/reservas`, 'POST', { ...dados, quantidade: Number(dados.quantidade) });
      estado.sessaoId = id;
      if (janela.open) {
        modal('Reserva confirmada', `<p class="apoio">Apresente o código na entrada da sessão.</p>
          <div class="ingresso"><strong>${filmeDe(sessao).titulo}</strong><span>${dataSessao(sessao.inicio)} · ${escapar(sessao.sala)}</span>
          <span>${escapar(reserva.nome)} · ${plural(reserva.quantidade, 'lugar', 'lugares')}</span><code>${reserva.codigo}</code></div>
          <button class="botao principal" type="button" data-fechar>Concluir</button>`);
      } else mostrarAviso(`Reserva confirmada. Código ${reserva.codigo}.`);
    } else {
      const sessao = await api('/api/sessoes', 'POST', { ...dados, capacidade: Number(dados.capacidade) });
      estado.sessaoId = sessao.id;
      janela.close();
      mostrarAviso('Sessão publicada.');
    }
    await carregar();
  } catch (erro) {
    erroForm.textContent = erro.message;
    erroForm.hidden = false;
  } finally {
    botao.disabled = false;
  }
});

carregar();
