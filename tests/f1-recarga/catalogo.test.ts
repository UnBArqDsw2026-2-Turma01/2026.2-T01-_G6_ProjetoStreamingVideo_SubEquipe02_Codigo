import { RepositorioEmMemoria } from "../../src/compartilhado";
import { Usuario } from "../../src/dominio";
import { ServicoFinanceiro } from "../../src/financeiro";
import { PACOTES, REPASSE_POR_MOEDA, montarRecarga } from "../../src/f1-recarga";

describe("Catálogo da plataforma", () => {
  test("o desconto cresce com o tamanho do pacote e o preço por moeda só cai", () => {
    const usuarios = new RepositorioEmMemoria<Usuario>();
    usuarios.salvar(new Usuario("u1", "Espectador", "e@exemplo.com"));
    const { controller } = montarRecarga({ gateways: [], financeiro: new ServicoFinanceiro(), usuarios });

    const ofertas = controller.consultarOfertas("u1");
    for (let i = 1; i < ofertas.length; i++) {
      const anterior = ofertas[i - 1]!;
      const atual = ofertas[i]!;
      expect(atual.descontoPercentual!).toBeGreaterThan(anterior.descontoPercentual!);
      const porMoeda = (o: typeof atual) => o.precoPromocional.centavos / o.pacote.quantidadeMoedaVirtual;
      expect(porMoeda(atual)).toBeLessThan(porMoeda(anterior));
    }
  });

  test("o desconto exibido fecha com o preço final: sem desconto − X% = total", () => {
    const usuarios = new RepositorioEmMemoria<Usuario>();
    usuarios.salvar(new Usuario("u1", "Espectador", "e@exemplo.com"));
    const { controller } = montarRecarga({ gateways: [], financeiro: new ServicoFinanceiro(), usuarios });

    for (const oferta of controller.consultarOfertas("u1")) {
      const { precoSemDesconto, descontoPercentual } = oferta;
      const conta = precoSemDesconto.subtrair(precoSemDesconto.percentual(descontoPercentual!));
      expect(conta.formatar()).toBe(oferta.precoPromocional.formatar());
    }
  });

  test("o repasse por moeda nunca passa do preço efetivo de venda de nenhum pacote", () => {
    const usuarios = new RepositorioEmMemoria<Usuario>();
    usuarios.salvar(new Usuario("u1", "Espectador", "e@exemplo.com"));
    const { controller } = montarRecarga({ gateways: [], financeiro: new ServicoFinanceiro(), usuarios });

    const ofertas = controller.consultarOfertas("u1");
    expect(ofertas).toHaveLength(PACOTES.length);
    for (const oferta of ofertas) {
      // Mesmo com bônus e promoção, o espectador paga mais do que o criador recebe.
      const repasseDoPacote = REPASSE_POR_MOEDA.multiplicar(oferta.pacote.quantidadeMoedaVirtual);
      expect(oferta.precoPromocional.centavos).toBeGreaterThanOrEqual(repasseDoPacote.centavos);
    }
  });
});
