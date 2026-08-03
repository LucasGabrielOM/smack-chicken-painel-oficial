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
  { id: 1, name: "Baldinho P", description: "Porção pequena de frango crocante", priceCents: 2699, category: "Baldes", image: "/balde.jpeg", featured: true },
  { id: 2, name: "Balde M", description: "Porção média de frango crocante", priceCents: 5999, category: "Baldes", image: "/balde-mesa.jpeg", featured: true },
  { id: 3, name: "Balde G", description: "Porção grande de frango crocante", priceCents: 7999, category: "Baldes", image: "/combo-zero.jpeg", featured: true },
  { id: 4, name: "Combo Pra Dois", description: "Combo completo para duas pessoas", priceCents: 7990, category: "Combos", image: "/combo.jpeg", featured: true },
  { id: 5, name: "Combo Pra Galera", description: "Combo completo para compartilhar com a galera", priceCents: 9899, category: "Combos", image: "/balde-mesa.jpeg", featured: true },
  { id: 6, name: "Mega Combo Família", description: "Mega combo completo para toda a família", priceCents: 13599, category: "Combos", image: "/combo-zero.jpeg", featured: true },
  { id: 7, name: "Batata Frita", description: "Porção de batatas fritas crocantes", priceCents: 0, category: "Porções", image: "/combo.jpeg" },
  { id: 8, name: "Polenta Frita", description: "Porção de polenta frita crocante", priceCents: 0, category: "Porções", image: "/balde-mesa.jpeg" },
  { id: 9, name: "Coca-Cola Lata 350 ml", description: "Lata gelada", priceCents: 799, category: "Bebidas", image: "/combo.jpeg" },
  { id: 10, name: "Coca-Cola Lata Zero 350 ml", description: "Lata zero açúcar gelada", priceCents: 799, category: "Bebidas", image: "/combo-zero.jpeg" },
  { id: 11, name: "Coca-Cola Original 1,5 L", description: "Garrafa gelada de 1,5 litro", priceCents: 1499, category: "Bebidas", image: "/combo.jpeg" },
  { id: 12, name: "Coca-Cola Zero 1,5 L", description: "Garrafa zero açúcar gelada de 1,5 litro", priceCents: 1499, category: "Bebidas", image: "/combo-zero.jpeg" },
  { id: 13, name: "Guaraná Pureza 1 L", description: "Garrafa gelada de 1 litro", priceCents: 899, category: "Bebidas", image: "/combo.jpeg" },
];

export const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
