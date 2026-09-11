const patientForm = document.getElementById('patientForm');
const patientTableBody = document.getElementById('patientTableBody');
const patientSearch = document.getElementById('patientSearch');
const patientMessage = document.getElementById('patientMessage');
const patientFormTitle = document.getElementById('patientFormTitle');
const patientFormDescription = document.getElementById('patientFormDescription');
const patientSubmitButton = document.getElementById('patientSubmitButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const clearPatientButton = document.getElementById('clearPatientButton');
const patientCount = document.getElementById('patientCount');
const deleteDialog = document.getElementById('deleteDialog');
const deletePatientName = document.getElementById('deletePatientName');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');
const cancelDeleteButton = document.getElementById('cancelDeleteButton');
const patientUploadZone = document.getElementById('patientUploadZone');
const patientFilesInput = document.getElementById('patientFiles');
const pendingFilesContainer = document.getElementById('pendingFiles');

const STORAGE_BUCKET = 'paciente-arquivos';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const fields = {
    nome: document.getElementById('nome'),
    cpf: document.getElementById('cpf'),
    nascimento: document.getElementById('nascimento'),
    telefone: document.getElementById('telefone'),
    email: document.getElementById('emailPaciente'),
    endereco: document.getElementById('endereco'),
    contatoEmergenciaNome: document.getElementById('contatoEmergenciaNome'),
    contatoEmergenciaTelefone: document.getElementById('contatoEmergenciaTelefone')
};

let pacientes = [];
let editingId = null;
let pendingDeleteId = null;
let pendingFiles = [];

function onlyDigits(value = '') {
    return value.replace(/\D/g, '');
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

function escapeHTML(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showMessage(text, type = 'success') {
    patientMessage.textContent = text;
    patientMessage.className = `form-message show ${type}`;

    window.clearTimeout(showMessage.timeoutId);
    showMessage.timeoutId = window.setTimeout(() => {
        patientMessage.className = 'form-message';
        patientMessage.textContent = '';
    }, 5500);
}

function setLoading(isLoading) {
    patientSubmitButton.disabled = isLoading;
    patientSubmitButton.classList.toggle('is-loading', isLoading);
    cancelEditButton.disabled = isLoading;
    clearPatientButton.disabled = isLoading;
}

function resetPendingFiles() {
    pendingFiles = [];
    patientFilesInput.value = '';
    renderPendingFiles();
}

function resetFormMode() {
    editingId = null;
    patientForm.reset();
    resetPendingFiles();
    patientFormTitle.textContent = 'Novo paciente';
    patientFormDescription.textContent = 'Preencha os dados principais para criar um novo cadastro.';
    patientSubmitButton.querySelector('.button-text').textContent = 'Salvar paciente';
    cancelEditButton.hidden = true;
}

function getPayload() {
    const cpf = onlyDigits(fields.cpf.value);
    const telefone = onlyDigits(fields.telefone.value);
    const contatoTelefone = onlyDigits(fields.contatoEmergenciaTelefone.value);
    const email = fields.email.value.trim().toLowerCase();

    if (fields.nome.value.trim().length < 2) {
        throw new Error('Informe o nome completo do paciente.');
    }

    if (telefone.length < 10 || telefone.length > 11) {
        throw new Error('Informe um telefone válido com DDD.');
    }

    if (cpf && cpf.length !== 11) {
        throw new Error('O CPF deve ter 11 números.');
    }

    if (contatoTelefone && (contatoTelefone.length < 10 || contatoTelefone.length > 11)) {
        throw new Error('Informe um telefone de emergência válido com DDD.');
    }

    return {
        nome: fields.nome.value.trim(),
        cpf: cpf || null,
        nascimento: fields.nascimento.value || null,
        telefone,
        email: email || null,
        endereco: fields.endereco.value.trim() || null,
        contato_emergencia_nome: fields.contatoEmergenciaNome.value.trim() || null,
        contato_emergencia_telefone: contatoTelefone || null
    };
}

function renderPacientes(lista = pacientes) {
    patientCount.textContent = `${lista.length} ${lista.length === 1 ? 'paciente' : 'pacientes'}`;

    if (!lista.length) {
        patientTableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state compact-empty-state">
                        <div class="empty-state-icon">♙</div>
                        <h3>Nenhum paciente encontrado</h3>
                        <p>Cadastre um novo paciente ou altere os termos da busca.</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    patientTableBody.innerHTML = lista.map((paciente) => {
        const emergency = paciente.contato_emergencia_nome || paciente.contato_emergencia_telefone
            ? `${paciente.contato_emergencia_nome ? `<span class="table-name">${escapeHTML(paciente.contato_emergencia_nome)}</span>` : ''}
               <small class="table-subtext">${paciente.contato_emergencia_telefone ? formatPhone(paciente.contato_emergencia_telefone) : 'Telefone não informado'}</small>`
            : '<span class="text-muted">—</span>';

        return `
        <tr>
            <td>
                <span class="table-name">${escapeHTML(paciente.nome)}</span>
                <small class="table-subtext">${paciente.nascimento ? `Nascimento: ${formatDate(paciente.nascimento)}` : 'Nascimento não informado'}</small>
            </td>
            <td>${paciente.cpf ? formatCPF(paciente.cpf) : '—'}</td>
            <td>${formatPhone(paciente.telefone)}</td>
            <td class="text-muted">${paciente.email ? escapeHTML(paciente.email) : '—'}</td>
            <td>${emergency}</td>
            <td>
                <div class="row-actions">
                    <button class="table-action-button primary" type="button" data-action="profile" data-id="${paciente.id}">Perfil</button>
                    <button class="table-action-button" type="button" data-action="edit" data-id="${paciente.id}">Editar</button>
                    <button class="table-action-button danger" type="button" data-action="delete" data-id="${paciente.id}">Excluir</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function carregarPacientes() {
    patientTableBody.innerHTML = '<tr><td colspan="6" class="loading-cell">Carregando pacientes...</td></tr>';

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await supabaseClient
        .from('pacientes')
        .select('id, nome, cpf, nascimento, telefone, email, endereco, contato_emergencia_nome, contato_emergencia_telefone, criado_em, atualizado_em')
        .order('nome', { ascending: true });

    if (error) {
        console.error('Erro ao carregar pacientes:', error);
        patientTableBody.innerHTML = '<tr><td colspan="6" class="loading-cell error-text">Não foi possível carregar os pacientes.</td></tr>';
        showMessage('Não foi possível acessar os pacientes. Confirme se o SQL da v0.2 foi executado no Supabase.', 'error');
        return;
    }

    pacientes = data || [];
    aplicarBusca();
}

function aplicarBusca() {
    const term = patientSearch.value.trim().toLowerCase();

    if (!term) {
        renderPacientes(pacientes);
        return;
    }

    const digits = onlyDigits(term);
    const filtered = pacientes.filter((paciente) => {
        const nome = (paciente.nome || '').toLowerCase();
        const email = (paciente.email || '').toLowerCase();
        const endereco = (paciente.endereco || '').toLowerCase();
        const emergencyName = (paciente.contato_emergencia_nome || '').toLowerCase();
        const cpf = paciente.cpf || '';
        const telefone = paciente.telefone || '';
        const emergencyPhone = paciente.contato_emergencia_telefone || '';

        return nome.includes(term)
            || email.includes(term)
            || endereco.includes(term)
            || emergencyName.includes(term)
            || (digits && cpf.includes(digits))
            || (digits && telefone.includes(digits))
            || (digits && emergencyPhone.includes(digits));
    });

    renderPacientes(filtered);
}

function editarPaciente(id) {
    const paciente = pacientes.find((item) => String(item.id) === String(id));
    if (!paciente) return;

    editingId = paciente.id;
    fields.nome.value = paciente.nome || '';
    fields.cpf.value = formatCPF(paciente.cpf || '');
    fields.nascimento.value = paciente.nascimento || '';
    fields.telefone.value = formatPhone(paciente.telefone || '');
    fields.email.value = paciente.email || '';
    fields.endereco.value = paciente.endereco || '';
    fields.contatoEmergenciaNome.value = paciente.contato_emergencia_nome || '';
    fields.contatoEmergenciaTelefone.value = formatPhone(paciente.contato_emergencia_telefone || '');
    resetPendingFiles();

    patientFormTitle.textContent = 'Editar paciente';
    patientFormDescription.textContent = 'Atualize os dados e, se desejar, adicione novos arquivos ao prontuário.';
    patientSubmitButton.querySelector('.button-text').textContent = 'Salvar alterações';
    cancelEditButton.hidden = false;

    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    fields.nome.focus({ preventScroll: true });
}

function abrirConfirmacaoExclusao(id) {
    const paciente = pacientes.find((item) => String(item.id) === String(id));
    if (!paciente) return;

    pendingDeleteId = paciente.id;
    deletePatientName.textContent = paciente.nome;

    if (typeof deleteDialog.showModal === 'function') {
        deleteDialog.showModal();
    }
}

async function excluirPaciente() {
    if (!pendingDeleteId) return;

    confirmDeleteButton.disabled = true;
    confirmDeleteButton.textContent = 'Excluindo...';

    const { error } = await supabaseClient
        .from('pacientes')
        .delete()
        .eq('id', pendingDeleteId);

    confirmDeleteButton.disabled = false;
    confirmDeleteButton.textContent = 'Excluir paciente';

    if (error) {
        console.error('Erro ao excluir paciente:', error);
        if (error.code === '23503') {
            showMessage('Este paciente possui consultas vinculadas e não pode ser excluído. Preserve o histórico clínico.', 'error');
        } else {
            showMessage('Não foi possível excluir o paciente.', 'error');
        }
        return;
    }

    if (String(editingId) === String(pendingDeleteId)) {
        resetFormMode();
    }

    pendingDeleteId = null;
    deleteDialog.close();
    showMessage('Paciente excluído com sucesso.');
    await carregarPacientes();
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
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return 'Formato não permitido. Use JPG, PNG, WEBP ou PDF.';
    }
    if (file.size > MAX_FILE_SIZE) {
        return `${file.name} ultrapassa o limite de 10 MB.`;
    }
    return null;
}

function addFiles(fileList) {
    Array.from(fileList).forEach((file) => {
        const validationError = validateFile(file);
        if (validationError) {
            showMessage(validationError, 'error');
            return;
        }

        const duplicate = pendingFiles.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!duplicate) pendingFiles.push(file);
    });

    patientFilesInput.value = '';
    renderPendingFiles();
}

function renderPendingFiles() {
    if (!pendingFiles.length) {
        pendingFilesContainer.innerHTML = '';
        return;
    }

    pendingFilesContainer.innerHTML = pendingFiles.map((file, index) => `
        <div class="pending-file-item">
            <div class="pending-file-icon">${file.type === 'application/pdf' ? 'PDF' : 'IMG'}</div>
            <div class="pending-file-info">
                <strong>${escapeHTML(file.name)}</strong>
                <span>${formatFileSize(file.size)}</span>
            </div>
            <button type="button" class="pending-file-remove" data-file-index="${index}" aria-label="Remover ${escapeHTML(file.name)}">×</button>
        </div>
    `).join('');
}

async function uploadFile(patientId, file) {
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

async function uploadPendingFiles(patientId) {
    if (!pendingFiles.length) return { uploaded: 0, failed: 0 };

    let uploaded = 0;
    let failed = 0;

    for (const file of pendingFiles) {
        try {
            await uploadFile(patientId, file);
            uploaded += 1;
        } catch (error) {
            failed += 1;
            console.error(`Erro ao enviar ${file.name}:`, error);
        }
    }

    return { uploaded, failed };
}

patientForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    let payload;
    try {
        payload = getPayload();
    } catch (error) {
        showMessage(error.message, 'error');
        return;
    }

    setLoading(true);
    const wasEditing = Boolean(editingId);

    let response;
    if (editingId) {
        response = await supabaseClient
            .from('pacientes')
            .update(payload)
            .eq('id', editingId)
            .select()
            .single();
    } else {
        response = await supabaseClient
            .from('pacientes')
            .insert(payload)
            .select()
            .single();
    }

    if (response.error) {
        setLoading(false);
        console.error('Erro ao salvar paciente:', response.error);

        if (response.error.code === '23505') {
            showMessage('Já existe um paciente cadastrado com este CPF.', 'error');
        } else {
            showMessage('Não foi possível salvar o paciente. Verifique os dados e tente novamente.', 'error');
        }
        return;
    }

    const fileResult = await uploadPendingFiles(response.data.id);
    setLoading(false);

    if (fileResult.failed > 0) {
        showMessage(`Paciente salvo, mas ${fileResult.failed} arquivo(s) não puderam ser enviados. Você pode tentar novamente pelo perfil do paciente.`, 'error');
    } else if (fileResult.uploaded > 0) {
        showMessage(`${wasEditing ? 'Paciente atualizado' : 'Paciente cadastrado'} com sucesso e ${fileResult.uploaded} arquivo(s) enviado(s).`);
    } else {
        showMessage(wasEditing ? 'Paciente atualizado com sucesso.' : 'Paciente cadastrado com sucesso.');
    }

    resetFormMode();
    await carregarPacientes();
});

patientTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const { action, id } = button.dataset;

    if (action === 'profile') window.location.href = `perfil-paciente.html?id=${encodeURIComponent(id)}`;
    if (action === 'edit') editarPaciente(id);
    if (action === 'delete') abrirConfirmacaoExclusao(id);
});

patientSearch.addEventListener('input', aplicarBusca);
cancelEditButton.addEventListener('click', resetFormMode);
clearPatientButton.addEventListener('click', () => setTimeout(resetFormMode, 0));

fields.cpf.addEventListener('input', () => {
    fields.cpf.value = formatCPF(fields.cpf.value);
});

fields.telefone.addEventListener('input', () => {
    fields.telefone.value = formatPhone(fields.telefone.value);
});

fields.contatoEmergenciaTelefone.addEventListener('input', () => {
    fields.contatoEmergenciaTelefone.value = formatPhone(fields.contatoEmergenciaTelefone.value);
});

patientUploadZone.addEventListener('click', () => patientFilesInput.click());
patientUploadZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        patientFilesInput.click();
    }
});
patientFilesInput.addEventListener('change', () => addFiles(patientFilesInput.files));
patientUploadZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    patientUploadZone.classList.add('is-dragging');
});
patientUploadZone.addEventListener('dragleave', () => patientUploadZone.classList.remove('is-dragging'));
patientUploadZone.addEventListener('drop', (event) => {
    event.preventDefault();
    patientUploadZone.classList.remove('is-dragging');
    addFiles(event.dataTransfer.files);
});

pendingFilesContainer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-file-index]');
    if (!button) return;
    pendingFiles.splice(Number(button.dataset.fileIndex), 1);
    renderPendingFiles();
});

confirmDeleteButton.addEventListener('click', excluirPaciente);
cancelDeleteButton.addEventListener('click', () => {
    pendingDeleteId = null;
    deleteDialog.close();
});

deleteDialog.addEventListener('cancel', () => {
    pendingDeleteId = null;
});

carregarPacientes();
