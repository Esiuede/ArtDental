(() => {
    const treatmentPanel = document.querySelector('[data-panel="tratamento"]');
    if (!treatmentPanel || document.getElementById('followupModule')) return;

    const params = new URLSearchParams(window.location.search);
    const patientId = Number(params.get('id'));

    const TEETH = [
        18,17,16,15,14,13,12,11,
        21,22,23,24,25,26,27,28,
        48,47,46,45,44,43,42,41,
        31,32,33,34,35,36,37,38
    ];

    const PAYMENTS = [
        'PIX',
        'Dinheiro',
        'Cartão de débito',
        'Cartão de crédito',
        'Transferência',
        'Convênio',
        'Cortesia',
        'Outro'
    ];

    let entries = [];

    function escapeHTML(value = '') {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function formatDate(value) {
        if (!value) return '—';
        const [year, month, day] = value.split('-');
        return `${day}/${month}/${year}`;
    }

    function todayLocal() {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
    }

    function showMessage(text, type = 'success') {
        const target = document.getElementById('followupMessage');
        if (!target) return;

        target.textContent = text;
        target.className = `form-message show ${type}`;

        window.clearTimeout(showMessage.timeoutId);
        showMessage.timeoutId = window.setTimeout(() => {
            target.className = 'form-message';
            target.textContent = '';
        }, 5500);
    }

    function renderHistory() {
        const container = document.getElementById('followupHistory');
        const count = document.getElementById('followupCount');
        const filter = document.getElementById('followupFilter');
        if (!container || !count || !filter) return;

        const paymentFilter = filter.value;
        const filtered = paymentFilter
            ? entries.filter((entry) => entry.forma_pagamento === paymentFilter)
            : entries;

        count.textContent = `${filtered.length} ${filtered.length === 1 ? 'procedimento' : 'procedimentos'}`;

        if (!filtered.length) {
            container.innerHTML = '<div class="profile-empty">Nenhum procedimento registrado para este filtro.</div>';
            return;
        }

        container.innerHTML = filtered.map((entry) => `
            <div class="followup-item">
                <div class="followup-date">${formatDate(entry.data_procedimento)}</div>
                <div class="followup-main">
                    <strong>${escapeHTML(entry.procedimento)}</strong>
                    <div class="followup-meta">
                        ${entry.dente ? `<span class="followup-chip">Dente ${Number(entry.dente)}</span>` : '<span class="followup-chip">Procedimento geral</span>'}
                        <span class="followup-chip">${escapeHTML(entry.forma_pagamento)}</span>
                    </div>
                    ${entry.observacoes ? `<div class="followup-note">${escapeHTML(entry.observacoes)}</div>` : ''}
                </div>
                <div class="followup-payment">${escapeHTML(entry.forma_pagamento)}</div>
            </div>
        `).join('');
    }

    async function loadEntries() {
        const container = document.getElementById('followupHistory');

        if (!Number.isInteger(patientId) || patientId <= 0) {
            if (container) container.innerHTML = '<div class="profile-empty error-text">Paciente inválido.</div>';
            return;
        }

        const { data, error } = await supabaseClient
            .from('acompanhamento_tratamento')
            .select('id, paciente_id, procedimento, dente, data_procedimento, forma_pagamento, observacoes, registrado_por, criado_em')
            .eq('paciente_id', patientId)
            .order('data_procedimento', { ascending: false })
            .order('id', { ascending: false });

        if (error) {
            console.error('Erro ao carregar acompanhamento do tratamento:', error);
            if (container) {
                container.innerHTML = '<div class="profile-empty error-text">Não foi possível carregar o acompanhamento. Confirme se o SQL da v0.5 foi executado.</div>';
            }
            showMessage('Acompanhamento indisponível. Execute a migração v0.5 no Supabase.', 'error');
            return;
        }

        entries = data || [];
        renderHistory();
    }

    async function syncOdontogram(tooth, procedure, notes) {
        const odontogramNote = [
            `Procedimento concluído: ${procedure}`,
            notes ? `Observações do acompanhamento: ${notes}` : ''
        ].filter(Boolean).join('\n').slice(0, 5000);

        return supabaseClient
            .from('odontograma_registros')
            .insert({
                paciente_id: patientId,
                dente: Number(tooth),
                condicao: 'Tratamento concluído',
                superficie: 'Dente completo',
                observacoes: odontogramNote || null
            });
    }

    async function saveEntry(event) {
        event.preventDefault();

        const procedure = document.getElementById('followupProcedure');
        const tooth = document.getElementById('followupTooth');
        const date = document.getElementById('followupDate');
        const payment = document.getElementById('followupPayment');
        const notes = document.getElementById('followupNotes');
        const sync = document.getElementById('followupSyncOdontogram');
        const button = document.getElementById('saveFollowupButton');

        if (!procedure || !tooth || !date || !payment || !notes || !sync || !button) return;

        const procedureValue = procedure.value.trim();
        const notesValue = notes.value.trim();
        const toothValue = tooth.value ? Number(tooth.value) : null;

        if (procedureValue.length < 2) {
            showMessage('Informe o procedimento realizado.', 'error');
            procedure.focus();
            return;
        }

        if (!date.value) {
            showMessage('Informe a data do procedimento.', 'error');
            date.focus();
            return;
        }

        if (!payment.value) {
            showMessage('Selecione a forma de pagamento.', 'error');
            payment.focus();
            return;
        }

        button.disabled = true;
        button.textContent = 'Registrando...';

        const { data, error } = await supabaseClient
            .from('acompanhamento_tratamento')
            .insert({
                paciente_id: patientId,
                procedimento: procedureValue,
                dente: toothValue,
                data_procedimento: date.value,
                forma_pagamento: payment.value,
                observacoes: notesValue || null
            })
            .select()
            .single();

        if (error) {
            button.disabled = false;
            button.textContent = 'Registrar procedimento';
            console.error('Erro ao registrar acompanhamento:', error);
            showMessage('Não foi possível registrar o procedimento.', 'error');
            return;
        }

        let odontogramWarning = false;

        if (sync.checked && toothValue) {
            const { error: odontogramError } = await syncOdontogram(toothValue, procedureValue, notesValue);
            if (odontogramError) {
                odontogramWarning = true;
                console.error('Procedimento salvo, mas o odontograma não foi atualizado:', odontogramError);
            }
        }

        entries.unshift(data);
        renderHistory();

        procedure.value = '';
        tooth.value = '';
        payment.value = '';
        notes.value = '';
        date.value = todayLocal();
        sync.checked = false;
        sync.disabled = true;
        document.getElementById('followupSyncText').textContent = 'Selecione um dente para habilitar esta opção.';

        button.disabled = false;
        button.textContent = 'Registrar procedimento';

        if (odontogramWarning) {
            showMessage('Procedimento salvo, mas não foi possível atualizar o odontograma.', 'error');
        } else {
            showMessage('Procedimento registrado no acompanhamento do tratamento.');
        }
    }

    function buildModule() {
        treatmentPanel.insertAdjacentHTML('beforeend', `
            <section id="followupModule" style="margin-top:20px">
                <div class="followup-layout">
                    <article class="profile-card">
                        <div class="profile-card-header">
                            <div>
                                <h2>Acompanhamento do tratamento</h2>
                                <p>Registre cada procedimento efetivamente realizado no paciente.</p>
                            </div>
                        </div>
                        <div class="profile-card-body">
                            <div id="followupMessage" class="form-message" role="alert" aria-live="polite"></div>

                            <form id="followupForm" class="followup-form">
                                <div class="followup-grid">
                                    <div class="followup-field full">
                                        <label for="followupProcedure">Procedimento realizado *</label>
                                        <input id="followupProcedure" type="text" maxlength="300" placeholder="Ex.: Restauração em resina, profilaxia, extração..." required>
                                    </div>

                                    <div class="followup-field">
                                        <label for="followupTooth">Dente</label>
                                        <select id="followupTooth">
                                            <option value="">Procedimento geral / sem dente específico</option>
                                            ${TEETH.map((number) => `<option value="${number}">Dente ${number}</option>`).join('')}
                                        </select>
                                    </div>

                                    <div class="followup-field">
                                        <label for="followupDate">Data *</label>
                                        <input id="followupDate" type="date" value="${todayLocal()}" required>
                                    </div>

                                    <div class="followup-field full">
                                        <label for="followupPayment">Forma de pagamento *</label>
                                        <select id="followupPayment" required>
                                            <option value="">Selecione a forma de pagamento</option>
                                            ${PAYMENTS.map((payment) => `<option value="${escapeHTML(payment)}">${escapeHTML(payment)}</option>`).join('')}
                                        </select>
                                    </div>

                                    <div class="followup-field full">
                                        <label for="followupNotes">Observações</label>
                                        <textarea id="followupNotes" maxlength="5000" placeholder="Materiais utilizados, evolução clínica, orientações, intercorrências ou outras informações relevantes..."></textarea>
                                    </div>
                                </div>

                                <label class="followup-sync-option">
                                    <input type="checkbox" id="followupSyncOdontogram" disabled>
                                    <span>
                                        <strong>Atualizar também o odontograma</strong>
                                        <small id="followupSyncText">Selecione um dente para habilitar esta opção.</small>
                                    </span>
                                </label>

                                <p class="followup-hint">Se ativado, o dente escolhido receberá um novo registro no odontograma como “Tratamento concluído”. O histórico anterior será preservado.</p>

                                <div class="followup-actions">
                                    <button type="submit" class="btn btn-primary" id="saveFollowupButton">Registrar procedimento</button>
                                </div>
                            </form>
                        </div>
                    </article>

                    <article class="profile-card">
                        <div class="profile-card-header">
                            <div>
                                <h2>Histórico de procedimentos</h2>
                                <p>Procedimentos realizados, datas e formas de pagamento.</p>
                            </div>
                            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                                <select id="followupFilter" class="followup-filter" aria-label="Filtrar por forma de pagamento">
                                    <option value="">Todos os pagamentos</option>
                                    ${PAYMENTS.map((payment) => `<option value="${escapeHTML(payment)}">${escapeHTML(payment)}</option>`).join('')}
                                </select>
                                <span class="patient-meta" id="followupCount">0 procedimentos</span>
                            </div>
                        </div>
                        <div class="profile-card-body">
                            <div id="followupHistory" class="followup-history">
                                <div class="profile-empty">Carregando acompanhamento...</div>
                            </div>
                        </div>
                    </article>
                </div>
            </section>
        `);
    }

    function bindEvents() {
        document.getElementById('followupForm')?.addEventListener('submit', saveEntry);
        document.getElementById('followupFilter')?.addEventListener('change', renderHistory);

        document.getElementById('followupTooth')?.addEventListener('change', (event) => {
            const sync = document.getElementById('followupSyncOdontogram');
            const text = document.getElementById('followupSyncText');
            if (!sync || !text) return;

            const hasTooth = Boolean(event.target.value);
            sync.disabled = !hasTooth;
            if (!hasTooth) sync.checked = false;
            text.textContent = hasTooth
                ? `Ao salvar, o dente ${event.target.value} também pode ser marcado como tratamento concluído.`
                : 'Selecione um dente para habilitar esta opção.';
        });
    }

    async function init() {
        buildModule();
        bindEvents();

        const user = window.authReady ? await window.authReady : true;
        if (!user) return;

        await loadEntries();
    }

    init();
})();
