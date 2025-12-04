function initDemandChart() {
  const svg = d3.select("#demand-chart");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 20, right: 80, bottom: 40, left: 70 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Load the cleaned CSV
  d3.csv("data/ercot_demand_2025-12-01_to_2025-12-03.csv").then(data => {
    // Parse types
    data.forEach(d => {
      d.timestamp = new Date(d.timestamp); // JS understands the -06:00 offset
      d.actual_MW = +d.actual_MW;
      d.current_forecast_MW = +d.current_forecast_MW;
      d.day_ahead_forecast_MW = +d.day_ahead_forecast_MW;
    });

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.timestamp))
      .range([0, innerWidth]);

    const allYValues = data.flatMap(d => [
      d.actual_MW,
      d.current_forecast_MW,
      d.day_ahead_forecast_MW
    ]);

    const y = d3.scaleLinear()
      .domain([
        d3.min(allYValues) * 0.98,
        d3.max(allYValues) * 1.02
      ])
      .range([innerHeight, 0]);

    // Axes
    const xAxis = d3.axisBottom(x)
      .ticks(10)
      .tickFormat(d3.timeFormat("%m-%d %H:%M"));

    const yAxis = d3.axisLeft(y)
      .ticks(6)
      .tickFormat(d3.format(","));

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end");

    g.append("g")
      .call(yAxis)
      .append("text")
      .attr("fill", "black")
      .attr("x", -50)
      .attr("y", -10)
      .text("MW");

    // Line generator
    const line = d3.line()
      .x(d => x(d.timestamp))
      .y(d => y(d.value));

    // Helper to draw one series
    function drawSeries(key, cssClass) {
      const seriesData = data.map(d => ({ timestamp: d.timestamp, value: d[key] }));
      g.append("path")
        .datum(seriesData)
        .attr("class", cssClass)
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .attr("d", line);
    }

    // Draw 3 series with classes so you can style them in CSS
    drawSeries("current_forecast_MW", "line-current-forecast");
    drawSeries("actual_MW", "line-actual");
    drawSeries("day_ahead_forecast_MW", "line-dayahead");

    // Legend
    const legendData = [
      { label: "Current Forecast", cls: "line-current-forecast" },
      { label: "Actual Hourly Avg", cls: "line-actual" },
      { label: "Day-Ahead Forecast", cls: "line-dayahead" }
    ];

    const legend = g.append("g")
      .attr("transform", `translate(${innerWidth - 200},10)`);

    legend.selectAll("line")
      .data(legendData)
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", 30)
      .attr("y1", (d, i) => i * 20)
      .attr("y2", (d, i) => i * 20)
      .attr("class", d => d.cls)
      .attr("stroke-width", 2)
      .attr("fill", "none");

    legend.selectAll("text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("x", 35)
      .attr("y", (d, i) => i * 20 + 4)
      .text(d => d.label)
      .style("font-size", "12px");
  });
}
