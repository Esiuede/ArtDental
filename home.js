const supabaseUrl = 'https://lsuehxfsfyifxxdtrzxn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdWVoeGZzZnlpZnh4ZHRyenhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODU3MzcsImV4cCI6MjA4OTk2MTczN30.B7UbYck3pNaA52lctxDWEH5nn31tq2htR6wWweFbgb4';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// As paginas internas ficam ocultas ate que o Supabase confirme a sessao.
// A seguranca dos dados continua sendo garantida pelo Auth + RLS; isto tambem
// evita que a interface privada pisque na tela antes de um redirecionamento.
document.documentElement.classList.add('auth-checking');

function liberarInterfaceAutenticada() {
    document.documentElement.classList.remove('auth-checking');
    document.documentElement.classList.add('auth-ok');
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
            // textContent evita interpretar o e-mail/nome como HTML.
            sidebarUser.textContent = user.email?.split('@')[0] || 'Usuário';
        }

        liberarInterfaceAutenticada();
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

// Disponibiliza uma Promise única para scripts das páginas que precisem
// aguardar a autenticação antes de consultar dados sensíveis.
window.authReady = verificarSessao();
