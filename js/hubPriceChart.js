function initHubPriceChart() {
  const svg = d3.select("#hubprice-chart");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 20, right: 80, bottom: 40, left: 70 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const locationSelect = document.getElementById("price-location-select");
  const tooltip = d3.select("#tooltip");
  const timeFormat = d3.timeFormat("%Y-%m-%d %H:%M");
  const priceFmt = d3.format("$.2f");

  Promise.all([
    d3.csv("data/ercot_lmp_hourly.csv"),
    d3.csv("data/ercot_day_ahead_hourly.csv")
  ]).then(([rtRaw, daRaw]) => {
    // --- Parse Real-Time data ---
    rtRaw.forEach(d => {
      d.timestamp = new Date(d.timestamp);
      d.location = d.location;
      d.rt_price = +d.price;
    });

    // --- Parse Day-Ahead data ---
    daRaw.forEach(d => {
      d.timestamp = new Date(d.timestamp);
      d.location = d.SettlementPoint;
      d.da_price = +d.SettlementPointPrice;
    });

    // Index DA prices by (timestamp, location)
    const daIndex = new Map();
    daRaw.forEach(d => {
      const key = `${+d.timestamp}|${d.location}`;
      daIndex.set(key, d.da_price);
    });

    // Combine RT + DA
    const combined = rtRaw.map(d => {
      const key = `${+d.timestamp}|${d.location}`;
      const da = daIndex.get(key);
      return {
        timestamp: d.timestamp,
        location: d.location,
        rt_price: d.rt_price,
        da_price: da != null ? da : null
      };
    });

    // >>> Expose for summary cards <<<
    window.globalPriceRT = rtRaw;
    window.globalPriceDA = daRaw;
    window.globalCombinedPrices = combined;

    const locations = Array.from(new Set(combined.map(d => d.location))).sort();
    const dataByLocation = d3.group(combined, d => d.location);

    // System averages
    const groupedByTime = d3.group(combined, d => d.timestamp.getTime());
    const systemSeries = Array.from(groupedByTime, ([t, values]) => ({
      timestamp: new Date(+t),
      rt_price: d3.mean(values, v => v.rt_price),
      da_price: d3.mean(values, v => v.da_price)
    })).sort((a, b) => d3.ascending(a.timestamp, b.timestamp));

    // --- Scales ---
    const allTimes = d3.extent(combined, d => d.timestamp);
    const allPrices = [];
    combined.forEach(d => {
      if (d.rt_price != null) allPrices.push(d.rt_price);
      if (d.da_price != null) allPrices.push(d.da_price);
    });
    const priceExtent = d3.extent(allPrices);
    const yPadding = 0.05;

    const x = d3.scaleTime()
      .domain(allTimes)
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([
        priceExtent[0] * (1 - yPadding),
        priceExtent[1] * (1 + yPadding)
      ])
      .range([innerHeight, 0]);

    const xAxis = d3.axisBottom(x)
      .ticks(10)
      .tickFormat(d3.timeFormat("%m-%d %H:%M"));

    const yAxis = d3.axisLeft(y)
      .ticks(6)
      .tickFormat(d3.format("$.0f"));

    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end");

    g.append("g")
      .call(yAxis);

    // --- Line generators ---
    const lineRT = d3.line()
      .x(d => x(d.timestamp))
      .y(d => y(d.rt_price));

    const lineDA = d3.line()
      .defined(d => d.da_price != null)
      .x(d => x(d.timestamp))
      .y(d => y(d.da_price));

    // --- Paths ---
    const locRtPath = g.append("path")
      .attr("class", "line-hubprice-selected-rt")
      .attr("fill", "none")
      .attr("stroke-width", 2);

    const locDaPath = g.append("path")
      .attr("class", "line-hubprice-selected-da")
      .attr("fill", "none")
      .attr("stroke-width", 2);

    const sysRtPath = g.append("path")
      .datum(systemSeries)
      .attr("class", "line-hubprice-avg-rt")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("d", lineRT);

    const sysDaPath = g.append("path")
      .datum(systemSeries)
      .attr("class", "line-hubprice-avg-da")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("d", lineDA);

    // --- Hover circles ---
    const focusRt = g.append("circle")
      .attr("r", 4)
      .attr("fill", "#ff6d01")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("opacity", 0);

    const focusDa = g.append("circle")
      .attr("r", 4)
      .attr("fill", "none")
      .attr("stroke", "#ff6d01")
      .attr("stroke-width", 2)
      .style("opacity", 0);

    const focusSysRt = g.append("circle")
      .attr("r", 4)
      .attr("fill", "#4b4df0")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("opacity", 0);

    const focusSysDa = g.append("circle")
      .attr("r", 4)
      .attr("fill", "none")
      .attr("stroke", "#4b4df0")
      .attr("stroke-width", 2)
      .style("opacity", 0);

    // --- Legend ---
    const legend = g.append("g")
      .attr("transform", `translate(${innerWidth - 230},10)`);

    const legendData = [
      { label: "Selected Hub/Zone (RT)", cls: "line-hubprice-selected-rt" },
      { label: "Selected Hub/Zone (DA)", cls: "line-hubprice-selected-da" },
      { label: "System Avg (RT)",       cls: "line-hubprice-avg-rt" },
      { label: "System Avg (DA)",       cls: "line-hubprice-avg-da" }
    ];

    legend.selectAll("line")
      .data(legendData)
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", 30)
      .attr("y1", (d, i) => i * 20)
      .attr("y2", (d, i) => i * 20)
      .attr("class", d => d.cls)
      .attr("stroke-width", 2);

    legend.selectAll("text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("x", 35)
      .attr("y", (d, i) => i * 20 + 4)
      .text(d => d.label)
      .style("font-size", "12px");

    // --- Dropdown ---
    locations.forEach(loc => {
      const opt = document.createElement("option");
      opt.value = loc;
      opt.textContent = loc;
      locationSelect.appendChild(opt);
    });

    const defaultLocation = locations.includes("HB_HOUSTON")
      ? "HB_HOUSTON"
      : locations[0];
    locationSelect.value = defaultLocation;

    let currentSeries = [];
    const bisectTime = d3.bisector(d => d.timestamp).left;

    function updateLocation(loc) {
      currentSeries = (dataByLocation.get(loc) || [])
        .slice()
        .sort((a, b) => d3.ascending(a.timestamp, b.timestamp));

      locRtPath
        .datum(currentSeries)
        .attr("d", lineRT);

      locDaPath
        .datum(currentSeries)
        .attr("d", lineDA);

      // expose for cross-interactions later
      window.setSelectedHubLocation = updateLocation;
    }

    // Initial draw
    updateLocation(defaultLocation);

    locationSelect.addEventListener("change", () => {
      updateLocation(locationSelect.value);
    });

    // --- Linked time window API for other charts ---
    function applyTimeWindow(range) {
      const domain = range || allTimes;
      x.domain(domain);

      xAxisG
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "rotate(-30)")
        .style("text-anchor", "end");

      sysRtPath.attr("d", lineRT);
      sysDaPath.attr("d", lineDA);

      if (currentSeries.length) {
        locRtPath.attr("d", lineRT(currentSeries));
        locDaPath.attr("d", lineDA(currentSeries));
      }
    }

    window.applyTimeWindowToHubPrice = applyTimeWindow;

    // --- Tooltip overlay for RT/DA + spreads ---
    const overlay = g.append("rect")
      .attr("class", "hubprice-hover-overlay")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "none")
      .attr("pointer-events", "all");

    overlay
      .on("mousemove", (event) => {
        if (!currentSeries.length) return;
        const [mx] = d3.pointer(event, overlay.node());
        const xTime = x.invert(mx);

        const idx = bisectTime(currentSeries, xTime);
        const i = Math.max(0, Math.min(currentSeries.length - 1, idx));
        const point = currentSeries[i];

        const j = bisectTime(systemSeries, point.timestamp);
        const jIdx = Math.max(0, Math.min(systemSeries.length - 1, j));
        const sysPoint = systemSeries[jIdx];

        const rt = point.rt_price;
        const da = point.da_price;
        const sysRt = sysPoint ? sysPoint.rt_price : null;
        const sysDa = sysPoint ? sysPoint.da_price : null;

        const spread = (rt != null && da != null) ? rt - da : null;
        const sysSpread = (sysRt != null && sysDa != null) ? sysRt - sysDa : null;

        const spreadFmt = d => d == null ? "N/A" : priceFmt(d);

        // Move circles
        focusRt
          .style("opacity", 1)
          .attr("cx", x(point.timestamp))
          .attr("cy", y(rt));

        focusDa
          .style("opacity", da != null ? 1 : 0)
          .attr("cx", x(point.timestamp))
          .attr("cy", da != null ? y(da) : -100);

        focusSysRt
          .style("opacity", 1)
          .attr("cx", x(point.timestamp))
          .attr("cy", y(sysRt));

        focusSysDa
          .style("opacity", sysDa != null ? 1 : 0)
          .attr("cx", x(point.timestamp))
          .attr("cy", sysDa != null ? y(sysDa) : -100);

        // Tooltip
        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>${locationSelect.value}</strong></div>
            <div>${timeFormat(point.timestamp)}</div>
            <hr/>
            <div>RT Price: ${priceFmt(rt)}</div>
            <div>DA Price: ${da != null ? priceFmt(da) : "N/A"}</div>
            <div>Spread (RT - DA): ${spreadFmt(spread)}</div>
            <hr/>
            <div>System RT: ${sysRt != null ? priceFmt(sysRt) : "N/A"}</div>
            <div>System DA: ${sysDa != null ? priceFmt(sysDa) : "N/A"}</div>
            <div>System Spread: ${spreadFmt(sysSpread)}</div>
          `);

        const [pageX, pageY] = d3.pointer(event, document.body);
        tooltip
          .style("left", `${pageX + 12}px`)
          .style("top", `${pageY - 28}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
        focusRt.style("opacity", 0);
        focusDa.style("opacity", 0);
        focusSysRt.style("opacity", 0);
        focusSysDa.style("opacity", 0);
      });
  });
}
