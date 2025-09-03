'use client'

import { Livraison } from '@/lib/supabase'
import Link from 'next/link'

interface RecentLivraisonsTableProps {
  livraisons: Livraison[]
}

export default function RecentLivraisonsTable({ livraisons }: RecentLivraisonsTableProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Parcelle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Poids sec
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Poids brut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Humidité
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {livraisons.map((livraison) => (
              <tr key={livraison.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="text-sm font-medium">{new Date(livraison.date_pesee).toLocaleDateString('fr-FR')}</div>
                    <div className="text-xs text-gray-500">{new Date(livraison.date_pesee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.parcelle || 'Autres'}
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
                    {livraison.type_operation === 'entree' ? 'Entrée' : 'Sortie'}
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