/* Locos por las pizzas — carrusel de la reseña y portada con buscador, filtro y mapa. */
(function () {
	'use strict';

	function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
	function sinTildes(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

	/* ---------- Carrusel 4:5 ---------- */
	document.querySelectorAll('.pf-carrusel').forEach(function (c) {
		var pista = c.querySelector('.pf-pista');
		var slides = pista.children, n = slides.length, actual = 0;
		var cont = c.querySelector('.pf-contador');
		var puntos = c.querySelectorAll('.pf-puntos button');
		function ir(i) { i = Math.max(0, Math.min(n - 1, i)); pista.scrollTo({ left: i * pista.clientWidth, behavior: 'smooth' }); }
		pista.addEventListener('scroll', function () {
			var i = Math.round(pista.scrollLeft / pista.clientWidth);
			if (i === actual) { return; }
			var v = slides[actual].querySelector('video'); if (v) { v.pause(); }
			actual = i;
			if (cont) { cont.textContent = (i + 1) + '/' + n; }
			puntos.forEach(function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
		}, { passive: true });
		puntos.forEach(function (b, j) { b.addEventListener('click', function () { ir(j); }); });
		var izq = c.querySelector('.pf-izq'), der = c.querySelector('.pf-der');
		if (izq) { izq.addEventListener('click', function () { ir(actual - 1); }); }
		if (der) { der.addEventListener('click', function () { ir(actual + 1); }); }
	});

	/* ---------- Portada ---------- */
	var items = window.PF_ITEMS;
	var listaEl = document.getElementById('pf_lista');
	if (!items || !listaEl) { return; }

	var estado = { q: '', estilo: '' };
	var mapa = null, capa = null;
	if (window.L && document.getElementById('pf_mapa')) {
		mapa = L.map('pf_mapa', { scrollWheelZoom: false });
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(mapa);
		capa = L.layerGroup().addTo(mapa);
	}
	var ultimaId = items.length ? items[items.length - 1].id : null;

	function visibles() {
		var q = sinTildes(estado.q.trim());
		return items.filter(function (p) {
			return (!estado.estilo || p.estilo === estado.estilo) && (!q || sinTildes(p.nombre + ' ' + p.zona).indexOf(q) !== -1);
		});
	}

	function pintarMapa(vis) {
		if (!mapa) { return; }
		capa.clearLayers();
		var pts = [];
		items.forEach(function (p, i) {
			if (vis.indexOf(p) === -1 || p.lat === null || p.lng === null) { return; }
			pts.push([p.lat, p.lng]);
			var ult = p.id === ultimaId;
			var ic = L.divIcon({ className: 'pf-num' + (ult ? ' ultima' : ''), html: String(i + 1), iconSize: ult ? [34, 34] : [28, 28], iconAnchor: ult ? [17, 17] : [14, 14] });
			L.marker([p.lat, p.lng], { icon: ic, title: p.nombre }).addTo(capa).bindPopup(
				'<strong>' + esc((i + 1) + '. ' + p.nombre) + '</strong><br>' + esc([p.zona, p.estilo].filter(Boolean).join(' · ')) +
				(p.notaT ? '<br>' + esc(p.notaT) + '/10 · ' + esc(p.nivel) : '') + '<br><a href="' + esc(p.url) + '">Leer reseña</a>'
			);
		});
		if (pts.length > 1) {
			L.polyline(pts, { color: '#1B1A19', weight: 3, opacity: .7, dashArray: '6 8' }).addTo(capa);
			mapa.fitBounds(pts, { padding: [30, 30] });
		} else if (pts.length === 1) {
			mapa.setView(pts[0], 15);
		} else {
			mapa.setView([-34.6037, -58.3816], 11);
		}
	}

	function pintarLista(vis) {
		var orden = vis.slice().sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
		listaEl.innerHTML = orden.map(function (p) {
			return '<a class="pf-card" href="' + esc(p.url) + '">' +
				'<span class="pf-thumb">' + (p.img ? '<img src="' + esc(p.img) + '" alt="" loading="lazy">' : '') + (p.video ? '<span class="pf-play">▶ Video</span>' : '') + '</span>' +
				'<span class="pf-info"><span class="pf-nombre">' + esc(p.nombre) + '</span>' +
				'<span class="pf-meta-c">' + esc([p.zona, p.estilo, p.fechaT].filter(Boolean).join(' · ')) + '</span>' +
				'<span class="pf-frase">' + esc(p.frase) + '</span></span>' +
				(p.ilus ? '<span class="pf-nivel-c"><img src="' + esc(p.ilus) + '" alt="' + esc(p.nivel) + '" loading="lazy"><span>' + esc(p.notaT) + '</span></span>' : '') +
				'</a>';
		}).join('');
		document.getElementById('pf_vacio').hidden = vis.length > 0;
		var cuenta = document.getElementById('pf_cuenta');
		if (cuenta) { cuenta.textContent = vis.length + ' de ' + items.length; }
	}

	function pintar() { var v = visibles(); pintarLista(v); pintarMapa(v); }

	document.getElementById('pf_q').addEventListener('input', function (e) { estado.q = e.target.value; pintar(); });
	document.querySelectorAll('.pf-chip').forEach(function (b) {
		b.addEventListener('click', function () {
			estado.estilo = b.getAttribute('data-estilo');
			document.querySelectorAll('.pf-chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
			pintar();
		});
	});
	pintar();
})();
