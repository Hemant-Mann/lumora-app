import { useServices, usePathParams, useQueryString } from 'lumora/hooks/index.js'
import { useUserEventService } from '../service.js'
import { responseMapping } from '../mapper.js'

export const userEventList = async ({ services, args }) => {
  const filter = { user_id: args.id }

  const [records, total] = await services.userEventSrv.findRecords({
    services,
    args: { filter, page_no: args.page_no, per_page: args.per_page }
  })

  return {
    success: true,
    events: records.map(responseMapping),
    pagination: {
      page_no: args.page_no,
      per_page: args.per_page,
      total,
    }
  }
}

export const handler = () => [
  useServices({
    ...useUserEventService()
  }),
  usePathParams(z => ({
    id: z.string().min(1),
  })),
  useQueryString(z => ({
    page_no: z.coerce.number().default(1),
    per_page: z.coerce.number().min(10).max(100).default(10),
  })),
  userEventList
]

export default handler
