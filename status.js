const content = document.getElementById('content');
const statusEl = document.getElementById('status');

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

async function load() {
  try {
    setStatus('Consultando sistema...');

    const config = await OrcaClientAuth.rpc(
      'orcazap_get_public_product_config',
      {}
    );

    const features = Object.entries(config?.features || {})
      .sort((a, b) => a[0].localeCompare(b[0]));

    content.innerHTML = `
      <section class="metrics">
        <div class="metric">
          <strong>${escapeHtml(config?.latest_app_version || '-')}</strong>
          versão mais recente
        </div>
        <div class="metric">
          <strong>${escapeHtml(config?.minimum_app_version || '-')}</strong>
          versão mínima online
        </div>
        <div class="metric">
          <strong>${Number(config?.schema_version || 0)}</strong>
          schema do banco
        </div>
      </section>

      <section class="card ${
        config?.maintenance ? 'warning-box' : 'success-box'
      }">
        <h2>
          ${
            config?.maintenance
              ? 'Manutenção em andamento'
              : 'Sistema operacional'
          }
        </h2>
        <p>
          ${escapeHtml(
            config?.message ||
            'OrçaZap Online operando normalmente.'
          )}
        </p>
        <p class="small">
          Termos: ${escapeHtml(config?.terms_version || 'não informado')}
        </p>
      </section>

      <section>
        <h2>Recursos</h2>
        ${
          features.map(([key, enabled]) => `
            <article class="card">
              <div class="account-bar">
                <strong>${escapeHtml(featureLabel(key))}</strong>
                <span class="tag">
                  ${enabled ? 'Disponível' : 'Pausado'}
                </span>
              </div>
            </article>
          `).join('')
        }
      </section>

      <section class="card">
        <h2>Precisa de ajuda?</h2>
        <a class="button" href="ajuda.html">Abrir Central de Ajuda</a>
      </section>
    `;

    setStatus('');
  } catch (error) {
    content.innerHTML = `
      <section class="card error-box">
        Não foi possível consultar o status.
      </section>
    `;
    setStatus(error.message, 'error');
  }
}

load();
