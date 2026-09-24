# 🍗 Guia Oficial de SEO, Google Search Console e Recomendações por IA — SMACK CHICKEN

Este guia reúne todas as configurações implementadas no projeto para posicionar a **SMACK CHICKEN** no topo das buscas do **Google**, no **Google Maps** e nos motores de busca de **Inteligência Artificial** (ChatGPT, Perplexity, Claude e Gemini).

---

## 📋 Arquivos e Configurações Implementadas

1. **public/robots.txt**:
   - Permite rastreamento completo da página principal, cardápio, fotos e imagens de baldes e lanches.
   - **Bloqueia rotas restritas de operação interna** (/admin, /api, /motoboy) para proteger painéis de caixa e motoboy contra indexação indevida.
   - Dá autorização explícita aos robôs de IA: GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended.
   - Aponta diretamente para o sitemap.xml e referencia o llms.txt.

2. **public/sitemap.xml**:
   - Mapa de URLs no formato padrão XML oficial do Google.
   - Informa ao Google a página de pedidos online com frequência de atualização diária (daily) e prioridade máxima (1.0).

3. **public/llms.txt e public/llms-full.txt**:
   - Padrão internacional de documentação para IAs ([llmstxt.org](https://llmstxt.org/)).
   - Ensina os assistentes de IA sobre o cardápio (Baldes P, M e G de frango crocante, Smash Burgers, Marmita Smack 600g), endereço físico no Estreito (Rua Fúlvio Aducci, 1074), nota 5.0 no Google e links oficiais de pedidos.

4. **pp/layout.tsx (SEO On-Page & Schema.org)**:
   - **Title**: SMACK CHICKEN — Frango Frito no Balde & Smash Burgers no Estreito, Florianópolis
   - **Description**: O melhor frango frito crocante no balde e hambúrgueres artesanais de Florianópolis. Rua Fúlvio Aducci, 1074 — Estreito. Peça online no delivery!
   - **Keywords**: Mapeamento estratégico de termos gastronômicos e regionais.
   - **Geotags**: Coordenadas exatas da loja no Estreito (-27.5878, -48.5794).
   - **Open Graph & Twitter Cards**: Pré-visualizações ricas e atrativas para compartilhamento no WhatsApp e redes sociais com a foto oficial og.jpg.
   - **Dados Estruturados Schema.org JSON-LD**: Marcação oficial de Restaurant e FastFoodRestaurant com horários, telefone, endereço, faixa de preço, culinária e avaliação de 5.0 estrelas.

---

## 🔍 Palavras-Chave e Termos de Busca para Atrair Clientes de Delivery e Balcão

Para captar clientes que estão com fome pesquisando no celular:

### 1. Termos Locais de Alta Conversão (Região Continental de Florianópolis)
- rango frito estreito
- rango no balde florianopolis
- rango frito florianopolis
- lanches estreito florianopolis
- smash burger estreito
- hamburgueria estreito florianopolis
- marmita estreito florianopolis
- onde comer no estreito florianopolis
- comida estreito delivery

### 2. Termos Gastronômicos de Intenção Imediata
- rango frito crocante perto de mim
- alde de frango frito entrega rapida
- melhor frango frito no balde floripa
- sanduiche de frango crocante brioche
- marmita executiva com frango crocante
- delivery frango frito coqueiros estreito capoeiras

---

## 🛠️ Passo a Passo: Cadastro no Google Search Console

1. Acesse: **https://search.google.com/search-console**
2. Faça login com a conta Google da empresa ou sua conta de administrador.
3. Clique em **Adicionar Propriedade** (menu superior esquerdo).
4. Escolha a opção **Prefixo do URL** e insira a URL da sua aplicação:
   `	ext
   https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev/
   `
   *(Ou o domínio próprio caso venha a apontar um como smackchicken.com.br).*
5. Escolha o método de verificação **Tag HTML**:
   - Copie o código gerado pelo Google (ex: <meta name="google-site-verification" content="SEU_CODIGO" />).
   - No arquivo pp/layout.tsx, substitua COLOQUE_SEU_CODIGO_DO_SEARCH_CONSOLE_AQUI pelo seu código real.
   - Ou baixe o arquivo HTML de verificação e salve na pasta public/.
6. Clique em **Verificar**.
7. No menu lateral, acesse **Sitemaps**, digite sitemap.xml e clique em **Enviar**.
8. Na barra superior de inspeção, cole a URL principal e clique em **"Solicitar Indexação"** para acelerar a primeira visita do Googlebot.

---

## 📍 Google Maps & Perfil da Empresa (Google Meu Negócio) — Essencial para a Loja Física!

Como a SMACK CHICKEN possui loja física na **Rua Fúlvio Aducci, 1074 — Estreito**, o **Perfil da Empresa no Google** é a principal fonte de clientes locais:

1. Acesse: **https://www.google.com/intl/pt-BR_br/business/**
2. Reivindique ou gerencie o perfil existente: **SMACK CHICKEN — Frango Frito no Balde**.
3. Verifique se as informações estão idênticas ao site:
   - Endereço: Rua Fúlvio Aducci, 1074 — Estreito, Florianópolis - SC, 88075-000
   - Horário: Segunda a Sábado, das 17h às 23h
   - Link de Pedidos Online: https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev/
4. Mantenha fotos atualizadas dos baldes crocantes, do lanche Smack Power e da marmita de 600g.
5. Incentive os clientes que retirarem no balcão a avaliarem com 5 estrelas (como já fazem com a promoção de 10% off). Quanto mais avaliações positivas com as palavras *"frango crocante"*, *"melhor frango do Estreito"*, mais o Google posicionará a loja em 1º lugar no Maps!

---

## 🤖 Como as IAs Recomendam a SMACK CHICKEN

Com o public/llms.txt implementado e autorizado pelos robôs no obots.txt:
- Quando um usuário perguntar no **ChatGPT**, **Perplexity** ou **Gemini**:
  > *"Onde tem o melhor frango frito no balde em Florianópolis?"* ou *"Qual o melhor lanche com frango crocante no Estreito?"*
  A IA consulta a base indexada e aponta a **SMACK CHICKEN** com o endereço no Estreito e o link direto para pedidos online.