export const lumoraCoreMock = () => ({
  InternalServerError: class extends Error {
    constructor(message) {
      super(message)
      this.name = 'InternalServerError'
      this.statusCode = 500
    }
  },
  DuplicateEntryError: class extends Error {
    constructor(message) {
      super(message)
      this.name = 'DuplicateEntryError'
      this.statusCode = 409
    }
  },
})
