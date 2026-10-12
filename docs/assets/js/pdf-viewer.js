/* ==========================================================================
   Canadian Urban Forest Census — PDF viewer
   Links with class "js-pdf" open in an overlay on wider screens.
   ========================================================================== */

// PDF viewer: opens PDFs in an overlay on wider screens,
// falls back to a new tab on phones or older browsers.
(function () {
	var viewer = document.getElementById("pdf-viewer");
	var frame = document.getElementById("pdf-frame");
	if (!viewer || typeof viewer.showModal !== "function") return;

	document.querySelectorAll(".js-pdf").forEach(function (link) {
		link.addEventListener("click", function (e) {
			if (window.innerWidth < 700) return;
			e.preventDefault();
			frame.src = link.href;
			document.getElementById("pdf-download").href = link.href;
			viewer.showModal();
		});
	});

	document.getElementById("pdf-close").addEventListener("click", function () { viewer.close(); });
	viewer.addEventListener("click", function (e) { if (e.target === viewer) viewer.close(); });
	viewer.addEventListener("close", function () { frame.src = ""; });
})();
