const patientForm = document.getElementById('patientForm');
const patientTableBody = document.getElementById('patientTableBody');
const patientSearch = document.getElementById('patientSearch');
const patientMessage = document.getElementById('patientMessage');
const patientFormTitle = document.getElementById('patientFormTitle');
const patientFormDescription = document.getElementById('patientFormDescription');
const patientSubmitButton = document.getElementById('patientSubmitButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const patientCount = document.getElementById('patientCount');
const deleteDialog = document.getElementById('deleteDialog');
const deletePatientName = document.getElementById('deletePatientName');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');
const cancelDeleteButton = document.getElementById('cancelDeleteButton');

const fields = {
    nome: document.getElementById('nome'),
    cpf: document.getElementById('cpf'),
    nascimento: document.getElementById('nascimento'),
    telefone: document.getElementById('telefone'),
    email: document.getElementById('emailPaciente'),
    endereco: document.getElementById('endereco')
};

let pacientes = [];
let editingId = null;
let pendingDeleteId = null;

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
    }, 4500);
}

function setLoading(isLoading) {
    patientSubmitButton.disabled = isLoading;
    patientSubmitButton.classList.toggle('is-loading', isLoading);
}

function resetFormMode() {
    editingId = null;
    patientForm.reset();
    patientFormTitle.textContent = 'Novo paciente';
    patientFormDescription.textContent = 'Preencha os dados principais para criar um novo cadastro.';
    patientSubmitButton.querySelector('.button-text').textContent = 'Salvar paciente';
    cancelEditButton.hidden = true;
}

function getPayload() {
    const cpf = onlyDigits(fields.cpf.value);
    const telefone = onlyDigits(fields.telefone.value);
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

    return {
        nome: fields.nome.value.trim(),
        cpf: cpf || null,
        nascimento: fields.nascimento.value || null,
        telefone,
        email: email || null,
        endereco: fields.endereco.value.trim() || null
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

    patientTableBody.innerHTML = lista.map((paciente) => `
        <tr>
            <td>
                <span class="table-name">${escapeHTML(paciente.nome)}</span>
                <small class="table-subtext">${paciente.nascimento ? `Nascimento: ${formatDate(paciente.nascimento)}` : 'Nascimento não informado'}</small>
            </td>
            <td>${paciente.cpf ? formatCPF(paciente.cpf) : '—'}</td>
            <td>${formatPhone(paciente.telefone)}</td>
            <td class="text-muted">${paciente.email ? escapeHTML(paciente.email) : '—'}</td>
            <td class="text-muted">${paciente.endereco ? escapeHTML(paciente.endereco) : '—'}</td>
            <td>
                <div class="row-actions">
                    <button class="table-action-button" type="button" data-action="edit" data-id="${paciente.id}">Editar</button>
                    <button class="table-action-button danger" type="button" data-action="delete" data-id="${paciente.id}">Excluir</button>
                </div>
            </td>
        </tr>`).join('');
}

async function carregarPacientes() {
    patientTableBody.innerHTML = '<tr><td colspan="6" class="loading-cell">Carregando pacientes...</td></tr>';

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await supabaseClient
        .from('pacientes')
        .select('id, nome, cpf, nascimento, telefone, email, endereco, criado_em, atualizado_em')
        .order('nome', { ascending: true });

    if (error) {
        console.error('Erro ao carregar pacientes:', error);
        patientTableBody.innerHTML = '<tr><td colspan="6" class="loading-cell error-text">Não foi possível carregar os pacientes.</td></tr>';
        showMessage('Não foi possível acessar a tabela de pacientes. Confirme se o SQL foi executado no Supabase.', 'error');
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
        const cpf = paciente.cpf || '';
        const telefone = paciente.telefone || '';

        return nome.includes(term)
            || email.includes(term)
            || endereco.includes(term)
            || (digits && cpf.includes(digits))
            || (digits && telefone.includes(digits));
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

    patientFormTitle.textContent = 'Editar paciente';
    patientFormDescription.textContent = 'Atualize os dados e salve as alterações.';
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
        showMessage('Não foi possível excluir o paciente.', 'error');
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

    setLoading(false);

    if (response.error) {
        console.error('Erro ao salvar paciente:', response.error);

        if (response.error.code === '23505') {
            showMessage('Já existe um paciente cadastrado com este CPF.', 'error');
        } else {
            showMessage('Não foi possível salvar o paciente. Verifique os dados e tente novamente.', 'error');
        }
        return;
    }

    showMessage(editingId ? 'Paciente atualizado com sucesso.' : 'Paciente cadastrado com sucesso.');
    resetFormMode();
    await carregarPacientes();
});

patientTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const { action, id } = button.dataset;

    if (action === 'edit') editarPaciente(id);
    if (action === 'delete') abrirConfirmacaoExclusao(id);
});

patientSearch.addEventListener('input', aplicarBusca);
cancelEditButton.addEventListener('click', resetFormMode);

fields.cpf.addEventListener('input', () => {
    fields.cpf.value = formatCPF(fields.cpf.value);
});

fields.telefone.addEventListener('input', () => {
    fields.telefone.value = formatPhone(fields.telefone.value);
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
