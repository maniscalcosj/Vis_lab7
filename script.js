/* load the 2 datasets */
Promise.all([ // load multiple files
	d3.json('airports.json'),
	d3.json('world-110m.json')
  ]).then(([airports, worldmap]) => {
    /* initialize visType as force so force chart first shows */
    let visType = 'force';
    
    /* Convert to GeoJSON */
    const worldmapGeo = topojson.feature(worldmap, worldmap.objects.countries);
    
    /* initialize SVG */
    const width = 1000;
    const height = 500;
    const svg = d3.select(".chart").append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0,0, width, height]);

    /* create scale for sizing circles based on number of passengers */
    const sizeScale = d3.scaleLinear()
      .domain(d3.extent(airports.nodes.map(d => d.passengers)))
      .range([4,12]);

    airports.nodes.map(d => d.r = sizeScale(d.passengers));
  
    /* create a projection */
    const projection = d3.geoMercator()
      .fitExtent([[0,0], [width,height]], worldmapGeo);


    /* create path generator */
    const pathGenerator = d3.geoPath().projection(projection);

    /* create map */
    const map = svg.selectAll("path")
      .data(worldmapGeo.features)
      .join(
        enter => enter.append("path")
          .attr("d", pathGenerator)
          .style("fill", "#454644")
          .attr("opacity", 0)
      );

    /* add country names to map */
    map.append("title")
      .text(d => d.properties.name);

    /* add white border lines */
    svg.append("path")
      .datum(topojson.mesh(worldmap, worldmap.objects.countries))
      .attr("d", pathGenerator)
      .attr('fill', 'none')
        .attr('stroke', 'white')
      .attr("class", "subunit-boundary");

    /* add forces */
    const forceCenter = d3.forceCenter(width / 2, height / 2);
    const forceLink = d3.forceLink(airports.links);
    const forceNode = d3.forceManyBody().strength(-25);
    

    /* create force simulation */
    const simulation = d3.forceSimulation(airports.nodes)
      .force("center", forceCenter)
      .force("link", forceLink)
      .force("charge", forceNode);

    /* create links */
    const links = svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(airports.links)
      .join(
        enter => enter.append("line")
          .style("stroke", "#00F095")
      );
    
    /* create nodes */
    const nodes = svg.append("g")
      .attr("class","nodes")
      .selectAll("circle")
      .data(airports.nodes)
      .join(
        enter => enter.append("circle")
          .attr("r", d => d.r)
          .style("fill", "orange")
      );
    
    /* add titles of airports to nodes */
    nodes.append("title")   
      .text(d => d.name);
    
    /* update simulation */
    function ticked() {
      links
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      nodes
        // prevent from leaving svg container
        .attr("cx", d => Math.max(d.r, Math.min(width - d.r, d.x)))
        .attr("cy", d => Math.max(d.r, Math.min(height - d.r, d.y)));
    }

    /* start simulation */
    simulation.on("tick", ticked);

    /* support dragging */
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    /* create drag handler */
    const dragger = d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);

    /* limit dragging to when map is not on */
    dragger.filter(event => visType === "force");
  
    nodes.call(dragger);

    function switchLayout() {
      if (visType === "map") {
        // stop the simulation
        simulation.stop();
        
        // set the positions of links and nodes based on geo-coordinates
        airports.links.map(d => {
          d.source.fx = projection([d.source.longitude, d.source.latitude])[0];
          d.source.fy = projection([d.source.longitude, d.source.latitude])[1];
          d.target.fx = projection([d.target.longitude, d.target.latitude])[0];
          d.target.fy = projection([d.target.longitude, d.target.latitude])[1];
        });  
          
        airports.nodes.map(d => {
          d.fx = projection([d.longitude, d.latitude])[0];
          d.fy = projection([d.longitude, d.latitude])[1];
        });
          
        // set the map opacity to 1 
          map.attr("opacity", 1);
        
        /* link transitions */
        links.transition().duration(500)
          .attr("x1", d => d.source.fx)
          .attr("y1", d => d.source.fy)
          .attr("x2", d => d.target.fx)
          .attr("y2", d => d.target.fy);
        
        /* node transitions */
        nodes.transition().duration(500)
          .attr("cx", d => d.fx)
          .attr("cy", d => d.fy);

    } else {
        // set map opacity to 0
        map.attr("opacity",0);
      
        // reset the positions of links and nodes
        airports.links.map(d => {
          d.source.fx = null;
          d.source.fy = null;
          d.target.fx = null;
          d.target.fy = null;
        });
      
        airports.nodes.map(d => {
          d.fx = null;
          d.fy = null;
        });

        /* link transitions */
        links.transition().duration(500)
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);
      
        /* node transitions */
        nodes.transition().duration(500)
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);

        /* finish transition then simulation */
        setTimeout(function() {simulation.alpha(0.2).restart()}, 500);
      }
    }

    /* add event listener for radio button selection */
    d3.selectAll("input[name=chartType]").on("change", event=>{
      visType = event.target.value; // selected button
      switchLayout();
    })
})