import { create } from 'zustand'

export type CartItemData = {
  id: string
  cart_id: string
  court_id: string
  start_time: string
  end_time: string
  price: number
  num_players: number
  court?: {
    id: string
    name: string
    venue?: {
      id: string
      name: string
    } | null
  } | null
  // UI-only states
  isUnavailable?: boolean
}

type CartState = {
  isOpen: boolean
  items: CartItemData[]
  cartId: string | null
  isLoading: boolean
  
  // Actions
  setIsOpen: (isOpen: boolean) => void
  toggleCart: () => void
  setCartData: (cartId: string, items: CartItemData[]) => void
  setLoading: (isLoading: boolean) => void
  setItemAvailability: (itemId: string, isUnavailable: boolean) => void
  
  // Computed helpers
  getTotalPrice: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  isOpen: false,
  items: [],
  cartId: null,
  isLoading: false,

  setIsOpen: (isOpen: boolean) => set({ isOpen }),
  toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
  setCartData: (cartId: string, items: CartItemData[]) => set({ cartId, items }),
  setLoading: (isLoading: boolean) => set({ isLoading }),
  setItemAvailability: (itemId: string, isUnavailable: boolean) => 
    set((state) => ({
      items: state.items.map((item) => 
        item.id === itemId ? { ...item, isUnavailable } : item
      )
    })),
  
  getTotalPrice: () => {
    const state = get()
    return state.items
      .filter((item) => !item.isUnavailable) // only tally available items
      .reduce((total, item) => total + Number(item.price), 0)
  },
  
  getItemCount: () => {
    return get().items.length
  }
}))
