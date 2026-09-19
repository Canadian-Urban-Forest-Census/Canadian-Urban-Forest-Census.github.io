/* ==========================================================================
   Canadian Urban Forest Census — city search
   Type-ahead over the 343 urban municipalities in /data/cities.json.

   Markup it expects (see benchmarking.html):
     .citysearch > input#city-input + ul#city-list + #city-status
   Selecting a city fires a "cityselect" event on the container with the
   city record in event.detail, so the comparison panels can listen for it.
   ========================================================================== */

window.CitySearch = (function () {

	var MAX_RESULTS = 8;

	/* "Montréal" -> "montreal", so accents never block a match */
	function norm(s) {
		return s
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[\u2019']/g, "'")
			.trim();
	}

	function escapeHtml(s) {
		return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	/* Bold the part of the label the person actually typed */
	function mark(label, start, len) {
		if (start < 0) return escapeHtml(label);
		return escapeHtml(label.slice(0, start)) +
			"<mark>" + escapeHtml(label.slice(start, start + len)) + "</mark>" +
			escapeHtml(label.slice(start + len));
	}

	function build(el) {
		var input   = el.querySelector("input");
		var listEl  = el.querySelector(".cs-list");
		var statusEl = el.querySelector(".cs-status");
		var panelEl = document.querySelector(el.getAttribute("data-panel") || "#city-panel");
		var pageNote = document.querySelector(el.getAttribute("data-page-note") || "#page-note");

		var cities = [];
		var results = [];
		var active = -1;      // index of the highlighted option
		var selected = null;

		/* ---------- data ---------- */

		Promise.all([
			fetch("/data/cities.json").then(function (r) {
				if (!r.ok) throw new Error("HTTP " + r.status);
				return r.json();
			}),
			fetch("/data/mock-city-data.json").then(function (r) {
				if (!r.ok) throw new Error("HTTP " + r.status);
				return r.json();
			})
		])
			.then(function (both) {
				var rows = both[0];
				var mock = {};
				both[1].cities.forEach(function (m) { mock[m.key] = m; });

				cities = rows.map(function (c, i) {
					return {
						i: i,
						csduid: c.csduid,
						name: c.name,
						province: c.province,
						province_en: c.province_en,
						ecozone: c.ecozone_en,
						lat: c.lat,
						lng: c.lng,
						label: c.name + ", " + c.province,
						key: norm(c.name),
						keyFull: norm(c.name + ", " + c.province),
						data: mock[c.csduid] || null,
						pop: mock[c.csduid] ? mock[c.csduid].population : 0
					};
				});

				input.disabled = false;
				input.placeholder = "Start typing a city name";
			})
			.catch(function () {
				input.placeholder = "City list could not be loaded";
				statusEl.textContent = "The city list could not be loaded. Please refresh the page.";
				statusEl.classList.add("cs-error");
			});

		/* ---------- boundaries ----------
		   /data/city_boundaries.topo.json, fetched lazily the first time a city
		   is selected, then cached. Decoded here rather than with topojson.js so
		   the page carries no external script dependency. */

		var boundaries = null;      // csduid -> array of rings, each [[lng, lat], ...]
		var boundaryLoad = null;

		function decodeTopology(topo) {
			var sc = topo.transform.scale, tr = topo.transform.translate;

			var arcs = topo.arcs.map(function (a) {
				var x = 0, y = 0;
				return a.map(function (d) {
					x += d[0]; y += d[1];
					return [x * sc[0] + tr[0], y * sc[1] + tr[1]];
				});
			});

			function ring(indexes) {
				var pts = [];
				indexes.forEach(function (i) {
					var a = arcs[i < 0 ? ~i : i];
					var seg = i < 0 ? a.slice().reverse() : a;
					pts = pts.concat(pts.length ? seg.slice(1) : seg);
				});
				return pts;
			}

			var out = {};
			topo.objects.csds.geometries.forEach(function (gm) {
				var polys = gm.type === "Polygon" ? [gm.arcs] : gm.arcs;
				out[gm.properties.csduid] = polys.map(function (poly) {
					return ring(poly[0]);            // outer ring only; holes are invisible at this size
				});
			});
			return out;
		}

		function loadBoundaries() {
			if (boundaryLoad) return boundaryLoad;
			boundaryLoad = fetch("/data/city_boundaries.topo.json")
				.then(function (r) {
					if (!r.ok) throw new Error("HTTP " + r.status);
					return r.json();
				})
				.then(function (topo) { boundaries = decodeTopology(topo); return boundaries; });
			return boundaryLoad;
		}

		/* Fit the rings into the box and return an SVG path. Longitude is scaled
		   by cos(latitude) so shapes aren't stretched sideways. */
		function boundarySvg(rings, w, h, pad) {
			var lat0 = 0, n = 0;
			rings.forEach(function (r) {
				r.forEach(function (p) { lat0 += p[1]; n++; });
			});
			lat0 = lat0 / n * Math.PI / 180;
			var kx = Math.cos(lat0);

			var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
			rings.forEach(function (r) {
				r.forEach(function (p) {
					var x = p[0] * kx, y = -p[1];
					if (x < minX) minX = x;
					if (x > maxX) maxX = x;
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
				});
			});

			var sx = (w - pad * 2) / (maxX - minX || 1);
			var sy = (h - pad * 2) / (maxY - minY || 1);
			var s = Math.min(sx, sy);
			var ox = pad + ((w - pad * 2) - (maxX - minX) * s) / 2;
			var oy = pad + ((h - pad * 2) - (maxY - minY) * s) / 2;

			return rings.map(function (r) {
				return "M" + r.map(function (p) {
					return ((p[0] * kx - minX) * s + ox).toFixed(1) + " " +
						((-p[1] - minY) * s + oy).toFixed(1);
				}).join("L") + "Z";
			}).join(" ");
		}

		function drawBoundary(c) {
			var box = panelEl && panelEl.querySelector(".cp-shape");
			if (!box) return;

			loadBoundaries().then(function (map) {
				if (!panelEl || panelEl.hidden) return;
				if (!selected || selected.csduid !== c.csduid) return;   // a newer city was picked
				var rings = map[c.csduid];
				if (!rings) return;

				var W = 200, H = 168;
				box.innerHTML =
					'<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Outline of ' +
						escapeHtml(c.name) + '">' +
						'<path d="' + boundarySvg(rings, W, H, 10) + '" />' +
					'</svg>';
				box.classList.add("is-drawn");
			}).catch(function () { /* leave the placeholder as it is */ });
		}

		/* ---------- matching ----------
		   Two tiers: the name starts with the query, then a word inside the
		   name starts with it (so "perrot" finds L'Île-Perrot). Matches in the
		   middle of a word are ignored, or "Tor" would drag in Victoria.
		   Alphabetical within each tier. */

		function search(qRaw) {
			var q = norm(qRaw);
			if (!q) return [];

			var tiers = [[], []];

			cities.forEach(function (c) {
				var at = c.key.indexOf(q);
				var tier = -1;

				if (at === 0) {
					tier = 0;
				} else if (at > 0 && /[\s\-'.]/.test(c.key.charAt(at - 1))) {
					tier = 1;
				} else if (c.keyFull.indexOf(q) === 0) {
					tier = 0;                       // typed "winnipeg, mb"
					at = 0;
				}

				if (tier > -1) tiers[tier].push({ c: c, at: at, len: q.length });
			});

			/* biggest first, so "Win" leads with Winnipeg, not Winkler */
			function byPop(a, b) {
				return (b.c.pop - a.c.pop) ||
					a.c.name.localeCompare(b.c.name, "en") ||
					a.c.province.localeCompare(b.c.province, "en");
			}

			return tiers[0].sort(byPop).concat(tiers[1].sort(byPop));
		}

		/* ---------- rendering ---------- */

		function render() {
			if (!results.length) {
				listEl.innerHTML = "";
				close();
				return;
			}

			var shown = results.slice(0, MAX_RESULTS);

			listEl.innerHTML = shown.map(function (r, idx) {
				return '<li role="option" id="cs-opt-' + idx + '"' +
					(idx === active ? ' class="on" aria-selected="true"' : ' aria-selected="false"') +
					' data-idx="' + idx + '">' +
					'<span class="cs-name">' + mark(r.c.name, r.at, r.len) + '</span>' +
					'<span class="cs-prov">' + r.c.province + '</span>' +
					'</li>';
			}).join("");

			el.classList.add("cs-open");
			input.setAttribute("aria-expanded", "true");
			setActiveDescendant();

			var extra = results.length - shown.length;
			statusEl.textContent = results.length + (results.length === 1 ? " city" : " cities") +
				" found" + (extra > 0 ? ", showing the first " + MAX_RESULTS : "");
		}

		function close() {
			el.classList.remove("cs-open");
			input.setAttribute("aria-expanded", "false");
			input.removeAttribute("aria-activedescendant");
			active = -1;
		}

		function setActiveDescendant() {
			if (active > -1) input.setAttribute("aria-activedescendant", "cs-opt-" + active);
			else input.removeAttribute("aria-activedescendant");
		}

		function highlight(idx) {
			var opts = listEl.querySelectorAll("li");
			if (!opts.length) return;
			if (active > -1 && opts[active]) {
				opts[active].classList.remove("on");
				opts[active].setAttribute("aria-selected", "false");
			}
			active = idx;
			if (active > -1 && opts[active]) {
				opts[active].classList.add("on");
				opts[active].setAttribute("aria-selected", "true");
				opts[active].scrollIntoView({ block: "nearest" });
			}
			setActiveDescendant();
		}

		/* ---------- selection ---------- */

		function select(idx) {
			var r = results[idx];
			if (!r) return;
			selected = r.c;
			input.value = r.c.label;
			results = [];
			close();
			statusEl.textContent = r.c.label + " selected";
			showPanel(r.c);
			el.dispatchEvent(new CustomEvent("cityselect", { detail: r.c, bubbles: true }));
		}

		/* ---------- number formatting ---------- */

		function num(v) {
			return (v === null || v === undefined) ? "\u2014"
				: v.toLocaleString("en-CA");
		}

		function money(v) {
			return (v === null || v === undefined) ? "\u2014"
				: "$" + Math.round(v).toLocaleString("en-CA");
		}

		function one(v) {
			return (v === null || v === undefined) ? "\u2014"
				: v.toLocaleString("en-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
		}

		function yesno(v) {
			return v ? "Yes" : "No";
		}

		/* a labelled figure row; note is optional small print under the label */
		function row(label, value, note) {
			return '<div class="cp-row">' +
				'<span class="cp-row-label">' + label +
					(note ? '<span class="cp-row-note">' + note + '</span>' : '') +
				'</span>' +
				'<span class="cp-row-value">' + value + '</span>' +
				'</div>';
		}

		function section(title, rows, note) {
			return '<section class="cp-section">' +
				'<h3>' + title + '</h3>' +
				(note ? '<p class="cp-section-note">' + note + '</p>' : '') +
				'<div class="cp-rows">' + rows + '</div>' +
				'</section>';
		}

		function showPanel(c) {
			if (pageNote) pageNote.hidden = true;
			if (!panelEl) return;

			var d = c.data;
			panelEl.hidden = false;

			if (!d) {
				panelEl.innerHTML = '<h2>' + escapeHtml(c.name) + '</h2>' +
					'<p class="cs-meta">' + escapeHtml(c.province_en) + '</p>' +
					'<p>No figures are available for this municipality yet.</p>';
				panelEl.focus();
				return;
			}

			var b = d.budget, s = d.staff, v = d.volunteers, t = d.street_trees;
			var k = d.contractors || {};

			panelEl.innerHTML =
				'<div class="cp-head">' +
					'<h2>' + escapeHtml(c.name) + '</h2>' +
					'<p class="cs-meta">' + escapeHtml(c.province_en) +
						' &middot; ' + escapeHtml(c.ecozone) + ' ecozone</p>' +
				'</div>' +

				'<p class="cp-mock">All figures below are <strong>placeholder values</strong>, not ' +
				'survey responses and not modelled estimates for ' + escapeHtml(c.name) + '. ' +
				'These estimates are produced by a national model, not a city&rsquo;s own reported ' +
				'results. Individual municipalities may differ substantially from them.</p>' +

				/* ---- boundary + headline figures ---- */
				'<div class="cp-top">' +
					'<div class="cp-shape"><span>Loading outline&hellip;</span></div>' +
					'<div class="cp-keys">' +

						'<div class="cp-metric">' +
							'<span class="cp-metric-label">Canopy Cover</span>' +
							'<div class="cp-metric-body cp-scale" role="img" aria-label="' +
								one(d.canopy) + ' percent, on a scale of 0 to 100 percent">' +
								(d.canopy > 72
									/* not enough room to the right, so sit inside the green */
									? '<div class="cp-scale-fill" style="width:' + d.canopy + '%;">' +
										'<span class="cp-scale-value on-fill">' + one(d.canopy) + '%</span>' +
									'</div>'
									: '<div class="cp-scale-fill" style="width:' + d.canopy + '%;"></div>' +
									'<span class="cp-scale-value" style="left:calc(' + d.canopy + '% + 10px);">' +
    									one(d.canopy) + '%</span>' +
							'</div>' +
							'<span class="cp-metric-source">Global Canopy Height Map ' +
								'(1&nbsp;m resolution), Meta and World Resources Institute</span>' +
						'</div>' +

						'<div class="cp-metric">' +
							'<span class="cp-metric-label">Population</span>' +
							'<div class="cp-metric-body">' +
								'<span class="cp-metric-value">' + num(d.population) + '</span>' +
							'</div>' +
							'<span class="cp-metric-source">2021 Census, Statistics Canada</span>' +
						'</div>' +

						'<div class="cp-metric">' +
							'<span class="cp-metric-label">Population Density</span>' +
							'<div class="cp-metric-body">' +
								'<span class="cp-metric-value">' + num(d.density) +
									'<span class="cp-metric-unit">people per km&sup2;</span></span>' +
							'</div>' +
							'<span class="cp-metric-source">2021 Census, Statistics Canada</span>' +
						'</div>' +

					'</div>' +
				'</div>' +

				/* ---- budget ---- */
				section("Predicted budget",
					row("Urban forestry", money(b.urban_forestry), "annual, adequacy-adjusted") +
					row("Street tree program", money(b.street_tree_program), "annual, adequacy-adjusted") +
					row("Street tree planting", money(b.street_tree_planting), "annual"),
					"Urban forestry and street tree program budgets are based on " +
					"adequacy-adjusted amounts. Street tree planting is not adjusted.") +

				/* ---- contractors ---- */
				section("Predicted contractor use",
					row("Uses contractors", yesno(k.uses_contractor)) +
					row("Contractor expense",
						k.uses_contractor ? money(k.contractor_expense) : "\u2014", "annual") +
					row("Uses contractors for street trees", yesno(k.uses_street_tree_contractor)) +
					row("Street tree contractor expense",
						k.uses_street_tree_contractor ? money(k.street_tree_contractor_expense) : "\u2014",
						"annual")) +

				/* ---- staff ---- */
				section("Predicted staff",
					row("Urban forestry staff", num(s.urban_forestry_staff), "people") +
					row("Urban forestry FTE positions", one(s.urban_forestry_fte), "2,080-hour base") +
					row("Street tree staff", num(s.street_tree_staff), "people") +
					row("Street tree FTE positions", one(s.street_tree_fte), "2,080-hour base")) +

				/* ---- volunteers ---- */
				section("Predicted volunteer engagement",
					row("Volunteers", num(v.people), "per year") +
					row("Volunteer hours", num(v.hours),
						"per year, cumulative across all volunteers")) +

				/* ---- street trees ---- */
				section("Predicted street tree work",
					row("Trees planted", num(t.planted), "per year") +
					row("Trees pruned", num(t.pruned), "per year") +
					row("Trees removed", num(t.removed), "per year") +
					row("Trees treated for pests and disease", num(t.treated), "per year") +
					row("Desired pruning cycle", t.pruning_cycle_years + " years"));

			drawBoundary(c);
			panelEl.focus();
		}

		function clearSelection() {
			selected = null;
			if (pageNote) pageNote.hidden = false;
			if (panelEl) { panelEl.hidden = true; panelEl.innerHTML = ""; }
		}

		/* ---------- events ---------- */

		input.addEventListener("input", function () {
			if (selected && input.value !== selected.label) clearSelection();
			results = search(input.value);
			active = results.length ? 0 : -1;
			render();
			if (input.value.trim() && !results.length) {
				statusEl.textContent = "No city matches \u201c" + input.value.trim() + "\u201d";
			} else if (!input.value.trim()) {
				statusEl.textContent = "";
			}
		});

		input.addEventListener("keydown", function (e) {
			var opts = listEl.querySelectorAll("li").length;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				if (!el.classList.contains("cs-open") && input.value) {
					results = search(input.value); active = -1; render();
				}
				if (opts) highlight((active + 1) % opts);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				if (opts) highlight((active - 1 + opts) % opts);
			} else if (e.key === "Enter") {
				if (active > -1) { e.preventDefault(); select(active); }
			} else if (e.key === "Escape") {
				if (el.classList.contains("cs-open")) { close(); }
				else { input.value = ""; clearSelection(); statusEl.textContent = ""; }
			} else if (e.key === "Home" && el.classList.contains("cs-open")) {
				e.preventDefault(); highlight(0);
			} else if (e.key === "End" && el.classList.contains("cs-open")) {
				e.preventDefault(); highlight(opts - 1);
			}
		});

		/* mousedown, not click: it fires before the input loses focus */
		listEl.addEventListener("mousedown", function (e) {
			var li = e.target.closest("li");
			if (!li) return;
			e.preventDefault();
			select(parseInt(li.getAttribute("data-idx"), 10));
		});

		listEl.addEventListener("mousemove", function (e) {
			var li = e.target.closest("li");
			if (li) highlight(parseInt(li.getAttribute("data-idx"), 10));
		});

		input.addEventListener("focus", function () {
			if (input.value && !selected) { results = search(input.value); render(); }
		});

		document.addEventListener("click", function (e) {
			if (!el.contains(e.target)) close();
		});
	}

	function init(selector) {
		var els = document.querySelectorAll(selector || ".citysearch");
		Array.prototype.forEach.call(els, build);
	}

	return { init: init };
})();
