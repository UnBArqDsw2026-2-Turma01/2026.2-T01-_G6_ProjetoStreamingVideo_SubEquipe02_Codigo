import { ErroDominio } from "../dominio";
import type { MensagemDestacada } from "./MensagemDestacada";
import { MensagemDecorator } from "./MensagemDecorator";

/** ConcreteDecorator: fixa a mensagem no topo do chat pelo tempo da faixa (SC01). */
export class ComFixacao extends MensagemDecorator {
  private readonly minutos: number;

  constructor(interna: MensagemDestacada, minutos: number) {
    super(interna);
    if (!Number.isInteger(minutos) || minutos <= 0) {
      throw new ErroDominio(`O tempo de fixação deve ser um número inteiro positivo de minutos: ${minutos}`);
    }
    this.minutos = minutos;
  }

  override cabecalho(): string {
    return `${this.interna.cabecalho()} · fixada por ${this.duracao()}`;
  }

  override tempoFixacaoMin(): number {
    return this.minutos;
  }

  override descrever(): string {
    return `${this.interna.descrever()} → fixação de ${this.duracao()}`;
  }

  /** Mostra horas cheias em horas (300 min → "5 h") e o resto em minutos. */
  private duracao(): string {
    return this.minutos >= 60 && this.minutos % 60 === 0 ? `${this.minutos / 60} h` : `${this.minutos} min`;
  }
}
