(() => {
    const panel = document.querySelector('[data-panel="documentos"]');
    const tab = document.querySelector('[data-tab="documentos"]');
    if (!panel || !tab) return;

    const DOCUMENT_BUCKET = 'documentos-assinados';
    const TERM_TYPE = 'Termo de responsabilidade';
    const TERM_VERSION = '1.0';
    const TERM_PARAGRAPHS = [
        'Declaro, para os devidos fins, que as informações fornecidas nesta ficha, especialmente aquelas relacionadas ao meu estado de saúde, doenças ou condições preexistentes, alergias, uso de medicamentos e demais informações relevantes ao atendimento odontológico, são verdadeiras, completas e foram prestadas por mim de forma consciente.',
        'Declaro estar ciente de que a omissão, alteração ou fornecimento de informações incorretas poderá interferir na avaliação, no diagnóstico, no planejamento e na segurança do meu atendimento.',
        'Comprometo-me a comunicar ao profissional responsável qualquer alteração relevante em meu estado de saúde, uso de medicamentos ou demais informações fornecidas nesta ficha.'
    ];
    const TERM_TEXT = TERM_PARAGRAPHS.join('\n\n');

    const params = new URLSearchParams(window.location.search);
    const patientId = Number(params.get('id'));

    let patient = null;
    let documents = [];
    let signatureCanvas = null;
    let signatureContext = null;
    let drawing = false;
    let hasSignature = false;

    function escapeHTML(value = '') {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function onlyDigits(value = '') {
        return String(value).replace(/\D/g, '');
    }

    function formatCPF(value = '') {
        const digits = onlyDigits(value).slice(0, 11);
        return digits
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }

    function formatDateTime(value) {
        if (!value) return '—';
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(new Date(value));
    }

    function sanitizeFileName(name = 'paciente') {
        return String(name)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 80) || 'paciente';
    }

    function showMessage(text, type = 'success') {
        const target = document.getElementById('documentMessage');
        if (!target) return;
        target.textContent = text;
        target.className = `form-message show ${type}`;
        clearTimeout(showMessage.timeoutId);
        showMessage.timeoutId = setTimeout(() => {
            target.textContent = '';
            target.className = 'form-message';
        }, 6000);
    }

    async function loadJsPDF() {
        if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

        await new Promise((resolve, reject) => {
            const existing = document.getElementById('jspdf-library');
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.id = 'jspdf-library';
            script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        if (!window.jspdf?.jsPDF) throw new Error('Biblioteca de PDF indisponível.');
        return window.jspdf.jsPDF;
    }

    function buildPanel() {
        tab.querySelector('.tab-badge')?.remove();

        panel.innerHTML = `
            <div class="documents-layout">
                <article class="profile-card">
                    <div class="profile-card-header">
                        <div>
                            <h2>Documentos</h2>
                            <p>Gere e armazene documentos vinculados ao prontuário do paciente.</p>
                        </div>
                    </div>
                    <div class="profile-card-body document-intro">
                        <div class="document-intro-icon">□</div>
                        <div>
                            <h3>Termo de Responsabilidade</h3>
                            <p>Modelo enviado pelo consultório para confirmação das informações de saúde prestadas pelo paciente ou responsável.</p>
                        </div>
                        <div class="document-features">
                            <div class="document-feature"><span class="document-feature-mark">✓</span><span>Assinatura manuscrita com mouse, caneta digital ou toque no celular.</span></div>
                            <div class="document-feature"><span class="document-feature-mark">✓</span><span>PDF salvo em bucket privado e vinculado ao paciente.</span></div>
                            <div class="document-feature"><span class="document-feature-mark">✓</span><span>Documento assinado não pode ser alterado ou excluído pelo frontend.</span></div>
                        </div>
                        <button type="button" class="btn btn-primary btn-full" id="openResponsibilityTermButton">Gerar termo de responsabilidade</button>
                        <p class="document-security-note"><strong>Observação:</strong> a assinatura coletada nesta etapa é uma assinatura manuscrita eletrônica capturada pelo sistema; ela não deve ser confundida com certificado digital ICP-Brasil.</p>
                    </div>
                </article>

                <article class="profile-card">
                    <div class="profile-card-header">
                        <div>
                            <h2>Documentos assinados</h2>
                            <p>Histórico preservado dos documentos deste paciente.</p>
                        </div>
                        <span class="patient-meta" id="documentCount">0 documentos</span>
                    </div>
                    <div class="profile-card-body">
                        <div id="documentMessage" class="form-message" role="alert" aria-live="polite"></div>
                        <div class="documents-list" id="documentsList">
                            <div class="profile-empty">Carregando documentos...</div>
                        </div>
                    </div>
                </article>
            </div>`;
    }

    function buildDialog() {
        if (document.getElementById('responsibilityTermDialog')) return;

        document.body.insertAdjacentHTML('beforeend', `
            <dialog class="document-dialog" id="responsibilityTermDialog">
                <div class="document-dialog-content">
                    <div class="document-dialog-header">
                        <div>
                            <span class="section-label">DOCUMENTO DO PACIENTE</span>
                            <h3>Termo de Responsabilidade</h3>
                            <p>Leia o documento, identifique o assinante e registre a assinatura.</p>
                        </div>
                        <button type="button" class="dialog-close-button" id="closeResponsibilityTermButton" aria-label="Fechar">×</button>
                    </div>

                    <div class="term-preview">
                        <h4>TERMO DE RESPONSABILIDADE</h4>
                        ${TERM_PARAGRAPHS.map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join('')}
                    </div>

                    <form id="responsibilityTermForm">
                        <div class="document-form-grid">
                            <div class="document-field">
                                <label for="documentSignerName">Nome do paciente / responsável *</label>
                                <input type="text" id="documentSignerName" maxlength="160" required autocomplete="name">
                            </div>
                            <div class="document-field">
                                <label for="documentSignerCpf">CPF do assinante</label>
                                <input type="text" id="documentSignerCpf" maxlength="14" inputmode="numeric" placeholder="000.000.000-00">
                            </div>

                            <div class="signature-section">
                                <div class="signature-section-header">
                                    <label>Assinatura *</label>
                                    <button type="button" class="table-action-button" id="clearSignatureButton">Limpar assinatura</button>
                                </div>
                                <div class="signature-canvas-wrap" id="signatureCanvasWrap">
                                    <canvas class="signature-canvas" id="signatureCanvas" aria-label="Área para assinatura"></canvas>
                                    <div class="signature-placeholder">Assine aqui usando o mouse, caneta digital ou o dedo na tela.</div>
                                </div>
                                <div class="signature-help">No computador, mantenha o botão do mouse pressionado para assinar. No celular/tablet, assine diretamente com o dedo ou caneta.</div>
                            </div>

                            <label class="document-consent">
                                <input type="checkbox" id="documentConsent" required>
                                <span>Confirmo que li o Termo de Responsabilidade acima e que a assinatura registrada corresponde ao paciente ou responsável identificado neste documento.</span>
                            </label>
                        </div>

                        <div class="document-dialog-actions">
                            <button type="button" class="btn btn-secondary" id="cancelResponsibilityTermButton">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="saveResponsibilityTermButton">Assinar, gerar PDF e salvar</button>
                        </div>
                    </form>
                </div>
            </dialog>`);
    }

    function setupCanvas() {
        signatureCanvas = document.getElementById('signatureCanvas');
        if (!signatureCanvas) return;
        signatureContext = signatureCanvas.getContext('2d');
        signatureCanvas.style.touchAction = 'none';

        const getPoint = (event) => {
            const rect = signatureCanvas.getBoundingClientRect();
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        };

        signatureCanvas.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            drawing = true;
            signatureCanvas.setPointerCapture?.(event.pointerId);
            const point = getPoint(event);
            signatureContext.beginPath();
            signatureContext.moveTo(point.x, point.y);
        });

        signatureCanvas.addEventListener('pointermove', (event) => {
            if (!drawing) return;
            event.preventDefault();
            const point = getPoint(event);
            signatureContext.lineTo(point.x, point.y);
            signatureContext.stroke();
            hasSignature = true;
            document.getElementById('signatureCanvasWrap')?.classList.add('has-signature');
        });

        const stopDrawing = (event) => {
            if (!drawing) return;
            drawing = false;
            signatureContext.closePath();
            try { signatureCanvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
        };

        signatureCanvas.addEventListener('pointerup', stopDrawing);
        signatureCanvas.addEventListener('pointercancel', stopDrawing);
        signatureCanvas.addEventListener('pointerleave', (event) => {
            if (event.buttons === 0) stopDrawing(event);
        });
    }

    function resizeSignatureCanvas() {
        if (!signatureCanvas || !signatureContext) return;
        const rect = signatureCanvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        signatureCanvas.width = Math.max(1, Math.floor(rect.width * ratio));
        signatureCanvas.height = Math.max(1, Math.floor(rect.height * ratio));
        signatureContext.setTransform(ratio, 0, 0, ratio, 0, 0);
        signatureContext.lineWidth = 2.2;
        signatureContext.lineCap = 'round';
        signatureContext.lineJoin = 'round';
        signatureContext.strokeStyle = '#0f172a';
        hasSignature = false;
        document.getElementById('signatureCanvasWrap')?.classList.remove('has-signature');
    }

    function clearSignature() {
        if (!signatureCanvas || !signatureContext) return;
        const rect = signatureCanvas.getBoundingClientRect();
        signatureContext.clearRect(0, 0, rect.width, rect.height);
        hasSignature = false;
        document.getElementById('signatureCanvasWrap')?.classList.remove('has-signature');
    }

    async function loadPatient() {
        const { data, error } = await supabaseClient
            .from('pacientes')
            .select('id, nome, cpf')
            .eq('id', patientId)
            .single();

        if (error || !data) throw error || new Error('Paciente não encontrado.');
        patient = data;
    }

    async function loadDocuments() {
        const list = document.getElementById('documentsList');
        const count = document.getElementById('documentCount');
        if (!list || !count) return;

        const { data, error } = await supabaseClient
            .from('documentos_paciente')
            .select('id, paciente_id, tipo, versao_modelo, nome_assinante, cpf_assinante, nome_arquivo, caminho_storage, hash_sha256, assinado_em, criado_em')
            .eq('paciente_id', patientId)
            .order('assinado_em', { ascending: false })
            .order('id', { ascending: false });

        if (error) {
            console.error('Erro ao carregar documentos:', error);
            list.innerHTML = '<div class="profile-empty error-text">Não foi possível carregar os documentos. Confirme se o SQL da v0.6 foi executado.</div>';
            count.textContent = '0 documentos';
            return;
        }

        documents = data || [];
        count.textContent = `${documents.length} ${documents.length === 1 ? 'documento' : 'documentos'}`;

        if (!documents.length) {
            list.innerHTML = '<div class="profile-empty">Nenhum documento assinado para este paciente.</div>';
            return;
        }

        list.innerHTML = documents.map((documentItem) => `
            <div class="document-item">
                <div class="document-item-icon">PDF</div>
                <div class="document-item-info">
                    <strong>${escapeHTML(documentItem.tipo)}</strong>
                    <span>Assinado por ${escapeHTML(documentItem.nome_assinante)} · ${formatDateTime(documentItem.assinado_em)}</span>
                    <span>Modelo v${escapeHTML(documentItem.versao_modelo)}</span>
                    <span class="document-hash" title="SHA-256 completo: ${escapeHTML(documentItem.hash_sha256)}">SHA-256 ${escapeHTML(documentItem.hash_sha256.slice(0, 18))}…</span>
                </div>
                <div class="document-item-actions">
                    <button type="button" class="table-action-button primary" data-document-action="open" data-document-id="${documentItem.id}">Visualizar</button>
                    <button type="button" class="table-action-button" data-document-action="download" data-document-id="${documentItem.id}">Baixar PDF</button>
                </div>
            </div>`).join('');
    }

    function openDialog() {
        if (!patient) {
            showMessage('Os dados do paciente ainda não foram carregados.', 'error');
            return;
        }
        const dialog = document.getElementById('responsibilityTermDialog');
        const signerName = document.getElementById('documentSignerName');
        const signerCpf = document.getElementById('documentSignerCpf');
        const consent = document.getElementById('documentConsent');
        signerName.value = patient.nome || '';
        signerCpf.value = patient.cpf ? formatCPF(patient.cpf) : '';
        consent.checked = false;
        dialog.showModal();
        requestAnimationFrame(resizeSignatureCanvas);
    }

    function closeDialog() {
        document.getElementById('responsibilityTermDialog')?.close();
        clearSignature();
    }

    function createPdf(signatureDataUrl, signerName, signerCpf) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 20;
        const contentWidth = pageWidth - margin * 2;
        let y = 22;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(15);
        pdf.text('TERMO DE RESPONSABILIDADE', pageWidth / 2, y, { align: 'center' });
        y += 12;

        pdf.setFontSize(10.5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Paciente: ${patient?.nome || '—'}`, margin, y);
        y += 7;
        if (patient?.cpf) {
            pdf.text(`CPF do paciente: ${formatCPF(patient.cpf)}`, margin, y);
            y += 9;
        } else {
            y += 2;
        }

        pdf.setFontSize(11);
        TERM_PARAGRAPHS.forEach((paragraph) => {
            const lines = pdf.splitTextToSize(paragraph, contentWidth);
            if (y + lines.length * 6 > 250) {
                pdf.addPage();
                y = 22;
            }
            pdf.text(lines, margin, y, { lineHeightFactor: 1.45 });
            y += lines.length * 6 + 6;
        });

        if (y > 220) {
            pdf.addPage();
            y = 28;
        } else {
            y += 6;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.text('Assinante / responsável', margin, y);
        y += 7;
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Nome: ${signerName}`, margin, y);
        y += 6;
        pdf.text(`CPF: ${signerCpf ? formatCPF(signerCpf) : 'Não informado'}`, margin, y);
        y += 9;

        pdf.addImage(signatureDataUrl, 'PNG', margin, y, 74, 22, undefined, 'FAST');
        y += 25;
        pdf.setDrawColor(148, 163, 184);
        pdf.line(margin, y, margin + 82, y);
        y += 5;
        pdf.setFontSize(9);
        pdf.text('Assinatura manuscrita eletrônica coletada no ArtDental', margin, y);
        y += 10;

        const signedAt = new Date();
        pdf.setFontSize(9.5);
        pdf.text(`Data e hora: ${formatDateTime(signedAt.toISOString())}`, margin, y);
        y += 5;
        pdf.text(`Modelo do termo: v${TERM_VERSION}`, margin, y);

        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Documento gerado pelo ArtDental. O conteúdo assinado é preservado no prontuário do paciente.', margin, 287);

        return { pdf, signedAt };
    }

    async function sha256Blob(blob) {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    async function saveTerm(event) {
        event.preventDefault();
        const signerNameInput = document.getElementById('documentSignerName');
        const signerCpfInput = document.getElementById('documentSignerCpf');
        const consent = document.getElementById('documentConsent');
        const button = document.getElementById('saveResponsibilityTermButton');

        const signerName = signerNameInput.value.trim();
        const signerCpf = onlyDigits(signerCpfInput.value);

        if (signerName.length < 2) {
            showMessage('Informe o nome de quem está assinando o termo.', 'error');
            signerNameInput.focus();
            return;
        }
        if (signerCpf && signerCpf.length !== 11) {
            showMessage('O CPF do assinante deve conter 11 números.', 'error');
            signerCpfInput.focus();
            return;
        }
        if (!hasSignature) {
            showMessage('Registre a assinatura antes de gerar o documento.', 'error');
            return;
        }
        if (!consent.checked) {
            showMessage('Confirme a leitura e concordância com o termo.', 'error');
            return;
        }

        button.disabled = true;
        button.textContent = 'Gerando e salvando...';

        try {
            await loadJsPDF();
            const signatureDataUrl = signatureCanvas.toDataURL('image/png');
            const { pdf, signedAt } = createPdf(signatureDataUrl, signerName, signerCpf);
            const pdfBlob = pdf.output('blob');
            const hash = await sha256Blob(pdfBlob);
            const safePatient = sanitizeFileName(patient.nome);
            const timestamp = signedAt.toISOString().replace(/[:.]/g, '-');
            const fileName = `termo-responsabilidade-${safePatient}-${timestamp}.pdf`;
            const storagePath = `${patientId}/termos/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.pdf`;

            const { error: uploadError } = await supabaseClient.storage
                .from(DOCUMENT_BUCKET)
                .upload(storagePath, pdfBlob, {
                    contentType: 'application/pdf',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { error: metadataError } = await supabaseClient
                .from('documentos_paciente')
                .insert({
                    paciente_id: patientId,
                    tipo: TERM_TYPE,
                    versao_modelo: TERM_VERSION,
                    conteudo: TERM_TEXT,
                    nome_assinante: signerName,
                    cpf_assinante: signerCpf || null,
                    nome_arquivo: fileName,
                    caminho_storage: storagePath,
                    hash_sha256: hash,
                    assinado_em: signedAt.toISOString()
                });

            if (metadataError) throw metadataError;

            closeDialog();
            await loadDocuments();
            showMessage('Termo assinado, gerado em PDF e salvo no prontuário.');
        } catch (error) {
            console.error('Erro ao gerar/salvar termo:', error);
            showMessage('Não foi possível gerar ou salvar o termo. Confirme se a migração v0.6 foi executada.', 'error');
        } finally {
            button.disabled = false;
            button.textContent = 'Assinar, gerar PDF e salvar';
        }
    }

    async function openDocument(id, download = false) {
        const documentItem = documents.find((item) => String(item.id) === String(id));
        if (!documentItem) return;

        const newTab = download ? null : window.open('about:blank', '_blank');
        const options = download ? { download: documentItem.nome_arquivo } : undefined;
        const { data, error } = await supabaseClient.storage
            .from(DOCUMENT_BUCKET)
            .createSignedUrl(documentItem.caminho_storage, 120, options);

        if (error || !data?.signedUrl) {
            if (newTab) newTab.close();
            console.error('Erro ao abrir documento:', error);
            showMessage('Não foi possível abrir o documento.', 'error');
            return;
        }

        if (download) {
            const link = document.createElement('a');
            link.href = data.signedUrl;
            link.download = documentItem.nome_arquivo;
            document.body.appendChild(link);
            link.click();
            link.remove();
            return;
        }

        if (newTab) newTab.location.href = data.signedUrl;
        else window.location.href = data.signedUrl;
    }

    function bindEvents() {
        document.getElementById('openResponsibilityTermButton')?.addEventListener('click', openDialog);
        document.getElementById('closeResponsibilityTermButton')?.addEventListener('click', closeDialog);
        document.getElementById('cancelResponsibilityTermButton')?.addEventListener('click', closeDialog);
        document.getElementById('clearSignatureButton')?.addEventListener('click', clearSignature);
        document.getElementById('responsibilityTermForm')?.addEventListener('submit', saveTerm);
        document.getElementById('responsibilityTermDialog')?.addEventListener('cancel', () => {
            clearSignature();
        });
        document.getElementById('documentSignerCpf')?.addEventListener('input', (event) => {
            event.target.value = formatCPF(event.target.value);
        });
        document.getElementById('documentsList')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-document-action]');
            if (!button) return;
            const download = button.dataset.documentAction === 'download';
            openDocument(button.dataset.documentId, download);
        });
    }

    async function init() {
        buildPanel();
        buildDialog();
        setupCanvas();
        bindEvents();

        const user = window.authReady ? await window.authReady : true;
        if (!user) return;

        if (!Number.isInteger(patientId) || patientId <= 0) {
            showMessage('Paciente inválido.', 'error');
            return;
        }

        try {
            await loadPatient();
            await loadDocuments();
        } catch (error) {
            console.error('Erro ao iniciar módulo de documentos:', error);
            showMessage('Não foi possível carregar o módulo de documentos.', 'error');
        }
    }

    init();
})();
