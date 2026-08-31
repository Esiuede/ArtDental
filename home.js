const supabaseUrl = 'https://lsuehxfsfyifxxdtrzxn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdWVoeGZzZnlpZnh4ZHRyenhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODU3MzcsImV4cCI6MjA4OTk2MTczN30.B7UbYck3pNaA52lctxDWEH5nn31tq2htR6wWweFbgb4';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

async function verificarSessao() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (!user || error) {
        window.location.href = 'login.html';
        return;
    }

    const sidebarUser = document.getElementById('sidebarUser');
    if (sidebarUser) {
        sidebarUser.textContent = user.email?.split('@')[0] || 'Usuário';
    }
}

async function fazerLogout() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        console.error('Erro ao sair:', error);
        return;
    }

    window.location.href = 'login.html';
}

verificarSessao();
