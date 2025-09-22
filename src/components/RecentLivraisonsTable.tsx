'use client'

import { Livraison } from '@/lib/supabase'
import Link from 'next/link'
import { useTranslations } from '@/hooks/useTranslations'

interface RecentLivraisonsTableProps {
  livraisons: Livraison[]
}

export default function RecentLivraisonsTable({ livraisons }: RecentLivraisonsTableProps) {
  const { t, loading: translationsLoading, language } = useTranslations()

  // Safe translation function
  const safeT = (key: string, fallback?: string): string => {
    if (translationsLoading || typeof t !== 'function') {
      return fallback || key
    }
    return t(key, fallback)
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                {safeT('deliveries.table.date', 'Date')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                {safeT('deliveries.table.parcel', 'Parcel')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                {safeT('deliveries.table.dryWeight', 'Dry weight')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                {safeT('deliveries.table.grossWeight', 'Gross weight')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                {safeT('deliveries.table.humidity', 'Humidity')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                {safeT('deliveries.table.operation', 'Type')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {livraisons.map((livraison) => (
              <tr key={livraison.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="text-sm font-medium">{new Date(livraison.date_pesee).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}</div>
                    <div className="text-xs text-gray-500">{new Date(livraison.date_pesee).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.parcelle === 'Autres' ? safeT('common.other', 'Other') : (livraison.parcelle || safeT('common.other', 'Other'))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.poids_sec?.toFixed(0) || 0} kg
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.poids_brut?.toFixed(0) || 0} kg
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.humidite ? livraison.humidite.toFixed(1) : 0}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    livraison.type_operation === 'entree' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {livraison.type_operation === 'entree' ? safeT('deliveries.operations.entree', 'Entry') : safeT('deliveries.operations.sortie', 'Exit')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}