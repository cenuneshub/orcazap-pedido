const accountArea = document.getElementById('accountArea');
const listEl = document.getElementById('list');

let items = JSON.parse(
  localStorage.getItem('orcazap_recent_requests_v1') || '[]'
).filter(item => item && item.token);

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function dateLabel(value) {
  return new Date(value || Date.now()).toLocaleString('pt-BR');
}

function removeToken(token) {
  items = items.filter(item => item.token !== token);
  localStorage.setItem(
    'orcazap_recent_requests_v1',
    JSON.stringify(items)
  );
  renderList();
}

function renderList() {
  if (!items.length) {
    listEl.innerHTML = `
      <div class="card">
        <h2>Nenhum pedido salvo neste navegador</h2>
        <p>
          Pedidos publicados aqui ficam disponíveis como atalho local.
          A conta do cliente é a opção recomendada para outros aparelhos.
        </p>
        <a class="button" href="index.html">Publicar pedido</a>
      </div>
    `;
    return;
  }

  listEl.innerHTML = items.map(item => `
    <article class="card">
      <h2>${escapeHtml(item.profession || 'Pedido OrçaZap')}</h2>
      <p>
        ${escapeHtml(
          item.serviceText || 'Acompanhar propostas e andamento.'
        )}
      </p>
      <p class="small">
        ${escapeHtml(item.city || '')}
        ${item.createdAt ? ` • ${escapeHtml(dateLabel(item.createdAt))}` : ''}
      </p>
      <a
        class="button"
        href="acompanhar.html?t=${encodeURIComponent(item.token)}"
      >
        Acompanhar pedido
      </a>
      <button
        class="secondary"
        onclick="removeToken('${escapeHtml(item.token)}')"
      >
        Remover deste navegador
      </button>
    </article>
  `).join('');
}

async function init() {
  const session = await OrcaClientAuth.init();
  const user = session ? await OrcaClientAuth.getUser() : null;

  accountArea.innerHTML = user
    ? `
      <div class="account-bar">
        <div>
          <strong>Conta conectada</strong>
          <p class="small">${escapeHtml(user.email || '')}</p>
        </div>
        <a class="button secondary" href="cliente.html">
          Ver todos os pedidos
        </a>
      </div>
    `
    : `
      <div class="account-bar">
        <div>
          <strong>Quer acessar em outro aparelho?</strong>
          <p class="small">
            Crie sua conta por e-mail e proteja cada pedido.
          </p>
        </div>
        <a class="button secondary" href="cliente.html">Entrar</a>
      </div>
    `;

  renderList();
}

init();
