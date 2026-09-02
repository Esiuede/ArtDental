const dashboardGreeting = document.getElementById('dashboardGreeting');
const dashboardDate = document.getElementById('dashboardDate');
const todayAppointmentsCount = document.getElementById('todayAppointmentsCount');
const nextAppointmentTime = document.getElementById('nextAppointmentTime');
const nextAppointmentDetail = document.getElementById('nextAppointmentDetail');
const totalPatientsCount = document.getElementById('totalPatientsCount');
const newPatientsMonthCount = document.getElementById('newPatientsMonthCount');
const todayAppointmentList = document.getElementById('todayAppointmentList');
const todayAgendaSubtitle = document.getElementById('todayAgendaSubtitle');

function localDateISO(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function escapeDashboard(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function statusClassDashboard(status = '') {
    if (status === 'Confirmada') return 'status-confirmed';
    if (status === 'Aguardando confirmação') return 'status-waiting';
    if (status === 'Cancelada') return 'status-cancelled';
    if (status === 'Finalizada') return 'status-confirmed';
    return 'status-waiting';
}

function shortStatus(status = '') {
    if (status === 'Aguardando confirmação') return 'Aguardando';
    return status || 'Agendada';
}

function appointmentPatientName(appointment) {
    if (Array.isArray(appointment.pacientes)) {
        return appointment.pacientes[0]?.nome || 'Paciente';
    }
    return appointment.pacientes?.nome || 'Paciente';
}

function setGreeting() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    dashboardGreeting.textContent = `${greeting} 👋`;

    const formatted = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(now);

    dashboardDate.textContent = `Hoje é ${formatted}. Acompanhe os dados reais do consultório.`;
}

async function getPatientCounts() {
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const [totalResult, monthResult] = await Promise.all([
        supabaseClient
            .from('pacientes')
            .select('*', { count: 'exact', head: true }),
        supabaseClient
            .from('pacientes')
            .select('*', { count: 'exact', head: true })
            .gte('criado_em', firstDayOfMonth.toISOString())
    ]);

    if (totalResult.error) {
        console.error('Erro ao contar pacientes:', totalResult.error);
        totalPatientsCount.textContent = '—';
    } else {
        totalPatientsCount.textContent = totalResult.count ?? 0;
    }

    if (monthResult.error) {
        console.error('Erro ao contar novos pacientes:', monthResult.error);
        newPatientsMonthCount.textContent = '—';
    } else {
        newPatientsMonthCount.textContent = monthResult.count ?? 0;
    }
}

async function getTodayAppointments() {
    const today = localDateISO();

    const { data, error } = await supabaseClient
        .from('consultas')
        .select('id, paciente_id, data_consulta, hora_consulta, tipo, profissional, status, pacientes(nome)')
        .eq('data_consulta', today)
        .order('hora_consulta', { ascending: true });

    if (error) {
        console.error('Erro ao carregar agenda de hoje:', error);
        todayAppointmentsCount.textContent = '—';
        todayAgendaSubtitle.textContent = 'Não foi possível carregar a agenda';
        todayAppointmentList.innerHTML = '<div class="empty-state compact-empty-state"><h3>Agenda indisponível</h3><p>Tente atualizar a página.</p></div>';
        return;
    }

    const appointments = data || [];
    const activeAppointments = appointments.filter((appointment) => !['Cancelada', 'Finalizada'].includes(appointment.status));
    todayAppointmentsCount.textContent = activeAppointments.length;

    if (!appointments.length) {
        todayAgendaSubtitle.textContent = 'Nenhum atendimento registrado para hoje';
        todayAppointmentList.innerHTML = '<div class="empty-state compact-empty-state"><div class="empty-state-icon">▣</div><h3>Agenda livre hoje</h3><p>Não há consultas cadastradas para esta data.</p></div>';
        return;
    }

    todayAgendaSubtitle.textContent = `${appointments.length} ${appointments.length === 1 ? 'registro' : 'registros'} na agenda de hoje`;

    todayAppointmentList.innerHTML = appointments.map((appointment) => `
        <div class="appointment-row">
            <div class="appointment-time">${escapeDashboard((appointment.hora_consulta || '').slice(0, 5))}</div>
            <div>
                <div class="appointment-name">${escapeDashboard(appointmentPatientName(appointment))}</div>
                <div class="appointment-type">${escapeDashboard(appointment.tipo || 'Consulta')} · ${escapeDashboard(appointment.profissional || 'Profissional não informado')}</div>
            </div>
            <span class="status ${statusClassDashboard(appointment.status)}">${escapeDashboard(shortStatus(appointment.status))}</span>
        </div>
    `).join('');
}

function appointmentDateTime(appointment) {
    if (!appointment.data_consulta || !appointment.hora_consulta) return null;
    const time = appointment.hora_consulta.slice(0, 5);
    const date = new Date(`${appointment.data_consulta}T${time}:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

async function getNextAppointment() {
    const today = localDateISO();
    const now = new Date();

    const { data, error } = await supabaseClient
        .from('consultas')
        .select('id, paciente_id, data_consulta, hora_consulta, tipo, profissional, status, pacientes(nome)')
        .gte('data_consulta', today)
        .order('data_consulta', { ascending: true })
        .order('hora_consulta', { ascending: true })
        .limit(100);

    if (error) {
        console.error('Erro ao carregar próxima consulta:', error);
        nextAppointmentTime.textContent = '—';
        nextAppointmentDetail.textContent = 'Não foi possível consultar a agenda';
        return;
    }

    const next = (data || []).find((appointment) => {
        if (['Cancelada', 'Finalizada'].includes(appointment.status)) return false;
        const dateTime = appointmentDateTime(appointment);
        return dateTime && dateTime >= now;
    });

    if (!next) {
        nextAppointmentTime.textContent = '—';
        nextAppointmentDetail.textContent = 'Nenhuma consulta futura agendada';
        return;
    }

    const dateTime = appointmentDateTime(next);
    const sameDay = next.data_consulta === today;
    nextAppointmentTime.textContent = (next.hora_consulta || '').slice(0, 5) || '—';

    const dateLabel = sameDay
        ? 'Hoje'
        : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(dateTime);

    nextAppointmentDetail.textContent = `${dateLabel} · ${appointmentPatientName(next)} · ${next.tipo || 'Consulta'}`;
}

async function initDashboard() {
    if (!dashboardGreeting) return;
    setGreeting();

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    await Promise.all([
        getPatientCounts(),
        getTodayAppointments(),
        getNextAppointment()
    ]);
}

initDashboard();
