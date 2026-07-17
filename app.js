(function () {
  'use strict';

  const config = window.RSVP_CONFIG || {};
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const state = { event: null, guests: [], responses: [], filter: '', loading: false };
  const $ = (id) => document.getElementById(id);
  const text = (value) => String(value ?? '');

  function notify(message, type = '') {
    const element = $('notice');
    element.textContent = message;
    element.className = `notice ${type}`.trim();
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => element.classList.add('hidden'), 4200);
  }

  function setConnection(mode, label) {
    const element = $('connection');
    element.className = `connection ${mode || ''}`.trim();
    element.innerHTML = `<i></i> ${label}`;
  }

  function setBusy(value) {
    state.loading = value;
    ['refresh', 'download-pdf', 'save-settings'].forEach((id) => { $(id).disabled = value; });
  }

  async function rpc(name, payload) {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({ ok: false, error: 'Resposta inválida do servidor.' }));
    if (!response.ok) throw new Error(data.message || data.error || `Falha de comunicação (${response.status}).`);
    if (!data.ok) throw new Error(data.error || 'A operação não pôde ser concluída.');
    return data;
  }

  function formatDate(value, withTime = false) {
    if (!value) return '—';
    const date = withTime ? new Date(value) : new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat('pt-BR', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'long' }).format(date);
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function updateSummary() {
    const confirmed = state.responses.filter((item) => item.attending);
    const declined = state.responses.filter((item) => !item.attending);
    const companions = confirmed.reduce((sum, item) => sum + Number(item.companions || 0), 0);
    const pending = state.event.nameLimitEnabled ? state.guests.filter((item) => !item.responded).length : 0;
    $('metric-confirmed').textContent = confirmed.length + companions;
    $('metric-declined').textContent = declined.length;
    $('metric-companions').textContent = companions;
    $('metric-pending').textContent = pending;
  }

  function renderResponses() {
    const rows = state.responses;
    $('responses-count').textContent = `${rows.length} ${rows.length === 1 ? 'resposta' : 'respostas'}`;
    $('responses-empty').classList.toggle('hidden', rows.length > 0);
    $('responses-table-wrap').classList.toggle('hidden', rows.length === 0);
    $('responses-body').innerHTML = rows.map((item) => `
      <tr>
        <td data-label="Convidado"><strong>${escapeHtml(item.name)}</strong></td>
        <td data-label="Status"><span class="status ${item.attending ? 'yes' : 'no'}">${item.attending ? 'Confirmado' : 'Não irá'}</span></td>
        <td data-label="WhatsApp">${escapeHtml(item.whatsapp || '—')}</td>
        <td data-label="Acompanhantes">${Number(item.companions || 0)}</td>
        <td data-label="Atualizado">${escapeHtml(formatDate(item.updatedAt, true))}</td>
        <td data-label="Excluir"><button class="delete-button" type="button" data-delete-response="${item.id}" title="Excluir resposta" aria-label="Excluir resposta">×</button></td>
      </tr>`).join('');
  }

  function renderGuests() {
    const query = state.filter.trim().toLocaleLowerCase('pt-BR');
    const guests = state.guests.filter((item) => !query || `${item.name} ${item.group}`.toLocaleLowerCase('pt-BR').includes(query));
    $('guests-count').textContent = `${state.guests.length} ${state.guests.length === 1 ? 'nome' : 'nomes'}`;
    $('guests-empty').classList.toggle('hidden', guests.length > 0);
    $('guests-list').classList.toggle('hidden', guests.length === 0);
    $('guests-list').innerHTML = guests.map((item) => `
      <div class="guest-row">
        <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.group || 'Sem grupo')} • até ${Number(item.maxCompanions || 0)} acompanhante(s)</small></div>
        <span class="guest-response ${item.responded ? (item.attending ? 'yes' : 'no') : ''}">${item.responded ? (item.attending ? 'Confirmado' : 'Não irá') : 'Aguardando'}</span>
        <button class="delete-button" type="button" data-delete-guest="${item.id}" title="Excluir convidado" aria-label="Excluir convidado">×</button>
      </div>`).join('');
  }

  function renderEvent() {
    const event = state.event;
    $('event-title').textContent = event.name;
    $('event-date').textContent = formatDate(event.date);
    $('event-slug').textContent = event.slug;
    $('expiry').textContent = `Dados programados para exclusão em ${formatDate(event.expiresAt)} (${event.cleanupAfterDays} dia(s) após o evento).`;
    $('setting-name').value = event.name;
    $('setting-date').value = event.date;
    $('setting-name-limit').checked = event.nameLimitEnabled;
    $('setting-whatsapp').checked = event.collectWhatsapp;
    $('setting-companions').checked = event.allowCompanions;
    $('setting-max-companions').value = event.maxCompanions;
    $('setting-cleanup').value = event.cleanupAfterDays;
    $('setting-max-companions').disabled = !event.allowCompanions;
    $('guest-list-panel').classList.toggle('limited-off', !event.nameLimitEnabled);
    document.title = `${event.name} | Lista de Convidados`;
  }

  function render() {
    renderEvent();
    renderResponses();
    renderGuests();
    updateSummary();
  }

  async function loadState(silent = false) {
    if (state.loading) return;
    setBusy(true);
    if (!silent) setConnection('', 'Atualizando');
    try {
      const data = await rpc('rsvp_admin_get_state', { p_dashboard_token: token });
      state.event = data.event;
      state.guests = data.guests || [];
      state.responses = data.responses || [];
      render();
      setConnection('online', 'Sincronizado');
    } catch (error) {
      setConnection('offline', 'Falha ao sincronizar');
      if (!state.event) showFatal(error.message);
      else if (!silent) notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function showFatal(message) {
    $('fatal-message').textContent = message;
    $('fatal').classList.remove('hidden');
  }

  $('settings-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await rpc('rsvp_admin_update_event', {
        p_dashboard_token: token,
        p_event_name: $('setting-name').value.trim(),
        p_event_date: $('setting-date').value,
        p_cleanup_after_days: Number($('setting-cleanup').value || 0),
        p_name_limit_enabled: $('setting-name-limit').checked,
        p_collect_whatsapp: $('setting-whatsapp').checked,
        p_allow_companions: $('setting-companions').checked,
        p_max_companions: Number($('setting-max-companions').value || 0)
      });
      notify('Configurações salvas. O formulário do convite já usa o novo comportamento.');
      setBusy(false);
      await loadState(true);
    } catch (error) {
      notify(error.message, 'error');
      setBusy(false);
    }
  });

  $('guest-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const companionValue = $('new-guest-companions').value;
    try {
      await rpc('rsvp_admin_add_guest', {
        p_dashboard_token: token,
        p_name: $('new-guest-name').value.trim(),
        p_group: $('new-guest-group').value.trim(),
        p_max_companions: companionValue === '' ? null : Number(companionValue)
      });
      event.target.reset();
      notify('Convidado adicionado à lista.');
      await loadState(true);
    } catch (error) { notify(error.message, 'error'); }
  });

  document.addEventListener('click', async (event) => {
    const responseId = event.target.dataset.deleteResponse;
    const guestId = event.target.dataset.deleteGuest;
    if (!responseId && !guestId) return;
    const prompt = responseId ? 'Excluir esta confirmação?' : 'Excluir este convidado da lista permitida?';
    if (!window.confirm(prompt)) return;
    try {
      await rpc(responseId ? 'rsvp_admin_delete_response' : 'rsvp_admin_delete_guest', responseId
        ? { p_dashboard_token: token, p_response_id: responseId }
        : { p_dashboard_token: token, p_guest_id: guestId });
      notify(responseId ? 'Confirmação excluída.' : 'Convidado excluído.');
      await loadState(true);
    } catch (error) { notify(error.message, 'error'); }
  });

  $('setting-companions').addEventListener('change', (event) => { $('setting-max-companions').disabled = !event.target.checked; });
  $('guest-filter').addEventListener('input', (event) => { state.filter = event.target.value; renderGuests(); });
  $('refresh').addEventListener('click', () => loadState());
  $('download-pdf').addEventListener('click', () => {
    if (!window.jspdf?.jsPDF) return notify('O gerador de PDF ainda não carregou. Tente novamente.', 'error');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const title = `Lista de convidados — ${state.event.name}`;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(title, 14, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(`Evento: ${formatDate(state.event.date)} • Gerado em ${formatDate(new Date().toISOString(), true)}`, 14, 25);
    const confirmedIds = new Set(state.responses.filter((item) => item.attending).map((item) => item.guestId).filter(Boolean));
    const rows = state.event.nameLimitEnabled
      ? state.guests.map((guest) => { const response = state.responses.find((item) => item.guestId === guest.id); return [guest.name, guest.group || '—', response ? (response.attending ? 'Confirmado' : 'Não irá') : 'Aguardando', response?.companions || 0, response?.whatsapp || '—', '']; })
      : state.responses.map((item) => [item.name, '—', item.attending ? 'Confirmado' : 'Não irá', item.companions || 0, item.whatsapp || '—', '']);
    void confirmedIds;
    doc.autoTable({ startY: 31, head: [['Nome', 'Grupo', 'Status', 'Acomp.', 'WhatsApp', 'Entrada']], body: rows, styles: { fontSize: 8, cellPadding: 2.3 }, headStyles: { fillColor: [33, 28, 24] }, alternateRowStyles: { fillColor: [247, 243, 238] }, columnStyles: { 5: { cellWidth: 18 } } });
    doc.save(`lista-convidados-${state.event.slug}.pdf`);
  });

  if (!token) showFatal('Este link não contém a chave privada do painel. Abra o endereço fornecido pelo Builder.');
  else if (!config.supabaseUrl || !config.publishableKey) showFatal('O dashboard ainda não foi conectado ao Supabase.');
  else {
    loadState();
    setInterval(() => { if (!document.hidden) loadState(true); }, 30000);
  }
})();
