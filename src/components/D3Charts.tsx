'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { Livraison } from '@/lib/supabase'

interface D3ChartsProps {
  livraisons: Livraison[]
}

export default function D3Charts({ livraisons }: D3ChartsProps) {
  const barChartRef = useRef<SVGSVGElement>(null)
  const lineChartRef = useRef<SVGSVGElement>(null)
  const scatterChartRef = useRef<SVGSVGElement>(null)
  const heatmapRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (livraisons.length === 0) return

    // Prepare data
    const parcelleData = d3.rollup(
      livraisons,
      v => ({
        poidsSec: d3.sum(v, d => d.poids_sec || 0),
        poidsBrut: d3.sum(v, d => d.poids_brut || 0),
        humidite: d3.mean(v, d => d.humidite ? d.humidite / 10 : 0) || 0,
        count: v.length
      }),
      d => d.nom_parcelle || 'Autres'
    )

    const timelineData = d3.rollup(
      livraisons,
      v => ({
        entrees: d3.sum(v.filter(d => d.type_operation === 'entree'), d => d.poids_sec || 0),
        sorties: d3.sum(v.filter(d => d.type_operation === 'sortie'), d => d.poids_sec || 0),
      }),
      d => d3.timeMonth(new Date(d.date_livraison))
    )

    createBarChart(Array.from(parcelleData.entries()))
    createLineChart(Array.from(timelineData.entries()))
    createScatterPlot(livraisons)
    createHeatmap(livraisons)
  }, [livraisons])

  const createBarChart = (data: [string, any][]) => {
    const svg = d3.select(barChartRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 60, left: 80 }
    const width = 500 - margin.left - margin.right
    const height = 300 - margin.bottom - margin.top

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d[0]))
      .padding(0.2)

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, d3.max(data, d => d[1].poidsSec / 1000) || 0])

    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d[0]) || 0)
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', '#3B82F6')
      .attr('rx', 4)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('fill', '#1D4ED8')
        
        // Tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0)

        tooltip.html(`
          <strong>${d[0]}</strong><br/>
          Poids sec: ${(d[1].poidsSec / 1000).toFixed(1)}t<br/>
          Livraisons: ${d[1].count}<br/>
          Humidité moy: ${d[1].humidite.toFixed(1)}%
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1)
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill', '#3B82F6')
        d3.selectAll('.tooltip').remove()
      })
      .transition()
      .duration(800)
      .attr('y', d => y(d[1].poidsSec / 1000))
      .attr('height', d => height - y(d[1].poidsSec / 1000))

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')
      .style('font-size', '11px')

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(y).tickFormat(d => `${d}t`))
      .style('font-size', '11px')

    // Title
    svg.append('text')
      .attr('x', width / 2 + margin.left)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Production par parcelle (tonnes)')
  }

  const createLineChart = (data: [Date, any][]) => {
    const svg = d3.select(lineChartRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 40, left: 80 }
    const width = 500 - margin.left - margin.right
    const height = 300 - margin.bottom - margin.top

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const sortedData = data.sort((a, b) => a[0].getTime() - b[0].getTime())

    const x = d3.scaleTime()
      .range([0, width])
      .domain(d3.extent(sortedData, d => d[0]) as [Date, Date])

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, d3.max(sortedData, d => Math.max(d[1].entrees, d[1].sorties) / 1000) || 0])

    // Lines
    const entreeeLine = d3.line<[Date, any]>()
      .x(d => x(d[0]))
      .y(d => y(d[1].entrees / 1000))
      .curve(d3.curveMonotoneX)

    const sortieLine = d3.line<[Date, any]>()
      .x(d => x(d[0]))
      .y(d => y(d[1].sorties / 1000))
      .curve(d3.curveMonotoneX)

    // Areas
    const entreeArea = d3.area<[Date, any]>()
      .x(d => x(d[0]))
      .y0(height)
      .y1(d => y(d[1].entrees / 1000))
      .curve(d3.curveMonotoneX)

    // Draw areas
    g.append('path')
      .datum(sortedData)
      .attr('fill', 'rgba(34, 197, 94, 0.2)')
      .attr('d', entreeArea)

    // Draw lines
    g.append('path')
      .datum(sortedData)
      .attr('fill', 'none')
      .attr('stroke', '#22C55E')
      .attr('stroke-width', 3)
      .attr('d', entreeeLine)

    g.append('path')
      .datum(sortedData)
      .attr('fill', 'none')
      .attr('stroke', '#EF4444')
      .attr('stroke-width', 3)
      .attr('d', sortieLine)

    // Points
    g.selectAll('.dot-entree')
      .data(sortedData)
      .enter().append('circle')
      .attr('class', 'dot-entree')
      .attr('cx', d => x(d[0]))
      .attr('cy', d => y(d[1].entrees / 1000))
      .attr('r', 4)
      .attr('fill', '#22C55E')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', 6)
        
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0)

        tooltip.html(`
          <strong>Entrées ${d3.timeFormat('%b %Y')(d[0])}</strong><br/>
          ${(d[1].entrees / 1000).toFixed(1)} tonnes
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1)
      })
      .on('mouseout', function() {
        d3.select(this).attr('r', 4)
        d3.selectAll('.tooltip').remove()
      })

    g.selectAll('.dot-sortie')
      .data(sortedData)
      .enter().append('circle')
      .attr('class', 'dot-sortie')
      .attr('cx', d => x(d[0]))
      .attr('cy', d => y(d[1].sorties / 1000))
      .attr('r', 4)
      .attr('fill', '#EF4444')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', 6)
        
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0)

        tooltip.html(`
          <strong>Sorties ${d3.timeFormat('%b %Y')(d[0])}</strong><br/>
          ${(d[1].sorties / 1000).toFixed(1)} tonnes
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1)
      })
      .on('mouseout', function() {
        d3.select(this).attr('r', 4)
        d3.selectAll('.tooltip').remove()
      })

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.timeFormat('%b %Y')))
      .style('font-size', '11px')

    g.append('g')
      .call(d3.axisLeft(y).tickFormat(d => `${d}t`))
      .style('font-size', '11px')

    // Legend
    const legend = g.append('g')
      .attr('transform', `translate(${width - 120}, 20)`)

    legend.append('circle').attr('cx', 0).attr('cy', 0).attr('r', 4).attr('fill', '#22C55E')
    legend.append('text').attr('x', 10).attr('y', 0).attr('dy', '0.35em').style('font-size', '12px').text('Entrées')
    legend.append('circle').attr('cx', 0).attr('cy', 20).attr('r', 4).attr('fill', '#EF4444')
    legend.append('text').attr('x', 10).attr('y', 20).attr('dy', '0.35em').style('font-size', '12px').text('Sorties')
  }

  const createScatterPlot = (data: Livraison[]) => {
    const svg = d3.select(scatterChartRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 50, left: 80 }
    const width = 500 - margin.left - margin.right
    const height = 300 - margin.bottom - margin.top

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleLinear()
      .range([0, width])
      .domain(d3.extent(data, d => d.humidite ? d.humidite / 10 : 0) as [number, number])

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain(d3.extent(data, d => (d.poids_sec || 0) / 1000) as [number, number])

    const color = d3.scaleOrdinal(d3.schemeCategory10)
      .domain([...new Set(data.map(d => d.nom_parcelle || 'Autres'))])

    // Dots
    g.selectAll('.dot')
      .data(data)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('r', 5)
      .attr('cx', d => x(d.humidite ? d.humidite / 10 : 0))
      .attr('cy', d => y((d.poids_sec || 0) / 1000))
      .attr('fill', d => color(d.nom_parcelle || 'Autres'))
      .attr('opacity', 0.7)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('r', 8)
          .attr('opacity', 1)
        
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0)

        tooltip.html(`
          <strong>${d.nom_parcelle || 'Autres'}</strong><br/>
          BL: ${d.numero_bl || 'N/A'}<br/>
          Date: ${new Date(d.date_livraison).toLocaleDateString('fr-FR')}<br/>
          Poids: ${((d.poids_sec || 0) / 1000).toFixed(1)}t<br/>
          Humidité: ${d.humidite ? (d.humidite / 10).toFixed(1) : 0}%
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1)
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('r', 5)
          .attr('opacity', 0.7)
        d3.selectAll('.tooltip').remove()
      })

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => `${d}%`))
      .style('font-size', '11px')

    g.append('g')
      .call(d3.axisLeft(y).tickFormat(d => `${d}t`))
      .style('font-size', '11px')

    // Labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Poids sec (tonnes)')

    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 10})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Humidité (%)')
  }

  const createHeatmap = (data: Livraison[]) => {
    const svg = d3.select(heatmapRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 40, right: 30, bottom: 40, left: 100 }
    const width = 500 - margin.left - margin.right
    const height = 300 - margin.bottom - margin.top

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Group by parcelle and month
    const heatmapData = d3.rollup(
      data,
      v => v.length,
      d => d.nom_parcelle || 'Autres',
      d => d3.timeFormat('%Y-%m')(new Date(d.date_livraison))
    )

    const parcelles = Array.from(heatmapData.keys())
    const months = Array.from(new Set(data.map(d => d3.timeFormat('%Y-%m')(new Date(d.date_livraison))))).sort()

    const flatData = []
    for (const parcelle of parcelles) {
      for (const month of months) {
        flatData.push({
          parcelle,
          month,
          value: heatmapData.get(parcelle)?.get(month) || 0
        })
      }
    }

    const x = d3.scaleBand()
      .range([0, width])
      .domain(months)
      .padding(0.05)

    const y = d3.scaleBand()
      .range([height, 0])
      .domain(parcelles)
      .padding(0.05)

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(flatData, d => d.value) || 0])

    // Rectangles
    g.selectAll('.heatmap-rect')
      .data(flatData)
      .enter().append('rect')
      .attr('class', 'heatmap-rect')
      .attr('x', d => x(d.month) || 0)
      .attr('y', d => y(d.parcelle) || 0)
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => colorScale(d.value))
      .attr('rx', 2)
      .on('mouseover', function(event, d) {
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0)

        tooltip.html(`
          <strong>${d.parcelle}</strong><br/>
          ${d.month}<br/>
          ${d.value} livraisons
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1)
      })
      .on('mouseout', function() {
        d3.selectAll('.tooltip').remove()
      })

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => d3.timeFormat('%b %y')(new Date(d + '-01'))))
      .style('font-size', '10px')

    g.append('g')
      .call(d3.axisLeft(y))
      .style('font-size', '11px')

    // Title
    svg.append('text')
      .attr('x', width / 2 + margin.left)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Activité par parcelle et mois')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Bar Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">📊</span>
          Production par parcelle
        </h3>
        <svg ref={barChartRef} width={500} height={300}></svg>
      </div>

      {/* Line Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">📈</span>
          Évolution temporelle
        </h3>
        <svg ref={lineChartRef} width={500} height={300}></svg>
      </div>

      {/* Scatter Plot */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🔍</span>
          Relation Humidité/Poids
        </h3>
        <svg ref={scatterChartRef} width={500} height={300}></svg>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🗓️</span>
          Carte de chaleur mensuelle
        </h3>
        <svg ref={heatmapRef} width={500} height={300}></svg>
      </div>
    </div>
  )
}