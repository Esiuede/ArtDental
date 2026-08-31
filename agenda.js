const appointmentForm = document.getElementById('appointmentForm');
const appointmentMessage = document.getElementById('appointmentMessage');
const appointmentFormTitle = document.getElementById('appointmentFormTitle');
const appointmentFormDescription = document.getElementById('appointmentFormDescription');
const appointmentSubmitButton = document.getElementById('appointmentSubmitButton');
const cancelAppointmentEdit = document.getElementById('cancelAppointmentEdit');
const patientSearchInput = document.getElementById('paciente');
const patientIdInput = document.getElementById('pacienteId');
const patientSuggestions = document.getElementById('patientSuggestions');
const weekLabel = document.getElementById('weekLabel');
const calendarHead = document.getElementById('calendarHead');
const calendarGrid = document.getElementById('calendarGrid');
const appointmentTableBody = document.getElementById('appointmentTableBody');
const appointmentCount = document.getElementById('appointmentCount');
const previousWeekButton = document.getElementById('previousWeek');
const nextWeekButton = document.getElementById('nextWeek');
const todayWeekButton = document.getElementById('todayWeek');
const deleteAppointmentDialog = document.getElementById('deleteAppointmentDialog');
const deleteAppointmentInfo = document.getElementById('deleteAppointmentInfo');
const confirmDeleteAppointment = document.getElementById('confirmDeleteAppointment');
const cancelDeleteAppointment = document.getElementById('cancelDeleteAppointment');

const fields = {
    profissional: document.getElementById('profissional'),
    data: document.getElementById('dataConsulta'),
    hora: document.getElementById('horaConsulta'),
    tipo: document.getElementById('tipoConsulta'),
    status: document.getElementById('statusConsulta'),
    observacoes: document.getElementById('observacoes')
};

let pacientes = [];
let consultas = [];
let editingAppointmentId = null;
let pendingDeleteAppointmentId = null;
let currentWeekStart = getMonday(new Date());

function pad(value) {
    return String(value).padStart(2, '0');
}

function toDateInput(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function getMonday(date) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    return result;
}

function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
}

function formatShortDate(date) {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}

function formatLongDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR').format(parseLocalDate(value));
}

function formatWeekLabel(start) {
    const end = addDays(start, 4);
    const startText = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(start);
    const endText = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(end);
    return `${startText} a ${endText}`;
}

function onlyDigits(value = '') {
    return String(value).replace(/\D/g, '');
}

function formatCPF(value = '') {
    return onlyDigits(value)
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value = '') {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 10) {
        return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function escapeHTML(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showAppointmentMessage(text, type = 'success') {
    appointmentMessage.textContent = text;
    appointmentMessage.className = `form-message show ${type}`;
    window.clearTimeout(showAppointmentMessage.timeoutId);
    showAppointmentMessage.timeoutId = window.setTimeout(() => {
        appointmentMessage.textContent = '';
        appointmentMessage.className = 'form-message';
    }, 4500);
}

function setAppointmentLoading(isLoading) {
    appointmentSubmitButton.disabled = isLoading;
    appointmentSubmitButton.classList.toggle('is-loading', isLoading);
}

function statusClass(status) {
    const map = {
        'Agendada': 'scheduled',
        'Confirmada': 'confirmed',
        'Aguardando confirmação': 'waiting',
        'Finalizada': 'finished',
        'Cancelada': 'cancelled'
    };
    return map[status] || 'scheduled';
}

function patientLabel(paciente) {
    if (!paciente) return '';
    const detail = paciente.cpf ? formatCPF(paciente.cpf) : formatPhone(paciente.telefone || '');
    return detail ? `${paciente.nome} · ${detail}` : paciente.nome;
}

async function carregarPacientesDaAgenda() {
    const { data, error } = await supabaseClient
        .from('pacientes')
        .select('id, nome, cpf, telefone, email')
        .order('nome', { ascending: true });

    if (error) {
        console.error('Erro ao carregar pacientes:', error);
        showAppointmentMessage('Não foi possível carregar os pacientes cadastrados.', 'error');
        return;
    }

    pacientes = data || [];
}

function renderPatientSuggestions(term = '') {
    const normalized = term.trim().toLowerCase();
    const digits = onlyDigits(term);

    const matches = pacientes.filter((paciente) => {
        const nome = (paciente.nome || '').toLowerCase();
        const cpf = paciente.cpf || '';
        const telefone = paciente.telefone || '';
        return !normalized || nome.includes(normalized) || (digits && cpf.includes(digits)) || (digits && telefone.includes(digits));
    }).slice(0, 8);

    if (!matches.length) {
        patientSuggestions.innerHTML = '<div class="patient-suggestion-empty">Nenhum paciente encontrado.</div>';
        patientSuggestions.hidden = false;
        return;
    }

    patientSuggestions.innerHTML = matches.map((paciente) => `
        <button type="button" class="patient-suggestion" data-patient-id="${paciente.id}">
            <span class="patient-suggestion-name">${escapeHTML(paciente.nome)}</span>
            <small>${paciente.cpf ? formatCPF(paciente.cpf) : formatPhone(paciente.telefone || '')}</small>
        </button>
    `).join('');
    patientSuggestions.hidden = false;
}

function selecionarPaciente(id) {
    const paciente = pacientes.find((item) => String(item.id) === String(id));
    if (!paciente) return;
    patientIdInput.value = paciente.id;
    patientSearchInput.value = patientLabel(paciente);
    patientSuggestions.hidden = true;
}

function resetAppointmentFormMode() {
    editingAppointmentId = null;
    appointmentForm.reset();
    patientIdInput.value = '';
    patientSuggestions.hidden = true;
    appointmentFormTitle.textContent = 'Nova consulta';
    appointmentFormDescription.textContent = 'Selecione um paciente cadastrado e informe os dados do atendimento.';
    appointmentSubmitButton.querySelector('.button-text').textContent = 'Agendar consulta';
    cancelAppointmentEdit.hidden = true;
    fields.status.value = 'Agendada';
}

function getAppointmentPayload() {
    const pacienteId = Number(patientIdInput.value);
    const paciente = pacientes.find((item) => Number(item.id) === pacienteId);

    if (!paciente) throw new Error('Selecione um paciente cadastrado na lista de sugestões.');
    if (fields.profissional.value.trim().length < 2) throw new Error('Informe o profissional responsável.');
    if (!fields.data.value) throw new Error('Informe a data da consulta.');
    if (!fields.hora.value) throw new Error('Informe o horário da consulta.');

    return {
        paciente_id: pacienteId,
        profissional: fields.profissional.value.trim(),
        data_consulta: fields.data.value,
        hora_consulta: fields.hora.value,
        tipo: fields.tipo.value,
        status: fields.status.value,
        observacoes: fields.observacoes.value.trim() || null
    };
}

async function carregarConsultasDaSemana() {
    const start = toDateInput(currentWeekStart);
    const end = toDateInput(addDays(currentWeekStart, 4));

    calendarGrid.innerHTML = '<div class="calendar-loading">Carregando agenda...</div>';
    appointmentTableBody.innerHTML = '<tr><td colspan="7" class="loading-cell">Carregando consultas...</td></tr>';

    const { data, error } = await supabaseClient
        .from('consultas')
        .select('id, paciente_id, profissional, data_consulta, hora_consulta, tipo, status, observacoes, pacientes(id, nome, cpf, telefone)')
        .gte('data_consulta', start)
        .lte('data_consulta', end)
        .order('data_consulta', { ascending: true })
        .order('hora_consulta', { ascending: true });

    if (error) {
        console.error('Erro ao carregar consultas:', error);
        calendarGrid.innerHTML = '<div class="calendar-loading error-text">Não foi possível carregar a agenda.</div>';
        appointmentTableBody.innerHTML = '<tr><td colspan="7" class="loading-cell error-text">Não foi possível carregar as consultas.</td></tr>';
        showAppointmentMessage('Não foi possível acessar a tabela de consultas. Execute o SQL da agenda no Supabase.', 'error');
        return;
    }

    consultas = data || [];
    renderCalendar();
    renderAppointmentList();
}

function renderCalendar() {
    const days = Array.from({ length: 5 }, (_, index) => addDays(currentWeekStart, index));
    const dayNames = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
    weekLabel.textContent = formatWeekLabel(currentWeekStart);

    calendarHead.innerHTML = '<div>HORÁRIO</div>' + days.map((day, index) => `
        <div><span>${dayNames[index]}</span><strong>${pad(day.getDate())}</strong><small>${pad(day.getMonth() + 1)}</small></div>
    `).join('');

    const hours = [];
    for (let hour = 8; hour <= 18; hour += 1) hours.push(hour);

    calendarGrid.innerHTML = hours.map((hour) => {
        const timeCell = `<div class="time-cell">${pad(hour)}:00</div>`;
        const dayCells = days.map((day) => {
            const dateValue = toDateInput(day);
            const events = consultas.filter((consulta) => {
                const appointmentHour = Number(String(consulta.hora_consulta).slice(0, 2));
                return consulta.data_consulta === dateValue && appointmentHour === hour;
            });

            return `<div class="day-cell" data-date="${dateValue}" data-hour="${pad(hour)}:00">
                ${events.map((consulta) => `
                    <button type="button" class="calendar-event event-${statusClass(consulta.status)}" data-edit-appointment="${consulta.id}">
                        <strong>${escapeHTML(consulta.pacientes?.nome || 'Paciente')}</strong>
                        <small>${String(consulta.hora_consulta).slice(0, 5)} · ${escapeHTML(consulta.tipo)}</small>
                        <span>${escapeHTML(consulta.status)}</span>
                    </button>
                `).join('')}
            </div>`;
        }).join('');
        return timeCell + dayCells;
    }).join('');
}

function renderAppointmentList() {
    appointmentCount.textContent = `${consultas.length} ${consultas.length === 1 ? 'consulta' : 'consultas'}`;

    if (!consultas.length) {
        appointmentTableBody.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state compact-empty-state">
                    <div class="empty-state-icon">▣</div>
                    <h3>Nenhuma consulta nesta semana</h3>
                    <p>Use o formulário acima para criar o primeiro agendamento.</p>
                </div>
            </td></tr>`;
        return;
    }

    appointmentTableBody.innerHTML = consultas.map((consulta) => `
        <tr>
            <td><span class="table-name">${escapeHTML(consulta.pacientes?.nome || 'Paciente')}</span></td>
            <td>${formatLongDate(consulta.data_consulta)}</td>
            <td>${String(consulta.hora_consulta).slice(0, 5)}</td>
            <td>${escapeHTML(consulta.profissional)}</td>
            <td>${escapeHTML(consulta.tipo)}</td>
            <td><span class="appointment-status status-${statusClass(consulta.status)}">${escapeHTML(consulta.status)}</span></td>
            <td>
                <div class="row-actions">
                    <button class="table-action-button" type="button" data-action="edit-appointment" data-id="${consulta.id}">Editar</button>
                    ${consulta.status !== 'Cancelada' ? `<button class="table-action-button warning" type="button" data-action="cancel-appointment" data-id="${consulta.id}">Cancelar</button>` : ''}
                    <button class="table-action-button danger" type="button" data-action="delete-appointment" data-id="${consulta.id}">Excluir</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function editarConsulta(id) {
    const consulta = consultas.find((item) => String(item.id) === String(id));
    if (!consulta) return;

    editingAppointmentId = consulta.id;
    patientIdInput.value = consulta.paciente_id;
    patientSearchInput.value = patientLabel(consulta.pacientes);
    fields.profissional.value = consulta.profissional || '';
    fields.data.value = consulta.data_consulta || '';
    fields.hora.value = String(consulta.hora_consulta || '').slice(0, 5);
    fields.tipo.value = consulta.tipo || 'Consulta';
    fields.status.value = consulta.status || 'Agendada';
    fields.observacoes.value = consulta.observacoes || '';

    appointmentFormTitle.textContent = 'Editar consulta';
    appointmentFormDescription.textContent = 'Atualize os dados do agendamento e salve as alterações.';
    appointmentSubmitButton.querySelector('.button-text').textContent = 'Salvar alterações';
    cancelAppointmentEdit.hidden = false;

    document.querySelector('.appointment-form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function cancelarConsulta(id) {
    const { error } = await supabaseClient
        .from('consultas')
        .update({ status: 'Cancelada' })
        .eq('id', id);

    if (error) {
        console.error('Erro ao cancelar consulta:', error);
        showAppointmentMessage('Não foi possível cancelar a consulta.', 'error');
        return;
    }

    showAppointmentMessage('Consulta cancelada.');
    await carregarConsultasDaSemana();
}

function abrirExclusaoConsulta(id) {
    const consulta = consultas.find((item) => String(item.id) === String(id));
    if (!consulta) return;
    pendingDeleteAppointmentId = consulta.id;
    deleteAppointmentInfo.textContent = `${consulta.pacientes?.nome || 'Paciente'} · ${formatLongDate(consulta.data_consulta)} às ${String(consulta.hora_consulta).slice(0, 5)}`;
    deleteAppointmentDialog.showModal();
}

async function excluirConsulta() {
    if (!pendingDeleteAppointmentId) return;

    confirmDeleteAppointment.disabled = true;
    confirmDeleteAppointment.textContent = 'Excluindo...';

    const { error } = await supabaseClient
        .from('consultas')
        .delete()
        .eq('id', pendingDeleteAppointmentId);

    confirmDeleteAppointment.disabled = false;
    confirmDeleteAppointment.textContent = 'Excluir consulta';

    if (error) {
        console.error('Erro ao excluir consulta:', error);
        showAppointmentMessage('Não foi possível excluir a consulta.', 'error');
        return;
    }

    if (String(editingAppointmentId) === String(pendingDeleteAppointmentId)) resetAppointmentFormMode();
    pendingDeleteAppointmentId = null;
    deleteAppointmentDialog.close();
    showAppointmentMessage('Consulta excluída com sucesso.');
    await carregarConsultasDaSemana();
}

appointmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    let payload;
    try {
        payload = getAppointmentPayload();
    } catch (error) {
        showAppointmentMessage(error.message, 'error');
        return;
    }

    setAppointmentLoading(true);

    const response = editingAppointmentId
        ? await supabaseClient.from('consultas').update(payload).eq('id', editingAppointmentId).select().single()
        : await supabaseClient.from('consultas').insert(payload).select().single();

    setAppointmentLoading(false);

    if (response.error) {
        console.error('Erro ao salvar consulta:', response.error);
        if (response.error.code === '23505') {
            showAppointmentMessage('Este profissional já possui uma consulta nesse dia e horário.', 'error');
        } else if (response.error.code === '23503') {
            showAppointmentMessage('O paciente selecionado não está mais disponível.', 'error');
        } else {
            showAppointmentMessage('Não foi possível salvar a consulta. Verifique os dados e tente novamente.', 'error');
        }
        return;
    }

    const savedDate = payload.data_consulta;
    showAppointmentMessage(editingAppointmentId ? 'Consulta atualizada com sucesso.' : 'Consulta agendada com sucesso.');
    resetAppointmentFormMode();
    currentWeekStart = getMonday(parseLocalDate(savedDate));
    await carregarConsultasDaSemana();
});

patientSearchInput.addEventListener('focus', () => renderPatientSuggestions(patientSearchInput.value));
patientSearchInput.addEventListener('input', () => {
    patientIdInput.value = '';
    renderPatientSuggestions(patientSearchInput.value);
});

patientSuggestions.addEventListener('mousedown', (event) => {
    const button = event.target.closest('[data-patient-id]');
    if (!button) return;
    event.preventDefault();
    selecionarPaciente(button.dataset.patientId);
});

patientSearchInput.addEventListener('blur', () => {
    window.setTimeout(() => { patientSuggestions.hidden = true; }, 120);
});

calendarGrid.addEventListener('click', (event) => {
    const appointment = event.target.closest('[data-edit-appointment]');
    if (appointment) editarConsulta(appointment.dataset.editAppointment);
});

appointmentTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'edit-appointment') editarConsulta(id);
    if (action === 'cancel-appointment') cancelarConsulta(id);
    if (action === 'delete-appointment') abrirExclusaoConsulta(id);
});

previousWeekButton.addEventListener('click', async () => {
    currentWeekStart = addDays(currentWeekStart, -7);
    await carregarConsultasDaSemana();
});

nextWeekButton.addEventListener('click', async () => {
    currentWeekStart = addDays(currentWeekStart, 7);
    await carregarConsultasDaSemana();
});

todayWeekButton.addEventListener('click', async () => {
    currentWeekStart = getMonday(new Date());
    await carregarConsultasDaSemana();
});

cancelAppointmentEdit.addEventListener('click', resetAppointmentFormMode);
confirmDeleteAppointment.addEventListener('click', excluirConsulta);
cancelDeleteAppointment.addEventListener('click', () => {
    pendingDeleteAppointmentId = null;
    deleteAppointmentDialog.close();
});

deleteAppointmentDialog.addEventListener('cancel', () => {
    pendingDeleteAppointmentId = null;
});

(async function initAgenda() {
    fields.data.value = toDateInput(new Date());
    await carregarPacientesDaAgenda();
    await carregarConsultasDaSemana();
})();
