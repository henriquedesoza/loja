import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const db = new PrismaClient();

// PRNG determinístico para o seed ser reproduzível
let s = 42;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

const SENHA = "senha12345"; // senha de demonstração do seed

// ---------- imagens SVG locais (upload em R2 vem no painel do vendedor) ----------
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function hash(str: string) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
function svgProduto(titulo: string, idx: number) {
  const h = hash(titulo + idx);
  const c1 = `hsl(${h} 45% 55%)`;
  const c2 = `hsl(${(h + 40) % 360} 50% 35%)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <circle cx="${200 + (h % 400)}" cy="${250 + (h % 200)}" r="120" fill="rgba(255,255,255,.14)"/>
  <text x="400" y="640" font-family="system-ui,sans-serif" font-size="40" font-weight="600"
        fill="#fff" text-anchor="middle">${esc(titulo)}</text>
  <text x="400" y="700" font-family="system-ui,sans-serif" font-size="28" fill="rgba(255,255,255,.75)"
        text-anchor="middle">foto ${idx}</text>
</svg>`;
}
function svgFoto(texto: string, i: number) {
  const h = (i * 47) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img">
  <rect width="96" height="96" rx="48" fill="hsl(${h} 40% 50%)"/>
  <text x="48" y="56" font-family="system-ui,sans-serif" font-size="20" fill="#fff" text-anchor="middle">${esc(texto.slice(0, 2))}</text>
</svg>`;
}

const slugify = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const imgDir = path.join(process.cwd(), "public", "img");
rmSync(imgDir, { recursive: true, force: true });
mkdirSync(imgDir, { recursive: true });

// ---------- dados ----------
const categorias: { slug: string; name: string; children: { slug: string; name: string }[] }[] = [
  { slug: "moda", name: "Moda", children: [
    { slug: "calcados", name: "Calçados" },
    { slug: "roupas", name: "Roupas" },
    { slug: "acessorios", name: "Acessórios" },
  ]},
  { slug: "casa-decoracao", name: "Casa & Decoração", children: [
    { slug: "cozinha", name: "Cozinha" },
    { slug: "moveis-decoracao", name: "Móveis & Decoração" },
  ]},
  { slug: "eletronicos", name: "Eletrônicos", children: [
    { slug: "audio", name: "Áudio" },
    { slug: "acessorios-tech", name: "Acessórios Tech" },
  ]},
  { slug: "esporte-lazer", name: "Esporte & Lazer", children: [
    { slug: "fitness", name: "Fitness" },
    { slug: "camping", name: "Camping" },
  ]},
  { slug: "beleza", name: "Beleza", children: [
    { slug: "skincare", name: "Skincare" },
    { slug: "cabelo", name: "Cabelo" },
  ]},
  { slug: "brinquedos", name: "Brinquedos", children: [
    { slug: "educativos", name: "Educativos" },
  ]},
];

const marcas = [
  "Aurora Sport", "Sertão Calçados", "Vela Home", "Nuvem Tech", "Botica Verde",
  "Maré Swim", "Ferro & Aço", "Papelaria Ponto", "Estúdio Linha", "Doce Lar",
];

type Tmpl = { t: string; cat: string; marca: string; preco: number; cores: string[]; tamanhos: string[]; desc: string };
const TAM_ROUPA = ["P", "M", "G", "GG"];
const TAM_CALCADO = ["37", "38", "39", "40", "41", "42", "43"];
const UNICO = ["Único"];

const produtos: Tmpl[] = [
  { t: "Tênis de Corrida Aurora Velocity 3", cat: "calcados", marca: "Aurora Sport", preco: 34990, cores: ["Preto", "Azul Marinho", "Verde Lima"], tamanhos: TAM_CALCADO, desc: "Tênis de corrida com entressola em espuma de alta devolução de energia e cabedal em malha respirável. Ideal para treinos de rua e provas de 5 a 21 km." },
  { t: "Tênis Casual Aurora Urbano Lona", cat: "calcados", marca: "Aurora Sport", preco: 22990, cores: ["Branco", "Preto", "Vinho"], tamanhos: TAM_CALCADO, desc: "Tênis casual de lona com solado emborrachado e forro macio. Combina com jeans e com look de fim de semana." },
  { t: "Chinelo Sertão Ipanema Soft", cat: "calcados", marca: "Sertão Calçados", preco: 5990, cores: ["Preto", "Cinza", "Azul"], tamanhos: ["36", "37", "38", "39", "40", "41", "42", "43", "44"], desc: "Chinelo anatômico em EVA com tiras de lona encorpada. Resistente à água e ao sol." },
  { t: "Bota Sertão Couro Caminhante", cat: "calcados", marca: "Sertão Calçados", preco: 48990, cores: ["Marrom", "Preto"], tamanhos: TAM_CALCADO, desc: "Bota de couro legítimo com solado antiderrapante e biqueira reforçada. Perfeita para trilhas leves e uso urbano." },
  { t: "Camiseta Performance Aurora Dry", cat: "roupas", marca: "Aurora Sport", preco: 8990, cores: ["Preto", "Branco", "Vermelho"], tamanhos: TAM_ROUPA, desc: "Camiseta em tecido dry touch que remove o suor em segundos. Costuras planas para não marcar." },
  { t: "Shorts Aurora Run 2 em 1", cat: "roupas", marca: "Aurora Sport", preco: 11990, cores: ["Preto", "Azul"], tamanhos: TAM_ROUPA, desc: "Shorts de corrida com bermuda interna de compressão e bolso lateral com zíper." },
  { t: "Regata Maré Swim Dry Fit", cat: "roupas", marca: "Maré Swim", preco: 6990, cores: ["Azul Petróleo", "Areia", "Preto"], tamanhos: TAM_ROUPA, desc: "Regata dry fit com proteção UV 50+ e caimento solto. Secagem rápida após o treino." },
  { t: "Saída de Praia Maré Sunset", cat: "roupas", marca: "Maré Swim", preco: 15990, cores: ["Coral", "Verde Água"], tamanhos: TAM_ROUPA, desc: "Saída de praia em sarja leve com bordado discreto e cordão ajustável." },
  { t: "Mochila Vela Urban 20L", cat: "acessorios", marca: "Vela Home", preco: 19990, cores: ["Preto", "Verde Musgo"], tamanhos: UNICO, desc: "Mochila urbana com compartimento para notebook de 15 polegadas, costura impermeável e alças acolchoadas." },
  { t: "Bolsa Transversal Vela Everyday", cat: "acessorios", marca: "Vela Home", preco: 14990, cores: ["Caramelo", "Preto"], tamanhos: UNICO, desc: "Bolsa transversal em material antiderrapante com fecho magnético e bolso interno forrado." },
  { t: "Relógio Estúdio Linha Minimal", cat: "acessorios", marca: "Estúdio Linha", preco: 27990, cores: ["Prata", "Dourado"], tamanhos: UNICO, desc: "Relógio de pulso minimalista com caixa em aço inox de 38 mm e pulseira intercambiável." },
  { t: "Jogo de Panelas Ferro & Aço Inox 10 Peças", cat: "cozinha", marca: "Ferro & Aço", preco: 69990, cores: ["Inox"], tamanhos: UNICO, desc: "Jogo de panelas em inox 18/10 com fundo triplo e tampas de vidro temperado. Indução e fogão convencional." },
  { t: "Frigideira Ferro & Aço Antiaderente 28cm", cat: "cozinha", marca: "Ferro & Aço", preco: 15990, cores: ["Preto"], tamanhos: UNICO, desc: "Frigideira antiaderente sem PFOA com cabo de baquelite e base magnética para indução." },
  { t: "Cafeteira Vela Prensagem Manual", cat: "cozinha", marca: "Vela Home", preco: 12990, cores: ["Preto", "Inox"], tamanhos: UNICO, desc: "Cafeteira de prensagem francesa com vidro borossilicato e filtro de aço inox. Capacidade de 1 litro." },
  { t: "Jogo de Lençol Doce Lar 400 Fios", cat: "moveis-decoracao", marca: "Doce Lar", preco: 25990, cores: ["Branco", "Cinza Champanhe", "Azul Sereno"], tamanhos: ["Casal", "Queen", "King"], desc: "Lençol de algodão egípcio 400 fios com elástico embutido e toque gelado. Não desbota na lavagem." },
  { t: "Luminária de Mesa Estúdio Linha Arco", cat: "moveis-decoracao", marca: "Estúdio Linha", preco: 32990, cores: ["Preto", "Off-white"], tamanhos: UNICO, desc: "Luminária articulada com LED 2700K dimmável e base em concreto polido. Cabo têxtil de 1,8 m." },
  { t: "Ventilador de Teto Vela Breeze 5 Pálas", cat: "moveis-decoracao", marca: "Vela Home", preco: 45990, cores: ["Branco", "Madeira"], tamanhos: UNICO, desc: "Ventilador de teto silencioso com 3 velocidades, madeira natural nas pálas e controle remoto." },
  { t: "Fone Bluetooth Nuvem Pods Pro", cat: "audio", marca: "Nuvem Tech", preco: 39990, cores: ["Branco", "Preto"], tamanhos: UNICO, desc: "Fone intra-auricular com cancelamento ativo de ruído, 32 h de bateria com o estojo e certificação IPX5." },
  { t: "Caixa de Som Nuvem Boom 2 Portátil", cat: "audio", marca: "Nuvem Tech", preco: 54990, cores: ["Azul Noite", "Cinza"], tamanhos: UNICO, desc: "Caixa de som portátil à prova d'água com graves reforçados, 20 h de bateria e emparelhamento estéreo." },
  { t: "Fone com Fio Nuvem Studio Monitor", cat: "audio", marca: "Nuvem Tech", preco: 29990, cores: ["Preto"], tamanhos: UNICO, desc: "Fone over-ear de monitoração com drivers de 40 mm, cabo destacável e almofadas de espuma viscoelástica." },
  { t: "Carregador Nuvem Turbo 65W USB-C", cat: "acessorios-tech", marca: "Nuvem Tech", preco: 14990, cores: ["Branco", "Preto"], tamanhos: UNICO, desc: "Carregador GaN compacto com 2 portas USB-C e 1 USB-A, Power Delivery até 65 W." },
  { t: "Smartwatch Nuvem Fit 2", cat: "acessorios-tech", marca: "Nuvem Tech", preco: 79990, cores: ["Preto", "Rosé"], tamanhos: ["41mm", "45mm"], desc: "Smartwatch com GPS integrado, monitoramento de sono e SpO2, 10 dias de bateria e tela AMOLED sempre ativa." },
  { t: "Bola de Vôlei Aurora Pro Costurada", cat: "fitness", marca: "Aurora Sport", preco: 13990, cores: ["Azul e Branco", "Amarelo e Preto"], tamanhos: UNICO, desc: "Bola de vôlei tamanho 5 com costura em couro sintético e câmara de butil. Aprovada para treino e jogo." },
  { t: "Kit Halter Ferro & Aço Ajustável 20kg", cat: "fitness", marca: "Ferro & Aço", preco: 34990, cores: ["Preto"], tamanhos: UNICO, desc: "Par de halteres ajustáveis com anilhas revestidas e barras emborrachadas. Substitui 15 pesos diferentes." },
  { t: "Corda Pular Ferro & Aço Speed", cat: "fitness", marca: "Ferro & Aço", preco: 5990, cores: ["Preto", "Vermelho"], tamanhos: UNICO, desc: "Corda de pulo com cabo em PVC e rolamentos de aço. Comprimento ajustável até 3 m." },
  { t: "Garrafa Térmica Ferro & Aço 1L", cat: "fitness", marca: "Ferro & Aço", preco: 11990, cores: ["Inox", "Verde Tática"], tamanhos: UNICO, desc: "Garrafa térmica de parede dupla que mantém bebida gelada por 24 h. Bico com trava e alça." },
  { t: "Barraca Camping Sertão Teto 4 Pessoas", cat: "camping", marca: "Sertão Calçados", preco: 59990, cores: ["Verde Militar", "Areia"], tamanhos: UNICO, desc: "Barraca com duas entradas, toldo frontal, piso em poliéster 190T e bolsa de compactação. Montagem em 10 min." },
  { t: "Saco de Dormir Sertão Inverno 0 Graus", cat: "camping", marca: "Sertão Calçados", preco: 38990, cores: ["Cinza", "Azul"], tamanhos: UNICO, desc: "Saco de dormir sintético com conforto até 0 graus, capuz ajustável e zíper com corta-vento." },
  { t: "Sérum Vitamina C Botica Verde 30ml", cat: "skincare", marca: "Botica Verde", preco: 8990, cores: ["Ámbar"], tamanhos: UNICO, desc: "Sérum com 15% de vitamina C estabilizada, vitamina E e ácido ferúlico. Clareia manchas e uniformiza o tom." },
  { t: "Hidratante Botica Verde Cera de Cupuaçu", cat: "skincare", marca: "Botica Verde", preco: 6990, cores: ["Branco"], tamanhos: UNICO, desc: "Hidratante corporal com manteiga de cupuaçu e aveia coloidal. Dermatologicamente testado e vegano." },
  { t: "Protetor Solar Botica Verde Toque Seco FPS 70", cat: "skincare", marca: "Botica Verde", preco: 7990, cores: ["Incolor"], tamanhos: UNICO, desc: "Protetor solar facial de toque seco, FPS 70, sem deixar resíduo branco. Resistente à água." },
  { t: "Shampoo Botica Verde Antióleosidade", cat: "cabelo", marca: "Botica Verde", preco: 4990, cores: ["Verde"], tamanhos: ["250ml", "500ml"], desc: "Shampoo com zinco e cânhamo para cabelos oleosos. Sem silicones e com pH equilibrado." },
  { t: "Máscara Botica Verde Reconstrução Capilar", cat: "cabelo", marca: "Botica Verde", preco: 5990, cores: ["Off-white"], tamanhos: UNICO, desc: "Máscara de reconstrução com queratina vegetal e óleo de rícino. Uso semanal, 3 minutos." },
  { t: "Kit Blocos Educativos Ponto 120 Peças", cat: "educativos", marca: "Papelaria Ponto", preco: 8990, cores: ["Multicolorido"], tamanhos: UNICO, desc: "Blocos de montar compatíveis com as principais marcas, em plástico atóxico. Estimula coordenação motora." },
  { t: "Carro de Controle Remoto Ponto Turbo", cat: "educativos", marca: "Papelaria Ponto", preco: 15990, cores: ["Vermelho", "Azul"], tamanhos: UNICO, desc: "Carro 4x4 com controle de 2,4 GHz, autonomia de 25 min e bateria recarregável inclusa." },
  { t: "Dominó Gigante Ponto Praia", cat: "educativos", marca: "Papelaria Ponto", preco: 11990, cores: ["Madeira"], tamanhos: UNICO, desc: "Dominó de madeira com peças de 10 cm e saco de lona para levar ao parque. Regras inclusas." },
];

async function main() {
  console.log("Limpando dados antigos...");
  await db.$transaction([
    db.answer.deleteMany(), db.question.deleteMany(), db.reviewPhoto.deleteMany(),
    db.review.deleteMany(), db.productVariant.deleteMany(), db.productImage.deleteMany(),
    db.product.deleteMany(), db.category.deleteMany(), db.brand.deleteMany(),
    // etapa 2: pedidos e dependências (antes dos usuários, por causa das FKs)
    db.pagamento.deleteMany(), db.orderEvent.deleteMany(), db.orderItem.deleteMany(),
    db.order.deleteMany(), db.address.deleteMany(), db.coupon.deleteMany(),
    db.session.deleteMany(), db.account.deleteMany(), db.verification.deleteMany(), db.user.deleteMany(),
  ]);

  console.log("Categorias...");
  const catMap = new Map<string, string>();
  for (const c of categorias) {
    const pai = await db.category.create({ data: { slug: c.slug, name: c.name } });
    for (const f of c.children) {
      const filha = await db.category.create({ data: { slug: f.slug, name: f.name, parentId: pai.id } });
      catMap.set(f.slug, filha.id);
    }
  }

  console.log("Marcas...");
  const marcaMap = new Map<string, string>();
  for (const m of marcas) {
    const b = await db.brand.create({ data: { slug: slugify(m), name: m } });
    marcaMap.set(m, b.id);
  }

  console.log("Usuários...");
  // mesmo hasher do Better Auth (scrypt) — sem isso o login do seed falharia
  const hashSenha = await hashPassword(SENHA);
  const criarUsuario = (data: { email: string; name: string; role: "BUYER" | "SELLER" | "ADMIN"; sellerSlug?: string; sellerBio?: string; image?: string }) => {
    const id = crypto.randomUUID();
    return db.user.create({
      data: {
        id, emailVerified: true, ...data,
        // accountId deve ser o id do usuário: better-auth v1.7 compara os dois no sign-in
        accounts: { create: { id: crypto.randomUUID(), accountId: id, providerId: "credential", password: hashSenha } },
      },
    });
  };

  await criarUsuario({ email: "admin@loja.dev", name: "Alice Admin", role: "ADMIN" });
  const vendedoras = [
    { email: "vendas@aurora.dev", name: "Bruno Aurora", sellerSlug: "aurora-sport", sellerBio: "Loja oficial Aurora Sport. Corrida e treino desde 2015, com doze lojas físicas no Sul e Sudeste." },
    { email: "contato@botica.dev", name: "Carla Botica", sellerSlug: "botica-verde", sellerBio: "Cosméticos veganos e naturais, formulados em Belo Horizonte. Todos os produtos são testados dermatologicamente." },
    { email: "oi@nuvem.dev", name: "Diego Nuvem", sellerSlug: "nuvem-tech", sellerBio: "Áudio e gadgets com garantia de 12 meses e suporte por WhatsApp em português." },
  ];
  const vendedores = [];
  for (const v of vendedoras) vendedores.push(await criarUsuario({ ...v, role: "SELLER" }));

  const nomes = ["Fernanda Lima", "Gustavo Souza", "Helena Costa", "Igor Martins", "Juliana Alves", "Karina Nunes", "Lucas Pereira", "Mariana Rocha"];
  const compradores = [];
  for (let i = 0; i < nomes.length; i++) {
    compradores.push(await criarUsuario({ email: `comprador${i + 1}@loja.dev`, name: nomes[i], role: "BUYER", image: `/img/avatar-${i + 1}.svg` }));
  }

  console.log("Produtos, variações, imagens, avaliações e perguntas...");
  for (const [i, p] of produtos.entries()) {
    const slug = slugify(p.t).slice(0, 60);
    const seller = vendedores[i % vendedores.length];
    const imagens = [1, 2, 3].map((n) => `/img/${slug}-${n}.svg`);
    for (const [n, url] of imagens.entries()) writeFileSync(path.join(imgDir, path.basename(url)), svgProduto(p.t, n + 1));

    const product = await db.product.create({
      data: {
        slug, title: p.t, description: p.desc, priceCents: p.preco,
        brandId: marcaMap.get(p.marca)!, categoryId: catMap.get(p.cat)!, sellerId: seller.id,
        images: { create: imagens.map((url, n) => ({ url, alt: `${p.t} — foto ${n + 1}`, position: n })) },
        variants: {
          create: p.cores.flatMap((cor) =>
            p.tamanhos.map((tamanho, ti) => ({
              sku: `${slug.slice(0, 8).toUpperCase()}-${cor.slice(0, 3).toUpperCase()}-${tamanho}`,
              color: cor, size: tamanho,
              priceCents: rnd() < 0.15 ? Math.round(p.preco * 0.9) : null,
              stock: ti === p.tamanhos.length - 1 ? int(0, 4) : int(5, 40), // última opção quase esgotada
            }))
          ),
        },
      },
    });

    // avaliações (com fotos em algumas)
    const nAval = int(1, 5);
    const autores = [...compradores].sort(() => rnd() - 0.5).slice(0, nAval);
    const notas: number[] = [];
    for (const autor of autores) {
      const nota = pick([5, 5, 5, 4, 4, 3]);
      notas.push(nota);
      await db.review.create({
        data: {
          productId: product.id, userId: autor.id, rating: nota,
          title: nota >= 4 ? pick(["Excelente", "Recomendo", "Superou expectativas", "Ótima compra"]) : pick(["Bom, mas...", "Mediano"]),
          body: nota >= 5 ? pick([
            "Chegou rápido e a qualidade é ainda melhor que nas fotos. Vou comprar de novo.",
            "Produto igualzinho à descrição, embalagem caprichada. Recomendo demais.",
            "Melhor custo-benefício que encontrei. Uso todo dia e nada de desgaste.",
          ]) : nota === 4 ? pick([
            "Muito bom, só achei o prazo de entrega um pouco longo.",
            "Produto ótimo, mas o tamanho veio um pouco apertado.",
          ]) : pick([
            "Produto ok, mas esperava um acabamento melhor pelo preço.",
            "Atendeu, embora a cor seja diferente da foto.",
          ]),
          photos: rnd() < 0.35 ? { create: [1, 2].map((n) => ({ url: `/img/av-${product.id.slice(-4)}-${n}.svg` })) } : undefined,
        },
      });
    }
    const media = notas.reduce((a, b) => a + b, 0) / notas.length;
    await db.product.update({ where: { id: product.id }, data: { ratingAvg: Math.round(media * 10) / 10, ratingCount: notas.length } });

    // fotos de avaliação (SVGs genéricos)
    for (const rev of await db.review.findMany({ where: { productId: product.id, photos: { some: {} } }, include: { photos: true } })) {
      for (const foto of rev.photos) {
        writeFileSync(path.join(imgDir, path.basename(foto.url)), svgProduto(`${p.t} (na casa do cliente)`, 1));
      }
    }

    // perguntas e respostas
    if (rnd() < 0.5) {
      const q = await db.question.create({
        data: {
          productId: product.id, userId: pick(compradores).id,
          body: pick([
            "Esse produto serve para presente? Vem em embalagem neutra?",
            "Qual o prazo de entrega para Curitiba?",
            "Serve bem o tamanho G? Estou entre G e GG.",
            "Aceita Pix? Tem desconto à vista?",
            "É compatível com carregador de 220V?",
          ]),
        },
      });
      await db.answer.create({
        data: {
          questionId: q.id, userId: seller.id,
          body: pick([
            "Olá! Sim, enviamos em embalagem neutra, sem valores na caixa. Qualquer coisa é só pedir nas observações do pedido.",
            "Trabalhamos com envio em até 1 dia útil; para Curitiba a transportadora leva de 3 a 5 dias úteis.",
            "Recomendamos GG para quem está entre os dois: o caimento é regular.",
            "Aceitamos Pix com 5% de desconto à vista, cartão em até 6x sem juros e boleto.",
            "Sim, é compatível com 110V e 220V. Basta usar o adaptador padrão da sua região.",
          ]),
        },
      });
    }
  }

  for (let i = 1; i <= 8; i++) {
    writeFileSync(path.join(imgDir, `avatar-${i}.svg`), svgFoto(`Cliente ${i}`, i));
  }

  console.log("Cupons, endereço e pedido histórico...");
  await db.coupon.createMany({
    data: [
      { code: "BEMVINDO10", tipo: "PERCENTUAL", valorCents: 1000, minimoCents: 10000, validade: new Date("2027-12-31"), descricao: "10% de desconto (mínimo R$ 100)" },
      { code: "FRETEGRATIS", tipo: "FRETE_GRATIS", minimoCents: 15000, validade: new Date("2027-12-31"), descricao: "Frete grátis (mínimo R$ 150)" },
      { code: "VOLTA15", tipo: "FIXO", valorCents: 1500, minimoCents: 8000, maxUsos: 50, validade: new Date("2027-12-31"), descricao: "R$ 15 de desconto (mínimo R$ 80)" },
    ],
  });

  const compradora = compradores[0]; // comprador1@loja.dev
  await db.address.create({
    data: {
      userId: compradora.id, apelido: "Casa", cep: "01310100",
      logradouro: "Av. Paulista", numero: "1000", complemento: "apto 121",
      bairro: "Bela Vista", cidade: "São Paulo", uf: "SP", padrao: true,
    },
  });

  // pedido histórico entregue: demonstra histórico, rastreio e "comprar de novo"
  const hist = await db.product.findUnique({
    where: { slug: "tenis-de-corrida-aurora-velocity-3" },
    include: { variants: true, images: { orderBy: { position: "asc" } } },
  });
  if (hist && hist.variants[0]) {
    const v = hist.variants[0];
    const preco = v.priceCents ?? hist.priceCents;
    const ha20dias = (dias: number) => new Date(Date.now() - dias * 86_400_000);
    await db.order.create({
      data: {
        codigo: "LB-SEED01",
        status: "DELIVERED",
        userId: compradora.id,
        subtotalCents: preco, freteCents: 1990, descontoCents: 0, totalCents: preco + 1990,
        cep: "01310100", logradouro: "Av. Paulista", numero: "1000", complemento: "apto 121",
        bairro: "Bela Vista", cidade: "São Paulo", uf: "SP",
        rastreio: "BR123456789BR",
        createdAt: ha20dias(20),
        itens: {
          create: [{
            variantId: v.id, sku: v.sku, titulo: hist.title, cor: v.color, tamanho: v.size,
            imagemUrl: hist.images[0]?.url ?? null, precoCents: preco, quantidade: 1,
            sellerId: hist.sellerId,
          }],
        },
        eventos: {
          create: [
            { status: "PENDING", nota: "Pedido criado, aguardando pagamento", createdAt: ha20dias(20) },
            { status: "PAID", nota: "Pagamento confirmado", createdAt: ha20dias(20) },
            { status: "PACKING", nota: "Saiu para separação no centro de distribuição", createdAt: ha20dias(18) },
            { status: "SHIPPED", nota: "Objeto postado — BR123456789BR", createdAt: ha20dias(17) },
            { status: "DELIVERED", nota: "Entregue ao destinatário", createdAt: ha20dias(14) },
          ],
        },
        pagamento: {
          create: { metodo: "PIX", status: "APPROVED", valorCents: preco + 1990, provedor: "mock", externoId: "mock-seed-1" },
        },
      },
    });
  }

  console.log(`Seed concluído: ${produtos.length} produtos. Login: admin@loja.dev / ${SENHA}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
