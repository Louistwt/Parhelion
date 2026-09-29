/** A translation must have exactly the English keys (values are free text). A missing key fails `npm run typecheck`. */
export type Messages<T> = { [K in keyof T]: T[K] extends string ? string : Messages<T[K]> };
