const cityInput = document.getElementById('city');
const professionSelect = document.getElementById('profession');
const searchButton = document.getElementById('searchButton');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const params = new URLSearchParams(location.search);

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

function positionLabel(position) {
  const number = Number(position || 0);
  if (number === 1) return '🥇';
  if (number === 2) return '🥈';
  if (number === 3) return '🥉';
  return `#${number}`;
}

function responseLabel(minutes) {
  const value = Number(minutes || 0);
  if (!value) return 'Tempo de resposta em formação';
  if (value < 60) return `Responde em cerca de ${value} min`;
  return `Responde em cerca de ${Math.round(value / 60)} h`;
}

async function loadProfessions() {
  try {
    const response = await fetch('professions.json', { cache: 'no-store' });
    const professions = await response.json();

    professionSelect.innerHTML = '<option value="">Todas as profissões</option>' +
      professions.map(value => `
        <option value="${escapeHtml(value)}">${escapeHtml(value)}</option>
      `).join('');
  } catch (_) {}

  professionSelect.value = params.get('profissao') || '';
}

function render(entries) {
  if (!entries.length) {
    resultsEl.innerHTML = `
      <section class="card">
        <h2>Ainda não há dados suficientes</h2>
        <p>
          O ranking aparece conforme profissionais concluem serviços e
          recebem avaliações verificadas.
        </p>
      </section>
    `;
    return;
  }

  resultsEl.innerHTML = entries.map(entry => {
    const badges = Array.isArray(entry.rare_badges)
      ? entry.rare_badges
      : [];
    const ratingCount = Number(entry.rating_count || 0);
    const rating = Number(entry.rating_average || 0);

    return `
      <article class="card">
        <div class="account-bar">
          <div>
            <span class="tag">${positionLabel(entry.position)}</span>
            <h2>${escapeHtml(entry.display_name)}</h2>
            <p class="small">
              ${escapeHtml(
                [entry.profession, entry.city].filter(Boolean).join(' • ')
              )}
            </p>
          </div>
          <strong>${Number(entry.quality_score || 0)}/100</strong>
        </div>
        <p class="rating">
          ${
            ratingCount
              ? `★ ${rating.toFixed(1)} • ${ratingCount} avaliação(ões)`
              : 'Ainda sem avaliações verificadas'
          }
        </p>
        <div class="info success-box">
          <strong>${escapeHtml(entry.trust_label)}</strong>
          <p class="small">
            ${Number(entry.completed_services || 0)} serviço(s) concluído(s)
            • ${escapeHtml(responseLabel(entry.response_minutes))}
          </p>
        </div>
        ${
          badges.length
            ? `<div style="margin-top:10px">${badges.map(
                badge => `<span class="tag" style="margin:0 5px 5px 0">${escapeHtml(badge)}</span>`
              ).join('')}</div>`
            : ''
        }
        <a
          class="button"
          href="perfil.html?p=${encodeURIComponent(entry.slug)}"
        >Ver perfil e solicitar orçamento</a>
      </article>
    `;
  }).join('');
}

async function loadRanking() {
  const city = cityInput.value.trim();
  const profession = professionSelect.value.trim();

  if (!city) {
    setStatus('Informe a cidade.', 'error');
    cityInput.focus();
    return;
  }

  searchButton.disabled = true;
  setStatus('Consultando profissionais...');
  resultsEl.innerHTML = '';

  try {
    const entries = await OrcaClientAuth.rpc(
      'orcazap_get_local_ranking',
      {
        p_city: city,
        p_profession: profession,
        p_limit: 30
      }
    );

    const list = Array.isArray(entries) ? entries : [];
    render(list);
    setStatus(
      list.length
        ? `${list.length} profissional(is) encontrado(s).`
        : 'Nenhum resultado para os filtros informados.',
      list.length ? 'success' : ''
    );

    const next = new URLSearchParams();
    next.set('cidade', city);
    if (profession) next.set('profissao', profession);
    history.replaceState(null, '', `ranking.html?${next.toString()}`);
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    searchButton.disabled = false;
  }
}

searchButton.addEventListener('click', loadRanking);
cityInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') loadRanking();
});

async function init() {
  cityInput.value = params.get('cidade') || '';
  await loadProfessions();
  if (cityInput.value) await loadRanking();
}

init();
