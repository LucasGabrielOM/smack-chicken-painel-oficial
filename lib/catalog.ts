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
  { id: 1, name: "Balde Smack 12", description: "12 tiras crocantes + 3 molhos", priceCents: 4990, category: "Baldes", image: "/balde.jpeg", featured: true },
  { id: 2, name: "Combo Crocante", description: "8 tiras + batata + refrigerante", priceCents: 4290, category: "Combos", image: "/combo.jpeg", featured: true },
  { id: 3, name: "Balde Família 20", description: "20 tiras crocantes + 4 molhos", priceCents: 6990, category: "Baldes", image: "/combo-zero.jpeg", featured: true },
  { id: 4, name: "Smack Individual", description: "5 tiras + batata + molho", priceCents: 2790, category: "Combos", image: "/molho.jpeg", featured: true },
  { id: 5, name: "Batata Crocante", description: "Porção grande, serve 2 pessoas", priceCents: 1690, category: "Porções", image: "/balde-mesa.jpeg" },
  { id: 6, name: "Molho da Casa", description: "Alho, barbecue ou picante", priceCents: 350, category: "Extras", image: "/molho.jpeg" },
  { id: 7, name: "Coca-Cola 350 ml", description: "Lata gelada", priceCents: 700, category: "Bebidas", image: "/combo.jpeg" },
  { id: 8, name: "Coca-Cola 600 ml", description: "Garrafa gelada", priceCents: 1000, category: "Bebidas", image: "/combo-zero.jpeg" },
  { id: 9, name: "Monster Energy 473 ml", description: "Energético gelado", priceCents: 1400, category: "Bebidas", image: "/combo-zero.jpeg" },
  { id: 10, name: "Heineken Long Neck", description: "330 ml · venda somente para maiores de 18", priceCents: 1200, category: "Bebidas", image: "/combo.jpeg" },
];

export const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
