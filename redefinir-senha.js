const supabaseClient = window.artDentalSupabase;

const params = new URLSearchParams(window.location.search);
const mode = params.get('modo') === 'primeiro-acesso' ? 'primeiro-acesso' : 'recuperacao';

const passwordForm = document.getElementById('passwordForm');
const passwordButton = document.getElementById('passwordButton');
const passwordMessage = document.getElementById('passwordMessage');
const newPassword = document.getElementById('newPassword');
const confirmPassword = document.getElementById('confirmPassword');
const firstAccessNote = document.getElementById('firstAccessNote');
const invalidRecovery = document.getElementById('invalidRecovery');
const passwordBackRow = document.getElementById('passwordBackRow');
const pageTitle = document.getElementById('passwordPageTitle');
const pageDescription = document.getElementById('passwordPageDescription');
const sectionLabel = document.getElementById('passwordSectionLabel');
const brandTitle = document.getElementById('passwordBrandTitle');
const brandText = document.getElementById('passwordBrandText');

let currentUser = null;

function showMessage(message, type = 'error') {
    passwordMessage.textContent = message;
    passwordMessage.className = `form-message show ${type}`;
}

function clearMessage() {
    passwordMessage.textContent = '';
    passwordMessage.className = 'form-message';
}

function setLoading(isLoading) {
    passwordButton.disabled = isLoading;
    passwordButton.classList.toggle('is-loading', isLoading);
}

function showForm() {
    passwordForm.classList.remove('auth-hidden');
    invalidRecovery.classList.remove('show');
}

function showInvalidRecovery(message = '') {
    passwordForm.classList.add('auth-hidden');
    invalidRecovery.classList.add('show');
    if (message) showMessage(message);
}

function configureModeCopy() {
    if (mode !== 'primeiro-acesso') return;

    document.title = 'Primeiro acesso | Art Dental';
    sectionLabel.textContent = 'PRIMEIRO ACESSO';
    pageTitle.textContent = 'Crie sua senha pessoal';
    pageDescription.textContent = 'Troque a senha temporária para liberar o acesso ao sistema.';
    brandTitle.textContent = 'Seu acesso começa com uma senha só sua.';
    brandText.textContent = 'A senha temporária é usada apenas no primeiro login. Depois desta etapa, somente você conhecerá sua senha.';
    firstAccessNote.classList.remove('auth-hidden');
    passwordBackRow.classList.add('auth-hidden');
}

async function loadAccessState(userId) {
    return supabaseClient
        .from('usuarios_acesso')
        .select('deve_trocar_senha')
        .eq('usuario_id', userId)
        .maybeSingle();
}

async function initializePage() {
    configureModeCopy();

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const authError = hashParams.get('error_description');

    if (authError && mode === 'recuperacao') {
        showInvalidRecovery('O link de recuperação não pôde ser validado. Solicite um novo link.');
        return;
    }

    try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            if (mode === 'primeiro-acesso') {
                window.location.replace('index.html');
                return;
            }

            showInvalidRecovery();
            return;
        }

        currentUser = user;

        if (mode === 'primeiro-acesso') {
            const { data: access, error: accessError } = await loadAccessState(user.id);

            if (accessError) {
                console.error('Erro ao validar primeiro acesso:', accessError);
                showMessage('Não foi possível validar o primeiro acesso. Tente novamente.');
                return;
            }

            if (!access) {
                await supabaseClient.auth.signOut();
                window.location.replace('index.html?erro=acesso');
                return;
            }

            if (!access.deve_trocar_senha) {
                window.location.replace('home.html');
                return;
            }
        }

        showForm();
    } catch (error) {
        console.error('Falha ao preparar redefinição de senha:', error);
        if (mode === 'recuperacao') {
            showInvalidRecovery('Não foi possível validar o link de recuperação.');
        } else {
            showMessage('Ocorreu um erro ao preparar o primeiro acesso.');
        }
    }
}

document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        button.textContent = isPassword ? 'Ocultar' : 'Mostrar';
        button.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
    });
});

passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const password = newPassword.value;
    const confirmation = confirmPassword.value;

    if (password.length < 8) {
        showMessage('A nova senha precisa ter pelo menos 8 caracteres.');
        return;
    }

    if (password !== confirmation) {
        showMessage('As senhas digitadas não são iguais.');
        return;
    }

    if (!currentUser) {
        showMessage('Sua sessão não está válida. Solicite um novo acesso ou link de recuperação.');
        return;
    }

    setLoading(true);

    try {
        const { error } = await supabaseClient.auth.updateUser({ password });

        if (error) {
            console.error('Erro ao atualizar senha:', error);
            showMessage('Não foi possível alterar a senha. Verifique os requisitos e tente novamente.');
            return;
        }

        showMessage('Senha alterada com sucesso. Liberando seu acesso...', 'success');

        window.setTimeout(() => {
            window.location.replace('home.html');
        }, 700);
    } catch (error) {
        console.error('Erro inesperado ao redefinir senha:', error);
        showMessage('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
        setLoading(false);
    }
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session?.user) {
        currentUser = session.user;
        if (mode === 'recuperacao') showForm();
    }
});

initializePage();
