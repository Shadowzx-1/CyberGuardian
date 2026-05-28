# CyberGuardian

Site simples para verificar se um link é seguro antes de clicar.

## Como funciona

1. Você cola o link no campo
2. A análise local verifica o domínio, protocolo, encurtadores e padrões suspeitos
3. A IA (Claude) complementa com uma análise em linguagem natural

## Checks realizados

- Protocolo HTTPS ou HTTP inseguro
- Encurtadores de link (bit.ly, tinyurl, etc.)
- Endereço IP direto no lugar de domínio
- Domínios de topo suspeitos (.xyz, .tk, .cf, etc.)
- Palavras-chave associadas a phishing
- URL anormalmente longa
- Excesso de subdomínios
- Caracteres unicode suspeitos no domínio

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub (pode ser público)
2. Suba os três arquivos:
   - `index.html`
   - `style.css`
   - `app.js`
3. Vá em **Settings → Pages**
4. Em **Source**, selecione `Deploy from a branch`
5. Escolha a branch `main` e a pasta `/ (root)`
6. Salve — em alguns minutos o site estará disponível em `https://seu-usuario.github.io/nome-do-repo`

## Arquivos

```
├── index.html   # Estrutura da página
├── style.css    # Estilos
└── app.js       # Lógica de verificação e chamada à IA
```

## Observações

- Nenhum link é armazenado — tudo roda no navegador do usuário
- A análise de IA usa a API da Anthropic diretamente do frontend
- O histórico dura apenas enquanto a página estiver aberta
