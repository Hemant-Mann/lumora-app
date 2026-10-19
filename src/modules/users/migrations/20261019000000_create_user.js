/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  // The user table predates migrations; skip if it was already created by hand
  if (await knex.schema.hasTable('user')) return

  await knex.schema.createTable('user', (t) => {
    t.string('_id', 20).primary()
    t.string('name', 255).notNullable()
    t.string('email', 255).notNullable().unique()
    t.enum('status', ['active', 'inactive']).defaultTo('active')
    t.datetime('created_at').defaultTo(knex.fn.now())
    t.datetime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.dropTable('user')
}
