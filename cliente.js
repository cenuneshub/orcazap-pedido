const content = document.getElementById('content');
const statusEl = document.getElementById('status');

let session = null;
let user = null;
let summary = null;
let requests = [];
let productConfig = null;

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
  const date = new Date(value || Date.now());
  return date.toLocaleString('pt-BR');
}

function serviceLabel(value) {
  const labels = {
    pending: 'Aguardando escolha',
    in_progress: 'Serviço em andamento',
    completed: 'Aguardando avaliação',
    reviewed: 'Serviço avaliado',
    cancelled: 'Cancelado'
  };
  return labels[value] || value || 'Pedido';
}

async function requestAccess() {
  const emailInput = document.getElementById('loginEmail');
  const email = emailInput?.value.trim() || '';

  if (!email) {
    setStatus('Informe seu e-mail.', 'error');
    return;
  }

  setStatus('Enviando link seguro...');

  try {
    await OrcaClientAuth.sendMagicLink(email, 'cliente.html');
    setStatus(
      'Link enviado. Abra o e-mail e toque para entrar.',
      'success'
    );
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function signOut() {
  await OrcaClientAuth.signOut();
  location.reload();
}

function renderLogin() {
  content.innerHTML = `
    <section class="card">
      <h2>Entrar sem senha</h2>
      <p>
        Digite seu e-mail. O OrçaZap enviará um link seguro para acesso.
      </p>
      <label for="loginEmail">E-mail</label>
      <input id="loginEmail" type="email" autocomplete="email">
      <button onclick="requestAccess()">Enviar link de acesso</button>
      <p class="small">
        A conta é gratuita nesta fase e não libera cobranças automáticas.
      </p>
    </section>
  `;
}

async function saveProfile() {
  const name = document.getElementById('profileName').value.trim();
  const phone = document.getElementById('profilePhone').value.trim();
  const city = document.getElementById('profileCity').value.trim();
  const terms = document.getElementById('profileTerms').checked;
  const marketing = document.getElementById('profileMarketing').checked;

  setStatus('Salvando perfil...');

  try {
    await OrcaClientAuth.rpc(
      'orcazap_upsert_client_profile',
      {
        p_display_name: name,
        p_phone: phone,
        p_city: city,
        p_accept_terms: terms,
        p_marketing_opt_in: marketing
      },
      { auth: true }
    );

    await OrcaClientAuth.rpc(
      'orcazap_record_consent',
      {
        p_role: 'client',
        p_consent_type: 'terms_and_privacy',
        p_document_version: '2026-07-24-v4',
        p_granted: terms,
        p_source: 'portal_cliente',
        p_metadata: { marketing_opt_in: marketing }
      },
      { auth: true }
    );

    setStatus('Perfil salvo com sucesso.', 'success');
    await loadAccount();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function claimDailyCoins() {
  setStatus('Coletando OrçaCoins...');

  try {
    const amount = Number(
      await OrcaClientAuth.rpc(
        'orcazap_client_daily_checkin',
        {},
        { auth: true }
      )
    );

    setStatus(
      amount > 0
        ? `Você ganhou ${amount} OrçaCoin.`
        : 'A recompensa de hoje já foi coletada.',
      'success'
    );

    await loadAccount();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function renderProfileForm() {
  return `
    <section class="card">
      <h2>Complete sua conta</h2>
      <p>
        Esses dados ajudam a preencher os próximos pedidos automaticamente.
      </p>

      <label for="profileName">Nome *</label>
      <input
        id="profileName"
        maxlength="120"
        value="${escapeHtml(summary?.display_name || '')}"
      >

      <label for="profilePhone">WhatsApp *</label>
      <input
        id="profilePhone"
        maxlength="30"
        inputmode="tel"
        value="${escapeHtml(summary?.phone || '')}"
      >

      <label for="profileCity">Cidade *</label>
      <input
        id="profileCity"
        maxlength="120"
        value="${escapeHtml(summary?.city || '')}"
      >

      <label class="check" style="margin-top:16px">
        <input id="profileTerms" type="checkbox" ${summary?.profile_complete ? 'checked' : ''}>
        <span class="small">
          Aceito os <a href="termos.html" target="_blank">termos de uso</a>
          e a <a href="privacidade.html" target="_blank">política de privacidade</a>
          do OrçaZap.
        </span>
      </label>

      <label class="check" style="margin-top:10px">
        <input id="profileMarketing" type="checkbox" ${summary?.marketing_opt_in ? 'checked' : ''}>
        <span class="small">
          Quero receber novidades importantes do produto. Opcional.
        </span>
      </label>

      <button onclick="saveProfile()">Salvar meu perfil</button>
    </section>
  `;
}

function requestCard(request) {
  const unread = Number(request.unread_messages || 0);
  const token = encodeURIComponent(request.access_token || '');

  return `
    <article class="card">
      <div class="account-bar">
        <div>
          <span class="tag">${escapeHtml(serviceLabel(request.service_status))}</span>
          <h2>${escapeHtml(request.profession || 'Serviço')}</h2>
          <p>${escapeHtml(request.service_text || '')}</p>
          <p class="small">
            ${escapeHtml(
              [
                request.city,
                `${Number(request.proposal_count || 0)} proposta(s)`,
                `${Number(request.media_count || 0)} foto(s)`,
                unread ? `${unread} mensagem(ns) nova(s)` : '',
                dateLabel(request.created_at)
              ].filter(Boolean).join(' • ')
            )}
          </p>
        </div>
      </div>
      <a class="button" href="acompanhar.html?t=${token}">
        Acompanhar pedido
      </a>
    </article>
  `;
}

function renderAccount() {
  const profileComplete = summary?.profile_complete === true;
  const coinToday = summary?.coin_today_claimed === true;

  content.innerHTML = `
    <section class="card">
      <div class="account-bar">
        <div>
          <strong>Conta conectada</strong>
          <p class="small">${escapeHtml(user?.email || '')}</p>
        </div>
        <button class="secondary" onclick="signOut()">Sair</button>
      </div>
    </section>

    <section class="metrics">
      <div class="metric">
        <strong>${Number(summary?.orders_count || 0)}</strong>
        pedidos
      </div>
      <div class="metric">
        <strong>${Number(summary?.unread_messages || 0)}</strong>
        mensagens
      </div>
      <div class="metric">
        <strong>${Number(summary?.coin_balance || 0)}</strong>
        OrçaCoins
      </div>
    </section>

    <section class="card">
      <h2>Recompensa diária</h2>
      <p>
        Sequência atual: ${Number(summary?.coin_streak_days || 0)} dia(s).
      </p>
      <button
        onclick="claimDailyCoins()"
        ${coinToday ? 'disabled' : ''}
      >
        ${coinToday ? 'Recompensa coletada hoje' : 'Coletar 1 OrçaCoin'}
      </button>
      <p class="small">
        OrçaCoins são pontos promocionais internos e não representam dinheiro
        ou promessa de saque.
      </p>
    </section>

    ${profileComplete ? `
      <section class="card success-box">
        <strong>Perfil do cliente completo</strong>
        <p class="small">
          ${escapeHtml(
            [
              summary.display_name,
              summary.phone,
              summary.city
            ].filter(Boolean).join(' • ')
          )}
        </p>
        <button class="secondary" onclick="editProfile()">Editar dados</button>
      </section>
    ` : renderProfileForm()}

    <section>
      <h2 style="margin-top:22px">Meus pedidos</h2>
      ${
        requests.length
          ? requests.map(requestCard).join('')
          : `
            <div class="card">
              <p>Você ainda não possui pedidos vinculados a esta conta.</p>
              <a class="button" href="index.html">Publicar primeiro pedido</a>
            </div>
          `
      }
    </section>
  `;
}

function editProfile() {
  summary.profile_complete = false;
  renderAccount();
}

async function loadAccount() {
  setStatus('Atualizando conta...');

  try {
    summary = await OrcaClientAuth.rpc(
      'orcazap_get_client_account_summary',
      {},
      { auth: true }
    );

    requests = await OrcaClientAuth.rpc(
      'orcazap_list_client_requests',
      {},
      { auth: true }
    );

    if (!Array.isArray(requests)) requests = [];

    setStatus('');
    renderAccount();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function init() {
  session = await OrcaClientAuth.init();

  try {
    productConfig = await OrcaClientAuth.rpc(
      'orcazap_get_public_product_config',
      {}
    );
  } catch (_) {
    productConfig = null;
  }

  if (productConfig?.features?.client_account === false) {
    content.innerHTML = `
      <section class="card warning-box">
        <h2>Conta do cliente temporariamente pausada</h2>
        <p>
          Seus pedidos não foram apagados. Consulte a página de status
          e tente novamente mais tarde.
        </p>
        <a class="button" href="status.html">Ver status</a>
      </section>
    `;
    return;
  }

  const next = OrcaClientAuth.consumeNextPath();
  if (next && session && next !== 'cliente.html') {
    location.href = next;
    return;
  }

  if (!session) {
    renderLogin();
    return;
  }

  user = await OrcaClientAuth.getUser();

  if (!user) {
    renderLogin();
    return;
  }

  await loadAccount();
}

init();
