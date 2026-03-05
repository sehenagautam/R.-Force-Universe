export type Product = {
  id: string;
  name: string;
  scientificName: string;
  priceUSD: number;
  packSize: string;
  image: string;
  description: string;
  benefits: string[];
  source: string;
  featured: boolean;
};

export type Subcategory = {
  id: string;
  name: string;
  products: Product[];
};

export type Category = {
  id: string;
  name: string;
  subcategories: Subcategory[];
};

export type Catalog = {
  storeName: string;
  tagline: string;
  categories: Category[];
};
