/**
 * Build the user list filter from validated query args
 * @param {Object} args - Query args (status, search)
 * @returns {Object} Filter object for userSrv.findRecords
 */
export const buildUserFilter = (args) => {
  const filter = {}

  if (args.status) {
    filter.status = args.status
  }

  if (args.search) {
    filter.name = { operator: 'CONTAINS', value: args.search }
  }

  return filter
}
