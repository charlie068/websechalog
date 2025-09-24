import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Database types based on C# models
export interface Client {
  id: number
  local_id: number
  nom_client: string
  email: string
  adresse_complete: string
  phone?: string
  rue?: string
  code_postal?: string
  ville?: string
  supabase_user_id?: string
  last_modified: string
  created_at: string
}

export interface Parcelle {
  id: number
  local_id: number
  client_local_id: number
  nom_parcelle: string
  surface_hectares: number
  actif: boolean
  last_modified: string
  created_at: string
}

export interface Vehicule {
  id: number
  local_id: number
  libelle: string
  actif: boolean
  date_derniere_utilisation?: string
  last_modified: string
  created_at: string
}

export interface Chauffeur {
  id: number
  local_id: number
  nom: string
  prenom: string
  actif: boolean
  last_modified: string
  created_at: string
}

export interface Livraison {
  id: number
  local_id: number
  client_local_id: number
  produit_local_id: number
  vehicule_local_id?: number
  date_pesee: string  // This is the actual database column name
  poids_final?: number
  poids_sec?: number
  poids_brut?: number
  humidite?: number
  parcelle?: string
  chauffeur?: string
  type_operation: 'entree' | 'sortie'
  rendement?: number
  annulee: boolean
  last_modified: string
  created_at: string
}

export interface Facture {
  id_facture: number
  id_client: number
  numero_facture: string
  date_facture: string
  date_echeance: string
  montant_sechage: number
  montant_stockage: number
  remise_sechage_pct: number
  remise_stockage_pct: number
  montant_total_ht: number
  montant_tva: number
  montant_total_ttc: number
  paye: boolean
  date_paiement?: string
  notes?: string
  created_date: string
  modified_date?: string
}

export interface FactureLigne {
  id_ligne: number
  id_facture: number
  id_entree: number
  description?: string
  quantite_tonnes: number
  prix_sechage_unitaire: number
  prix_stockage_unitaire: number
  montant_sechage: number
  montant_stockage: number
  created_date: string
}