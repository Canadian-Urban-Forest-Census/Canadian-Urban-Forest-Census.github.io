/* ==========================================================================
   Canadian Urban Forest Census — agree/disagree (Likert) charts
   Usage:
     <div class="census-likert" data-chart='{
       "note": "...",
       "groups": [
         { "label": "Actively enforced",
           "rows": [ { "label": "Street trees",  "n": 99, "counts": [6, 24, 18, 42, 9] },
                     { "label": "Private trees", "n": 78, "counts": [5, 22, 12, 31, 8] } ] }
       ] }'></div>

   "counts" are the number of municipalities giving each answer, in order:
   Strongly disagree, Disagree, Neutral, Agree, Strongly agree.
   They must add up to "n". Percentages are computed from counts / n.
   Optional "scale": five labels to replace the default answer names.
   Optional "labelWidth": width of the row-label column (default "110px").
   A group's "label" is optional; leave it out for a single list of rows.
   Each bar is a full 0-100% stack; the totals either side are the combined
   disagree (left) and agree (right) shares.
   ========================================================================== */

window.CensusLikert = (function () {

	var SCALE = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
	/* diverging: blue = disagree, grey = neutral, green = agree
	   (matches LIKERT_PALETTE in the analysis figures) */
	var COLOURS = ["#466484", "#879cb0", "#c8cdd1", "#A8E4A0", "#2E8B57"];
	/* text colour that reads on each fill */
	var INK = ["#ffffff", "#191919", "#191919", "#191919", "#ffffff"];
	var LABEL_MIN = 9;   // only print a % inside segments at least this wide

	function pct(c, n) { return (c / n) * 100; }
	function fmt(v) { return String(Math.round(v)); }
	function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

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
		var scale = cfg.scale || SCALE;
		if (cfg.labelWidth) el.style.setProperty("--lk-label", cfg.labelWidth);

		var html = '<div class="lk-legend" aria-hidden="true">';
		scale.forEach(function (s, i) {
			html += '<span><i style="background:' + COLOURS[i] + '"></i>' + esc(s) + '</span>';
		});
		html += '</div>';

		html += '<div class="lk-head" aria-hidden="true"><span></span><span class="lk-side">Disagree</span><span></span><span class="lk-side">Agree</span></div>';

		cfg.groups.forEach(function (g) {
			html += '<div class="lk-group">' + (g.label ? '<p class="lk-title">' + esc(g.label) + '</p>' : '');
			g.rows.forEach(function (r) {
				var dis = pct(r.counts[0] + r.counts[1], r.n);
				var agr = pct(r.counts[3] + r.counts[4], r.n);
				var summary = (g.label ? g.label + ", " : "") + r.label + ": " +
					scale.map(function (s, i) { return s + " " + fmt(pct(r.counts[i], r.n)) + "%"; }).join(", ") +
					" (n = " + r.n + ")";
				html += '<div class="lk-row" role="img" aria-label="' + esc(summary) + '">' +
					'<span class="lk-label">' + esc(r.label) + '</span>' +
					'<span class="lk-total lk-dis">' + fmt(dis) + '%</span>' +
					'<div class="lk-track">';
				r.counts.forEach(function (c, i) {
					if (!c) return;
					var w = pct(c, r.n);
					html += '<span class="lk-seg" style="width:' + w.toFixed(2) + '%;background:' + COLOURS[i] +
						';color:' + INK[i] + '" data-i="' + i + '" data-c="' + c + '" data-n="' + r.n + '">' +
						(w >= LABEL_MIN ? fmt(w) : "") + '</span>';
				});
				html += '</div><span class="lk-total lk-agr">' + fmt(agr) + '%</span></div>';
			});
			html += '</div>';
		});

		if (cfg.note) html += '<p class="chart-note">' + cfg.note + '</p>';
		el.innerHTML = html;

		Array.prototype.forEach.call(el.querySelectorAll(".lk-seg"), function (seg) {
			seg.addEventListener("mousemove", function (e) {
				var i = +seg.getAttribute("data-i"), c = +seg.getAttribute("data-c"), n = +seg.getAttribute("data-n");
				tip.innerHTML = esc(scale[i]) + ": <strong>" + c + "</strong> of " + n +
					" municipalities (" + pct(c, n).toFixed(1).replace(/\.0$/, "") + "%)";
				tip.style.display = "block";
				tip.style.left = e.clientX + "px";
				tip.style.top = e.clientY + "px";
			});
			seg.addEventListener("mouseleave", function () { tip.style.display = "none"; });
		});
	}

	function initAll(selector) {
		Array.prototype.forEach.call(document.querySelectorAll(selector || ".census-likert"), build);
	}

	return { initAll: initAll };
})();
