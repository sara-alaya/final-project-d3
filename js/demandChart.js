function initDemandChart() {
  const svg = d3.select("#demand-chart");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 20, right: 80, bottom: 40, left: 70 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = d3.select("#tooltip");
  const timeFormat = d3.timeFormat("%Y-%m-%d %H:%M");
  const mwFmt = d3.format(",.0f");

  d3.csv("data/ercot_demand_2025-12-01_to_2025-12-03.csv").then(data => {
    data.forEach(d => {
      d.timestamp = new Date(d.timestamp);
      d.actual_MW = +d.actual_MW;
      d.current_forecast_MW = +d.current_forecast_MW;
      d.day_ahead_forecast_MW = +d.day_ahead_forecast_MW;
    });

    // >>> Expose for summary cards <<<
    window.globalDemandData = data;

    const fullTimeDomain = d3.extent(data, d => d.timestamp);

    const x = d3.scaleTime()
      .domain(fullTimeDomain)
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

    // line generators
    const lineActual = d3.line()
      .x(d => x(d.timestamp))
      .y(d => y(d.actual_MW));

    const lineCurrent = d3.line()
      .x(d => x(d.timestamp))
      .y(d => y(d.current_forecast_MW));

    const lineDA = d3.line()
      .x(d => x(d.timestamp))
      .y(d => y(d.day_ahead_forecast_MW));

    // paths
    g.append("path")
      .datum(data)
      .attr("class", "line-current-forecast")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("d", lineCurrent);

    g.append("path")
      .datum(data)
      .attr("class", "line-actual")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("d", lineActual);

    g.append("path")
      .datum(data)
      .attr("class", "line-dayahead")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("d", lineDA);

    // Hover circles
    const focusActual = g.append("circle")
      .attr("r", 4)
      .attr("fill", "#00b3b3")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("opacity", 0);

    const focusCurrent = g.append("circle")
      .attr("r", 4)
      .attr("fill", "#4b4df0")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("opacity", 0);

    const focusDA = g.append("circle")
      .attr("r", 4)
      .attr("fill", "none")
      .attr("stroke", "#4b4df0")
      .attr("stroke-width", 2)
      .style("opacity", 0);

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

    // Tooltip overlay
    const bisectTime = d3.bisector(d => d.timestamp).left;

    const overlay = g.append("rect")
      .attr("class", "demand-hover-overlay")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "none")
      .attr("pointer-events", "all");

    overlay
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event, overlay.node());
        const xTime = x.invert(mx);

        const idx = bisectTime(data, xTime);
        const i = Math.max(0, Math.min(data.length - 1, idx));
        const dPoint = data[i];

        const act = dPoint.actual_MW;
        const cur = dPoint.current_forecast_MW;
        const da = dPoint.day_ahead_forecast_MW;

        const errCur = act - cur;
        const errDa = act - da;

        const diffFmt = v => (v > 0 ? "+" : "") + mwFmt(v);

        // Move circles
        focusActual
          .style("opacity", 1)
          .attr("cx", x(dPoint.timestamp))
          .attr("cy", y(act));

        focusCurrent
          .style("opacity", 1)
          .attr("cx", x(dPoint.timestamp))
          .attr("cy", y(cur));

        focusDA
          .style("opacity", 1)
          .attr("cx", x(dPoint.timestamp))
          .attr("cy", y(da));

        // Tooltip
        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>System-Wide Demand</strong></div>
            <div>${timeFormat(dPoint.timestamp)}</div>
            <hr/>
            <div>Actual: ${mwFmt(act)} MW</div>
            <div>Current Forecast: ${mwFmt(cur)} MW</div>
            <div>Day-Ahead Forecast: ${mwFmt(da)} MW</div>
            <hr/>
            <div>Actual - Current: ${diffFmt(errCur)} MW</div>
            <div>Actual - Day-Ahead: ${diffFmt(errDa)} MW</div>
          `);

        const [pageX, pageY] = d3.pointer(event, document.body);
        tooltip
          .style("left", `${pageX + 12}px`)
          .style("top", `${pageY - 28}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
        focusActual.style("opacity", 0);
        focusCurrent.style("opacity", 0);
        focusDA.style("opacity", 0);
      });

    // --- Linked time brushing: small band at bottom ---
    const brush = d3.brushX()
      .extent([[0, innerHeight - 30], [innerWidth, innerHeight]])
      .on("end", brushed);

    g.append("g")
      .attr("class", "time-brush")
      .call(brush);

    function updateDemandDomain(range) {
      const domain = range || fullTimeDomain;
      x.domain(domain);

      xAxisG
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "rotate(-30)")
        .style("text-anchor", "end");

      g.select(".line-actual").attr("d", lineActual);
      g.select(".line-current-forecast").attr("d", lineCurrent);
      g.select(".line-dayahead").attr("d", lineDA);
    }

    function brushed(event) {
      if (!event.selection) {
        updateDemandDomain(null);
        if (window.applyTimeWindowToHubPrice) window.applyTimeWindowToHubPrice(null);
        if (window.applyTimeWindowToFuelMix) window.applyTimeWindowToFuelMix(null);
        return;
      }

      const [x0, x1] = event.selection.map(x.invert);
      const range = [x0, x1];

      updateDemandDomain(range);

      if (window.applyTimeWindowToHubPrice) window.applyTimeWindowToHubPrice(range);
      if (window.applyTimeWindowToFuelMix) window.applyTimeWindowToFuelMix(range);
    }
  });
}
