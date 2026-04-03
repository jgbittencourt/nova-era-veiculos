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
];
