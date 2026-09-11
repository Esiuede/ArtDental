const supabaseClient = window.artDentalSupabase;

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

async function getAccessState(userId) {
    return supabaseClient
        .from('usuarios_acesso')
        .select('deve_trocar_senha')
        .eq('usuario_id', userId)
        .maybeSingle();
}

const initialParams = new URLSearchParams(window.location.search);
if (initialParams.get('erro') === 'acesso') {
    showMessage('Não foi possível validar o perfil de acesso. Entre novamente ou contate o responsável pelo sistema.');
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
        const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
            email,
            password: senha
        });

        if (signInError || !signInData?.user) {
            showMessage('Não foi possível entrar. Verifique seu e-mail e sua senha.');
            console.error(signInError);
            return;
        }

        const { data: access, error: accessError } = await getAccessState(signInData.user.id);

        if (accessError || !access) {
            console.error('Não foi possível validar o controle de acesso:', accessError);
            await supabaseClient.auth.signOut();
            showMessage('Sua conta entrou, mas o perfil de acesso não pôde ser validado. Tente novamente.');
            return;
        }

        if (access.deve_trocar_senha) {
            showMessage('Primeiro acesso identificado. Vamos criar sua senha pessoal...', 'success');
            window.location.replace('redefinir-senha.html?modo=primeiro-acesso');
            return;
        }

        showMessage('Login realizado com sucesso. Redirecionando...', 'success');
        window.location.replace('home.html');
    } catch (err) {
        showMessage('Ocorreu um erro inesperado. Tente novamente.');
        console.error(err);
    } finally {
        setLoading(false);
    }
});
