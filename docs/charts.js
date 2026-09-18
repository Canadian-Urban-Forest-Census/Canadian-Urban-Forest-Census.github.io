/* ==========================================================================
   Canadian Urban Forest Census — interactive bar charts
   Usage:
     <div class="census-chart"
          data-chart='{ "n": 103, "note": "...", "series": [...] }'></div>
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

	function fmtPct(v) {
		var s = v.toFixed(1);
		return (s.indexOf(".0") === v.toFixed(1).length - 2) ? s.replace(".0", "") : s;
	}

	function build(el) {
		var cfg;
		try {
			cfg = JSON.parse(el.getAttribute("data-chart"));
		} catch (e) {
			el.innerHTML = '<p class="chart-note">Chart data could not be read.</p>';
			return;
		}

		var n = cfg.n;
		var series = cfg.series.slice();
		var groups = [];
		series.forEach(function (d) {
			if (d.group && groups.indexOf(d.group) === -1) groups.push(d.group);
		});

		var state = {
			mode: "pct",                 // "pct" | "count"
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

		html += '<div class="cc-toggles">';
		if (groups.length > 1) {
			html += '<div class="cc-seg cc-sort">' +
				'<button data-sort="value" class="on">Rank</button>' +
				'<button data-sort="group">Group</button>' +
				'</div>';
		}
		html += '<div class="cc-seg cc-mode">' +
			'<button data-mode="pct" class="on">%</button>' +
			'<button data-mode="count">Count</button>' +
			'</div>';
		html += '</div></div>';

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
			var scaleMax = (state.mode === "pct") ? Math.max(pct(max, n), 1) : Math.max(max, 1);

			if (!shown.length) {
				rowsEl.innerHTML = '<p class="chart-note">No categories selected.</p>';
				return;
			}

			rowsEl.innerHTML = shown.map(function (d) {
				var value = (state.mode === "pct") ? pct(d.count, n) : d.count;
				var width = (value / scaleMax) * 100;
				var label = (state.mode === "pct")
					? fmtPct(pct(d.count, n)) + "%"
					: "n&nbsp;=&nbsp;" + d.count;
				var colour = GROUP_COLOURS[d.group] || "#00A189";
				return '<div class="bar-row">' +
					'<span class="bar-label">' + d.label + '</span>' +
					'<div class="bar-track"><div class="bar-fill" style="width:' + width.toFixed(1) +
						'%;background:' + colour + ';"></div></div>' +
					'<span class="bar-value">' + label + '</span>' +
					'</div>';
			}).join("");
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

		Array.prototype.forEach.call(el.querySelectorAll(".cc-mode button"), function (btn) {
			btn.addEventListener("click", function () {
				state.mode = btn.getAttribute("data-mode");
				Array.prototype.forEach.call(el.querySelectorAll(".cc-mode button"), function (b) {
					b.classList.remove("on");
				});
				btn.classList.add("on");
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
