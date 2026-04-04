/**
 * Estoque Nova Era — fotos reais em assets/img/carros/ (.png)
 * Ajuste preço, km e ano conforme a documentação de cada veículo.
 * Campos opcionais: fipe (número), opcionais (array de strings). Sem km → exibe "Sob consulta".
 */
window.NOVA_ERA_CARS = [
  {
    id: 1,
    marca: "Honda",
    modelo: "Fit",
    ano: 2009,
    km: 140000,
    preco: 37000,
    fipe: 41000,
    categoria: "hatch",
    combustivel: "Flex",
    cambio: "Manual",
    imagem: "assets/img/carros/honda-fit-2009-1.png",
    imagens: [
      "assets/img/carros/honda-fit-2009-1.png",
      "assets/img/carros/honda-fit-2009-2.png",
      "assets/img/carros/honda-fit-2009-3.png",
      "assets/img/carros/honda-fit-2009-4.png",
    ],
    emOferta: true,
    destaque: true,
    opcionais: [
      "Ar-condicionado",
      "Bluetooth + navegação",
      "Vidros elétricos",
      "Banco de couro",
      "Documentação em dia, sem multas",
    ],
  },
  {
    id: 2,
    marca: "Ford",
    modelo: "Fiesta",
    ano: 2014,
    km: 177000,
    preco: 25900,
    fipe: 32000,
    categoria: "hatch",
    combustivel: "Flex + GNV",
    cambio: "Manual",
    imagem: "assets/img/carros/ford-fiesta-2014-1.png",
    imagens: [
      "assets/img/carros/ford-fiesta-2014-1.png",
      "assets/img/carros/ford-fiesta-2014-2.png",
      "assets/img/carros/ford-fiesta-2014-3.png",
      "assets/img/carros/ford-fiesta-2014-4.png",
    ],
    emOferta: true,
    destaque: true,
    opcionais: [
      "1.0 completo com GNV — excelente consumo",
      "Única dona",
      "Documentação 100% em dia",
      "Sem multas",
      "Motor em perfeito estado",
      "Ótimo custo-benefício para o dia a dia",
    ],
  },
];
