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
  { id: 4, name: "Combo Pra Dois", description: "Combo completo para duas pessoas", priceCents: 7990, category: "Combos", image: "/combo.jpeg", featured: true },
  { id: 5, name: "Combo Pra Galera", description: "Combo completo para compartilhar com a galera", priceCents: 9899, category: "Combos", image: "/balde-mesa.jpeg", featured: true },
  { id: 6, name: "Mega Combo Família", description: "Mega combo completo para toda a família", priceCents: 13599, category: "Combos", image: "/combo-zero.jpeg", featured: true },
  { id: 7, name: "Batata Frita 250 g", description: "Porção de 250 g de batatas fritas crocantes", priceCents: 1499, category: "Porções", image: "/combo.jpeg" },
  { id: 20, name: "Batata Frita 350 g", description: "Porção de 350 g de batatas fritas crocantes", priceCents: 1999, category: "Porções", image: "/combo.jpeg" },
  { id: 8, name: "Polenta Frita 250 g", description: "Porção de 250 g de polenta frita crocante", priceCents: 1499, category: "Porções", image: "/balde-mesa.jpeg" },
  { id: 21, name: "Polenta Frita 350 g", description: "Porção de 350 g de polenta frita crocante", priceCents: 1999, category: "Porções", image: "/balde-mesa.jpeg" },
  { id: 9, name: "Coca-Cola Lata 350 ml", description: "Lata gelada", priceCents: 600, category: "Bebidas", image: "/combo.jpeg" },
  { id: 10, name: "Coca-Cola Lata Zero 350 ml", description: "Lata zero açúcar gelada", priceCents: 600, category: "Bebidas", image: "/combo-zero.jpeg" },
  { id: 11, name: "Coca-Cola Original 1,5 L", description: "Garrafa gelada de 1,5 litro", priceCents: 1500, category: "Bebidas", image: "/combo.jpeg" },
  { id: 12, name: "Coca-Cola Zero 1,5 L", description: "Garrafa zero açúcar gelada de 1,5 litro", priceCents: 1500, category: "Bebidas", image: "/combo-zero.jpeg" },
  { id: 13, name: "Guaraná Pureza 1 L", description: "Garrafa gelada de 1 litro", priceCents: 900, category: "Bebidas", image: "/combo.jpeg" },
  { id: 14, name: "Coca-Cola 600 ml", description: "Garrafa gelada de 600 ml", priceCents: 900, category: "Bebidas", image: "/combo.jpeg" },
  { id: 15, name: "Stella Artois Long Neck", description: "330 ml · venda somente para maiores de 18", priceCents: 1100, category: "Bebidas", image: "/combo.jpeg" },
  { id: 16, name: "Heineken Long Neck", description: "330 ml · venda somente para maiores de 18", priceCents: 1400, category: "Bebidas", image: "/combo.jpeg" },
];

export const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
