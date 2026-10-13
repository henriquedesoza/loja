# loja.br — marketplace brasileiro

E-commerce em português do Brasil. **Etapa 2 entregue:** carrinho, checkout em etapas, pagamentos
(Pix/cartão/boleto) e página de pedidos. Etapa 1 (schema, auth, catálogo) segue funcionando.
Próximas etapas (com aprovação entre elas): painel do vendedor → admin.

## Rodar

```powershell
# 1. Postgres portátil local (sem Docker, sem admin) — cria o banco "loja" e as extensões
npm run pg:start

# 2. Schema + índices de busca + dados de teste
npx prisma migrate deploy
npm run db:search-index
npm run db:seed

# 3. App
npm run dev        # http://localhost:3000
npm test           # 30 testes (unidade + integração com o Postgres + fluxo de compra)
```

O Postgres portátil fica em `%LOCALAPPDATA%\pg` (banco `loja`, usuário `postgres`, senha `loja_dev`).

### Pagamentos

Sem token o app roda com **gateway mock** (nenhuma cobrança real, nada sai da máquina):

- `MP_ACCESS_TOKEN` (produção) — ativa o Mercado Pago de verdade (SDK oficial, sandbox/produção).
- `MP_WEBHOOK_SECRET` (produção) — verificação HMAC da assinatura do webhook. Sem ele (modo mock)
  o webhook aceita notificações sem assinatura, para o simulador funcionar.

Rotas: `POST /api/webhooks/pagamentos` (notificação do provedor) e `POST /api/precos`
(revalida preço/estoque do carrinho no servidor antes de fechar o pedido).

## Contas de teste (seed)

| Perfil    | E-mail              | Senha      |
| --------- | ------------------- | ---------- |
| Admin     | admin@loja.dev      | senha12345 |
| Vendedor  | vendas@aurora.dev   | senha12345 |
| Vendedor  | contato@botica.dev  | senha12345 |
| Vendedor  | oi@nuvem.dev        | senha12345 |
| Comprador | comprador1@loja.dev | senha12345 |

`comprador1@loja.dev` já tem endereço cadastrado e o pedido histórico **LB-SEED01** (entregue,
com rastreio) para demonstrar histórico e "comprar de novo".

### Cupons de teste

| Código       | Efeito                                | Condição            |
| ------------ | ------------------------------------- | ------------------- |
| BEMVINDO10   | 10% de desconto                       | mínimo R$ 100       |
| FRETEGRATIS  | frete grátis                          | mínimo R$ 150       |
| VOLTA15      | R$ 15 de desconto                     | mínimo R$ 80, 50 usos |

Desconto Pix (5%) é cumulativo com cupom.

## O que existe hoje

- **Busca**: autocomplete (trigram) + busca textual FTS em português (`websearch_to_tsquery` + `ts_rank`), com índice GIN.
- **Catálogo**: filtros por categoria (pai cobre as filhas), marca, faixa de preço e avaliação; ordenação; paginação.
- **Página de produto**: galeria, variações cor/tamanho com estoque, preço + parcelamento (6x sem juros, parcela mínima R$ 30) + preço Pix, cotação de frete por CEP, avaliações com fotos, perguntas e respostas, recomendações e link para o vendedor.
- **Carrinho**: React + `localStorage` (chave `loja-carrinho-v1`), badge no cabeçalho, quantidades por item; preços e estoque revalidados no servidor ao fechar o pedido.
- **Checkout**: endereços múltiplos (cadastro inline), presente com recado, cotação de frete por CEP (tabela por região + peso; grátis acima de R$ 300), cupom, pagamento Pix (5% de desconto, copia-e-cola), cartão e boleto.
- **Pedidos**: página de lista e de detalhe com código `LB-XXXXXX`, histórico com datas, status (aguardando → pago → separação → enviado → entregue), rastreio, recado de presente, "comprar de novo" e simulador de pagamento (modo mock) para aprovar/recusar/expirar via webhook.
- **Vendedor**: página pública com os produtos dele.
- **Auth**: Better Auth (e-mail/senha, sessão, cookie assinado) + papel `BUYER|SELLER|ADMIN` no banco.
- **Seed**: 36 produtos, 10 marcas fictícias, 3 vendedores, avaliações e perguntas realistas, cupons, endereço e pedido histórico; imagens SVG geradas localmente.

## Decisões e limites desta etapa

- Pagamentos usam **Mercado Pago** por trás de uma interface própria (`src/lib/pagamentos.ts`); sem `MP_ACCESS_TOKEN` o mock implementa a mesma interface. Trocar para Stripe é só reescrever esse arquivo.
- Gateway mock: Pix gera copia-e-cola fictício e **não tem QR real**; cartão/boleto geram linha digitável de mentira. A interface com o provedor real é uma só.
- Frete é tabela fixa por faixa do CEP + peso (R$ 300 grátis acima de R$ 300) — Calcorre/Correios entram depois.
- Carrinho só no cliente (`localStorage`): sem servidor, sem login obrigatório para montar o carrinho; o servidor é a autoridade de preço/estoque no fecho do pedido.
- Rotas autenticadas (`/checkout`, `/pedidos`, `/pedidos/[id]`) usam `export const instant = false` (render bloqueante). Motivo: no Next 16.4.0 um servidor async dentro de `<Suspense>` que consulta o banco não resolve no HTML streamed (fica preso no fallback) — sessão pura resolve, sessão + banco não. Se uma versão futura corrigir, dá para voltar para streaming.
- Produto inexistente mostra a UI de 404 com status HTTP 200 (limitação do Partial Prerender do Next 16); se afetar SEO/monitoramento, resolve-se com checagem no `proxy.ts`.
- Lighthouse medido na Etapa 1 nesta máquina: Acessibilidade 100, Best Practices 100, SEO 100. Performance precisa de medição real.
