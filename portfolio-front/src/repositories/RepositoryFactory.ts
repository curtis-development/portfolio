import { BookRepositoryImpl, BookRepository } from "./book"

export const BOOK = Symbol('book')

export interface Repositories{
  [BOOK]: BookRepository
}

export default{
  [BOOK]: new BookRepositoryImpl()
} as Repositories
