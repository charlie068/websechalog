'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Parcelle, Livraison } from '@/lib/supabase'
import Link from 'next/link'

interface ParcelleAnalysisCardProps {
  parcelle: Parcelle
  clientId: number
}

interface ParcelleStats {
  totalLivraisons: number
  totalPoidsSec: number
  totalPoidsBrut: number
  derniereLivraison: string | null
  moyenneHumidite: number
}

export default function ParcelleAnalysisCard({ parcelle, clientId }: ParcelleAnalysisCardProps) {
  const [stats, setStats] = useState<ParcelleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchParcelleStats() {
      try {
        const { data: livraisons } = await supabase
          .from('livraisons')
          .select('*')
          .eq('client_local_id', clientId)
          .eq('parcelle', parcelle.nom_parcelle)

        if (livraisons) {
          const totalLivraisons = livraisons.length
          const totalPoidsSec = livraisons.reduce((sum: number, liv: any) => sum + (liv.poids_sec || 0), 0)
          const totalPoidsBrut = livraisons.reduce((sum: number, liv: any) => sum + (liv.poids_brut || 0), 0)
          
          const derniereLivraison = livraisons.length > 0 
            ? livraisons.sort((a: any, b: any) => new Date(b.date_livraison).getTime() - new Date(a.date_livraison).getTime())[0].date_livraison
            : null

          const humiditeValues = livraisons
            .map((liv: any) => liv.humidite)
            .filter((h: any) => h !== null && h !== undefined)
          
          const moyenneHumidite = humiditeValues.length > 0
            ? (humiditeValues.reduce((sum: number, h: number) => sum + h, 0) / humiditeValues.length) / 10
            : 0

          setStats({
            totalLivraisons,
            totalPoidsSec,
            totalPoidsBrut,
            derniereLivraison,
            moyenneHumidite
          })
        }
      } catch (error) {
        console.error('Error fetching parcelle stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchParcelleStats()
  }, [parcelle.local_id, clientId])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            🌾 {parcelle.nom_parcelle}
          </h3>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {parcelle.surface_hectares} ha
          </span>
        </div>

      {stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalLivraisons}
              </div>
              <div className="text-sm text-gray-600">Livraisons</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">
                {stats.totalPoidsSec.toFixed(0)} kg
              </div>
              <div className="text-sm text-gray-600">Poids sec total</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-yellow-50 rounded">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.totalPoidsBrut.toFixed(0)} kg
              </div>
              <div className="text-sm text-gray-600">Poids brut total</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">
                {stats.moyenneHumidite.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Humidité moyenne</div>
            </div>
          </div>

          {stats.derniereLivraison && (
            <div className="text-sm text-gray-600 text-center">
              Dernière livraison: {new Date(stats.derniereLivraison).toLocaleDateString('fr-FR')}
            </div>
          )}

          {/* Navigation to detailed view */}
          <div className="pt-4 border-t border-gray-200">
            <Link
              href={`/livraisons?parcelle=${encodeURIComponent(parcelle.nom_parcelle)}`}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <span>📋</span>
              <span>Voir les détails</span>
            </Link>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}