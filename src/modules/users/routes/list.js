import { useServices, useQueryString } from 'lumora/hooks/index.js'
import { useUserService } from '../service.js'

const hasValidFilters = () => (func) => async (props) => {
  const { args } = props
  const filter = {}

  if (args.status) {
    filter.status = args.status
  }

  if (args.search) {
    filter.name = { operator: 'CONTAINS', value: args.search }
  }

  return await func({
    ...props,
    args: {
      ...props.args,
      filter,
    }
  })
}

export const userList = async ({ services, args }) => {
  const [records, total] = await services.userSrv.findRecords({ services, args })

  return {
    success: true,
    users: records,
    pagination: {
      page_no: args.page_no,
      per_page: args.per_page,
      total,
    }
  }
}

export const handler = () => [
  useServices({
    ...useUserService()
  }),
  useQueryString(z => ({
    page_no: z.coerce.number().default(1),
    per_page: z.coerce.number().min(10).max(100).default(10),
    status: z.string().optional(),
    search: z.string().optional(),
  })),
  hasValidFilters(),
  userList
]

export default handler
