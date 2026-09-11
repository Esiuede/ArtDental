// Cliente público do Supabase usado apenas pelas páginas de autenticação.
// A chave anon/publishable do frontend é pública por definição; RLS continua sendo a barreira de dados.
const artDentalSupabaseUrl = 'https://lsuehxfsfyifxxdtrzxn.supabase.co';
const artDentalPublicKeyParts = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.',
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdWVoeGZzZnlpZnh4ZHRyenhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODU3MzcsImV4cCI6MjA4OTk2MTczN30.',
    'B7UbYck3pNaA52lctxDWEH5nn31tq2htR6wWweFbgb4'
];

window.artDentalSupabase = window.supabase.createClient(
    artDentalSupabaseUrl,
    artDentalPublicKeyParts.join('')
);
