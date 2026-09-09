(() => {
    const panel = document.querySelector('[data-panel="odontograma"]');
    const tab = document.querySelector('[data-tab="odontograma"]');
    if (!panel || !tab) return;

    const params = new URLSearchParams(window.location.search);
    const patientId = Number(params.get('id'));

    const TEETH = {
        upperLeft: [18, 17, 16, 15, 14, 13, 12, 11],
        upperRight: [21, 22, 23, 24, 25, 26, 27, 28],
        lowerLeft: [48, 47, 46, 45, 44, 43, 42, 41],
        lowerRight: [31, 32, 33, 34, 35, 36, 37, 38]
    };

    const ALL_TEETH = [
        ...TEETH.upperLeft,
        ...TEETH.upperRight,
        ...TEETH.lowerLeft,
        ...TEETH.lowerRight
    ];

    const CONDITIONS = [
        { value: 'Saudável', label: 'Saudável / sem alteração', color: '#ffffff', border: '#94a3b8' },
        { value: 'Restauração', label: 'Restauração', color: '#3b82f6' },
        { value: 'Comprometido', label: 'Comprometido', color: '#ef4444' },
        { value: 'Tratamento necessário', label: 'Tratamento necessário', color: '#f59e0b' },
        { value: 'Tratamento concluído', label: 'Tratamento concluído', color: '#22c55e' },
        { value: 'Ausente / extraído', label: 'Ausente / extraído', color: '#64748b' },
        { value: 'Endodontia / canal', label: 'Endodontia / canal', color: '#a855f7' }
    ];

    const SURFACES = [
        'Dente completo',
        'Oclusal / Incisal',
        'Vestibular',
        'Lingual / Palatina',
        'Mesial',
        'Distal',
        'Raiz'
    ];

    let records = [];
    let selectedTooth = null;

    function escapeHTML(value = '') {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function formatDateTime(value) {
        if (!value) return '—';
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(new Date(value));
    }

    function conditionInfo(condition) {
        return CONDITIONS.find((item) => item.value === condition) || CONDITIONS[0];
    }

    function latestByTooth() {
        const map = new Map();
        records.forEach((record) => {
            if (!map.has(Number(record.dente))) {
                map.set(Number(record.dente), record);
            }
        });
        return map;
    }

    function toothType(number) {
        const unit = Number(number) % 10;
        if (unit <= 2) return 'incisor';
        if (unit === 3) return 'canine';
        if (unit <= 5) return 'premolar';
        return 'molar';
    }

    function toothPath(type) {
        const paths = {
            incisor: 'M15 7 C20 3 28 3 33 7 C36 11 35 19 33 25 C31 31 30 42 29 58 C29 64 26 68 24 68 C21 68 19 64 19 58 C18 42 17 31 15 25 C13 19 12 11 15 7 Z',
            canine: 'M15 8 C18 4 22 3 24 3 C28 3 32 5 34 9 C36 14 34 21 32 27 C30 34 29 45 28 61 C28 66 26 69 24 69 C21 69 19 66 19 61 C18 45 17 34 15 27 C13 21 12 14 15 8 Z',
            premolar: 'M12 9 C16 4 21 3 24 4 C28 3 33 5 36 10 C38 15 35 23 32 29 C30 36 31 48 32 59 C32 64 29 68 26 68 C24 68 23 64 23 59 L23 45 C22 54 22 63 19 67 C16 69 13 65 14 59 C16 47 17 37 15 29 C12 23 10 15 12 9 Z',
            molar: 'M8 11 C11 5 16 3 21 5 C24 2 28 3 31 5 C36 3 41 7 42 13 C43 19 39 26 35 31 C33 38 35 48 37 59 C38 64 35 68 32 68 C29 68 27 61 26 53 C25 61 24 69 20 69 C16 69 15 63 16 57 C17 48 18 40 15 31 C10 26 6 18 8 11 Z'
        };
        return paths[type] || paths.molar;
    }

    function toothSVG(number, arch) {
        const type = toothType(number);
        return `
            <svg class="tooth-svg ${arch}" viewBox="0 0 48 72" aria-hidden="true">
                <path class="tooth-shape" d="${toothPath(type)}"></path>
            </svg>`;
    }

    function renderQuadrant(teeth, arch, states) {
        return teeth.map((number) => {
            const current = states.get(number);
            const condition = current?.condicao || '';
            const description = current
                ? `${condition} · ${current.superficie}`
                : 'Sem registro';

            return `
                <button
                    type="button"
                    class="tooth-button ${current ? 'has-record' : ''} ${selectedTooth === number ? 'is-selected' : ''}"
                    data-tooth="${number}"
                    data-condition="${escapeHTML(condition)}"
                    data-arch="${arch}"
                    aria-label="Dente ${number}: ${escapeHTML(description)}"
                    title="Dente ${number} · ${escapeHTML(description)}"
                >
                    <span class="tooth-number">${number}</span>
                    ${toothSVG(number, arch)}
                    <span class="tooth-state-dot"></span>
                </button>`;
        }).join('');
    }

    function renderBoard() {
        const states = latestByTooth();
        const board = document.getElementById('odontogramBoard');
        if (!board) return;

        board.innerHTML = `
            <div class="odontogram-arch-block">
                <div class="odontogram-arch-title">Arcada superior</div>
                <div class="odontogram-arch">
                    <div class="odontogram-quadrant">${renderQuadrant(TEETH.upperLeft, 'upper', states)}</div>
                    <div class="odontogram-midline" aria-hidden="true"></div>
                    <div class="odontogram-quadrant">${renderQuadrant(TEETH.upperRight, 'upper', states)}</div>
                </div>
            </div>
            <div class="odontogram-arch-block">
                <div class="odontogram-arch-title">Arcada inferior</div>
                <div class="odontogram-arch">
                    <div class="odontogram-quadrant">${renderQuadrant(TEETH.lowerLeft, 'lower', states)}</div>
                    <div class="odontogram-midline" aria-hidden="true"></div>
                    <div class="odontogram-quadrant">${renderQuadrant(TEETH.lowerRight, 'lower', states)}</div>
                </div>
            </div>`;

        const count = states.size;
        const countTarget = document.getElementById('odontogramToothCount');
        if (countTarget) {
            countTarget.textContent = `${count} ${count === 1 ? 'dente com registro' : 'dentes com registro'}`;
        }
    }

    function renderLegend() {
        const legend = document.getElementById('odontogramLegend');
        if (!legend) return;

        legend.innerHTML = CONDITIONS.map((condition) => `
            <div class="odontogram-legend-item">
                <span class="odontogram-legend-color" style="background:${condition.color};border:1px solid ${condition.border || condition.color}"></span>
                <span>${escapeHTML(condition.label)}</span>
            </div>`).join('');
    }

    function renderHistory() {
        const container = document.getElementById('odontogramHistory');
        const count = document.getElementById('odontogramRecordCount');
        const filter = document.getElementById('odontogramHistoryFilter');
        if (!container || !count || !filter) return;

        const selectedFilter = filter.value;
        const filtered = selectedFilter
            ? records.filter((record) => String(record.dente) === selectedFilter)
            : records;

        count.textContent = `${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'}`;

        if (!filtered.length) {
            container.innerHTML = '<div class="profile-empty">Nenhum registro no odontograma para este filtro.</div>';
            return;
        }

        container.innerHTML = filtered.map((record) => `
            <div class="odontogram-history-item">
                <div class="odontogram-history-tooth">${Number(record.dente)}</div>
                <div class="odontogram-history-main">
                    <strong>${escapeHTML(record.condicao)}</strong>
                    <span>${escapeHTML(record.superficie || 'Dente completo')}</span>
                    ${record.observacoes ? `<div class="odontogram-history-note">${escapeHTML(record.observacoes)}</div>` : ''}
                </div>
                <div class="odontogram-history-date">${formatDateTime(record.criado_em)}</div>
            </div>`).join('');
    }

    function toothHistory(number) {
        return records.filter((record) => Number(record.dente) === Number(number));
    }

    function renderSelectedToothHistory(number) {
        const target = document.getElementById('odontogramSelectedHistory');
        if (!target) return;

        const history = toothHistory(number).slice(0, 6);
        if (!history.length) {
            target.innerHTML = '<div class="odontogram-tooth-history-row">Nenhum registro anterior para este dente.</div>';
            return;
        }

        target.innerHTML = history.map((record) => `
            <div class="odontogram-tooth-history-row">
                <strong>${escapeHTML(record.condicao)}</strong> · ${escapeHTML(record.superficie)}<br>
                ${formatDateTime(record.criado_em)}
            </div>`).join('');
    }

    function updateCurrentState(number) {
        const target = document.getElementById('odontogramCurrentState');
        if (!target) return;

        const current = toothHistory(number)[0];
        if (!current) {
            target.innerHTML = `<strong>Dente ${number}</strong> · ainda não possui registros no odontograma.`;
            return;
        }

        target.innerHTML = `
            <strong>Dente ${number}</strong> · estado atual: <strong>${escapeHTML(current.condicao)}</strong><br>
            ${escapeHTML(current.superficie)} · registrado em ${formatDateTime(current.criado_em)}`;
    }

    function openToothDialog(number) {
        selectedTooth = Number(number);
        renderBoard();

        const dialog = document.getElementById('odontogramDialog');
        const title = document.getElementById('odontogramDialogTitle');
        const condition = document.getElementById('odontogramCondition');
        const surface = document.getElementById('odontogramSurface');
        const notes = document.getElementById('odontogramNotes');
        if (!dialog || !title || !condition || !surface || !notes) return;

        const current = toothHistory(selectedTooth)[0];
        title.textContent = `Dente ${selectedTooth}`;
        condition.value = current?.condicao || 'Saudável';
        surface.value = 'Dente completo';
        notes.value = '';

        updateCurrentState(selectedTooth);
        renderSelectedToothHistory(selectedTooth);
        dialog.showModal();
    }

    function closeDialog() {
        const dialog = document.getElementById('odontogramDialog');
        if (dialog?.open) dialog.close();
        selectedTooth = null;
        renderBoard();
    }

    function showMessage(text, type = 'success') {
        const target = document.getElementById('odontogramMessage');
        if (!target) return;
        target.textContent = text;
        target.className = `form-message show ${type}`;
        window.clearTimeout(showMessage.timeoutId);
        showMessage.timeoutId = window.setTimeout(() => {
            target.className = 'form-message';
            target.textContent = '';
        }, 5500);
    }

    async function loadRecords() {
        const history = document.getElementById('odontogramHistory');
        if (!Number.isInteger(patientId) || patientId <= 0) {
            if (history) history.innerHTML = '<div class="profile-empty error-text">Paciente inválido.</div>';
            return;
        }

        const { data, error } = await supabaseClient
            .from('odontograma_registros')
            .select('id, paciente_id, dente, condicao, superficie, observacoes, registrado_por, criado_em')
            .eq('paciente_id', patientId)
            .order('criado_em', { ascending: false })
            .order('id', { ascending: false });

        if (error) {
            console.error('Erro ao carregar odontograma:', error);
            if (history) {
                history.innerHTML = '<div class="profile-empty error-text">Não foi possível carregar o odontograma. Confirme se o SQL da v0.4 foi executado.</div>';
            }
            showMessage('Odontograma indisponível. Execute a migração v0.4 no Supabase.', 'error');
            return;
        }

        records = data || [];
        renderBoard();
        renderHistory();
    }

    async function saveRecord(event) {
        event.preventDefault();
        if (!selectedTooth) return;

        const condition = document.getElementById('odontogramCondition');
        const surface = document.getElementById('odontogramSurface');
        const notes = document.getElementById('odontogramNotes');
        const button = document.getElementById('saveOdontogramButton');
        if (!condition || !surface || !notes || !button) return;

        const observation = notes.value.trim();
        if (observation.length > 5000) {
            showMessage('A observação do odontograma deve ter no máximo 5000 caracteres.', 'error');
            return;
        }

        button.disabled = true;
        button.textContent = 'Registrando...';

        const { data, error } = await supabaseClient
            .from('odontograma_registros')
            .insert({
                paciente_id: patientId,
                dente: selectedTooth,
                condicao: condition.value,
                superficie: surface.value,
                observacoes: observation || null
            })
            .select()
            .single();

        button.disabled = false;
        button.textContent = 'Registrar alteração';

        if (error) {
            console.error('Erro ao registrar odontograma:', error);
            showMessage('Não foi possível registrar a alteração no odontograma.', 'error');
            return;
        }

        records.unshift(data);
        const savedTooth = selectedTooth;
        closeDialog();
        renderHistory();
        showMessage(`Dente ${savedTooth} atualizado no odontograma.`);
    }

    function buildPanel() {
        tab.querySelector('.tab-badge')?.remove();

        panel.innerHTML = `
            <div class="odontogram-layout">
                <article class="profile-card odontogram-card">
                    <div class="profile-card-header">
                        <div>
                            <h2>Odontograma</h2>
                            <p>Selecione um dente para registrar características, condições e procedimentos.</p>
                        </div>
                        <span class="patient-meta" id="odontogramToothCount">0 dentes com registro</span>
                    </div>
                    <div class="profile-card-body">
                        <div id="odontogramMessage" class="form-message" role="alert" aria-live="polite"></div>
                        <div class="odontogram-toolbar">
                            <div class="odontogram-toolbar-copy">
                                <h3>Dentição permanente</h3>
                                <p>Numeração FDI · clique sobre qualquer elemento para registrar uma alteração.</p>
                            </div>
                        </div>
                        <div class="odontogram-board" id="odontogramBoard"></div>
                        <div class="odontogram-legend" id="odontogramLegend"></div>
                        <p class="odontogram-note">Nesta versão, a cor representa o registro mais recente do dente inteiro. A superfície selecionada já fica armazenada no histórico para permitir evolução futura por faces.</p>
                    </div>
                </article>

                <article class="profile-card odontogram-history-card">
                    <div class="profile-card-header">
                        <div>
                            <h2>Histórico do odontograma</h2>
                            <p>Os lançamentos anteriores são preservados no prontuário.</p>
                        </div>
                        <div class="odontogram-history-toolbar">
                            <select id="odontogramHistoryFilter" class="odontogram-history-filter" aria-label="Filtrar histórico por dente">
                                <option value="">Todos os dentes</option>
                                ${ALL_TEETH.map((number) => `<option value="${number}">Dente ${number}</option>`).join('')}
                            </select>
                            <span class="patient-meta" id="odontogramRecordCount">0 registros</span>
                        </div>
                    </div>
                    <div class="profile-card-body">
                        <div class="odontogram-history" id="odontogramHistory">
                            <div class="profile-empty">Carregando odontograma...</div>
                        </div>
                    </div>
                </article>
            </div>`;
    }

    function buildDialog() {
        if (document.getElementById('odontogramDialog')) return;

        document.body.insertAdjacentHTML('beforeend', `
            <dialog class="patient-dialog odontogram-dialog" id="odontogramDialog">
                <div class="odontogram-dialog-content">
                    <div class="odontogram-dialog-header">
                        <div>
                            <span class="section-label">ODONTOGRAMA</span>
                            <h3 id="odontogramDialogTitle">Dente</h3>
                            <p>O novo lançamento será acrescentado ao histórico clínico.</p>
                        </div>
                        <button type="button" class="dialog-close-button" id="closeOdontogramButton" aria-label="Fechar">×</button>
                    </div>

                    <div class="odontogram-current-state" id="odontogramCurrentState"></div>

                    <form class="odontogram-form" id="odontogramForm">
                        <div class="odontogram-form-grid">
                            <div class="odontogram-field">
                                <label for="odontogramCondition">Condição / procedimento</label>
                                <select id="odontogramCondition" required>
                                    ${CONDITIONS.map((item) => `<option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="odontogram-field">
                                <label for="odontogramSurface">Superfície / área</label>
                                <select id="odontogramSurface" required>
                                    ${SURFACES.map((surface) => `<option value="${escapeHTML(surface)}">${escapeHTML(surface)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="odontogram-field full">
                                <label for="odontogramNotes">Observações</label>
                                <textarea id="odontogramNotes" maxlength="5000" placeholder="Detalhes clínicos, material utilizado, característica observada ou outra informação relevante..."></textarea>
                            </div>
                        </div>

                        <div class="odontogram-tooth-history">
                            <h4>Últimos registros deste dente</h4>
                            <div class="odontogram-tooth-history-list" id="odontogramSelectedHistory"></div>
                        </div>

                        <div class="dialog-actions">
                            <button type="button" class="btn btn-secondary" id="cancelOdontogramButton">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="saveOdontogramButton">Registrar alteração</button>
                        </div>
                    </form>
                </div>
            </dialog>`);
    }

    function bindEvents() {
        document.getElementById('odontogramBoard')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-tooth]');
            if (!button) return;
            openToothDialog(Number(button.dataset.tooth));
        });

        document.getElementById('odontogramHistoryFilter')?.addEventListener('change', renderHistory);
        document.getElementById('odontogramForm')?.addEventListener('submit', saveRecord);
        document.getElementById('closeOdontogramButton')?.addEventListener('click', closeDialog);
        document.getElementById('cancelOdontogramButton')?.addEventListener('click', closeDialog);
        document.getElementById('odontogramDialog')?.addEventListener('cancel', () => {
            selectedTooth = null;
            renderBoard();
        });
    }

    async function init() {
        buildPanel();
        buildDialog();
        renderLegend();
        renderBoard();
        bindEvents();

        const user = window.authReady ? await window.authReady : true;
        if (!user) return;
        await loadRecords();
    }

    init();
})();
