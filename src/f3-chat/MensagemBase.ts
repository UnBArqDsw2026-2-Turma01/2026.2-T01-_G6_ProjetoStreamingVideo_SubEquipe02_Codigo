import { ErroDominio } from "../dominio";
import type { MensagemDestacada } from "./MensagemDestacada";

/** ConcreteComponent: a mensagem da doação como chegou, sem nenhum destaque aplicado. */
export class MensagemBase implements MensagemDestacada {
  private readonly autor: string;
  private readonly conteudo: string;
  private readonly quantidadeMoedaVirtual: number;

  constructor(autor: string, conteudo: string, quantidadeMoedaVirtual: number) {
    if (autor.trim().length === 0) {
      throw new ErroDominio("A mensagem destacada precisa de um autor.");
    }
    if (!Number.isInteger(quantidadeMoedaVirtual) || quantidadeMoedaVirtual <= 0) {
      throw new ErroDominio(`Quantidade de moeda virtual inválida: ${quantidadeMoedaVirtual}`);
    }
    this.autor = autor;
    this.conteudo = conteudo;
    this.quantidadeMoedaVirtual = quantidadeMoedaVirtual;
  }

  cabecalho(): string {
    return `${this.autor} · ${this.quantidadeMoedaVirtual} de moeda virtual`;
  }

  texto(): string {
    return this.conteudo;
  }

  tempoFixacaoMin(): number {
    return 0;
  }

  descrever(): string {
    return "mensagem";
  }
}
