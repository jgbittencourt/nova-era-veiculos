"use strict";

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildCarSlug(car) {
  var base = slugify(
    [car.marca, car.modelo, car.versao, car.ano, car.anoModelo, car.id].filter(Boolean).join("-")
  );
  return base || "veiculo-" + car.id;
}

function buildMetaDescription(car) {
  var title = [car.marca, car.modelo, car.versao].filter(Boolean).join(" ");
  var price = car.preco
    ? " por R$ " + Number(car.preco).toLocaleString("pt-BR")
    : "";
  var desc = trimString(car.descricao, 120);
  if (desc) return desc.slice(0, 160);
  return (
    title +
    " " +
    (car.ano || "") +
    price +
    " na Nova Era Veículos BM, Barra Mansa - RJ. Seminovo com fotos reais e atendimento WhatsApp."
  ).slice(0, 160);
}

function trimString(value, maxLen) {
  if (value == null) return "";
  return String(value).trim().slice(0, maxLen);
}

function enrichCarSeo(car) {
  var out = Object.assign({}, car);
  out.slug = out.slug || buildCarSlug(out);
  out.metaDescription = out.metaDescription || buildMetaDescription(out);
  out.ogImage = out.imagem || (Array.isArray(out.imagens) ? out.imagens[0] : "");
  return out;
}

function buildVehicleSchema(car, siteUrl) {
  var name = [car.marca, car.modelo, car.versao].filter(Boolean).join(" ");
  var url = siteUrl ? siteUrl.replace(/\/$/, "") + "/#veiculo-" + car.id : "";
  return {
    "@type": "Car",
    name: name,
    brand: { "@type": "Brand", name: car.marca },
    model: car.modelo,
    vehicleModelDate: String(car.ano || ""),
    mileageFromOdometer: car.km
      ? { "@type": "QuantitativeValue", value: car.km, unitCode: "KMT" }
      : undefined,
    color: car.cor || undefined,
    fuelType: car.combustivel || undefined,
    vehicleTransmission: car.cambio || undefined,
    offers: {
      "@type": "Offer",
      price: car.preco,
      priceCurrency: "BRL",
      availability:
        car.vendido || car.status === "vendido"
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
      url: url || undefined,
    },
    image: car.imagem || undefined,
  };
}

function buildSitemapXml(cars, siteUrl) {
  var base = siteUrl.replace(/\/$/, "");
  var urls = ['  <url>\n    <loc>' + base + '/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>'];
  cars.forEach(function (car) {
    if (car.vendido || car.status === "vendido") {
      urls.push(
        '  <url>\n    <loc>' +
          base +
          "/#veiculo-" +
          car.id +
          "</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>"
      );
    } else {
      urls.push(
        '  <url>\n    <loc>' +
          base +
          "/#veiculo-" +
          car.id +
          "</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>"
      );
    }
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") +
    "\n</urlset>\n"
  );
}

module.exports = {
  slugify: slugify,
  buildCarSlug: buildCarSlug,
  buildMetaDescription: buildMetaDescription,
  enrichCarSeo: enrichCarSeo,
  buildVehicleSchema: buildVehicleSchema,
  buildSitemapXml: buildSitemapXml,
};
