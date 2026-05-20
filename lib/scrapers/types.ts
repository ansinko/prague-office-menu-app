export interface MenuItem {
  name: string;
  price: string;
}

export interface Restaurant {
  name: string;
  url: string;
  soup: string | null;
  extra: string | null;
  items: MenuItem[];
  error: string | null;
}

export interface ParseResult {
  soup: string | null;
  extra?: string | null;
  items: MenuItem[];
}
