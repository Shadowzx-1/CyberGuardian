// ── State ──────────────────────────────────────────────
const history = [];
const stats = { safe: 0, warn: 0, bad: 0 };

// ── Init ────────────────────────────────────────────────
document.getElementById('urlInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') verificar();
});

// ── Helpers ─────────────────────────────────────────────
function normalizeUrl(raw) {
  raw = raw.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { return new URL(raw).href; } catch { return null; }
}

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function isShortener(domain) {
  const list = [
    'bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','buff.ly','short.io',
    'rebrand.ly','cutt.ly','is.gd','v.gd','tiny.cc','shorte.st','adf.ly',
    'su.pr','tr.im','snip.ly','s.id','qr.ae','tny.im'
  ];
  return list.some(s => domain === s || domain.endsWith('.' + s));
}

function analyzeDomain(domain) {
  const suspTlds = ['xyz','top','click','loan','win','work','party','review','gq','tk','ml','cf','ga','pw','icu','buzz'];
  const phishKeywords = [
    'login','secure','verify','account','update','banking','paypal','amazon',
    'netflix','bradesco','itau','nubank','bb','caixa','cpf','senha','premio',
    'gratis','clique','ganhe','saque','pix-','-pix','atualiz'
  ];
  const tld = domain.split('.').pop().toLowerCase();
  return {
    suspTld: suspTlds.includes(tld),
    phish: phishKeywords.some(k => domain.toLowerCase().includes(k))
  };
}

function runChecks(url) {
  const domain = getDomain(url);
  const shortener = isShortener(domain);
  const { suspTld, phish } = analyzeDomain(domain);
  const https       = url.startsWith('https://');
  const hasIP       = /^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(url);
  const tooLong     = url.length > 200;
  const manyParts   = domain.split('.').length > 4;
  const suspChars   = /[^\x00-\x7F]/.test(domain); // unicode lookalike chars

  const flags = [];
  if (shortener)  flags.push('encurtador de links — destino real oculto');
  if (!https)     flags.push('sem HTTPS — conexão sem criptografia');
  if (hasIP)      flags.push('aponta para endereço IP direto');
  if (suspTld)    flags.push('domínio de topo associado a spam/golpes');
  if (phish)      flags.push('palavras-chave de phishing no domínio');
  if (tooLong)    flags.push('URL anormalmente longa');
  if (manyParts)  flags.push('excesso de subdomínios');
  if (suspChars)  flags.push('caracteres unicode suspeitos no domínio');

  let verdict;
  if (flags.length === 0)      verdict = 'safe';
  else if (flags.length <= 2)  verdict = 'warn';
  else                         verdict = 'bad';

  return { domain, shortener, https, hasIP, flags, verdict };
}

// ── AI Analysis ─────────────────────────────────────────
async function callAI(url, domain, flags) {
  const prompt = `Analise este link de forma objetiva (2–3 frases em português informal):
URL: ${url}
Domínio: ${domain}
Alertas: ${flags.length ? flags.join('; ') : 'nenhum'}

Diga se parece seguro ou suspeito e por quê. Seja direto e claro.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  return data.content?.[0]?.text || 'Análise indisponível no momento.';
}

// ── UI Rendering ─────────────────────────────────────────
function verdictLabel(v) {
  if (v === 'safe') return 'Parece seguro';
  if (v === 'warn') return 'Atenção';
  return 'Alto risco';
}

function verdictDot(v) {
  if (v === 'safe') return 'safe';
  if (v === 'warn') return 'warn';
  return 'bad';
}

function renderResult(url, checks) {
  const { domain, shortener, https, hasIP, flags, verdict } = checks;
  const badgeClass = `badge-${verdict === 'safe' ? 'safe' : verdict === 'warn' ? 'warning' : 'danger'}`;
  const label = verdictLabel(verdict);

  const flagsHTML = flags.length
    ? `<ul class="flags-list">${flags.map(f => `<li>↳ ${f}</li>`).join('')}</ul>`
    : `<span class="d-value ok">Nenhum</span>`;

  return `
    <div class="result-card" id="resultCard">
      <div class="status-badge ${badgeClass}">${label}</div>
      <p class="result-url">${url}</p>
      <div class="details">
        <div class="detail-row">
          <span class="d-label">Domínio</span>
          <span class="d-value">${domain}</span>
        </div>
        <div class="detail-row">
          <span class="d-label">Protocolo</span>
          <span class="d-value ${https ? 'ok' : 'bad'}">${https ? 'HTTPS — seguro' : 'HTTP — inseguro'}</span>
        </div>
        <div class="detail-row">
          <span class="d-label">Encurtador</span>
          <span class="d-value ${shortener ? 'warn' : 'ok'}">${shortener ? 'Sim' : 'Não'}</span>
        </div>
        <div class="detail-row">
          <span class="d-label">IP direto</span>
          <span class="d-value ${hasIP ? 'bad' : 'ok'}">${hasIP ? 'Sim — suspeito' : 'Não'}</span>
        </div>
        <div class="detail-row">
          <span class="d-label">Alertas</span>
          ${flagsHTML}
        </div>
      </div>
      <div class="ai-block">
        <div class="ai-label">análise com ia</div>
        <div class="ai-loading" id="aiContent">
          <span class="mini-spinner"></span> Consultando IA...
        </div>
      </div>
    </div>`;
}

function renderHistory() {
  if (history.length === 0) {
    document.getElementById('historyArea').innerHTML = '';
    return;
  }

  const total = stats.safe + stats.warn + stats.bad;
  const statsHTML = `
    <div class="stats-row">
      <span class="stat-pill"><span class="num">${total}</span> verificados</span>
      <span class="stat-pill"><span class="num" style="color:var(--green-tx)">${stats.safe}</span> seguros</span>
      <span class="stat-pill"><span class="num" style="color:var(--amber-tx)">${stats.warn}</span> atenção</span>
      <span class="stat-pill"><span class="num" style="color:var(--red-tx)">${stats.bad}</span> risco</span>
    </div>`;

  const itemsHTML = history.map((h, i) => `
    <li class="history-item" onclick="recheck('${escapeAttr(h.url)}')">
      <span class="h-dot ${verdictDot(h.verdict)}"></span>
      <span class="h-domain">${h.domain}</span>
      <span class="h-status">${verdictLabel(h.verdict)}</span>
    </li>`).join('');

  document.getElementById('historyArea').innerHTML = `
    <div class="history-section">
      <div class="history-header">
        <span class="history-title">Histórico</span>
        <button class="btn-clear" onclick="clearHistory()">Limpar</button>
      </div>
      ${statsHTML}
      <ul class="history-list">${itemsHTML}</ul>
    </div>`;
}

function escapeAttr(str) {
  return str.replace(/'/g, "\\'");
}

function setLoading(on) {
  const btn = document.getElementById('checkBtn');
  const txt = document.getElementById('btnText');
  const spinner = document.getElementById('btnSpinner');
  btn.disabled = on;
  txt.textContent = on ? 'Verificando' : 'Verificar';
  spinner.classList.toggle('hidden', !on);
}

// ── Main Action ──────────────────────────────────────────
async function verificar() {
  const raw = document.getElementById('urlInput').value;
  const url = normalizeUrl(raw);
  const area = document.getElementById('resultArea');

  if (!url) {
    area.innerHTML = `<div class="error-msg">Link inválido. Verifique e tente novamente.</div>`;
    return;
  }

  document.getElementById('urlInput').value = '';
  setLoading(true);

  await new Promise(r => setTimeout(r, 400));

  const checks = runChecks(url);
  area.innerHTML = renderResult(url, checks);

  // Track history
  stats[checks.verdict]++;
  history.unshift({ url, domain: checks.domain, verdict: checks.verdict });
  if (history.length > 20) history.pop();
  renderHistory();

  setLoading(false);

  // AI async
  try {
    const aiText = await callAI(url, checks.domain, checks.flags);
    const el = document.getElementById('aiContent');
    if (el) {
      el.className = 'ai-text';
      el.textContent = aiText;
    }
  } catch {
    const el = document.getElementById('aiContent');
    if (el) {
      el.className = 'ai-text';
      el.textContent = 'Análise de IA indisponível no momento.';
    }
  }
}

function recheck(url) {
  document.getElementById('urlInput').value = url;
  verificar();
}

function clearHistory() {
  history.length = 0;
  stats.safe = stats.warn = stats.bad = 0;
  document.getElementById('historyArea').innerHTML = '';
}
