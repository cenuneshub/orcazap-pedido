const slug = new URLSearchParams(location.search).get('p') || '';
const hero = document.getElementById('hero');
const content = document.getElementById('content');

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''), location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

async function load() {
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
      throw new Error('Profissional não encontrado.');
    }

    const professional = rows[0];
    const count = Number(quality.rating_count || 0);
    const average = Number(quality.rating_average || 0);
    const completed = Number(quality.completed_services || 0);
    const score = Number(quality.quality_score || 0);
    const responseMinutes = Number(quality.response_minutes || 0);
    const localPosition = Number(quality.local_position || 0);
    const rareBadges = Array.isArray(quality.rare_badges)
      ? quality.rare_badges
      : [];
    const responseLabel = responseMinutes <= 0
      ? 'tempo de resposta em formação'
      : responseMinutes < 60
          ? `responde em cerca de ${responseMinutes} min`
          : `responde em cerca de ${Math.round(responseMinutes / 60)} h`;

    hero.innerHTML = `
      <h1>${escapeHtml(professional.display_name)}</h1>
      <p>
        ${escapeHtml(
          [professional.profession, professional.city]
            .filter(Boolean)
            .join(' • ')
        )}
      </p>
    `;

    const links = [
      ['Instagram', safeUrl(professional.instagram)],
      ['Facebook', safeUrl(professional.facebook)],
      ['TikTok', safeUrl(professional.tiktok)],
      ['Site', safeUrl(professional.website)]
    ].filter(item => item[1]);

    content.innerHTML = `
      <div class="card">
        <p class="rating">
          ${
            count
              ? `★ ${average.toFixed(1)} • ${count} avaliação(ões) verificada(s)`
              : 'Novo perfil no OrçaZap'
          }
        </p>
        <div class="info ${
          quality.verified_profile ? 'success-box' : ''
        }">
          <strong>${escapeHtml(
            quality.trust_label || 'Perfil em construção'
          )}</strong>
          <p class="small">
            Índice de confiança: ${score}/100
            • ${completed} serviço(s) concluído(s)
            • ${escapeHtml(responseLabel)}
            ${
              quality.verified_profile
                ? ' • conta profissional protegida'
                : ''
            }
          </p>
          ${
            rareBadges.length
              ? `<div>${rareBadges.map(
                  badge => `<span class="tag" style="margin:0 5px 5px 0">${escapeHtml(badge)}</span>`
                ).join('')}</div>`
              : ''
          }
        </div>
        ${
          localPosition
            ? `<a class="button secondary" href="ranking.html?cidade=${encodeURIComponent(professional.city)}&profissao=${encodeURIComponent(professional.profession)}">Ver posição local: #${localPosition}</a>`
            : ''
        }
        <p class="small">
          Avaliações são liberadas somente após serviços concluídos
          pelo marketplace. O índice não representa garantia do serviço.
        </p>
        <a
          class="button"
          href="index.html?p=${encodeURIComponent(professional.slug)}"
        >
          Solicitar orçamento
        </a>
        ${
          links.length
            ? `
              <div style="margin-top:14px">
                ${links.map(([label, url]) => `
                  <p>
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener">
                      ${escapeHtml(label)}
                    </a>
                  </p>
                `).join('')}
              </div>
            `
            : ''
        }
      </div>
    `;
  } catch (error) {
    hero.innerHTML = '<h1>Perfil indisponível</h1>';
    content.innerHTML = `
      <div class="card">${escapeHtml(error.message)}</div>
    `;
  }
}

load();
