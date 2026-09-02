const profileParamsV03 = new URLSearchParams(window.location.search);
const patientIdV03 = Number(profileParamsV03.get('id'));

const anamnesisDialog = document.getElementById('anamnesisDialog');
const anamnesisForm = document.getElementById('anamnesisForm');
const anamnesisSummary = document.getElementById('anamnesisSummary');
const openAnamnesisButton = document.getElementById('openAnamnesisButton');
const closeAnamnesisButton = document.getElementById('closeAnamnesisButton');
const cancelAnamnesisButton = document.getElementById('cancelAnamnesisButton');
const saveAnamnesisButton = document.getElementById('saveAnamnesisButton');

const anamnesisFields = {
    hasDiseases: document.getElementById('hasDiseases'),
    diseasesDetails: document.getElementById('diseasesDetails'),
    usesMedication: document.getElementById('usesMedication'),
    medicationDetails: document.getElementById('medicationDetails'),
    hasAllergies: document.getElementById('hasAllergies'),
    allergyDetails: document.getElementById('allergyDetails'),
    surgeryDetails: document.getElementById('surgeryDetails'),
    hasHypertension: document.getElementById('hasHypertension'),
    hasDiabetes: document.getElementById('hasDiabetes'),
    hasHeartCondition: document.getElementById('hasHeartCondition'),
    otherConditions: document.getElementById('otherConditions'),
    notes: document.getElementById('anamnesisNotes')
};

const treatmentPlanText = document.getElementById('treatmentPlanText');
const treatmentCharCount = document.getElementById('treatmentCharCount');
const treatmentLastSaved = document.getElementById('treatmentLastSaved');
const treatmentVersionCount = document.getElementById('treatmentVersionCount');
const treatmentHistory = document.getElementById('treatmentHistory');
const saveTreatmentPlanButton = document.getElementById('saveTreatmentPlanButton');
const treatmentMessage = document.getElementById('treatmentMessage');

let currentAnamnesis = null;
let treatmentVersions = [];

function escapeClinical(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatClinicalDateTime(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
}

function showTreatmentMessage(text, type = 'success') {
    treatmentMessage.textContent = text;
    treatmentMessage.className = `form-message show ${type}`;
    window.clearTimeout(showTreatmentMessage.timeoutId);
    showTreatmentMessage.timeoutId = window.setTimeout(() => {
        treatmentMessage.className = 'form-message';
        treatmentMessage.textContent = '';
    }, 5000);
}

function showClinicalProfileMessage(text, type = 'success') {
    if (typeof showProfileMessage === 'function') {
        showProfileMessage(text, type);
        return;
    }

    const target = document.getElementById('profileMessage');
    if (!target) return;
    target.textContent = text;
    target.className = `form-message show ${type}`;
}

function yesNoBadge(value) {
    return `<span class="clinical-badge ${value ? 'clinical-badge-alert' : 'clinical-badge-ok'}">${value ? 'Sim' : 'Não'}</span>`;
}

function detailOrEmpty(value) {
    const clean = String(value || '').trim();
    return clean ? escapeClinical(clean) : '<span class="text-muted">Não informado</span>';
}

function renderAnamnesis() {
    if (!currentAnamnesis) {
        openAnamnesisButton.textContent = 'Preencher anamnese';
        anamnesisSummary.innerHTML = `
            <div class="clinical-empty-state">
                <div class="clinical-empty-icon">+</div>
                <div>
                    <h3>Nenhuma anamnese registrada</h3>
                    <p>Use o botão acima para registrar o histórico de saúde informado pelo paciente.</p>
                </div>
            </div>`;
        return;
    }

    openAnamnesisButton.textContent = 'Atualizar anamnese';

    anamnesisSummary.innerHTML = `
        <div class="anamnesis-summary-head">
            <span>Última atualização: <strong>${formatClinicalDateTime(currentAnamnesis.atualizado_em)}</strong></span>
        </div>

        <div class="clinical-summary-grid">
            <div class="clinical-summary-item">
                <div class="clinical-summary-label">Doença/condição relevante ${yesNoBadge(currentAnamnesis.possui_doencas)}</div>
                <p>${currentAnamnesis.possui_doencas ? detailOrEmpty(currentAnamnesis.doencas_detalhes) : 'Paciente não relatou condição neste campo.'}</p>
            </div>

            <div class="clinical-summary-item">
                <div class="clinical-summary-label">Uso de medicamentos ${yesNoBadge(currentAnamnesis.usa_medicamentos)}</div>
                <p>${currentAnamnesis.usa_medicamentos ? detailOrEmpty(currentAnamnesis.medicamentos_detalhes) : 'Paciente não relatou uso neste campo.'}</p>
            </div>

            <div class="clinical-summary-item">
                <div class="clinical-summary-label">Alergias ${yesNoBadge(currentAnamnesis.possui_alergias)}</div>
                <p>${currentAnamnesis.possui_alergias ? detailOrEmpty(currentAnamnesis.alergias_detalhes) : 'Paciente não relatou alergias neste campo.'}</p>
            </div>

            <div class="clinical-summary-item">
                <div class="clinical-summary-label">Cirurgias / hospitalizações</div>
                <p>${detailOrEmpty(currentAnamnesis.cirurgias_hospitalizacoes)}</p>
            </div>
        </div>

        <div class="clinical-conditions-row">
            <span class="condition-pill ${currentAnamnesis.hipertensao ? 'active' : ''}">Hipertensão: ${currentAnamnesis.hipertensao ? 'Sim' : 'Não'}</span>
            <span class="condition-pill ${currentAnamnesis.diabetes ? 'active' : ''}">Diabetes: ${currentAnamnesis.diabetes ? 'Sim' : 'Não'}</span>
            <span class="condition-pill ${currentAnamnesis.cardiopatia ? 'active' : ''}">Condição cardíaca: ${currentAnamnesis.cardiopatia ? 'Sim' : 'Não'}</span>
        </div>

        <div class="clinical-notes-grid">
            <div>
                <span>Outras condições</span>
                <p>${detailOrEmpty(currentAnamnesis.outras_condicoes)}</p>
            </div>
            <div>
                <span>Observações</span>
                <p>${detailOrEmpty(currentAnamnesis.observacoes)}</p>
            </div>
        </div>`;
}

async function loadAnamnesis() {
    if (!Number.isInteger(patientIdV03) || patientIdV03 <= 0) return;

    const { data, error } = await supabaseClient
        .from('anamneses')
        .select('*')
        .eq('paciente_id', patientIdV03)
        .maybeSingle();

    if (error) {
        console.error('Erro ao carregar anamnese:', error);
        anamnesisSummary.innerHTML = '<div class="profile-empty error-text">Não foi possível carregar a anamnese. Confirme se o SQL da v0.3 foi executado.</div>';
        return;
    }

    currentAnamnesis = data || null;
    renderAnamnesis();
}

function populateAnamnesisForm() {
    const data = currentAnamnesis || {};
    anamnesisFields.hasDiseases.checked = Boolean(data.possui_doencas);
    anamnesisFields.diseasesDetails.value = data.doencas_detalhes || '';
    anamnesisFields.usesMedication.checked = Boolean(data.usa_medicamentos);
    anamnesisFields.medicationDetails.value = data.medicamentos_detalhes || '';
    anamnesisFields.hasAllergies.checked = Boolean(data.possui_alergias);
    anamnesisFields.allergyDetails.value = data.alergias_detalhes || '';
    anamnesisFields.surgeryDetails.value = data.cirurgias_hospitalizacoes || '';
    anamnesisFields.hasHypertension.checked = Boolean(data.hipertensao);
    anamnesisFields.hasDiabetes.checked = Boolean(data.diabetes);
    anamnesisFields.hasHeartCondition.checked = Boolean(data.cardiopatia);
    anamnesisFields.otherConditions.value = data.outras_condicoes || '';
    anamnesisFields.notes.value = data.observacoes || '';
}

function openAnamnesis() {
    populateAnamnesisForm();
    if (typeof anamnesisDialog.showModal === 'function') {
        anamnesisDialog.showModal();
    }
}

function closeAnamnesis() {
    if (anamnesisDialog.open) anamnesisDialog.close();
}

function anamnesisPayload() {
    return {
        paciente_id: patientIdV03,
        possui_doencas: anamnesisFields.hasDiseases.checked,
        doencas_detalhes: anamnesisFields.diseasesDetails.value.trim() || null,
        usa_medicamentos: anamnesisFields.usesMedication.checked,
        medicamentos_detalhes: anamnesisFields.medicationDetails.value.trim() || null,
        possui_alergias: anamnesisFields.hasAllergies.checked,
        alergias_detalhes: anamnesisFields.allergyDetails.value.trim() || null,
        cirurgias_hospitalizacoes: anamnesisFields.surgeryDetails.value.trim() || null,
        hipertensao: anamnesisFields.hasHypertension.checked,
        diabetes: anamnesisFields.hasDiabetes.checked,
        cardiopatia: anamnesisFields.hasHeartCondition.checked,
        outras_condicoes: anamnesisFields.otherConditions.value.trim() || null,
        observacoes: anamnesisFields.notes.value.trim() || null
    };
}

async function saveAnamnesis(event) {
    event.preventDefault();
    saveAnamnesisButton.disabled = true;
    saveAnamnesisButton.textContent = 'Salvando...';

    const payload = anamnesisPayload();
    let response;

    if (currentAnamnesis?.id) {
        response = await supabaseClient
            .from('anamneses')
            .update(payload)
            .eq('id', currentAnamnesis.id)
            .select()
            .single();
    } else {
        response = await supabaseClient
            .from('anamneses')
            .insert(payload)
            .select()
            .single();
    }

    saveAnamnesisButton.disabled = false;
    saveAnamnesisButton.textContent = 'Salvar anamnese';

    if (response.error) {
        console.error('Erro ao salvar anamnese:', response.error);
        showClinicalProfileMessage('Não foi possível salvar a anamnese. Confirme se a migração v0.3 foi executada.', 'error');
        return;
    }

    currentAnamnesis = response.data;
    renderAnamnesis();
    closeAnamnesis();
    showClinicalProfileMessage('Anamnese salva com sucesso.');
}

function renderTreatmentHistory() {
    treatmentVersionCount.textContent = `${treatmentVersions.length} ${treatmentVersions.length === 1 ? 'versão' : 'versões'}`;

    if (!treatmentVersions.length) {
        treatmentHistory.innerHTML = '<div class="profile-empty">Nenhum plano de tratamento registrado.</div>';
        treatmentLastSaved.textContent = 'Nenhum plano salvo';
        return;
    }

    const latest = treatmentVersions[0];
    treatmentLastSaved.textContent = `Última versão: ${formatClinicalDateTime(latest.criado_em)}`;

    treatmentHistory.innerHTML = treatmentVersions.map((version, index) => `
        <details class="treatment-version" ${index === 0 ? 'open' : ''}>
            <summary>
                <div>
                    <strong>${index === 0 ? 'Plano atual' : `Versão anterior ${treatmentVersions.length - index}`}</strong>
                    <span>${formatClinicalDateTime(version.criado_em)}</span>
                </div>
                ${index === 0 ? '<span class="current-version-badge">Atual</span>' : ''}
            </summary>
            <div class="treatment-version-content">${escapeClinical(version.conteudo)}</div>
        </details>
    `).join('');
}

async function loadTreatmentPlans() {
    if (!Number.isInteger(patientIdV03) || patientIdV03 <= 0) return;

    const { data, error } = await supabaseClient
        .from('planos_tratamento')
        .select('id, paciente_id, conteudo, criado_em')
        .eq('paciente_id', patientIdV03)
        .order('criado_em', { ascending: false });

    if (error) {
        console.error('Erro ao carregar planos de tratamento:', error);
        treatmentHistory.innerHTML = '<div class="profile-empty error-text">Não foi possível carregar os planos. Confirme se o SQL da v0.3 foi executado.</div>';
        return;
    }

    treatmentVersions = data || [];
    if (treatmentVersions.length) {
        treatmentPlanText.value = treatmentVersions[0].conteudo || '';
    }
    updateTreatmentCharCount();
    renderTreatmentHistory();
}

function updateTreatmentCharCount() {
    treatmentCharCount.textContent = `${treatmentPlanText.value.length} / 30000`;
}

async function saveTreatmentPlan() {
    const content = treatmentPlanText.value.trim();

    if (!content) {
        showTreatmentMessage('Escreva o plano de tratamento antes de salvar.', 'error');
        treatmentPlanText.focus();
        return;
    }

    if (treatmentVersions[0]?.conteudo?.trim() === content) {
        showTreatmentMessage('O plano não possui alterações em relação à versão atual.', 'error');
        return;
    }

    saveTreatmentPlanButton.disabled = true;
    saveTreatmentPlanButton.textContent = 'Salvando...';

    const { data, error } = await supabaseClient
        .from('planos_tratamento')
        .insert({
            paciente_id: patientIdV03,
            conteudo: content
        })
        .select()
        .single();

    saveTreatmentPlanButton.disabled = false;
    saveTreatmentPlanButton.textContent = 'Salvar nova versão';

    if (error) {
        console.error('Erro ao salvar plano de tratamento:', error);
        showTreatmentMessage('Não foi possível salvar o plano de tratamento.', 'error');
        return;
    }

    treatmentVersions.unshift(data);
    renderTreatmentHistory();
    showTreatmentMessage('Nova versão do plano de tratamento salva com sucesso.');
}

openAnamnesisButton.addEventListener('click', openAnamnesis);
closeAnamnesisButton.addEventListener('click', closeAnamnesis);
cancelAnamnesisButton.addEventListener('click', closeAnamnesis);
anamnesisForm.addEventListener('submit', saveAnamnesis);
anamnesisDialog.addEventListener('cancel', () => {});

treatmentPlanText.addEventListener('input', updateTreatmentCharCount);
saveTreatmentPlanButton.addEventListener('click', saveTreatmentPlan);

async function initClinicalV03() {
    if (!Number.isInteger(patientIdV03) || patientIdV03 <= 0) return;

    await Promise.all([
        loadAnamnesis(),
        loadTreatmentPlans()
    ]);
}

initClinicalV03();
