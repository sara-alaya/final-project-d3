function initLmpHeatmap() {
  const svg = d3.select("#lmp-heatmap");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 20, right: 130, bottom: 70, left: 100 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = d3.select("#tooltip");
  const timeFormat = d3.timeFormat("%Y-%m-%d %H:%M");
  const priceFmt = d3.format("$.2f");
  const diffFmt = d3.format("+$.2f");

  d3.csv("data/ercot_lmp_hourly.csv").then(data => {
    // parse
    data.forEach(d => {
      d.timestamp = new Date(d.timestamp);
      d.price = +d.price;
    });

    // unique sorted times and locations
    const times = Array.from(
      d3.group(data, d => d.timestamp).keys()
    ).sort(d3.ascending);

    const locations = [
      "HB_NORTH",
      "HB_HOUSTON",
      "HB_SOUTH",
      "HB_WEST",
      "LZ_NORTH",
      "LZ_HOUSTON",
      "LZ_SOUTH",
      "LZ_WEST"
    ];

    // system average price by timestamp (for deviation)
    const groupedByTime = d3.group(data, d => d.timestamp.getTime());
    const systemAvgByTime = new Map(
      Array.from(groupedByTime, ([t, vals]) => [
        +t,
        d3.mean(vals, v => v.price)
      ])
    );

    // scales
    const x = d3.scaleBand()
      .domain(times)
      .range([0, innerWidth])
      .padding(0.01);

    const y = d3.scaleBand()
      .domain(locations)
      .range([0, innerHeight])
      .padding(0.05);

    const priceExtent = d3.extent(data, d => d.price);
    const maxAbs = Math.max(Math.abs(priceExtent[0]), Math.abs(priceExtent[1]));

    const color = d3.scaleSequential()
      .domain([-maxAbs, maxAbs])
      .interpolator(d3.interpolateRdBu); // blue low, red high

    // axes
    const xAxis = d3.axisBottom(x)
      .tickValues(times.filter((d, i) => i % 6 === 0))
      .tickFormat(d3.timeFormat("%m-%d %H:%M"));

    const yAxis = d3.axisLeft(y);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    g.append("g")
      .call(yAxis);

    // draw cells
    const cells = g.selectAll("rect.heat-cell")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "heat-cell")
      .attr("x", d => x(d.timestamp))
      .attr("y", d => y(d.location))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", d => color(d.price));

    // color legend (vertical bar)
    const legendHeight = 200;
    const legendWidth = 12;

    const legendScale = d3.scaleLinear()
      .domain(color.domain())
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickFormat(d3.format("$.0f"));

    const legend = g.append("g")
      .attr("transform", `translate(${innerWidth + 20},${(innerHeight - legendHeight) / 2})`);

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "lmp-gradient")
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");

    const legendStops = d3.range(0, 1.01, 0.1);
    legendStops.forEach((t, i) => {
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", color(legendScale.invert(legendHeight * (1 - t))));
    });

    legend.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#lmp-gradient)");

    legend.append("g")
      .attr("transform", `translate(${legendWidth},0)`)
      .call(legendAxis);

    legend.append("text")
      .attr("x", -10)
      .attr("y", -8)
      .attr("text-anchor", "start")
      .text("Price ($/MWh)");

    // --- interactions on cells: tooltip + click to drive hub chart ---
    cells
      .on("mousemove", (event, d) => {
        const sysAvg = systemAvgByTime.get(+d.timestamp);
        const dev = sysAvg != null ? d.price - sysAvg : null;

        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>${d.location}</strong></div>
            <div>${timeFormat(d.timestamp)}</div>
            <hr/>
            <div>Price: ${priceFmt(d.price)}</div>
            ${sysAvg != null
              ? `<div>System Avg: ${priceFmt(sysAvg)}</div>
                 <div>Deviation: ${diffFmt(dev)}</div>`
              : ""}
          `);

        const [pageX, pageY] = d3.pointer(event, document.body);
        tooltip
          .style("left", `${pageX + 12}px`)
          .style("top", `${pageY - 28}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      })
      .on("click", (event, d) => {
        // click still drives the hub price chart
        if (window.setSelectedHubLocation) {
          window.setSelectedHubLocation(d.location);
        }
      });
  });
}

