/* ==========================================================================
   Canadian Urban Forest Census — pictogram charts
   Rows of ten symbols; each symbol = 10 percentage points, filled left to
   right, with the last symbol partly filled (clipped within that symbol).

   Usage:
     <div class="census-pictogram"
          data-pictogram='{"decimals": 1, "note": "...", "rows": [
            {"label": "Knows tree canopy cover", "count": 56, "n": 134, "symbol": "canopy"},
            {"label": "Knows number of street trees", "count": 31, "n": 134, "symbol": "tree"}
          ]}'>
       (fallback text shown if JavaScript does not run)
     </div>

     CensusPictogram.initAll(".census-pictogram");

   symbol: "canopy" (top-down crown), "tree" (side view with trunk) or
           "reel" (DBH tape).
   inner:  optional {"count": 16, "label": "Both goals"}: a subset drawn in
           the darker colour from the left, like the dark bar segments.
   Colours are set in styles.css (.pc-empty, .pc-fill, .pc-fill-inner,
   .pc-trunk).
   The tooltip reuses the .cc-tip element and style from charts.js.
   ========================================================================== */

(function () {
	var CELL = 36;      // symbol cell width and spacing in SVG units
	var STEP = 40;      // distance between symbol origins (CELL + gap)
	var HEIGHT = 40;
	var COUNT = 10;
	var WIDTH = STEP * (COUNT - 1) + CELL;

	// Shapes are drawn in a 36 x 40 cell. x0/x1 = horizontal extent of the
	// visible shape, so a partial fill is a share of the symbol, not the cell.
	var SHAPES = {
		canopy: {
			x0: 0.2, x1: 35.6,
			svg:
				'<circle cx="17.5" cy="19.5" r="11"/>' +
				'<circle cx="16" cy="8" r="7.2"/>' +
				'<circle cx="27" cy="10.5" r="6"/>' +
				'<circle cx="30" cy="19" r="5.6"/>' +
				'<circle cx="27.5" cy="28.5" r="6.8"/>' +
				'<circle cx="19" cy="32" r="6.4"/>' +
				'<circle cx="8.5" cy="29.5" r="6"/>' +
				'<circle cx="6.4" cy="18" r="6.2"/>' +
				'<circle cx="8.5" cy="9.5" r="5.4"/>'
		},
		tree: {
			x0: 3.5, x1: 32.5,
			svg:
				'<path class="pc-trunk" d="M16 25 L20 25 L20.8 39.5 L15.2 39.5 Z"/>' +
				'<circle cx="18" cy="13" r="10.5"/>' +
				'<circle cx="11" cy="17.5" r="7.5"/>' +
				'<circle cx="25" cy="17.5" r="7.5"/>' +
				'<circle cx="13.5" cy="9" r="6.5"/>' +
				'<circle cx="22.5" cy="9" r="6.5"/>' +
				'<circle cx="18" cy="22" r="7"/>'
		},
		// DBH tape: orange case, white label ring, black winder; white tape with
		// tick marks runs off the bottom to the left and ends in a black bar.
		// Colours come from styles.css (.pc-reel-*), so filled and empty differ.
		reel: {
			x0: 2.0, x1: 35.0, vc: 17,
			svg:
				'<path class="pc-reel-edge" d="M24 26.6 L3.4 26.6" fill="none" stroke-width="4.2"/>' +
				'<path d="M24 26.6 L3.4 26.6" fill="none" stroke="#ffffff" stroke-width="2.8"/>' +
				'<path class="pc-reel-edge" d="M24 27.35 L3.4 27.35" fill="none" stroke-width="1.1" stroke-dasharray="0.45 1.85"/>' +
				'<rect class="pc-reel-dark" x="2" y="24.1" width="2.2" height="5" rx="0.5"/>' +
				'<circle class="pc-reel-case" cx="24" cy="17" r="11"/>' +
				'<circle cx="24" cy="17" r="6.49" fill="none" stroke="#ffffff" stroke-width="1.43"/>' +
				'<g transform="rotate(-20 24 17)">' +
				'<rect class="pc-reel-dark" x="19.93" y="15.57" width="8.14" height="2.86" rx="0.88"/>' +
				'<circle cx="26.42" cy="17" r="0.66" fill="#ffffff"/></g>'
		}
	};

	var uid = 0;
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

	// decimals: places shown in the label (default 1; 0 = whole percent).
	// The fill always uses one decimal, so 41.8% fills 18% of the fifth symbol.
	function fmtPct(v, decimals) {
		if (decimals === 0) return String(Math.round(v));
		return v.toFixed(1);
	}

	function esc(s) {
		var d = document.createElement("div");
		d.textContent = s;
		return d.innerHTML;
	}

	// Clip a shape to the left share f (0-1) of its own width.
	function clipped(shape, cls, f, clipId, defsOut) {
		if (f <= 0) return "";
		if (f >= 1) return '<g class="' + cls + '">' + shape.svg + '</g>';
		var w = (shape.x1 - shape.x0) * f;
		defsOut.push('<clipPath id="' + clipId + '"><rect x="' + shape.x0 + '" y="-1" width="' +
			w.toFixed(2) + '" height="' + (HEIGHT + 2) + '"/></clipPath>');
		return '<g class="' + cls + '" clip-path="url(#' + clipId + ')">' + shape.svg + '</g>';
	}

	function symbolsSvg(shapeName, pct, innerPct, id) {
		var shape = SHAPES[shapeName] || SHAPES.tree;
		var units = pct / 10;
		var innerUnits = innerPct / 10;
		var defs = [];
		var body = "";

		for (var i = 0; i < COUNT; i++) {
			var f = Math.max(0, Math.min(1, units - i));
			var fi = Math.max(0, Math.min(1, innerUnits - i));
			var g = '<g transform="translate(' + (i * STEP) + ' 0)">';
			if (f < 1) g += '<g class="pc-empty">' + shape.svg + '</g>';
			g += clipped(shape, "pc-on pc-fill", f, id + "-m" + i, defs);
			g += clipped(shape, "pc-on pc-fill-inner", fi, id + "-i" + i, defs);
			body += g + '</g>';
		}

		return '<svg class="pc-svg" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" aria-hidden="true" focusable="false">' +
			(defs.length ? '<defs>' + defs.join("") + '</defs>' : '') + body + '</svg>';
	}

	function build(el) {
		ensureTip();
		var cfg;
		try {
			cfg = JSON.parse(el.getAttribute("data-pictogram"));
		} catch (e) {
			return; // leave the fallback content in place
		}

		var decimals = cfg.decimals === 0 ? 0 : 1;
		var html = '<div class="pc-rows">';
		cfg.rows.forEach(function (r, ri) {
			// Round to one decimal first so the fill matches the number shown.
			var pct = Math.round((r.count / r.n) * 1000) / 10;
			var innerPct = r.inner ? Math.round((r.inner.count / r.n) * 1000) / 10 : 0;
			var id = "pc" + (++uid) + "-" + ri;
			var aria = r.label + ": " + fmtPct(pct, decimals) + "% (" + r.count + " of " + r.n + " municipalities" +
				(r.inner ? "; " + (r.inner.label || "subset") + ": " + r.inner.count : "") + ")";

			var shapeDef = SHAPES[r.symbol] || SHAPES.tree;
			html += '<div class="pc-row' + (shapeDef.vc ? ' pc-row-' + r.symbol : '') + '" tabindex="0" role="img" aria-label="' + esc(aria) + '"' +
				' data-count="' + r.count + '" data-n="' + r.n + '"' +
				(r.inner ? ' data-inner-label="' + esc(r.inner.label || "") + '" data-inner-count="' + r.inner.count + '"' : '') + '>' +
				'<p class="pc-label" aria-hidden="true">' + esc(r.label) + '</p>' +
				'<div class="pc-line" aria-hidden="true">' +
				symbolsSvg(r.symbol, pct, innerPct, id) +
				'<span class="pc-value">' + fmtPct(pct, decimals) + '%</span>' +
				'</div></div>';
		});
		html += '</div>';
		if (cfg.note) html += '<p class="chart-note">' + cfg.note + '</p>';

		el.innerHTML = html;

		Array.prototype.forEach.call(el.querySelectorAll(".pc-row"), function (row) {
			function text() {
				var innerCount = row.getAttribute("data-inner-count");
				var inner = innerCount === null ? "" :
					row.getAttribute("data-inner-label") + ": <strong>" + innerCount + "</strong>";
				return "<strong>" + row.getAttribute("data-count") + "</strong> of " +
					row.getAttribute("data-n") + " municipalities" + (inner ? "<br>" + inner : "");
			}
			row.addEventListener("mousemove", function (e) {
				tip.innerHTML = text();
				tip.style.display = "block";
				tip.style.left = e.clientX + "px";
				tip.style.top = e.clientY + "px";
			});
			row.addEventListener("mouseleave", function () { tip.style.display = "none"; });
			row.addEventListener("focus", function () {
				var b = row.querySelector(".pc-value").getBoundingClientRect();
				tip.innerHTML = text();
				tip.style.display = "block";
				tip.style.left = b.right + "px";
				tip.style.top = (b.top + b.height / 2) + "px";
			});
			row.addEventListener("blur", function () { tip.style.display = "none"; });
		});
	}

	window.CensusPictogram = {
		build: build,
		initAll: function (selector) {
			Array.prototype.forEach.call(document.querySelectorAll(selector), build);
		}
	};
})();


/* ==========================================================================
   Document grid: one small "plan" icon per municipality (no rounding,
   no partial symbols). Icons are generated from the categories array,
   and the legend uses the same values.

   Usage:
     <div class="census-docgrid" data-docgrid='{
          "decimals": 0,
          "note": "Each document represents one of the 137 municipalities that answered the question.",
          "categories": [
            {"label": "Existing plan", "count": 60, "color": "#0D534D"},
            {"label": "In development", "count": 40, "color": "#2E8B57"},
            {"label": "No plan", "count": 37, "color": "#D3DDD2"}
          ]}'></div>

     CensusDocGrid.initAll(".census-docgrid");

   Layout: 20 columns, legend to the right (stacks below on narrow screens).
   SCALE sets the display size: 1 SVG unit = SCALE pixels at most.
   ========================================================================== */

(function () {
	var DOC_W = 14, DOC_H = 20;      // icon size in SVG units (portrait, like a report)
	var STEP_X = 18, STEP_Y = 24;    // icon spacing
	var COLS = 20;
	var SCALE = 0.9;                 // 14 x 20 units -> about 13 x 18 px icons

	// Document: page with a folded top-right corner (14 x 20 units).
	var PAGE = '<path d="M1.6 0 H10 L14 4 V18.4 Q14 20 12.4 20 H1.6 Q0 20 0 18.4 V1.6 Q0 0 1.6 0 Z"/>';
	var FOLD = '<path class="dg-fold" d="M10 0 V2.6 Q10 4 11.4 4 H14 Z"/>';

	// Cover: small tree above two title lines, drawn in white.
	var COVER =
		'<circle cx="7" cy="6.6" r="2.6"/>' +
		'<circle cx="5.1" cy="8.1" r="2"/>' +
		'<circle cx="8.9" cy="8.1" r="2"/>' +
		'<rect x="6.4" y="9" width="1.2" height="3" rx="0.3"/>' +
		'<rect x="2.8" y="14" width="8.4" height="1.2" rx="0.6"/>' +
		'<rect x="2.8" y="16.4" width="5.6" height="1.2" rx="0.6"/>';

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

	function fmtPct(v, decimals) {
		return decimals === 0 ? String(Math.round(v)) : v.toFixed(decimals);
	}

	function esc(s) {
		var d = document.createElement("div");
		d.textContent = s;
		return d.innerHTML;
	}

	function gridSvg(cats, total, cols) {
		var rows = Math.ceil(total / cols);
		var w = STEP_X * (cols - 1) + DOC_W;
		var h = STEP_Y * (rows - 1) + DOC_H;
		var body = "";
		var i = 0;
		cats.forEach(function (c, ci) {
			for (var k = 0; k < c.count; k++, i++) {
				var x = (i % cols) * STEP_X;
				var y = Math.floor(i / cols) * STEP_Y;
				body += '<g class="dg-doc" data-cat="' + ci + '" transform="translate(' + x + ' ' + y + ')">' +
					'<g fill="' + c.color + '">' + PAGE + '</g>' + FOLD +
					'<g class="dg-tree">' + COVER + '</g></g>';
			}
		});
		return '<svg class="dg-svg" viewBox="0 0 ' + w + ' ' + h + '" style="max-width:' + (w * SCALE) + 'px"' +
			' aria-hidden="true" focusable="false">' + body + '</svg>';
	}

	function build(el) {
		ensureTip();
		var cfg;
		try { cfg = JSON.parse(el.getAttribute("data-docgrid")); } catch (e) { return; }

		var cats = cfg.categories;
		var decimals = cfg.decimals === undefined ? 0 : cfg.decimals;
		var total = cats.reduce(function (s, c) { return s + c.count; }, 0);
		cats.forEach(function (c) { c.pct = fmtPct((c.count / total) * 100, decimals); });

		var legend = '<ul class="dg-legend">' + cats.map(function (c, ci) {
			return '<li tabindex="0" data-cat="' + ci + '"><i style="background:' + c.color + '"></i>' +
				'<span><strong>' + esc(c.label) + '</strong><br>' + c.count + ' municipalities (' + c.pct + '%)</span></li>';
		}).join("") + '</ul>';

		function render() {
			el.innerHTML = '<div class="dg-body"><div class="dg-grid">' + gridSvg(cats, total, COLS) + '</div>' + legend + '</div>' +
				(cfg.note ? '<p class="chart-note">' + cfg.note + '</p>' : '');
			wire();
		}

		function highlight(ci) {
			el.classList.toggle("dg-focus", ci !== null);
			Array.prototype.forEach.call(el.querySelectorAll("[data-cat]"), function (n) {
				n.classList.toggle("dg-on", ci !== null && n.getAttribute("data-cat") === String(ci));
			});
		}

		function tipText(c) {
			return esc(c.label) + "<br><strong>" + c.count + "</strong> of " + total +
				" municipalities (" + c.pct + "%)";
		}

		function wire() {
			var svg = el.querySelector(".dg-svg");
			svg.addEventListener("mousemove", function (e) {
				var doc = e.target.closest ? e.target.closest(".dg-doc") : null;
				if (!doc) { tip.style.display = "none"; highlight(null); return; }
				var ci = +doc.getAttribute("data-cat");
				tip.innerHTML = tipText(cats[ci]);
				tip.style.display = "block";
				tip.style.left = e.clientX + "px";
				tip.style.top = e.clientY + "px";
				highlight(ci);
			});
			svg.addEventListener("mouseleave", function () { tip.style.display = "none"; highlight(null); });

			// Legend items: hover or keyboard focus highlights that category.
			Array.prototype.forEach.call(el.querySelectorAll(".dg-legend li"), function (li) {
				var ci = +li.getAttribute("data-cat");
				li.addEventListener("mouseenter", function () { highlight(ci); });
				li.addEventListener("mouseleave", function () { highlight(null); });
				li.addEventListener("focus", function () { highlight(ci); });
				li.addEventListener("blur", function () { highlight(null); });
			});
		}

		render();
	}

	window.CensusDocGrid = {
		build: build,
		initAll: function (selector) {
			Array.prototype.forEach.call(document.querySelectorAll(selector), build);
		}
	};
})();
