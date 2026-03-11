import { create } from 'zustand'
import type { EndpointListFilters } from '@/features/endpoints/endpoint-types'

type DialogMode = 'create' | 'edit'

type EndpointsUiState = {
  dialogMode: DialogMode
  editingEndpointId: number | null
  filters: EndpointListFilters
  isDialogOpen: boolean
  openCreateDialog: () => void
  openEditDialog: (endpointId: number) => void
  closeDialog: () => void
  resetFilters: () => void
  setFilter: <K extends keyof EndpointListFilters>(key: K, value: EndpointListFilters[K]) => void
}

const initialFilters: EndpointListFilters = {
  providerType: '',
  logicalModel: '',
  status: '',
  keyword: ''
}

export const useEndpointsUiStore = create<EndpointsUiState>((set) => ({
  filters: initialFilters,
  isDialogOpen: false,
  dialogMode: 'create',
  editingEndpointId: null,
  setFilter: (key, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    })),
  resetFilters: () =>
    set({
      filters: initialFilters
    }),
  openCreateDialog: () =>
    set({
      isDialogOpen: true,
      dialogMode: 'create',
      editingEndpointId: null
    }),
  openEditDialog: (endpointId) =>
    set({
      isDialogOpen: true,
      dialogMode: 'edit',
      editingEndpointId: endpointId
    }),
  closeDialog: () =>
    set({
      isDialogOpen: false,
      editingEndpointId: null
    })
}))
