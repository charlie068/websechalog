'use client'

import { useState, useEffect } from 'react'

interface SimpleNumberInputProps {
  initialValue: number
  onChange: (value: number) => void
  placeholder?: string
}

export default function SimpleNumberInput({ initialValue, onChange, placeholder = "0.00" }: SimpleNumberInputProps) {
  const [value, setValue] = useState(initialValue.toString())

  useEffect(() => {
    setValue(initialValue.toString())
  }, [initialValue])

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        const newValue = e.target.value
        setValue(newValue)
        
        // Parse and call onChange
        const numValue = newValue === '' ? 0 : parseFloat(newValue) || 0
        onChange(numValue)
      }}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
      placeholder={placeholder}
    />
  )
}