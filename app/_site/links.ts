// Company pages live on mandiplus.com; Bolo links to the real ones instead of copying them.
const SITE = "https://www.mandiplus.com";

export const MANDIPLUS_PRODUCTS = `${SITE}/products`;

export const FOOTER_LINKS = [
  { label: "Products", href: MANDIPLUS_PRODUCTS },
  { label: "Service charges", href: `${SITE}/pricing` },
  { label: "Support", href: `${SITE}/support` },
  { label: "Privacy", href: `${SITE}/privacy-policy` },
  { label: "Terms", href: `${SITE}/terms-and-conditions` },
] as const;
