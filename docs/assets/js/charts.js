/* ==========================================================================
   Canadian Urban Forest Census — interactive bar charts
   Usage:
     <div class="census-chart"
          data-chart='{ "n": 103, "note": "...", "decimals": 1, "series": [...] }'></div>
     "decimals" is optional and defaults to 1; set it to 0 for whole percentages.
   Each series item: { "label": "...", "count": 99, "group": "Site Information" }
   Percentages are computed from count / n, so only the counts are stored.
   Bars are always drawn on a 0-100% scale: a bar's length is its percentage.

   Optional:
     - An item can carry its own "n" (e.g. a Quebec-only option); its percentage
       and tooltip then use that n instead of the chart's.
     - "views": [{ "name": "All", "n": 113, "series": [...], "note": "..." }, ...]
       replaces "n"/"series" with a row of buttons that switch between views.
       "viewLabel" (e.g. "Municipalities contracting") prefixes the n shown.
     - "reference": index of a view whose values are drawn as a thin tick on the
       other views' bars, for comparison; "referenceLabel" names it in the key.
   ========================================================================== */

window.CensusChart = (function () {

	var GROUP_COLOURS = {
		"Species Identification": "#8c4a2f",
		"Tree Metric":            "#4f7a3a",
		"Maintenance Needs":      "#e8916b",
		"Site Information":       "#2f6f9e",
		"Operational":            "#2f6f9e",
		"Planning":               "#e0a53a",
		"Assessment":             "#00A189",
		"Policy":                 "#c4562a",
		"Municipal Trees":        "#2f6f9e",
		"Natural Areas":          "#00A189",
		"Other Governmental":     "#e0a53a",
		"Private":                "#c4562a",
		"Field-based":            "#0D534D",
		"Remote":                 "#00A189",
		"Requirement":            "#0D534D",
		"Hiring preference":      "#00A189",
		"Other":                  "#9aa39a"
	};

	function pct(count, n) { return (count / n) * 100; }

	/* decimals: how many decimal places to show (default 1; 0 = whole percent) */
	function fmtPct(v, decimals) {
		if (decimals === 0) return String(Math.round(v));
		var s = v.toFixed(decimals);
		return s.replace(/\.0+$/, "");
	}

	var tip = null;

	function ensureTip() {
		if (tip) return tip;
		tip = document.querySelector(".cc-tip");
		if (!tip) {
			tip = document.createElement("div");
			tip.className = "cc-tip";
			tip.style.display = "none";
			document.body.appendChild(tip);
		}
		return tip;
	}

	function build(el) {
		ensureTip();
		var cfg;
		try {
			cfg = JSON.parse(el.getAttribute("data-chart"));
		} catch (e) {
			el.innerHTML = '<p class="chart-note">Chart data could not be read.</p>';
			return;
		}

		var views = cfg.views || [{ name: "", n: cfg.n, series: cfg.series, note: cfg.note }];
		var hasViews = !!cfg.views && views.length > 1;
		var reference = (cfg.reference === undefined) ? null : cfg.reference;
		var decimals = (cfg.decimals === undefined) ? 1 : cfg.decimals;
		var groups = [];
		views.forEach(function (v) {
			v.series.forEach(function (d) {
				if (d.group && groups.indexOf(d.group) === -1) groups.push(d.group);
			});
		});

		var state = {
			view: 0,                     // index into views
			sort: "value",               // "value" | "group"
			active: groups.slice()       // visible groups
		};

		function itemN(d, view) { return d.n || view.n; }

		function referenceValue(label) {
			if (reference === null || reference === state.view || !views[reference]) return null;
			var ref = views[reference];
			for (var i = 0; i < ref.series.length; i++) {
				if (ref.series[i].label === label) return pct(ref.series[i].count, itemN(ref.series[i], ref));
			}
			return null;
		}

		// ---------- markup ----------
		var html = '';
		if (hasViews) {
			html += '<div class="cc-controls"><div class="cc-seg cc-view" role="group" aria-label="Choose a group">';
			views.forEach(function (v, i) {
				html += '<button type="button" data-view="' + i + '"' + (i === 0 ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') +
					'>' + v.name + '</button>';
			});
			html += '</div></div>';
		}
		html += '<div class="cc-controls">';

		if (groups.length > 1) {
			html += '<div class="cc-filters">';
			groups.forEach(function (g) {
				html += '<button class="cc-chip on" data-group="' + g + '">' +
					'<i style="background:' + (GROUP_COLOURS[g] || "#9aa39a") + '"></i>' + g +
					'</button>';
			});
			html += '</div>';
		}

		if (groups.length > 1) {
			html += '<div class="cc-toggles">' +
				'<div class="cc-seg cc-sort">' +
				'<button data-sort="value" class="on">Rank</button>' +
				'<button data-sort="group">Group</button>' +
				'</div></div>';
		}
		html += '</div>';

		if (hasViews) html += '<p class="cc-n"></p>';
		html += '<div class="cc-rows"></div>';
		if (reference !== null && hasViews) {
			html += '<p class="chart-note cc-key" hidden><span class="cc-ref-key"></span>' +
				(cfg.referenceLabel || views[reference].name) + '</p>';
		}
		html += '<p class="chart-note cc-note"></p>';

		el.innerHTML = html;

		var rowsEl = el.querySelector(".cc-rows");
		var nEl = el.querySelector(".cc-n");
		var keyEl = el.querySelector(".cc-key");
		var noteEl = el.querySelector(".cc-note");

		// ---------- render ----------
		function render() {
			var view = views[state.view];
			var shown = view.series.filter(function (d) {
				return !d.group || state.active.indexOf(d.group) !== -1;
			});
			if (nEl) nEl.innerHTML = (cfg.viewLabel ? cfg.viewLabel + ": " : "") + "n = " + view.n;
			if (keyEl) keyEl.hidden = (state.view === reference);
			var note = view.note || cfg.note || "";
			noteEl.innerHTML = note;
			noteEl.hidden = !note;

			if (state.sort === "group" && groups.length > 1) {
				shown.sort(function (a, b) {
					var ga = groups.indexOf(a.group), gb = groups.indexOf(b.group);
					if (ga !== gb) return ga - gb;
					return pct(b.count, itemN(b, view)) - pct(a.count, itemN(a, view));
				});
			} else {
				shown.sort(function (a, b) { return pct(b.count, itemN(b, view)) - pct(a.count, itemN(a, view)); });
			}

			if (!shown.length) {
				rowsEl.innerHTML = '<p class="chart-note">No categories selected.</p>';
				return;
			}

			rowsEl.innerHTML = shown.map(function (d) {
				var dn = itemN(d, view);
				var value = pct(d.count, dn);
				/* bars are drawn on a fixed 0-100% scale, so a full-width bar means 100% */
				var width = Math.min(value, 100);
				var colour = GROUP_COLOURS[d.group] || "#00A189";
				var ref = referenceValue(d.label);
				var refMark = (ref === null) ? "" :
					'<span class="cc-ref" style="left:' + Math.min(ref, 100).toFixed(1) + '%"></span>';
				return '<div class="bar-row cc-hoverable"' +
						' data-count="' + d.count + '"' +
						' data-n="' + dn + '"' +
						(ref === null ? "" : ' data-ref="' + fmtPct(ref, decimals) + '"') +
						' data-label="' + d.label.replace(/"/g, "&quot;") + '">' +
					'<span class="bar-label">' + d.label + '</span>' +
					'<div class="bar-track"><div class="bar-fill" style="width:' + width.toFixed(1) +
						'%;background:' + colour + ';"></div>' + refMark + '</div>' +
					'<span class="bar-value">' + fmtPct(value, decimals) + '%</span>' +
					'</div>';
			}).join("");

			attachHover();
		}

		// ---------- hover ----------
		function attachHover() {
			Array.prototype.forEach.call(rowsEl.querySelectorAll(".cc-hoverable"), function (row) {
				row.addEventListener("mousemove", function (e) {
					var count = row.getAttribute("data-count");
					var rowN = row.getAttribute("data-n");
					var refText = row.getAttribute("data-ref");
					tip.innerHTML = "<strong>" + count + "</strong> of " + rowN + " municipalities" +
						(refText === null ? "" : "<br>" + (cfg.referenceLabel || views[reference].name) + ": " + refText + "%");
					tip.style.display = "block";
					tip.style.left = e.clientX + "px";
					tip.style.top = e.clientY + "px";
				});
				row.addEventListener("mouseleave", function () { tip.style.display = "none"; });
			});
		}

		// ---------- events ----------
		Array.prototype.forEach.call(el.querySelectorAll(".cc-chip"), function (btn) {
			btn.addEventListener("click", function () {
				var g = btn.getAttribute("data-group");
				var i = state.active.indexOf(g);
				if (i === -1) { state.active.push(g); btn.classList.add("on"); }
				else if (state.active.length > 1) { state.active.splice(i, 1); btn.classList.remove("on"); }
				render();
			});
		});

		Array.prototype.forEach.call(el.querySelectorAll(".cc-view button"), function (btn) {
			btn.addEventListener("click", function () {
				state.view = parseInt(btn.getAttribute("data-view"), 10);
				Array.prototype.forEach.call(el.querySelectorAll(".cc-view button"), function (b) {
					b.classList.remove("on");
					b.setAttribute("aria-pressed", "false");
				});
				btn.classList.add("on");
				btn.setAttribute("aria-pressed", "true");
				render();
			});
		});

		Array.prototype.forEach.call(el.querySelectorAll(".cc-sort button"), function (btn) {
			btn.addEventListener("click", function () {
				state.sort = btn.getAttribute("data-sort");
				Array.prototype.forEach.call(el.querySelectorAll(".cc-sort button"), function (b) {
					b.classList.remove("on");
				});
				btn.classList.add("on");
				render();
			});
		});

		render();
	}

	function initAll(selector) {
		var els = document.querySelectorAll(selector || ".census-chart");
		Array.prototype.forEach.call(els, build);
	}

	return { initAll: initAll };
})();
