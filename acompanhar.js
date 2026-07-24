const token = new URLSearchParams(location.search).get('t') || '';

const accountArea = document.getElementById('accountArea');
const requestArea = document.getElementById('requestArea');
const mediaArea = document.getElementById('mediaArea');
const proposalsArea = document.getElementById('proposalsArea');
const chatArea = document.getElementById('chatArea');
const reviewArea = document.getElementById('reviewArea');
const statusEl = document.getElementById('status');

let session = null;
let user = null;
let currentData = null;
let selectedRating = 0;
let activeChat = null;
let chatTimer = null;
let photoObjectUrls = [];

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

function storeRecent() {
  if (!token) return;

  const recent = JSON.parse(
    localStorage.getItem('orcazap_recent_requests_v1') || '[]'
  );

  if (!recent.some(item => item && item.token === token)) {
    recent.unshift({
      token,
      profession: 'Pedido OrçaZap',
      city: '',
      serviceText: '',
      createdAt: new Date().toISOString()
    });

    localStorage.setItem(
      'orcazap_recent_requests_v1',
      JSON.stringify(recent.slice(0, 20))
    );
  }
}

async function requestAccess() {
  const email = prompt(
    'Digite seu e-mail para proteger este pedido e conversar pelo chat.'
  );

  if (!email) return;

  setStatus('Enviando link seguro...');

  try {
    await OrcaClientAuth.sendMagicLink(
      email,
      `${location.pathname}${location.search}`
    );

    setStatus(
      'Link enviado. Abra o e-mail neste navegador para voltar ao pedido.',
      'success'
    );
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function claimRequest() {
  if (!session || !token) return false;

  try {
    await OrcaClientAuth.rpc(
      'orcazap_claim_client_request',
      { p_access_token: token },
      { auth: true }
    );
    return true;
  } catch (error) {
    if (
      !String(error.message || '').includes('já pertence a outra conta')
    ) {
      setStatus(error.message, 'error');
    }
    return false;
  }
}

function renderAccount(request) {
  if (!session || !user) {
    accountArea.innerHTML = `
      <div class="account-bar">
        <div>
          <strong>Proteja este pedido</strong>
          <p class="small">
            Entre por e-mail para enviar fotos, conversar com profissionais,
            acessar em outro aparelho e ganhar OrçaCoins.
          </p>
        </div>
        <button class="secondary" onclick="requestAccess()">
          Entrar por e-mail
        </button>
      </div>
    `;
    return;
  }

  const owned = request?.owned_by_current_user === true;

  accountArea.innerHTML = `
    <div class="account-bar">
      <div>
        <strong>
          ${owned ? 'Pedido protegido na sua conta' : 'Conta conectada'}
        </strong>
        <p class="small">${escapeHtml(user.email || '')}</p>
      </div>
      <a class="button secondary" href="cliente.html">Minha conta</a>
    </div>
    ${
      !owned
        ? `
          <button onclick="protectCurrentRequest()">
            Vincular este pedido à minha conta
          </button>
        `
        : ''
    }
  `;
}

async function protectCurrentRequest() {
  if (!session) {
    await requestAccess();
    return;
  }

  setStatus('Protegendo pedido...');

  const claimed = await claimRequest();

  if (claimed) {
    setStatus('Pedido vinculado à sua conta.', 'success');
    await loadEverything();
  }
}

function serviceLabel(value) {
  const labels = {
    pending: 'Aguardando escolha',
    in_progress: 'Serviço em andamento',
    completed: 'Serviço concluído — avalie o profissional',
    reviewed: 'Serviço concluído e avaliado',
    cancelled: 'Cancelado'
  };
  return labels[value] || value || 'Pedido';
}

function renderRequest(request) {
  requestArea.innerHTML = `
    <span class="tag">${escapeHtml(serviceLabel(request.service_status))}</span>
    <h2>${escapeHtml(request.profession || 'Serviço')}</h2>
    <p>${escapeHtml(request.service_text || '')}</p>
    <p class="small">
      ${escapeHtml(
        [request.city, request.desired_date]
          .filter(Boolean)
          .join(' • ')
      )}
    </p>
    ${
      request.has_account
        ? '<p class="small">🔒 Pedido vinculado a uma conta do cliente.</p>'
        : '<p class="small">Este pedido ainda pode ser protegido por e-mail.</p>'
    }
  `;
}

function releaseObjectUrls() {
  photoObjectUrls.forEach(url => URL.revokeObjectURL(url));
  photoObjectUrls = [];
}

async function renderMedia(request) {
  releaseObjectUrls();
  mediaArea.innerHTML = '';

  const owned = request?.owned_by_current_user === true;

  if (!owned) {
    if (session) {
      mediaArea.innerHTML = `
        <section class="card info">
          <strong>Fotos privadas</strong>
          <p class="small">
            Vincule este pedido à sua conta para adicionar e visualizar imagens.
          </p>
        </section>
      `;
    }
    return;
  }

  let media = [];

  try {
    media = await OrcaClientAuth.rpc(
      'orcazap_list_request_media_client',
      { p_request_id: request.id },
      { auth: true }
    );
  } catch (error) {
    mediaArea.innerHTML = `
      <section class="card error-box">
        ${escapeHtml(error.message)}
      </section>
    `;
    return;
  }

  if (!Array.isArray(media)) media = [];

  const remaining = Math.max(0, 5 - media.length);

  mediaArea.innerHTML = `
    <section class="card">
      <h2>Fotos do serviço</h2>
      <p class="small">
        ${media.length} de 5 fotos. Imagens privadas, visíveis apenas
        aos profissionais que enviaram proposta.
      </p>
      <div id="privateGallery" class="gallery"></div>
      ${
        remaining > 0
          ? `
            <label for="morePhotos">Adicionar fotos</label>
            <input
              id="morePhotos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
            >
            <button onclick="uploadMorePhotos()">
              Enviar novas fotos
            </button>
          `
          : '<p class="small">Limite de 5 fotos atingido.</p>'
      }
    </section>
  `;

  const gallery = document.getElementById('privateGallery');

  for (const item of media) {
    try {
      const blob = await OrcaClientAuth.downloadMedia(item.storage_path);
      const url = URL.createObjectURL(blob);
      photoObjectUrls.push(url);

      const figure = document.createElement('figure');
      figure.innerHTML = `
        <a href="${url}" target="_blank" rel="noopener">
          <img src="${url}" alt="Foto do serviço">
        </a>
        <figcaption>
          ${escapeHtml(item.caption || '')}
          ${item.size_bytes ? ` • ${(Number(item.size_bytes) / 1024 / 1024).toFixed(1)} MB` : ''}
        </figcaption>
      `;
      gallery.appendChild(figure);
    } catch (_) {
      const figure = document.createElement('figure');
      figure.innerHTML = '<figcaption>Foto indisponível.</figcaption>';
      gallery.appendChild(figure);
    }
  }
}

function validatePhotos(files, remaining) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  const chosen = Array.from(files || []).slice(0, remaining);

  for (const file of chosen) {
    if (!allowed.includes(file.type)) {
      throw new Error('Use somente JPG, PNG ou WEBP.');
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      throw new Error('Cada foto pode ter no máximo 5 MB.');
    }
  }

  return chosen;
}

function extensionFor(file) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function randomId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function uploadMorePhotos() {
  const request = currentData?.request;
  const input = document.getElementById('morePhotos');

  if (!request?.owned_by_current_user || !input?.files?.length) {
    setStatus('Selecione pelo menos uma foto.', 'error');
    return;
  }

  try {
    const existing = await OrcaClientAuth.rpc(
      'orcazap_list_request_media_client',
      { p_request_id: request.id },
      { auth: true }
    );

    const remaining = Math.max(
      0,
      5 - (Array.isArray(existing) ? existing.length : 0)
    );
    const files = validatePhotos(input.files, remaining);

    if (!files.length) {
      throw new Error('O limite de fotos já foi atingido.');
    }

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setStatus(`Enviando foto ${index + 1} de ${files.length}...`);

      const path =
        `${user.id}/${request.id}/${randomId()}.${extensionFor(file)}`;

      await OrcaClientAuth.uploadMedia(path, file);

      await OrcaClientAuth.rpc(
        'orcazap_register_request_media',
        {
          p_request_id: request.id,
          p_storage_path: path,
          p_mime_type: file.type,
          p_size_bytes: file.size,
          p_caption: ''
        },
        { auth: true }
      );
    }

    setStatus('Fotos enviadas com segurança.', 'success');
    await loadEverything();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function acceptProposal(interestId) {
  if (
    !confirm(
      'Escolher este profissional? As outras propostas serão encerradas.'
    )
  ) {
    return;
  }

  setStatus('Confirmando escolha...');

  try {
    await OrcaClientAuth.rpc(
      'orcazap_accept_marketplace_proposal',
      {
        p_access_token: token,
        p_interest_id: interestId
      }
    );

    setStatus('Profissional escolhido.', 'success');
    await loadEverything();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function proposalCard(proposal, request) {
  const accepted = proposal.status === 'accepted';
  const declined = proposal.status === 'declined';
  const ratingCount = Number(proposal.rating_count || 0);
  const rating = Number(proposal.rating_average || 0);
  const unread = Number(proposal.unread_messages || 0);
  const blocked = proposal.conversation_blocked === true;
  const qualityScore = Number(proposal.quality_score || 0);
  const completedServices = Number(proposal.completed_services || 0);
  const canChat =
    request.owned_by_current_user === true &&
    proposal.professional_id;

  const contact =
    accepted && proposal.professional_phone
      ? `<p><strong>Contato liberado:</strong> ${escapeHtml(proposal.professional_phone)}</p>`
      : '';

  const profile = proposal.professional_slug
    ? `
      <p>
        <a
          href="perfil.html?p=${encodeURIComponent(proposal.professional_slug)}"
          target="_blank"
          rel="noopener"
        >
          Ver perfil profissional
        </a>
      </p>
    `
    : '';

  return `
    <article class="proposal ${accepted ? 'accepted' : ''}">
      <span class="tag">
        ${accepted ? 'Escolhido' : declined ? 'Encerrado' : 'Proposta recebida'}
      </span>
      <h2>${escapeHtml(proposal.professional_name)}</h2>
      <p class="small">
        ${escapeHtml(
          [proposal.profession, proposal.city]
            .filter(Boolean)
            .join(' • ')
        )}
      </p>
      <p class="rating">
        ${
          ratingCount
            ? `★ ${rating.toFixed(1)} • ${ratingCount} avaliação(ões)`
            : 'Profissional ainda sem avaliações verificadas'
        }
      </p>
      <div class="info ${
        proposal.verified_profile ? 'success-box' : ''
      }">
        <strong>${escapeHtml(
          proposal.trust_label || 'Perfil em construção'
        )}</strong>
        <p class="small">
          Índice de confiança: ${qualityScore}/100
          • ${completedServices} serviço(s) concluído(s)
          ${
            proposal.verified_profile
              ? ' • conta profissional protegida'
              : ''
          }
        </p>
      </div>
      <p>${escapeHtml(proposal.message || 'Profissional interessado no serviço.')}</p>
      ${
        proposal.estimated_price
          ? `<p><strong>Estimativa:</strong> ${escapeHtml(proposal.estimated_price)}</p>`
          : ''
      }
      ${
        proposal.availability
          ? `<p><strong>Disponibilidade:</strong> ${escapeHtml(proposal.availability)}</p>`
          : ''
      }
      ${profile}
      ${contact}
      ${
        canChat
          ? `
            <button
              class="secondary"
              onclick="openChat(
                '${escapeHtml(request.id)}',
                '${escapeHtml(proposal.professional_id)}',
                '${escapeHtml(proposal.status)}',
                ${blocked ? 'true' : 'false'}
              )"
            >
              ${
                blocked
                  ? 'Conversa bloqueada'
                  : `Conversar${unread ? ` • ${unread} nova(s)` : ''}`
              }
            </button>
            <div class="inline-actions">
              <button
                class="secondary"
                onclick="toggleClientBlock(
                  '${escapeHtml(request.id)}',
                  '${escapeHtml(proposal.professional_id)}',
                  ${blocked ? 'false' : 'true'}
                )"
              >
                ${blocked ? 'Desbloquear' : 'Bloquear'}
              </button>
              <button
                class="secondary"
                onclick="reportClientConversation(
                  '${escapeHtml(request.id)}',
                  '${escapeHtml(proposal.professional_id)}'
                )"
              >
                Denunciar
              </button>
            </div>
          `
          : `
            <button class="secondary" onclick="requestAccess()">
              Entrar para conversar
            </button>
          `
      }
      ${
        !accepted && !declined && !request.selected_interest_id
          ? `
            <button onclick="acceptProposal('${escapeHtml(proposal.interest_id)}')">
              Escolher este profissional
            </button>
          `
          : ''
      }
    </article>
  `;
}

function renderProposals(data) {
  const proposals = Array.isArray(data.proposals) ? data.proposals : [];
  const request = data.request || {};

  if (!proposals.length) {
    proposalsArea.innerHTML = `
      <div class="card">
        <h2>Aguardando profissionais</h2>
        <p>Volte a esta página para acompanhar as propostas.</p>
      </div>
    `;
    return;
  }

  proposalsArea.innerHTML = proposals
    .map(proposal => proposalCard(proposal, request))
    .join('');
}


async function toggleClientBlock(requestId, professionalId, blocked) {
  if (!session) {
    await requestAccess();
    return;
  }

  let reason = '';

  if (blocked) {
    reason = prompt(
      'Motivo opcional do bloqueio. A outra pessoa não verá este texto.',
      ''
    );

    if (reason === null) return;
  }

  try {
    setStatus(
      blocked ? 'Bloqueando conversa...' : 'Desbloqueando conversa...'
    );

    await OrcaClientAuth.rpc(
      'orcazap_set_client_conversation_block',
      {
        p_request_id: requestId,
        p_professional_id: professionalId,
        p_blocked: blocked,
        p_reason: reason || ''
      },
      { auth: true }
    );

    closeChat();
    await loadEverything();

    setStatus(
      blocked ? 'Conversa bloqueada.' : 'Conversa desbloqueada.',
      'success'
    );
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function reportClientConversation(requestId, professionalId) {
  if (!session) {
    await requestAccess();
    return;
  }

  const category = prompt(
    'Motivo: spam, fraud, harassment, inappropriate_content, contact_bypass, service_problem, privacy ou other',
    'service_problem'
  );

  if (!category) return;

  const allowed = [
    'spam',
    'fraud',
    'harassment',
    'inappropriate_content',
    'contact_bypass',
    'service_problem',
    'privacy',
    'other'
  ];

  if (!allowed.includes(category.trim())) {
    setStatus('Motivo de denúncia inválido.', 'error');
    return;
  }

  const details = prompt(
    'Explique de forma objetiva o que aconteceu:',
    ''
  );

  if (details === null) return;

  try {
    setStatus('Enviando denúncia...');

    await OrcaClientAuth.rpc(
      'orcazap_submit_client_report',
      {
        p_target_type: 'conversation',
        p_target_id: `${requestId}:${professionalId}`,
        p_category: category.trim(),
        p_details: details.trim()
      },
      { auth: true }
    );

    setStatus('Denúncia recebida para análise.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function openChat(requestId, professionalId, status, blocked) {
  if (!session || !currentData?.request?.owned_by_current_user) {
    await requestAccess();
    return;
  }

  const proposal = (currentData?.proposals || []).find(
    item => item.professional_id === professionalId
  );
  const professionalName =
    proposal?.professional_name || 'profissional';

  activeChat = {
    requestId,
    professionalId,
    professionalName,
    status,
    blocked: blocked === true
  };

  if (chatTimer) clearInterval(chatTimer);
  chatTimer = setInterval(() => {
    if (activeChat) loadChatMessages();
  }, 15000);

  chatArea.innerHTML = `
    <section class="chat-panel">
      <div class="account-bar">
        <div>
          <strong>Conversa com ${escapeHtml(professionalName)}</strong>
          <p class="small">
            ${
              blocked
                ? 'Esta conversa está bloqueada. Desbloqueie para voltar a enviar mensagens.'
                : status === 'accepted'
                    ? 'Profissional escolhido. O contato já pode ser compartilhado.'
                    : 'Antes da escolha, telefone, e-mail e links ficam bloqueados.'
            }
          </p>
        </div>
        <button class="secondary" onclick="closeChat()">Fechar</button>
      </div>
      <div id="messages" class="messages">Carregando...</div>
      <textarea
        id="chatMessage"
        maxlength="1500"
        placeholder="${blocked ? 'Conversa bloqueada' : 'Escreva sua mensagem'}"
        ${blocked ? 'disabled' : ''}
      ></textarea>
      <button
        onclick="sendChatMessage()"
        ${blocked ? 'disabled' : ''}
      >Enviar mensagem</button>
      <div class="inline-actions">
        <button
          class="secondary"
          onclick="toggleClientBlock(
            '${escapeHtml(requestId)}',
            '${escapeHtml(professionalId)}',
            ${blocked ? 'false' : 'true'}
          )"
        >
          ${blocked ? 'Desbloquear conversa' : 'Bloquear conversa'}
        </button>
        <button
          class="secondary"
          onclick="reportClientConversation(
            '${escapeHtml(requestId)}',
            '${escapeHtml(professionalId)}'
          )"
        >Denunciar</button>
      </div>
    </section>
  `;

  await loadChatMessages();
}

function closeChat() {
  activeChat = null;

  if (chatTimer) {
    clearInterval(chatTimer);
    chatTimer = null;
  }

  chatArea.innerHTML = '';
}

async function loadChatMessages() {
  if (!activeChat) return;

  const messagesEl = document.getElementById('messages');

  try {
    const messages = await OrcaClientAuth.rpc(
      'orcazap_list_client_messages',
      {
        p_request_id: activeChat.requestId,
        p_professional_id: activeChat.professionalId
      },
      { auth: true }
    );

    await OrcaClientAuth.rpc(
      'orcazap_mark_client_messages_read',
      {
        p_request_id: activeChat.requestId,
        p_professional_id: activeChat.professionalId
      },
      { auth: true }
    );

    const list = Array.isArray(messages) ? messages : [];

    messagesEl.innerHTML = list.length
      ? list.map(message => `
          <div class="message ${message.sender_role === 'client' ? 'client' : 'professional'}">
            ${escapeHtml(message.body)}
            <time>${escapeHtml(dateLabel(message.created_at))}</time>
          </div>
        `).join('')
      : '<p class="small">Conversa ainda não iniciada.</p>';

    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (error) {
    messagesEl.innerHTML = `
      <p class="small">${escapeHtml(error.message)}</p>
    `;
  }
}

async function sendChatMessage() {
  if (!activeChat) return;

  if (activeChat.blocked) {
    setStatus(
      'Desbloqueie a conversa antes de enviar uma mensagem.',
      'error'
    );
    return;
  }

  const input = document.getElementById('chatMessage');
  const body = input?.value.trim() || '';

  if (!body) {
    setStatus('Escreva uma mensagem.', 'error');
    return;
  }

  setStatus('Enviando mensagem...');

  try {
    await OrcaClientAuth.rpc(
      'orcazap_send_client_message',
      {
        p_request_id: activeChat.requestId,
        p_professional_id: activeChat.professionalId,
        p_body: body
      },
      { auth: true }
    );

    input.value = '';
    setStatus('Mensagem enviada.', 'success');
    await loadChatMessages();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function setRating(value) {
  selectedRating = value;

  document.querySelectorAll('[data-star]').forEach(element => {
    element.textContent =
      Number(element.dataset.star) <= value ? '★' : '☆';
  });
}

async function sendReview() {
  const comment =
    document.getElementById('reviewComment')?.value.trim() || '';

  if (selectedRating < 1) {
    setStatus('Escolha uma nota de 1 a 5.', 'error');
    return;
  }

  setStatus('Enviando avaliação...');

  try {
    await OrcaClientAuth.rpc(
      'orcazap_submit_verified_review',
      {
        p_access_token: token,
        p_rating: selectedRating,
        p_comment: comment
      }
    );

    setStatus(
      session
        ? 'Avaliação enviada. Sua conta recebeu 1 OrçaCoin.'
        : 'Avaliação enviada com sucesso.',
      'success'
    );

    await loadEverything();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function renderReview(data) {
  const request = data.request || {};
  const review = data.review || null;

  if (review) {
    const rating = Number(review.rating || 0);

    reviewArea.innerHTML = `
      <div class="review-box">
        <h2>Sua avaliação</h2>
        <div class="stars">
          ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}
        </div>
        <p>${escapeHtml(review.comment || 'Avaliação enviada.')}</p>
      </div>
    `;
    return;
  }

  if (request.service_status === 'completed') {
    reviewArea.innerHTML = `
      <div class="review-box">
        <h2>Avalie o serviço</h2>
        <p>
          Sua avaliação será publicada como verificada.
          Com a conta vinculada, você ganha 1 OrçaCoin.
        </p>
        <div class="stars">
          ${[1, 2, 3, 4, 5].map(index => `
            <button
              data-star="${index}"
              onclick="setRating(${index})"
              style="
                display:inline;
                width:auto;
                min-height:auto;
                background:transparent;
                color:#0f766e;
                font-size:30px;
                padding:2px;
                margin:0
              "
            >☆</button>
          `).join('')}
        </div>
        <textarea
          id="reviewComment"
          maxlength="1000"
          placeholder="Conte como foi o atendimento (opcional)"
        ></textarea>
        <button onclick="sendReview()">Enviar avaliação</button>
      </div>
    `;
    return;
  }

  reviewArea.innerHTML = '';
}

async function loadEverything() {
  if (!token) {
    requestArea.textContent = 'Link incompleto.';
    return;
  }

  setStatus('');
  proposalsArea.innerHTML = '';
  reviewArea.innerHTML = '';

  try {
    let data = await OrcaClientAuth.rpc(
      'orcazap_get_client_marketplace_request',
      { p_access_token: token }
    );

    if (
      session &&
      data?.request &&
      data.request.owned_by_current_user !== true &&
      data.request.has_account !== true
    ) {
      const claimed = await claimRequest();

      if (claimed) {
        data = await OrcaClientAuth.rpc(
          'orcazap_get_client_marketplace_request',
          { p_access_token: token }
        );
      }
    }

    currentData = data;

    const request = data.request || {};
    renderAccount(request);
    renderRequest(request);
    await renderMedia(request);
    renderProposals(data);
    renderReview(data);

    if (activeChat) {
      await loadChatMessages();
    }
  } catch (error) {
    requestArea.textContent = 'Não foi possível abrir o pedido.';
    setStatus(error.message, 'error');
  }
}

async function init() {
  storeRecent();
  session = await OrcaClientAuth.init();

  const next = OrcaClientAuth.consumeNextPath();
  if (
    next &&
    session &&
    next !== `${location.pathname}${location.search}`
  ) {
    location.href = next;
    return;
  }

  user = session ? await OrcaClientAuth.getUser() : null;
  await loadEverything();
}

window.addEventListener('beforeunload', () => {
  releaseObjectUrls();
  if (chatTimer) clearInterval(chatTimer);
});
init();
