'use client'

import { useState, useMemo } from 'react'
import { Livraison } from '@/lib/types'

interface LivraisonsTableProps {
  livraisons: Livraison[]
}

export default function LivraisonsTable({ livraisons }: LivraisonsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<keyof Livraison>('date_livraison')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const filteredAndSortedLivraisons = useMemo(() => {
    let filtered = livraisons.filter(livraison => {
      const matchesSearch = !searchTerm || 
        livraison.nom_parcelle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        livraison.numero_bl?.toString().includes(searchTerm) ||
        livraison.chauffeur?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesType = typeFilter === 'all' || livraison.type_operation === typeFilter

      return matchesSearch && matchesType
    })

    filtered.sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1
      
      let comparison = 0
      if (aValue < bValue) comparison = -1
      if (aValue > bValue) comparison = 1
      
      return sortDirection === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [livraisons, searchTerm, typeFilter, sortField, sortDirection])

  const handleSort = (field: keyof Livraison) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Rechercher par parcelle, BL, chauffeur..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Tous les types</option>
              <option value="entree">Entrées</option>
              <option value="sortie">Sorties</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('date_livraison')}
              >
                Date {sortField === 'date_livraison' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('numero_bl')}
              >
                N° BL {sortField === 'numero_bl' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Parcelle
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('poids_sec')}
              >
                Poids sec {sortField === 'poids_sec' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('poids_brut')}
              >
                Poids brut {sortField === 'poids_brut' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('humidite')}
              >
                Humidité {sortField === 'humidite' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Chauffeur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedLivraisons.map((livraison) => (
              <tr key={livraison.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(livraison.date_livraison).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.numero_bl || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.nom_parcelle || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.poids_sec?.toFixed(0) || 0} kg
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.poids_brut?.toFixed(0) || 0} kg
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.humidite ? (livraison.humidite / 10).toFixed(1) : 0}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {livraison.chauffeur || 'N/A'}
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

      {filteredAndSortedLivraisons.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          {searchTerm || typeFilter !== 'all' 
            ? 'Aucune livraison ne correspond à vos critères de recherche.'
            : 'Aucune livraison trouvée.'}
        </div>
      )}
    </div>
  )
}