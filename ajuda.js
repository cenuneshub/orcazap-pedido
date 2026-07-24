const accountArea = document.getElementById('accountArea');
const ticketArea = document.getElementById('ticketArea');
const statusEl = document.getElementById('status');

let session = null;
let user = null;
let tickets = [];

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

async function requestAccess() {
  const email = document.getElementById('supportEmail')?.value.trim() || '';

  if (!email) {
    setStatus('Informe seu e-mail.', 'error');
    return;
  }

  try {
    setStatus('Enviando link seguro...');
    await OrcaClientAuth.sendMagicLink(email, 'ajuda.html');
    setStatus(
      'Link enviado. Abra o e-mail neste navegador.',
      'success'
    );
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function sendTicket() {
  const category =
    document.getElementById('ticketCategory')?.value || 'other';
  const subject =
    document.getElementById('ticketSubject')?.value.trim() || '';
  const message =
    document.getElementById('ticketMessage')?.value.trim() || '';

  if (subject.length < 4 || message.length < 10) {
    setStatus('Preencha o assunto e descreva melhor o problema.', 'error');
    return;
  }

  try {
    setStatus('Enviando chamado...');

    await OrcaClientAuth.rpc(
      'orcazap_submit_client_support_ticket',
      {
        p_category: category,
        p_subject: subject,
        p_message: message,
        p_diagnostics: {
          portal: 'cliente-v15',
          path: location.pathname
        }
      },
      { auth: true }
    );

    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketMessage').value = '';
    await loadTickets();
    renderLoggedIn();
    setStatus('Chamado enviado.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function renderLoggedOut() {
  accountArea.innerHTML = `
    <strong>Entre para enviar um chamado</strong>
    <p class="small">
      O acesso usa um link seguro no e-mail, sem senha.
    </p>
    <label for="supportEmail">E-mail</label>
    <input id="supportEmail" type="email" autocomplete="email">
    <button onclick="requestAccess()">Enviar link de acesso</button>
  `;
  ticketArea.innerHTML = '';
}

function ticketStatusLabel(value) {
  return {
    open: 'Recebido',
    in_progress: 'Em atendimento',
    answered: 'Respondido',
    closed: 'Encerrado'
  }[value] || value;
}

async function loadTickets() {
  try {
    const loaded = await OrcaClientAuth.rpc(
      'orcazap_list_client_support_tickets',
      {},
      { auth: true }
    );
    tickets = Array.isArray(loaded) ? loaded : [];
  } catch (_) {
    tickets = [];
  }
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

  ticketArea.innerHTML = `
    <section class="card">
      <h2>Enviar chamado</h2>

      <label for="ticketCategory">Categoria</label>
      <select id="ticketCategory">
        <option value="technical">Erro técnico</option>
        <option value="account">Conta e acesso</option>
        <option value="marketplace">Marketplace</option>
        <option value="privacy">Privacidade</option>
        <option value="suggestion">Sugestão</option>
        <option value="other">Outro</option>
      </select>

      <label for="ticketSubject">Assunto</label>
      <input id="ticketSubject" maxlength="140">

      <label for="ticketMessage">Descrição</label>
      <textarea id="ticketMessage" maxlength="3000"></textarea>

      <button onclick="sendTicket()">Enviar chamado</button>
      <p class="small">
        Não envie senha, documentos pessoais completos ou dados bancários.
      </p>
    </section>

    <section>
      <h2>Meus chamados</h2>
      ${
        tickets.length
          ? tickets.map(ticket => `
              <article class="card">
                <span class="tag">
                  ${escapeHtml(ticketStatusLabel(ticket.status))}
                </span>
                <h3>${escapeHtml(ticket.subject)}</h3>
                <p>${escapeHtml(ticket.message)}</p>
                ${
                  ticket.admin_reply
                    ? `
                      <div class="info success-box">
                        <strong>Resposta do suporte</strong>
                        <p>${escapeHtml(ticket.admin_reply)}</p>
                      </div>
                    `
                    : ''
                }
              </article>
            `).join('')
          : '<div class="card">Nenhum chamado enviado.</div>'
      }
    </section>
  `;
}

async function init() {
  session = await OrcaClientAuth.init();

  const next = OrcaClientAuth.consumeNextPath();
  if (next && session && next !== 'ajuda.html') {
    location.href = next;
    return;
  }

  user = session ? await OrcaClientAuth.getUser() : null;

  if (!user) {
    renderLoggedOut();
    return;
  }

  await loadTickets();
  renderLoggedIn();
}

init();
