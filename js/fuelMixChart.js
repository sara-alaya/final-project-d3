function initFuelMixChart() {
  const svg = d3.select("#fuelmix-chart");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 20, right: 200, bottom: 40, left: 70 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Load the cleaned fuel mix CSV
  d3.csv("data/ercot_fuelmix_hourly.csv").then(data => {
    // Column names for fuel types – adjust to match CSV
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

    // Parse types
    data.forEach(d => {
      d.timestamp = new Date(d.timestamp);
      fuelKeys.forEach(k => {
        d[k] = +d[k];
      });
    });

    const fullDomain = d3.extent(data, d => d.timestamp);

    // X scale: time
    const x = d3.scaleTime()
      .domain(fullDomain)
      .range([0, innerWidth]);

    // Y scale: 0 to max of stacked sum
    const maxTotal = d3.max(data, d =>
      fuelKeys.reduce((sum, k) => sum + (d[k] || 0), 0)
    );

    const y = d3.scaleLinear()
      .domain([0, maxTotal * 1.05])
      .range([innerHeight, 0]);

    // Color scale for fuel types
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

    // Axes
    const xAxis = d3.axisBottom(x)
      .ticks(10)
      .tickFormat(d3.timeFormat("%m-%d %H:%M"));

    const yAxis = d3.axisLeft(y)
      .ticks(6)
      .tickFormat(d3.format(","));

    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end");

    g.append("g")
      .call(yAxis)
      .append("text")
      .attr("fill", "black")
      .attr("x", -50)
      .attr("y", -10)
      .text("MW");

    // Stack layout
    const stack = d3.stack()
      .keys(fuelKeys)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const series = stack(data); // array per fuel type

    const area = d3.area()
      .x(d => x(d.data.timestamp))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    // Draw the stacked areas
    const layers = g.selectAll(".fuel-layer")
      .data(series)
      .enter()
      .append("path")
      .attr("class", d => `fuel-layer fuel-${d.key}`)
      .attr("d", area)
      .attr("fill", d => color(d.key))
      .attr("opacity", 0.85);

    // Legend
    const legend = g.append("g")
      .attr("transform", `translate(${innerWidth + 20}, 10)`);

    const legendItems = legend.selectAll(".legend-item")
      .data(fuelKeys)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0,${i * 18})`);

    legendItems.append("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", d => color(d));

    legendItems.append("text")
      .attr("x", 20)
      .attr("y", 11)
      .text(d => d.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))
      .style("font-size", "12px");

    // --- Fuel highlight logic ---
    function highlightFuel(fuelKey) {
      g.selectAll(".fuel-layer")
        .transition()
        .duration(100)
        .style("opacity", d => {
          if (!fuelKey) return 0.85;
          return d.key === fuelKey ? 0.95 : 0.15;
        });

      legendItems.selectAll("text")
        .transition()
        .duration(100)
        .style("font-weight", d => (fuelKey && d === fuelKey) ? "600" : "400");
    }

    // Legend hover → highlight that fuel
    legendItems
      .on("mouseenter", (event, key) => {
        highlightFuel(key);
      })
      .on("mouseleave", () => {
        highlightFuel(null);
      });

    // Expose to treemap / other charts
    window.highlightFuelFromTreemap = function (fuelKey) {
      highlightFuel(fuelKey || null);
    };

    // --- Time window API for brushing ---
    function applyTimeWindow(range) {
      const domain = range || fullDomain;
      x.domain(domain);

      xAxisG
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "rotate(-30)")
        .style("text-anchor", "end");

      g.selectAll(".fuel-layer")
        .attr("d", area);
    }

    window.applyTimeWindowToFuelMix = applyTimeWindow;
  });
}
