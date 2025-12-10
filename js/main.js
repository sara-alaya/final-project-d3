// Entry point: called after all other JS files are loaded
document.addEventListener("DOMContentLoaded", () => {
  initDemandChart();
  initHubPriceChart();
  initFuelMixChart();
  initLmpHeatmap();
  initFuelMixTreemap();
  setTimeout(updateSummaryCards, 500);
});

function updateSummaryCards() {
  // Demand
  if (window.globalDemandData) {
    const peak = d3.max(window.globalDemandData, d => d.actual_MW);
    document.getElementById("card-peak-demand").textContent =
      d3.format(",")(peak) + " MW";
  }

  // RT Price
  if (window.globalPriceRT) {
    const maxRT = d3.max(window.globalPriceRT, d => d.rt_price);
    document.getElementById("card-max-rt-price").textContent =
      d3.format("$.0f")(maxRT);
  }

  // RT–DA Spread
  if (window.globalCombinedPrices) {
    const spreads = window.globalCombinedPrices
      .map(d => (d.da_price != null ? d.rt_price - d.da_price : null))
      .filter(v => v != null);

    const maxSpread = d3.max(spreads);
    document.getElementById("card-max-spread").textContent =
      d3.format("$.0f")(maxSpread);
  }
}

