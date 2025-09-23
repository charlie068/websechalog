'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Livraison, Parcelle } from '@/lib/supabase'

interface D3ChartsProps {
  livraisons: Livraison[]
  parcelles: Parcelle[]
  t: (key: string) => string
}

export default function D3Charts({ livraisons, parcelles, t }: D3ChartsProps) {
  // Safe translation function with fallback
  const safeT = (key: string, fallback?: string): string => {
    try {
      const result = t(key)
      return result || fallback || key
    } catch (error) {
      return fallback || key
    }
  }

  const barChartRef = useRef<SVGSVGElement>(null)
  const lineChartRef = useRef<SVGSVGElement>(null)
  const rendementByParcelleRef = useRef<SVGSVGElement>(null)

  // Container refs for responsive sizing
  const barChartContainerRef = useRef<HTMLDivElement>(null)
  const lineChartContainerRef = useRef<HTMLDivElement>(null)
  const rendementChartContainerRef = useRef<HTMLDivElement>(null)

  // State for chart dimensions
  const [chartDimensions, setChartDimensions] = useState({
    barChart: { width: 500, height: 350 },
    lineChart: { width: 1000, height: 400 },
    rendementChart: { width: 500, height: 350 }
  })

  // Responsive resize effect
  useEffect(() => {
    const updateDimensions = () => {
      const barContainer = barChartContainerRef.current
      const lineContainer = lineChartContainerRef.current
      const rendementContainer = rendementChartContainerRef.current

      if (barContainer && lineContainer && rendementContainer) {
        const containerWidth = barContainer.offsetWidth - 48 // Account for padding
        const lineContainerWidth = lineContainer.offsetWidth - 48

        const barWidth = Math.max(280, Math.min(containerWidth, 500))
        const lineWidth = Math.max(320, Math.min(lineContainerWidth, 1000))
        const rendementWidth = Math.max(280, Math.min(containerWidth, 500))

        setChartDimensions({
          barChart: {
            width: barWidth,
            height: Math.max(220, Math.min(barWidth * 0.7, 350)) // Better aspect ratio
          },
          lineChart: {
            width: lineWidth,
            height: Math.max(250, Math.min(lineWidth * 0.5, 400)) // Less stretched
          },
          rendementChart: {
            width: rendementWidth,
            height: Math.max(220, Math.min(rendementWidth * 0.7, 350)) // Better aspect ratio
          }
        })
      }
    }

    // Initial measurement
    updateDimensions()

    // Listen for window resize
    window.addEventListener('resize', updateDimensions)

    // Cleanup
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  useEffect(() => {

    if (livraisons.length === 0) {
      return
    }

    // Prepare data - filter for entree operations only
    const bentreeLivraisons = livraisons.filter(d => d.type_operation === 'entree')
    
    if (bentreeLivraisons.length === 0) {
      return
    }
    
    const parcelleData = d3.rollup(
      bentreeLivraisons,
      v => ({
        poidsSec: d3.sum(v, d => d.poids_sec || 0),
        poidsBrut: d3.sum(v, d => d.poids_brut || 0),
        humidite: d3.mean(v, d => d.humidite ? d.humidite : 0) || 0,
        count: v.length
      }),
      d => d.parcelle === 'Autres' ? safeT('common.other', 'Other') : (d.parcelle || safeT('common.other', 'Other'))
    )

    // Create cumulative daily data
    const dailyData = d3.rollup(
      livraisons,
      v => {
        const entreesData = v.filter(d => d.type_operation === 'entree')
        const sortiesData = v.filter(d => d.type_operation === 'sortie')
        
        // Calculate weighted average humidity for the day (weighted by poids_brut)
        const livraisonsWithHumidite = v.filter(liv => liv.humidite !== null && liv.humidite !== undefined && liv.poids_brut)
        let totalWeightedHumidite = 0
        let totalWeightForHumidite = 0
        
        livraisonsWithHumidite.forEach(liv => {
          const weight = liv.poids_brut || 0
          totalWeightedHumidite += (liv.humidite || 0) * weight
          totalWeightForHumidite += weight
        })
        
        const dailyHumidite = totalWeightForHumidite > 0 ? totalWeightedHumidite / totalWeightForHumidite : null
        
        return {
          entrees: d3.sum(entreesData, d => d.poids_sec || 0),
          sorties: d3.sum(sortiesData, d => d.poids_sec || 0),
          humidite: dailyHumidite
        }
      },
      d => {
        const date = new Date(d.date_pesee)
        return d3.timeDay(date)
      }
    )

    // Convert to array and sort by date
    const dailyArray = Array.from(dailyData.entries())
      .sort((a, b) => a[0].getTime() - b[0].getTime())


    // Calculate cumulative values
    let cumulativeEntrees = 0
    let cumulativeSorties = 0
    
    const timelineData = dailyArray.map(([date, data]) => {
      cumulativeEntrees += data.entrees
      cumulativeSorties += data.sorties
      const netStock = cumulativeEntrees - cumulativeSorties
      
      return [date, {
        entrees: data.entrees, // Daily amount
        sorties: data.sorties, // Daily amount  
        cumulativeEntrees, // Running total
        cumulativeSorties, // Running total
        netStock, // Net cumulative
        humidite: data.humidite // Daily humidity average
      }]
    })


    createBarChart(Array.from(parcelleData.entries()))
    createLineChart(timelineData)
    createRendementByParcelleChart(bentreeLivraisons, parcelles)
  }, [livraisons, parcelles, chartDimensions])

  const createBarChart = (data: [string, any][]) => {
    const svg = d3.select(barChartRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 60, left: 80 }
    const width = chartDimensions.barChart.width - margin.left - margin.right
    const height = chartDimensions.barChart.height - margin.bottom - margin.top

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
          ${safeT('deliveries.table.dryWeight')}: ${(d[1].poidsSec / 1000).toFixed(1)}t<br/>
          ${safeT('deliveries.banners.totalDeliveries')}: ${d[1].count}<br/>
          ${safeT('deliveries.table.humidity')}: ${d[1].humidite.toFixed(1)}%
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
      .text(safeT('dashboard.charts.productionByParcel', 'Production by parcel'))
  }

  const createLineChart = (data: [Date, any][]) => {
    
    if (data.length === 0) {
      return
    }
    
    const svg = d3.select(lineChartRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 90, left: 80 }
    const width = chartDimensions.lineChart.width - margin.left - margin.right
    const height = chartDimensions.lineChart.height - margin.bottom - margin.top

    // Set SVG height back to normal
    svg.attr('height', chartDimensions.lineChart.height)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const sortedData = data.sort((a, b) => a[0].getTime() - b[0].getTime())

    const dateExtent = d3.extent(sortedData, d => d[0])
    
    let domain: [Date, Date]
    
    // Handle invalid or missing dates
    if (!dateExtent[0] || !dateExtent[1]) {
      const fallbackDate = new Date()
      domain = [
        new Date(fallbackDate.getTime() - 12 * 60 * 60 * 1000),
        new Date(fallbackDate.getTime() + 12 * 60 * 60 * 1000)
      ]
    } else {
      // Handle date domain - add padding for multiple days or expand for single day
      domain = dateExtent as [Date, Date]
      if (dateExtent[0].getTime() === dateExtent[1].getTime()) {
        // Single day: expand to 24-hour range
        const singleDate = dateExtent[0]
        domain = [
          new Date(singleDate.getTime() - 12 * 60 * 60 * 1000), // 12 hours before
          new Date(singleDate.getTime() + 12 * 60 * 60 * 1000)  // 12 hours after
        ]
      } else {
        // Multiple days: minimal padding to keep bars centered
        const oneDayMs = 24 * 60 * 60 * 1000
        domain = [
          new Date(dateExtent[0].getTime() - oneDayMs * 0.5), // Half day padding
          new Date(dateExtent[1].getTime() + oneDayMs * 0.5)  // Half day padding
        ]
      }
    }
    
    const x = d3.scaleTime()
      .range([0, width])
      .domain(domain)

    // Get max value for Y scale - only positive values for cumulative chart
    const maxValue = d3.max(sortedData, d => 
      Math.max(d[1].cumulativeEntrees, d[1].cumulativeSorties)
    ) || 0
    
    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, maxValue / 1000]) // Start from 0, not negative
    
    // Create second Y-axis for humidity (right side)
    const humidityValues = sortedData.map(d => d[1].humidite).filter(h => h !== null && h !== undefined)
    const maxHumidite = humidityValues.length > 0 ? d3.max(humidityValues) || 100 : 100
    const minHumidite = humidityValues.length > 0 ? d3.min(humidityValues) || 0 : 0
    
    const yHumidite = d3.scaleLinear()
      .range([height, 0])
      .domain([Math.max(0, minHumidite - 2), maxHumidite + 2]) // Add some padding

    // Create line generators
    const lineEntrees = d3.line<[Date, any]>()
      .x(d => x(d[0]))
      .y(d => y((d[1].cumulativeEntrees || 0) / 1000))
      .curve(d3.curveMonotoneX)
    
    const lineSorties = d3.line<[Date, any]>()
      .x(d => x(d[0]))
      .y(d => y((d[1].cumulativeSorties || 0) / 1000))
      .curve(d3.curveMonotoneX)
    
    const areaNetStock = d3.area<[Date, any]>()
      .x(d => x(d[0]))
      .y0(y(0))
      .y1(d => y((d[1].netStock || 0) / 1000))
      .curve(d3.curveMonotoneX)
    
    // Create line generator for humidity
    const lineHumidite = d3.line<[Date, any]>()
      .x(d => x(d[0]))
      .y(d => yHumidite(d[1].humidite || 0))
      .curve(d3.curveMonotoneX)
      .defined(d => d[1].humidite !== null && d[1].humidite !== undefined)
    
    // Draw area for net stock (light blue fill)
    g.append('path')
      .datum(sortedData)
      .attr('fill', '#3B82F6')
      .attr('fill-opacity', 0.2)
      .attr('d', areaNetStock)
    
    // Create line generator for net stock
    const lineNetStock = d3.line<[Date, any]>()
      .x(d => x(d[0]))
      .y(d => y((d[1].netStock || 0) / 1000))
      .curve(d3.curveMonotoneX)
    
    // Draw blue line on top of the area for net stock
    g.append('path')
      .datum(sortedData)
      .attr('fill', 'none')
      .attr('stroke', '#3B82F6')
      .attr('stroke-width', 2)
      .attr('d', lineNetStock)
    
    // Draw line for cumulative entries (green)
    g.append('path')
      .datum(sortedData)
      .attr('fill', 'none')
      .attr('stroke', '#22C55E')
      .attr('stroke-width', 2)
      .attr('d', lineEntrees)
    
    // Draw line for cumulative sorties (red) - always show, even if zero
    const hasSorties = sortedData.some(d => (d[1].cumulativeSorties || 0) > 0)
    
    // Always draw sorties line (will be at 0 if no sorties)
    g.append('path')
      .datum(sortedData)
      .attr('fill', 'none')
      .attr('stroke', '#EF4444')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', hasSorties ? 'none' : '5,5') // Dashed if no actual sorties
      .attr('d', lineSorties)
    
    // Draw humidity line (orange) - only if we have humidity data
    const hasHumidite = sortedData.some(d => d[1].humidite !== null && d[1].humidite !== undefined)
    if (hasHumidite) {
      g.append('path')
        .datum(sortedData)
        .attr('fill', 'none')
        .attr('stroke', '#F97316')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '3,3') // Dashed to distinguish from weight lines
        .attr('d', lineHumidite)
    }
    
    // Add dots for data points with tooltips
    sortedData.forEach((d, i) => {
      const xPos = x(d[0])
      const cumulativeEntrees = (d[1].cumulativeEntrees || 0) / 1000
      const cumulativeSorties = (d[1].cumulativeSorties || 0) / 1000
      const netStock = (d[1].netStock || 0) / 1000
      const dailyEntrees = (d[1].entrees || 0) / 1000
      const dailySorties = (d[1].sorties || 0) / 1000
      
      // Dot for entries line
      g.append('circle')
        .attr('cx', xPos)
        .attr('cy', y(cumulativeEntrees))
        .attr('r', 4)
        .attr('fill', '#22C55E')
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .on('mouseover', function(event) {
          d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .html(`<strong>${safeT('deliveries.banners.totalEntries')}</strong><br/>${safeT('common.date')}: ${d[0].toLocaleDateString('fr-FR')}<br/>Total: ${cumulativeEntrees.toFixed(1)}t<br/>${safeT('deliveries.charts.daily')}: ${dailyEntrees.toFixed(1)}t<br/>${safeT('deliveries.banners.netBalance')}: ${netStock.toFixed(1)}t`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .style('opacity', 0)
            .transition().duration(200).style('opacity', 1)
        })
        .on('mouseout', () => d3.selectAll('.tooltip').remove())
      
      // Dot for sorties line (always show)
      g.append('circle')
        .attr('cx', xPos)
        .attr('cy', y(cumulativeSorties))
        .attr('r', 4)
        .attr('fill', '#EF4444')
        .attr('fill-opacity', cumulativeSorties > 0 ? 1 : 0.3) // Faded if no sorties
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .on('mouseover', function(event) {
          d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .html(`<strong>Sorties Cumulées</strong><br/>Date: ${d[0].toLocaleDateString('fr-FR')}<br/>Total: ${cumulativeSorties.toFixed(1)}t<br/>Jour: ${dailySorties.toFixed(1)}t`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .style('opacity', 0)
            .transition().duration(200).style('opacity', 1)
        })
        .on('mouseout', () => d3.selectAll('.tooltip').remove())
      
      // Dot for net stock line (blue)
      g.append('circle')
        .attr('cx', xPos)
        .attr('cy', y(netStock))
        .attr('r', 4)
        .attr('fill', '#3B82F6')
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .on('mouseover', function(event) {
          d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .html(`<strong>Stock Net</strong><br/>Date: ${d[0].toLocaleDateString('fr-FR')}<br/>Balance: ${netStock.toFixed(1)}t`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .style('opacity', 0)
            .transition().duration(200).style('opacity', 1)
        })
        .on('mouseout', () => d3.selectAll('.tooltip').remove())
      
      // Dot for humidity line (orange) - only if we have humidity data for this day
      if (d[1].humidite !== null && d[1].humidite !== undefined) {
        g.append('circle')
          .attr('cx', xPos)
          .attr('cy', yHumidite(d[1].humidite))
          .attr('r', 4)
          .attr('fill', '#F97316')
          .attr('stroke', 'white')
          .attr('stroke-width', 2)
          .on('mouseover', function(event) {
            d3.select('body').append('div')
              .attr('class', 'tooltip')
              .style('position', 'absolute')
              .style('background', 'rgba(0,0,0,0.8)')
              .style('color', 'white')
              .style('padding', '8px')
              .style('border-radius', '4px')
              .style('font-size', '12px')
              .style('pointer-events', 'none')
              .html(`<strong>Humidité</strong><br/>Date: ${d[0].toLocaleDateString('fr-FR')}<br/>Humidité: ${d[1].humidite.toFixed(1)}%`)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px')
              .style('opacity', 0)
              .transition().duration(200).style('opacity', 1)
          })
          .on('mouseout', () => d3.selectAll('.tooltip').remove())
      }
    })

    // Add axes - create custom ticks for exact dates
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${height})`)
    
    // Create custom ticks for each day with data
    const tickData = sortedData.map(d => d[0])
    
    xAxis.selectAll('.tick')
      .data(tickData)
      .enter()
      .append('g')
      .attr('class', 'tick')
      .attr('transform', d => `translate(${x(d)}, 0)`)
      .each(function(d, i) {
        const tick = d3.select(this)
        
        // Add tick line
        tick.append('line')
          .attr('stroke', '#000')
          .attr('y2', 6)
        
        // Add text label with 45-degree rotation
        tick.append('text')
          .attr('fill', '#000')
          .attr('y', 9)
          .attr('dy', '0.71em')
          .style('text-anchor', 'end')
          .style('font-size', '12px')
          .attr('dx', '-.8em')
          .attr('transform', 'rotate(-45)')
          .text(d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }))
      })
    
    // Add domain line
    xAxis.append('path')
      .attr('stroke', '#000')
      .attr('d', `M0,0H${width}`)

    g.append('g')
      .call(d3.axisLeft(y).tickFormat(d => `${d}t`))
    
    // Add right Y-axis for humidity (only if we have humidity data)
    if (hasHumidite) {
      g.append('g')
        .attr('transform', `translate(${width}, 0)`)
        .call(d3.axisRight(yHumidite).tickFormat(d => `${d}%`))
        .selectAll('text')
        .style('fill', '#F97316')
    }

    // Add Y-axis title (left) - positioned closer to the axis
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left + 25) // Closer to the Y-axis
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(safeT('dashboard.charts.axisLabels.cumulativeQuantity', 'Cumulative quantity (tonnes)'))
    
    // Add Y-axis title (right) for humidity - positioned to avoid overlapping numbers
    if (hasHumidite) {
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', width + 45) // Further from Y-axis to avoid overlap with numbers
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#F97316')
        .text(safeT('deliveries.table.humidity') + ' (%)')
    }

    // Add legend at the bottom (responsive layout)
    const legend = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top + height + 45})`)

    // Determine layout based on available width
    const totalItems = hasHumidite ? 4 : 3
    const itemWidth = 160 // Minimum width needed per item
    const useVerticalLayout = width < (totalItems * itemWidth)

    if (useVerticalLayout) {
      // Two-column layout for narrow screens
      const lineHeight = 18
      const columnWidth = width / 2
      const items = [
        {
          type: 'line',
          stroke: '#22C55E',
          text: safeT('dashboard.charts.axisLabels.cumulativeEntries', 'Cumulative Entries')
        },
        {
          type: 'line',
          stroke: '#EF4444',
          text: safeT('dashboard.charts.axisLabels.cumulativeExits', 'Cumulative Exits')
        },
        {
          type: 'rect',
          fill: '#3B82F6',
          text: safeT('dashboard.charts.axisLabels.netStock', 'Net Stock')
        }
      ]

      if (hasHumidite) {
        items.push({
          type: 'line',
          stroke: '#F97316',
          text: safeT('deliveries.table.humidity') + ' (%)',
          dashed: true
        })
      }

      items.forEach((item, index) => {
        const col = index % 2
        const row = Math.floor(index / 2)
        const x = col * columnWidth
        const y = row * lineHeight

        if (item.type === 'line') {
          legend.append('line')
            .attr('x1', x)
            .attr('x2', x + 20)
            .attr('y1', y)
            .attr('y2', y)
            .attr('stroke', item.stroke)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', item.dashed ? '3,3' : 'none')

          legend.append('text')
            .attr('x', x + 25)
            .attr('y', y)
            .attr('dy', '0.35em')
            .style('font-size', '12px')
            .text(item.text)
        } else if (item.type === 'rect') {
          legend.append('rect')
            .attr('x', x)
            .attr('y', y - 5)
            .attr('width', 20)
            .attr('height', 10)
            .attr('fill', item.fill)
            .attr('fill-opacity', 0.2)
            .attr('stroke', 'none')

          legend.append('text')
            .attr('x', x + 25)
            .attr('y', y)
            .attr('dy', '0.35em')
            .style('font-size', '12px')
            .text(item.text)
        }
      })
    } else {
      // Horizontal layout for wider screens
      let legendX = 0
      const itemSpacing = width / totalItems

      // Cumulative Entries
      legend.append('line')
        .attr('x1', legendX)
        .attr('x2', legendX + 20)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', '#22C55E')
        .attr('stroke-width', 2)

      legend.append('text')
        .attr('x', legendX + 25)
        .attr('y', 0)
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .text(safeT('dashboard.charts.axisLabels.cumulativeEntries', 'Cumulative Entries'))

      legendX += itemSpacing

      // Cumulative Exits
      legend.append('line')
        .attr('x1', legendX)
        .attr('x2', legendX + 20)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', '#EF4444')
        .attr('stroke-width', 2)

      legend.append('text')
        .attr('x', legendX + 25)
        .attr('y', 0)
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .text(safeT('dashboard.charts.axisLabels.cumulativeExits', 'Cumulative Exits'))

      legendX += itemSpacing

      // Net Stock
      legend.append('rect')
        .attr('x', legendX)
        .attr('y', -5)
        .attr('width', 20)
        .attr('height', 10)
        .attr('fill', '#3B82F6')
        .attr('fill-opacity', 0.2)
        .attr('stroke', 'none')

      legend.append('text')
        .attr('x', legendX + 25)
        .attr('y', 0)
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .text(safeT('dashboard.charts.axisLabels.netStock', 'Net Stock'))

      // Add humidity line to legend (only if we have humidity data)
      if (hasHumidite) {
        legendX += itemSpacing

        legend.append('line')
          .attr('x1', legendX)
          .attr('x2', legendX + 20)
          .attr('y1', 0)
          .attr('y2', 0)
          .attr('stroke', '#F97316')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '3,3')

        legend.append('text')
          .attr('x', legendX + 25)
          .attr('y', 0)
          .attr('dy', '0.35em')
          .style('font-size', '12px')
          .text(safeT('deliveries.table.humidity') + ' (%)')
      }
    }

    // Add title
    g.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text(safeT('dashboard.charts.axisLabels.cumulativeEvolution', 'Cumulative Evolution (Tonnes)'))
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
      .domain(d3.extent(data, d => d.humidite ? d.humidite : 0) as [number, number])

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain(d3.extent(data, d => (d.poids_sec || 0) / 1000) as [number, number])

    const color = d3.scaleOrdinal(d3.schemeCategory10)
      .domain([...new Set(data.map(d => d.nom_parcelle === 'Autres' ? safeT('common.other', 'Other') : (d.nom_parcelle || safeT('common.other', 'Other'))))])

    // Dots
    g.selectAll('.dot')
      .data(data)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('r', 5)
      .attr('cx', d => x(d.humidite ? d.humidite : 0))
      .attr('cy', d => y((d.poids_sec || 0) / 1000))
      .attr('fill', d => color(d.nom_parcelle === 'Autres' ? safeT('common.other', 'Other') : (d.nom_parcelle || safeT('common.other', 'Other'))))
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
          <strong>${d.nom_parcelle === 'Autres' ? safeT('common.other', 'Other') : (d.nom_parcelle || safeT('common.other', 'Other'))}</strong><br/>
          BL: ${d.numero_bl || 'N/A'}<br/>
          Date: ${new Date(d.date_pesee).toLocaleDateString('fr-FR')} ${new Date(d.date_pesee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}<br/>
          Poids: ${((d.poids_sec || 0) / 1000).toFixed(1)}t<br/>
          Humidité: ${d.humidite ? d.humidite.toFixed(1) : 0}%
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
      d => d.nom_parcelle === 'Autres' ? safeT('common.other', 'Other') : (d.nom_parcelle || safeT('common.other', 'Other')),
      d => d3.timeFormat('%Y-%m')(new Date(d.date_pesee))
    )

    const parcelles = Array.from(heatmapData.keys())
    const months = Array.from(new Set(data.map(d => d3.timeFormat('%Y-%m')(new Date(d.date_pesee))))).sort()

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
      .call(d3.axisBottom(x).tickFormat(d => d3.timeFormat('%b %y')(new Date(d as string + '-01'))))
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

  const createQuantityByParcelleChart = (data: [string, any][]) => {
    const svg = d3.select(quantityByParcelleRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 60, left: 80 }
    const width = 500 - margin.left - margin.right
    const height = 300 - margin.bottom - margin.top

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d[0]))
      .padding(0.1)

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, d3.max(data, d => d[1].poidsSec) || 0])

    // Add bars
    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d[0]) || 0)
      .attr('width', x.bandwidth())
      .attr('y', d => y(d[1].poidsSec))
      .attr('height', d => height - y(d[1].poidsSec))
      .attr('fill', '#10b981')

    // Add x axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')

    // Add y axis
    g.append('g')
      .call(d3.axisLeft(y))

    // Add y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text('Poids sec (kg)')

    // Add title
    svg.append('text')
      .attr('x', width / 2 + margin.left)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Quantité par parcelle')
  }

  const createRendementByParcelleChart = (livraisonData: Livraison[], parcelleData: Parcelle[]) => {
    const svg = d3.select(rendementByParcelleRef.current)
    svg.selectAll("*").remove()

    // Check if parcelleData exists
    if (!parcelleData || parcelleData.length === 0) {
      return
    }

    // Create parcelle lookup map
    const parcelleMap = new Map(parcelleData.map(p => [p.nom_parcelle, p.surface_hectares]))

    // Calculate rendement for each parcelle
    const parcelleRendement = d3.rollup(
      livraisonData,
      v => {
        const totalPoidsSec = d3.sum(v, d => d.poids_sec || 0)
        const parcelleName = v[0]?.parcelle === 'Autres' ? safeT('common.other', 'Other') : (v[0]?.parcelle || safeT('common.other', 'Other'))
        const surface = parcelleMap.get(parcelleName) || 0
        return surface > 0 ? (totalPoidsSec / 1000) / surface : 0 // t/ha
      },
      d => d.parcelle === 'Autres' ? safeT('common.other', 'Other') : (d.parcelle || safeT('common.other', 'Other'))
    )

    // Filter out parcelles with 0 rendement (no surface area)
    const data = Array.from(parcelleRendement.entries()).filter(d => d[1] > 0)

    if (data.length === 0) {
      // Show "No data" message
      svg.append('text')
        .attr('x', 250)
        .attr('y', 150)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('fill', '#666')
        .text(safeT('dashboard.charts.noYieldData', 'No yield data available'))
      return
    }

    const margin = { top: 20, right: 30, bottom: 60, left: 80 }
    const width = chartDimensions.rendementChart.width - margin.left - margin.right
    const height = chartDimensions.rendementChart.height - margin.bottom - margin.top

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d[0]))
      .padding(0.1)

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, d3.max(data, d => d[1]) || 0])

    // Add bars
    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d[0]) || 0)
      .attr('width', x.bandwidth())
      .attr('y', d => y(d[1]))
      .attr('height', d => height - y(d[1]))
      .attr('fill', '#f59e0b')

    // Add x axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')

    // Add y axis
    g.append('g')
      .call(d3.axisLeft(y))

    // Add y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text(safeT('dashboard.charts.axisLabels.yieldPerHectare'))

    // Add title
    svg.append('text')
      .attr('x', width / 2 + margin.left)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text(safeT('dashboard.charts.yieldByParcel'))
  }

  return (
    <div className="space-y-6">
      {/* Top row - Production and Rendement side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production par parcelle */}
        <div ref={barChartContainerRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">📊</span>
            {safeT('dashboard.charts.productionByParcel', 'Production by parcel')}
          </h3>
          <div className="overflow-x-auto">
            <svg
              ref={barChartRef}
              width={chartDimensions.barChart.width}
              height={chartDimensions.barChart.height}
              className="min-w-0"
            ></svg>
          </div>
        </div>

        {/* Rendement par parcelle */}
        <div ref={rendementChartContainerRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">🌾</span>
            {safeT('dashboard.charts.yieldByParcel', 'Yield by parcel')}
          </h3>
          <div className="overflow-x-auto">
            <svg
              ref={rendementByParcelleRef}
              width={chartDimensions.rendementChart.width}
              height={chartDimensions.rendementChart.height}
              className="min-w-0"
            ></svg>
          </div>
        </div>
      </div>

      {/* Bottom row - Évolution temporelle full width */}
      <div ref={lineChartContainerRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">📈</span>
          {safeT('dashboard.charts.temporalEvolution', 'Temporal evolution')}
        </h3>
        <div className="overflow-x-auto">
          <svg
            ref={lineChartRef}
            width={chartDimensions.lineChart.width}
            height={chartDimensions.lineChart.height}
            className="min-w-0"
          ></svg>
        </div>
      </div>
    </div>
  )
}