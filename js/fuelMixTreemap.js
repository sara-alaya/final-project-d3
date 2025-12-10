function initFuelMixTreemap() {
  const svg = d3.select("#fuelmix-treemap");
  if (svg.empty()) return; // in case the SVG isn't present

  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 10, right: 10, bottom: 10, left: 10 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = d3.select("#tooltip");

  // Column names used in your fuel mix CSV
  const fuelKeys = [
    "solar",
    "wind",
    "hydro",
    "power_storage",
    "other",
    "natural_gas",
    "coal_and_lignite",
    "nuclear"
  ];

  // Colors aligned with fuelMixChart.js
  const color = d3.scaleOrdinal()
    .domain(fuelKeys)
    .range([
      "#f4c20d", // solar
      "#1a73e8", // wind
      "#34a853", // hydro
      "#a142f4", // storage
      "#9e9e9e", // other
      "#ff6d01", // gas
      "#5f6368", // coal
      "#0b8043"  // nuclear
    ]);

  d3.csv("data/ercot_fuelmix_hourly.csv").then(data => {
    // Parse numeric values
    data.forEach(d => {
      fuelKeys.forEach(k => {
        d[k] = +d[k];
      });
    });

    // Aggregate total MW over the period for each fuel type
    const totals = fuelKeys.map(k => {
      const sum = d3.sum(data, d => d[k]);
      return { key: k, total: sum };
    });

    const grandTotal = d3.sum(totals, d => d.total);

    // Treemap requires a hierarchy
    const root = d3.hierarchy({
      name: "fuelmix",
      children: totals.map(d => ({
        name: d.key,
        value: d.total
      }))
    }).sum(d => d.value);

    d3.treemap()
      .size([innerWidth, innerHeight])
      .paddingInner(2)(root);

    const nodes = g.selectAll("g.treemap-node")
      .data(root.leaves())
      .enter()
      .append("g")
      .attr("class", "treemap-node")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    nodes.append("rect")
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", d => color(d.data.name))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .on("mousemove", (event, d) => {
        const fuelKey = d.data.name;
        const humanName = fuelKey
          .replace(/_/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase());

        const total = d.data.value;
        const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;

        // Cross-highlight fuel in the stacked area chart if function exists
        if (window.highlightFuelFromTreemap) {
          window.highlightFuelFromTreemap(fuelKey);
        }

        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>${humanName}</strong></div>
            <div>Total Generation: ${d3.format(",.0f")(total)} MW (sum over period)</div>
            <div>Share of Mix: ${pct.toFixed(1)}%</div>
          `);

        const [pageX, pageY] = d3.pointer(event, document.body);
        tooltip
          .style("left", `${pageX + 12}px`)
          .style("top", `${pageY - 28}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
        if (window.highlightFuelFromTreemap) {
          window.highlightFuelFromTreemap(null);
        }
      });

    // Add short labels if the rectangle is big enough
    nodes.append("text")
      .attr("x", 4)
      .attr("y", 14)
      .text(d => {
        const fuelKey = d.data.name;
        const humanName = fuelKey
          .replace(/_/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase());
        return humanName;
      })
      .attr("fill", "#ffffff")
      .attr("font-size", "11px")
      .attr("pointer-events", "none");
  });
}
