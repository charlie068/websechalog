'use client'

import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { Livraison } from '@/lib/supabase'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface DashboardChartsProps {
  livraisons: Livraison[]
  t?: (key: string, fallback?: string) => string
}

export default function DashboardCharts({ livraisons, t }: DashboardChartsProps) {
  // Prepare data for charts
  const prepareParcelleData = () => {
    const parcelleStats = livraisons.reduce((acc, liv) => {
      const parcelle = liv.nom_parcelle || (t ? t('common.other', 'Other') : 'Other')
      if (!acc[parcelle]) {
        acc[parcelle] = { 
          poidsSec: 0, 
          poidsBrut: 0, 
          count: 0, 
          humiditeSum: 0, 
          humiditeCount: 0 
        }
      }
      acc[parcelle].poidsSec += liv.poids_sec || 0
      acc[parcelle].poidsBrut += liv.poids_brut || 0
      acc[parcelle].count += 1
      if (liv.humidite) {
        acc[parcelle].humiditeSum += liv.humidite
        acc[parcelle].humiditeCount += 1
      }
      return acc
    }, {} as Record<string, any>)

    return Object.entries(parcelleStats).map(([name, data]) => ({
      name,
      poidsSec: data.poidsSec,
      poidsBrut: data.poidsBrut,
      count: data.count,
      humidite: data.humiditeCount > 0 ? (data.humiditeSum / data.humiditeCount) : 0
    }))
  }

  const prepareTimelineData = () => {
    const monthlyData = livraisons.reduce((acc, liv) => {
      const date = new Date(liv.date_pesee)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!acc[monthKey]) {
        acc[monthKey] = { entrees: 0, sorties: 0, poidsSecTotal: 0 }
      }
      
      if (liv.type_operation === 'entree') {
        acc[monthKey].entrees += liv.poids_sec || 0
      } else {
        acc[monthKey].sorties += liv.poids_sec || 0
      }
      acc[monthKey].poidsSecTotal += liv.poids_sec || 0
      
      return acc
    }, {} as Record<string, any>)

    const sortedEntries = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b))
    
    return {
      labels: sortedEntries.map(([month]) => new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })),
      entrees: sortedEntries.map(([, data]) => (data.entrees / 1000).toFixed(1)),
      sorties: sortedEntries.map(([, data]) => (data.sorties / 1000).toFixed(1)),
      total: sortedEntries.map(([, data]) => (data.poidsSecTotal / 1000).toFixed(1))
    }
  }

  const parcelleData = prepareParcelleData()
  const timelineData = prepareTimelineData()

  // Chart configurations
  const parcelleChartData = {
    labels: parcelleData.map(p => p.name),
    datasets: [
      {
        label: 'Poids sec (tonnes)',
        data: parcelleData.map(p => (p.poidsSec / 1000).toFixed(1)),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 2,
      },
      {
        label: 'Poids brut (tonnes)',
        data: parcelleData.map(p => (p.poidsBrut / 1000).toFixed(1)),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
      }
    ],
  }

  const timelineChartData = {
    labels: timelineData.labels,
    datasets: [
      {
        label: 'Entrées (tonnes)',
        data: timelineData.entrees,
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Sorties (tonnes)',
        data: timelineData.sorties,
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
      }
    ],
  }

  const humiditeChartData = {
    labels: parcelleData.map(p => p.name),
    datasets: [{
      data: parcelleData.map(p => p.humidite.toFixed(1)),
      backgroundColor: [
        '#3B82F6',
        '#10B981',
        '#F59E0B',
        '#EF4444',
        '#8B5CF6',
        '#06B6D4',
        '#84CC16',
        '#F97316'
      ],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
            weight: 'bold' as const
          }
        }
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    },
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: {
            size: 12,
            weight: 'bold' as const
          },
          padding: 20
        }
      },
      title: {
        display: false,
      },
    },
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Production par Parcelle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">📊</span>
          Production par parcelle (tonnes)
        </h3>
        <div className="h-80">
          <Bar data={parcelleChartData} options={chartOptions} />
        </div>
      </div>

      {/* Évolution temporelle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">📈</span>
          Évolution mensuelle (tonnes)
        </h3>
        <div className="h-80">
          <Line data={timelineChartData} options={chartOptions} />
        </div>
      </div>

      {/* Répartition Humidité */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">💧</span>
          Humidité moyenne par parcelle (%)
        </h3>
        <div className="h-80">
          <Doughnut data={humiditeChartData} options={doughnutOptions} />
        </div>
      </div>

      {/* Statistiques détaillées */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">📋</span>
          Résumé par parcelle
        </h3>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {parcelleData.map((parcelle, index) => (
            <div key={parcelle.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{parcelle.name}</h4>
                <p className="text-sm text-gray-600">{parcelle.count} livraisons</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">
                  {(parcelle.poidsSec / 1000).toFixed(1)}t sec
                </p>
                <p className="text-xs text-gray-500">
                  {parcelle.humidite.toFixed(1)}% humid.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}