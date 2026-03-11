export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const getPaginationParams = (query: any): PaginationOptions => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return { page, limit, sortBy, sortOrder };
};

export const getPaginationMeta = (total: number, page: number, limit: number) => {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    hasNext: page < Math.ceil(total / limit),
    hasPrev: page > 1
  };
};
