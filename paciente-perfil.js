const STORAGE_BUCKET = 'paciente-arquivos';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const params = new URLSearchParams(window.location.search);
const patientId = Number(params.get('id'));

const profileMessage = document.getElementById('profileMessage');
const patientName = document.getElementById('patientName');
const patientInitials = document.getElementById('patientInitials');
const patientSummary = document.getElementById('patientSummary');
const appointmentBody = document.getElementById('profileAppointmentBody');
const appointmentCount = document.getElementById('profileAppointmentCount');
const profileFilesList = document.getElementById('profileFilesList');
const profileFileCount = document.getElementById('profileFileCount');
const profileUploadZone = document.getElementById('profileUploadZone');
const profileFilesInput = document.getElementById('profileFiles');
const profilePendingFiles = document.getElementById('profilePendingFiles');
const uploadSelectedButton = document.getElementById('uploadSelectedButton');
const deleteFileDialog = document.getElementById('deleteFileDialog');
const deleteFileName = document.getElementById('deleteFileName');
const confirmDeleteFileButton = document.getElementById('confirmDeleteFileButton');
const cancelDeleteFileButton = document.getElementById('cancelDeleteFileButton');

let currentPatient = null;
let patientFiles = [];
let pendingFiles = [];
let pendingDeleteFileId = null;

function onlyDigits(value = '') {
    return String(value).replace(/\D/g, '');
}

function formatCPF(value = '') {
    const digits = onlyDigits(value).slice(0, 11);
    return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value = '') {
    const digits = onlyDigits(value).slice(0, 11);
    if (!digits) return '—';

    if (digits.length <= 10) {
        return digits
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2');
    }

    return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
}

function formatDate(value) {
    if (!value) return '—';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
}

function formatFileSize(bytes = 0) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
}

function escapeHTML(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showProfileMessage(text, type = 'success') {
    profileMessage.textContent = text;
    profileMessage.className = `form-message show ${type}`;
    window.clearTimeout(showProfileMessage.timeoutId);
    showProfileMessage.timeoutId = window.setTimeout(() => {
        profileMessage.className = 'form-message';
        profileMessage.textContent = '';
    }, 5500);
}

function getInitials(name = '') {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '--';
    return `${parts[0][0] || ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
}

function getStatusClass(status = '') {
    const classes = {
        'Agendada': 'status-scheduled',
        'Confirmada': 'status-confirmed',
        'Aguardando confirmação': 'status-waiting',
        'Finalizada': 'status-finished',
        'Cancelada': 'status-cancelled'
    };
    return classes[status] || 'status-scheduled';
}

function renderPatient(patient) {
    patientName.textContent = patient.nome;
    patientInitials.textContent = getInitials(patient.nome);
    document.title = `${patient.nome} | Art Dental`;

    const summary = [];
    if (patient.cpf) summary.push(`<span>CPF ${formatCPF(patient.cpf)}</span>`);
    summary.push(`<span>${formatPhone(patient.telefone)}</span>`);
    if (patient.email) summary.push(`<span>${escapeHTML(patient.email)}</span>`);
    patientSummary.innerHTML = summary.join('');

    document.getElementById('detailName').textContent = patient.nome || '—';
    document.getElementById('detailCpf').textContent = patient.cpf ? formatCPF(patient.cpf) : '—';
    document.getElementById('detailBirth').textContent = formatDate(patient.nascimento);
    document.getElementById('detailPhone').textContent = formatPhone(patient.telefone);
    document.getElementById('detailEmail').textContent = patient.email || '—';
    document.getElementById('detailAddress').textContent = patient.endereco || '—';
    document.getElementById('detailEmergencyName').textContent = patient.contato_emergencia_nome || '—';
    document.getElementById('detailEmergencyPhone').textContent = formatPhone(patient.contato_emergencia_telefone);

    const editLink = document.querySelector('.profile-hero-actions .btn-secondary');
    if (editLink) editLink.href = `cadastros.html?edit=${encodeURIComponent(patient.id)}`;
}

async function loadPatient() {
    if (!Number.isInteger(patientId) || patientId <= 0) {
        showProfileMessage('Paciente inválido. Volte à lista e selecione um cadastro.', 'error');
        patientName.textContent = 'Paciente não encontrado';
        return false;
    }

    const { data, error } = await supabaseClient
        .from('pacientes')
        .select('id, nome, cpf, nascimento, telefone, email, endereco, contato_emergencia_nome, contato_emergencia_telefone, criado_em, atualizado_em')
        .eq('id', patientId)
        .single();

    if (error || !data) {
        console.error('Erro ao carregar paciente:', error);
        showProfileMessage('Não foi possível carregar este paciente. Confirme se o SQL da v0.2 foi executado.', 'error');
        patientName.textContent = 'Paciente não encontrado';
        return false;
    }

    currentPatient = data;
    renderPatient(data);
    return true;
}

async function loadAppointments() {
    const { data, error } = await supabaseClient
        .from('consultas')
        .select('id, data_consulta, hora_consulta, tipo, profissional, status, observacoes')
        .eq('paciente_id', patientId)
        .order('data_consulta', { ascending: false })
        .order('hora_consulta', { ascending: false });

    if (error) {
        console.error('Erro ao carregar consultas:', error);
        appointmentBody.innerHTML = '<tr><td colspan="5" class="loading-cell error-text">Não foi possível carregar as consultas.</td></tr>';
        return;
    }

    const appointments = data || [];
    appointmentCount.textContent = `${appointments.length} ${appointments.length === 1 ? 'consulta' : 'consultas'}`;

    if (!appointments.length) {
        appointmentBody.innerHTML = '<tr><td colspan="5"><div class="profile-empty">Nenhuma consulta vinculada a este paciente.</div></td></tr>';
        return;
    }

    appointmentBody.innerHTML = appointments.map((appointment) => `
        <tr>
            <td><span class="table-name">${formatDate(appointment.data_consulta)}</span></td>
            <td>${escapeHTML((appointment.hora_consulta || '').slice(0, 5))}</td>
            <td>${escapeHTML(appointment.tipo || 'Consulta')}</td>
            <td>${escapeHTML(appointment.profissional || '—')}</td>
            <td><span class="appointment-status ${getStatusClass(appointment.status)}">${escapeHTML(appointment.status || 'Agendada')}</span></td>
        </tr>
    `).join('');
}

function fileTypeLabel(type = '') {
    if (type === 'application/pdf') return 'PDF';
    if (type.startsWith('image/')) return 'IMG';
    return 'ARQ';
}

async function loadFiles() {
    const { data, error } = await supabaseClient
        .from('paciente_arquivos')
        .select('id, paciente_id, nome_arquivo, caminho_storage, tipo_arquivo, tamanho_bytes, criado_em')
        .eq('paciente_id', patientId)
        .order('criado_em', { ascending: false });

    if (error) {
        console.error('Erro ao carregar arquivos:', error);
        profileFilesList.innerHTML = '<div class="profile-empty error-text">Não foi possível carregar os arquivos.</div>';
        return;
    }

    patientFiles = data || [];
    renderFiles();
}

function renderFiles() {
    profileFileCount.textContent = `${patientFiles.length} ${patientFiles.length === 1 ? 'arquivo' : 'arquivos'}`;

    if (!patientFiles.length) {
        profileFilesList.innerHTML = '<div class="profile-empty">Nenhum arquivo enviado para este paciente.</div>';
        return;
    }

    profileFilesList.innerHTML = patientFiles.map((file) => `
        <div class="profile-file-item">
            <div class="profile-file-icon">${fileTypeLabel(file.tipo_arquivo)}</div>
            <div class="profile-file-info">
                <strong title="${escapeHTML(file.nome_arquivo)}">${escapeHTML(file.nome_arquivo)}</strong>
                <span>${formatFileSize(file.tamanho_bytes || 0)} · ${formatDateTime(file.criado_em)}</span>
            </div>
            <div class="profile-file-actions">
                <button type="button" class="table-action-button primary" data-file-action="open" data-file-id="${file.id}">Abrir</button>
                <button type="button" class="table-action-button danger" data-file-action="delete" data-file-id="${file.id}">Excluir</button>
            </div>
        </div>
    `).join('');
}

function sanitizeFileName(name = 'arquivo') {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .slice(-120);
}

function validateFile(file) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Formato não permitido. Use JPG, PNG, WEBP ou PDF.';
    if (file.size > MAX_FILE_SIZE) return `${file.name} ultrapassa o limite de 10 MB.`;
    return null;
}

function addPendingFiles(fileList) {
    Array.from(fileList).forEach((file) => {
        const error = validateFile(file);
        if (error) {
            showProfileMessage(error, 'error');
            return;
        }

        const duplicate = pendingFiles.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!duplicate) pendingFiles.push(file);
    });

    profileFilesInput.value = '';
    renderPendingFiles();
}

function renderPendingFiles() {
    uploadSelectedButton.disabled = !pendingFiles.length;

    if (!pendingFiles.length) {
        profilePendingFiles.innerHTML = '';
        return;
    }

    profilePendingFiles.innerHTML = pendingFiles.map((file, index) => `
        <div class="pending-file-item">
            <div class="pending-file-icon">${fileTypeLabel(file.type)}</div>
            <div class="pending-file-info"><strong>${escapeHTML(file.name)}</strong><span>${formatFileSize(file.size)}</span></div>
            <button type="button" class="pending-file-remove" data-pending-index="${index}" aria-label="Remover arquivo">×</button>
        </div>
    `).join('');
}

async function uploadOneFile(file) {
    const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const path = `${patientId}/${uniquePart}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
        });

    if (uploadError) throw uploadError;

    const { error: metadataError } = await supabaseClient
        .from('paciente_arquivos')
        .insert({
            paciente_id: patientId,
            nome_arquivo: file.name,
            caminho_storage: path,
            tipo_arquivo: file.type,
            tamanho_bytes: file.size
        });

    if (metadataError) {
        await supabaseClient.storage.from(STORAGE_BUCKET).remove([path]);
        throw metadataError;
    }
}

async function uploadSelectedFiles() {
    if (!pendingFiles.length) return;

    uploadSelectedButton.disabled = true;
    uploadSelectedButton.textContent = 'Enviando...';

    let uploaded = 0;
    let failed = 0;

    for (const file of pendingFiles) {
        try {
            await uploadOneFile(file);
            uploaded += 1;
        } catch (error) {
            failed += 1;
            console.error(`Erro ao enviar ${file.name}:`, error);
        }
    }

    pendingFiles = [];
    renderPendingFiles();
    uploadSelectedButton.textContent = 'Enviar arquivos selecionados';

    await loadFiles();

    if (failed) {
        showProfileMessage(`${uploaded} arquivo(s) enviado(s), mas ${failed} falharam.`, 'error');
    } else {
        showProfileMessage(`${uploaded} arquivo(s) enviado(s) com sucesso.`);
    }
}

async function openFile(id) {
    const file = patientFiles.find((item) => String(item.id) === String(id));
    if (!file) return;

    const newTab = window.open('about:blank', '_blank');

    const { data, error } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(file.caminho_storage, 120);

    if (error || !data?.signedUrl) {
        if (newTab) newTab.close();
        console.error('Erro ao criar link temporário:', error);
        showProfileMessage('Não foi possível abrir o arquivo.', 'error');
        return;
    }

    if (newTab) {
        newTab.location.href = data.signedUrl;
    } else {
        window.location.href = data.signedUrl;
    }
}

function askDeleteFile(id) {
    const file = patientFiles.find((item) => String(item.id) === String(id));
    if (!file) return;

    pendingDeleteFileId = file.id;
    deleteFileName.textContent = file.nome_arquivo;
    deleteFileDialog.showModal();
}

async function deleteFile() {
    const file = patientFiles.find((item) => String(item.id) === String(pendingDeleteFileId));
    if (!file) return;

    confirmDeleteFileButton.disabled = true;
    confirmDeleteFileButton.textContent = 'Excluindo...';

    const { error: metadataError } = await supabaseClient
        .from('paciente_arquivos')
        .delete()
        .eq('id', file.id);

    if (metadataError) {
        confirmDeleteFileButton.disabled = false;
        confirmDeleteFileButton.textContent = 'Excluir arquivo';
        console.error('Erro ao excluir metadados:', metadataError);
        showProfileMessage('Não foi possível excluir o arquivo.', 'error');
        return;
    }

    const { error: storageError } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .remove([file.caminho_storage]);

    if (storageError) console.error('Arquivo removido do prontuário, mas houve falha na limpeza do Storage:', storageError);

    pendingDeleteFileId = null;
    confirmDeleteFileButton.disabled = false;
    confirmDeleteFileButton.textContent = 'Excluir arquivo';
    deleteFileDialog.close();
    showProfileMessage('Arquivo excluído do prontuário.');
    await loadFiles();
}

function setupTabs() {
    document.querySelectorAll('.patient-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.patient-tab').forEach((item) => item.classList.remove('active'));
            document.querySelectorAll('.profile-tab-panel').forEach((panel) => panel.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`[data-panel="${tab.dataset.tab}"]`)?.classList.add('active');
        });
    });
}

function setupUploads() {
    profileUploadZone.addEventListener('click', () => profileFilesInput.click());
    profileUploadZone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            profileFilesInput.click();
        }
    });
    profileFilesInput.addEventListener('change', () => addPendingFiles(profileFilesInput.files));
    profileUploadZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        profileUploadZone.classList.add('is-dragging');
    });
    profileUploadZone.addEventListener('dragleave', () => profileUploadZone.classList.remove('is-dragging'));
    profileUploadZone.addEventListener('drop', (event) => {
        event.preventDefault();
        profileUploadZone.classList.remove('is-dragging');
        addPendingFiles(event.dataTransfer.files);
    });

    profilePendingFiles.addEventListener('click', (event) => {
        const button = event.target.closest('[data-pending-index]');
        if (!button) return;
        pendingFiles.splice(Number(button.dataset.pendingIndex), 1);
        renderPendingFiles();
    });

    uploadSelectedButton.addEventListener('click', uploadSelectedFiles);
}

profileFilesList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-file-action]');
    if (!button) return;
    if (button.dataset.fileAction === 'open') openFile(button.dataset.fileId);
    if (button.dataset.fileAction === 'delete') askDeleteFile(button.dataset.fileId);
});

confirmDeleteFileButton.addEventListener('click', deleteFile);
cancelDeleteFileButton.addEventListener('click', () => {
    pendingDeleteFileId = null;
    deleteFileDialog.close();
});
deleteFileDialog.addEventListener('cancel', () => {
    pendingDeleteFileId = null;
});

async function initProfile() {
    setupTabs();
    setupUploads();

    const loaded = await loadPatient();
    if (!loaded) return;

    await Promise.all([
        loadAppointments(),
        loadFiles()
    ]);
}

initProfile();
