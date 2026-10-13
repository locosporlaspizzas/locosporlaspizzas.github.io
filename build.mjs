// Arma la web de Locos por las pizzas a partir de las reseñas cargadas en el panel.
// Lo ejecuta GitHub automáticamente cada vez que se publica algo. No hace falta tocarlo.
import { readFile, writeFile, mkdir, readdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const OUT = '_site';
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, ''); // '' en locosporlaspizzas.github.io
const SITE = (process.env.SITE_URL || 'https://locosporlaspizzas.github.io').replace(/\/$/, '');
const MARCA = 'Locos por las pizzas';

const CATS = [
  ['masa', 'Masa', 25], ['coccion', 'Cocción y base', 20], ['salsa', 'Salsa', 15],
  ['queso', 'Queso', 15], ['ingredientes', 'Ingredientes', 10], ['precio', 'Precio / calidad', 15],
];
const ESCALA = {
  1: 'Ni loco', 2: 'Cuerdo, cuerdo', 3: 'Sin una pizca de locura', 4: 'Apenas un antojo', 5: 'Ni fu ni fa',
  6: 'Un poco tocados', 7: 'Medio locos', 8: 'Bastante locos', 9: 'Locos de remate', 10: 'Locos por esta pizza',
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = (p) => (/^https?:\/\//.test(p) ? p : BASE + (p.startsWith('/') ? p : '/' + p));
const coma = (n) => String(n).replace('.', ',');
const nivel = (n) => Math.max(1, Math.min(10, Math.round(n)));
const fechaLarga = (s) => { const [y, m, d] = String(s).split('-').map(Number); return y && m && d ? `${d} de ${MESES[m - 1]} de ${y}` : ''; };
const fechaCorta = (s) => { const [, m, d] = String(s).split('-').map(Number); return m && d ? `${d} ${MESES[m - 1].slice(0, 3)}` : ''; };

function total(f) {
  let t = 0;
  for (const [k, , peso] of CATS) {
    const v = Number(f?.[k]);
    if (!Number.isFinite(v)) return null;
    t += v * peso;
  }
  return Math.round(t / 10) / 10;
}

function coords(geo) {
  try {
    const g = typeof geo === 'string' ? JSON.parse(geo) : geo;
    if (g && g.type === 'Point' && Array.isArray(g.coordinates)) return { lng: Number(g.coordinates[0]), lat: Number(g.coordinates[1]) };
  } catch { /* sin ubicación */ }
  return { lat: null, lng: null };
}

async function leerResenas() {
  const dir = 'content/resenas';
  if (!existsSync(dir)) return [];
  const archivos = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  const lista = [];
  for (const f of archivos) {
    try {
      const d = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
      if (d.publicar === false) continue;
      const slug = f.replace(/\.json$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      const fecha = String(d.fecha || '').slice(0, 10);
      const nota = total(d.ficha);
      lista.push({ ...d, slug, fecha, nota, ...coords(d.ubicacion), medios: (d.medios || []).filter(Boolean) });
    } catch (e) {
      console.warn('No se pudo leer', f, e.message);
    }
  }
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function pagina({ titulo, descripcion, canonical, imagen, cuerpo, head = '', scripts = '', activo = '' }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
${imagen ? `<meta property="og:image" content="${esc(imagen)}">` : ''}
<link rel="icon" href="${url('/img/locura-10.webp')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${url('/assets/front.css')}">
<link rel="stylesheet" href="${url('/assets/sitio.css')}">
${head}
</head>
<body>
<header class="sitio-cab">
  <div class="sitio-ancho">
    <a class="sitio-logo" href="${url('/')}"><img src="${url('/img/logo.webp')}" alt="${MARCA}" width="120" height="96"></a>
    <nav aria-label="Secciones">
      <a href="${url('/')}"${activo === 'inicio' ? ' aria-current="page"' : ''}>Recorrido</a>
      <a href="${url('/escala/')}"${activo === 'escala' ? ' aria-current="page"' : ''}>Cómo puntuamos</a>
    </nav>
  </div>
</header>
<main class="sitio-ancho">
${cuerpo}
</main>
<footer class="sitio-pie"><div class="sitio-ancho">Reseñas técnicas de pizzerías hechas por un chef. Cada visita la pagamos nosotros.</div></footer>
${scripts}
</body>
</html>`;
}

function carrusel(r) {
  if (!r.medios.length) return '';
  const n = r.medios.length;
  let h = `<div class="pf-carrusel" data-total="${n}"><div class="pf-pista">`;
  r.medios.forEach((m, i) => {
    h += '<div class="pf-slide">' + (VIDEO.test(m)
      ? `<video src="${esc(url(m))}" controls playsinline preload="metadata"></video>`
      : `<img src="${esc(url(m))}" alt="${esc(r.pizzeria)} — foto ${i + 1}"${i ? ' loading="lazy"' : ''}>`) + '</div>';
  });
  h += '</div>';
  if (n > 1) {
    h += `<span class="pf-contador">1/${n}</span><button type="button" class="pf-flecha pf-izq" aria-label="Anterior">‹</button><button type="button" class="pf-flecha pf-der" aria-label="Siguiente">›</button><div class="pf-puntos">`;
    for (let i = 0; i < n; i++) h += `<button type="button" aria-label="Ir a ${i + 1}"${i === 0 ? ' aria-current="true"' : ''}></button>`;
    h += '</div>';
  }
  return h + '</div>';
}

function portadaDe(r) {
  const foto = r.medios.find((m) => !VIDEO.test(m));
  return foto ? url(foto) : '';
}

function paginaResena(r) {
  const meta = [r.zona, r.fecha ? 'Visita del ' + fechaLarga(r.fecha) : ''].filter(Boolean).join(' · ');
  const etiquetas = [r.estilo, r.horno && 'Horno: ' + r.horno, r.pedido && 'Pedimos: ' + r.pedido, r.precio && 'Pagamos: $' + Number(r.precio).toLocaleString('es-AR')].filter(Boolean);
  const n = r.nota;
  const filas = CATS.filter(([k]) => Number.isFinite(Number(r.ficha?.[k]))).map(([k, nom]) => {
    const v = Number(r.ficha[k]);
    const obs = r.ficha[k + '_obs'];
    return `<div class="pf-fila"><div class="pf-fila-t"><span>${nom}</span><span>${coma(v)}</span></div><div class="pf-barra"><i style="width:${v * 10}%"></i></div>${obs ? `<p>${esc(obs)}</p>` : ''}</div>`;
  }).join('');
  const canonical = `${SITE}/pizzerias/${r.slug}/`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'Review', name: r.pizzeria,
    itemReviewed: {
      '@type': 'Restaurant', name: r.pizzeria, servesCuisine: 'Pizza',
      ...(r.direccion || r.zona ? { address: { '@type': 'PostalAddress', streetAddress: r.direccion || '', addressLocality: r.zona || '', addressCountry: 'AR' } } : {}),
      ...(r.lat !== null ? { geo: { '@type': 'GeoCoordinates', latitude: r.lat, longitude: r.lng } } : {}),
      ...(portadaDe(r) ? { image: SITE + portadaDe(r).slice(BASE.length) } : {}),
    },
    author: { '@type': 'Organization', name: MARCA, url: SITE + '/' },
    ...(r.fecha ? { datePublished: r.fecha } : {}),
    ...(n !== null ? { reviewRating: { '@type': 'Rating', ratingValue: n, bestRating: 10, worstRating: 1 } } : {}),
    ...(r.veredicto ? { reviewBody: r.veredicto } : {}),
  };
  const cuerpo = `
<article class="pf-resena">
  ${carrusel(r)}
  <p class="pf-kicker">Reseña${r.estilo ? ' · ' + esc(r.estilo) : ''}</p>
  <h1 class="sitio-h1">${esc(r.pizzeria)}</h1>
  <p class="pf-meta">${esc(meta)}</p>
  <p class="pf-firma">Por la redacción de ${MARCA} · Evaluación técnica del chef</p>
  ${etiquetas.length ? `<ul class="pf-etiquetas">${etiquetas.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
  <div class="pf-texto">${marked.parse(String(r.texto || '').replace(/</g, '&lt;'))}</div>
  ${n !== null ? `<div class="pf-locura"><img class="pf-locura-img" src="${url('/img/locura-' + nivel(n) + '.webp')}" alt="${nivel(n)}: ${ESCALA[nivel(n)]}"><div><p class="pf-kicker">Nuestra nota</p><p class="pf-nota-num">${coma(n)}<small> / 10</small></p><p class="pf-nivel">${ESCALA[nivel(n)]}</p></div></div>` : ''}
  ${filas ? `<section class="pf-ficha" aria-label="Ficha técnica"><h2>Ficha técnica</h2>${filas}</section>` : ''}
  ${r.veredicto ? `<div class="pf-veredicto"><span>Veredicto</span><p>${esc(r.veredicto)}</p></div>` : ''}
  <p class="sitio-volver"><a href="${url('/')}">← Volver al recorrido</a></p>
</article>`;
  return pagina({
    titulo: `${r.pizzeria} · ${MARCA}`,
    descripcion: r.veredicto || `Reseña técnica de ${r.pizzeria}${r.zona ? ' en ' + r.zona : ''}.`,
    canonical, imagen: portadaDe(r) ? SITE + portadaDe(r).slice(BASE.length) : '',
    head: `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`,
    cuerpo,
    scripts: `<script src="${url('/assets/front.js')}"></script>`,
  });
}

function paginaInicio(lista) {
  const items = lista.map((r) => ({
    id: r.slug, nombre: r.pizzeria, zona: r.zona || '', estilo: r.estilo || '', fecha: r.fecha, fechaT: fechaCorta(r.fecha),
    frase: r.veredicto || '', nota: r.nota, notaT: r.nota === null ? '' : coma(r.nota),
    nivel: r.nota === null ? '' : ESCALA[nivel(r.nota)], ilus: r.nota === null ? '' : url('/img/locura-' + nivel(r.nota) + '.webp'),
    lat: r.lat, lng: r.lng, url: url(`/pizzerias/${r.slug}/`), img: portadaDe(r), video: r.medios.length > 0 && VIDEO.test(r.medios[0]),
  }));
  const estilos = [...new Set(items.map((i) => i.estilo).filter(Boolean))];
  const cuerpo = `
<div class="pf-inicio">
  <div class="pf-hero"><img src="${url('/img/logo.webp')}" alt="${MARCA}"><p>Probadas y puntuadas por un chef</p></div>
  <h1 class="pf-titulo">¿Dónde comemos pizza hoy?</h1>
  <p class="pf-bajada">Cada visita tiene su ficha técnica: masa, cocción, salsa, queso, ingredientes y precio.</p>
  <label class="pf-buscar" for="pf_q"><span class="sitio-oculto">Buscar por nombre o barrio</span><input id="pf_q" type="search" placeholder="Buscar por nombre o barrio" autocomplete="off"></label>
  <div class="pf-chips" role="group" aria-label="Filtrar por estilo">
    <button type="button" class="pf-chip" data-estilo="" aria-pressed="true">Todas</button>
    ${estilos.map((e) => `<button type="button" class="pf-chip" data-estilo="${esc(e)}" aria-pressed="false">${esc(e)}</button>`).join('')}
  </div>
  <h2 class="pf-sec">El recorrido <small id="pf_cuenta"></small></h2>
  <div id="pf_mapa" class="pf-mapa" role="region" aria-label="Mapa del recorrido"></div>
  <h2 class="pf-sec">Reseñas</h2>
  <div id="pf_lista" class="pf-lista"></div>
  <p id="pf_vacio" class="pf-vacio" hidden>${items.length ? 'No encontramos pizzerías con ese nombre o barrio.' : 'Muy pronto, la primera reseña.'}</p>
  <noscript><ul>${items.map((i) => `<li><a href="${esc(i.url)}">${esc(i.nombre)}</a></li>`).join('')}</ul></noscript>
</div>`;
  return pagina({
    titulo: `${MARCA} · Reseñas de pizzerías hechas por un chef`,
    descripcion: 'Pizzerías probadas y puntuadas por un chef: ficha técnica de masa, cocción, salsa y queso, mapa del recorrido y la escala de locura.',
    canonical: SITE + '/', imagen: SITE + '/img/logo.webp', activo: 'inicio', cuerpo,
    head: '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">',
    scripts: `<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>window.PF_ITEMS=${JSON.stringify(items).replace(/</g, '\\u003c')};</script>
<script src="${url('/assets/front.js')}"></script>`,
  });
}

function paginaEscala() {
  const cuerpo = `
<div class="pf-escala">
  <h1 class="sitio-h1">Cómo puntuamos</h1>
  <p>El chef evalúa seis puntos del 1 al 10. Cada estilo se juzga según lo que tiene que ser ese estilo. Cada punto pesa distinto en la nota final:</p>
  <ul class="pf-pesos">${CATS.map(([, nom, p]) => `<li><span>${nom}</span><b>${p}%</b></li>`).join('')}</ul>
  <h2>La escala de locura</h2>
  <p>La nota final se redondea y cada número tiene su nombre.</p>
  <ol>${Object.keys(ESCALA).reverse().map((n) => `<li><img class="pf-esc-img" src="${url('/img/locura-' + n + '.webp')}" alt="" loading="lazy"><b>${n}</b><span>${ESCALA[n]}</span></li>`).join('')}</ol>
</div>`;
  return pagina({ titulo: `Cómo puntuamos · ${MARCA}`, descripcion: 'La ficha técnica del chef y la escala de locura, del 1 al 10.', canonical: SITE + '/escala/', activo: 'escala', cuerpo });
}

async function escribir(rel, contenido) {
  const f = path.join(OUT, rel);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, contenido);
}

const lista = await leerResenas();
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp('static', OUT, { recursive: true });
if (existsSync('media')) await cp('media', path.join(OUT, 'media'), { recursive: true });
await cp('admin', path.join(OUT, 'admin'), { recursive: true });

await escribir('index.html', paginaInicio(lista));
await escribir('escala/index.html', paginaEscala());
for (const r of lista) await escribir(`pizzerias/${r.slug}/index.html`, paginaResena(r));
await escribir('404.html', pagina({ titulo: `No encontrada · ${MARCA}`, descripcion: 'Página no encontrada.', canonical: SITE + '/', cuerpo: `<h1 class="sitio-h1">Esta página no existe</h1><p><a href="${url('/')}">Volver al recorrido</a></p>` }));
await escribir('robots.txt', `User-agent: *\nDisallow: /admin/\nSitemap: ${SITE}/sitemap.xml\n`);
await escribir('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[SITE + '/', SITE + '/escala/', ...lista.map((r) => `${SITE}/pizzerias/${r.slug}/`)].map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(path.join(OUT, '.nojekyll'), '');
console.log(`Listo: ${lista.length} reseña(s) publicadas.`);
