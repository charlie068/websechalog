'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Client, Livraison } from '@/lib/supabase'
import D3Charts from './D3Charts'
import Link from 'next/link'
import ResponsiveLayout from './ResponsiveLayout'
import { useTranslations } from '@/hooks/useTranslations'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"

interface LivraisonsClientProps {
  client: Client
  initialLivraisons: Livraison[]
}

// Helper function to convert product ID to product name with translation
const getProductName = (productId: number | null | undefined, safeT: (key: string, fallback?: string) => string): string => {
  if (!productId) return safeT('common.notAvailable', 'N/A')

  const productMap: { [key: number]: string } = {
    1: safeT('products.mais', 'Corn'),
    2: safeT('products.ble', 'Wheat'),
    3: safeT('products.orge', 'Barley'),
    4: safeT('products.soja', 'Soybean'),
    5: safeT('products.tournesol', 'Sunflower'),
    6: safeT('products.colza', 'Rapeseed')
  }

  return productMap[productId] || `${safeT('products.unknown', 'Product')} ${productId}`
}

// Helper function to format rendement
const formatRendement = (rendement: number | null, safeT?: (key: string, fallback?: string) => string, hasNoSurface?: boolean): string => {
  if (rendement === null || rendement === 0 || !rendement) {
    if (hasNoSurface && safeT) {
      return safeT('dashboard.parcels.noSurfaceArea', 'No surface area')
    }
    return safeT ? safeT('common.notAvailable', 'N/A') : 'N/A'
  }
  return rendement.toFixed(2)
}

// Product definitions with safe translation
const getAllProducts = (safeT: (key: string, fallback?: string) => string) => [
  { id: 0, name: safeT('products.all', 'All products'), emoji: '🌾', color: 'gray' },
  { id: 1, name: safeT('products.mais', 'Corn'), emoji: '🌽', color: 'yellow' },
  { id: 2, name: safeT('products.ble', 'Wheat'), emoji: '🌾', color: 'amber' },
  { id: 3, name: safeT('products.orge', 'Barley'), emoji: '🌾', color: 'green' },
  { id: 4, name: safeT('products.soja', 'Soybean'), emoji: '🟢', color: 'green' },
  { id: 5, name: safeT('products.tournesol', 'Sunflower'), emoji: '🌻', color: 'yellow' },
  { id: 6, name: safeT('products.colza', 'Rapeseed'), emoji: '🟡', color: 'yellow' }
]

// Filter products based on what exists in client's delivery data
const getAvailableProducts = (livraisons: Livraison[], safeT: (key: string, fallback?: string) => string) => {
  const allProducts = getAllProducts(safeT)
  const usedProductIds = Array.from(new Set(livraisons.map(liv => liv.produit_local_id).filter(Boolean)))

  // Always include "All products" option
  const availableProducts = [allProducts[0]]

  // Add products that exist in the delivery data
  usedProductIds.forEach(productId => {
    const product = allProducts.find(p => p.id === productId)
    if (product) {
      availableProducts.push(product)
    }
  })

  return availableProducts
}

// Legacy function for compatibility
const getProducts = (safeT: (key: string, fallback?: string) => string) => getAllProducts(safeT)

const getProductInfo = (productId: number | null | undefined, safeT: (key: string, fallback?: string) => string) => {
  if (!productId) return { name: 'N/A', emoji: '❓', color: 'gray' }

  const products = getProducts(safeT)
  const product = products.find(p => p.id === productId)
  return product || { name: `${safeT('products.unknown', 'Unknown product')} ${productId}`, emoji: '❓', color: 'gray' }
}

export default function LivraisonsClient({ client, initialLivraisons }: LivraisonsClientProps) {
  const { t, loading: translationsLoading } = useTranslations()

  // Safe translation function
  const safeT = (key: string, fallback?: string): string => {
    try {
      const result = t(key, fallback)
      return result
    } catch (error) {
      return fallback || key
    }
  }

  const searchParams = useSearchParams()
  const [livraisons, setLivraisons] = useState<Livraison[]>(initialLivraisons)
  const [parcelles, setParcelles] = useState<{[name: string]: {surface_hectares?: number}}>({})
  const [loading, setLoading] = useState(false)
  
  
  // Filter states
  const [dateDebut, setDateDebut] = useState<Date | null>(null)
  const [dateFin, setDateFin] = useState<Date | null>(null)
  const [parcelleFilter, setParcelleFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [productFilter, setProductFilter] = useState(1) // 1 = Mais (default)
  const [searchTerm, setSearchTerm] = useState('')

  // Edit states for inline editing
  const [editingRow, setEditingRow] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [updating, setUpdating] = useState(false)
  
  // Stats
  const [stats, setStats] = useState({
    totalLivraisons: 0,
    totalPoidsSec: 0,
    totalPoidsBrut: 0,
    moyenneHumidite: 0,
    moyenneRendement: 0,
    totalEntrees: 0,
    totalSorties: 0,
    balance: 0
  })

  // Per-parcelle stats
  const [statsParcelle, setStatsParcelle] = useState<{[parcelle: string]: {
    livraisons: number,
    poidsSec: number,
    poidsBrut: number,
    rendement: number | null,
    humidite: number
  }}>({})

  // Calculate initial statistics for initialLivraisons
  const calculateInitialStats = useCallback(() => {
    const filtered = initialLivraisons

    // Calculate basic stats
    const totalPoidsSec = filtered.reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
    const totalPoidsBrut = filtered.reduce((sum, liv) => sum + (liv.poids_brut || 0), 0)

    const humiditeValues = filtered
      .map(liv => liv.humidite)
      .filter(h => h !== null && h !== undefined)

    const moyenneHumidite = humiditeValues.length > 0
      ? (humiditeValues.reduce((sum, h) => sum + h, 0) / humiditeValues.length)
      : 0

    // Calculate rendement (yield per hectare) - only for entree operations from parcelles with area data
    // Always include raw database parcelle names for lookup, regardless of language
    const parcelleNamesWithArea = new Set(Object.keys(parcelles).filter(name =>
      parcelles[name]?.surface_hectares && parcelles[name].surface_hectares > 0
    ))

    // Also ensure raw database parcelle names are included for lookup
    const allParcelleNames = [...parcelleNamesWithArea]
    allParcelleNames.forEach(name => {
      // Add both translated and untranslated versions for reliable lookup
      if (name === safeT('common.other', 'Others')) {
        parcelleNamesWithArea.add('Autres')
      } else if (name === 'Autres') {
        parcelleNamesWithArea.add(safeT('common.other', 'Others'))
      }
    })

    // Filter to only include entree operations from parcelles with area data
    const livraisonsFromParcellesWithArea = filtered.filter(liv =>
      liv.type_operation === 'entree' && liv.parcelle && parcelleNamesWithArea.has(liv.parcelle)
    )

    const totalPoidsSecFromAreaParcelles = livraisonsFromParcellesWithArea.reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
    const surfaceTotale = Array.from(parcelleNamesWithArea).reduce((sum, name) =>
      sum + (parcelles[name]?.surface_hectares || 0), 0
    )

    const totalPoidsSecTonnes = totalPoidsSecFromAreaParcelles / 1000 // Convert to tonnes
    const moyenneRendement = (surfaceTotale > 0 && totalPoidsSecFromAreaParcelles > 0) ? totalPoidsSecTonnes / surfaceTotale : null


    // Calculate entrées, sorties, and balance
    const totalEntrees = filtered
      .filter(liv => liv.type_operation === 'entree')
      .reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)

    const totalSorties = filtered
      .filter(liv => liv.type_operation === 'sortie')
      .reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)

    const balance = totalEntrees - totalSorties

    setStats({
      totalLivraisons: filtered.length,
      totalPoidsSec,
      totalPoidsBrut,
      moyenneHumidite,
      moyenneRendement,
      totalEntrees,
      totalSorties,
      balance
    })

    // Calculate per-parcelle stats
    const parcelleStats: {[parcelle: string]: {livraisons: number, poidsSec: number, poidsBrut: number, poidsSecEntrees: number, rendement: number, humidite: number}} = {}

    filtered.forEach(liv => {
      const parcelleName = liv.parcelle || 'Autres'
      if (!parcelleStats[parcelleName]) {
        parcelleStats[parcelleName] = {
          livraisons: 0,
          poidsSec: 0,
          poidsBrut: 0,
          poidsSecEntrees: 0, // Track entry operations only for yield calculation
          rendement: null,
          humidite: 0
        }
      }
      parcelleStats[parcelleName].livraisons++
      parcelleStats[parcelleName].poidsSec += liv.poids_sec || 0
      parcelleStats[parcelleName].poidsBrut += liv.poids_brut || 0

      // Only count dry weight from entry operations for yield calculation
      if (liv.type_operation === 'entree') {
        parcelleStats[parcelleName].poidsSecEntrees += liv.poids_sec || 0
      }

      if (liv.humidite) parcelleStats[parcelleName].humidite += liv.humidite
    })

    // Calculate averages for each parcelle, including proper rendement calculation
    Object.keys(parcelleStats).forEach(parcelle => {
      const stats = parcelleStats[parcelle]
      stats.humidite = stats.livraisons > 0 ? stats.humidite / stats.livraisons : 0

      // Calculate rendement in t/ha - use only entry operations
      const surface = parcelles[parcelle]?.surface_hectares
      if (surface && surface > 0 && stats.poidsSecEntrees > 0) {
        stats.rendement = (stats.poidsSecEntrees / 1000) / surface // t/ha
      } else {
        stats.rendement = null
      }
    })

    setStatsParcelle(parcelleStats)
  }, [initialLivraisons, parcelles])

  // Set initial filters from URL params and fetch parcelles data
  useEffect(() => {
    const parcelle = searchParams.get('parcelle')
    const type = searchParams.get('type')
    
    if (parcelle) setParcelleFilter(parcelle)
    if (type) setTypeFilter(type)
    
    // Set default dates (August 1st to today, like dashboard)
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()
    const augustYear = currentMonth < 7 ? currentYear - 1 : currentYear
    const august1st = new Date(augustYear, 7, 1)

    setDateDebut(august1st)
    setDateFin(today)

    // Fetch parcelles data for surface area calculations
    fetchParcelles()
  }, [searchParams])

  // Set default product filter to first available product for client
  useEffect(() => {
    if (initialLivraisons.length > 0 && !translationsLoading) {
      const availableProducts = getAvailableProducts(initialLivraisons, safeT)
      // If current productFilter is not available in client's data, set to first available product
      const isCurrentProductAvailable = availableProducts.some(p => p.id === productFilter)
      if (!isCurrentProductAvailable && availableProducts.length > 0) {
        // Set to first product after "All products" if available, otherwise "All products"
        const defaultProduct = availableProducts.length > 1 ? availableProducts[1] : availableProducts[0]
        setProductFilter(defaultProduct.id)
      }
    }
  }, [initialLivraisons, productFilter, translationsLoading])

  // Calculate initial statistics when parcelles data is loaded
  useEffect(() => {
    if (Object.keys(parcelles).length > 0 && initialLivraisons.length > 0) {
      calculateInitialStats()
    }
  }, [parcelles, initialLivraisons, calculateInitialStats])

  const fetchParcelles = async () => {
    try {
      const { data: parcellesData, error } = await supabase
        .from('parcelles')
        .select('nom_parcelle, surface_hectares')
        .eq('client_local_id', client.local_id)
        .eq('actif', true)

      const parcelleMap: {[name: string]: {surface_hectares?: number}} = {}
      
      // Add "other" parcelle entries (may not be in parcelles table)
      // Store both the raw database value and translated version
      parcelleMap['Autres'] = { surface_hectares: undefined }
      parcelleMap[safeT('common.other', 'Others')] = { surface_hectares: undefined }
      
      parcellesData?.forEach(p => {
        if (p.nom_parcelle) {
          parcelleMap[p.nom_parcelle] = { surface_hectares: p.surface_hectares }
        }
      })

      setParcelles(parcelleMap)
    } catch (error) {
      // Error fetching parcelles
    }
  }

  // Helper function to calculate rendement in t/ha
  const calculateRendement = (poidsSec: number, parcelleName: string): number | null => {
    const parcelle = parcelles[parcelleName]
    const surface = parcelle?.surface_hectares
    
    if (surface && surface > 0) {
      return (poidsSec / 1000) / surface // Convert kg to tonnes, then divide by hectares
    }
    return null // Return null if no surface area available
  }

  // Fetch filtered data
  const fetchFilteredData = async () => {
    // Don't fetch if we don't have required date filters
    if (!dateDebut || !dateFin) {
      return
    }

    // Don't calculate yield stats if parcelles data is not available yet
    const hasParcelles = Object.keys(parcelles).length > 0

    setLoading(true)
    try {
      // Add time to make end date inclusive of the full day
      const dateFinInclusive = dateFin.toISOString().split('T')[0] + 'T23:59:59.999Z'
      const dateDebutInclusive = dateDebut.toISOString().split('T')[0] + 'T00:00:00.000Z'

      let query = supabase
        .from('livraisons')
        .select('*')
        .eq('client_local_id', client.local_id)
        .gte('date_pesee', dateDebutInclusive)
        .lte('date_pesee', dateFinInclusive)
      if (parcelleFilter) query = query.eq('parcelle', parcelleFilter)
      if (typeFilter) query = query.eq('type_operation', typeFilter)
      
      const { data, error } = await query.order('date_pesee', { ascending: false })

      if (data) {
        let filtered = data as Livraison[]
        
        // Apply text search if provided
        if (searchTerm) {
          filtered = filtered.filter(liv =>
            liv.parcelle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            liv.chauffeur?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        }

        // Apply product filter if provided (0 = All products)
        if (productFilter > 0) {
          filtered = filtered.filter(liv => liv.produit_local_id === productFilter)
        }
        
        setLivraisons(filtered)
        
        // Calculate stats
        const totalPoidsSec = filtered.reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
        const totalPoidsBrut = filtered.reduce((sum, liv) => sum + (liv.poids_brut || 0), 0)
        
        // Calculate weighted average humidity for entree operations (weighted by gross weight)
        const livraisonsWithHumidite = filtered.filter(liv =>
          liv.type_operation === 'entree' &&
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

        // Calculate rendement (yield per hectare) - only for entree operations from parcelles with area data
        let moyenneRendement = null

        if (hasParcelles) {
          const parcelleNamesWithArea = new Set(Object.keys(parcelles).filter(name =>
            parcelles[name]?.surface_hectares && parcelles[name].surface_hectares > 0
          ))

        // Also ensure raw database parcelle names are included for lookup
        const allParcelleNames = [...parcelleNamesWithArea]
        allParcelleNames.forEach(name => {
          // Add both translated and untranslated versions for reliable lookup
          if (name === safeT('common.other', 'Others')) {
            parcelleNamesWithArea.add('Autres')
          } else if (name === 'Autres') {
            parcelleNamesWithArea.add(safeT('common.other', 'Others'))
          }
        })

        // Filter to only include entree operations from parcelles with area data
        const livraisonsFromParcellesWithArea = filtered.filter(liv =>
          liv.type_operation === 'entree' && liv.parcelle && parcelleNamesWithArea.has(liv.parcelle)
        )

        const totalPoidsSecFromAreaParcelles = livraisonsFromParcellesWithArea.reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
        const surfaceTotale = Array.from(parcelleNamesWithArea).reduce((sum, name) =>
          sum + (parcelles[name]?.surface_hectares || 0), 0
        )

          const totalPoidsSecTonnes = totalPoidsSecFromAreaParcelles / 1000 // Convert to tonnes
          moyenneRendement = (surfaceTotale > 0 && totalPoidsSecFromAreaParcelles > 0) ? totalPoidsSecTonnes / surfaceTotale : null
        }

        // Calculate entrées, sorties, and balance
        const totalEntrees = filtered
          .filter(liv => liv.type_operation === 'entree')
          .reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)

        const totalSorties = filtered
          .filter(liv => liv.type_operation === 'sortie')
          .reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)

        const balance = totalEntrees - totalSorties

        setStats({
          totalLivraisons: filtered.length,
          totalPoidsSec,
          totalPoidsBrut,
          moyenneHumidite,
          moyenneRendement,
          totalEntrees,
          totalSorties,
          balance
        })

        // Calculate per-parcelle stats
        const parcelleStats: {[parcelle: string]: {livraisons: number, poidsSec: number, poidsBrut: number, poidsSecEntrees: number, rendement: number, humidite: number}} = {}

        filtered.forEach(liv => {
          const parcelleName = liv.parcelle || 'Autres'
          if (!parcelleStats[parcelleName]) {
            parcelleStats[parcelleName] = {
              livraisons: 0,
              poidsSec: 0,
              poidsBrut: 0,
              poidsSecEntrees: 0, // Track entry operations only for yield calculation
              rendement: null,
              humidite: 0
            }
          }
          parcelleStats[parcelleName].livraisons++
          parcelleStats[parcelleName].poidsSec += liv.poids_sec || 0
          parcelleStats[parcelleName].poidsBrut += liv.poids_brut || 0

          // Only count dry weight from entry operations for yield calculation
          if (liv.type_operation === 'entree') {
            parcelleStats[parcelleName].poidsSecEntrees += liv.poids_sec || 0
          }

          if (liv.humidite) parcelleStats[parcelleName].humidite += liv.humidite
        })

        // Calculate averages for each parcelle, including proper rendement calculation
        Object.keys(parcelleStats).forEach(parcelle => {
          const stats = parcelleStats[parcelle]
          stats.humidite = stats.livraisons > 0 ? stats.humidite / stats.livraisons : 0

          // Calculate rendement in t/ha - use only entry operations
          const surface = parcelles[parcelle]?.surface_hectares
          if (surface && surface > 0 && stats.poidsSecEntrees > 0) {
            stats.rendement = (stats.poidsSecEntrees / 1000) / surface // t/ha
          } else {
            stats.rendement = null
          }
        })

        setStatsParcelle(parcelleStats)
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false)
    }
  }

  // Update parcelle name in database
  const updateParcelleInDatabase = async (livraisonId: number, newParcelle: string) => {
    setUpdating(true)
    try {
      const { error } = await supabase
        .from('livraisons')
        .update({ parcelle: newParcelle })
        .eq('id', livraisonId)

      if (error) {
        console.error('Error updating parcelle:', error)
        alert(safeT('errors.updateFailed', 'Failed to update parcelle. Please try again.'))
        return false
      }

      // Update local state
      setLivraisons(prev => prev.map(liv =>
        liv.id === livraisonId
          ? { ...liv, parcelle: newParcelle }
          : liv
      ))

      // Refresh stats if needed
      if (dateDebut && dateFin) {
        fetchFilteredData()
      }

      return true
    } catch (error) {
      console.error('Error updating parcelle:', error)
      alert(safeT('errors.updateFailed', 'Failed to update parcelle. Please try again.'))
      return false
    } finally {
      setUpdating(false)
    }
  }

  // Handle edit start
  const startEditing = (livraisonId: number, currentParcelle: string) => {
    setEditingRow(livraisonId)
    setEditingValue(currentParcelle || '')
  }

  // Handle edit cancel
  const cancelEditing = () => {
    setEditingRow(null)
    setEditingValue('')
  }

  // Handle edit save
  const saveEdit = async (livraisonId: number) => {
    const trimmedValue = editingValue.trim()
    const success = await updateParcelleInDatabase(livraisonId, trimmedValue || 'Autres')
    if (success) {
      setEditingRow(null)
      setEditingValue('')
    }
  }

  // Auto-fetch when filters change (but not on initial render if we have initial data)
  useEffect(() => {
    // Fetch when dates are set (with or without other filters)
    if (dateDebut && dateFin) {
      fetchFilteredData()
    }
  }, [dateDebut, dateFin, parcelleFilter, typeFilter, productFilter, searchTerm, client.local_id, parcelles])

  // Get unique parcelles for filter dropdown
  const uniqueParcelles = Array.from(new Set(initialLivraisons.map(liv => liv.parcelle).filter(Boolean)))

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📦 {safeT('deliveries.title', 'Deliveries')}</h3>
        <div className="space-y-2">
          <div className="bg-indigo-100 text-indigo-800 border-l-4 border-indigo-500 px-3 py-2 rounded-lg">
            <div className="font-medium flex items-center space-x-2">
              <span>📦</span>
              <span>{safeT('deliveries.title', 'Detailed Deliveries')}</span>
            </div>
            <div className="text-xs text-indigo-600">{safeT('deliveries.subtitle', 'Complete history of your deliveries')}</div>
          </div>
        </div>
      </div>

      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🌾 {safeT('deliveries.sidebar.filterByProduct', 'Filter by Product')}</h3>
        <div className="space-y-2">
          {getAvailableProducts(initialLivraisons, safeT).map(product => (
            <button
              key={product.id}
              onClick={() => setProductFilter(product.id)}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-left ${
                productFilter === product.id
                  ? `bg-${product.color}-100 text-${product.color}-800 border-l-4 border-${product.color}-500`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{product.emoji}</span>
              <span className="text-sm">{product.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 {safeT('deliveries.sidebar.quickActions', 'Quick Actions')}</h3>
        <div className="space-y-2">
          <button
            onClick={() => fetchFilteredData()}
            className="w-full flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>🔄</span>
            <span>{safeT('deliveries.actions.refresh', 'Refresh data')}</span>
          </button>
          <Link
            href="/dashboard"
            className="w-full flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <span>🏠</span>
            <span>{safeT('navigation.dashboard', 'Dashboard')}</span>
          </Link>
        </div>
      </div>
    </>
  )

  return (
    <ResponsiveLayout
      client={client}
      currentPage="deliveries"
      safeT={safeT}
      sidebarContent={sidebarContent}
    >
          {/* Dashboard Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">📦 {safeT('deliveries.title', 'Detailed Deliveries')}</h1>
            <p className="text-gray-600">{safeT('deliveries.subtitle', 'Complete history of your deliveries')}</p>
          </div>

          {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            {/* Date début */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 {safeT('deliveries.filters.startDate', 'Start date')}:
              </label>
              <DatePicker
                selected={dateDebut}
                onChange={(date) => {
                  setDateDebut(date)
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText="Sélectionner une date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxDate={dateFin || new Date()}
                calendarStartDay={1}
              />
            </div>

            {/* Date fin */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 {safeT('deliveries.filters.endDate', 'End date')}:
              </label>
              <DatePicker
                selected={dateFin}
                onChange={(date) => {
                  setDateFin(date)
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText="Sélectionner une date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                minDate={dateDebut}
                maxDate={new Date()}
                calendarStartDay={1}
              />
            </div>

            {/* Parcelle Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🌾 {safeT('deliveries.filters.parcel', 'Parcel')}:
              </label>
              <select
                value={parcelleFilter}
                onChange={(e) => setParcelleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{safeT('deliveries.filters.allParcels', 'All parcels')}</option>
                {uniqueParcelles.map(parcelle => (
                  <option key={parcelle} value={parcelle}>{parcelle}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📋 {safeT('deliveries.filters.operation', 'Type')}:
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{safeT('deliveries.filters.allOperations', 'All operations')}</option>
                <option value="entree">📥 {safeT('deliveries.operations.entree', 'Entries')}</option>
                <option value="sortie">📤 {safeT('deliveries.operations.sortie', 'Exits')}</option>
              </select>
            </div>


            {/* Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔍 {safeT('common.search', 'Search')}:
              </label>
              <input
                type="text"
                placeholder="BL, chauffeur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 mt-4">
            <button
              onClick={fetchFilteredData}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-md font-semibold flex items-center space-x-2"
            >
              <span>📊</span>
              <span>{loading ? safeT('common.loading', 'Loading...') : safeT('deliveries.actions.refresh', 'Refresh')}</span>
            </button>

            <button
              onClick={() => {
                // Reset to default values (August 1st to today, like dashboard)
                const today = new Date()
                const currentYear = today.getFullYear()
                const currentMonth = today.getMonth()
                const augustYear = currentMonth < 7 ? currentYear - 1 : currentYear
                const august1st = new Date(augustYear, 7, 1)

                setDateDebut(august1st)
                setDateFin(today)
                setParcelleFilter('')
                setTypeFilter('')
                setSearchTerm('')
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-md font-medium flex items-center space-x-2 text-sm"
            >
              <span>🔄</span>
              <span>{safeT('deliveries.actions.reset', 'Reset')}</span>
            </button>

          </div>
        </div>

        {/* Entrées/Sorties/Balance Statistics */}
        <div className="bg-blue-100 text-gray-800 rounded-lg p-4 lg:p-6 mb-4 lg:mb-6">
          <h3 className="text-base lg:text-lg font-medium mb-3 flex items-center">
            <span className="mr-2">⚖️</span>
            {safeT('deliveries.summary.entryExitBalance', 'Entry/Exit Balance')}
          </h3>
          <div className="grid grid-cols-3 gap-2 lg:gap-4">
            <div className="text-center lg:bg-transparent lg:border-none lg:p-0">
              <p className="text-xs font-normal text-gray-600 lg:text-xs lg:font-semibold lg:uppercase lg:tracking-wide">📥 <span className="lg:hidden">{safeT('deliveries.banners.totalEntries', 'ENT')}</span><span className="hidden lg:inline">{safeT('deliveries.banners.totalEntries', 'ENTRIES')} (kg)</span></p>
              <p className="text-lg lg:text-2xl font-semibold lg:font-bold text-green-600">{stats.totalEntrees.toLocaleString()}</p>
            </div>
            <div className="text-center lg:bg-transparent lg:border-none lg:p-0">
              <p className="text-xs font-normal text-gray-600 lg:text-xs lg:font-semibold lg:uppercase lg:tracking-wide">📤 <span className="lg:hidden">{safeT('deliveries.banners.totalExits', 'EX')}</span><span className="hidden lg:inline">{safeT('deliveries.banners.totalExits', 'EXITS')} (kg)</span></p>
              <p className="text-lg lg:text-2xl font-semibold lg:font-bold text-red-600">{stats.totalSorties.toLocaleString()}</p>
            </div>
            <div className="text-center lg:bg-transparent lg:border-none lg:p-0">
              <p className="text-xs font-normal text-gray-600 lg:text-xs lg:font-semibold lg:uppercase lg:tracking-wide">⚖️ <span className="lg:hidden">{safeT('deliveries.banners.netBalance', 'BAL')}</span><span className="hidden lg:inline">{safeT('deliveries.banners.netBalance', 'BALANCE')} (kg)</span></p>
              <p className="text-lg lg:text-2xl font-semibold lg:font-bold text-blue-600">{stats.balance.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Rendement Information */}
        <div className="bg-green-50 rounded-lg shadow p-4 lg:p-6 mb-4 lg:mb-8">
          <h2 className="text-base lg:text-lg font-medium text-gray-900 mb-3 flex items-center">
            <span className="mr-2">🌾</span>
            {safeT('dashboard.parcels.yield', 'Agricultural yield')}
          </h2>
          <div className="grid grid-cols-4 gap-2 lg:gap-4">
            <div className="text-center lg:bg-transparent lg:border-none lg:p-0">
              <p className="text-xs text-gray-500 lg:text-sm"><span className="lg:hidden">{safeT('deliveries.banners.totalDeliveries', 'Del')}</span><span className="hidden lg:inline">{safeT('deliveries.banners.totalDeliveries', 'Total deliveries')}</span></p>
              <p className="text-sm lg:text-base font-semibold text-indigo-600">{stats.totalLivraisons}</p>
            </div>
            <div className="text-center lg:bg-transparent lg:border-none lg:p-0">
              <p className="text-xs text-gray-500 lg:text-sm"><span className="lg:hidden">{safeT('deliveries.banners.totalWeight', 'Weight')}</span><span className="hidden lg:inline">{safeT('deliveries.banners.totalWeight', 'Total dry weight')}</span></p>
              <p className="text-sm lg:text-base font-semibold text-green-600">{(stats.totalEntrees / 1000).toFixed(1)} t</p>
            </div>
            <div className="text-center lg:bg-transparent lg:border-none lg:p-0">
              <p className="text-xs text-gray-500 lg:text-sm"><span className="lg:hidden">{safeT('deliveries.banners.averageYield', 'Yield')}</span><span className="hidden lg:inline">{safeT('deliveries.banners.averageYield', 'Average yield')}</span></p>
              <p className="text-sm lg:text-base font-semibold text-yellow-600">{formatRendement(stats.moyenneRendement, safeT)}</p>
            </div>
            <div className="text-center lg:bg-transparent lg:border-none lg:p-0">
              <p className="text-xs text-gray-500 lg:text-sm"><span className="lg:hidden">{safeT('deliveries.banners.averageHumidity', 'Humid')}</span><span className="hidden lg:inline">{safeT('deliveries.banners.averageHumidity', 'Average humidity')}</span></p>
              <p className="text-sm lg:text-base font-semibold text-purple-600">{stats.moyenneHumidite.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Livraisons Table */}
        {livraisons.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">📅 {safeT('deliveries.table.date', 'Date')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">🆔 ID Local</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">🌾 {safeT('deliveries.table.parcel', 'Parcel')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">🌾 {safeT('deliveries.table.product', 'Product')}</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">📏 {safeT('deliveries.table.dryWeight', 'Dry weight')}</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">⚖️ {safeT('deliveries.table.grossWeight', 'Gross weight')}</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">💧 {safeT('deliveries.table.humidity', 'Humidity')} (%)</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">⚡ {safeT('deliveries.table.yield', 'Yield')} (t/ha)</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">🚛 {safeT('deliveries.table.driver', 'Driver')}</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">🔄 {safeT('deliveries.table.operation', 'Type')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {livraisons.map((livraison, index) => {
                    
                    return (
                      <tr 
                        key={livraison.id} 
                        className={`hover:bg-blue-50 ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="text-sm font-medium">{new Date(livraison.date_pesee).toLocaleDateString('fr-FR')}</div>
                            <div className="text-xs text-gray-500">{new Date(livraison.date_pesee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {livraison.local_id || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {editingRow === livraison.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEdit(livraison.id)
                                  } else if (e.key === 'Escape') {
                                    cancelEditing()
                                  }
                                }}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                                disabled={updating}
                              />
                              <button
                                onClick={() => saveEdit(livraison.id)}
                                disabled={updating}
                                className="text-green-600 hover:text-green-800 disabled:opacity-50"
                                title={safeT('common.save', 'Save')}
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={updating}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                                title={safeT('common.cancel', 'Cancel')}
                              >
                                ✗
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group">
                              <span>
                                {livraison.parcelle === 'Autres' ? safeT('common.other', 'Others') : (livraison.parcelle || safeT('common.other', 'Others'))}
                              </span>
                              <button
                                onClick={() => startEditing(livraison.id, livraison.parcelle)}
                                className="opacity-0 group-hover:opacity-100 ml-2 text-blue-600 hover:text-blue-800 transition-opacity"
                                title={safeT('common.edit', 'Edit')}
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getProductName(livraison.produit_local_id, safeT)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-green-600">
                          {(livraison.poids_sec || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-blue-600">
                          {(livraison.poids_brut || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center text-blue-600">
                          {livraison.humidite ? livraison.humidite.toFixed(1) : '0.0'}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center text-purple-600">
                          {formatRendement(calculateRendement(livraison.poids_sec || 0, livraison.parcelle || safeT('common.other', 'Others')), safeT)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {livraison.chauffeur || safeT('common.notAvailable', 'N/A')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            livraison.type_operation === 'entree' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {livraison.type_operation === 'entree' ? '📥 ' + safeT('deliveries.operations.entree', 'Entry') : '📤 ' + safeT('deliveries.operations.sortie', 'Exit')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {livraisons.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-500">
                {safeT('deliveries.noDeliveriesFound', 'No deliveries match your search criteria.')}
              </div>
            )}
            {loading && (
              <div className="p-8 text-center text-gray-500">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span>{safeT('common.loading', 'Loading...')}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{safeT('deliveries.noDeliveries', 'No deliveries')}</h3>
            <p className="text-gray-600">{safeT('deliveries.noDeliveriesForAccount', 'No deliveries found for your account.')}</p>
          </div>
        )}

        {/* Per-Parcelle Statistics - matching C# UI style */}
        {Object.keys(statsParcelle).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-blue-600 text-white">
              <h3 className="text-lg font-semibold">📊 {safeT('deliveries.summary.parcelAnalysis', 'Analysis by parcel')}</h3>
              <p className="text-blue-100 text-sm">{safeT('deliveries.summary.dataDistributionByParcel', 'Data distribution by parcel')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">🌾 {safeT('deliveries.table.parcel', 'Parcel')}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">📐 {safeT('dashboard.parcels.surface', 'Surface')} (ha)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">📦 {safeT('deliveries.banners.totalDeliveries', 'Deliveries')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">📏 {safeT('deliveries.table.dryWeight', 'Dry weight')} (kg)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">⚖️ {safeT('deliveries.table.grossWeight', 'Gross weight')} (kg)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">⚡ {safeT('deliveries.table.yield', 'Yield')} (t/ha)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">💧 {safeT('deliveries.table.humidity', 'Humidity')} (%)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(statsParcelle).map(([parcelle, stats], index) => (
                    <tr key={parcelle} className={`hover:bg-blue-50 ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {parcelle === 'Autres' ? safeT('common.other', 'Others') : parcelle}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-orange-600">
                        {parcelles[parcelle]?.surface_hectares ? parcelles[parcelle].surface_hectares.toFixed(1) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-blue-600">
                        {stats.livraisons}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-green-600">
                        {stats.poidsSec.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-blue-600">
                        {stats.poidsBrut.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center text-purple-600">
                        {formatRendement(stats.rendement, safeT, !parcelles[parcelle]?.surface_hectares)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center text-blue-600">
                        {stats.humidite.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Advanced D3.js Charts Section */}
        {livraisons.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 {safeT('dashboard.charts.title')}</h3>
            <D3Charts
              livraisons={livraisons}
              parcelles={Object.entries(parcelles).map(([nom_parcelle, data]) => ({
                id: 0, // Not used in D3Charts
                local_id: 0, // Not used in D3Charts
                client_local_id: client.local_id,
                nom_parcelle,
                surface_hectares: data.surface_hectares || 0,
                actif: true, // We only show active parcelles
                last_modified: '', // Not used in D3Charts
                created_at: '' // Not used in D3Charts
              }))}
              t={safeT}
            />
          </div>
        )}
    </ResponsiveLayout>
  )
}