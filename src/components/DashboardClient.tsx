'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Client, Parcelle, Livraison } from '@/lib/supabase'
import ParcelleAnalysisCard from './ParcelleAnalysisCard'
import RecentLivraisonsTable from './RecentLivraisonsTable'
import D3Charts from './D3Charts'
import Link from 'next/link'

interface DashboardClientProps {
  client: Client
  initialParcelles: Parcelle[]
  initialLivraisons: Livraison[]
}

export default function DashboardClient({ client, initialParcelles, initialLivraisons }: DashboardClientProps) {
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filteredLivraisons, setFilteredLivraisons] = useState<Livraison[]>(initialLivraisons)
  const [totalStats, setTotalStats] = useState({
    totalPoidsSec: 0,
    totalPoidsBrut: 0,
    moyenneHumidite: 0,
    coutSechageTotal: 0,
    coutStockageTotal: 0
  })

  // Set default dates (last 30 days)
  useEffect(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    setDateDebut(thirtyDaysAgo.toISOString().split('T')[0])
    setDateFin(today.toISOString().split('T')[0])
  }, [])

  // Filter livraisons by date when filters change
  useEffect(() => {
    if (dateDebut && dateFin) {
      fetchFilteredData()
    }
  }, [dateDebut, dateFin])

  const fetchFilteredData = async () => {
    try {
      const { data: livraisons } = await supabase
        .from('livraisons')
        .select('*')
        .eq('client_local_id', client.local_id)
        .gte('date_livraison', dateDebut)
        .lte('date_livraison', dateFin)
        .order('date_livraison', { ascending: false })

      if (livraisons) {
        setFilteredLivraisons(livraisons as Livraison[])
        
        // Calculate total stats
        const totalPoidsSec = livraisons.reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
        const totalPoidsBrut = livraisons.reduce((sum, liv) => sum + (liv.poids_brut || 0), 0)
        
        const humiditeValues = livraisons
          .map(liv => liv.humidite)
          .filter(h => h !== null && h !== undefined)
        
        const moyenneHumidite = humiditeValues.length > 0
          ? (humiditeValues.reduce((sum, h) => sum + h, 0) / humiditeValues.length) / 10
          : 0

        // Estimate costs (simple calculation - can be enhanced with actual pricing data)
        const coutSechageTotal = (totalPoidsSec / 1000) * 15 // 15€/tonne estimate
        const coutStockageTotal = (totalPoidsSec / 1000) * 8 // 8€/tonne estimate

        setTotalStats({
          totalPoidsSec,
          totalPoidsBrut,
          moyenneHumidite,
          coutSechageTotal,
          coutStockageTotal
        })
      }
    } catch (error) {
      console.error('Error fetching filtered data:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Tableau de bord - {client.nom_client}
            </h1>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md text-sm font-medium text-gray-700"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Date Filter Section */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">📅 Période d'analyse</h2>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label htmlFor="dateDebut" className="block text-sm font-medium text-gray-700 mb-2">
                  Date de début
                </label>
                <input
                  type="date"
                  id="dateDebut"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="dateFin" className="block text-sm font-medium text-gray-700 mb-2">
                  Date de fin
                </label>
                <input
                  type="date"
                  id="dateFin"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => fetchFilteredData()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md font-medium"
              >
                Actualiser
              </button>
            </div>
          </div>

          {/* Enhanced Statistics Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500">Poids sec total</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(totalStats.totalPoidsSec / 1000).toFixed(1)} t
                  </p>
                </div>
                <div className="text-green-500">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500">Poids brut total</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(totalStats.totalPoidsBrut / 1000).toFixed(1)} t
                  </p>
                </div>
                <div className="text-blue-500">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500">Humidité moyenne</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {totalStats.moyenneHumidite.toFixed(1)}%
                  </p>
                </div>
                <div className="text-purple-500">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500">Coût total estimé</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {(totalStats.coutSechageTotal + totalStats.coutStockageTotal).toFixed(0)}€
                  </p>
                </div>
                <div className="text-orange-500">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Client Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Informations client
              </h2>
              <div className="space-y-2">
                <p><span className="font-medium">Email:</span> {client.email}</p>
                <p><span className="font-medium">Adresse:</span> {client.adresse_complete}</p>
                <p><span className="font-medium">Téléphone:</span> {client.phone || 'Non renseigné'}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Coûts détaillés
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">🔥 Séchage:</span>
                  <span className="font-medium text-orange-600">{totalStats.coutSechageTotal.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">🏪 Stockage:</span>
                  <span className="font-medium text-blue-600">{totalStats.coutStockageTotal.toFixed(2)}€</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Total:</span>
                    <span className="font-bold text-green-600">
                      {(totalStats.coutSechageTotal + totalStats.coutStockageTotal).toFixed(2)}€
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Parcelles Analysis with Navigation */}
          {initialParcelles && initialParcelles.length > 0 && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  🌾 Analyse par parcelle
                </h2>
                <Link
                  href="/livraisons"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Voir détails entrées/sorties →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {initialParcelles.map((parcelle) => (
                  <div key={parcelle.id} className="relative">
                    <ParcelleAnalysisCard
                      parcelle={parcelle}
                      clientId={client.local_id}
                    />
                    <div className="absolute top-4 right-4">
                      <Link
                        href={`/livraisons?parcelle=${encodeURIComponent(parcelle.nom_parcelle)}`}
                        className="bg-white/90 hover:bg-white text-indigo-600 p-2 rounded-full shadow-sm text-xs"
                        title="Voir les détails"
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
                  📦 Livraisons récentes ({filteredLivraisons.length})
                </h2>
                <Link
                  href="/livraisons"
                  className="text-indigo-600 hover:text-indigo-500 font-medium"
                >
                  Voir toutes les livraisons →
                </Link>
              </div>
              <RecentLivraisonsTable livraisons={filteredLivraisons.slice(0, 10)} />
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Actions rapides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link
                href="/livraisons"
                className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-6 flex items-center space-x-3 transition-colors"
              >
                <div className="bg-indigo-100 p-3 rounded-full">
                  <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 3a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Toutes les livraisons</h3>
                  <p className="text-sm text-gray-500">Voir l'historique complet</p>
                </div>
              </Link>

              <Link
                href={`/livraisons?type=entree`}
                className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-6 flex items-center space-x-3 transition-colors"
              >
                <div className="bg-green-100 p-3 rounded-full">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Entrées uniquement</h3>
                  <p className="text-sm text-gray-500">Réceptions de marchandises</p>
                </div>
              </Link>

              <Link
                href={`/livraisons?type=sortie`}
                className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-6 flex items-center space-x-3 transition-colors"
              >
                <div className="bg-blue-100 p-3 rounded-full">
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Sorties uniquement</h3>
                  <p className="text-sm text-gray-500">Expéditions de marchandises</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Parcelles Analysis Cards */}
          {initialParcelles && initialParcelles.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Analyse détaillée par parcelle</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {initialParcelles.map((parcelle) => (
                  <div key={parcelle.id} className="relative">
                    <ParcelleAnalysisCard
                      parcelle={parcelle}
                      clientId={client.local_id}
                    />
                    <div className="absolute top-4 right-4">
                      <Link
                        href={`/livraisons?parcelle=${encodeURIComponent(parcelle.nom_parcelle)}`}
                        className="bg-white/90 hover:bg-white text-indigo-600 p-2 rounded-full shadow-sm text-xs font-medium"
                        title={`Voir les détails de ${parcelle.nom_parcelle}`}
                      >
                        📊
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive D3.js Charts */}
          {filteredLivraisons && filteredLivraisons.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">📈 Analyses graphiques avancées</h3>
              <D3Charts livraisons={filteredLivraisons} />
            </div>
          )}

          {/* Enhanced Recent Livraisons Table */}
          {filteredLivraisons && filteredLivraisons.length > 0 && (
            <RecentLivraisonsTable livraisons={filteredLivraisons.slice(0, 10)} />
          )}
        </div>
      </main>
    </div>
  )
}