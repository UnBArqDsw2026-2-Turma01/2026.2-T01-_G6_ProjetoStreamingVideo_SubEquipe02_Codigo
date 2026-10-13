/**
 * Erro lançado quando uma regra de negócio do domínio é violada.
 * Permite distinguir falhas de regra (ex.: valor negativo) de falhas técnicas.
 */
export class ErroDominio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDominio";
  }
}
