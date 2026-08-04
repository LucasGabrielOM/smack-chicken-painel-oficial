export type CatalogProduct = {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  image: string;
  featured?: boolean;
};


export const catalog: CatalogProduct[] = [
  { id: 1, name: "Baldinho P 250 g — Tiras Crocantes", description: "250 g de tiras de frango crocantes", priceCents: 2699, category: "Baldes", image: "/balde.jpeg", featured: true },
  { id: 17, name: "Baldinho P 250 g — Coxinha da Asa", description: "250 g de coxinhas da asa crocantes", priceCents: 3599, category: "Baldes", image: "/balde.jpeg", featured: true },
  { id: 2, name: "Balde M 500 g — Tiras Crocantes", description: "500 g de tiras de frango crocantes", priceCents: 5999, category: "Baldes", image: "/balde-mesa.jpeg", featured: true },
  { id: 18, name: "Balde M 500 g — Coxinha da Asa", description: "500 g de coxinhas da asa crocantes", priceCents: 5999, category: "Baldes", image: "/balde-mesa.jpeg", featured: true },
  { id: 3, name: "Balde G 800 g — Tiras Crocantes", description: "800 g de tiras de frango crocantes", priceCents: 8499, category: "Baldes", image: "/combo-zero.jpeg", featured: true },
  { id: 19, name: "Balde G 800 g — Coxinha da Asa", description: "800 g de coxinhas da asa crocantes", priceCents: 7999, category: "Baldes", image: "/combo-zero.jpeg", featured: true },
  { id: 4, name: "Combo Pra Dois", description: "Combo completo para duas pessoas", priceCents: 7990, category: "Combos", image: "https://loremflickr.com/640/480/fried-chicken-combo-two-people?lock=104", featured: true },
  { id: 5, name: "Combo Pra Galera", description: "Combo completo para compartilhar com a galera", priceCents: 9899, category: "Combos", image: "https://loremflickr.com/640/480/fried-chicken-party-combo?lock=105", featured: true },
  { id: 6, name: "Mega Combo Família", description: "Mega combo completo para toda a família", priceCents: 13599, category: "Combos", image: "https://loremflickr.com/640/480/fried-chicken-family-combo?lock=106", featured: true },
  { id: 7, name: "Batata Frita 250 g — Tamanho M", description: "Porção de 250 g de batatas fritas crocantes", priceCents: 1499, category: "Porções", image: "https://loremflickr.com/640/480/french-fries-250g?lock=107" },
  { id: 20, name: "Batata Frita 350 g — Tamanho G", description: "Porção de 350 g de batatas fritas crocantes", priceCents: 1999, category: "Porções", image: "https://loremflickr.com/640/480/french-fries-350g?lock=120" },
  { id: 8, name: "Polenta Frita 250 g — Tamanho M", description: "Porção de 250 g de polenta frita crocante", priceCents: 1499, category: "Porções", image: "https://loremflickr.com/640/480/fried-polenta-250g?lock=108" },
  { id: 21, name: "Polenta Frita 350 g — Tamanho G", description: "Porção de 350 g de polenta frita crocante", priceCents: 1999, category: "Porções", image: "https://loremflickr.com/640/480/fried-polenta-350g?lock=121" },
  { id: 9, name: "Coca-Cola Lata 350 ml", description: "Lata gelada", priceCents: 600, category: "Bebidas", image: "https://loremflickr.com/640/480/coca-cola-can-350ml?lock=109" },
  { id: 10, name: "Coca-Cola Lata Zero 350 ml", description: "Lata zero açúcar gelada", priceCents: 600, category: "Bebidas", image: "https://loremflickr.com/640/480/coca-cola-zero-can-350ml?lock=110" },
  { id: 11, name: "Coca-Cola Original 1,5 L", description: "Garrafa gelada de 1,5 litro", priceCents: 1500, category: "Bebidas", image: "https://loremflickr.com/640/480/coca-cola-bottle-1.5l?lock=111" },
  { id: 12, name: "Coca-Cola Zero 1,5 L", description: "Garrafa zero açúcar gelada de 1,5 litro", priceCents: 1500, category: "Bebidas", image: "https://loremflickr.com/640/480/coca-cola-zero-bottle-1.5l?lock=112" },
  { id: 13, name: "Guaraná Pureza 1 L", description: "Garrafa gelada de 1 litro", priceCents: 900, category: "Bebidas", image: "https://loremflickr.com/640/480/guarana-pureza-bottle?lock=113" },
  { id: 14, name: "Coca-Cola 600 ml", description: "Garrafa gelada de 600 ml", priceCents: 900, category: "Bebidas", image: "https://loremflickr.com/640/480/coca-cola-bottle-600ml?lock=114" },
  { id: 15, name: "Stella Artois Long Neck", description: "330 ml · venda somente para maiores de 18", priceCents: 1100, category: "Bebidas", image: "https://loremflickr.com/640/480/stella-artois-long-neck?lock=115" },
  { id: 16, name: "Heineken Long Neck", description: "330 ml · venda somente para maiores de 18", priceCents: 1400, category: "Bebidas", image: "https://loremflickr.com/640/480/heineken-long-neck?lock=116" },
  { id: 22, name: "Guaraná Lata 350 ml", description: "Lata gelada", priceCents: 600, category: "Bebidas", image: "https://loremflickr.com/640/480/guarana-can-350ml?lock=122" },
  { id: 23, name: "Guaraná Zero Lata 350 ml", description: "Lata zero açúcar gelada", priceCents: 600, category: "Bebidas", image: "https://loremflickr.com/640/480/guarana-zero-can?lock=123" },
  { id: 24, name: "Sprite Lata 350 ml", description: "Lata gelada", priceCents: 600, category: "Bebidas", image: "https://loremflickr.com/640/480/sprite-can-350ml?lock=124" },
  { id: 25, name: "Sprite Zero Lata 350 ml", description: "Lata zero açúcar gelada", priceCents: 600, category: "Bebidas", image: "https://loremflickr.com/640/480/sprite-zero-can?lock=125" },
  { id: 26, name: "Kapo Uva", description: "Bebida de fruta sabor uva", priceCents: 700, category: "Bebidas", image: "https://loremflickr.com/640/480/kapo-grape-juice-box?lock=126" },
  { id: 27, name: "Kapo Morango", description: "Bebida de fruta sabor morango", priceCents: 700, category: "Bebidas", image: "https://loremflickr.com/640/480/kapo-strawberry-juice-box?lock=127" },
  { id: 28, name: "Kapo Laranja", description: "Bebida de fruta sabor laranja", priceCents: 700, category: "Bebidas", image: "https://loremflickr.com/640/480/kapo-orange-juice-box?lock=128" },
  { id: 29, name: "Água sem Gás", description: "Água mineral gelada", priceCents: 400, category: "Bebidas", image: "https://loremflickr.com/640/480/mineral-water-bottle?lock=129" },
  { id: 30, name: "Água com Gás", description: "Água mineral com gás gelada", priceCents: 400, category: "Bebidas", image: "https://loremflickr.com/640/480/sparkling-water-bottle?lock=130" },
  { id: 31, name: "Baly Tradicional", description: "Energético gelado sabor tradicional", priceCents: 1200, category: "Bebidas", image: "https://loremflickr.com/640/480/baly-energy-drink-traditional?lock=131" },
  { id: 32, name: "Baly Tropical", description: "Energético gelado sabor tropical", priceCents: 1200, category: "Bebidas", image: "https://loremflickr.com/640/480/baly-energy-drink-tropical?lock=132" },
  { id: 33, name: "Baly Manga", description: "Energético gelado sabor manga", priceCents: 1200, category: "Bebidas", image: "https://loremflickr.com/640/480/baly-energy-drink-mango?lock=133" },
  { id: 34, name: "Coca-Cola 200 ml", description: "Garrafa pequena gelada", priceCents: 400, category: "Bebidas", image: "https://loremflickr.com/640/480/coca-cola-bottle-200ml?lock=134" },
  { id: 35, name: "Coca-Cola Zero 200 ml", description: "Garrafa pequena zero açúcar gelada", priceCents: 400, category: "Bebidas", image: "https://loremflickr.com/640/480/coca-cola-zero-bottle-200ml?lock=135" },
  { id: 36, name: "Maionese Temperada — Grátis", description: "Escolha até 2 molhos grátis por pedido", priceCents: 0, category: "Molhos", image: "https://loremflickr.com/640/480/seasoned-mayonnaise-sauce?lock=136" },
  { id: 37, name: "Maionese de Alho — Grátis", description: "Escolha até 2 molhos grátis por pedido", priceCents: 0, category: "Molhos", image: "https://loremflickr.com/640/480/garlic-mayonnaise-sauce?lock=137" },
  { id: 38, name: "Pimenta Agridoce — Grátis", description: "Escolha até 2 molhos grátis por pedido", priceCents: 0, category: "Molhos", image: "https://loremflickr.com/640/480/sweet-chili-sauce?lock=138" },
  { id: 39, name: "Barbecue — Grátis", description: "Escolha até 2 molhos grátis por pedido", priceCents: 0, category: "Molhos", image: "https://loremflickr.com/640/480/barbecue-sauce?lock=139" },
  { id: 40, name: "Molho Smack — Grátis", description: "Escolha até 2 molhos grátis por pedido", priceCents: 0, category: "Molhos", image: "https://loremflickr.com/640/480/special-house-sauce?lock=140" },
  { id: 41, name: "Maionese Temperada — Adicional", description: "Molho adicional", priceCents: 400, category: "Molhos", image: "https://loremflickr.com/640/480/seasoned-mayonnaise-sauce?lock=141" },
  { id: 42, name: "Maionese de Alho — Adicional", description: "Molho adicional", priceCents: 400, category: "Molhos", image: "https://loremflickr.com/640/480/garlic-mayonnaise-sauce?lock=142" },
  { id: 43, name: "Pimenta Agridoce — Adicional", description: "Molho adicional", priceCents: 400, category: "Molhos", image: "https://loremflickr.com/640/480/sweet-chili-sauce?lock=143" },
  { id: 44, name: "Barbecue — Adicional", description: "Molho adicional", priceCents: 400, category: "Molhos", image: "https://loremflickr.com/640/480/barbecue-sauce?lock=144" },
  { id: 45, name: "Molho Smack — Adicional", description: "Molho adicional", priceCents: 400, category: "Molhos", image: "https://loremflickr.com/640/480/special-house-sauce?lock=145" },
  { id: 46, name: "Molho de Bacon — Adicional", description: "Molho adicional de bacon", priceCents: 500, category: "Molhos", image: "https://loremflickr.com/640/480/bacon-sauce?lock=146" },
];

export const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
