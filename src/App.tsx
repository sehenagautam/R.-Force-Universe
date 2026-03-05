import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { Search, ShoppingCart, X, Plus, Minus } from "lucide-react";
import catalogJson from "./data/jadibuti.json";
import type { Catalog, Product } from "./types";

const catalog = catalogJson as Catalog;

type EnrichedProduct = Product & {
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type StoredUser = {
  name: string;
  email: string;
  password: string;
};

function flattenProducts(data: Catalog): EnrichedProduct[] {
  return data.categories.flatMap((category) =>
    category.subcategories.flatMap((subcategory) =>
      subcategory.products.map((product) => ({
        ...product,
        categoryId: category.id,
        categoryName: category.name,
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name
      }))
    )
  );
}

function getStoredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem("rforce_users");
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users: StoredUser[]) {
  localStorage.setItem("rforce_users", JSON.stringify(users));
}

function getStoredSession(): string | null {
  return localStorage.getItem("rforce_session_email");
}

function saveStoredSession(email: string | null) {
  if (email) {
    localStorage.setItem("rforce_session_email", email);
    return;
  }
  localStorage.removeItem("rforce_session_email");
}

function toOptimizedSource(src: string) {
  if (!src.endsWith(".png")) return src;
  return src.replace(/^\/(.+)\.png$/, "/optimized/$1.jpg");
}

export default function App() {
  const CONTACT_PHONE_DISPLAY = "+977 9851406494";
  const CONTACT_PHONE_RAW = "9779851406494";

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSubcategory, setActiveSubcategory] = useState<string>("all");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<"home" | "contact">("home");

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [authError, setAuthError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [sessionEmail, setSessionEmail] = useState<string | null>(() => getStoredSession());

  const allProducts = useMemo(() => flattenProducts(catalog), []);
  const productById = useMemo(
    () => new Map(allProducts.map((product) => [product.id, product])),
    [allProducts]
  );

  const currentUser = useMemo(() => {
    if (!sessionEmail) return null;
    return getStoredUsers().find((user) => user.email === sessionEmail) ?? null;
  }, [sessionEmail]);

  const subcategoryOptions = useMemo(() => {
    if (activeCategory === "all") {
      return catalog.categories.flatMap((cat) => cat.subcategories);
    }
    return (
      catalog.categories.find((cat) => cat.id === activeCategory)?.subcategories ?? []
    );
  }, [activeCategory]);

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return allProducts.filter((product) => {
      const byCategory =
        activeCategory === "all" || product.categoryId === activeCategory;
      const bySubcategory =
        activeSubcategory === "all" || product.subcategoryId === activeSubcategory;

      const searchableText = [
        product.name,
        product.scientificName,
        product.description,
        ...product.benefits,
        product.categoryName,
        product.subcategoryName
      ]
        .join(" ")
        .toLowerCase();

      const bySearch = keyword.length === 0 || searchableText.includes(keyword);

      return byCategory && bySubcategory && bySearch;
    });
  }, [allProducts, query, activeCategory, activeSubcategory]);

  const featured = allProducts.filter((p) => p.featured).slice(0, 4);

  const detailedCart = cartItems
    .map((item) => {
      const product = productById.get(item.productId);
      if (!product) return null;
      return {
        product,
        quantity: item.quantity,
        lineTotal: product.priceUSD * item.quantity
      };
    })
    .filter(Boolean) as { product: EnrichedProduct; quantity: number; lineTotal: number }[];

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = detailedCart.reduce((sum, item) => sum + item.lineTotal, 0);
  const selectedProduct =
    selectedProductId !== null ? productById.get(selectedProductId) ?? null : null;

  const addToCart = (productId: string) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQty = (productId: string, nextQty: number) => {
    setCartItems((prev) => {
      if (nextQty <= 0) return prev.filter((item) => item.productId !== productId);
      return prev.map((item) =>
        item.productId === productId ? { ...item, quantity: nextQty } : item
      );
    });
  };

  const clearCart = () => setCartItems([]);

  const closeAuth = () => {
    setAuthMode(null);
    setAuthError("");
    setName("");
    setEmail("");
    setPassword("");
  };

  const handleSignup = () => {
    setAuthError("");
    if (!name.trim() || !email.trim() || password.length < 6) {
      setAuthError("Enter name, valid email, and password (min 6 characters).");
      return;
    }

    const users = getStoredUsers();
    const exists = users.some((user) => user.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      setAuthError("This email is already registered. Please login.");
      return;
    }

    const newUser: StoredUser = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password
    };

    saveStoredUsers([...users, newUser]);
    saveStoredSession(newUser.email);
    setSessionEmail(newUser.email);
    closeAuth();
  };

  const handleLogin = () => {
    setAuthError("");
    const user = getStoredUsers().find(
      (candidate) =>
        candidate.email.toLowerCase() === email.trim().toLowerCase() &&
        candidate.password === password
    );

    if (!user) {
      setAuthError("Invalid email or password.");
      return;
    }

    saveStoredSession(user.email);
    setSessionEmail(user.email);
    closeAuth();
  };

  const logout = () => {
    saveStoredSession(null);
    setSessionEmail(null);
  };

  const openHomeAndScroll = (sectionId: "home-top" | "featured-products" | "categories-section") => {
    setActivePage("home");
    setSelectedProductId(null);
    setTimeout(() => {
      if (sectionId === "home-top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 10);
  };

  const openSearch = () => {
    setActivePage("home");
    setSelectedProductId(null);
    setTimeout(() => {
      const input = document.getElementById("search-input") as HTMLInputElement | null;
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        input.focus();
      }
    }, 10);
  };

  return (
    <div className="min-h-screen bg-slate-200 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <div>
            <p className="text-2xl font-bold tracking-tight text-sky-700 md:text-3xl">R. Force Universe</p>
          </div>

          <ul className="hidden items-center gap-8 text-lg font-semibold text-slate-700 md:flex">
            <li>
              <button
                onClick={() => openHomeAndScroll("home-top")}
                className="transition hover:text-slate-900"
              >
                Home
              </button>
            </li>
            <li>
              <button
                onClick={() => openHomeAndScroll("featured-products")}
                className="transition hover:text-slate-900"
              >
                Products
              </button>
            </li>
            <li>
              <button
                onClick={() => openHomeAndScroll("categories-section")}
                className="transition hover:text-slate-900"
              >
                Categories
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActivePage("contact");
                  setSelectedProductId(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="transition hover:text-slate-900"
              >
                Contact
              </button>
            </li>
          </ul>

          <div className="flex items-center gap-3 text-slate-700">
            <button
              aria-label="Open cart"
              onClick={() => setIsCartOpen(true)}
              className="relative rounded-lg p-2 transition hover:bg-slate-100"
            >
              <ShoppingCart size={26} />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>

            {currentUser ? (
              <>
                <span className="hidden text-sm font-semibold md:inline">Hi, {currentUser.name}</span>
                <button
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:bg-slate-50"
                  onClick={logout}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  className="hidden rounded-xl px-3 py-2 text-lg font-semibold transition hover:bg-slate-100 md:block"
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
                <button
                  className="rounded-xl bg-sky-600 px-4 py-2 text-lg font-semibold text-white transition hover:bg-sky-700"
                  onClick={() => setAuthMode("signup")}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      {activePage === "home" ? (
        <>
          <section
            id="home-top"
            className="border-b border-slate-200 bg-slate-200 px-4 py-14 text-center md:px-8 md:py-16"
          >
            <h1 className="text-5xl font-extrabold tracking-tight md:text-7xl">{catalog.storeName}</h1>
            <p className="mt-4 text-2xl text-slate-600 md:text-4xl">{catalog.tagline}</p>
          </section>

          <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-14">
        {selectedProduct === null && (
          <section className="mb-10 rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-sm md:px-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                  Refined Himalayan Selections
                </p>
                <h2 className="mt-2 text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
                  Explore authentic jadibuti with a clean, modern shopping experience
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
                  Thoughtfully organized herbs, dedicated product detail pages, and seamless cart
                  flow designed for clarity.
                </p>
              </div>

              <button
                onClick={() =>
                  document
                    .getElementById("featured-products")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="h-11 rounded-xl bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                View Collection
              </button>
            </div>

            <div className="my-6 h-px bg-slate-200" />

            <div className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3 font-medium text-slate-700">
                Categorized herbs with structured navigation
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 font-medium text-slate-700">
                Click any product for dedicated detail view
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 font-medium text-slate-700">
                Smooth add-to-cart with quantity controls
              </div>
            </div>
          </section>
        )}

        {selectedProduct ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
            <button
              onClick={() => setSelectedProductId(null)}
              className="mb-5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Back to Products
            </button>
            <div className="grid gap-6 md:grid-cols-2">
              <SmartProductImage
                src={selectedProduct.image}
                alt={`${selectedProduct.name} (${selectedProduct.scientificName})`}
                className="h-80 w-full rounded-2xl object-cover md:h-[460px]"
                loading="eager"
              />
              <div>
                <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                  {selectedProduct.name}
                </h2>
                <p className="mt-1 text-base italic text-slate-500">
                  {selectedProduct.scientificName}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                  <span className="text-sm text-slate-600">{selectedProduct.packSize}</span>
                  <span className="text-2xl font-bold text-sky-700">
                    ${selectedProduct.priceUSD.toFixed(2)}
                  </span>
                </div>
                <p className="mt-5 text-base leading-7 text-slate-600">
                  {selectedProduct.description}
                </p>
                <div className="mt-5">
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Benefits
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.benefits.map((benefit) => (
                      <span
                        key={benefit}
                        className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => addToCart(selectedProduct.id)}
                  className="mt-6 rounded-lg bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Add to Cart
                </button>
                <p className="mt-4 text-xs text-slate-400">
                  Price reference: {selectedProduct.source}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section id="featured-products">
              <h2 className="text-4xl font-bold text-slate-900 md:text-5xl">Featured Products</h2>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {featured.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    compact
                    onAddToCart={addToCart}
                    onOpenProduct={setSelectedProductId}
                  />
                ))}
              </div>
            </section>

            <section
              id="categories-section"
              className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 md:p-8"
            >
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
                  Browse All Jadibuti
                </h2>
                <p className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                  {filteredProducts.length} products found
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-6">
                <label className="relative block lg:col-span-3">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    id="search-input"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search herbs, scientific names, or benefits"
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none ring-sky-400 transition focus:ring-2"
                  />
                </label>

                <select
                  value={activeCategory}
                  onChange={(e) => {
                    setActiveCategory(e.target.value);
                    setActiveSubcategory("all");
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none ring-sky-400 focus:ring-2 lg:col-span-1"
                >
                  <option value="all">All Categories</option>
                  {catalog.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>

                <select
                  value={activeSubcategory}
                  onChange={(e) => setActiveSubcategory(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none ring-sky-400 focus:ring-2 lg:col-span-2"
                >
                  <option value="all">All Subcategories</option>
                  {subcategoryOptions.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    onOpenProduct={setSelectedProductId}
                  />
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <p className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-base text-slate-500">
                  No products available at the moment.
                </p>
              )}
            </section>
          </>
        )}
          </main>
        </>
      ) : (
        <ContactPage
          phoneDisplay={CONTACT_PHONE_DISPLAY}
          phoneRaw={CONTACT_PHONE_RAW}
          onGoHome={() => openHomeAndScroll("home-top")}
        />
      )}

      <footer className="mt-12 border-t border-slate-200 bg-white text-slate-700">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-8">
          <div>
            <p className="text-xl font-semibold text-sky-700">R. Force Universe</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Himalayan Jadibuti Store
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Store</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>
                <button
                  onClick={() => openHomeAndScroll("home-top")}
                  className="transition hover:text-slate-900"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => openHomeAndScroll("featured-products")}
                  className="transition hover:text-slate-900"
                >
                  Products
                </button>
              </li>
              <li>
                <button
                  onClick={() => openHomeAndScroll("categories-section")}
                  className="transition hover:text-slate-900"
                >
                  Categories
                </button>
              </li>
              <li>
                <button onClick={openSearch} className="transition hover:text-slate-900">
                  Search
                </button>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Compliance Note</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Product descriptions share traditional wellness context and are not medical
              diagnosis or treatment claims.
            </p>
          </div>
        </div>
        <p className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} R. Force Universe. All rights reserved.
        </p>
      </footer>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex bg-slate-900/40" onClick={() => setIsCartOpen(false)}>
          <aside
            className="ml-auto h-full w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900">Your Cart</h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {detailedCart.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Your cart is empty.
              </p>
            ) : (
              <>
                <div className="space-y-4">
                  {detailedCart.map(({ product, quantity, lineTotal }) => (
                    <div key={product.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-800">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.packSize}</p>
                          <p className="text-xs text-slate-500">${product.priceUSD.toFixed(2)} each</p>
                        </div>
                        <p className="font-bold text-sky-700">${lineTotal.toFixed(2)}</p>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-100"
                          onClick={() => updateQty(product.id, quantity - 1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
                        <button
                          className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-100"
                          onClick={() => updateQty(product.id, quantity + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4">
                  <div className="mb-4 flex items-center justify-between text-base font-bold text-slate-800">
                    <span>Total</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                  <button className="mb-2 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700">
                    Proceed to Checkout
                  </button>
                  <button
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={clearCart}
                  >
                    Clear Cart
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {authMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(2,6,23,0.25)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900">{authMode === "login" ? "Login" : "Create Account"}</h3>
              <button
                onClick={closeAuth}
                className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {authMode === "signup" && (
              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Full Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-400 focus:ring-2"
                  placeholder="Your full name"
                />
              </label>
            )}

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-400 focus:ring-2"
                placeholder="you@example.com"
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-400 focus:ring-2"
                placeholder="******"
              />
            </label>

            {authError && <p className="mb-3 text-sm font-medium text-red-600">{authError}</p>}

            <button
              onClick={authMode === "login" ? handleLogin : handleSignup}
              className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              {authMode === "login" ? "Login" : "Sign Up"}
            </button>

            <button
              onClick={() => {
                setAuthError("");
                setAuthMode(authMode === "login" ? "signup" : "login");
              }}
              className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {authMode === "login"
                ? "Need an account? Sign up"
                : "Already have an account? Login"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SmartProductImage({
  src,
  alt,
  className,
  loading
}: {
  src: string;
  alt: string;
  className: string;
  loading: "lazy" | "eager";
}) {
  const [displaySrc, setDisplaySrc] = useState(encodeURI(toOptimizedSource(src)));
  const [didTrim, setDidTrim] = useState(false);

  useEffect(() => {
    setDisplaySrc(encodeURI(toOptimizedSource(src)));
    setDidTrim(false);
  }, [src]);

  const handleError = () => {
    const fallback = encodeURI(src);
    if (displaySrc !== fallback) {
      setDisplaySrc(fallback);
    }
  };

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    if (didTrim) return;

    const img = event.currentTarget;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) {
      setDidTrim(true);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      setDidTrim(true);
      return;
    }

    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const threshold = 22;

    const isVisiblePixel = (x: number, y: number) => {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      return a > 15 && (r > threshold || g > threshold || b > threshold);
    };

    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;

    while (top < height) {
      let found = false;
      for (let x = 0; x < width; x += 1) {
        if (isVisiblePixel(x, top)) {
          found = true;
          break;
        }
      }
      if (found) break;
      top += 1;
    }

    while (bottom >= top) {
      let found = false;
      for (let x = 0; x < width; x += 1) {
        if (isVisiblePixel(x, bottom)) {
          found = true;
          break;
        }
      }
      if (found) break;
      bottom -= 1;
    }

    while (left < width) {
      let found = false;
      for (let y = top; y <= bottom; y += 1) {
        if (isVisiblePixel(left, y)) {
          found = true;
          break;
        }
      }
      if (found) break;
      left += 1;
    }

    while (right >= left) {
      let found = false;
      for (let y = top; y <= bottom; y += 1) {
        if (isVisiblePixel(right, y)) {
          found = true;
          break;
        }
      }
      if (found) break;
      right -= 1;
    }

    const trimW = right - left + 1;
    const trimH = bottom - top + 1;
    const fullArea = width * height;
    const trimmedArea = trimW * trimH;

    if (trimW <= 0 || trimH <= 0 || trimmedArea >= fullArea * 0.995) {
      setDidTrim(true);
      return;
    }

    const trimmedCanvas = document.createElement("canvas");
    trimmedCanvas.width = trimW;
    trimmedCanvas.height = trimH;
    const trimmedCtx = trimmedCanvas.getContext("2d");
    if (!trimmedCtx) {
      setDidTrim(true);
      return;
    }

    trimmedCtx.drawImage(canvas, left, top, trimW, trimH, 0, 0, trimW, trimH);
    const cleanSrc = trimmedCanvas.toDataURL("image/jpeg", 0.82);
    setDisplaySrc(cleanSrc);
    setDidTrim(true);
  };

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}

function ContactPage({
  phoneDisplay,
  phoneRaw,
  onGoHome
}: {
  phoneDisplay: string;
  phoneRaw: string;
  onGoHome: () => void;
}) {
  const whatsappHref = `https://wa.me/${phoneRaw}?text=${encodeURIComponent(
    "Hi, I want to know more about your jadibuti products."
  )}`;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
          Contact Us
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">R. Force Universe</h1>
        <p className="mt-3 text-base text-slate-600">
          For orders, bulk inquiries, and product information, contact us directly.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
            Phone Number
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{phoneDisplay}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            Chat on WhatsApp
          </a>
          <a
            href={`tel:${phoneRaw}`}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Call Now
          </a>
          <button
            onClick={onGoHome}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Home
          </button>
        </div>
      </section>
    </main>
  );
}

function ProductCard({
  product,
  compact,
  onAddToCart,
  onOpenProduct
}: {
  product: EnrichedProduct;
  compact?: boolean;
  onAddToCart: (productId: string) => void;
  onOpenProduct: (productId: string) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
      <div className="relative overflow-hidden">
        <SmartProductImage
          src={product.image}
          alt={`${product.name} (${product.scientificName})`}
          className={`w-full object-cover transition duration-500 group-hover:scale-[1.03] ${compact ? "h-44" : "h-52"}`}
          loading="lazy"
        />
        <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 backdrop-blur">
          {product.packSize}
        </div>
        <button
          onClick={() => onOpenProduct(product.id)}
          className="absolute inset-0"
          aria-label={`Open ${product.name}`}
        />
      </div>

      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              onClick={() => onOpenProduct(product.id)}
              className="text-left text-xl font-bold text-slate-900 hover:text-sky-700"
            >
              {product.name}
            </button>
            <p className="text-xs italic text-slate-500">{product.scientificName}</p>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-right">
            <p className="text-lg font-bold text-sky-700">${product.priceUSD.toFixed(2)}</p>
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-600">{product.description}</p>

        {!compact && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Benefits</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.benefits.map((benefit) => (
                <span
                  key={benefit}
                  className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700"
                >
                  {benefit}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-400">Price reference: {product.source}</p>
          <button
            onClick={() => onAddToCart(product.id)}
            className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}
