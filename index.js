const params = new URLSearchParams(location.search);
const slug = params.get('p') || '';
const partnerCode = params.get('loja') || '';
const referralCode = params.get('ref') || '';
const directMode = Boolean(slug);
const DRAFT_KEY = 'orcazap_order_draft_v8';

const form = document.getElementById('orderForm');
const statusEl = document.getElementById('status');
const button = document.getElementById('submitButton');
const profession = document.getElementById('profession');
const marketplaceChoice = document.getElementById('marketplaceChoice');
const accountArea = document.getElementById('accountArea');
const photosInput = document.getElementById('photos');
const photoList = document.getElementById('photoList');
const photoLoginButton = document.getElementById('photoLoginButton');
const serviceTextInput = document.getElementById('serviceText');
const triageButton = document.getElementById('triageButton');
const triageResult = document.getElementById('triageResult');

let professional = null;
let session = null;
let user = null;
let selectedFiles = [];
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


function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function renderSmartTriage({ apply = false } = {}) {
  if (!window.OrcaSmartTriage || !triageResult) return;

  const result = OrcaSmartTriage.analyze(serviceTextInput.value);

  if (apply) {
    const option = Array.from(profession.options).find(
      item => item.value === result.profession || item.text === result.profession
    );

    if (option && !profession.disabled) {
      profession.value = option.value;
      saveDraft();
    }
  }

  triageResult.classList.remove('hidden');
  triageResult.innerHTML = `
    <div class="info ${result.profession !== 'Outros' ? 'success-box' : 'warning-box'}">
      <strong>${escapeHtml(result.profession)}</strong>
      <p class="small">
        Confiança da sugestão: ${Number(result.confidence || 0)}%
      </p>
      <p>${escapeHtml(result.explanation)}</p>
      <strong>Perguntas importantes</strong>
      <ul>
        ${(result.questions || []).map(
          question => `<li>${escapeHtml(question)}</li>`
        ).join('')}
      </ul>
      ${
        !profession.disabled
          ? `<button type="button" class="secondary" onclick="applySmartTriage()">Usar esta categoria</button>`
          : ''
      }
      <p class="small">
        Sugestão local. Não substitui avaliação técnica ou confirmação do profissional.
      </p>
    </div>
  `;
}

function applySmartTriage() {
  renderSmartTriage({ apply: true });
  setStatus('Categoria sugerida aplicada. Confirme antes de publicar.', 'success');
}

function formData() {
  return {
    clientName: document.getElementById('clientName').value.trim(),
    clientPhone: document.getElementById('clientPhone').value.trim(),
    profession: profession.value.trim(),
    city: document.getElementById('city').value.trim(),
    address: document.getElementById('address').value.trim(),
    postalCode: document.getElementById('postalCode').value.trim(),
    serviceText: document.getElementById('serviceText').value.trim(),
    measurements: document.getElementById('measurements').value.trim(),
    desiredDate: document.getElementById('desiredDate').value.trim(),
    bestContactTime: document.getElementById('bestContactTime').value.trim(),
    notes: document.getElementById('notes').value.trim()
  };
}

function saveDraft() {
  const data = formData();
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    const mapping = {
      clientName: 'clientName',
      clientPhone: 'clientPhone',
      city: 'city',
      address: 'address',
      postalCode: 'postalCode',
      serviceText: 'serviceText',
      measurements: 'measurements',
      desiredDate: 'desiredDate',
      bestContactTime: 'bestContactTime',
      notes: 'notes'
    };

    Object.entries(mapping).forEach(([key, id]) => {
      const element = document.getElementById(id);
      if (element && !element.value && data[key]) {
        element.value = data[key];
      }
    });

    if (!directMode && data.profession) {
      profession.value = data.profession;
    }
  } catch (_) {}
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function renderPhotoList() {
  photoList.innerHTML = selectedFiles
    .map(file => `<li>${escapeHtml(file.name)} — ${(file.size / 1024 / 1024).toFixed(1)} MB</li>`)
    .join('');
}

function validateFiles(files) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  const chosen = Array.from(files || []).slice(0, 5);

  for (const file of chosen) {
    if (!allowed.includes(file.type)) {
      throw new Error('Use somente fotos JPG, PNG ou WEBP.');
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

async function requestMagicLink() {
  const suggested = user?.email || '';
  const email = prompt(
    'Digite seu e-mail. Você receberá um link seguro para entrar.',
    suggested
  );

  if (!email) return;

  saveDraft();
  setStatus('Enviando link de acesso...');

  try {
    const nextPath = `${location.pathname}${location.search}`;
    await OrcaClientAuth.sendMagicLink(email, nextPath);
    setStatus(
      'Link enviado. Abra o e-mail neste navegador e volte ao formulário.',
      'success'
    );
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function renderAccount() {
  session = await OrcaClientAuth.getSession();
  user = session ? await OrcaClientAuth.getUser() : null;

  if (!session || !user) {
    accountArea.innerHTML = `
      <div class="account-bar">
        <div>
          <strong>Conta do cliente</strong>
          <p class="small">
            Entre por e-mail para enviar fotos, conversar pelo chat,
            proteger seus pedidos e ganhar OrçaCoins.
          </p>
        </div>
        <button type="button" class="secondary" onclick="requestMagicLink()">
          Entrar por e-mail
        </button>
      </div>
    `;
    photosInput.disabled = true;
    photoLoginButton.classList.remove('hidden');
    return;
  }

  photosInput.disabled = false;
  photoLoginButton.classList.add('hidden');

  accountArea.innerHTML = `
    <div class="account-bar">
      <div>
        <strong>Conta conectada</strong>
        <p class="small">${escapeHtml(user.email || '')}</p>
      </div>
      <a class="button secondary" href="cliente.html">Minha conta</a>
    </div>
  `;

  try {
    const summary = await OrcaClientAuth.rpc(
      'orcazap_get_client_account_summary',
      {},
      { auth: true }
    );

    if (summary?.profile_complete) {
      const fields = {
        clientName: summary.display_name,
        clientPhone: summary.phone,
        city: summary.city
      };

      Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element && !element.value && value) {
          element.value = value;
        }
      });
    }
  } catch (_) {}
}

async function preparePage() {
  session = await OrcaClientAuth.init();

  try {
    productConfig = await OrcaClientAuth.rpc(
      'orcazap_get_public_product_config',
      {}
    );
  } catch (_) {
    productConfig = null;
  }

  const next = OrcaClientAuth.consumeNextPath();
  if (
    next &&
    session &&
    next !== `${location.pathname}${location.search}`
  ) {
    location.href = next;
    return;
  }

  restoreDraft();
  await renderAccount();

  if (productConfig?.maintenance) {
    setStatus(
      productConfig.message ||
      'Os recursos online estão em manutenção.',
      'error'
    );
  }

  if (productConfig?.features?.client_account === false) {
    accountArea.innerHTML = `
      <strong>Conta do cliente temporariamente pausada</strong>
      <p class="small">
        O pedido simples ainda pode funcionar sem conta e sem fotos.
      </p>
    `;
    photosInput.disabled = true;
    photoLoginButton.classList.add('hidden');
  }

  if (productConfig?.features?.request_media === false) {
    document.getElementById('photoArea').classList.add('hidden');
    selectedFiles = [];
  }

  if (productConfig?.features?.smart_triage === false) {
    document.getElementById('smartTriageArea')?.classList.add('hidden');
  }

  if (!directMode && productConfig?.features?.marketplace === false) {
    button.disabled = true;
    setStatus(
      'A publicação no marketplace está temporariamente pausada.',
      'error'
    );
  }

  if (!directMode) {
    document.getElementById('pageTitle').textContent =
      'Preciso de um profissional';
    document.getElementById('pageSubtitle').textContent =
      'Publique gratuitamente, receba propostas e escolha com segurança.';
    button.textContent = 'Publicar e receber propostas';
    return;
  }

  try {
    const results = await Promise.all([
      OrcaClientAuth.rpc(
        'orcazap_get_public_professional',
        { p_slug: slug }
      ),
      OrcaClientAuth.rpc(
        'orcazap_get_public_professional_quality',
        { p_slug: slug }
      )
    ]);

    const rows = results[0];
    const quality = results[1] || {};

    if (!Array.isArray(rows) || !rows.length) {
      throw new Error('Profissional não encontrado ou link desativado.');
    }

    professional = rows[0];
    document.getElementById('pageTitle').textContent =
      `Pedir orçamento para ${professional.display_name}`;

    const ratingCount = Number(quality.rating_count || 0);
    const ratingAverage = Number(quality.rating_average || 0);

    document.getElementById('pageSubtitle').textContent = [
      professional.profession,
      professional.city,
      ratingCount ? `★ ${ratingAverage.toFixed(1)} (${ratingCount})` : '',
      quality.trust_label || ''
    ].filter(Boolean).join(' • ');

    profession.value = professional.profession;
    profession.disabled = true;
    if (productConfig?.features?.marketplace !== false) {
      marketplaceChoice.classList.remove('hidden');
    }
    button.textContent = 'Enviar pedido';
  } catch (error) {
    setStatus(error.message, 'error');
    button.disabled = true;
  }
}

async function uploadSelectedPhotos(requestId) {
  if (!selectedFiles.length) return;
  if (!session || !user?.id) {
    throw new Error('Entre na conta antes de enviar fotos.');
  }

  for (let index = 0; index < selectedFiles.length; index += 1) {
    const file = selectedFiles[index];
    setStatus(`Enviando foto ${index + 1} de ${selectedFiles.length}...`);

    const path =
      `${user.id}/${requestId}/${randomId()}.${extensionFor(file)}`;

    await OrcaClientAuth.uploadMedia(path, file);

    await OrcaClientAuth.rpc(
      'orcazap_register_request_media',
      {
        p_request_id: requestId,
        p_storage_path: path,
        p_mime_type: file.type,
        p_size_bytes: file.size,
        p_caption: ''
      },
      { auth: true }
    );
  }
}

function saveRecentRequest(data, result) {
  const token = String(result.access_token || '');
  if (!token) return;

  const recent = JSON.parse(
    localStorage.getItem('orcazap_recent_requests_v1') || '[]'
  ).filter(item => item && item.token !== token);

  recent.unshift({
    token,
    profession: data.profession,
    city: data.city,
    serviceText: data.serviceText,
    createdAt: new Date().toISOString()
  });

  localStorage.setItem(
    'orcazap_recent_requests_v1',
    JSON.stringify(recent.slice(0, 20))
  );
}


if (triageButton) {
  triageButton.addEventListener('click', () => renderSmartTriage());
}

let triageTimer = null;
if (serviceTextInput) {
  serviceTextInput.addEventListener('input', () => {
    clearTimeout(triageTimer);
    if (serviceTextInput.value.trim().length < 14) return;
    triageTimer = setTimeout(() => renderSmartTriage(), 700);
  });
}

photosInput.addEventListener('change', () => {
  try {
    selectedFiles = validateFiles(photosInput.files);
    renderPhotoList();

    if ((photosInput.files?.length || 0) > 5) {
      setStatus('Somente as 5 primeiras fotos serão enviadas.');
    } else {
      setStatus('');
    }
  } catch (error) {
    selectedFiles = [];
    photosInput.value = '';
    renderPhotoList();
    setStatus(error.message, 'error');
  }
});

photoLoginButton.addEventListener('click', requestMagicLink);

form.querySelectorAll('input, textarea, select').forEach(element => {
  if (element.id !== 'photos') {
    element.addEventListener('input', saveDraft);
    element.addEventListener('change', saveDraft);
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  setStatus('Enviando pedido...');

  const data = formData();

  try {
    if (selectedFiles.length && !session) {
      throw new Error(
        'Entre por e-mail para enviar fotos com segurança.'
      );
    }

    if (
      directMode &&
      selectedFiles.length &&
      !document.getElementById('marketplaceConsent').checked
    ) {
      throw new Error(
        'Para enviar fotos, marque também a opção de comparar propostas.'
      );
    }

    if (session) {
      await OrcaClientAuth.rpc(
        'orcazap_upsert_client_profile',
        {
          p_display_name: data.clientName,
          p_phone: data.clientPhone,
          p_city: data.city,
          p_accept_terms: true,
          p_marketing_opt_in: false
        },
        { auth: true }
      );

      await OrcaClientAuth.rpc(
        'orcazap_record_consent',
        {
          p_role: 'client',
          p_consent_type: 'order_terms_and_privacy',
          p_document_version: '2026-07-24-v4',
          p_granted: true,
          p_source: 'portal_pedido',
          p_metadata: { marketplace: !directMode }
        },
        { auth: true }
      );
    }

    let marketplaceResult = null;

    if (directMode) {
      await OrcaClientAuth.rpc('orcazap_submit_order_request', {
        p_slug: slug,
        p_client_name: data.clientName,
        p_client_phone: data.clientPhone,
        p_address: data.address,
        p_city: data.city,
        p_postal_code: data.postalCode,
        p_service_text: data.serviceText,
        p_measurements: data.measurements,
        p_desired_date: data.desiredDate,
        p_best_contact_time: data.bestContactTime,
        p_notes: data.notes
      });

      if (document.getElementById('marketplaceConsent').checked) {
        marketplaceResult = await OrcaClientAuth.rpc(
          'orcazap_create_marketplace_request',
          {
            p_client_name: data.clientName,
            p_client_phone: data.clientPhone,
            p_city: data.city,
            p_profession: data.profession,
            p_service_text: data.serviceText,
            p_measurements: data.measurements,
            p_desired_date: data.desiredDate,
            p_notes: [
              data.notes,
              data.address ? `Endereço informado: ${data.address}` : '',
              data.postalCode ? `CEP: ${data.postalCode}` : '',
              data.bestContactTime
                ? `Melhor horário: ${data.bestContactTime}`
                : '',
              referralCode ? `Código de origem: ${referralCode}` : ''
            ].filter(Boolean).join('\n'),
            p_origin_slug: slug,
            p_partner_code: partnerCode
          }
        );
      }
    } else {
      marketplaceResult = await OrcaClientAuth.rpc(
        'orcazap_create_marketplace_request',
        {
          p_client_name: data.clientName,
          p_client_phone: data.clientPhone,
          p_city: data.city,
          p_profession: data.profession,
          p_service_text: data.serviceText,
          p_measurements: data.measurements,
          p_desired_date: data.desiredDate,
          p_notes: [
            data.notes,
            data.address ? `Endereço informado: ${data.address}` : '',
            data.postalCode ? `CEP: ${data.postalCode}` : '',
            data.bestContactTime
              ? `Melhor horário: ${data.bestContactTime}`
              : '',
            referralCode ? `Código de origem: ${referralCode}` : ''
          ].filter(Boolean).join('\n'),
          p_origin_slug: '',
          p_partner_code: partnerCode
        }
      );
    }

    if (marketplaceResult?.request_id && selectedFiles.length) {
      await uploadSelectedPhotos(marketplaceResult.request_id);
    }

    if (marketplaceResult?.access_token) {
      saveRecentRequest(data, marketplaceResult);
      clearDraft();
      const token = encodeURIComponent(marketplaceResult.access_token);
      location.href = `acompanhar.html?t=${token}`;
      return;
    }

    form.reset();
    selectedFiles = [];
    renderPhotoList();
    clearDraft();

    if (directMode && professional) {
      profession.value = professional.profession;
    }

    setStatus(
      'Pedido enviado com sucesso. O profissional entrará em contato.',
      'success'
    );
  } catch (error) {
    setStatus(
      error.message || 'Não foi possível enviar. Tente novamente.',
      'error'
    );
  } finally {
    button.disabled = false;
  }
});

preparePage();
