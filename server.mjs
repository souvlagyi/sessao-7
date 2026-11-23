import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirCinema, ErroAplicacao, filmes } from './cinema.mjs';

const pasta = dirname(fileURLToPath(import.meta.url));
const arquivo = resolve(process.env.SESSAO7_BANCO || `${pasta}/dados/sessao7.sqlite`);
await mkdir(dirname(arquivo), { recursive: true });
const cinema = abrirCinema(arquivo);
const porta = Number(process.env.PORT || 3217);
const publicos = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/creditos', ['creditos.html', 'text/html; charset=utf-8']],
  ['/estilo.css', ['estilo.css', 'text/css; charset=utf-8']],
  ['/interface.js', ['interface.js', 'text/javascript; charset=utf-8']],
  ...filmes.map(({ id }) => [`/imagens/${id}.jpg`, [`imagens/${id}.jpg`, 'image/jpeg']]),
]);

function json(resposta, status, dados) {
  resposta.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  resposta.end(JSON.stringify(dados));
}

async function lerJson(requisicao) {
  const partes = [];
  let total = 0;
  for await (const parte of requisicao) {
    total += parte.length;
    if (total <= 8192) partes.push(parte);
  }
  if (total > 8192) throw new ErroAplicacao(413, 'Dados acima do limite permitido.');
  try {
    const valor = JSON.parse(Buffer.concat(partes).toString('utf8'));
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error();
    return valor;
  } catch {
    throw new ErroAplicacao(400, 'Envie um objeto JSON válido.');
  }
}

const servidor = createServer(async (requisicao, resposta) => {
  resposta.setHeader('X-Content-Type-Options', 'nosniff');
  resposta.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  try {
    const rota = new URL(requisicao.url, 'http://localhost').pathname;
    const metodo = requisicao.method;
    if (rota === '/api/catalogo' && metodo === 'GET') return json(resposta, 200, cinema.catalogo());
    if (rota === '/api/sessoes' && metodo === 'POST') return json(resposta, 201, cinema.criarSessao(await lerJson(requisicao)));

    const sessao = /^\/api\/sessoes\/(\d{1,10})\/reservas$/.exec(rota);
    if (sessao && metodo === 'GET') return json(resposta, 200, cinema.reservas(Number(sessao[1])));
    if (sessao && metodo === 'POST') return json(resposta, 201, cinema.reservar(Number(sessao[1]), await lerJson(requisicao)));

    const reserva = /^\/api\/reservas\/([A-Z\d]{8,12})$/.exec(rota);
    if (reserva && metodo === 'PATCH') return json(resposta, 200, cinema.mudarStatus(reserva[1], await lerJson(requisicao)));

    if (metodo === 'GET' && publicos.has(rota)) {
      const [nome, tipo] = publicos.get(rota);
      const conteudo = await readFile(resolve(pasta, 'public', nome));
      resposta.writeHead(200, { 'Content-Type': tipo });
      return resposta.end(conteudo);
    }
    if (rota === '/favicon.ico') { resposta.writeHead(204); return resposta.end(); }
    return json(resposta, 404, { erro: 'Página não encontrada.' });
  } catch (erro) {
    if (erro instanceof ErroAplicacao) return json(resposta, erro.status, { erro: erro.message });
    console.error(erro);
    return json(resposta, 500, { erro: 'O servidor encontrou um erro. Tente novamente.' });
  }
});

servidor.on('error', erro => {
  console.error(erro.code === 'EADDRINUSE' ? 'A porta já está em uso. Feche a outra janela do Sessão 7 ou altere PORT.' : erro.message);
  process.exitCode = 1;
});
servidor.listen(porta, '127.0.0.1', () => {
  const endereco = `http://127.0.0.1:${servidor.address().port}`;
  console.log(`Sessão 7 disponível em ${endereco}`);
  if (process.platform === 'win32' && process.argv.includes('--abrir')) {
    const navegador = spawn('explorer.exe', [endereco], { windowsHide: true, stdio: 'ignore' });
    navegador.on('error', () => console.log('Abra o endereço acima no navegador.'));
    navegador.unref();
  }
});
