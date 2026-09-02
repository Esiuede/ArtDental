const supabaseUrl = 'https://lsuehxfsfyifxxdtrzxn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdWVoeGZzZnlpZnh4ZHRyenhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODU3MzcsImV4cCI6MjA4OTk2MTczN30.B7UbYck3pNaA52lctxDWEH5nn31tq2htR6wWweFbgb4';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const loginMessage = document.getElementById('loginMessage');
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('senha');

function showMessage(message, type = 'error') {
    loginMessage.textContent = message;
    loginMessage.className = `form-message show ${type}`;
}

function clearMessage() {
    loginMessage.textContent = '';
    loginMessage.className = 'form-message';
}

function setLoading(isLoading) {
    loginButton.disabled = isLoading;
    loginButton.classList.toggle('is-loading', isLoading);
}

togglePassword.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePassword.textContent = isPassword ? 'Ocultar' : 'Mostrar';
    togglePassword.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
});

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const email = document.getElementById('email').value.trim();
    const senha = passwordInput.value;

    if (!email || !senha) {
        showMessage('Preencha seu e-mail e sua senha para continuar.');
        return;
    }

    setLoading(true);

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password: senha
        });

        if (error) {
            showMessage('Não foi possível entrar. Verifique seu e-mail e sua senha.');
            console.error(error);
            return;
        }

        showMessage('Login realizado com sucesso. Redirecionando...', 'success');
        window.location.href = 'home.html';
    } catch (err) {
        showMessage('Ocorreu um erro inesperado. Tente novamente.');
        console.error(err);
    } finally {
        setLoading(false);
    }
});
