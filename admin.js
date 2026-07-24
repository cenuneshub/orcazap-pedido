const accountArea = document.getElementById('accountArea');
const content = document.getElementById('content');
const statusEl = document.getElementById('status');

let session = null;
let user = null;
let dashboard = null;
let reports = [];
let tickets = [];
let professionals = [];
let productConfig = null;
let privacyRequests = [];
let diagnostics = [];
let activeTab = 'dashboard';

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
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR');
}

async function requestAccess() {
  const email = document.getElementById('adminEmail')?.value.trim() || '';

  if (!email) {
    setStatus('Informe o e-mail da conta administradora.', 'error');
    return;
  }

  try {
    setStatus('Enviando link seguro...');
    await OrcaClientAuth.sendMagicLink(email, 'admin.html');
    setStatus(
      'Link enviado. Abra o e-mail neste navegador.',
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
  accountArea.innerHTML = `
    <h2>Acesso restrito</h2>
    <p>
      Entre com a conta vinculada ao administrador do OrçaZap.
    </p>
    <label for="adminEmail">E-mail</label>
    <input id="adminEmail" type="email" autocomplete="email">
    <button onclick="requestAccess()">Enviar link de acesso</button>
  `;
  content.innerHTML = '';
}

function metric(label, value) {
  return `
    <div class="metric">
      <strong>${escapeHtml(value)}</strong>
      ${escapeHtml(label)}
    </div>
  `;
}

function renderNavigation() {
  return `
    <section class="card">
      <div class="inline-actions">
        <button
          class="${activeTab === 'dashboard' ? '' : 'secondary'}"
          onclick="setTab('dashboard')"
        >Visão geral</button>
        <button
          class="${activeTab === 'reports' ? '' : 'secondary'}"
          onclick="setTab('reports')"
        >Denúncias</button>
        <button
          class="${activeTab === 'support' ? '' : 'secondary'}"
          onclick="setTab('support')"
        >Suporte</button>
        <button
          class="${activeTab === 'professionals' ? '' : 'secondary'}"
          onclick="setTab('professionals')"
        >Profissionais</button>
        <button
          class="${activeTab === 'features' ? '' : 'secondary'}"
          onclick="setTab('features')"
        >Recursos</button>
        <button
          class="${activeTab === 'privacy' ? '' : 'secondary'}"
          onclick="setTab('privacy')"
        >Privacidade</button>
        <button
          class="${activeTab === 'diagnostics' ? '' : 'secondary'}"
          onclick="setTab('diagnostics')"
        >Diagnóstico</button>
      </div>
    </section>
  `;
}

function renderDashboard() {
  return `
    <section class="metrics">
      ${metric('denúncias abertas', Number(dashboard?.open_reports || 0))}
      ${metric('chamados abertos', Number(dashboard?.open_support_tickets || 0))}
      ${metric('privacidade pendente', Number(dashboard?.open_privacy_requests || 0))}
      ${metric('diagnósticos novos', Number(dashboard?.new_diagnostics || 0))}
      ${metric('profissionais ativos', Number(dashboard?.active_professionals || 0))}
      ${metric('profissionais suspensos', Number(dashboard?.suspended_professionals || 0))}
      ${metric('pedidos abertos', Number(dashboard?.open_marketplace_requests || 0))}
      ${metric('mensagens em 24 h', Number(dashboard?.messages_24h || 0))}
    </section>

    <section class="card">
      <h2>Release Candidate</h2>
      <p>
        Use este painel para reduzir riscos. Não leia conversas ou suspenda
        perfis sem denúncia, justificativa ou necessidade operacional.
      </p>
      <p class="small">
        Clientes novos em 30 dias:
        ${Number(dashboard?.new_clients_30d || 0)}
      </p>
    </section>
  `;
}

function reportStatusLabel(value) {
  return {
    open: 'Recebida',
    in_review: 'Em análise',
    resolved: 'Resolvida',
    dismissed: 'Encerrada'
  }[value] || value;
}

function categoryLabel(value) {
  return {
    spam: 'Spam',
    fraud: 'Possível fraude',
    harassment: 'Assédio ou ofensa',
    inappropriate_content: 'Conteúdo inadequado',
    contact_bypass: 'Tentativa de burlar contato',
    service_problem: 'Problema no atendimento',
    privacy: 'Privacidade',
    other: 'Outro'
  }[value] || value;
}

function renderReports() {
  if (!reports.length) {
    return '<section class="card"><p>Nenhuma denúncia encontrada.</p></section>';
  }

  return reports.map(report => `
    <article class="card">
      <div class="account-bar">
        <div>
          <span class="tag">${escapeHtml(report.priority)}</span>
          <h2>${escapeHtml(categoryLabel(report.category))}</h2>
          <p class="small">
            ${escapeHtml(report.reporter_role)} •
            ${escapeHtml(report.target_type)} •
            ${escapeHtml(report.target_id)} •
            ${escapeHtml(dateLabel(report.created_at))}
          </p>
        </div>
        <strong>${escapeHtml(reportStatusLabel(report.status))}</strong>
      </div>
      <p>${escapeHtml(report.details || 'Sem detalhes adicionais.')}</p>
      ${
        report.admin_notes
          ? `<div class="info">${escapeHtml(report.admin_notes)}</div>`
          : ''
      }
      <div class="inline-actions">
        <button
          class="secondary"
          onclick="updateReport('${escapeHtml(report.id)}','in_review')"
        >Em análise</button>
        <button
          onclick="updateReport('${escapeHtml(report.id)}','resolved')"
        >Resolver</button>
        <button
          class="secondary"
          onclick="updateReport('${escapeHtml(report.id)}','dismissed')"
        >Encerrar</button>
      </div>
    </article>
  `).join('');
}

function renderSupport() {
  if (!tickets.length) {
    return '<section class="card"><p>Nenhum chamado encontrado.</p></section>';
  }

  return tickets.map(ticket => `
    <article class="card">
      <div class="account-bar">
        <div>
          <span class="tag">${escapeHtml(ticket.requester_role)}</span>
          <h2>${escapeHtml(ticket.subject)}</h2>
          <p class="small">
            ${escapeHtml(ticket.category)} •
            ${escapeHtml(ticket.app_version || '')} •
            ${escapeHtml(dateLabel(ticket.created_at))}
          </p>
        </div>
        <strong>${escapeHtml(ticket.status)}</strong>
      </div>
      <p>${escapeHtml(ticket.message)}</p>
      ${
        ticket.admin_reply
          ? `<div class="info success-box">${escapeHtml(ticket.admin_reply)}</div>`
          : ''
      }
      <button onclick="answerTicket('${escapeHtml(ticket.id)}')">
        Responder chamado
      </button>
    </article>
  `).join('');
}

function renderProfessionals() {
  if (!professionals.length) {
    return '<section class="card"><p>Nenhum profissional encontrado.</p></section>';
  }

  return professionals.map(professional => `
    <article class="card">
      <div class="account-bar">
        <div>
          <span class="tag">${escapeHtml(professional.account_status)}</span>
          <h2>${escapeHtml(professional.display_name)}</h2>
          <p class="small">
            ${escapeHtml(
              [
                professional.profession,
                professional.city,
                professional.slug
              ].filter(Boolean).join(' • ')
            )}
          </p>
        </div>
        <strong>
          ${professional.user_linked ? 'Conta vinculada' : 'Sem conta'}
        </strong>
      </div>
      <p class="small">
        ★ ${Number(professional.rating_average || 0).toFixed(1)}
        • ${Number(professional.rating_count || 0)} avaliação(ões)
        • ${Number(professional.completed_services || 0)} serviço(s)
      </p>
      <div class="inline-actions">
        <button
          class="secondary"
          onclick="setProfessionalStatus(
            '${escapeHtml(professional.id)}',
            'active'
          )"
        >Ativar</button>
        <button
          class="secondary"
          onclick="setProfessionalStatus(
            '${escapeHtml(professional.id)}',
            'suspended'
          )"
        >Suspender</button>
        <button
          class="danger"
          onclick="setProfessionalStatus(
            '${escapeHtml(professional.id)}',
            'disabled'
          )"
        >Desativar</button>
      </div>
    </article>
  `).join('');
}

function featureLabel(key) {
  return {
    marketplace: 'Marketplace',
    client_account: 'Conta do cliente',
    protected_chat: 'Chat protegido',
    request_media: 'Fotos privadas',
    orca_coins: 'OrçaCoins',
    referrals: 'Rede de indicações',
    partner_stores: 'Lojas parceiras',
    cloud_backup: 'Backup na nuvem',
    public_profiles: 'Perfis públicos',
    moderation: 'Denúncias e moderação',
    support_tickets: 'Suporte interno',
    local_rankings: 'Ranking local',
    smart_triage: 'Triagem inteligente',
    growth_passport: 'Níveis, selos e missões',
    privacy_center: 'Privacidade e dados',
    diagnostics: 'Diagnóstico técnico'
  }[key] || key;
}

function renderFeatures() {
  const entries = Object.entries(productConfig?.features || {})
    .sort((a, b) => a[0].localeCompare(b[0]));

  return `
    <section class="card warning-box">
      <strong>Controle de emergência</strong>
      <p class="small">
        Pausar um recurso não apaga dados. Use somente quando houver falha,
        abuso ou manutenção.
      </p>
    </section>
    ${
      entries.length
        ? entries.map(([key, enabled]) => `
          <article class="card">
            <div class="account-bar">
              <div>
                <strong>${escapeHtml(featureLabel(key))}</strong>
                <p class="small">${escapeHtml(key)}</p>
              </div>
              <button
                class="${enabled ? 'secondary' : ''}"
                onclick="toggleFeature('${escapeHtml(key)}', ${enabled ? 'false' : 'true'})"
              >
                ${enabled ? 'Pausar' : 'Ativar'}
              </button>
            </div>
          </article>
        `).join('')
        : '<section class="card"><p>Nenhum recurso configurado.</p></section>'
    }
  `;
}


function privacyTypeLabel(value) {
  return {
    access: 'Acesso aos dados',
    export: 'Cópia dos dados online',
    correction: 'Correção de dados',
    deletion: 'Exclusão da conta',
    restriction: 'Restrição de tratamento',
    revocation: 'Revogação de consentimento'
  }[value] || value;
}

function renderPrivacy() {
  if (!privacyRequests.length) {
    return '<section class="card"><p>Nenhuma solicitação de privacidade.</p></section>';
  }

  return privacyRequests.map(request => `
    <article class="card">
      <span class="tag">${escapeHtml(request.status)}</span>
      <h2>${escapeHtml(privacyTypeLabel(request.request_type))}</h2>
      <p class="small">${escapeHtml(request.requester_role)} • ${escapeHtml(dateLabel(request.created_at))}</p>
      <p>${escapeHtml(request.notes || '')}</p>
      ${request.admin_notes ? `<div class="info">${escapeHtml(request.admin_notes)}</div>` : ''}
      <div class="inline-actions">
        <button class="secondary" onclick="updatePrivacy('${escapeHtml(request.id)}','in_review')">Em análise</button>
        <button class="secondary" onclick="updatePrivacy('${escapeHtml(request.id)}','waiting_user')">Pedir informação</button>
        <button onclick="updatePrivacy('${escapeHtml(request.id)}','completed')">Concluir</button>
        <button class="danger" onclick="updatePrivacy('${escapeHtml(request.id)}','rejected')">Não atender</button>
      </div>
    </article>
  `).join('');
}

function renderDiagnostics() {
  if (!diagnostics.length) {
    return '<section class="card"><p>Nenhum diagnóstico online recebido.</p></section>';
  }

  return diagnostics.map(item => `
    <article class="card">
      <span class="tag">${escapeHtml(item.status)}</span>
      <h2>${escapeHtml(item.event_type)}</h2>
      <p class="small">${escapeHtml(item.role)} • ${escapeHtml(item.app_version || '')} • ${escapeHtml(dateLabel(item.created_at))}</p>
      <pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(item.message || '')}</pre>
      <div class="inline-actions">
        <button class="secondary" onclick="updateDiagnostic('${escapeHtml(item.id)}','reviewed')">Revisado</button>
        <button onclick="updateDiagnostic('${escapeHtml(item.id)}','resolved')">Resolvido</button>
        <button class="secondary" onclick="updateDiagnostic('${escapeHtml(item.id)}','ignored')">Ignorar</button>
      </div>
    </article>
  `).join('');
}

async function updatePrivacy(id, newStatus) {
  const notes = prompt('Retorno para o usuário:', '') ?? null;
  if (notes === null) return;

  try {
    setStatus('Atualizando solicitação...');
    await OrcaClientAuth.rpc(
      'orcazap_admin_update_privacy_request',
      {
        p_request_id: id,
        p_status: newStatus,
        p_admin_notes: notes.trim()
      },
      { auth: true }
    );
    await loadData();
    setStatus('Solicitação atualizada.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function updateDiagnostic(id, newStatus) {
  try {
    setStatus('Atualizando diagnóstico...');
    await OrcaClientAuth.rpc(
      'orcazap_admin_update_diagnostic',
      {
        p_event_id: id,
        p_status: newStatus
      },
      { auth: true }
    );
    await loadData();
    setStatus('Diagnóstico atualizado.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function renderContent() {
  const body = {
    dashboard: renderDashboard,
    reports: renderReports,
    support: renderSupport,
    professionals: renderProfessionals,
    features: renderFeatures,
    privacy: renderPrivacy,
    diagnostics: renderDiagnostics
  }[activeTab]?.() || '';

  content.innerHTML = renderNavigation() + body;
}

function setTab(tab) {
  activeTab = tab;
  renderContent();
}

async function updateReport(id, newStatus) {
  const notes = prompt(
    'Registro interno da decisão. Evite incluir dados desnecessários.',
    ''
  );

  if (notes === null) return;

  try {
    setStatus('Atualizando denúncia...');
    await OrcaClientAuth.rpc(
      'orcazap_admin_resolve_report',
      {
        p_report_id: id,
        p_status: newStatus,
        p_admin_notes: notes,
        p_action_type: `report_${newStatus}`
      },
      { auth: true }
    );
    await loadData();
    setStatus('Denúncia atualizada.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function answerTicket(id) {
  const reply = prompt('Resposta para o usuário:', '');
  if (reply === null) return;

  const status = reply.trim() ? 'answered' : 'in_progress';

  try {
    setStatus('Atualizando chamado...');
    await OrcaClientAuth.rpc(
      'orcazap_admin_update_support_ticket',
      {
        p_ticket_id: id,
        p_status: status,
        p_admin_reply: reply.trim()
      },
      { auth: true }
    );
    await loadData();
    setStatus('Chamado atualizado.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function setProfessionalStatus(id, newStatus) {
  let reason = '';

  if (newStatus !== 'active') {
    reason = prompt('Motivo obrigatório da restrição:', '') || '';
    if (reason.trim().length < 4) return;
  }

  const until = null;

  if (
    !confirm(
      `Confirmar alteração do perfil para ${newStatus}? Suspensões exigem reativação manual.`
    )
  ) {
    return;
  }

  try {
    setStatus('Atualizando profissional...');
    await OrcaClientAuth.rpc(
      'orcazap_admin_set_professional_status',
      {
        p_professional_id: id,
        p_status: newStatus,
        p_reason: reason,
        p_suspended_until: until
      },
      { auth: true }
    );
    await loadData();
    setStatus('Status profissional atualizado.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function toggleFeature(key, enabled) {
  if (
    !confirm(
      `${enabled ? 'Ativar' : 'Pausar'} o recurso ${featureLabel(key)}?`
    )
  ) {
    return;
  }

  try {
    setStatus('Atualizando recurso...');
    await OrcaClientAuth.rpc(
      'orcazap_admin_set_feature_flag',
      {
        p_feature_key: key,
        p_enabled: enabled
      },
      { auth: true }
    );
    await loadData();
    setStatus('Recurso atualizado.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function loadData() {
  setStatus('Atualizando painel...');

  try {
    const results = await Promise.all([
      OrcaClientAuth.rpc(
        'orcazap_admin_get_dashboard',
        {},
        { auth: true }
      ),
      OrcaClientAuth.rpc(
        'orcazap_admin_list_reports',
        { p_status: '', p_limit: 200 },
        { auth: true }
      ),
      OrcaClientAuth.rpc(
        'orcazap_admin_list_support_tickets',
        { p_status: '', p_limit: 200 },
        { auth: true }
      ),
      OrcaClientAuth.rpc(
        'orcazap_admin_list_professionals',
        { p_status: '', p_search: '', p_limit: 200 },
        { auth: true }
      ),
      OrcaClientAuth.rpc(
        'orcazap_get_public_product_config',
        {}
      ),
      OrcaClientAuth.rpc(
        'orcazap_admin_list_privacy_requests',
        { p_status: '', p_limit: 200 },
        { auth: true }
      ),
      OrcaClientAuth.rpc(
        'orcazap_admin_list_diagnostics',
        { p_status: '', p_limit: 200 },
        { auth: true }
      )
    ]);

    dashboard = results[0] || {};
    reports = Array.isArray(results[1]) ? results[1] : [];
    tickets = Array.isArray(results[2]) ? results[2] : [];
    professionals = Array.isArray(results[3]) ? results[3] : [];
    productConfig = results[4] || {};
    privacyRequests = Array.isArray(results[5]) ? results[5] : [];
    diagnostics = Array.isArray(results[6]) ? results[6] : [];

    renderContent();
    setStatus('');
  } catch (error) {
    content.innerHTML = `
      <section class="card error-box">
        <h2>Acesso não autorizado</h2>
        <p>${escapeHtml(error.message)}</p>
      </section>
    `;
    setStatus(
      'Esta conta não possui permissão administrativa.',
      'error'
    );
  }
}

async function init() {
  session = await OrcaClientAuth.init();

  const next = OrcaClientAuth.consumeNextPath();
  if (next && session && next !== 'admin.html') {
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

  accountArea.innerHTML = `
    <div class="account-bar">
      <div>
        <strong>Administrador autenticado</strong>
        <p class="small">${escapeHtml(user.email || '')}</p>
      </div>
      <button class="secondary" onclick="signOut()">Sair</button>
    </div>
  `;

  await loadData();
}

init();
