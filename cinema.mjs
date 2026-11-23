import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';

export const filmes = [
  { id: 'tears-of-steel', titulo: 'Tears of Steel', genero: 'Ficção científica', ano: 2012, minutos: 12,
    sinopse: 'Em uma Amsterdã futurista, cientistas e combatentes reencenam uma lembrança para deter uma invasão de robôs.' },
  { id: 'sintel', titulo: 'Sintel', genero: 'Fantasia', ano: 2010, minutos: 15,
    sinopse: 'Uma jovem viajante atravessa montanhas e terras desconhecidas em busca de um dragão que acolheu.' },
  { id: 'big-buck-bunny', titulo: 'Big Buck Bunny', genero: 'Comédia', ano: 2008, minutos: 10,
    sinopse: 'Um coelho pacato decide dar o troco a três travessos moradores da floresta.' },
];

const fuso = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function agora() {
  return fuso.format(new Date()).replace(' ', 'T');
}

function diaFuturo(dias, hora) {
  const data = new Date(`${agora().slice(0, 10)}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return `${data.toISOString().slice(0, 10)}T${hora}`;
}

export class ErroAplicacao extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export function abrirCinema(arquivo) {
  const banco = new DatabaseSync(arquivo);
  banco.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS sessoes (
      id INTEGER PRIMARY KEY,
      filme TEXT NOT NULL,
      inicio TEXT NOT NULL,
      sala TEXT NOT NULL,
      capacidade INTEGER NOT NULL CHECK (capacidade BETWEEN 1 AND 300),
      UNIQUE(inicio, sala)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS reservas (
      codigo TEXT PRIMARY KEY,
      sessao_id INTEGER NOT NULL REFERENCES sessoes(id),
      nome TEXT NOT NULL,
      quantidade INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 4),
      status TEXT NOT NULL DEFAULT 'reservada' CHECK (status IN ('reservada', 'presente', 'cancelada'))
    ) STRICT;
    CREATE INDEX IF NOT EXISTS reservas_sessao ON reservas(sessao_id);
  `);

  const contarSessoes = banco.prepare('SELECT COUNT(*) AS total FROM sessoes');
  const inserirSessao = banco.prepare('INSERT INTO sessoes (filme, inicio, sala, capacidade) VALUES (?, ?, ?, ?)');
  const listarSessoes = banco.prepare(`
    SELECT s.*, s.capacidade - COALESCE(SUM(r.quantidade), 0) AS vagas
    FROM sessoes s LEFT JOIN reservas r ON r.sessao_id = s.id AND r.status <> 'cancelada'
    GROUP BY s.id ORDER BY s.inicio, s.id
  `);
  const buscarSessao = banco.prepare('SELECT * FROM sessoes WHERE id = ?');
  const listarReservas = banco.prepare('SELECT * FROM reservas WHERE sessao_id = ? ORDER BY rowid DESC');
  const buscarReserva = banco.prepare('SELECT * FROM reservas WHERE codigo = ?');
  const atualizarReserva = banco.prepare("UPDATE reservas SET status = ? WHERE codigo = ? AND status = 'reservada'");

  // O SQLite verifica a lotação e grava a reserva na mesma instrução.
  const inserirReserva = banco.prepare(`
    INSERT INTO reservas (codigo, sessao_id, nome, quantidade)
    SELECT ?, id, ?, ? FROM sessoes s
    WHERE id = ? AND inicio > ? AND ? <= capacidade - (
      SELECT COALESCE(SUM(quantidade), 0) FROM reservas
      WHERE sessao_id = s.id AND status <> 'cancelada'
    )
  `);

  banco.exec('BEGIN IMMEDIATE');
  try {
    if (contarSessoes.get().total === 0) {
      const primeira = inserirSessao.run('tears-of-steel', diaFuturo(1, '19:00'), 'Sala 1', 8).lastInsertRowid;
      inserirSessao.run('sintel', diaFuturo(3, '18:30'), 'Sala 1', 24);
      inserirSessao.run('big-buck-bunny', diaFuturo(5, '16:00'), 'Sala 1', 20);
      inserirReserva.run('DEMO0001', 'Lia Martins', 3, primeira, agora(), 3);
      inserirReserva.run('DEMO0002', 'Rafa Santos', 3, primeira, agora(), 3);
    }
    banco.exec('COMMIT');
  } catch (erro) {
    banco.exec('ROLLBACK');
    banco.close();
    throw erro;
  }

  function sessao(id) {
    const registro = buscarSessao.get(id);
    if (!registro) throw new ErroAplicacao(404, 'Sessão não encontrada.');
    return registro;
  }

  return {
    catalogo() {
      const momento = agora();
      return { filmes, sessoes: listarSessoes.all().map(item => ({ ...item, encerrada: item.inicio <= momento })) };
    },
    criarSessao({ filme, inicio, sala, capacidade }) {
      if (!filmes.some(item => item.id === filme)) throw new ErroAplicacao(400, 'Escolha um filme do catálogo.');
      const instante = typeof inicio === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(inicio)
        ? new Date(`${inicio}:00Z`) : new Date(NaN);
      if (!Number.isFinite(instante.getTime()) || instante.toISOString().slice(0, 16) !== inicio || inicio <= agora()) {
        throw new ErroAplicacao(400, 'Informe uma data e um horário futuros.');
      }
      const nomeSala = typeof sala === 'string' ? sala.trim() : '';
      if (!nomeSala || nomeSala.length > 50) throw new ErroAplicacao(400, 'Informe uma sala com até 50 caracteres.');
      if (!Number.isInteger(capacidade) || capacidade < 1 || capacidade > 300) {
        throw new ErroAplicacao(400, 'A capacidade precisa estar entre 1 e 300.');
      }
      try {
        return sessao(inserirSessao.run(filme, inicio, nomeSala, capacidade).lastInsertRowid);
      } catch (erro) {
        if (erro.errcode === 2067) throw new ErroAplicacao(409, 'Já existe uma sessão para esta sala nesse horário.');
        throw erro;
      }
    },
    reservas(id) {
      sessao(id);
      return listarReservas.all(id);
    },
    reservar(id, { nome, quantidade }) {
      const nomeLimpo = typeof nome === 'string' ? nome.trim() : '';
      if (nomeLimpo.length < 2 || nomeLimpo.length > 80) throw new ErroAplicacao(400, 'Informe um nome de 2 a 80 caracteres.');
      if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 4) {
        throw new ErroAplicacao(400, 'Escolha entre 1 e 4 lugares.');
      }
      const item = sessao(id);
      const momento = agora();
      if (item.inicio <= momento) throw new ErroAplicacao(409, 'Esta sessão já começou.');
      const codigo = randomBytes(6).toString('hex').toUpperCase();
      if (inserirReserva.run(codigo, nomeLimpo, quantidade, id, momento, quantidade).changes === 0) {
        throw new ErroAplicacao(409, 'Não há vagas suficientes para essa quantidade.');
      }
      return buscarReserva.get(codigo);
    },
    mudarStatus(codigo, { status }) {
      if (status !== 'presente' && status !== 'cancelada') throw new ErroAplicacao(400, 'Ação inválida.');
      if (!buscarReserva.get(codigo)) throw new ErroAplicacao(404, 'Reserva não encontrada.');
      if (atualizarReserva.run(status, codigo).changes === 0) throw new ErroAplicacao(409, 'Esta reserva já foi processada.');
      return buscarReserva.get(codigo);
    },
    fechar() { banco.close(); },
  };
}
