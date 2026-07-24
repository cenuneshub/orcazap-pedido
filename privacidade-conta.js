const accountArea = document.getElementById('accountArea');
const content = document.getElementById('content');
const statusEl = document.getElementById('status');

let session = null;
let user = null;
let requests = [];

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

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

function typeLabel(value) {
  return {
    access: 'Acesso aos dados',
    export: 'Cópia dos dados online',
    correction: 'Correção de dados',
    deletion: 'Exclusão da conta online',
    restriction: 'Restrição de tratamento',
    revocation: 'Revogação de consentimento'
  }[value] || value;
}

function statusLabel(value) {
  return {
    open: 'Recebida',
    in_review: 'Em análise',
    waiting_user: 'Aguardando informação',
    completed: 'Concluída',
    rejected: 'Não atendida',
    cancelled: 'Cancelada'
  }[value] || value;
}

async function requestAccess() {
  const email = document.getElementById('privacyEmail')?.value.trim() || '';

  if (!email) {
    setStatus('Informe seu e-mail.', 'error');
    return;
  }

  try {
    setStatus('Enviando link seguro...');
    await OrcaClientAuth.sendMagicLink(email, 'privacidade-conta.html');
    setStatus('Link enviado. Abra o e-mail neste navegador.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function submitRequest(type) {
  const notes = prompt(
    'Descreva sua solicitação. Não envie senha ou documentos completos.',
    ''
  );

  if (notes === null) return;

  try {
    setStatus('Enviando solicitação...');
    await OrcaClientAuth.rpc(
      'orcazap_submit_client_privacy_request',
      {
        p_request_type: type,
        p_notes: notes.trim()
      },
      { auth: true }
    );
    await loadRequests();
    renderLoggedIn();
    setStatus('Solicitação recebida.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function cancelRequest(id) {
  if (!confirm('Cancelar esta solicitação?')) return;

  try {
    setStatus('Cancelando...');
    await OrcaClientAuth.rpc(
      'orcazap_cancel_client_privacy_request',
      { p_request_id: id },
      { auth: true }
    );
    await loadRequests();
    renderLoggedIn();
    setStatus('Solicitação cancelada.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function loadRequests() {
  try {
    const loaded = await OrcaClientAuth.rpc(
      'orcazap_list_client_privacy_requests',
      {},
      { auth: true }
    );
    requests = Array.isArray(loaded) ? loaded : [];
  } catch (_) {
    requests = [];
  }
}

function renderLoggedOut() {
  accountArea.innerHTML = `
    <strong>Entre para controlar seus dados online</strong>
    <p class="small">O acesso usa link seguro por e-mail.</p>
    <label for="privacyEmail">E-mail</label>
    <input id="privacyEmail" type="email" autocomplete="email">
    <button onclick="requestAccess()">Enviar link de acesso</button>
  `;
  content.innerHTML = '';
}

function requestCard(request) {
  const cancellable = ['open', 'waiting_user'].includes(request.status);

  return `
    <article class="card">
      <span class="tag">${escapeHtml(statusLabel(request.status))}</span>
      <h3>${escapeHtml(typeLabel(request.request_type))}</h3>
      <p>${escapeHtml(request.notes || '')}</p>
      <p class="small">${escapeHtml(dateLabel(request.created_at))}</p>
      ${
        request.admin_notes
          ? `<div class="info success-box"><strong>Retorno</strong><p>${escapeHtml(request.admin_notes)}</p></div>`
          : ''
      }
      ${
        cancellable
          ? `<button class="secondary" onclick="cancelRequest('${escapeHtml(request.id)}')">Cancelar solicitação</button>`
          : ''
      }
    </article>
  `;
}

function renderLoggedIn() {
  accountArea.innerHTML = `
    <div class="account-bar">
      <div>
        <strong>Conta conectada</strong>
        <p class="small">${escapeHtml(user?.email || '')}</p>
      </div>
      <a class="button secondary" href="cliente.html">Minha conta</a>
    </div>
  `;

  content.innerHTML = `
    <section class="card">
      <h2>Solicitar ação</h2>
      <button onclick="submitRequest('export')">Solicitar cópia dos dados online</button>
      <button class="secondary" onclick="submitRequest('correction')">Solicitar correção</button>
      <button class="secondary" onclick="submitRequest('restriction')">Restringir uso dos dados</button>
      <button class="danger" onclick="submitRequest('deletion')">Solicitar exclusão da conta online</button>
      <p class="small">
        A exclusão não é instantânea: passa por revisão para preservar segurança,
        prevenção a fraude e obrigações aplicáveis.
      </p>
    </section>

    <section>
      <h2>Minhas solicitações</h2>
      ${
        requests.length
          ? requests.map(requestCard).join('')
          : '<div class="card">Nenhuma solicitação registrada.</div>'
      }
    </section>
  `;
}

async function init() {
  session = await OrcaClientAuth.init();

  const next = OrcaClientAuth.consumeNextPath();
  if (next && session && next !== 'privacidade-conta.html') {
    location.href = next;
    return;
  }

  user = session ? await OrcaClientAuth.getUser() : null;

  if (!user) {
    renderLoggedOut();
    return;
  }

  await loadRequests();
  renderLoggedIn();
}

init();
