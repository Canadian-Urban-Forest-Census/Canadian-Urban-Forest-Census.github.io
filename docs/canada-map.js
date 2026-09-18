/* ==========================================================================
   Canadian Urban Forest Census — eligibility map
   Usage:  CanadaMap.init("#map", { lang: "en", interactive: true });
   Needs:  d3 v7 and topojson-client loaded before this file.
   Data:   /data/provinces.topo.json, /data/cities.json
   ========================================================================== */

window.CanadaMap = (function () {

	var DATA = {
		provinces: "/data/provinces.topo.json",
		cities: "/data/cities.json"
	};

	// Placeholder palette. Replace with the real ecozone polygons when ready;
	// ecozone mode currently groups the city points rather than drawing zones.
	var ZONE_COLOURS = {
		"Pacific Maritime":   "#85c9bf",
		"Montane Cordillera": "#a89283",
		"Prairie":            "#e3d398",
		"Boreal Plain":       "#bcd39a",
		"Boreal Shield":      "#9fc79a",
		"Mixedwood Plain":    "#a0ba8d",
		"Atlantic Maritime":  "#7ed694"
	};

	var STRINGS = {
		en: {
			allCanada: "All of Canada",
			byProvince: "By province",
			byEcozone: "By ecozone",
			back: "\u2190 All of Canada",
			municipalities: "eligible municipalities",
			clickProvince: "Click a province to zoom in.",
			clickEcozone: "Choose an ecozone to zoom in.",
			hoverDot: "Hover a point for the municipality name.",
			simulated: "Ecozone boundaries are simulated \u2014 points are grouped by ecozone, polygons to follow."
		},
		fr: {
			allCanada: "Tout le Canada",
			byProvince: "Par province",
			byEcozone: "Par \u00e9cozone",
			back: "\u2190 Tout le Canada",
			municipalities: "municipalit\u00e9s admissibles",
			clickProvince: "Cliquez sur une province pour agrandir.",
			clickEcozone: "Choisissez une \u00e9cozone pour agrandir.",
			hoverDot: "Survolez un point pour le nom de la municipalit\u00e9.",
			simulated: "Les limites des \u00e9cozones sont simul\u00e9es \u2014 les points sont regroup\u00e9s par \u00e9cozone."
		}
	};

	function init(selector, options) {
		options = options || {};
		var lang = options.lang || "en";
		var t = STRINGS[lang];
		var W = 720, H = 560, PAD = 16;

		var root = d3.select(selector);
		if (root.empty()) return;

		root.html(
			'<div class="cmap-controls">' +
				'<div class="cmap-seg">' +
					'<button data-mode="prov" class="on">' + t.byProvince + '</button>' +
					'<button data-mode="eco">' + t.byEcozone + '</button>' +
				'</div>' +
				'<button class="cmap-back" disabled>' + t.back + '</button>' +
			'</div>' +
			'<div class="cmap-layout">' +
				'<div class="cmap-box"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet"></svg></div>' +
				'<div class="cmap-side">' +
					'<h3 class="cmap-title">' + t.allCanada + '</h3>' +
					'<span class="cmap-count">\u2014</span>' +
					'<span class="cmap-countlab">' + t.municipalities + '</span>' +
					'<div class="cmap-legend"></div>' +
					'<p class="cmap-note">' + t.clickProvince + '</p>' +
				'</div>' +
			'</div>'
		);

		var svg = root.select("svg");
		var gFill = svg.append("g");
		var gBord = svg.append("g");
		var gDots = svg.append("g");

		var tip = d3.select("body").select(".cmap-tip");
		if (tip.empty()) tip = d3.select("body").append("div").attr("class", "cmap-tip").style("display", "none");

		var projection = d3.geoConicConformal().parallels([49, 77]).rotate([96, 0]);
		var path = d3.geoPath(projection);

		var provinces = null, cities = null;
		var mode = "prov", selected = null;

		Promise.all([
			d3.json(DATA.provinces),
			d3.json(DATA.cities)
		]).then(function (res) {
			var topo = res[0];
			var key = Object.keys(topo.objects)[0];
			provinces = topojson.feature(topo, topo.objects[key]);
			cities = res[1];
			render();
		}).catch(function (err) {
			root.select(".cmap-box").html('<p style="padding:20px;font-family:sans-serif;font-size:14px;color:#a33;">Map data failed to load: ' + err.message + "</p>");
		});

		function provName(f) { return f.properties["name_" + lang]; }
		function cityProv(c) { return c["province_" + lang]; }
		function cityZone(c) { return c["ecozone_" + lang]; }

		function zoneKeyEn(c) { return c.ecozone_en; }

		function zonesPresent() {
			var seen = {}, list = [];
			cities.forEach(function (c) {
				if (!seen[c.ecozone_en]) { seen[c.ecozone_en] = true; list.push({ en: c.ecozone_en, label: cityZone(c) }); }
			});
			list.sort(function (a, b) { return a.label.localeCompare(b.label); });
			return list;
		}

		function selectedCities() {
			if (!selected) return { main: cities };
			var match = mode === "prov"
				? function (c) { return c.province_en === selected; }
				: function (c) { return c.ecozone_en === selected; };
			return { main: cities.filter(match) };
		}

		function fitTarget() {
			if (!selected) return provinces;
			if (mode === "prov") {
				var f = provinces.features.filter(function (f) { return f.properties.name_en === selected; });
				return { type: "FeatureCollection", features: f };
			}
			// ecozone placeholder: fit to the bounding box of that zone's cities
			var pts = cities.filter(function (c) { return c.ecozone_en === selected; });
			return {
				type: "FeatureCollection",
				features: pts.map(function (c) {
					return { type: "Feature", geometry: { type: "Point", coordinates: [c.lng, c.lat] }, properties: {} };
				})
			};
		}

		function resolve(pts, minDist) {
			var r = pts.map(function (p) { return Object.assign({}, p); });
			for (var it = 0; it < 60; it++) {
				for (var i = 0; i < r.length; i++) {
					for (var j = i + 1; j < r.length; j++) {
						var dx = r[j].x - r[i].x, dy = r[j].y - r[i].y;
						var d = Math.sqrt(dx * dx + dy * dy);
						if (d < minDist && d > 0) {
							var push = (minDist - d) / 2;
							r[i].x -= dx / d * push; r[i].y -= dy / d * push;
							r[j].x += dx / d * push; r[j].y += dy / d * push;
						}
					}
				}
			}
			return r;
		}

		function showTip(e, text) {
			tip.style("display", "block")
				.style("left", e.clientX + "px")
				.style("top", e.clientY + "px")
				.text(text);
		}
		function hideTip() { tip.style("display", "none"); }

		function render() {
			if (!provinces || !cities) return;

			var target = fitTarget();
			if (mode === "eco" && selected) {
				projection.fitExtent([[60, 60], [W - 60, H - 60]], target);
			} else {
				projection.fitExtent([[PAD, PAD], [W - PAD, H - PAD]], target);
			}

			var clickable = (mode === "prov" && !selected && options.interactive !== false);

			gFill.selectAll("path").data(provinces.features).join("path")
				.attr("class", "cmap-region")
				.attr("d", path)
				.attr("fill", function (f) {
					if (mode === "prov" && selected) return f.properties.name_en === selected ? "#e0e2dd" : "#eeeeec";
					return "#e4e4e4";
				})
				.attr("stroke", "none")
				.style("pointer-events", clickable ? "auto" : "none")
				.style("cursor", clickable ? "pointer" : "default")
				.on("click", function (e, f) { if (clickable) { selected = f.properties.name_en; render(); } })
				.on("mousemove", function (e, f) { if (clickable) showTip(e, provName(f)); })
				.on("mouseleave", hideTip);

			gBord.selectAll("path").data(provinces.features).join("path")
				.attr("d", path)
				.attr("fill", "none")
				.attr("stroke", function (f) {
					return (mode === "prov" && selected === f.properties.name_en) ? "#0D534D" : "#ffffff";
				})
				.attr("stroke-width", function (f) {
					return (mode === "prov" && selected === f.properties.name_en) ? 1.6 : 0.9;
				})
				.style("pointer-events", "none");

			var sets = selectedCities();
			var r = selected ? 4 : 2.3;

			var mainPts = resolve(sets.main.map(function (c) {
				var xy = projection([c.lng, c.lat]);
				return { name: c.name, prov: cityProv(c), zone: cityZone(c), zoneEn: c.ecozone_en, x: xy[0], y: xy[1] };
			}), r * 2);

			gDots.selectAll("circle.main").data(mainPts).join("circle")
				.attr("class", "main")
				.attr("cx", function (d) { return d.x; })
				.attr("cy", function (d) { return d.y; })
				.attr("r", r)
				.attr("fill", function (d) {
					if (mode === "eco") return ZONE_COLOURS[d.zoneEn] || "#1a4a1a";
					return selected ? "#111" : "#1a4a1a";
				})
				.attr("stroke", "#fff")
				.attr("stroke-width", selected ? 1.2 : 0.6)
				.attr("opacity", 0.92)
				.style("pointer-events", selected ? "auto" : "none")
				.style("cursor", "pointer")
				.on("mousemove", function (e, d) { showTip(e, d.name); })
				.on("mouseleave", hideTip);

			// side panel
			root.select(".cmap-count").text(sets.main.length);
			root.select(".cmap-countlab").text(t.municipalities);
			root.select(".cmap-title").text(
				selected
					? (mode === "prov"
						? provName(provinces.features.filter(function (f) { return f.properties.name_en === selected; })[0])
						: (sets.main[0] ? sets.main[0]["ecozone_" + lang] : selected))
					: t.allCanada
			);
			root.select(".cmap-back").property("disabled", !selected);
			root.select(".cmap-note").text(
				selected ? t.hoverDot : (mode === "prov" ? t.clickProvince : t.clickEcozone)
			);

			renderLegend();
		}

		function renderLegend() {
			var legend = root.select(".cmap-legend");
			if (mode !== "eco") { legend.html(""); return; }
			var items = zonesPresent();
			var sel = legend.selectAll("div").data(items, function (d) { return d.en; });
			sel.join("div")
				.attr("class", function (d) { return (selected && d.en !== selected) ? "dim" : ""; })
				.html(function (d) {
					return '<i style="background:' + (ZONE_COLOURS[d.en] || "#ccc") + '"></i>' + d.label;
				})
				.on("click", function (e, d) { selected = (selected === d.en) ? null : d.en; render(); });
			if (legend.select(".cmap-sim").empty()) {
				legend.append("p").attr("class", "cmap-sim").text(t.simulated);
			}
		}

		root.selectAll(".cmap-seg button").on("click", function () {
			var m = this.getAttribute("data-mode");
			mode = m; selected = null;
			root.selectAll(".cmap-seg button").classed("on", false);
			d3.select(this).classed("on", true);
			render();
		});
		root.select(".cmap-back").on("click", function () { selected = null; render(); });
	}

	return { init: init };
})();
