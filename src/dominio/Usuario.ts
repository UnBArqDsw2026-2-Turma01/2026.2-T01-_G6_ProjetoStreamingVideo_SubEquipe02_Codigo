import { Carteira } from "./Carteira";
import { PerfilMonetizacao } from "./PerfilMonetizacao";

/**
 * Usuário unificado: o mesmo tipo representa espectador e criador.
 * O papel é definido pelas relações (quem doa e quem recebe), e não por herança
 * (decisão de projeto da Entrega 2).
 *
 * A carteira e o perfil são criados junto com o usuário (composição).
 */
export class Usuario {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly carteira: Carteira;
  readonly perfil: PerfilMonetizacao;

  constructor(id: string, nome: string, email: string) {
    this.id = id;
    this.nome = nome;
    this.email = email;
    this.carteira = new Carteira();
    this.perfil = new PerfilMonetizacao();
  }
}
