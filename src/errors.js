/** An Error with a `code` the routes map to an HTTP status (src/http.js STATUS), and any other fields it carries. */
export const codedError = (code, message, fields = {}) => Object.assign(new Error(message), { code, ...fields })
