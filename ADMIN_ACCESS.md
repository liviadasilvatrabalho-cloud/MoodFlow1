# Acesso Administrativo - MoodFlow

## 📋 Visão Geral

Este documento descreve como o acesso administrativo (ADMIN_CLINICA) funciona no sistema MoodFlow, garantindo isolamento completo dos fluxos de pacientes e profissionais de saúde.

## 🔐 Segurança Implementada

### Isolamento de Interface

- ✅ ADMIN_CLINICA **NÃO** aparece no login público
- ✅ ADMIN_CLINICA **NÃO** pode se cadastrar via interface
- ✅ Pacientes **NUNCA** veem a área admin
- ✅ Profissionais (psicólogos/psiquiatras) **NUNCA** veem a área admin
- ✅ Link de acesso admin é discreto e não interfere no design

### Proteção de Rotas

O sistema implementa proteção em múltiplas camadas:

1. **Bloqueio de Signup**: Interface pública bloqueia criação de contas ADMIN
2. **Detecção de Rota**: Sistema detecta tentativas de acesso via `?admin=true` ou `/admin/login`
3. **Redirecionamento**: Usuários não-admin são automaticamente redirecionados ao login público
4. **Isolamento de Dados**: ADMIN não acessa dados clínicos de pacientes

## 🚪 Como Acessar o Sistema (ADMIN)

### Passo 1: Ter uma Conta ADMIN

Contas ADMIN **só podem ser criadas manualmente** via:

#### Opção A: SQL Direto no Supabase

```sql
-- 1. Criar usuário no Supabase Auth (via Dashboard ou SQL)
-- 2. Inserir perfil com role ADMIN_CLINICA
INSERT INTO profiles (id, email, name, role, language, role_confirmed, joined_at)
VALUES (
  'uuid-do-usuario-criado-no-auth',
  'admin@clinica.com',
  'Nome do Administrador',
  'ADMIN_CLINICA',
  'pt',
  true,
  NOW()
);
```

#### Opção B: Supabase Dashboard

1. Acesse o Supabase Dashboard
2. Vá para Authentication > Users
3. Crie um novo usuário
4. Vá para Table Editor > profiles
5. Insira um registro com `role = 'ADMIN_CLINICA'`

### Passo 2: Acessar o Sistema

Existem duas formas de acessar:

#### Forma 1: Link Discreto (Recomendado)

1. Acesse a tela de login normal: `https://seudominio.com`
2. No rodapé, clique no texto discreto **"Acesso administrativo"**
3. Você será redirecionado para o login admin
4. Entre com suas credenciais de ADMIN

#### Forma 2: URL Direta

Acesse diretamente: `https://seudominio.com/?admin=true`

### Passo 3: Login

1. Digite email e senha da conta ADMIN
2. Clique em "Acessar Gestão"
3. Você será direcionado ao DoctorPortal em modo administrativo

## 🛡️ Políticas de Segurança

### O que ADMIN pode acessar:

- ✅ Painel administrativo (DoctorPortal em modo admin)
- ✅ Gestão de clínicas
- ✅ Gestão de profissionais
- ✅ Métricas gerais (agregadas, sem dados sensíveis)

### O que ADMIN NÃO pode acessar:

- ❌ Prontuários de pacientes (`entries`)
- ❌ Mensagens entre paciente e profissional (`doctor_notes`)
- ❌ Dados clínicos sensíveis
- ❌ Informações pessoais de saúde

## 🔒 Row Level Security (RLS)

As políticas RLS do Supabase garantem que:

```sql
-- ADMIN_CLINICA não acessa dados de pacientes
CREATE POLICY "admin_no_patient_data" ON entries
  FOR SELECT
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role != 'ADMIN_CLINICA'
  ));

-- ADMIN_CLINICA não acessa notas clínicas
CREATE POLICY "admin_no_clinical_notes" ON doctor_notes
  FOR SELECT
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role != 'ADMIN_CLINICA'
  ));
```

## 📝 Arquivos Modificados

### 1. `components/Auth.tsx`
- Adicionado link discreto "Acesso administrativo" no footer
- Mantém bloqueio de signup de ADMIN (já existia)

### 2. `App.tsx`
- Melhorada detecção de rota admin (query string, pathname, hash)
- Adicionada proteção de rota para não-admins
- Redirecionamento automático para login público

## ✅ Confirmações

> **Nenhuma funcionalidade existente foi alterada**
> 
> Todas as mudanças são aditivas (segurança) ou cosméticas (link discreto). Pacientes e profissionais continuam usando o sistema exatamente como antes.

> **Nenhum design foi modificado**
> 
> O link "Acesso administrativo" usa estilo minimalista (9px, cinza escuro) e não interfere no layout existente.

## 🧪 Testes Realizados

- ✅ Login como PACIENTE → não vê opção admin
- ✅ Login como PSICOLOGO → não vê opção admin
- ✅ Login como PSIQUIATRA → não vê opção admin
- ✅ Tentar acessar `/?admin=true` sem role ADMIN → redirecionado
- ✅ Login admin válido → acessa DoctorPortal em modo admin
- ✅ Tentar signup com role ADMIN → bloqueado
- ✅ Funcionalidades existentes → 100% funcionais

## 📞 Suporte

Para criar novas contas ADMIN ou questões de segurança, contate o administrador do sistema ou acesse diretamente o Supabase Dashboard.

---

**Última atualização:** 2026-01-08  
**Versão:** 1.0.0
