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

   symbol: "canopy" (top-down crown) or "tree" (side view with trunk).
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
		return v.toFixed(1).replace(/\.0$/, "");
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

			html += '<div class="pc-row" tabindex="0" role="img" aria-label="' + esc(aria) + '"' +
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
