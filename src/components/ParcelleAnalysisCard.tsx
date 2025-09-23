'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Parcelle, Livraison } from '@/lib/supabase'
import Link from 'next/link'
import { useTranslations } from '@/hooks/useTranslations'

interface ParcelleAnalysisCardProps {
  parcelle: Parcelle
  clientId: number
  dateDebut?: string
  dateFin?: string
}

interface ParcelleStats {
  totalLivraisons: number
  totalPoidsSec: number
  totalPoidsBrut: number
  derniereLivraison: string | null
  moyenneHumidite: number
  rendement: number | null // tonnes per hectare, null when no data
}

export default function ParcelleAnalysisCard({ parcelle, clientId, dateDebut, dateFin }: ParcelleAnalysisCardProps) {
  const { t, loading: translationsLoading, language } = useTranslations()

  // Safe translation function
  const safeT = (key: string, fallback?: string): string => {
    if (translationsLoading || typeof t !== 'function') {
      return fallback || key
    }
    return t(key, fallback)
  }

  const [stats, setStats] = useState<ParcelleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchParcelleStats() {
      try {
        let query = supabase
          .from('livraisons')
          .select('*')
          .eq('client_local_id', clientId)
          .eq('parcelle', parcelle.nom_parcelle)

        // Add date filtering if provided
        if (dateDebut) {
          query = query.gte('date_pesee', dateDebut + 'T00:00:00.000Z')
        }
        if (dateFin) {
          query = query.lte('date_pesee', dateFin + 'T23:59:59.999Z')
        }

        const { data: livraisons } = await query

        if (livraisons) {
          const totalLivraisons = livraisons.length

          // If no livraisons in the date range, don't show the card
          if (totalLivraisons === 0) {
            setStats(null)
            setIsLoading(false)
            return
          }

          // Filter for entry operations only (for yield calculation)
          const entreeLivraisons = livraisons.filter((liv: any) => liv.type_operation === 'entree')

          const totalPoidsSec = livraisons.reduce((sum: number, liv: any) => sum + (liv.poids_sec || 0), 0)
          const totalPoidsBrut = livraisons.reduce((sum: number, liv: any) => sum + (liv.poids_brut || 0), 0)

          // For yield calculation, use only entry operations
          const totalPoidsSecEntrees = entreeLivraisons.reduce((sum: number, liv: any) => sum + (liv.poids_sec || 0), 0)
          
          const derniereLivraison = livraisons.length > 0 
            ? livraisons.sort((a: any, b: any) => new Date(b.date_pesee).getTime() - new Date(a.date_pesee).getTime())[0].date_pesee
            : null

          // Calculate weighted average humidity (weighted by gross weight)
          const livraisonsWithHumidite = livraisons.filter((liv: any) => 
            liv.humidite !== null && liv.humidite !== undefined && liv.poids_brut
          )
          
          let totalWeightedHumidite = 0
          let totalWeightForHumidite = 0
          
          livraisonsWithHumidite.forEach((liv: any) => {
            const weight = liv.poids_brut || 0
            totalWeightedHumidite += liv.humidite * weight
            totalWeightForHumidite += weight
          })
          
          const moyenneHumidite = totalWeightForHumidite > 0 
            ? totalWeightedHumidite / totalWeightForHumidite 
            : 0

          // Calculate rendement (yield per hectare) - use only entry operations
          const totalPoidsSecTonnesEntrees = totalPoidsSecEntrees / 1000 // Convert to tonnes
          // Check if surface area is available for yield calculation
          const hasSurfaceArea = parcelle.surface_hectares !== null && parcelle.surface_hectares !== undefined && parcelle.surface_hectares > 0
          const rendement = (hasSurfaceArea && totalPoidsSecEntrees > 0 && entreeLivraisons.length > 0)
            ? totalPoidsSecTonnesEntrees / parcelle.surface_hectares
            : null



          setStats({
            totalLivraisons,
            totalPoidsSec,
            totalPoidsBrut,
            derniereLivraison,
            moyenneHumidite,
            rendement
          })
        }
      } catch (error) {
      } finally {
        setIsLoading(false)
      }
    }

    fetchParcelleStats()
  }, [parcelle.local_id, clientId, dateDebut, dateFin])

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

  // Don't render the card if no livraisons in the selected date range
  if (!stats) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200">
      <div className="p-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            🌾 {parcelle.nom_parcelle === 'Autres' ? safeT('common.other', 'Other') : parcelle.nom_parcelle}
          </h3>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {parcelle.surface_hectares} ha
          </span>
        </div>

      {stats && (
        <div className="space-y-2 lg:space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:gap-4">
            <div className="text-center p-2 lg:p-3 bg-blue-50 rounded">
              <div className="text-base lg:text-2xl font-semibold lg:font-bold text-blue-600">
                {stats.totalLivraisons}
              </div>
              <div className="text-xs lg:text-sm text-gray-600">{safeT('deliveries.banners.totalDeliveries', 'Deliveries')}</div>
            </div>
            <div className="text-center p-2 lg:p-3 bg-green-50 rounded">
              <div className="text-base lg:text-2xl font-semibold lg:font-bold text-green-600">
                {stats.totalPoidsSec.toFixed(0)} kg
              </div>
              <div className="text-xs lg:text-sm text-gray-600">{safeT('deliveries.banners.totalWeight', 'Total dry weight')}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:gap-4">
            <div className="text-center p-2 lg:p-3 bg-blue-50 rounded">
              <div className="text-base lg:text-2xl font-semibold lg:font-bold text-blue-600">
                {parcelle.surface_hectares ? `${parcelle.surface_hectares.toFixed(2)} ha` : 'ND'}
              </div>
              <div className="text-xs lg:text-sm text-gray-600">📐 {safeT('dashboard.parcels.surface', 'Surface')}</div>
            </div>
            <div className="text-center p-2 lg:p-3 bg-purple-50 rounded">
              <div className="text-base lg:text-2xl font-semibold lg:font-bold text-purple-600">
                {stats.moyenneHumidite.toFixed(1)}%
              </div>
              <div className="text-xs lg:text-sm text-gray-600">{safeT('deliveries.banners.averageHumidity', 'Average humidity')}</div>
            </div>
          </div>

          {/* Rendement section */}
          <div className="bg-orange-50 rounded p-2 lg:p-3 text-center">
            <div className="text-base lg:text-2xl font-semibold lg:font-bold text-orange-600">
              {stats.rendement !== null ? `${stats.rendement.toFixed(2)} t/ha` :
                parcelle.surface_hectares === null || parcelle.surface_hectares === undefined || parcelle.surface_hectares === 0
                  ? safeT('dashboard.parcels.noSurfaceArea', 'No surface area')
                  : safeT('common.notAvailable', 'N/A')}
            </div>
            <div className="text-xs lg:text-sm text-gray-600">🌾 {safeT('dashboard.parcels.yield', 'Yield')}</div>
          </div>

          {stats.derniereLivraison && (
            <div className="text-sm text-gray-600 text-center">
              {safeT('deliveries.banners.lastDelivery', 'Last delivery')}: {new Date(stats.derniereLivraison).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')} {language === 'fr' ? 'à' : 'at'} {new Date(stats.derniereLivraison).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Navigation to detailed view */}
          <div className="pt-4 border-t border-gray-200">
            <Link
              href={`/livraisons?parcelle=${encodeURIComponent(parcelle.nom_parcelle)}`}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <span>📋</span>
              <span>{safeT('dashboard.actions.viewDetails', 'View details')}</span>
            </Link>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}