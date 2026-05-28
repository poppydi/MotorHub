const CATALOG_COLS = 3;
const CATALOG_ROWS = 3;
const CATALOG_PER_PAGE = CATALOG_COLS * CATALOG_ROWS;

function paginateCatalog(items, page) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / CATALOG_PER_PAGE) || 1);
  const safePage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);
  const start = (safePage - 1) * CATALOG_PER_PAGE;
  return {
    items: items.slice(start, start + CATALOG_PER_PAGE),
    page: safePage,
    totalPages,
    total,
    perPage: CATALOG_PER_PAGE,
  };
}

module.exports = { CATALOG_COLS, CATALOG_ROWS, CATALOG_PER_PAGE, paginateCatalog };
