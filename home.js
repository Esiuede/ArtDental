// 1. Inicializando o Supabase Client
const supabaseUrl = 'https://lsuehxfsfyifxxdtrzxn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdWVoeGZzZnlpZnh4ZHRyenhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODU3MzcsImV4cCI6MjA4OTk2MTczN30.B7UbYck3pNaA52lctxDWEH5nn31tq2htR6wWweFbgb4';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// 2. Valida se o usuário tem token ativo para acessar a página
async function verificarSessao() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    // Se não houver usuário logado, expulsa de volta para a tela de login
    if (!user || error) {
        alert('Acesso negado. Por favor, faça o login.');
        window.location.href = 'login.html';
    } else {
        console.log('Usuário autenticado:', user.email);
    }
}

// Executa a checagem no momento do carregamento da página
verificarSessao();

// 3. Função acionada pelo botão "Sair"
async function fazerLogout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert('Erro ao sair: ' + error.message);
    } else {
        window.location.href = 'login.html';
    }
}