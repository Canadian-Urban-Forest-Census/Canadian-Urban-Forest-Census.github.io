/* ==========================================================================
   Canadian Urban Forest Census — nav dropdown
   Opens on hover (pointer devices, via CSS) and on click / keyboard here.
   ========================================================================== */

(function () {
	function init() {
		var toggles = document.querySelectorAll("nav .menu-toggle");
		if (!toggles.length) return;

		function closeAll(except) {
			Array.prototype.forEach.call(toggles, function (t) {
				if (t !== except) t.setAttribute("aria-expanded", "false");
			});
		}

		Array.prototype.forEach.call(toggles, function (toggle) {
			toggle.addEventListener("click", function (e) {
				e.preventDefault();
				var open = toggle.getAttribute("aria-expanded") === "true";
				closeAll(toggle);
				toggle.setAttribute("aria-expanded", open ? "false" : "true");
			});

			toggle.addEventListener("keydown", function (e) {
				if (e.key === "ArrowDown") {
					e.preventDefault();
					toggle.setAttribute("aria-expanded", "true");
					var first = toggle.parentNode.querySelector(".menu a");
					if (first) first.focus();
				}
			});
		});

		document.addEventListener("click", function (e) {
			if (!e.target.closest(".has-menu")) closeAll(null);
		});

		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape") closeAll(null);
		});

		/* keep the menu open while tabbing through it */
		document.addEventListener("focusin", function (e) {
			if (!e.target.closest(".has-menu")) closeAll(null);
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
