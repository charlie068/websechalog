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
    rendementGlobal: null as number | null, // tonnes per hectare
    surfaceTotale: 0 // total hectares
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
        .gte('date_pesee', dateDebut)
        .lte('date_pesee', dateFin)
        .order('date_pesee', { ascending: false })

      if (livraisons) {
        setFilteredLivraisons(livraisons as Livraison[])
        
        // Calculate total stats
        const totalPoidsSec = livraisons.reduce((sum, liv) => sum + (liv.poids_sec || 0), 0)
        const totalPoidsBrut = livraisons.reduce((sum, liv) => sum + (liv.poids_brut || 0), 0)
        
        const humiditeValues = livraisons
          .map(liv => liv.humidite)
          .filter(h => h !== null && h !== undefined)
        
        const moyenneHumidite = humiditeValues.length > 0
          ? (humiditeValues.reduce((sum, h) => sum + h, 0) / humiditeValues.length)
          : 0

        // Calculate rendement (yield per hectare)
        const surfaceTotale = initialParcelles.reduce((sum, p) => sum + (p.surface_hectares || 0), 0)
        const totalPoidsSecTonnes = totalPoidsSec / 1000 // Convert to tonnes
        const rendementGlobal = surfaceTotale > 0 ? totalPoidsSecTonnes / surfaceTotale : null


        setTotalStats({
          totalPoidsSec,
          totalPoidsBrut,
          moyenneHumidite,
          rendementGlobal,
          surfaceTotale
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

          </div>

          {/* Rendement Information */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🌾</span>
              Rendement agricole
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-500">Surface totale</p>
                <p className="text-3xl font-bold text-green-600">{totalStats.surfaceTotale.toFixed(1)} ha</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Production totale</p>
                <p className="text-3xl font-bold text-blue-600">{(totalStats.totalPoidsSec / 1000).toFixed(1)} t</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Rendement global</p>
                <p className="text-3xl font-bold text-yellow-600">{totalStats.rendementGlobal !== null ? totalStats.rendementGlobal.toFixed(1) + ' t/ha' : 'N/A'}</p>
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

        </div>
      </main>
    </div>
  )
}