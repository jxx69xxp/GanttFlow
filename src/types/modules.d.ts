declare module 'frappe-gantt' {
  export default class Gantt {
    constructor(
      element: string | HTMLElement,
      tasks: unknown[],
      options?: Record<string, unknown>,
    )
  }
}

declare module 'crypto-js' {
  const CryptoJS: {
    AES: {
      encrypt(message: string, secret: string): { toString(): string }
      decrypt(ciphertext: string, secret: string): { toString(encoder?: unknown): string }
    }
    enc: { Utf8: unknown }
  }
  export default CryptoJS
}
