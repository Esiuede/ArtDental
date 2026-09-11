-- Art Dental v0.7
-- Controle de primeiro acesso + troca obrigatória de senha
--
-- Fluxo:
-- 1) usuários já existentes ao executar esta migração são considerados liberados;
-- 2) todo NOVO usuário criado em auth.users recebe deve_trocar_senha = true;
-- 3) quando o password hash em auth.users realmente muda, um trigger libera o acesso;
-- 4) o frontend autenticado pode apenas LER o próprio estado, nunca alterá-lo.

create table if not exists public.usuarios_acesso (
    usuario_id uuid primary key
        references auth.users(id)
        on delete cascade,
    deve_trocar_senha boolean not null default true,
    senha_alterada_em timestamptz,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

alter table public.usuarios_acesso enable row level security;

revoke all on table public.usuarios_acesso from anon;
revoke all on table public.usuarios_acesso from authenticated;

grant select
on table public.usuarios_acesso
to authenticated;

drop policy if exists "usuarios_acesso_select_proprio" on public.usuarios_acesso;

create policy "usuarios_acesso_select_proprio"
on public.usuarios_acesso
for select
to authenticated
using (usuario_id = auth.uid());

-- =====================================================
-- BACKFILL
-- Quem já existia antes desta versão continua liberado.
-- IMPORTANTE: execute esta migração ANTES de criar a conta do cliente.
-- =====================================================

insert into public.usuarios_acesso (
    usuario_id,
    deve_trocar_senha,
    senha_alterada_em,
    criado_em,
    atualizado_em
)
select
    id,
    false,
    now(),
    now(),
    now()
from auth.users
on conflict (usuario_id) do nothing;

-- =====================================================
-- NOVO USUÁRIO => PRIMEIRO ACESSO OBRIGATÓRIO
-- =====================================================

create or replace function public.artdental_criar_controle_primeiro_acesso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.usuarios_acesso (
        usuario_id,
        deve_trocar_senha,
        criado_em,
        atualizado_em
    )
    values (
        new.id,
        true,
        now(),
        now()
    )
    on conflict (usuario_id) do nothing;

    return new;
end;
$$;

drop trigger if exists artdental_usuario_novo_primeiro_acesso on auth.users;

create trigger artdental_usuario_novo_primeiro_acesso
after insert on auth.users
for each row
execute function public.artdental_criar_controle_primeiro_acesso();

-- =====================================================
-- SENHA ALTERADA => LIBERA ACESSO
-- Funciona tanto para a troca obrigatória quanto para recuperação por e-mail.
-- =====================================================

create or replace function public.artdental_liberar_apos_troca_senha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if old.encrypted_password is distinct from new.encrypted_password then
        insert into public.usuarios_acesso (
            usuario_id,
            deve_trocar_senha,
            senha_alterada_em,
            criado_em,
            atualizado_em
        )
        values (
            new.id,
            false,
            now(),
            now(),
            now()
        )
        on conflict (usuario_id)
        do update set
            deve_trocar_senha = false,
            senha_alterada_em = now(),
            atualizado_em = now();
    end if;

    return new;
end;
$$;

drop trigger if exists artdental_usuario_senha_alterada on auth.users;

create trigger artdental_usuario_senha_alterada
after update of encrypted_password on auth.users
for each row
execute function public.artdental_liberar_apos_troca_senha();

-- As funções existem apenas para os triggers.
revoke all on function public.artdental_criar_controle_primeiro_acesso() from public, anon, authenticated;
revoke all on function public.artdental_liberar_apos_troca_senha() from public, anon, authenticated;
