# MForge Lista de Convidados

Dashboard estático do RSVP do Builder v8. O front é hospedado no Netlify e consulta o Supabase somente por RPCs públicas controladas. As tabelas não são expostas ao navegador.

O acesso administrativo é feito por uma chave aleatória no fragmento da URL (`#token=...`). O fragmento não é enviado ao servidor web. O dashboard permite configurar o formulário, limitar confirmações aos nomes cadastrados, acompanhar respostas e gerar a lista do evento em PDF.

## Publicação

Os arquivos desta pasta podem ser publicados diretamente como site estático. Apenas a chave `publishable` do Supabase fica no front; credenciais administrativas permanecem fora do repositório.
