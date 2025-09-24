'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Client, Parcelle } from '@/lib/supabase'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import SimpleNumberInput from './SimpleNumberInput'
import ResponsiveLayout from './ResponsiveLayout'
import { useTranslations } from '@/hooks/useTranslations'

interface ProfileClientProps {
  client: Client
  user: User
}

export default function ProfileClient({ client, user }: ProfileClientProps) {
  const { t, loading: translationsLoading } = useTranslations()

  // Safe translation function
  const safeT = (key: string, fallback?: string): string => {
    if (translationsLoading || typeof t !== 'function') {
      // Return the key instead of fallback to avoid showing English text
      return key
    }
    return t(key, fallback)
  }

  const [isEditing, setIsEditing] = useState(false)
  const [isEditingParcelles, setIsEditingParcelles] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingParcelles, setLoadingParcelles] = useState(false)
  const [message, setMessage] = useState('')
  const [parcelleMessage, setParcelleMessage] = useState('')
  const [parcelles, setParcelles] = useState<Parcelle[]>([])
  
  // Form state
  const [formData, setFormData] = useState({
    email: user.email || '',
    phone: client.phone || '',
    rue: client.rue || '',
    code_postal: client.code_postal || '',
    ville: client.ville || ''
  })

  // Load parcelles on component mount
  useEffect(() => {
    fetchParcelles()
  }, [])

  const fetchParcelles = async () => {
    try {
      const { data, error } = await supabase
        .from('parcelles')
        .select('*')
        .eq('client_local_id', client.local_id)
        .eq('actif', true)
        .order('nom_parcelle')

      if (error) throw error
      setParcelles(data || [])
    } catch (error) {
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      // Update client information
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          phone: formData.phone,
          rue: formData.rue,
          code_postal: formData.code_postal,
          ville: formData.ville
        })
        .eq('local_id', client.local_id)

      if (clientError) throw clientError

      // Update email in Supabase auth if changed
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email
        })
        
        if (emailError) throw emailError
      }

      setMessage('Informations mises à jour avec succès!')
      setIsEditing(false)
      
      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
    } catch (error) {
      setMessage('Erreur lors de la mise à jour. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      email: user.email || '',
      phone: client.phone || '',
      rue: client.rue || '',
      code_postal: client.code_postal || '',
      ville: client.ville || ''
    })
    setIsEditing(false)
    setMessage('')
  }


  const handleParcelleNameChange = (parcelleId: number, value: string) => {
    setParcelles(prev => prev.map(p => 
      p.id === parcelleId ? { ...p, nom_parcelle: value } : p
    ))
  }

  const addNewParcelle = () => {
    const newParcelle: Parcelle = {
      id: Date.now(), // Temporary ID for new parcelle
      local_id: 0, // Will be set by database
      client_local_id: client.local_id,
      nom_parcelle: '',
      surface_hectares: 0,
      actif: true,
      last_modified: '',
      created_at: ''
    }
    setParcelles(prev => [...prev, newParcelle])
  }


  const saveParcelles = async () => {
    setLoadingParcelles(true)
    setParcelleMessage('')
    
    try {
      
      // Use API route to bypass RLS issues
      const response = await fetch('/api/parcelles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcelles: parcelles,
          clientLocalId: client.local_id
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la sauvegarde')
      }
      
      // Refresh data from database
      await fetchParcelles()
      
      setParcelleMessage(safeT('profile.parcelsUpdateSuccess', 'Parcels updated successfully!'))
      setIsEditingParcelles(false)
      
    } catch (error) {
      setParcelleMessage(safeT('profile.parcelsUpdateError', 'Error saving parcels.'))
    } finally {
      setLoadingParcelles(false)
    }
  }

  const cancelParcelleEdit = () => {
    fetchParcelles() // Reload original data
    setIsEditingParcelles(false)
    setParcelleMessage('')
  }

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">👤 {safeT('navigation.profile', 'My Profile')}</h3>
        <div className="space-y-2">
          <div className="bg-green-100 text-green-800 border-l-4 border-green-500 px-3 py-2 rounded-lg">
            <div className="font-medium flex items-center space-x-2">
              <span>👤</span>
              <span>{safeT('profile.personalInfo', 'Personal information')}</span>
            </div>
            <div className="text-xs text-green-600">{safeT('profile.manageData', 'Manage your data')}</div>
          </div>
        </div>
      </div>

      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 {safeT('dashboard.quickActions', 'Quick Actions')}</h3>
        <div className="space-y-2">
          <Link
            href="/dashboard"
            className="w-full flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <span>🏠</span>
            <span>{safeT('profile.backToDashboard', 'Back to Dashboard')}</span>
          </Link>
        </div>
      </div>
    </>
  )

  return (
    <ResponsiveLayout
      client={client}
      currentPage="profile"
      safeT={safeT}
      sidebarContent={sidebarContent}
    >
          {/* Profile Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">👤 {t('profile.title')}</h1>
            <p className="text-gray-600">{t('profile.subtitle')}</p>
          </div>

          {/* Message Display */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.includes('succès') 
                ? 'bg-green-100 text-green-800 border border-green-300' 
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}>
              {message}
            </div>
          )}

          {/* Profile Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">{t('profile.personalInfo')}</h2>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                >
                  <span>✏️</span>
                  <span>{t('common.edit')}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nom (read-only) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  👤 {safeT('profile.fullName', 'Full name')}
                </label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                  {client.nom_client || safeT('profile.notProvided', 'Not provided')}
                </div>
                <p className="text-xs text-gray-500 mt-1">{safeT('profile.cannotEditName', 'This field cannot be modified')}</p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📧 {safeT('common.email', 'Email')}
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="votre.email@exemple.com"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                    {formData.email || safeT('profile.notProvided', 'Not provided')}
                  </div>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📞 {safeT('common.phone', 'Phone')}
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0123456789"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                    {formData.phone || safeT('profile.notProvided', 'Not provided')}
                  </div>
                )}
              </div>

              {/* Street */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🏠 {safeT('profile.street', 'Street')}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="rue"
                    value={formData.rue}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Numéro et nom de rue"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                    {formData.rue || safeT('profile.notProvided', 'Not provided')}
                  </div>
                )}
              </div>

              {/* Postal code */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📮 {safeT('profile.postalCode', 'Postal code')}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="code_postal"
                    value={formData.code_postal}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="68250"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                    {formData.code_postal || safeT('profile.notProvided', 'Not provided')}
                  </div>
                )}
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🏙️ {safeT('profile.city', 'City')}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="ville"
                    value={formData.ville}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nom de la ville"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                    {formData.ville || 'Non renseigné'}
                  </div>
                )}
              </div>

            </div>

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {safeT('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>{safeT('common.save', 'Save')}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Parcelles Management Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">🌾 {safeT('profile.parcelManagement', 'Parcel management')}</h2>
              {!isEditingParcelles && (
                <button
                  onClick={() => setIsEditingParcelles(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                >
                  <span>✏️</span>
                  <span>{safeT('common.edit', 'Edit')}</span>
                </button>
              )}
            </div>

            {/* Parcelle Message Display */}
            {parcelleMessage && (
              <div className={`mb-4 p-4 rounded-lg ${
                parcelleMessage.includes('succès') 
                  ? 'bg-green-100 text-green-800 border border-green-300' 
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}>
                {parcelleMessage}
              </div>
            )}

            {parcelles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>{safeT('profile.noParcelsConfigured', 'No parcels configured')}</p>
                {isEditingParcelles && (
                  <button
                    onClick={addNewParcelle}
                    className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    + {safeT('profile.addParcel', 'Add parcel')}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {parcelles.map((parcelle, index) => (
                    <div key={`parcelle-${parcelle.id}`} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {safeT('profile.parcelName', 'Parcel name')}
                          </label>
                          {isEditingParcelles && parcelle.nom_parcelle !== 'Autres' ? (
                            <input
                              type="text"
                              value={parcelle.nom_parcelle}
                              onChange={(e) => handleParcelleNameChange(parcelle.id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                              placeholder={safeT('profile.parcelName', 'Parcel name')}
                            />
                          ) : (
                            <div className={`px-3 py-2 border border-gray-200 rounded-md text-sm ${parcelle.nom_parcelle === 'Autres' ? 'bg-gray-100' : 'bg-gray-50'}`}>
                              {parcelle.nom_parcelle === 'Autres'
                                ? safeT('common.other', 'Other')
                                : (parcelle.nom_parcelle || safeT('common.notDefined', 'Not defined'))
                              }
                              {parcelle.nom_parcelle === 'Autres' && (
                                <span className="text-xs text-gray-500 ml-2">({safeT('profile.cannotEditName', 'This field cannot be changed')})</span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {safeT('profile.surfaceHectares', 'Surface (hectares)')}
                          </label>
                          {isEditingParcelles ? (
                            <div>
                              <div style={{ fontSize: '10px', color: 'blue', marginBottom: '2px' }}>
                                {safeT('profile.parcel', 'Parcel')} {parcelle.id}: surface_hectares = {parcelle.surface_hectares}
                              </div>
                              <SimpleNumberInput
                                initialValue={parcelle.surface_hectares || 0}
                                onChange={(numValue) => {
                                  setParcelles(prev => {
                                    const updated = prev.map(p => 
                                      p.id === parcelle.id ? { ...p, surface_hectares: numValue } : p
                                    )
                                    return updated
                                  })
                                }}
                                placeholder="0.00"
                              />
                            </div>
                          ) : (
                            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                              {parcelle.surface_hectares ? `${parcelle.surface_hectares.toFixed(2)} ha` : '0.00 ha'}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  ))}
                </div>

                {isEditingParcelles && (
                  <div className="mt-4 flex justify-between items-center">
                    <button
                      onClick={addNewParcelle}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      + {safeT('profile.addParcel', 'Add parcel')}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Parcelles Action Buttons */}
            {isEditingParcelles && (
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={cancelParcelleEdit}
                  disabled={loadingParcelles}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {safeT('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={saveParcelles}
                  disabled={loadingParcelles}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center space-x-2"
                >
                  {loadingParcelles ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>{safeT('profile.saveParcels', 'Save parcels')}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
    </ResponsiveLayout>
  )
}