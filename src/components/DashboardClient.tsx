'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Client, Parcelle, Livraison } from '@/lib/supabase'
import ParcelleAnalysisCard from './ParcelleAnalysisCard'
import RecentLivraisonsTable from './RecentLivraisonsTable'
import D3Charts from './D3Charts'
import Link from 'next/link'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import Cookies from 'js-cookie'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import SharedHeader from './SharedHeader'
import { useTranslations } from '@/hooks/useTranslations'

interface DashboardClientProps {
  client: Client
  initialParcelles: Parcelle[]
  initialLivraisons: Livraison[]
}

export default function DashboardClient({ client, initialParcelles, initialLivraisons }: DashboardClientProps) {
  const { t, loading: translationsLoading, language } = useTranslations()

  // Safe translation function
  const safeT = (key: string, fallback?: string): string => {
    try {
      const result = t(key, fallback)
      return result
    } catch (error) {
      return fallback || key
    }
  }
  const [dateDebut, setDateDebut] = useState<Date | null>(null)
  const [dateFin, setDateFin] = useState<Date | null>(null)
  const [filteredLivraisons, setFilteredLivraisons] = useState<Livraison[]>(initialLivraisons)
  const [totalStats, setTotalStats] = useState({
    totalPoidsSec: 0,
    totalEntrees: 0,
    totalSorties: 0,
    balance: 0,
    moyenneHumidite: 0,
    rendementGlobal: null as number | null, // tonnes per hectare
    surfaceTotale: 0 // total hectares
  })

  // Set default dates (August 1st to today) with cookie support
  useEffect(() => {
    // Try to load saved dates and filters from cookies
    let savedDateDebut = Cookies.get('dashboard_date_debut')
    const savedDateFin = Cookies.get('dashboard_date_fin') // session cookie
    
    // Clear any bad July cookies immediately
    if (savedDateDebut && savedDateDebut.includes('-07-')) {
      Cookies.remove('dashboard_date_debut')
      savedDateDebut = null // Force recalculation
    }
    
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() // 0-indexed (0 = January, 7 = August)
    
    // If we're before August 1st, use August 1st of previous year
    // If we're on or after August 1st, use August 1st of current year
    const augustYear = currentMonth < 7 ? currentYear - 1 : currentYear
    const august1st = new Date(augustYear, 7, 1) // Month 7 = August (0-indexed)
    
    // Set date debut (use saved or default to August 1st)
    if (savedDateDebut) {
      const savedDate = new Date(savedDateDebut)
      // Validate the saved date - if it's invalid or any July date, recalculate to August 1st
      if (isNaN(savedDate.getTime()) || savedDateDebut.includes('-07-')) {
        setDateDebut(august1st)
        Cookies.set('dashboard_date_debut', august1st.toISOString().split('T')[0], { expires: 365 })
      } else {
        setDateDebut(savedDate)
      }
    } else {
      setDateDebut(august1st)
      Cookies.set('dashboard_date_debut', august1st.toISOString().split('T')[0], { expires: 365 })
    }
    
    // Set date fin (use saved session cookie or default to today)
    if (savedDateFin) {
      setDateFin(new Date(savedDateFin))
    } else {
      setDateFin(today)
      // Save date fin as session cookie (expires when browser session ends)
      Cookies.set('dashboard_date_fin', today.toISOString().split('T')[0])
    }
    
  }, [])

  // Filter livraisons by date when filters change
  useEffect(() => {
    if (dateDebut && dateFin) {
      fetchFilteredData()
    }
  }, [dateDebut, dateFin])

  const fetchFilteredData = async () => {
    try {
      // Add time to make end date inclusive of the full day
      const dateFinInclusive = dateFin?.toISOString().split('T')[0] + 'T23:59:59.999Z'
      const dateDebutInclusive = dateDebut?.toISOString().split('T')[0] + 'T00:00:00.000Z'
      
      let query = supabase
        .from('livraisons')
        .select('*')
        .eq('client_local_id', client.local_id)
        .gte('date_pesee', dateDebutInclusive)
        .lte('date_pesee', dateFinInclusive)
      
      
      const { data: livraisons } = await query.order('date_pesee', { ascending: false })

      if (livraisons) {
        setFilteredLivraisons(livraisons as Livraison[])
        
        // Calculate total stats - only for entree operations
        
        if (livraisons.length > 0) {
          livraisons.slice(0, 3).forEach((liv, i) => {
          })
        }
        
        const entreeLivraisons = livraisons.filter(liv => liv.type_operation === 'entree')
        
        const totalPoidsSec = entreeLivraisons.reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
        
        // Calculate entrées, sorties, and balance for all operations (not just entree)
        const totalEntrees = livraisons
          .filter(liv => liv.type_operation === 'entree')
          .reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
        
        const totalSorties = livraisons
          .filter(liv => liv.type_operation === 'sortie')
          .reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
        
        const balance = totalEntrees - totalSorties
        
        
        
        // Calculate weighted average humidity for entree operations (weighted by gross weight)
        const livraisonsWithHumidite = entreeLivraisons.filter(liv => 
          liv.humidite !== null && liv.humidite !== undefined && liv.poids_brut
        )
        
        let totalWeightedHumidite = 0
        let totalWeightForHumidite = 0
        
        livraisonsWithHumidite.forEach(liv => {
          const weight = liv.poids_brut || 0
          totalWeightedHumidite += liv.humidite * weight
          totalWeightForHumidite += weight
        })
        
        const moyenneHumidite = totalWeightForHumidite > 0 
          ? totalWeightedHumidite / totalWeightForHumidite 
          : 0

        // Calculate rendement (yield per hectare) - only for parcelles with area data
        const parcellesWithArea = initialParcelles.filter(p => p.surface_hectares && p.surface_hectares > 0)
        const surfaceTotale = parcellesWithArea.reduce((sum, p) => sum + p.surface_hectares, 0)
        
        // Filter livraisons to only include entree operations from parcelles with area data
        const parcelleNamesWithArea = new Set(parcellesWithArea.map(p => p.nom_parcelle))
        const livraisonsFromParcellesWithArea = entreeLivraisons.filter(liv => 
          liv.parcelle && parcelleNamesWithArea.has(liv.parcelle)
        )
        const totalPoidsSecFromAreaParcelles = livraisonsFromParcellesWithArea.reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
        
        const totalPoidsSecTonnes = totalPoidsSecFromAreaParcelles / 1000 // Convert to tonnes
        const rendementGlobal = (surfaceTotale > 0 && totalPoidsSecFromAreaParcelles > 0) ? totalPoidsSecTonnes / surfaceTotale : null


        setTotalStats({
          totalPoidsSec,
          totalEntrees,
          totalSorties,
          balance,
          moyenneHumidite,
          rendementGlobal,
          surfaceTotale
        })
      }
    } catch (error) {
    }
  }

  // PDF Export function with full dashboard capture
  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.width
      const pageHeight = pdf.internal.pageSize.height
      const margin = 15
      let yPosition = 20

      // Add title page header
      pdf.setFontSize(24)
      pdf.setTextColor(34, 197, 94) // Green
      pdf.text('SechaLog Portal', pageWidth / 2, 30, { align: 'center' })
      pdf.setFontSize(18)
      pdf.setTextColor(0, 0, 0)
      pdf.text(safeT('dashboard.pdf.title', 'Agricultural Dashboard Report'), pageWidth / 2, 45, { align: 'center' })
      
      pdf.setFontSize(14)
      pdf.text(`Client: ${client.nom_client}`, pageWidth / 2, 60, { align: 'center' })
      pdf.setFontSize(12)
      pdf.text(`Période: ${dateDebut || 'N/A'} - ${dateFin || 'N/A'}`, pageWidth / 2, 70, { align: 'center' })
      
      yPosition = 90

      // Wait a moment for any pending renders
      await new Promise(resolve => setTimeout(resolve, 500))

      // Capture and add statistics banners on first page
      let currentPage = 1

      // Add Bilan entrées/sorties as text (skip html2canvas due to compatibility issues)
      
      // Create a nice bordered section for the orange banner equivalent
      pdf.setDrawColor(249, 115, 22) // Orange color
      pdf.setFillColor(249, 115, 22)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'FD')
      
      pdf.setFontSize(16)
      pdf.setTextColor(255, 255, 255) // White text
      pdf.text(safeT('deliveries.summary.entryExitBalance', 'Entry/Exit Balance'), margin + 5, yPosition + 12)
      
      pdf.setFontSize(11)
      const orangeCol1X = margin + 5
      const orangeCol2X = margin + (pageWidth - 2 * margin) / 2
      
      // First column
      pdf.text(`${safeT('deliveries.banners.totalEntries', 'ENTRIES')}: ${totalStats.totalEntrees.toLocaleString()} kg`, orangeCol1X, yPosition + 25)
      pdf.text(`${safeT('deliveries.banners.totalExits', 'EXITS')}: ${totalStats.totalSorties.toLocaleString()} kg`, orangeCol1X, yPosition + 35)
      
      // Second column  
      pdf.text(`${safeT('deliveries.banners.netBalance', 'BALANCE')}: ${totalStats.balance.toLocaleString()} kg`, orangeCol2X, yPosition + 25)
      
      yPosition += 60

      // Add Rendement agricole as text (skip html2canvas due to lab color compatibility issues)
      
      // Create a white bordered section for the rendement banner
      pdf.setDrawColor(200, 200, 200) // Light gray border
      pdf.setFillColor(255, 255, 255) // White background
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'FD')
      
      pdf.setFontSize(16)
      pdf.setTextColor(0, 0, 0) // Black text
      pdf.text(safeT('deliveries.summary.parcelAnalysis', 'Agricultural yield'), margin + 5, yPosition + 12)
      
      pdf.setFontSize(11)
      const whiteCol1X = margin + 5
      const whiteCol2X = margin + (pageWidth - 2 * margin) / 2
      
      // First column
      pdf.text(`${safeT('dashboard.statistics.totalSurface', 'Total surface')}: ${totalStats.surfaceTotale.toFixed(1)} ha`, whiteCol1X, yPosition + 25)
      pdf.text(`${safeT('dashboard.statistics.totalProduction', 'Total production')}: ${(totalStats.totalPoidsSec / 1000).toFixed(1)} t`, whiteCol1X, yPosition + 35)
      
      // Second column  
      pdf.text(`${safeT('dashboard.statistics.globalYield', 'Global yield')}: ${totalStats.rendementGlobal ? totalStats.rendementGlobal.toFixed(2) + ' t/ha' : 'ND'}`, whiteCol2X, yPosition + 25)
      pdf.text(`${safeT('deliveries.banners.averageHumidity', 'Average humidity')}: ${totalStats.moyenneHumidite.toFixed(1)}%`, whiteCol2X, yPosition + 35)
      
      yPosition += 60

      // Try to capture charts with simplified approach
      
      const chartElements = document.querySelectorAll('svg')
      
      if (chartElements.length > 0) {
        // Add new page for charts
        pdf.addPage()
        currentPage++
        yPosition = 20

        pdf.setFontSize(18)
        pdf.setTextColor(34, 197, 94)
        pdf.text(safeT('dashboard.charts.title', 'Advanced graphical analyses'), margin, yPosition)
        yPosition += 15

        for (let i = 0; i < chartElements.length; i++) {
          const chartElement = chartElements[i]
          try {
            const bbox = (chartElement as any).getBoundingClientRect?.()
            
            // Try direct SVG to canvas conversion (avoid html2canvas for SVG)
            const svgElement = chartElement as SVGElement
            const svgData = new XMLSerializer().serializeToString(svgElement)
            
            // Create a canvas element for manual conversion
            const tempCanvas = document.createElement('canvas')
            const ctx = tempCanvas.getContext('2d')!
            tempCanvas.width = 600
            tempCanvas.height = 400
            
            // Create an image from SVG data
            const img = new Image()
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
            const url = URL.createObjectURL(svgBlob)
            
            const imageLoadPromise = new Promise<HTMLCanvasElement>((resolve, reject) => {
              img.onload = () => {
                try {
                  // Fill white background
                  ctx.fillStyle = '#ffffff'
                  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
                  
                  // Draw the SVG image
                  ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height)
                  
                  URL.revokeObjectURL(url)
                  resolve(tempCanvas)
                } catch (err) {
                  reject(err)
                }
              }
              img.onerror = () => reject(new Error('Failed to load SVG as image'))
              
              // Set a timeout for image loading
              setTimeout(() => reject(new Error('SVG image load timeout')), 5000)
            })
            
            img.src = url
            const canvas = await imageLoadPromise
            

            const imgData = canvas.toDataURL('image/png', 0.8)
            const imgWidth = pageWidth - 2 * margin
            const imgHeight = (canvas.height * imgWidth) / canvas.width

            // Check if we need a new page
            if (yPosition + imgHeight > pageHeight - 40) {
              pdf.addPage()
              currentPage++
              yPosition = 20
            }

            // Add chart title
            pdf.setFontSize(14)
            pdf.setTextColor(0, 0, 0)
            pdf.text(safeT('dashboard.charts.temporalEvolution', 'Temporal evolution'), margin, yPosition)
            yPosition += 10

            // Add the chart
            pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight)
            yPosition += imgHeight + 20

          } catch (chartError) {
            pdf.setFontSize(12)
            pdf.setTextColor(100, 100, 100)
            pdf.text(`${safeT('dashboard.charts.chart', 'Chart')} ${i + 1}: ${safeT('dashboard.charts.notAvailable', 'Not available')} (${safeT('dashboard.charts.seeWebApp', 'see web application')})`, margin, yPosition)
            yPosition += 15
          }
        }
      } else {
        // Fallback text when no charts found
        pdf.addPage()
        currentPage++
        yPosition = 20

        pdf.setFontSize(18)
        pdf.setTextColor(34, 197, 94)
        pdf.text(safeT('dashboard.charts.title', 'Advanced graphical analyses'), margin, yPosition)
        yPosition += 20

        pdf.setFontSize(12)
        pdf.setTextColor(0, 0, 0)
        pdf.text(`${safeT('dashboard.charts.temporalEvolution', 'Temporal evolution')} of entries/exits:`, margin, yPosition)
        yPosition += 10
        
        pdf.text(`• ${safeT('dashboard.charts.interactiveChartsAvailable', 'Interactive charts are available in the web application')}`, margin + 5, yPosition)
        yPosition += 8
        pdf.text('• Visualization of entries, exits and net stock evolution', margin + 5, yPosition)
        yPosition += 8
        pdf.text('• Daily weighted average humidity tracking', margin + 5, yPosition)
        yPosition += 20
      }

      // Create ParcelleAnalysisCard-style layouts using PDF drawing commands
      
      if (initialParcelles && initialParcelles.length > 0) {
        // Add new page for parcelle cards
        pdf.addPage()
        currentPage++
        yPosition = 20

        pdf.setFontSize(18)
        pdf.setTextColor(34, 197, 94)
        pdf.text(safeT('deliveries.summary.parcelAnalysis', 'Analysis by parcel'), margin, yPosition)
        yPosition += 20

        for (let i = 0; i < initialParcelles.length; i++) {
          const parcelle = initialParcelles[i]
          
          // Calculate parcelle-specific stats from filteredLivraisons
          const parcelleLivraisons = filteredLivraisons.filter(liv => liv.parcelle === parcelle.nom_parcelle)
          const totalLivraisons = parcelleLivraisons.length
          const totalPoidsSec = parcelleLivraisons.reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
          
          // Calculate weighted humidity
          const livraisonsWithHumidite = parcelleLivraisons.filter(liv => 
            liv.humidite !== null && liv.humidite !== undefined && liv.poids_brut
          )
          let totalWeightedHumidite = 0
          let totalWeightForHumidite = 0
          livraisonsWithHumidite.forEach(liv => {
            const weight = liv.poids_brut || 0
            totalWeightedHumidite += liv.humidite * weight
            totalWeightForHumidite += weight
          })
          const moyenneHumidite = totalWeightForHumidite > 0 
            ? totalWeightedHumidite / totalWeightForHumidite 
            : 0

          // Calculate rendement
          const totalPoidsSecTonnes = totalPoidsSec / 1000
          const rendement = (parcelle.surface_hectares > 0 && totalPoidsSec > 0) 
            ? totalPoidsSecTonnes / parcelle.surface_hectares 
            : null

          // Get last delivery date
          let lastDeliveryDate = ''
          if (parcelleLivraisons.length > 0) {
            const lastDelivery = parcelleLivraisons.sort((a, b) => 
              new Date(b.date_pesee).getTime() - new Date(a.date_pesee).getTime()
            )[0]
            lastDeliveryDate = new Date(lastDelivery.date_pesee).toLocaleDateString('fr-FR')
          }
          
          // Calculate card position (2 cards per row)
          const cardWidth = (pageWidth - 3 * margin) / 2
          const cardHeight = 120
          const xPos = margin + (i % 2) * (cardWidth + margin)
          
          // Check if we need a new row or page
          if (i % 2 === 0 && i > 0 && yPosition + cardHeight > pageHeight - 40) {
            pdf.addPage()
            currentPage++
            yPosition = 20
            pdf.setFontSize(18)
            pdf.setTextColor(34, 197, 94)
            pdf.text(`${safeT('deliveries.summary.parcelAnalysis', 'Analysis by parcel')} (continued)`, margin, yPosition)
            yPosition += 20
          }

          // Start new row after every 2 cards
          if (i % 2 === 0 && i > 0) {
            yPosition += cardHeight + 10
          }

          // Draw card background with border
          pdf.setDrawColor(229, 231, 235) // Gray border
          pdf.setFillColor(255, 255, 255) // White background
          pdf.roundedRect(xPos, yPosition, cardWidth, cardHeight, 3, 3, 'FD')
          
          // Card title and surface
          pdf.setFontSize(14)
          pdf.setTextColor(17, 24, 39) // Gray-900
          pdf.text(parcelle.nom_parcelle, xPos + 8, yPosition + 15)
          
          if (parcelle.surface_hectares) {
            pdf.setFontSize(10)
            pdf.setTextColor(107, 114, 128) // Gray-500
            const surfaceText = `${parcelle.surface_hectares.toFixed(2)} ha`
            const textWidth = pdf.getTextWidth(surfaceText)
            pdf.text(surfaceText, xPos + cardWidth - 8 - textWidth, yPosition + 15)
          }
          
          // Statistics boxes - first row
          const boxWidth = (cardWidth - 24) / 2
          const boxHeight = 20
          
          // Livraisons box (blue)
          pdf.setFillColor(239, 246, 255) // Blue-50
          pdf.roundedRect(xPos + 8, yPosition + 25, boxWidth, boxHeight, 2, 2, 'F')
          pdf.setFontSize(12)
          pdf.setTextColor(37, 99, 235) // Blue-600
          const livraisonsText = totalLivraisons.toString()
          const livraisonsWidth = pdf.getTextWidth(livraisonsText)
          pdf.text(livraisonsText, xPos + 8 + (boxWidth - livraisonsWidth) / 2, yPosition + 35)
          pdf.setFontSize(8)
          pdf.setTextColor(75, 85, 99) // Gray-600
          const livraisonsLabel = safeT('deliveries.banners.totalDeliveries', 'Deliveries')
          const livraisonsLabelWidth = pdf.getTextWidth(livraisonsLabel)
          pdf.text(livraisonsLabel, xPos + 8 + (boxWidth - livraisonsLabelWidth) / 2, yPosition + 42)
          
          // Poids sec box (green)
          pdf.setFillColor(236, 253, 245) // Green-50
          pdf.roundedRect(xPos + 16 + boxWidth, yPosition + 25, boxWidth, boxHeight, 2, 2, 'F')
          pdf.setFontSize(12)
          pdf.setTextColor(34, 197, 94) // Green-600
          const poidsText = `${totalPoidsSec.toFixed(0)} kg`
          const poidsWidth = pdf.getTextWidth(poidsText)
          pdf.text(poidsText, xPos + 16 + boxWidth + (boxWidth - poidsWidth) / 2, yPosition + 35)
          pdf.setFontSize(8)
          pdf.setTextColor(75, 85, 99)
          const poidsLabel = safeT('deliveries.banners.totalWeight', 'Total dry weight')
          const poidsLabelWidth = pdf.getTextWidth(poidsLabel)
          pdf.text(poidsLabel, xPos + 16 + boxWidth + (boxWidth - poidsLabelWidth) / 2, yPosition + 42)
          
          // Second row
          // Surface box (blue)
          pdf.setFillColor(239, 246, 255) // Blue-50
          pdf.roundedRect(xPos + 8, yPosition + 50, boxWidth, boxHeight, 2, 2, 'F')
          pdf.setFontSize(12)
          pdf.setTextColor(37, 99, 235) // Blue-600
          const surfaceStatText = parcelle.surface_hectares ? `${parcelle.surface_hectares.toFixed(2)} ha` : 'ND'
          const surfaceStatWidth = pdf.getTextWidth(surfaceStatText)
          pdf.text(surfaceStatText, xPos + 8 + (boxWidth - surfaceStatWidth) / 2, yPosition + 60)
          pdf.setFontSize(8)
          pdf.setTextColor(75, 85, 99)
          const surfaceStatLabel = safeT('dashboard.parcels.surface', 'Surface')
          const surfaceStatLabelWidth = pdf.getTextWidth(surfaceStatLabel)
          pdf.text(surfaceStatLabel, xPos + 8 + (boxWidth - surfaceStatLabelWidth) / 2, yPosition + 67)
          
          // Humidity box (purple)
          pdf.setFillColor(250, 245, 255) // Purple-50
          pdf.roundedRect(xPos + 16 + boxWidth, yPosition + 50, boxWidth, boxHeight, 2, 2, 'F')
          pdf.setFontSize(12)
          pdf.setTextColor(147, 51, 234) // Purple-600
          const humidityText = `${moyenneHumidite.toFixed(1)}%`
          const humidityWidth = pdf.getTextWidth(humidityText)
          pdf.text(humidityText, xPos + 16 + boxWidth + (boxWidth - humidityWidth) / 2, yPosition + 60)
          pdf.setFontSize(8)
          pdf.setTextColor(75, 85, 99)
          const humidityLabel = safeT('deliveries.banners.averageHumidity', 'Average humidity')
          const humidityLabelWidth = pdf.getTextWidth(humidityLabel)
          pdf.text(humidityLabel, xPos + 16 + boxWidth + (boxWidth - humidityLabelWidth) / 2, yPosition + 67)
          
          // Rendement box (orange) - full width
          pdf.setFillColor(255, 247, 237) // Orange-50
          pdf.roundedRect(xPos + 8, yPosition + 75, cardWidth - 16, 15, 2, 2, 'F')
          pdf.setFontSize(12)
          pdf.setTextColor(234, 88, 12) // Orange-600
          const rendementText = rendement ? `${rendement.toFixed(2)} t/ha` : 'ND'
          const rendementWidth = pdf.getTextWidth(rendementText)
          pdf.text(rendementText, xPos + 8 + (cardWidth - 16 - rendementWidth) / 2, yPosition + 85)
          pdf.setFontSize(8)
          pdf.setTextColor(75, 85, 99)
          const rendementLabel = safeT('dashboard.parcels.yield', 'Yield')
          const rendementLabelWidth = pdf.getTextWidth(rendementLabel)
          pdf.text(rendementLabel, xPos + 8 + (cardWidth - 16 - rendementLabelWidth) / 2, yPosition + 92)
          
          // Last delivery date
          if (lastDeliveryDate) {
            pdf.setFontSize(8)
            pdf.setTextColor(107, 114, 128)
            const lastDeliveryText = `${safeT('deliveries.banners.lastDelivery', 'Last delivery')}: ${lastDeliveryDate}`
            const lastDeliveryWidth = pdf.getTextWidth(lastDeliveryText)
            pdf.text(lastDeliveryText, xPos + 8 + (cardWidth - 16 - lastDeliveryWidth) / 2, yPosition + 105)
          }
        }
      }

      // Add footer to all pages
      const totalPages = pdf.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        
        // Footer
        const now = new Date()
        pdf.setFontSize(8)
        pdf.setTextColor(128, 128, 128)
        pdf.text(`Page ${i}/${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' })
        pdf.text(`Generated on ${now.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}`, margin, pageHeight - 5)
      }

      // Save the PDF
      const fileName = `rapport_dashboard_${client.nom_client.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)

    } catch (error) {
      alert('Error generating PDF. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SharedHeader client={client} currentPage="dashboard" safeT={safeT} />

      <div className="flex">
        {/* Left Sidebar */}
        <div className="w-64 bg-white shadow-sm min-h-screen">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 {safeT('dashboard.title', 'Dashboard')}</h3>
            <div className="space-y-2">
              <div className="bg-green-100 text-green-800 border-l-4 border-green-500 px-3 py-2 rounded-lg">
                <div className="font-medium flex items-center space-x-2">
                  <span>🏠</span>
                  <span>{safeT('navigation.dashboard')}</span>
                </div>
                <div className="text-xs text-green-600">{safeT('dashboard.subtitle', 'Overview of your agricultural activity')}</div>
              </div>
            </div>
          </div>

          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 {safeT('dashboard.quickActions', 'Quick actions')}</h3>
            <div className="space-y-2">
              <button
                onClick={() => fetchFilteredData()}
                className="w-full flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>🔄</span>
                <span>{safeT('dashboard.actions.refreshData', 'Refresh data')}</span>
              </button>
              <button
                onClick={exportToPDF}
                className="w-full flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <span>📄</span>
                <span>{safeT('dashboard.actions.exportPdf', 'Export PDF')}</span>
              </button>
              <Link
                href="/livraisons"
                className="w-full flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <span>📦</span>
                <span>{safeT('dashboard.actions.viewDeliveries', 'View deliveries')}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Dashboard Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">🏠 {safeT('dashboard.title', 'Dashboard')}</h1>
            <p className="text-gray-600">{safeT('dashboard.subtitle', 'Overview of your agricultural activity')}</p>
          </div>

          {/* Filter Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            {/* Date Début */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 {safeT('deliveries.filters.startDate', 'Start date')}:
              </label>
              <DatePicker
                selected={dateDebut}
                onChange={(date) => {
                  setDateDebut(date)
                  if (date) {
                    Cookies.set('dashboard_date_debut', date.toISOString().split('T')[0], { expires: 365 })
                  }
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText={safeT('common.selectDate', 'Select a date')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxDate={dateFin || new Date()}
                calendarStartDay={1}
              />
            </div>

            {/* Date Fin */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 {safeT('deliveries.filters.endDate', 'End date')}:
              </label>
              <DatePicker
                selected={dateFin}
                onChange={(date) => {
                  setDateFin(date)
                  if (date) {
                    // Save as session cookie (expires when browser session ends)
                    Cookies.set('dashboard_date_fin', date.toISOString().split('T')[0])
                  }
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText={safeT('common.selectDate', 'Select a date')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                minDate={dateDebut}
                maxDate={new Date()}
                calendarStartDay={1}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 mt-4">
            <button
              onClick={() => fetchFilteredData()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-semibold flex items-center space-x-2"
            >
              <span>📊</span>
              <span>{safeT('dashboard.actions.refresh', 'Refresh')}</span>
            </button>

            <button
              onClick={() => {
                // Reset to default values
                const today = new Date()
                const currentYear = today.getFullYear()
                const currentMonth = today.getMonth()
                const augustYear = currentMonth < 7 ? currentYear - 1 : currentYear
                const august1st = new Date(augustYear, 7, 1)

                setDateDebut(august1st)
                setDateFin(today)

                // Update cookies
                Cookies.set('dashboard_date_debut', august1st.toISOString().split('T')[0], { expires: 365 })
                Cookies.set('dashboard_date_fin', today.toISOString().split('T')[0])
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-md font-medium flex items-center space-x-2 text-sm"
            >
              <span>🔄</span>
              <span>{safeT('dashboard.actions.reset', 'Reset')}</span>
            </button>
          </div>
        </div>


          {/* Entrées/Sorties/Balance Statistics */}
          <div className="bg-blue-100 text-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">⚖️</span>
              {safeT('deliveries.summary.entryExitBalance', 'Entry/Exit Balance')}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">📥 {safeT('deliveries.banners.totalEntries', 'ENTRIES')} (kg)</p>
                <p className="text-2xl font-bold text-green-600">{totalStats.totalEntrees.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">📤 {safeT('deliveries.banners.totalExits', 'EXITS')} (kg)</p>
                <p className="text-2xl font-bold text-red-600">{totalStats.totalSorties.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">⚖️ {safeT('deliveries.banners.netBalance', 'BALANCE')} (kg)</p>
                <p className={`text-2xl font-bold ${totalStats.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {totalStats.balance.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Rendement Information */}
          <div className="bg-green-50 rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🌾</span>
              {safeT('deliveries.summary.parcelAnalysis', 'Agricultural yield')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-500">{safeT('dashboard.statistics.totalSurface', 'Total surface')}</p>
                <p className="text-3xl font-bold text-green-600">{totalStats.surfaceTotale.toFixed(1)} ha</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">{safeT('dashboard.statistics.totalProduction', 'Total production')}</p>
                <p className="text-3xl font-bold text-blue-600">{(totalStats.totalPoidsSec / 1000).toFixed(1)} t</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">{safeT('dashboard.statistics.globalYield', 'Global yield')}</p>
                <p className="text-3xl font-bold text-yellow-600">{totalStats.rendementGlobal !== null ? totalStats.rendementGlobal.toFixed(2) + ' t/ha' : 'ND'}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">{safeT('deliveries.banners.averageHumidity', 'Average humidity')}</p>
                <p className="text-3xl font-bold text-purple-600">{totalStats.moyenneHumidite.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Interactive D3.js Charts */}
          {filteredLivraisons && filteredLivraisons.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">📈 {safeT('dashboard.charts.title')}</h3>
              <D3Charts livraisons={filteredLivraisons} parcelles={initialParcelles} t={safeT} />
            </div>
          )}


          {/* Parcelles Analysis with Navigation */}
          {initialParcelles && initialParcelles.length > 0 && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  🌾 {safeT('deliveries.summary.parcelAnalysis', 'Analysis by parcel')}
                </h2>
                <Link
                  href="/livraisons"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  {safeT('dashboard.actions.viewEntryExitDetails', 'View entry/exit details')} →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {initialParcelles.map((parcelle) => (
                  <div key={parcelle.id} className="relative">
                    <ParcelleAnalysisCard
                      parcelle={parcelle}
                      clientId={client.local_id}
                      dateDebut={dateDebut?.toISOString().split('T')[0]}
                      dateFin={dateFin?.toISOString().split('T')[0]}
                    />
                    <div className="absolute top-4 right-4">
                      <Link
                        href={`/livraisons?parcelle=${encodeURIComponent(parcelle.nom_parcelle)}`}
                        className="bg-white/90 hover:bg-white text-indigo-600 p-2 rounded-full shadow-sm text-xs"
                        title={safeT('dashboard.actions.viewDetails', 'View details')}
                      >
                        →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Recent Livraisons */}
          {filteredLivraisons && filteredLivraisons.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  📦 {safeT('deliveries.title', 'Recent deliveries')} ({filteredLivraisons.length})
                </h2>
                <Link
                  href="/livraisons"
                  className="text-indigo-600 hover:text-indigo-500 font-medium"
                >
                  {safeT('dashboard.actions.viewAllDeliveries', 'View all deliveries')} →
                </Link>
              </div>
              <RecentLivraisonsTable livraisons={filteredLivraisons.slice(0, 10)} />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}