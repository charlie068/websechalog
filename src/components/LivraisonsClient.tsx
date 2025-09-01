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

export default function LivraisonsClient({ client, initialLivraisons }: LivraisonsClientProps) {
  const searchParams = useSearchParams()
  const [livraisons, setLivraisons] = useState<Livraison[]>(initialLivraisons)
  const [loading, setLoading] = useState(false)
  
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
    coutSechage: 0,
    coutStockage: 0
  })

  // Set initial filters from URL params
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
  }, [searchParams])

  // Fetch filtered data
  const fetchFilteredData = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('livraisons')
        .select('*')
        .eq('client_local_id', client.local_id)

      if (dateDebut) query = query.gte('date_livraison', dateDebut)
      if (dateFin) query = query.lte('date_livraison', dateFin)
      if (parcelleFilter) query = query.eq('parcelle', parcelleFilter)
      if (typeFilter) query = query.eq('type_operation', typeFilter)
      
      const { data } = await query.order('date_livraison', { ascending: false })
      
      if (data) {
        let filtered = data as Livraison[]
        
        // Apply text search if provided
        if (searchTerm) {
          filtered = filtered.filter(liv => 
            liv.nom_parcelle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            liv.numero_bl?.toString().includes(searchTerm) ||
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
          ? (humiditeValues.reduce((sum, h) => sum + h, 0) / humiditeValues.length) / 10
          : 0

        // Estimate costs
        const coutSechage = (totalPoidsSec / 1000) * 15 // 15€/tonne
        const coutStockage = (totalPoidsSec / 1000) * 8 // 8€/tonne

        setStats({
          totalLivraisons: filtered.length,
          totalPoidsSec,
          totalPoidsBrut,
          moyenneHumidite,
          coutSechage,
          coutStockage
        })
      }
    } catch (error) {
      console.error('Error fetching filtered data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch when filters change
  useEffect(() => {
    if (dateDebut && dateFin) {
      fetchFilteredData()
    }
  }, [dateDebut, dateFin, parcelleFilter, typeFilter, searchTerm])

  // Get unique parcelles for filter dropdown
  const uniqueParcelles = Array.from(new Set(initialLivraisons.map(liv => liv.nom_parcelle).filter(Boolean)))

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
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
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
              <p className="text-xs font-semibold text-orange-100 uppercase tracking-wide">SÉCHAGE (€)</p>
              <p className="text-2xl font-bold">{stats.coutSechage.toFixed(0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-orange-100 uppercase tracking-wide">STOCKAGE (€)</p>
              <p className="text-2xl font-bold">{stats.coutStockage.toFixed(0)}</p>
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
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">📋 N° BL</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">🌾 Parcelle</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">📦 Produit</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">📏 Poids Sec (kg)</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">⚖️ Poids Brut (kg)</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">💧 Humidité (%)</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">🚛 Chauffeur</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">🔄 Type</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">🔥 Séchage (€)</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">🏪 Stockage (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {livraisons.map((livraison, index) => {
                    const coutSechageUnitaire = (livraison.poids_sec || 0) / 1000 * 15
                    const coutStockageUnitaire = (livraison.poids_sec || 0) / 1000 * 8
                    
                    return (
                      <tr 
                        key={livraison.id} 
                        className={`hover:bg-blue-50 ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(livraison.date_livraison).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {livraison.numero_bl || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {livraison.nom_parcelle || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {livraison.nom_produit || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-green-600">
                          {(livraison.poids_sec || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-blue-600">
                          {(livraison.poids_brut || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center text-blue-600">
                          {livraison.humidite ? (livraison.humidite / 10).toFixed(1) : '0.0'}%
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-orange-600">
                          {coutSechageUnitaire.toFixed(2)}€
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-purple-600">
                          {coutStockageUnitaire.toFixed(2)}€
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {livraisons.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span>Chargement...</span>
                  </div>
                ) : (
                  'Aucune livraison ne correspond à vos critères de recherche.'
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune livraison</h3>
            <p className="text-gray-600">Aucune livraison trouvée pour votre compte.</p>
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