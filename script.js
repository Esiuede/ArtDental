// 1. Inicializando o Supabase Client
const supabaseUrl = 'https://lsuehxfsfyifxxdtrzxn.supabase.co';
// Substitua pela sua chave anon public do painel do Supabase
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdWVoeGZzZnlpZnh4ZHRyenhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODU3MzcsImV4cCI6MjA4OTk2MTczN30.B7UbYck3pNaA52lctxDWEH5nn31tq2htR6wWweFbgb4'; 

// Nomeamos como 'supabaseClient' para evitar conflito com a variável global da biblioteca
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault(); 

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    try {
        // Envia a solicitação de login para o Supabase Auth
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha,
        });

        if (error) {
            alert('Erro ao fazer login: ' + error.message);
            console.error(error);
            return;
        }

        // Sucesso: Redireciona para o painel principal
        alert('Login realizado com sucesso!');
        window.location.href = "home.html"; 

    } catch (err) {
        alert('Erro inesperado no sistema.');
        console.error(err);
    }
});