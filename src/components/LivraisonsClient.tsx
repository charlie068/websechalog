'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Client, Livraison } from '@/lib/supabase'
import D3Charts from './D3Charts'
import Link from 'next/link'

interface LivraisonsClientProps {
  client: Client
  initialLivraisons: Livraison[]
}

// Helper function to convert product ID to product name
const getProductName = (productId: number | null | undefined): string => {
  if (!productId) return 'N/A'
  
  const productMap: { [key: number]: string } = {
    1: 'Maïs',
    2: 'Blé',
    3: 'Orge',
    4: 'Soja',
    5: 'Tournesol',
    6: 'Colza'
  }
  
  return productMap[productId] || `Produit ${productId}`
}

// Helper function to format rendement
const formatRendement = (rendement: number | null): string => {
  if (rendement === null || rendement === 0) return 'N/A'
  return rendement.toFixed(2)
}

export default function LivraisonsClient({ client, initialLivraisons }: LivraisonsClientProps) {
  const searchParams = useSearchParams()
  const [livraisons, setLivraisons] = useState<Livraison[]>(initialLivraisons)
  const [parcelles, setParcelles] = useState<{[name: string]: {surface_hectares?: number}}>({})
  const [loading, setLoading] = useState(false)
  
  console.log('LivraisonsClient render:', { 
    initialLivraisons: initialLivraisons.length, 
    currentLivraisons: livraisons.length,
    loading 
  })
  
  // Filter states
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [parcelleFilter, setParcelleFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Stats
  const [stats, setStats] = useState({
    totalLivraisons: 0,
    totalPoidsSec: 0,
    totalPoidsBrut: 0,
    moyenneHumidite: 0,
    moyenneRendement: 0
  })

  // Per-parcelle stats
  const [statsParcelle, setStatsParcelle] = useState<{[parcelle: string]: {
    livraisons: number,
    poidsSec: number,
    poidsBrut: number,
    rendement: number | null,
    humidite: number
  }}>({})

  // Set initial filters from URL params and fetch parcelles data
  useEffect(() => {
    const parcelle = searchParams.get('parcelle')
    const type = searchParams.get('type')
    
    if (parcelle) setParcelleFilter(parcelle)
    if (type) setTypeFilter(type)
    
    // Set default dates (last 90 days)
    const today = new Date()
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
    
    setDateDebut(ninetyDaysAgo.toISOString().split('T')[0])
    setDateFin(today.toISOString().split('T')[0])

    // Fetch parcelles data for surface area calculations
    fetchParcelles()
  }, [searchParams])

  const fetchParcelles = async () => {
    try {
      const { data: parcellesData } = await supabase
        .from('parcelles')
        .select('nom_parcelle, surface_hectares')
        .eq('client_local_id', client.local_id)

      const parcelleMap: {[name: string]: {surface_hectares?: number}} = {}
      
      // Add "Autres" parcelle (may not be in parcelles table)
      parcelleMap['Autres'] = { surface_hectares: undefined }
      
      parcellesData?.forEach(p => {
        if (p.nom_parcelle) {
          parcelleMap[p.nom_parcelle] = { surface_hectares: p.surface_hectares }
        }
      })

      setParcelles(parcelleMap)
    } catch (error) {
      console.error('Error fetching parcelles:', error)
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
    console.log('fetchFilteredData called with filters:', { dateDebut, dateFin, parcelleFilter, typeFilter })
    
    // Don't fetch if we don't have required date filters
    if (!dateDebut || !dateFin) {
      console.log('Skipping fetch - missing date filters')
      return
    }
    
    setLoading(true)
    try {
      let query = supabase
        .from('livraisons')
        .select('*')
        .eq('client_local_id', client.local_id)

      if (dateDebut) query = query.gte('date_pesee', dateDebut)
      if (dateFin) query = query.lte('date_pesee', dateFin)
      if (parcelleFilter) query = query.eq('parcelle', parcelleFilter)
      if (typeFilter) query = query.eq('type_operation', typeFilter)
      
      const { data, error } = await query.order('date_pesee', { ascending: false })
      
      console.log('fetchFilteredData result:', { data: data?.length, error })
      
      if (data) {
        let filtered = data as Livraison[]
        
        // Apply text search if provided
        if (searchTerm) {
          filtered = filtered.filter(liv => 
            liv.parcelle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            liv.chauffeur?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        }
        
        setLivraisons(filtered)
        
        // Calculate stats
        const totalPoidsSec = filtered.reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
        const totalPoidsBrut = filtered.reduce((sum, liv) => sum + (liv.poids_brut || 0), 0)
        
        const humiditeValues = filtered
          .map(liv => liv.humidite)
          .filter(h => h !== null && h !== undefined)
        
        const moyenneHumidite = humiditeValues.length > 0
          ? (humiditeValues.reduce((sum, h) => sum + h, 0) / humiditeValues.length)
          : 0

        // Calculate weighted average rendement considering surface areas
        let totalRendementWeight = 0
        let totalWeight = 0
        
        filtered.forEach(liv => {
          const parcelleName = liv.parcelle || 'Autres'
          const surface = parcelles[parcelleName]?.surface_hectares
          if (surface && surface > 0 && liv.poids_sec) {
            const rendement = (liv.poids_sec / 1000) / surface // t/ha
            totalRendementWeight += rendement * liv.poids_sec // weighted by poids_sec
            totalWeight += liv.poids_sec
          }
        })

        const moyenneRendement = totalWeight > 0 ? totalRendementWeight / totalWeight : null


        setStats({
          totalLivraisons: filtered.length,
          totalPoidsSec,
          totalPoidsBrut,
          moyenneHumidite,
          moyenneRendement
        })

        // Calculate per-parcelle stats
        const parcelleStats: {[parcelle: string]: {livraisons: number, poidsSec: number, poidsBrut: number, rendement: number, humidite: number}} = {}
        
        filtered.forEach(liv => {
          const parcelleName = liv.parcelle || 'Autres'
          if (!parcelleStats[parcelleName]) {
            parcelleStats[parcelleName] = {
              livraisons: 0,
              poidsSec: 0,
              poidsBrut: 0,
              rendement: null,
              humidite: 0
            }
          }
          parcelleStats[parcelleName].livraisons++
          parcelleStats[parcelleName].poidsSec += liv.poids_sec || 0
          parcelleStats[parcelleName].poidsBrut += liv.poids_brut || 0
          if (liv.humidite) parcelleStats[parcelleName].humidite += liv.humidite
        })

        // Calculate averages for each parcelle, including proper rendement calculation
        Object.keys(parcelleStats).forEach(parcelle => {
          const stats = parcelleStats[parcelle]
          stats.humidite = stats.livraisons > 0 ? stats.humidite / stats.livraisons : 0
          
          // Calculate rendement in t/ha
          const surface = parcelles[parcelle]?.surface_hectares
          if (surface && surface > 0 && stats.poidsSec > 0) {
            stats.rendement = (stats.poidsSec / 1000) / surface // t/ha
          } else {
            stats.rendement = null
          }
        })

        setStatsParcelle(parcelleStats)
      }
    } catch (error) {
      console.error('Error fetching filtered data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch when filters change (but not on initial render if we have initial data)
  useEffect(() => {
    console.log('Filter change useEffect triggered:', { dateDebut, dateFin, parcelleFilter, typeFilter, searchTerm })
    
    // Only fetch if we have meaningful filter changes or if dates are set
    if (dateDebut && dateFin && (parcelleFilter || typeFilter || searchTerm)) {
      console.log('Calling fetchFilteredData due to specific filter change')
      fetchFilteredData()
    } else if (dateDebut && dateFin && !parcelleFilter && !typeFilter && !searchTerm) {
      console.log('Using date-based fetch for general date range')
      fetchFilteredData()
    }
  }, [dateDebut, dateFin, parcelleFilter, typeFilter, searchTerm, client.local_id])

  // Get unique parcelles for filter dropdown
  const uniqueParcelles = Array.from(new Set(initialLivraisons.map(liv => liv.parcelle).filter(Boolean)))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section - matching C# style */}
      <div className="bg-blue-600 text-white py-6 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <h1 className="text-2xl font-bold mb-2">📦 LIVRAISONS DÉTAILLÉES</h1>
              <p className="text-blue-100">Suivi complet des entrées et sorties par parcelle</p>
            </div>
            <Link
              href="/dashboard"
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
            >
              <span>🏠</span>
              <span>Tableau de bord</span>
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Filter Section - matching C# style */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
            {/* Date Filters */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 Période:
              </label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-500 self-center text-sm">au</span>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Parcelle Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🌾 Parcelle:
              </label>
              <select
                value={parcelleFilter}
                onChange={(e) => setParcelleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Toutes les parcelles</option>
                {uniqueParcelles.map(parcelle => (
                  <option key={parcelle} value={parcelle}>{parcelle}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📋 Type:
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tous les types</option>
                <option value="entree">📥 Entrées</option>
                <option value="sortie">📤 Sorties</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔍 Recherche:
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
              <span>{loading ? 'Actualisation...' : 'Actualiser'}</span>
            </button>
            
            <Link
              href="/dashboard"
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-md font-semibold flex items-center space-x-2"
            >
              <span>🌾</span>
              <span>Analyse Parcelle</span>
            </Link>
          </div>
        </div>

        {/* Summary Statistics - matching C# style */}
        <div className="bg-orange-500 text-white rounded-lg p-6 mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-7 gap-6">
            <div className="text-center">
              <p className="text-xs font-semibold text-orange-100 uppercase tracking-wide">LIVRAISONS</p>
              <p className="text-2xl font-bold">{stats.totalLivraisons}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-orange-100 uppercase tracking-wide">POIDS SEC (KG)</p>
              <p className="text-2xl font-bold">{stats.totalPoidsSec.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-orange-100 uppercase tracking-wide">POIDS BRUT (KG)</p>
              <p className="text-2xl font-bold">{stats.totalPoidsBrut.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-orange-100 uppercase tracking-wide">HUMID. MOY. (%)</p>
              <p className="text-2xl font-bold">{stats.moyenneHumidite.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-orange-100 uppercase tracking-wide">REND. MOY. (t/ha)</p>
              <p className="text-2xl font-bold">{formatRendement(stats.moyenneRendement)}</p>
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
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">📅 Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">🆔 ID Local</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">🌾 Parcelle</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">🌾 Produit</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">📏 Poids Sec (kg)</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">⚖️ Poids Brut (kg)</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">💧 Humidité (%)</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">⚡ Rendement (t/ha)</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">🚛 Chauffeur</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">🔄 Type</th>
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
                          {livraison.parcelle || 'Autres'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getProductName(livraison.produit_local_id)}
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
                          {formatRendement(calculateRendement(livraison.poids_sec || 0, livraison.parcelle || 'Autres'))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {livraison.chauffeur || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            livraison.type_operation === 'entree' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {livraison.type_operation === 'entree' ? '📥 Entrée' : '📤 Sortie'}
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
                Aucune livraison ne correspond à vos critères de recherche.
              </div>
            )}
            {loading && (
              <div className="p-8 text-center text-gray-500">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span>Chargement...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune livraison</h3>
            <p className="text-gray-600">Aucune livraison trouvée pour votre compte.</p>
          </div>
        )}

        {/* Per-Parcelle Statistics - matching C# UI style */}
        {Object.keys(statsParcelle).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-blue-600 text-white">
              <h3 className="text-lg font-semibold">📊 Analyse par Parcelle</h3>
              <p className="text-blue-100 text-sm">Répartition des données par parcelle</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">🌾 Parcelle</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">📦 Livraisons</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">📏 Poids Sec (kg)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">⚖️ Poids Brut (kg)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">⚡ Rendement (t/ha)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">💧 Humidité (%)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(statsParcelle).map(([parcelle, stats], index) => (
                    <tr key={parcelle} className={`hover:bg-blue-50 ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {parcelle}
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
                        {formatRendement(stats.rendement)}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Analyses graphiques avancées</h3>
            <D3Charts livraisons={livraisons} />
          </div>
        )}

        {/* Quick Navigation */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/dashboard"
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-6 flex items-center space-x-3 transition-colors"
          >
            <div className="bg-blue-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Tableau de bord</h3>
              <p className="text-sm text-gray-500">Vue d'ensemble</p>
            </div>
          </Link>

          <button
            onClick={() => {
              setParcelleFilter('')
              setTypeFilter('')
              setSearchTerm('')
              const today = new Date()
              const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
              setDateDebut(thirtyDaysAgo.toISOString().split('T')[0])
              setDateFin(today.toISOString().split('T')[0])
            }}
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-6 flex items-center space-x-3 transition-colors"
          >
            <div className="bg-gray-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Réinitialiser</h3>
              <p className="text-sm text-gray-500">Effacer les filtres</p>
            </div>
          </button>

          <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center space-x-3">
            <div className="bg-green-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2a1 1 0 01-1 1H6a1 1 0 01-1-1v-2h8z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Exporter Excel</h3>
              <p className="text-sm text-gray-500">Bientôt disponible</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}