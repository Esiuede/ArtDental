const supabaseClient = window.artDentalSupabase;

const recoveryForm = document.getElementById('recoveryForm');
const recoveryEmail = document.getElementById('recoveryEmail');
const recoveryButton = document.getElementById('recoveryButton');
const recoveryMessage = document.getElementById('recoveryMessage');
const recoverySuccess = document.getElementById('recoverySuccess');

function showMessage(message, type = 'error') {
    recoveryMessage.textContent = message;
    recoveryMessage.className = `form-message show ${type}`;
}

function clearMessage() {
    recoveryMessage.textContent = '';
    recoveryMessage.className = 'form-message';
}

function setLoading(isLoading) {
    recoveryButton.disabled = isLoading;
    recoveryButton.classList.toggle('is-loading', isLoading);
}

function getResetRedirectUrl() {
    return new URL('redefinir-senha.html?modo=recuperacao', window.location.href).href;
}

recoveryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();
    recoverySuccess.classList.remove('show');

    const email = recoveryEmail.value.trim();

    if (!email) {
        showMessage('Informe o e-mail da sua conta.');
        return;
    }

    if (!recoveryEmail.checkValidity()) {
        showMessage('Digite um endereço de e-mail válido.');
        return;
    }

    setLoading(true);

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: getResetRedirectUrl()
        });

        if (error) {
            console.error('Falha ao solicitar recuperação:', error);
            showMessage('Não foi possível enviar o link agora. Aguarde um momento e tente novamente.');
            return;
        }

        recoveryForm.reset();
        recoverySuccess.classList.add('show');
    } catch (error) {
        console.error('Erro inesperado na recuperação de senha:', error);
        showMessage('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
        setLoading(false);
    }
});
