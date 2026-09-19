/* ==========================================================================
   Canadian Urban Forest Census — interactive bar charts
   Usage:
     <div class="census-chart"
          data-chart='{ "n": 103, "note": "...", "decimals": 1, "series": [...] }'></div>
     "decimals" is optional and defaults to 1; set it to 0 for whole percentages.
   Each series item: { "label": "...", "count": 99, "group": "Site Information" }
   Percentages are computed from count / n, so only the counts are stored.
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

		var n = cfg.n;
		var decimals = (cfg.decimals === undefined) ? 1 : cfg.decimals;
		var series = cfg.series.slice();
		var groups = [];
		series.forEach(function (d) {
			if (d.group && groups.indexOf(d.group) === -1) groups.push(d.group);
		});

		var state = {
			sort: "value",               // "value" | "group"
			active: groups.slice()       // visible groups
		};

		// ---------- markup ----------
		var html = '<div class="cc-controls">';

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

		html += '<div class="cc-rows"></div>';
		if (cfg.note) html += '<p class="chart-note">' + cfg.note + '</p>';

		el.innerHTML = html;

		var rowsEl = el.querySelector(".cc-rows");

		// ---------- render ----------
		function render() {
			var shown = series.filter(function (d) {
				return !d.group || state.active.indexOf(d.group) !== -1;
			});

			if (state.sort === "group" && groups.length > 1) {
				shown.sort(function (a, b) {
					var ga = groups.indexOf(a.group), gb = groups.indexOf(b.group);
					if (ga !== gb) return ga - gb;
					return b.count - a.count;
				});
			} else {
				shown.sort(function (a, b) { return b.count - a.count; });
			}

			var max = 0;
			shown.forEach(function (d) { if (d.count > max) max = d.count; });
			var scaleMax = Math.max(pct(max, n), 1);

			if (!shown.length) {
				rowsEl.innerHTML = '<p class="chart-note">No categories selected.</p>';
				return;
			}

			rowsEl.innerHTML = shown.map(function (d) {
				var value = pct(d.count, n);
				var width = (value / scaleMax) * 100;
				var colour = GROUP_COLOURS[d.group] || "#00A189";
				return '<div class="bar-row cc-hoverable"' +
						' data-count="' + d.count + '"' +
						' data-label="' + d.label.replace(/"/g, "&quot;") + '">' +
					'<span class="bar-label">' + d.label + '</span>' +
					'<div class="bar-track"><div class="bar-fill" style="width:' + width.toFixed(1) +
						'%;background:' + colour + ';"></div></div>' +
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
					tip.innerHTML = "<strong>" + count + "</strong> of " + n + " municipalities";
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
