const supabaseUrl = 'https://lsuehxfsfyifxxdtrzxn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdWVoeGZzZnlpZnh4ZHRyenhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODU3MzcsImV4cCI6MjA4OTk2MTczN30.B7UbYck3pNaA52lctxDWEH5nn31tq2htR6wWweFbgb4';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

document.documentElement.classList.add('auth-checking');

function liberarInterfaceAutenticada() {
    document.documentElement.classList.remove('auth-checking');
    document.documentElement.classList.add('auth-ok');
}

function carregarModuloOdontograma() {
    const odontogramPanel = document.querySelector('[data-panel="odontograma"]');
    if (!odontogramPanel || document.getElementById('odontograma-script')) return;

    if (!document.getElementById('odontograma-style')) {
        const stylesheet = document.createElement('link');
        stylesheet.id = 'odontograma-style';
        stylesheet.rel = 'stylesheet';
        stylesheet.href = 'odontograma.css?v=0.4.0';
        document.head.appendChild(stylesheet);
    }

    const script = document.createElement('script');
    script.id = 'odontograma-script';
    script.src = 'odontograma.js?v=0.4.0';
    document.body.appendChild(script);
}

function carregarModuloAcompanhamento() {
    const treatmentPanel = document.querySelector('[data-panel="tratamento"]');
    if (!treatmentPanel || document.getElementById('acompanhamento-script')) return;

    if (!document.getElementById('acompanhamento-style')) {
        const stylesheet = document.createElement('link');
        stylesheet.id = 'acompanhamento-style';
        stylesheet.rel = 'stylesheet';
        stylesheet.href = 'acompanhamento.css?v=0.5.0';
        document.head.appendChild(stylesheet);
    }

    const script = document.createElement('script');
    script.id = 'acompanhamento-script';
    script.src = 'acompanhamento.js?v=0.5.0';
    document.body.appendChild(script);
}

async function verificarSessao() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();

        if (!user || error) {
            window.location.replace('index.html');
            return null;
        }

        const sidebarUser = document.getElementById('sidebarUser');
        if (sidebarUser) {
            sidebarUser.textContent = user.email?.split('@')[0] || 'Usuário';
        }

        liberarInterfaceAutenticada();
        carregarModuloOdontograma();
        carregarModuloAcompanhamento();
        return user;
    } catch (error) {
        console.error('Falha ao validar a sessão:', error);
        window.location.replace('index.html');
        return null;
    }
}

async function fazerLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            console.error('Erro ao sair:', error);
            return;
        }

        window.location.replace('index.html');
    } catch (error) {
        console.error('Falha ao encerrar a sessão:', error);
    }
}

window.authReady = verificarSessao();
