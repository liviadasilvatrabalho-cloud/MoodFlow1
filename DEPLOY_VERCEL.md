# Guia de Deploy na Vercel

Seu projeto já está configurado para a Vercel! Siga os passos abaixo para colocar o site no ar.

## 1. Importar o Projeto
1. Acesse [vercel.com/new](https://vercel.com/new).
2. Selecione o repositório **MoodFlow**.
3. Em **Framework Preset**, a Vercel deve detectar automaticamente como **Vite**. Se não, selecione "Vite".
4. Em **Root Directory**, certifique-se de que está apontando para a raiz do repositório (se você subiu a pasta `MoodFlow1` como raiz, deixe vazio. Se `MoodFlow1` é uma subpasta no git, clique em "Edit" e selecione `MoodFlow1`). 
   * *Nota: Baseado no nosso último ajuste, a raiz do git parece ser a própria pasta MoodFlow1, então pode deixar o Root Directory vazio.*

## 2. Configurar Variáveis de Ambiente (Environment Variables)
Antes de clicar em "Deploy", você precisa adicionar as chaves de segurança. 
Clique na seção **Environment Variables** e adicione estas três chaves (copie os valores do seu arquivo local `.env`):

| Key (Nome) | Value (Valor) |
| :--- | :--- |
| `VITE_SUPABASE_URL` | *Cole o valor do seu .env* |
| `VITE_SUPABASE_ANON_KEY` | *Cole o valor do seu .env* |
| `GEMINI_API_KEY` | *Cole o valor da sua chave Gemini* |

> **Dica:** Você pode copiar o conteúdo inteiro do arquivo `.env` e colar na primeira caixa da Vercel para adicionar todas de uma vez (a Vercel costuma aceitar o formato de arquivo).

## 3. Finalizar
1. Clique em **Deploy**.
2. Aguarde a construção (Build).
3. Quando terminar, seu site estará online! 🎉

O arquivo `vercel.json` já foi criado para garantir que a navegação entre páginas funcione corretamente (evitando erros 404 ao atualizar a página).
