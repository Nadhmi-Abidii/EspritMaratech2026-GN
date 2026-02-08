const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip
  };
};

const parseSort = (query = {}, defaultField = 'createdAt') => {
  const sortField = query.sort || defaultField;
  const sortOrder = String(query.order || 'desc').toLowerCase() === 'asc' ? 1 : -1;

  return {
    [sortField]: sortOrder
  };
};

const buildPaginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit) || 1
});

module.exports = {
  parsePagination,
  parseSort,
  buildPaginationMeta
};
